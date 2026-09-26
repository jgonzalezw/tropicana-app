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
import { tienePermiso, obtenerParametro, obtenerPerfilActual } from "@/lib/sesion";
import { apellidoDe } from "@/lib/contactos";
import { formatearHoras, aMinutos } from "@/lib/horarios";
import {
  validarReservaSala,
  ocupacionDeProfesor,
  puedeTransicionar,
  ocupaAhora,
  evaluarCancelacion,
  saldoMembresia,
  FILTRO_ESTADOS_QUE_LIBERAN,
  ETIQUETA_ESTADO_RESERVA,
  TRANSICIONES,
  type EstadoReserva,
} from "@/lib/reservas";
import {
  ocupacionDelDia,
  type CursoOcupa,
  type ExcepcionHorario,
  type FranjaPatron,
  type ReservaSalaOcupa,
} from "@/lib/sala";
import { COLUMNAS_ASIGNACION } from "@/lib/asignaciones";
import { COLS_VIGENCIA } from "@/lib/vigencia";

const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

type AvisoPersona = { nombre: string; whatsapp: string | null; mensaje: string };
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

/** Lista de membresías de particulares activas, para `/particulares`. */
export async function listarMembresiasParticulares(): Promise<
  { items: { id: number; alumnoNombre: string; planNombre: string; profesorNombre: string; fechaFin: string; disponibleMin: number; solicitadasPorVencer: number }[]; error?: string }
> {
  if (!(await tienePermiso("particulares", "ver"))) return { items: [], error: "Sin permiso para ver clases particulares." };

  const sb = await createClient();
  const { data, error } = await sb
    .from("membresias")
    .select(
      "id, fecha_fin, horas_contratadas, estado, " +
        "alumno:alumnos(contacto:contactos(nombre, apellido)), " +
        "plan:planes(nombre), " +
        "profesor:profesores(contacto:contactos(nombre, apellido)), " +
        "reservas:reservas_sala(estado, duracion_min, solicitada_hasta)"
    )
    .is("curso_id", null)
    .eq("estado", "activa");
  if (error) return { items: [], error: `No se pudieron leer las membresías de particulares: ${error.message}` };

  type Fila = {
    id: number;
    fecha_fin: string;
    horas_contratadas: number;
    alumno: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
    plan: { nombre: string } | null;
    profesor: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
    reservas: { estado: string; duracion_min: number; solicitada_hasta: string | null }[];
  };
  const ahora = new Date();
  // Se ordena por apellido ANTES de armar el objeto final (regla de negocio
  // 15): así no hace falta cargar el campo al resultado solo para tirarlo.
  const filas = [...((data as unknown as Fila[]) ?? [])].sort((a, b) =>
    apellidoDe(a.alumno?.contacto ?? undefined).localeCompare(apellidoDe(b.alumno?.contacto ?? undefined), "es")
  );
  const items = filas.map((m) => {
    const saldo = saldoMembresia({ horasContratadas: Number(m.horas_contratadas) || 0, reservas: m.reservas, ahora });
    const solicitadasPorVencer = m.reservas.filter(
      (r) => r.estado === "solicitada" && r.solicitada_hasta && new Date(r.solicitada_hasta) > ahora
    ).length;
    return {
      id: m.id,
      alumnoNombre: `${m.alumno?.contacto?.nombre ?? ""} ${m.alumno?.contacto?.apellido ?? ""}`.trim(),
      planNombre: m.plan?.nombre ?? "—",
      profesorNombre: `${m.profesor?.contacto?.nombre ?? ""} ${m.profesor?.contacto?.apellido ?? ""}`.trim(),
      fechaFin: m.fecha_fin,
      disponibleMin: saldo.disponibleMin,
      solicitadasPorVencer,
    };
  });

  return { items };
}

