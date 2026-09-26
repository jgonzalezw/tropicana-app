"use server";

/**
 * C3 — hito H3: reservas con los 7 estados.
 *
 * Una membresía de particulares (H2) nace con su primera reserva ya
 * `confirmada`. Acá vive todo lo que pasa después: pedir una reserva nueva
 * (Solicitada o Confirmada directo — decisión de Javier, 26/09), cambiar de
 * estado, reprogramar y cancelar a pedido del alumno.
 *
 * El saldo de horas **se calcula** desde las reservas (regla de negocio 23),
 * nunca se guarda paso a paso — `saldoMembresia` (`@/lib/reservas`) lo hace
 * cada vez que hace falta, contando también las Solicitadas vigentes para no
 * dejar pedir más horas de las que quedan (decisión de Javier, 26/09).
 *
 * Cada cambio de estado queda en `reservas_historial` solo: las acciones acá
 * no insertan ahí directamente, dejan el motivo/glosa en las columnas
 * `cambio_*` de `reservas_sala` y el trigger de la migración 0054 escribe el
 * rastro (así ningún cambio puede olvidarse de dejarlo).
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual, alcancePropioDe } from "@/lib/sesion";
import { apellidoDe } from "@/lib/contactos";
import { formatearHoras, aMinutos, horaFin } from "@/lib/horarios";
import {
  puedeTransicionar,
  saldoMembresia,
  ocupaAhora,
  solicitudVigente,
  evaluarCancelacion,
  ETIQUETA_ESTADO_RESERVA,
  TRANSICIONES,
  type EstadoReserva,
} from "@/lib/reservas";
import { cargarContextoValidacion, validarFranja } from "./validacionReserva";

const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

export type AvisoPersona = { nombre: string; whatsapp: string | null; mensaje: string };
type ResultadoAccion = {
  ok?: true;
  mensaje?: string;
  error?: string;
  avisoAlumno?: AvisoPersona;
  avisoProfesor?: AvisoPersona;
};

/**
 * A quién avisar por el alumno: a él mismo, o a su tutor si es menor — igual
 * criterio que `calcularAgendaParticular` en `inscribir/acciones.ts` (H2).
 * Se repite acá (en vez de exportarla desde ese módulo) para no tocar código
 * ya validado por Javier en dev por un cambio que no le hace falta.
 */
async function destinatarioDeAlumno(
  sb: Awaited<ReturnType<typeof createClient>>,
  alumnoId: number
): Promise<{ nombre: string; whatsapp: string | null } | null> {
  const { data: alumnoRow } = await sb
    .from("alumnos")
    .select("contacto_id, es_menor, contacto:contactos(nombre, apellido, whatsapp)")
    .eq("id", alumnoId)
    .maybeSingle();
  const alumnoData = alumnoRow as unknown as {
    contacto_id: number;
    es_menor: boolean;
    contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null;
  } | null;
  if (!alumnoData) return null;

  let destinatario = {
    nombre: `${alumnoData.contacto?.nombre ?? ""} ${alumnoData.contacto?.apellido ?? ""}`.trim(),
    whatsapp: alumnoData.contacto?.whatsapp ?? null,
  };
  if (alumnoData.es_menor) {
    const { data: rel } = await sb
      .from("contacto_relaciones")
      .select("tutor:contactos!contacto_relaciones_desde_id_fkey(nombre, apellido, whatsapp)")
      .eq("tipo", "tutor_de")
      .eq("hacia_id", alumnoData.contacto_id)
      .maybeSingle();
    const tutor = (
      rel as unknown as { tutor: { nombre: string | null; apellido: string | null; whatsapp: string | null } } | null
    )?.tutor;
    if (tutor) destinatario = { nombre: `${tutor.nombre ?? ""} ${tutor.apellido ?? ""}`.trim(), whatsapp: tutor.whatsapp };
  }
  return destinatario;
}