/** El detalle de una membresía y sus reservas, para `/particulares/[id]`. */
export async function obtenerMembresiaParticular(membresiaId: number): Promise<MembresiaParticularDetalle | { error: string }> {
  if (!(await tienePermiso("particulares", "ver"))) return { error: "Sin permiso para ver clases particulares." };

  const sb = await createClient();
  const { data: m, error } = await sb
    .from("membresias")
    .select(
      "id, fecha_inicio, fecha_fin, estado, horas_contratadas, alumno_id, profesor_id, " +
        "alumno:alumnos(contacto:contactos(nombre, apellido)), " +
        "plan:planes(nombre), " +
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
    plan: { nombre: string } | null;
    profesor: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
  };
  const mm = m as unknown as M;

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

  type FilaReserva = {
    id: number;
    fecha: string;
    hora: string;
    duracion_min: number;
    estado: string;
    solicitada_hasta: string | null;
    sala_id: number;
    sala: { nombre: string } | null;
  };
  const reservasRaw = (reservasR.data as unknown as FilaReserva[]) ?? [];
  type FilaHistorial = {
    reserva_id: number;
    estado_nuevo: string;
    fecha_nueva: string;
    hora_nueva: string;
    motivo: string | null;
    glosa: string | null;
    fuera_de_plazo: boolean;
    creado_en: string;
  };
  const historialRaw = (historialR.data as unknown as FilaHistorial[]) ?? [];

  const ahora = new Date();
  const reservas: ReservaConHistorial[] = reservasRaw.map((r) => {
    const estado = r.estado as EstadoReserva;
    const salaNombre = salas.find((s) => s.sala_id === r.sala_id)?.nombre_descriptivo || r.sala?.nombre || "—";
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
      historial: historialRaw
        .filter((h) => h.reserva_id === r.id)
        .map((h) => ({
          estado_nuevo: h.estado_nuevo,
          fecha_nueva: h.fecha_nueva,
          hora_nueva: h.hora_nueva,
          motivo: h.motivo,
          glosa: h.glosa,
          fuera_de_plazo: h.fuera_de_plazo,
          creado_en: h.creado_en,
        })),
    };
  });

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
    profesorId: mm.profesor_id,
    profesorNombre: `${mm.profesor?.contacto?.nombre ?? ""} ${mm.profesor?.contacto?.apellido ?? ""}`.trim(),
    fechaInicio: mm.fecha_inicio,
    fechaFin: mm.fecha_fin,
    estado: mm.estado,
    saldo,
    salasDeLaMembresia: salas.map((s) => ({
      salaId: s.sala_id,
      nombre: s.nombre_descriptivo || s.sala?.nombre || "—",
      esExterna: s.sala?.es_externa ?? false,
    })),
    reservas,
  };
}


// ── Validar sala + profesor para una fecha/hora dada ─────────────────────

type ContextoValidacion = {
  /** `null` cuando la sala es externa — no se valida su horario ni choque. */
  salaId: number | null;
  incrementoMin: number;
  minimoMin: number;
  patronSala: FranjaPatron[];
  excepcionesSala: ExcepcionHorario[];
  cursosSala: CursoOcupa[];
  reservasSala: (ReservaSalaOcupa & { estado: string; solicitada_hasta: string | null })[];
  suspendidasSala: Set<number>;
  cursosProfesor: CursoOcupa[];
  reservasProfesor: (ReservaSalaOcupa & { estado: string; solicitada_hasta: string | null })[];
  suspendidasProfesor: Set<number>;
};

/** Trae todo lo que hace falta para validar una franja: horario/ocupación de
 *  la sala (si es propia) y del profesor, ya con los estados que liberan
 *  (`ESTADOS_QUE_LIBERAN`) afuera de la consulta. `excluirReservaId` se usa
 *  al reprogramar: la reserva no puede chocar consigo misma. */
async function cargarContextoValidacion(
  a: ReturnType<typeof admin>,
  salaId: number | null,
  profesorId: number,
  fecha: string,
  excluirReservaId?: number
): Promise<ContextoValidacion> {
  const [incMinP, minMinP] = await Promise.all([
    obtenerParametro("tiempos_incremento_min"),
    obtenerParametro("duracion_minima_curso_min"),
  ]);
  const incrementoMin = Math.max(1, Number(incMinP) || 30);
  const minimoMin = Math.max(1, Number(minMinP) || 30);

  const filtroLibera = FILTRO_ESTADOS_QUE_LIBERAN;

  let patronSala: FranjaPatron[] = [];
  let excepcionesSala: ExcepcionHorario[] = [];
  let cursosSala: CursoOcupa[] = [];
  let reservasSala: (ReservaSalaOcupa & { estado: string; solicitada_hasta: string | null })[] = [];
  let suspendidasSala = new Set<number>();

  if (salaId != null) {
    let resSalaQ = a
      .from("reservas_sala")
      .select("id, tipo, motivo, glosa, hora, duracion_min, estado, solicitada_hasta")
      .eq("sala_id", salaId)
      .eq("fecha", fecha)
      .not("estado", "in", filtroLibera);
    if (excluirReservaId) resSalaQ = resSalaQ.neq("id", excluirReservaId);

    const [patronR, excR, cursosR, resR] = await Promise.all([
      a.from("sala_horario_patron").select("dia_semana, desde, hasta").eq("sala_id", salaId),
      a.from("sala_horario_excepciones").select("fecha, hasta_fecha, cerrado, desde, hasta, motivo, glosa").eq("sala_id", salaId),
      a.from("cursos").select(`id, nombre, dias_semana, hora, duracion_min, sala_id, ${COLS_VIGENCIA}`).eq("sala_id", salaId).eq("activo", true),
      resSalaQ,
    ]);
    patronSala = (patronR.data as FranjaPatron[]) ?? [];
    excepcionesSala = (excR.data as ExcepcionHorario[]) ?? [];
    cursosSala = (cursosR.data as unknown as CursoOcupa[]) ?? [];
    reservasSala = (resR.data as unknown as (ReservaSalaOcupa & { estado: string; solicitada_hasta: string | null })[]) ?? [];

    const cursoIds = cursosSala.map((c) => c.id);
    if (cursoIds.length) {
      const { data: susRows } = await a
        .from("sesiones")
        .select("curso_id")
        .in("curso_id", cursoIds)
        .eq("estado", "suspendida")
        .eq("fecha", fecha);
      suspendidasSala = new Set(((susRows as { curso_id: number }[]) ?? []).map((s) => s.curso_id));
    }
  }

  const { data: asigRows } = await a.from("asignaciones").select(COLUMNAS_ASIGNACION).eq("profesor_id", profesorId).is("hasta", null);
  const cursoIdsProfesor = ((asigRows as { curso_id: number }[]) ?? []).map((r) => r.curso_id);
  let resProfQ = a
    .from("reservas_sala")
    .select("id, tipo, motivo, glosa, hora, duracion_min, estado, solicitada_hasta")
    .eq("profesor_id", profesorId)
    .eq("fecha", fecha)
    .not("estado", "in", filtroLibera);
  if (excluirReservaId) resProfQ = resProfQ.neq("id", excluirReservaId);

  const [cursosProfR, reservasProfR] = await Promise.all([
    cursoIdsProfesor.length
      ? a.from("cursos").select(`id, nombre, dias_semana, hora, duracion_min, sala_id, ${COLS_VIGENCIA}`).in("id", cursoIdsProfesor)
      : Promise.resolve({ data: [] as unknown[] }),
    resProfQ,
  ]);
  const cursosProfesor = (cursosProfR.data as unknown as CursoOcupa[]) ?? [];
  const reservasProfesor = (reservasProfR.data as unknown as (ReservaSalaOcupa & { estado: string; solicitada_hasta: string | null })[]) ?? [];

  let suspendidasProfesor = new Set<number>();
  const cursoIdsSusProf = cursosProfesor.map((c) => c.id);
  if (cursoIdsSusProf.length) {
    const { data: susRows } = await a
      .from("sesiones")
      .select("curso_id")
      .in("curso_id", cursoIdsSusProf)
      .eq("estado", "suspendida")
      .eq("fecha", fecha);
    suspendidasProfesor = new Set(((susRows as { curso_id: number }[]) ?? []).map((s) => s.curso_id));
  }

  return {
    salaId,
    incrementoMin,
    minimoMin,
    patronSala,
    excepcionesSala,
    cursosSala,
    reservasSala,
    suspendidasSala,
    cursosProfesor,
    reservasProfesor,
    suspendidasProfesor,
  };
}

/** Filtra las reservas ya traídas (sin los estados que liberan) a las que de
 *  verdad ocupan AHORA — descarta una Solicitada vencida (regla de negocio 4:
 *  se calcula al leer, no se guarda paso a paso). */
function ocupandoAhora<T extends { estado: string; solicitada_hasta: string | null }>(
  reservas: T[],
  ahora: Date
): T[] {
  return reservas.filter((r) => ocupaAhora({ tipo: "particular", estado: r.estado, solicitadaHasta: r.solicitada_hasta }, ahora));
}