function fechaHoraCorta(fecha: string, hora: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${DIAS[d.getDay()]} ${dd}/${mm} ${hora.slice(0, 5)}`;
}

/** "vie 02/10 de 15:00 a 16:00" — el mismo formato que usa la inscripción. */
function horario(fecha: string, hora: string, duracionMin: number): string {
  return `${fechaHoraCorta(fecha, hora).slice(0, -6)} de ${hora.slice(0, 5)} a ${horaFin(hora, duracionMin) ?? "?"}`;
}

const h = (min: number) => formatearHoras(min / 60);

/**
 * Todo lo que necesita un aviso, leído DESPUÉS de escribir (el saldo ya
 * refleja el cambio). Los mensajes siguen el formato de la venta de H2
 * (plan, profesor, horario, lugar) — pedido de Javier, 26/09: los avisos
 * tienen que ser tan claros como los de la inscripción.
 */
type ContextoAviso = {
  destinatario: { nombre: string; whatsapp: string | null } | null;
  alumnoNombre: string;
  profesor: { nombre: string; whatsapp: string | null };
  planNombre: string;
  contratadasMin: number;
  disponibleMin: number;
  lugar: (salaId: number) => string;
};

async function contextoAviso(
  a: ReturnType<typeof admin>,
  sb: Awaited<ReturnType<typeof createClient>>,
  membresiaId: number
): Promise<ContextoAviso | null> {
  const { data: mRow } = await a
    .from("membresias")
    .select(
      "alumno_id, horas_contratadas, plan:planes(nombre), " +
        "alumno:alumnos(contacto:contactos(nombre, apellido)), " +
        "profesor:profesores(contacto:contactos(nombre, apellido, whatsapp))"
    )
    .eq("id", membresiaId)
    .maybeSingle();
  const m = mRow as unknown as {
    alumno_id: number;
    horas_contratadas: number;
    plan: { nombre: string } | null;
    alumno: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
    profesor: { contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null } | null;
  } | null;
  if (!m) return null;

  const [salasR, msR, resR, destinatario] = await Promise.all([
    a.from("salas").select("id, nombre"),
    a.from("membresia_salas").select("sala_id, nombre_descriptivo").eq("membresia_id", membresiaId),
    a.from("reservas_sala").select("estado, duracion_min, solicitada_hasta").eq("membresia_id", membresiaId),
    destinatarioDeAlumno(sb, m.alumno_id),
  ]);
  const salas = (salasR.data as { id: number; nombre: string }[]) ?? [];
  const ms = (msR.data as { sala_id: number; nombre_descriptivo: string | null }[]) ?? [];
  const saldo = saldoMembresia({
    horasContratadas: Number(m.horas_contratadas) || 0,
    reservas: (resR.data as { estado: string; duracion_min: number; solicitada_hasta: string | null }[]) ?? [],
    ahora: new Date(),
  });
  const pc = m.profesor?.contacto;
  return {
    destinatario,
    alumnoNombre: `${m.alumno?.contacto?.nombre ?? ""} ${m.alumno?.contacto?.apellido ?? ""}`.trim() || "el alumno",
    profesor: { nombre: `${pc?.nombre ?? ""} ${pc?.apellido ?? ""}`.trim(), whatsapp: pc?.whatsapp ?? null },
    planNombre: m.plan?.nombre ?? "clases particulares",
    contratadasMin: saldo.contratadasMin,
    disponibleMin: saldo.disponibleMin,
    lugar: (salaId) => {
      const externa = ms.find((x) => x.sala_id === salaId)?.nombre_descriptivo;
      if (externa) return externa;
      const sala = salas.find((x) => x.id === salaId);
      return sala ? `Tropicana (${sala.nombre})` : "Tropicana";
    },
  };
}

function avisos(c: ContextoAviso | null, alumno: string, profesor: string): Pick<ResultadoAccion, "avisoAlumno" | "avisoProfesor"> {
  if (!c) return {};
  return {
    avisoAlumno: c.destinatario ? { nombre: c.destinatario.nombre, whatsapp: c.destinatario.whatsapp, mensaje: alumno } : undefined,
    avisoProfesor: c.profesor.nombre ? { nombre: c.profesor.nombre, whatsapp: c.profesor.whatsapp, mensaje: profesor } : undefined,
  };
}

const saldoTexto = (c: ContextoAviso) => `Te quedan ${h(c.disponibleMin)} h de tu paquete de ${h(c.contratadasMin)} h.`;

// ── Datos para la pantalla ──────────────────────────────────────────────

export type ReservaConHistorial = {
  id: number;
  fecha: string;
  hora: string;
  duracion_min: number;
  estado: EstadoReserva;
  solicitada_hasta: string | null;
  sala_id: number;
  salaNombre: string;
  ocupaAhora: boolean;
  transicionesPermitidas: EstadoReserva[];
  historial: {
    estado_nuevo: string;
    fecha_nueva: string;
    hora_nueva: string;
    motivo: string | null;
    glosa: string | null;
    fuera_de_plazo: boolean;
    creado_en: string;
  }[];
};

export type MembresiaParticularDetalle = {
  id: number;
  alumnoNombre: string;
  alumnoId: number;
  planNombre: string;
  estilo: string;
  profesorNombre: string;
  profesorId: number;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  saldo: {
    contratadasMin: number;
    consumidasMin: number;
    solicitadasVigentesMin: number;
    sinAgendarMin: number;
    disponibleMin: number;
  };
  salasDeLaMembresia: { salaId: number; nombre: string; esExterna: boolean }[];
  reservas: ReservaConHistorial[];
  error?: string;
};

export type FilaParticular = {
  id: number;
  alumnoNombre: string;
  /** Solo para el buscador (mismo criterio que Alumnos: nombre o WhatsApp). */
  alumnoWhatsapp: string | null;
  tutorWhatsapp: string | null;
  planNombre: string;
  estilo: string;
  profesorNombre: string;
  fechaInicio: string;
  fechaFin: string;
  contratadasMin: number;
  disponibleMin: number;
  solicitadasVigentes: number;
};

/**
 * Lista de membresías de particulares activas, para `/particulares`. Primero
 * las que tienen una Solicitada vigente —son las que esperan una acción—, y
 * después por apellido (regla de negocio 15).
 */
export async function listarMembresiasParticulares(): Promise<{ items: FilaParticular[]; error?: string }> {
  if (!(await tienePermiso("particulares", "ver"))) return { items: [], error: "Sin permiso para ver clases particulares." };

  // Alcance Propio/Todo (H4, 2026-09-26): sin esto, cualquiera con permiso de
  // ver Particulares veía las de TODOS los profesores. Con "Propio", cada
  // profesor ve solo las suyas — nunca una lista vacía sin explicar por qué
  // (regla de calidad 5).
  const { propio, profesorId } = await alcancePropioDe("particulares");
  if (propio && !profesorId)
    return {
      items: [],
      error:
        "Tu cuenta no está vinculada a ningún profesor: pedile a un administrador que la vincule desde Profesores → Profesores y cursos → Cuenta de acceso.",
    };

  const sb = await createClient();
  let query = sb
    .from("membresias")
    .select(
      "id, fecha_inicio, fecha_fin, horas_contratadas, estado, " +
        "alumno:alumnos(es_menor, contacto_id, contacto:contactos(nombre, apellido, whatsapp)), " +
        "plan:planes(nombre, estilo), " +
        "profesor:profesores(contacto:contactos(nombre, apellido)), " +
        "reservas:reservas_sala(estado, duracion_min, solicitada_hasta)"
    )
    .is("curso_id", null)
    .eq("estado", "activa");
  if (propio && profesorId) query = query.eq("profesor_id", profesorId);
  const [memR, estR] = await Promise.all([query, sb.from("estilos").select("clave, nombre")]);
  if (memR.error) return { items: [], error: `No se pudieron leer las membresías de particulares: ${memR.error.message}` };
  if (estR.error) return { items: [], error: `No se pudieron leer los estilos: ${estR.error.message}` };

  type Fila = {
    id: number;
    fecha_inicio: string;
    fecha_fin: string;
    horas_contratadas: number;
    alumno: {
      es_menor: boolean;
      contacto_id: number;
      contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null;
    } | null;
    plan: { nombre: string; estilo: string | null } | null;
    profesor: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
    reservas: { estado: string; duracion_min: number; solicitada_hasta: string | null }[];
  };
  const filas = (memR.data as unknown as Fila[]) ?? [];
  const estilos = new Map(((estR.data as { clave: string; nombre: string }[]) ?? []).map((e) => [e.clave, e.nombre]));

  // WhatsApp del tutor de los menores, para que el buscador los encuentre
  // igual que en Alumnos (un menor se ubica por el número de su tutor).
  const menores = filas.filter((f) => f.alumno?.es_menor).map((f) => f.alumno!.contacto_id);
  const tutores = new Map<number, string | null>();
  if (menores.length) {
    const { data: rel } = await sb
      .from("contacto_relaciones")
      .select("hacia_id, tutor:contactos!contacto_relaciones_desde_id_fkey(whatsapp)")
      .eq("tipo", "tutor_de")
      .in("hacia_id", menores);
    for (const r of (rel as unknown as { hacia_id: number; tutor: { whatsapp: string | null } | null }[]) ?? [])
      tutores.set(r.hacia_id, r.tutor?.whatsapp ?? null);
  }

  const ahora = new Date();
  const items = filas.map((m) => {
    const saldo = saldoMembresia({ horasContratadas: Number(m.horas_contratadas) || 0, reservas: m.reservas, ahora });
    return {
      fila: {
        id: m.id,
        alumnoNombre: `${m.alumno?.contacto?.nombre ?? ""} ${m.alumno?.contacto?.apellido ?? ""}`.trim(),
        alumnoWhatsapp: m.alumno?.contacto?.whatsapp ?? null,
        tutorWhatsapp: m.alumno ? (tutores.get(m.alumno.contacto_id) ?? null) : null,
        planNombre: m.plan?.nombre ?? "—",
        estilo: m.plan?.estilo ? (estilos.get(m.plan.estilo) ?? m.plan.estilo) : "—",
        profesorNombre: `${m.profesor?.contacto?.nombre ?? ""} ${m.profesor?.contacto?.apellido ?? ""}`.trim(),
        fechaInicio: m.fecha_inicio,
        fechaFin: m.fecha_fin,
        contratadasMin: saldo.contratadasMin,
        disponibleMin: saldo.disponibleMin,
        solicitadasVigentes: m.reservas.filter(
          (r) => r.estado === "solicitada" && solicitudVigente(r.solicitada_hasta, ahora)
        ).length,
      },
      apellido: apellidoDe(m.alumno?.contacto ?? undefined),
    };
  });
  items.sort(
    (a, b) =>
      Number(b.fila.solicitadasVigentes > 0) - Number(a.fila.solicitadasVigentes > 0) ||
      a.apellido.localeCompare(b.apellido, "es")
  );
  return { items: items.map((x) => x.fila) };
}

/**
 * El motivo de una suspensión se guarda como clave del catálogo; en pantalla
 * va su etiqueta (regla de calidad 6). Compartido por `obtenerMembresiaParticular`
 * y `obtenerReservaParaGestion` para no leer el catálogo dos veces con lógica
 * separada.
 */
async function mapaEtiquetaMotivoSuspension(
  sb: Awaited<ReturnType<typeof createClient>>
): Promise<Map<string, string>> {
  const { data: catSus } = await sb.from("catalogos").select("id").eq("clave", "motivo_suspension_reserva").maybeSingle();
  const { data: valSus } = catSus
    ? await sb.from("catalogo_valores").select("valor, etiqueta").eq("catalogo_id", (catSus as { id: number }).id)
    : { data: [] as { valor: string; etiqueta: string }[] };
  return new Map(((valSus as { valor: string; etiqueta: string }[]) ?? []).map((v) => [v.valor, v.etiqueta]));
}

type FilaReservaConSala = {
  id: number;
  fecha: string;
  hora: string;
  duracion_min: number;
  estado: string;
  solicitada_hasta: string | null;
  sala_id: number;
  sala: { nombre: string } | null;
};
type FilaHistorialReserva = {
  reserva_id: number;
  estado_nuevo: string;
  fecha_nueva: string;
  hora_nueva: string;
  motivo: string | null;
  glosa: string | null;
  fuera_de_plazo: boolean;
  creado_en: string;
};
type SalaDeMembresia = { salaId: number; nombre: string; esExterna: boolean };

/** Arma una `ReservaConHistorial` desde sus filas crudas — compartido por
 *  `obtenerMembresiaParticular` (todas las reservas de la membresía) y
 *  `obtenerReservaParaGestion` (una sola), para no duplicar el mapeo. */
function armarReservaConHistorial(
  r: FilaReservaConSala,
  historialDeEsta: FilaHistorialReserva[],
  salasDeLaMembresia: SalaDeMembresia[],
  etiquetaMotivo: Map<string, string>,
  ahora: Date
): ReservaConHistorial {
  const estado = r.estado as EstadoReserva;
  const salaNombre = salasDeLaMembresia.find((s) => s.salaId === r.sala_id)?.nombre || r.sala?.nombre || "—";
  return {
    id: r.id,
    fecha: r.fecha,
    hora: r.hora,
    duracion_min: r.duracion_min,
    estado,
    solicitada_hasta: r.solicitada_hasta,
    sala_id: r.sala_id,
    salaNombre,
    ocupaAhora: ocupaAhora({ tipo: "particular", estado, solicitadaHasta: r.solicitada_hasta }, ahora),
    transicionesPermitidas: [...TRANSICIONES[estado]],
    historial: historialDeEsta.map((h) => ({
      estado_nuevo: h.estado_nuevo,
      fecha_nueva: h.fecha_nueva,
      hora_nueva: h.hora_nueva,
      motivo: h.motivo ? (etiquetaMotivo.get(h.motivo) ?? h.motivo) : null,
      glosa: h.glosa,
      fuera_de_plazo: h.fuera_de_plazo,
      creado_en: h.creado_en,
    })),
  };
}

/** El detalle de una membresía y sus reservas, para `/particulares/[id]`. */
export async function obtenerMembresiaParticular(membresiaId: number): Promise<MembresiaParticularDetalle | { error: string }> {
  if (!(await tienePermiso("particulares", "ver"))) return { error: "Sin permiso para ver clases particulares." };

  // Alcance Propio/Todo (H4): el chequeo real es después de leer la membresía
  // (hace falta su profesor_id) — acá solo se corta el caso sin profesor
  // vinculado, igual que en `listarMembresiasParticulares`.
  const { propio, profesorId } = await alcancePropioDe("particulares");
  if (propio && !profesorId)
    return { error: "Tu cuenta no está vinculada a ningún profesor: no podés ver clases particulares." };

  const sb = await createClient();
  const { data: m, error } = await sb
    .from("membresias")
    .select(
      "id, fecha_inicio, fecha_fin, estado, horas_contratadas, alumno_id, profesor_id, " +
        "alumno:alumnos(contacto:contactos(nombre, apellido)), " +
        "plan:planes(nombre, estilo), " +
        "profesor:profesores(contacto:contactos(nombre, apellido))"
    )
    .eq("id", membresiaId)
    .is("curso_id", null)
    .maybeSingle();
  if (error) return { error: `No se pudo leer la membresía: ${error.message}` };
  if (!m) return { error: "Esa membresía de particulares no existe." };
  type M = {
    id: number;
    fecha_inicio: string;
    fecha_fin: string;
    estado: string;
    horas_contratadas: number;
    alumno_id: number;
    profesor_id: number;
    alumno: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
    plan: { nombre: string; estilo: string | null } | null;
    profesor: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
  };
  const mm = m as unknown as M;
  if (propio && mm.profesor_id !== profesorId) return { error: "Esta membresía es de otro profesor: no tenés acceso a ella." };
  const { data: estRow } = mm.plan?.estilo
    ? await sb.from("estilos").select("nombre").eq("clave", mm.plan.estilo).maybeSingle()
    : { data: null };

  const [salasR, reservasR] = await Promise.all([
    sb.from("membresia_salas").select("sala_id, nombre_descriptivo, sala:salas(nombre, es_externa)").eq("membresia_id", membresiaId),
    sb
      .from("reservas_sala")
      .select("id, fecha, hora, duracion_min, estado, solicitada_hasta, sala_id, sala:salas(nombre)")
      .eq("membresia_id", membresiaId)
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true }),
  ]);
  if (salasR.error) return { error: `No se pudieron leer las salas de la membresía: ${salasR.error.message}` };
  if (reservasR.error) return { error: `No se pudieron leer las reservas: ${reservasR.error.message}` };

  const reservaIds = ((reservasR.data as { id: number }[]) ?? []).map((r) => r.id);
  const historialR = reservaIds.length
    ? await sb
        .from("reservas_historial")
        .select("reserva_id, estado_nuevo, fecha_nueva, hora_nueva, motivo, glosa, fuera_de_plazo, creado_en")
        .in("reserva_id", reservaIds)
        .order("creado_en", { ascending: true })
    : { data: [] as unknown[], error: null };
  if (historialR.error) return { error: `No se pudo leer el historial: ${historialR.error.message}` };

  type FilaSala = { sala_id: number; nombre_descriptivo: string | null; sala: { nombre: string; es_externa: boolean } | null };
  const salas = (salasR.data as unknown as FilaSala[]) ?? [];
  const salasResueltas: SalaDeMembresia[] = salas.map((s) => ({
    salaId: s.sala_id,
    nombre: s.nombre_descriptivo || s.sala?.nombre || "—",
    esExterna: s.sala?.es_externa ?? false,
  }));

  const reservasRaw = (reservasR.data as unknown as FilaReservaConSala[]) ?? [];
  const historialRaw = (historialR.data as unknown as FilaHistorialReserva[]) ?? [];
  const etiquetaMotivo = await mapaEtiquetaMotivoSuspension(sb);

  const ahora = new Date();
  const reservas: ReservaConHistorial[] = reservasRaw.map((r) =>
    armarReservaConHistorial(
      r,
      historialRaw.filter((h) => h.reserva_id === r.id),
      salasResueltas,
      etiquetaMotivo,
      ahora
    )
  );

  const saldo = saldoMembresia({
    horasContratadas: Number(mm.horas_contratadas) || 0,
    reservas: reservasRaw,
    ahora,
  });

  return {
    id: mm.id,
    alumnoId: mm.alumno_id,
    alumnoNombre: `${mm.alumno?.contacto?.nombre ?? ""} ${mm.alumno?.contacto?.apellido ?? ""}`.trim(),
    planNombre: mm.plan?.nombre ?? "—",
    estilo: (estRow as { nombre: string } | null)?.nombre ?? mm.plan?.estilo ?? "—",
    profesorId: mm.profesor_id,
    profesorNombre: `${mm.profesor?.contacto?.nombre ?? ""} ${mm.profesor?.contacto?.apellido ?? ""}`.trim(),
    fechaInicio: mm.fecha_inicio,
    fechaFin: mm.fecha_fin,
    estado: mm.estado,
    saldo,
    salasDeLaMembresia: salasResueltas,
    reservas,
  };
}

/**
 * El detalle de UNA reserva puntual y el contexto mínimo para gestionarla
 * (H4, 2026-09-26): igual que `obtenerMembresiaParticular`, pero acotado a una
 * sola reserva — para el panel enfocado de `/sala`, donde no hace falta traer
 * el resto de las reservas ni todas las cuotas de la membresía (Javier,
 * 26/09: "el flujo normal debería ser ver solo el recuadro... de la reserva
 * específica"). El mismo mapeo que arma cada reserva se comparte con
 * `obtenerMembresiaParticular` vía `armarReservaConHistorial`.
 */
export type DetalleGestionReserva = {
  reserva: ReservaConHistorial;
  membresiaId: number;
  alumnoNombre: string;
  disponibleMin: number;
  fechaInicioMembresia: string;
  fechaFinMembresia: string;
  salasDeLaMembresia: SalaDeMembresia[];
};

export async function obtenerReservaParaGestion(reservaId: number): Promise<DetalleGestionReserva | { error: string }> {
  if (!(await tienePermiso("particulares", "ver"))) return { error: "Sin permiso para ver clases particulares." };

  const { propio, profesorId } = await alcancePropioDe("particulares");
  if (propio && !profesorId)
    return { error: "Tu cuenta no está vinculada a ningún profesor: no podés ver clases particulares." };

  const sb = await createClient();
  const { data: rRow, error: errR } = await sb
    .from("reservas_sala")
    .select("id, fecha, hora, duracion_min, estado, solicitada_hasta, sala_id, tipo, membresia_id, sala:salas(nombre)")
    .eq("id", reservaId)
    .maybeSingle();
  if (errR) return { error: `No se pudo leer la reserva: ${errR.message}` };
  if (!rRow || rRow.tipo !== "particular" || rRow.membresia_id == null) return { error: "Esa reserva no existe." };

  const { data: m, error: errM } = await sb
    .from("membresias")
    .select(
      "fecha_inicio, fecha_fin, horas_contratadas, profesor_id, alumno:alumnos(contacto:contactos(nombre, apellido))"
    )
    .eq("id", rRow.membresia_id)
    .maybeSingle();
  if (errM) return { error: `No se pudo leer la membresía: ${errM.message}` };
  if (!m) return { error: "La membresía de esta reserva ya no existe." };
  type M = {
    fecha_inicio: string;
    fecha_fin: string;
    horas_contratadas: number;
    profesor_id: number;
    alumno: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
  };
  const mm = m as unknown as M;
  if (propio && mm.profesor_id !== profesorId) return { error: "Esta reserva es de otro profesor: no tenés acceso a ella." };

  const [salasR, reservasR, historialR] = await Promise.all([
    sb.from("membresia_salas").select("sala_id, nombre_descriptivo, sala:salas(nombre, es_externa)").eq("membresia_id", rRow.membresia_id),
    sb.from("reservas_sala").select("estado, duracion_min, solicitada_hasta").eq("membresia_id", rRow.membresia_id),
    sb
      .from("reservas_historial")
      .select("reserva_id, estado_nuevo, fecha_nueva, hora_nueva, motivo, glosa, fuera_de_plazo, creado_en")
      .eq("reserva_id", reservaId)
      .order("creado_en", { ascending: true }),
  ]);
  if (salasR.error) return { error: `No se pudieron leer las salas de la membresía: ${salasR.error.message}` };
  if (reservasR.error) return { error: `No se pudo leer el saldo de la membresía: ${reservasR.error.message}` };
  if (historialR.error) return { error: `No se pudo leer el historial: ${historialR.error.message}` };

  type FilaSala = { sala_id: number; nombre_descriptivo: string | null; sala: { nombre: string; es_externa: boolean } | null };
  const salasResueltas: SalaDeMembresia[] = ((salasR.data as unknown as FilaSala[]) ?? []).map((s) => ({
    salaId: s.sala_id,
    nombre: s.nombre_descriptivo || s.sala?.nombre || "—",
    esExterna: s.sala?.es_externa ?? false,
  }));

  const ahora = new Date();
  const saldo = saldoMembresia({
    horasContratadas: Number(mm.horas_contratadas) || 0,
    reservas: (reservasR.data as { estado: string; duracion_min: number; solicitada_hasta: string | null }[]) ?? [],
    ahora,
  });
  const etiquetaMotivo = await mapaEtiquetaMotivoSuspension(sb);
  const reserva = armarReservaConHistorial(
    rRow as unknown as FilaReservaConSala,
    (historialR.data as unknown as FilaHistorialReserva[]) ?? [],
    salasResueltas,
    etiquetaMotivo,
    ahora
  );

  return {
    reserva,
    membresiaId: rRow.membresia_id,
    alumnoNombre: `${mm.alumno?.contacto?.nombre ?? ""} ${mm.alumno?.contacto?.apellido ?? ""}`.trim(),
    disponibleMin: saldo.disponibleMin,
    fechaInicioMembresia: mm.fecha_inicio,
    fechaFinMembresia: mm.fecha_fin,
    salasDeLaMembresia: salasResueltas,
  };
}

// ── Crear una reserva nueva ───────────────────────────────────────────────

export type EntradaNuevaReserva = {
  membresiaId: number;
  fecha: string;
  hora: string;
  duracionMin: number;
  sala: { tipo: "propia"; salaId: number } | { tipo: "externa"; nombreDescriptivo: string };
  accion: "solicitar" | "confirmar";
};

export async function crearReserva(e: EntradaNuevaReserva): Promise<ResultadoAccion> {
  if (!(await tienePermiso("particulares", "crear"))) return { error: "No tenés permiso para crear reservas." };
  if (!ISO_FECHA.test(e.fecha)) return { error: "La fecha no es válida." };
  if (aMinutos(e.hora) == null) return { error: "La hora no es válida." };

  const perfil = await obtenerPerfilActual();
  const a = admin();
  const sb = await createClient();

  const { data: mRow, error: errM } = await a
    .from("membresias")
    .select("id, estado, fecha_inicio, fecha_fin, horas_contratadas, alumno_id, profesor_id, plan_id, acompanantes")
    .eq("id", e.membresiaId)
    .is("curso_id", null)
    .maybeSingle();
  if (errM) return { error: `No se pudo leer la membresía: ${errM.message}` };
  if (!mRow) return { error: "Esa membresía de particulares no existe." };
  const { propio, profesorId } = await alcancePropioDe("particulares");
  if (propio && mRow.profesor_id !== profesorId) return { error: "Esta membresía es de otro profesor: no podés crear reservas en ella." };
  if (mRow.estado !== "activa") return { error: "Esta membresía no está activa." };
  if (e.fecha < mRow.fecha_inicio || e.fecha > mRow.fecha_fin)
    return { error: `La fecha queda fuera de la vigencia de la membresía (${mRow.fecha_inicio} a ${mRow.fecha_fin}).` };

  const { data: planRow } = await a.from("planes").select("id, salas_modo").eq("id", mRow.plan_id).maybeSingle();
  if (!planRow) return { error: "El plan de esta membresía ya no existe." };

  // ── Resolver la sala: una ya usada por la membresía, otra propia que el
  //    plan permita, o la externa con su nombre descriptivo.
  let salaId: number;
  let esExterna = false;
  if (e.sala.tipo === "externa") {
    const { data: externaRow } = await a.from("salas").select("id").eq("es_externa", true).eq("activa", true).maybeSingle();
    if (!externaRow) return { error: "No hay una sala externa activa configurada." };
    salaId = externaRow.id as number;
    esExterna = true;
    const nombreDescriptivo = e.sala.nombreDescriptivo.trim();
    if (!nombreDescriptivo) return { error: 'Una sala externa necesita un nombre descriptivo (ej. "Salón X — Hotel Y").' };
    const { data: yaExiste } = await a
      .from("membresia_salas")
      .select("sala_id")
      .eq("membresia_id", e.membresiaId)
      .eq("sala_id", salaId)
      .maybeSingle();
    if (!yaExiste) {
      const { error: errIns } = await a
        .from("membresia_salas")
        .insert({ membresia_id: e.membresiaId, sala_id: salaId, nombre_descriptivo: nombreDescriptivo });
      if (errIns) return { error: `No se pudo asociar la sala externa: ${errIns.message}` };
    }
  } else {
    const { data: salaRow } = await a.from("salas").select("id, activa, es_externa").eq("id", e.sala.salaId).maybeSingle();
    if (!salaRow || !salaRow.activa || salaRow.es_externa) return { error: "La sala elegida no existe o no está activa." };
    salaId = salaRow.id as number;
    const { data: yaUsada } = await a
      .from("membresia_salas")
      .select("sala_id")
      .eq("membresia_id", e.membresiaId)
      .eq("sala_id", salaId)
      .maybeSingle();
    if (!yaUsada) {
      if (planRow.salas_modo === "solo") {
        const { data: permitida } = await a.from("plan_salas").select("sala_id").eq("plan_id", planRow.id).eq("sala_id", salaId).maybeSingle();
        if (!permitida) return { error: "Esta plantilla no permite esa sala. Se ajusta en Planes." };
      }
      const { error: errIns } = await a.from("membresia_salas").insert({ membresia_id: e.membresiaId, sala_id: salaId, nombre_descriptivo: null });
      if (errIns) return { error: `No se pudo asociar la sala: ${errIns.message}` };
    }
  }

  // ── Saldo: no se puede pedir más de lo que queda (decisión de Javier, 26/09) ──
  const { data: reservasRows, error: errRes } = await a
    .from("reservas_sala")
    .select("estado, duracion_min, solicitada_hasta")
    .eq("membresia_id", e.membresiaId);
  if (errRes) return { error: `No se pudo leer el saldo de la membresía: ${errRes.message}` };
  const ahora = new Date();
  const saldo = saldoMembresia({ horasContratadas: Number(mRow.horas_contratadas) || 0, reservas: reservasRows ?? [], ahora });
  if (e.duracionMin > saldo.disponibleMin)
    return {
      error: `Quedan ${formatearHoras(saldo.disponibleMin / 60)} h disponibles del paquete (${formatearHoras(
        saldo.sinAgendarMin / 60
      )} h sin agendar, ${formatearHoras(saldo.solicitadasVigentesMin / 60)} h en Solicitadas vigentes) y se pidieron ${formatearHoras(e.duracionMin / 60)} h.`,
    };

  // ── Validar sala y profesor ────────────────────────────────────────────
  const ctx = await cargarContextoValidacion(a, esExterna ? null : salaId, mRow.profesor_id, e.fecha);
  const personas = 1 + Math.max(0, Math.trunc(mRow.acompanantes ?? 0));
  const validacion = validarFranja(ctx, e.fecha, e.hora, e.duracionMin, esExterna, personas, ahora);
  if (!validacion.ok) return { error: validacion.motivo };

  const validezHoras = Math.max(1, Number(await obtenerParametro("reserva_solicitud_validez_horas")) || 24);
  const solicitadaHasta =
    e.accion === "solicitar" ? new Date(ahora.getTime() + validezHoras * 60 * 60 * 1000).toISOString() : null;

  const { error: errIns } = await a.from("reservas_sala").insert({
    sala_id: salaId,
    tipo: "particular",
    membresia_id: e.membresiaId,
    profesor_id: mRow.profesor_id,
    fecha: e.fecha,
    hora: e.hora,
    duracion_min: e.duracionMin,
    estado: e.accion === "solicitar" ? "solicitada" : "confirmada",
    solicitada_hasta: solicitadaHasta,
    creado_por: perfil?.id ?? null,
  });
  if (errIns) {
    if ((errIns as { code?: string }).code === "23P01")
      return { error: "La sala se acaba de ocupar con otra reserva en ese horario. Recargá e intentá de nuevo." };
    return { error: `No se pudo crear la reserva: ${errIns.message}` };
  }

  revalidatePath(`/particulares/${e.membresiaId}`);
  revalidatePath("/particulares");
  revalidatePath("/sala");

  const c = await contextoAviso(a, sb, e.membresiaId);
  const cuando = horario(e.fecha, e.hora, e.duracionMin);
  const lugar = c?.lugar(salaId) ?? "Tropicana";
  if (e.accion === "solicitar")
    return {
      ok: true,
      mensaje: `Solicitada para el ${cuando}. Ocupa la sala y al profesor hasta que se confirme (o vence en ${validezHoras} h).`,
      ...avisos(
        c,
        `Hola! Estamos coordinando tu clase particular (${c?.planNombre}) con ${c?.profesor.nombre} para el ${cuando}, en ${lugar}. Te la confirmamos a la brevedad.`,
        `Hola! Estamos coordinando una clase particular (${c?.planNombre}) con ${c?.alumnoNombre} para el ${cuando}, en ${lugar}. ¿Te queda bien? Te confirmamos.`
      ),
    };
  return {
    ok: true,
    mensaje: `Confirmada para el ${cuando}.`,
    ...avisos(
      c,
      `Hola! Confirmamos tu clase particular (${c?.planNombre}) con ${c?.profesor.nombre}: ${cuando}, en ${lugar}. ${c ? saldoTexto(c) : ""} ¡Te esperamos!`,
      `Hola! Se te confirmó una clase particular (${c?.planNombre}) con ${c?.alumnoNombre}: ${cuando}, en ${lugar}.`
    ),
  };
}

// ── Cambiar de estado ─────────────────────────────────────────────────────

export async function cambiarEstadoReserva(
  reservaId: number,
  destino: EstadoReserva,
  opciones?: { motivo?: string; glosa?: string }
): Promise<ResultadoAccion> {
  if (!(await tienePermiso("particulares", "editar"))) return { error: "No tenés permiso para cambiar una reserva." };

  const perfil = await obtenerPerfilActual();
  const a = admin();
  const sb = await createClient();

  const { data: rRow, error: errR } = await a
    .from("reservas_sala")
    .select("id, tipo, estado, membresia_id, sala_id, profesor_id, fecha, hora, duracion_min, solicitada_hasta")
    .eq("id", reservaId)
    .maybeSingle();
  if (errR) return { error: `No se pudo leer la reserva: ${errR.message}` };
  if (!rRow) return { error: "Esa reserva no existe." };
  const { propio, profesorId } = await alcancePropioDe("particulares");
  if (propio && rRow.profesor_id !== profesorId) return { error: "Esta reserva es de otro profesor: no podés cambiarla." };
  if (rRow.tipo === "bloqueo") return { error: "Un bloqueo se cancela desde Sala, no desde acá." };
  const actual = rRow.estado as EstadoReserva;
  if (!puedeTransicionar(actual, destino))
    return { error: `No se puede pasar de ${ETIQUETA_ESTADO_RESERVA[actual]} a ${ETIQUETA_ESTADO_RESERVA[destino]}.` };

  let etiquetaMotivoSuspension: string | null = null;
  if (destino === "suspendida") {
    if (!opciones?.motivo) return { error: "Suspender una reserva necesita un motivo del catálogo." };
    // El motivo se re-valida en servidor aunque la UI ya lo restrinja a un
    // <select>: la lista manda, el cliente no es de confiar (regla de
    // calidad 6). De paso resuelve la etiqueta para el aviso — el mensaje
    // muestra "Conflicto operativo", nunca la clave cruda "conflicto_operativo".
    const { data: catRow } = await a.from("catalogos").select("id").eq("clave", "motivo_suspension_reserva").maybeSingle();
    const { data: valRow } = catRow
      ? await a.from("catalogo_valores").select("etiqueta").eq("catalogo_id", catRow.id).eq("valor", opciones.motivo).eq("activo", true).maybeSingle()
      : { data: null };
    if (!valRow) return { error: "Elegí un motivo de la lista: no se puede suspender sin decir por qué." };
    etiquetaMotivoSuspension = (valRow as { etiqueta: string }).etiqueta;
  }

  const ahora = new Date();
  const inicioReserva = new Date(`${rRow.fecha}T${rRow.hora}`);
  if ((destino === "ausente" || destino === "realizada") && (actual === "confirmada" || actual === "reprogramada") && ahora < inicioReserva)
    return { error: "Todavía no llegó la hora de esta clase: no se puede marcar Ausente ni Realizada antes de que empiece." };

  // Pasar de 'solicitada' a un estado que ocupa de verdad exige revalidar:
  // mientras estuvo Solicitada, la franja no tenía la protección del EXCLUDE.
  if (actual === "solicitada" && destino === "confirmada") {
    const ctx = await cargarContextoValidacion(a, rRow.sala_id, rRow.profesor_id, rRow.fecha, rRow.id);
    const { data: salaRow } = await a.from("salas").select("es_externa").eq("id", rRow.sala_id).maybeSingle();
    const esExterna = salaRow?.es_externa ?? false;
    const validacion = validarFranja(ctx, rRow.fecha, rRow.hora, rRow.duracion_min, esExterna, undefined, ahora);
    if (!validacion.ok) return { error: validacion.motivo };
  }

  const payload: Record<string, unknown> = {
    estado: destino,
    solicitada_hasta: null,
    cambio_motivo: opciones?.motivo?.trim() || null,
    cambio_glosa: opciones?.glosa?.trim() || null,
    cambio_fuera_de_plazo: false,
    actualizado_por: perfil?.id ?? null,
  };

  const { data: actualizado, error: errUp } = await a
    .from("reservas_sala")
    .update(payload)
    .eq("id", reservaId)
    .eq("estado", actual)
    .select("id");
  if (errUp) {
    if ((errUp as { code?: string }).code === "23P01")
      return { error: "Esa franja se acaba de ocupar con otra reserva. Recargá e intentá de nuevo." };
    return { error: `No se pudo cambiar el estado: ${errUp.message}` };
  }
  if (!actualizado || actualizado.length === 0)
    return { error: "El estado de esta reserva cambió mientras tanto. Recargá e intentá de nuevo." };

  revalidatePath(`/particulares/${rRow.membresia_id}`);
  revalidatePath("/particulares");
  revalidatePath("/sala");

  // Aviso solo en los cambios que le importan a alguien afuera del sistema
  // (proceso 12): confirmar y suspender. Ausente/Realizada son registro
  // interno de lo que ya pasó.
  if (destino !== "confirmada" && destino !== "suspendida")
    return { ok: true, mensaje: `Marcada ${ETIQUETA_ESTADO_RESERVA[destino]}.` };

  const c = await contextoAviso(a, sb, rRow.membresia_id);
  const cuando = horario(rRow.fecha, rRow.hora, rRow.duracion_min);
  const lugar = c?.lugar(rRow.sala_id) ?? "Tropicana";
  if (destino === "confirmada")
    return {
      ok: true,
      mensaje: `Confirmada: ${cuando}.`,
      ...avisos(
        c,
        `Hola! Confirmamos tu clase particular (${c?.planNombre}) con ${c?.profesor.nombre}: ${cuando}, en ${lugar}. ${c ? saldoTexto(c) : ""} ¡Te esperamos!`,
        `Hola! Se te confirmó una clase particular (${c?.planNombre}) con ${c?.alumnoNombre}: ${cuando}, en ${lugar}.`
      ),
    };
  return {
    ok: true,
    mensaje: `Suspendida (${etiquetaMotivoSuspension}). La hora vuelve al paquete.`,
    ...avisos(
      c,
      `Hola! Tu clase particular (${c?.planNombre}) del ${cuando} quedó suspendida (${etiquetaMotivoSuspension}). Esa hora vuelve a tu paquete: ${c ? saldoTexto(c) : ""} Coordinamos una nueva fecha.`,
      `Hola! La clase particular (${c?.planNombre}) con ${c?.alumnoNombre} del ${cuando}, en ${lugar}, quedó suspendida (${etiquetaMotivoSuspension}).`
    ),
  };
}

// ── Suspender/revertir desde un cierre o un bloqueo de sala (C3, hito H4) ──
//
// `cambiarEstadoReserva` (arriba) es el camino de una decisión puntual sobre
// UNA reserva, con un motivo elegido a mano. Acá el disparador es otro: un
// cierre de sala (`administracion/sala/acciones.ts`) o un bloqueo
// (`sala/acciones.ts`) que pisan una o más reservas ya confirmadas. Las dos
// pantallas llaman a esto en vez de escribir `reservas_sala` por su cuenta,
// para que el aviso y el rastro (`suspendida_por_excepcion_id` /
// `suspendida_por_bloqueo_id`, migración 0055) salgan siempre iguales.

/**
 * Suspende una reserva ya `confirmada`/`reprogramada` por una causa operativa
 * (no una decisión sobre ESA reserva puntual). Sin chequeo de permiso: lo
 * valida quien llama, con el suyo propio (`sala.editar`) — mismo patrón que
 * `ejecutarSuspension`/`suspenderClase` en asistencia.
 */
export async function suspenderReservaOperativa(
  reservaId: number,
  campos: { motivoClave: "cierre_sala" | "bloqueo_sala"; motivoTexto: string; excepcionId?: number },
  registradoPorId: string | null
): Promise<{ ok: true; avisoAlumno?: AvisoPersona; avisoProfesor?: AvisoPersona } | { ok: false; error: string }> {
  const a = admin();
  const sb = await createClient();

  const { data: rRow } = await a
    .from("reservas_sala")
    .select("id, tipo, estado, membresia_id, sala_id, fecha, hora, duracion_min")
    .eq("id", reservaId)
    .in("tipo", ["particular", "alquiler"])
    .maybeSingle();
  if (!rRow) return { ok: false, error: "Esa reserva ya no existe." };
  const actual = rRow.estado as EstadoReserva;
  if (!puedeTransicionar(actual, "suspendida"))
    return { ok: false, error: `La reserva #${reservaId} ya no se puede suspender (está ${ETIQUETA_ESTADO_RESERVA[actual]}).` };

  const { data: actualizado, error: errUp } = await a
    .from("reservas_sala")
    .update({
      estado: "suspendida",
      solicitada_hasta: null,
      cambio_motivo: campos.motivoClave,
      cambio_glosa: campos.motivoTexto,
      cambio_fuera_de_plazo: false,
      actualizado_por: registradoPorId,
      suspendida_por_excepcion_id: campos.excepcionId ?? null,
    })
    .eq("id", reservaId)
    .eq("estado", actual)
    .select("id");
  if (errUp) return { ok: false, error: `No se pudo suspender la reserva #${reservaId}: ${errUp.message}` };
  if (!actualizado || actualizado.length === 0)
    return { ok: false, error: `La reserva #${reservaId} cambió de estado mientras tanto.` };

  const c = await contextoAviso(a, sb, rRow.membresia_id);
  const cuando = horario(rRow.fecha, rRow.hora, rRow.duracion_min);
  const lugar = c?.lugar(rRow.sala_id) ?? "Tropicana";
  return {
    ok: true,
    ...avisos(
      c,
      `Hola! Tu clase particular (${c?.planNombre}) del ${cuando} quedó suspendida (${campos.motivoTexto}). Esa hora vuelve a tu paquete: ${c ? saldoTexto(c) : ""} Coordinamos una nueva fecha.`,
      `Hola! La clase particular (${c?.planNombre}) con ${c?.alumnoNombre} del ${cuando}, en ${lugar}, quedó suspendida (${campos.motivoTexto}).`
    ),
  };
}

/**
 * Revierte una reserva **suspendida** creando una reserva NUEVA, Confirmada,
 * en la misma franja (decisión de Javier, 26/09): Suspendida sigue siendo un
 * estado final (definiciones-v2 8.2) — lo que sigue nunca es reabrir ESTA
 * reserva, es una reserva distinta que la reemplaza y queda ligada a ella
 * (`revierte_reserva_id`). Se revalida todo de cero: sala, profesor, saldo y
 * vigencia pueden haber cambiado desde que se suspendió.
 */
export async function revertirSuspension(reservaId: number): Promise<ResultadoAccion> {
  // Sin alcance propio/todo acá a propósito: quien llama ya validó su propio
  // permiso operativo (disponibilidad_sala.editar desde /sala, sala.editar
  // desde el horario base) — es un revertido disparado por un cierre o un
  // bloqueo, no una decisión puntual de un profesor sobre SU reserva.
  const puede =
    (await tienePermiso("particulares", "editar")) ||
    (await tienePermiso("sala", "editar")) ||
    (await tienePermiso("disponibilidad_sala", "editar"));
  if (!puede) return { error: "No tenés permiso para revertir esta suspensión." };

  const perfil = await obtenerPerfilActual();
  const a = admin();
  const sb = await createClient();

  const { data: rRow, error: errR } = await a
    .from("reservas_sala")
    .select("id, tipo, estado, membresia_id, sala_id, profesor_id, fecha, hora, duracion_min")
    .eq("id", reservaId)
    .maybeSingle();
  if (errR) return { error: `No se pudo leer la reserva: ${errR.message}` };
  if (!rRow) return { error: "Esa reserva ya no existe." };
  if (rRow.tipo === "bloqueo") return { error: "Un bloqueo no se revierte: se cancela y se crea de nuevo." };
  if (rRow.estado !== "suspendida") return { error: "Esta reserva no está suspendida: no hay nada que revertir." };

  const { data: mRow } = await a
    .from("membresias")
    .select("estado, fecha_inicio, fecha_fin, horas_contratadas")
    .eq("id", rRow.membresia_id)
    .maybeSingle();
  if (!mRow) return { error: "La membresía de esta reserva ya no existe." };
  if (mRow.estado !== "activa") return { error: "La membresía ya no está activa: no se puede restablecer esta clase." };
  if (rRow.fecha < mRow.fecha_inicio || rRow.fecha > mRow.fecha_fin)
    return { error: `La fecha ya no entra en la vigencia de la membresía (${mRow.fecha_inicio} a ${mRow.fecha_fin}).` };

  const { data: salaRow } = await a.from("salas").select("es_externa").eq("id", rRow.sala_id).maybeSingle();
  const esExterna = salaRow?.es_externa ?? false;

  const ahora = new Date();
  const ctx = await cargarContextoValidacion(a, esExterna ? null : rRow.sala_id, rRow.profesor_id, rRow.fecha, rRow.id);
  const validacion = validarFranja(ctx, rRow.fecha, rRow.hora, rRow.duracion_min, esExterna, undefined, ahora);
  if (!validacion.ok)
    return { error: `No se puede restablecer esta clase: ${validacion.motivo}` };

  // La reserva suspendida no consume (ESTADOS_QUE_CONSUMEN), así que el saldo
  // ya la cuenta como disponible — salvo que otra reserva haya usado esas
  // horas mientras tanto.
  const { data: resRows, error: errSaldo } = await a
    .from("reservas_sala")
    .select("estado, duracion_min, solicitada_hasta")
    .eq("membresia_id", rRow.membresia_id);
  if (errSaldo) return { error: `No se pudo leer el saldo de la membresía: ${errSaldo.message}` };
  const saldo = saldoMembresia({ horasContratadas: Number(mRow.horas_contratadas) || 0, reservas: resRows ?? [], ahora });
  if (rRow.duracion_min > saldo.disponibleMin)
    return {
      error: `No quedan las ${h(rRow.duracion_min)} h que esta clase necesita en el paquete (otra reserva ya las usó). Quedan ${h(saldo.disponibleMin)} h disponibles.`,
    };

  const { data: nueva, error: errIns } = await a
    .from("reservas_sala")
    .insert({
      sala_id: rRow.sala_id,
      tipo: "particular",
      membresia_id: rRow.membresia_id,
      profesor_id: rRow.profesor_id,
      fecha: rRow.fecha,
      hora: rRow.hora,
      duracion_min: rRow.duracion_min,
      estado: "confirmada",
      revierte_reserva_id: rRow.id,
      creado_por: perfil?.id ?? null,
    })
    .select("id")
    .single();
  if (errIns) {
    if ((errIns as { code?: string }).code === "23P01")
      return { error: "Esa franja se acaba de ocupar con otra reserva. Recargá e intentá de nuevo." };
    return { error: `No se pudo restablecer la reserva: ${errIns.message}` };
  }

  revalidatePath(`/particulares/${rRow.membresia_id}`);
  revalidatePath("/particulares");
  revalidatePath("/sala");
  revalidatePath("/administracion/sala");

  const c = await contextoAviso(a, sb, rRow.membresia_id);
  const cuando = horario(rRow.fecha, rRow.hora, rRow.duracion_min);
  const lugar = c?.lugar(rRow.sala_id) ?? "Tropicana";
  return {
    ok: true,
    mensaje: `Restablecida: ${cuando} (reserva #${nueva.id}).`,
    ...avisos(
      c,
      `Hola! Se restableció tu clase particular (${c?.planNombre}) con ${c?.profesor.nombre}: ${cuando}, en ${lugar}. ${c ? saldoTexto(c) : ""} ¡Te esperamos!`,
      `Hola! Se restableció una clase particular (${c?.planNombre}) con ${c?.alumnoNombre}: ${cuando}, en ${lugar}.`
    ),
  };
}