function validarFranja(
  ctx: ContextoValidacion,
  fecha: string,
  hora: string,
  duracionMin: number,
  esExterna: boolean,
  personas: number | undefined,
  ahora: Date
) {
  const ocupadosSala =
    esExterna || ctx.salaId == null
      ? []
      : ocupacionDelDia(ctx.cursosSala, ocupandoAhora(ctx.reservasSala, ahora), fecha, ctx.suspendidasSala, ctx.salaId);
  const ocupadosProfesor = ocupacionDeProfesor(ctx.cursosProfesor, fecha, ctx.suspendidasProfesor, ocupandoAhora(ctx.reservasProfesor, ahora));
  return validarReservaSala({
    fecha,
    hora,
    duracionMin,
    incrementoMin: ctx.incrementoMin,
    minimoMin: ctx.minimoMin,
    personas,
    sala: { esExterna, capacidad: null },
    patron: ctx.patronSala,
    excepciones: ctx.excepcionesSala,
    ocupadosSala,
    ocupadosProfesor,
  });
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

  const destinatario = await destinatarioDeAlumno(sb, mRow.alumno_id);
  const { data: profesorRow } = await a.from("profesores").select("contacto:contactos(nombre, apellido, whatsapp)").eq("id", mRow.profesor_id).maybeSingle();
  const profesorContacto = (profesorRow as unknown as { contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null })?.contacto;
  const nombreProfesor = `${profesorContacto?.nombre ?? ""} ${profesorContacto?.apellido ?? ""}`.trim();
  const cuando = fechaHoraCorta(e.fecha, e.hora);
  const verbo = e.accion === "solicitar" ? "Solicitamos" : "Confirmamos";

  return {
    ok: true,
    mensaje: e.accion === "solicitar" ? `Clase solicitada para el ${cuando}.` : `Clase confirmada para el ${cuando}.`,
    avisoAlumno: destinatario
      ? { nombre: destinatario.nombre, whatsapp: destinatario.whatsapp, mensaje: `Hola! ${verbo} tu clase particular del ${cuando} con ${nombreProfesor}.` }
      : undefined,
    avisoProfesor: nombreProfesor
      ? { nombre: nombreProfesor, whatsapp: profesorContacto?.whatsapp ?? null, mensaje: `Hola! ${verbo} tu clase particular del ${cuando}.` }
      : undefined,
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
  if (destino !== "confirmada" && destino !== "suspendida") return { ok: true };

  const { data: mRow } = await a.from("membresias").select("alumno_id").eq("id", rRow.membresia_id).maybeSingle();
  const { data: profesorRow } = await a.from("profesores").select("contacto:contactos(nombre, apellido, whatsapp)").eq("id", rRow.profesor_id).maybeSingle();
  const profesorContacto = (profesorRow as unknown as { contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null })?.contacto;
  const nombreProfesor = `${profesorContacto?.nombre ?? ""} ${profesorContacto?.apellido ?? ""}`.trim();
  const cuando = fechaHoraCorta(rRow.fecha, rRow.hora);
  const destinatario = mRow ? await destinatarioDeAlumno(sb, mRow.alumno_id) : null;
  const mensajeAlumno =
    destino === "confirmada"
      ? `Hola! Confirmamos tu clase particular del ${cuando}.`
      : `Hola! Tu clase particular del ${cuando} fue suspendida${etiquetaMotivoSuspension ? ` (${etiquetaMotivoSuspension})` : ""}. Se te devuelve al saldo.`;
  const mensajeProfesor =
    destino === "confirmada"
      ? `Hola! Se confirmó la clase del ${cuando}.`
      : `Hola! Se suspendió la clase del ${cuando}${etiquetaMotivoSuspension ? ` (${etiquetaMotivoSuspension})` : ""}.`;

  return {
    ok: true,
    avisoAlumno: destinatario ? { nombre: destinatario.nombre, whatsapp: destinatario.whatsapp, mensaje: mensajeAlumno } : undefined,
    avisoProfesor: nombreProfesor ? { nombre: nombreProfesor, whatsapp: profesorContacto?.whatsapp ?? null, mensaje: mensajeProfesor } : undefined,
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
    .select("id, tipo, estado, membresia_id, profesor_id, fecha, hora, duracion_min")
    .eq("id", e.reservaId)
    .maybeSingle();
  if (errR) return { error: `No se pudo leer la reserva: ${errR.message}` };
  if (!rRow) return { error: "Esa reserva no existe." };
  if (rRow.tipo === "bloqueo") return { error: "Un bloqueo no se reprograma: se cancela y se crea uno nuevo." };
  const actual = rRow.estado as EstadoReserva;
  if (!puedeTransicionar(actual, "reprogramada"))
    return { error: `Una reserva ${ETIQUETA_ESTADO_RESERVA[actual]} no se puede reprogramar.` };

  const { data: mRow } = await a.from("membresias").select("fecha_inicio, fecha_fin, alumno_id").eq("id", rRow.membresia_id).maybeSingle();
  if (!mRow) return { error: "La membresía de esta reserva ya no existe." };
  if (e.fecha < mRow.fecha_inicio || e.fecha > mRow.fecha_fin)
    return { error: `La nueva fecha queda fuera de la vigencia de la membresía (${mRow.fecha_inicio} a ${mRow.fecha_fin}).` };

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

  const cuando = fechaHoraCorta(e.fecha, e.hora);
  const destinatario = await destinatarioDeAlumno(sb, mRow.alumno_id);
  const { data: profesorRow } = await a.from("profesores").select("contacto:contactos(nombre, apellido, whatsapp)").eq("id", rRow.profesor_id).maybeSingle();
  const profesorContacto = (profesorRow as unknown as { contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null })?.contacto;
  const nombreProfesor = `${profesorContacto?.nombre ?? ""} ${profesorContacto?.apellido ?? ""}`.trim();

  return {
    ok: true,
    mensaje: `Reprogramada para el ${cuando}.`,
    avisoAlumno: destinatario
      ? { nombre: destinatario.nombre, whatsapp: destinatario.whatsapp, mensaje: `Hola! Reprogramamos tu clase particular: ahora es el ${cuando}.` }
      : undefined,
    avisoProfesor: nombreProfesor
      ? { nombre: nombreProfesor, whatsapp: profesorContacto?.whatsapp ?? null, mensaje: `Hola! Se reprogramó una clase para el ${cuando}.` }
      : undefined,
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
    .select("id, tipo, estado, membresia_id, profesor_id, fecha, hora")
    .eq("id", reservaId)
    .maybeSingle();
  if (errR) return { error: `No se pudo leer la reserva: ${errR.message}` };
  if (!rRow) return { error: "Esa reserva no existe." };
  if (rRow.tipo === "bloqueo") return { error: "Un bloqueo se cancela desde Sala." };
  const actual = rRow.estado as EstadoReserva;

  let destino: "reagendar" | "ausente";
  let fueraDePlazo = false;
  let motivo: string;
  if (actual === "solicitada") {
    // Nada se consumió todavía: cancelar una Solicitada siempre libera,
    // sin plazo que evaluar (regla de negocio 23, 8.3 habla de una reserva
    // ya confirmada).
    destino = "reagendar";
    motivo = "Canceló la solicitud (alumno)";
  } else if (actual === "confirmada" || actual === "reprogramada") {
    const plazoHoras = Math.max(1, Number(await obtenerParametro("reserva_cancelacion_plazo_horas")) || 8);
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

  const { data: mRow } = await a.from("membresias").select("alumno_id").eq("id", rRow.membresia_id).maybeSingle();
  const cuando = fechaHoraCorta(rRow.fecha, rRow.hora);
  const destinatario = mRow ? await destinatarioDeAlumno(sb, mRow.alumno_id) : null;
  const mensajeAlumno = fueraDePlazo
    ? `Hola! Tu clase del ${cuando} se canceló con menos anticipación de la permitida, así que se da por consumida del paquete.`
    : `Hola! Tu clase del ${cuando} quedó cancelada. Se te devuelve al saldo — coordinamos una nueva fecha.`;

  return {
    ok: true,
    mensaje: destino === "reagendar" ? "Cancelada: la sesión vuelve al saldo." : "Cancelada fuera de plazo: la sesión se da por consumida.",
    avisoAlumno: destinatario ? { nombre: destinatario.nombre, whatsapp: destinatario.whatsapp, mensaje: mensajeAlumno } : undefined,
  };
}