// ── Reprogramar ────────────────────────────────────────────────────────

export type EntradaReprogramar = {
  reservaId: number;
  fecha: string;
  hora: string;
  duracionMin: number;
  salaId: number;
};

export async function reprogramarReserva(e: EntradaReprogramar): Promise<ResultadoAccion> {
  if (!(await tienePermiso("particulares", "editar"))) return { error: "No tenés permiso para reprogramar una reserva." };
  if (!ISO_FECHA.test(e.fecha)) return { error: "La fecha no es válida." };
  if (aMinutos(e.hora) == null) return { error: "La hora no es válida." };

  const perfil = await obtenerPerfilActual();
  const a = admin();
  const sb = await createClient();

  const { data: rRow, error: errR } = await a
    .from("reservas_sala")
    .select("id, tipo, estado, membresia_id, sala_id, profesor_id, fecha, hora, duracion_min")
    .eq("id", e.reservaId)
    .maybeSingle();
  if (errR) return { error: `No se pudo leer la reserva: ${errR.message}` };
  if (!rRow) return { error: "Esa reserva no existe." };
  const { propio, profesorId } = await alcancePropioDe("particulares");
  if (propio && rRow.profesor_id !== profesorId) return { error: "Esta reserva es de otro profesor: no podés reprogramarla." };
  if (rRow.tipo === "bloqueo") return { error: "Un bloqueo no se reprograma: se cancela y se crea uno nuevo." };
  const actual = rRow.estado as EstadoReserva;
  if (!puedeTransicionar(actual, "reprogramada"))
    return { error: `Una reserva ${ETIQUETA_ESTADO_RESERVA[actual]} no se puede reprogramar.` };

  const { data: mRow } = await a
    .from("membresias")
    .select("fecha_inicio, fecha_fin, alumno_id, horas_contratadas")
    .eq("id", rRow.membresia_id)
    .maybeSingle();
  if (!mRow) return { error: "La membresía de esta reserva ya no existe." };
  if (e.fecha < mRow.fecha_inicio || e.fecha > mRow.fecha_fin)
    return { error: `La nueva fecha queda fuera de la vigencia de la membresía (${mRow.fecha_inicio} a ${mRow.fecha_fin}).` };

  // Alargar una reserva consume más horas del paquete: la diferencia tiene
  // que entrar en lo que queda (misma regla que al crear una nueva).
  if (e.duracionMin > rRow.duracion_min) {
    const { data: resRows, error: errSaldo } = await a
      .from("reservas_sala")
      .select("estado, duracion_min, solicitada_hasta")
      .eq("membresia_id", rRow.membresia_id);
    if (errSaldo) return { error: `No se pudo leer el saldo de la membresía: ${errSaldo.message}` };
    const saldo = saldoMembresia({ horasContratadas: Number(mRow.horas_contratadas) || 0, reservas: resRows ?? [], ahora: new Date() });
    const extra = e.duracionMin - rRow.duracion_min;
    if (extra > saldo.disponibleMin)
      return {
        error: `Pasar de ${h(rRow.duracion_min)} h a ${h(e.duracionMin)} h suma ${h(extra)} h, y al paquete le quedan ${h(saldo.disponibleMin)} h disponibles.`,
      };
  }

  const { data: salaRow } = await a.from("salas").select("id, activa, es_externa").eq("id", e.salaId).maybeSingle();
  if (!salaRow || !salaRow.activa) return { error: "La sala elegida no existe o no está activa." };
  const esExterna = salaRow.es_externa ?? false;
  if (!esExterna) {
    const { data: yaUsada } = await a
      .from("membresia_salas")
      .select("sala_id")
      .eq("membresia_id", rRow.membresia_id)
      .eq("sala_id", e.salaId)
      .maybeSingle();
    if (!yaUsada) {
      const { error: errIns } = await a
        .from("membresia_salas")
        .insert({ membresia_id: rRow.membresia_id, sala_id: e.salaId, nombre_descriptivo: null });
      if (errIns) return { error: `No se pudo asociar la sala: ${errIns.message}` };
    }
  }

  const ahora = new Date();
  const ctx = await cargarContextoValidacion(a, esExterna ? null : e.salaId, rRow.profesor_id, e.fecha, rRow.id);
  const validacion = validarFranja(ctx, e.fecha, e.hora, e.duracionMin, esExterna, undefined, ahora);
  if (!validacion.ok) return { error: validacion.motivo };

  const { data: actualizado, error: errUp } = await a
    .from("reservas_sala")
    .update({
      sala_id: e.salaId,
      fecha: e.fecha,
      hora: e.hora,
      duracion_min: e.duracionMin,
      estado: "reprogramada",
      solicitada_hasta: null,
      cambio_motivo: "Reprogramada",
      cambio_glosa: null,
      cambio_fuera_de_plazo: false,
      actualizado_por: perfil?.id ?? null,
    })
    .eq("id", e.reservaId)
    .eq("estado", actual)
    .select("id");
  if (errUp) {
    if ((errUp as { code?: string }).code === "23P01")
      return { error: "Esa franja se acaba de ocupar con otra reserva. Recargá e intentá de nuevo." };
    return { error: `No se pudo reprogramar: ${errUp.message}` };
  }
  if (!actualizado || actualizado.length === 0)
    return { error: "El estado de esta reserva cambió mientras tanto. Recargá e intentá de nuevo." };

  revalidatePath(`/particulares/${rRow.membresia_id}`);
  revalidatePath("/particulares");
  revalidatePath("/sala");

  const c = await contextoAviso(a, sb, rRow.membresia_id);
  const antes = horario(rRow.fecha, rRow.hora, rRow.duracion_min);
  const ahoraEs = horario(e.fecha, e.hora, e.duracionMin);
  const lugar = c?.lugar(e.salaId) ?? "Tropicana";
  return {
    ok: true,
    mensaje: `Reprogramada: ${antes} → ${ahoraEs}, en ${lugar}.`,
    ...avisos(
      c,
      `Hola! Reprogramamos tu clase particular (${c?.planNombre}) con ${c?.profesor.nombre}: pasa del ${antes} al ${ahoraEs}, en ${lugar}. ${c ? saldoTexto(c) : ""} ¡Te esperamos!`,
      `Hola! Se reprogramó la clase particular (${c?.planNombre}) con ${c?.alumnoNombre}: pasa del ${antes} al ${ahoraEs}, en ${lugar}.`
    ),
  };
}

// ── Cancelar a pedido del alumno ─────────────────────────────────────────

export async function cancelarAPedido(reservaId: number): Promise<ResultadoAccion> {
  if (!(await tienePermiso("particulares", "editar"))) return { error: "No tenés permiso para cancelar una reserva." };

  const perfil = await obtenerPerfilActual();
  const a = admin();
  const sb = await createClient();

  const { data: rRow, error: errR } = await a
    .from("reservas_sala")
    .select("id, tipo, estado, membresia_id, sala_id, profesor_id, fecha, hora, duracion_min")
    .eq("id", reservaId)
    .maybeSingle();
  if (errR) return { error: `No se pudo leer la reserva: ${errR.message}` };
  if (!rRow) return { error: "Esa reserva no existe." };
  const { propio, profesorId } = await alcancePropioDe("particulares");
  if (propio && rRow.profesor_id !== profesorId) return { error: "Esta reserva es de otro profesor: no podés cancelarla." };
  if (rRow.tipo === "bloqueo") return { error: "Un bloqueo se cancela desde Sala." };
  const actual = rRow.estado as EstadoReserva;

  let destino: "reagendar" | "ausente";
  let fueraDePlazo = false;
  let motivo: string;
  const plazoHoras = Math.max(1, Number(await obtenerParametro("reserva_cancelacion_plazo_horas")) || 8);
  if (actual === "solicitada") {
    // Nada se consumió todavía: cancelar una Solicitada siempre libera,
    // sin plazo que evaluar (regla de negocio 23, 8.3 habla de una reserva
    // ya confirmada).
    destino = "reagendar";
    motivo = "Canceló la solicitud (alumno)";
  } else if (actual === "confirmada" || actual === "reprogramada") {
    const r = evaluarCancelacion(new Date(), new Date(`${rRow.fecha}T${rRow.hora}`), plazoHoras);
    destino = r.destino;
    fueraDePlazo = r.fueraDePlazo;
    motivo = fueraDePlazo ? "Canceló fuera de plazo (alumno)" : "Canceló dentro de plazo (alumno)";
  } else {
    return { error: `Una reserva ${ETIQUETA_ESTADO_RESERVA[actual]} no se puede cancelar.` };
  }

  const { data: actualizado, error: errUp } = await a
    .from("reservas_sala")
    .update({
      estado: destino,
      solicitada_hasta: null,
      cambio_motivo: motivo,
      cambio_glosa: null,
      cambio_fuera_de_plazo: fueraDePlazo,
      actualizado_por: perfil?.id ?? null,
    })
    .eq("id", reservaId)
    .eq("estado", actual)
    .select("id");
  if (errUp) return { error: `No se pudo cancelar: ${errUp.message}` };
  if (!actualizado || actualizado.length === 0)
    return { error: "El estado de esta reserva cambió mientras tanto. Recargá e intentá de nuevo." };

  revalidatePath(`/particulares/${rRow.membresia_id}`);
  revalidatePath("/particulares");
  revalidatePath("/sala");

  const c = await contextoAviso(a, sb, rRow.membresia_id);
  const cuando = horario(rRow.fecha, rRow.hora, rRow.duracion_min);
  const lugar = c?.lugar(rRow.sala_id) ?? "Tropicana";
  if (fueraDePlazo)
    return {
      ok: true,
      mensaje: `Cancelada fuera de plazo (menos de ${plazoHoras} h antes): queda Ausente y la hora se descuenta del paquete.`,
      ...avisos(
        c,
        `Hola! Registramos la cancelación de tu clase particular (${c?.planNombre}) del ${cuando}. Como fue con menos de ${plazoHoras} h de anticipación, esa hora se descuenta del paquete. ${c ? saldoTexto(c) : ""}`,
        `Hola! ${c?.alumnoNombre} canceló fuera de plazo la clase particular (${c?.planNombre}) del ${cuando}, en ${lugar}. Ya no hace falta que vayas.`
      ),
    };
  return {
    ok: true,
    mensaje: "Cancelada: la hora vuelve al paquete.",
    ...avisos(
      c,
      `Hola! Cancelamos tu clase particular (${c?.planNombre}) del ${cuando}, como pediste. Esa hora vuelve a tu paquete: ${c ? saldoTexto(c) : ""} Coordinamos una nueva fecha.`,
      `Hola! Se canceló a pedido del alumno la clase particular (${c?.planNombre}) con ${c?.alumnoNombre} del ${cuando}, en ${lugar}.`
    ),
  };
}
