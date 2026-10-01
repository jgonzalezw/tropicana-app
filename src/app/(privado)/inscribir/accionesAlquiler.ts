"use server";

/**
 * La venta de alquiler de sala (C3, hito H7, tanda 2).
 *
 * Hermana de `venderParticular`, con estas diferencias que importan:
 *  - el titular es un **contacto** (regla 21) y NO adquiere el rol alumno;
 *  - **no hay profesor**: un alquiler no le paga a nadie, y la sala solo se
 *    valida contra otras reservas y el horario (`evaluarSesiones` con
 *    `profesorId: null`);
 *  - el **precio sale de la tabla de alquiler** de Precios y paquetes
 *    (categoría × tamaño × horas del paquete) — regla 22, no hay horas libres;
 *  - la **categoría** la propone el sistema (`proponerCategoria`, regla 24) y
 *    se puede cambiar solo si el parámetro `alquiler_categoria_modo` está en
 *    `editable`, con glosa. Se guardan la propuesta, la aplicada y el motivo.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso, obtenerParametro, obtenerPerfilActual } from "@/lib/sesion";
import { nombreCompleto, compararContactosPorApellido } from "@/lib/contactos";
import { gs, isoFecha, primerDiaDelMes, sumarMeses } from "@/lib/inscripcion";
import { proponerCategoria } from "@/lib/categoriaAlquiler";
import { costoDeSala, tamanoPorPersonas, type CategoriaSala, type ClaveTamano, type TamanoSala, type TarifaSala } from "@/lib/sala";
import { faltaParaAlquiler } from "@/lib/ventaAlquiler";
import { vigenciaDiasEfectiva } from "@/lib/planesParticular";
import type { CobroInscripcion } from "@/lib/tipos";
import {
  evaluarSesiones,
  fechasAgendaFija,
  formatearAgenda,
  hoyLocal,
  parseFechaISO,
  type SesionAgendaEvaluada,
} from "./agendaSala";

const CATEGORIAS: CategoriaSala[] = ["alumno", "profesor_tropicana", "profesor_externo", "tercero"];

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

// ── Titular: buscar un contacto y saber con qué categoría entra ──────────

export type ContactoTitular = {
  id: number;
  nombre: string;
  tipo: "persona" | "organizacion";
  whatsapp: string | null;
  /** Qué rol tiene hoy en la academia: lo único que el vendedor necesita ver. */
  rol: "alumno" | "profesor" | "alumno_profesor" | "contacto";
};

/**
 * Busca contactos para ser titular de un alquiler. Lee con el cliente admin
 * porque el select de `contactos` exige el permiso del módulo contactos, y
 * quien vende alquileres no necesariamente lo tiene — lo que habilita esta
 * lectura es el permiso `alquileres`.
 */
export async function buscarContactosTitular(q: string): Promise<{ contactos: ContactoTitular[]; error?: string }> {
  if (!(await tienePermiso("alquileres", "crear"))) return { contactos: [], error: "No tenés permiso para vender alquileres." };
  const texto = q.trim().replace(/[%,()]/g, " ");
  if (texto.length < 2) return { contactos: [] };
  const a = admin();
  const patron = `%${texto}%`;
  const { data, error } = await a
    .from("contactos")
    .select("id, tipo, nombre, apellido, razon_social, whatsapp")
    .eq("activo", true)
    .is("anonimizado_en", null)
    .or(`nombre.ilike.${patron},apellido.ilike.${patron},razon_social.ilike.${patron},whatsapp.ilike.${patron}`)
    .limit(30);
  if (error) return { contactos: [], error: `No se pudo buscar: ${error.message}` };
  const filas = (data ?? []) as {
    id: number;
    tipo: "persona" | "organizacion";
    nombre: string | null;
    apellido: string | null;
    razon_social: string | null;
    whatsapp: string | null;
  }[];
  if (!filas.length) return { contactos: [] };
  const ids = filas.map((f) => f.id);
  const [{ data: als }, { data: pros }] = await Promise.all([
    a.from("alumnos").select("contacto_id").in("contacto_id", ids),
    a.from("profesores").select("contacto_id").in("contacto_id", ids),
  ]);
  const esAlumno = new Set(((als as { contacto_id: number }[]) ?? []).map((x) => x.contacto_id));
  const esProfesor = new Set(((pros as { contacto_id: number }[]) ?? []).map((x) => x.contacto_id));
  const contactos = filas
    .sort((x, y) => compararContactosPorApellido(x, y))
    .map<ContactoTitular>((f) => ({
      id: f.id,
      tipo: f.tipo,
      nombre: nombreCompleto(f),
      whatsapp: f.whatsapp,
      rol: esAlumno.has(f.id) && esProfesor.has(f.id) ? "alumno_profesor" : esAlumno.has(f.id) ? "alumno" : esProfesor.has(f.id) ? "profesor" : "contacto",
    }));
  return { contactos };
}

/** Lee los hechos del contacto y deduce la categoría (regla 24). */
async function categoriaDeContacto(a: ReturnType<typeof admin>, contactoId: number) {
  const diasGracia = Math.max(0, Number(await obtenerParametro("categoria_gracia_dias")) || 7);
  const hoy = isoFecha(hoyLocal());

  const [{ data: alRow }, { data: proRow }] = await Promise.all([
    a.from("alumnos").select("id").eq("contacto_id", contactoId).maybeSingle(),
    a.from("profesores").select("id").eq("contacto_id", contactoId).maybeSingle(),
  ]);
  const alumnoId = (alRow as { id: number } | null)?.id ?? null;
  const profesorId = (proRow as { id: number } | null)?.id ?? null;

  // Membresías como alumno: cursos regulares y particulares, sin pruebas ni
  // alquileres (los alquileres no tienen alumno_id).
  let comoAlumno: { estado: string; fecha_fin: string | null }[] = [];
  if (alumnoId != null) {
    const { data } = await a
      .from("membresias")
      .select("estado, fecha_fin")
      .eq("alumno_id", alumnoId)
      .eq("es_prueba", false);
    comoAlumno = (data as { estado: string; fecha_fin: string | null }[]) ?? [];
  }

  let asignaciones: { hasta: string | null }[] = [];
  let particularesComoProfesor: { estado: string; fecha_fin: string | null }[] = [];
  if (profesorId != null) {
    const [{ data: asig }, { data: part }] = await Promise.all([
      a.from("asignaciones").select("hasta").eq("profesor_id", profesorId),
      a.from("membresias").select("estado, fecha_fin").eq("profesor_id", profesorId).eq("es_prueba", false),
    ]);
    asignaciones = (asig as { hasta: string | null }[]) ?? [];
    particularesComoProfesor = (part as { estado: string; fecha_fin: string | null }[]) ?? [];
  }

  return proponerCategoria({
    hoy,
    diasGracia,
    comoAlumno,
    esProfesor: profesorId != null,
    asignaciones,
    particularesComoProfesor,
  });
}

export async function categoriaPropuestaDe(
  contactoId: number
): Promise<{ categoria?: CategoriaSala; motivo?: string; error?: string }> {
  if (!(await tienePermiso("alquileres", "crear"))) return { error: "No tenés permiso para vender alquileres." };
  const r = await categoriaDeContacto(admin(), contactoId);
  return { categoria: r.categoria, motivo: r.motivo };
}

// ── Cálculo: precio de la tabla + agenda evaluada ─────────────────────────

export type EntradaAlquiler = {
  contactoId: number;
  planId: number;
  horasPaqueteId: number;
  personas: number;
  categoria: CategoriaSala;
  /** Obligatoria si `categoria` no es la que propone el sistema. */
  categoriaGlosa?: string;
  sala:
    | { tipo: "propia"; salaId: number }
    | { tipo: "externa"; nombreDescriptivo: string };
  fechaInicio: string;
  agenda:
    | { modalidad: "flexible"; hora: string; duracionMin: number }
    | { modalidad: "fija"; diasSemana: number[]; hora: string; duracionMin: number };
  cobro: CobroInscripcion;
};
export type EntradaAgendaAlquiler = Omit<EntradaAlquiler, "cobro">;

type AlquilerCalculado = {
  error?: string;
  contacto?: { id: number; nombre: string; whatsapp: string | null };
  planNombre?: string;
  horas?: number;
  precio?: number;
  ruta?: string;
  tamano?: ClaveTamano;
  categoriaPropuesta?: CategoriaSala;
  categoriaMotivo?: string;
  fechaFin?: string;
  leftoverMin?: number;
  sesiones?: SesionAgendaEvaluada[];
  todasOk?: boolean;
  salaId?: number;
  esExterna?: boolean;
  nombreDescriptivo?: string | null;
  dondeTexto?: string;
};

async function calcularAlquiler(a: ReturnType<typeof admin>, e: EntradaAgendaAlquiler): Promise<AlquilerCalculado> {
  const inicio = parseFechaISO(e.fechaInicio);
  if (!inicio) return { error: "Fecha de inicio inválida." };
  if (!CATEGORIAS.includes(e.categoria)) return { error: "La categoría del cliente no es válida." };
  const personas = Math.trunc(e.personas);
  if (!(personas >= 1)) return { error: "Cargá cuántas personas van." };

  const { data: cRow } = await a
    .from("contactos")
    .select("id, tipo, nombre, apellido, razon_social, whatsapp, activo")
    .eq("id", e.contactoId)
    .maybeSingle();
  const c = cRow as {
    id: number;
    tipo: "persona" | "organizacion";
    nombre: string | null;
    apellido: string | null;
    razon_social: string | null;
    whatsapp: string | null;
    activo: boolean;
  } | null;
  if (!c || !c.activo) return { error: "El titular no existe o está inactivo." };

  const { data: planRow } = await a
    .from("planes")
    .select("id, nombre, tipo_servicio, activo, vigencia_dias, reserva_modalidad, salas_modo, permite_sala_externa")
    .eq("id", e.planId)
    .maybeSingle();
  if (!planRow) return { error: "El plan no existe." };
  if (planRow.tipo_servicio !== "alquiler") return { error: "Ese plan no es de alquiler de sala." };
  if (!planRow.activo) return { error: "El plan está desactivado." };
  if (planRow.reserva_modalidad !== e.agenda.modalidad)
    return { error: `Este plan es de agenda ${planRow.reserva_modalidad === "fija" ? "fija" : "flexible"}.` };

  // Categoría: la propone el sistema; cambiarla depende del parámetro (regla 24).
  const propuesta = await categoriaDeContacto(a, e.contactoId);
  if (e.categoria !== propuesta.categoria) {
    const modo = (await obtenerParametro("alquiler_categoria_modo")) ?? "automatica";
    if (modo !== "editable")
      return { error: "La categoría la fija el sistema y la política vigente no permite cambiarla." };
    if (!e.categoriaGlosa?.trim()) return { error: "Cambiar la categoría necesita una glosa (quién lo autoriza, por qué)." };
  }

  // Paquete de horas y precio de la tabla.
  const [{ data: paqRow }, { data: tamanosRows }, { data: tarifasRows }] = await Promise.all([
    a.from("sala_horas_paquete").select("id, horas").eq("id", e.horasPaqueteId).maybeSingle(),
    a.from("sala_tamanos").select("clave, etiqueta, max_personas, orden"),
    a.from("sala_tarifas").select("sala_id, categoria, tamano, precio, horas_paquete_id"),
  ]);
  if (!paqRow) return { error: "El paquete de horas elegido no existe." };
  const horas = Number(paqRow.horas);
  const tamanos = (tamanosRows as TamanoSala[]) ?? [];
  const tamano = tamanoPorPersonas(tamanos, personas);
  if (!tamano)
    return { error: `No hay un tamaño de sala para ${personas} personas. El máximo se ajusta en Precios y paquetes.` };
  const horasDeId = new Map<number, number>([[paqRow.id as number, horas]]);
  const tarifas: TarifaSala[] = (
    (tarifasRows as { sala_id: number | null; categoria: string; tamano: string; precio: number | null; horas_paquete_id: number }[]) ?? []
  )
    .filter((t) => horasDeId.has(t.horas_paquete_id))
    .map((t) => ({
      sala_id: t.sala_id,
      categoria: t.categoria as CategoriaSala,
      tamano: t.tamano as ClaveTamano,
      horas: horasDeId.get(t.horas_paquete_id)!,
      precio: t.precio,
    }));
  const costo = costoDeSala(tarifas, e.categoria, tamano, horas, e.sala.tipo === "propia" ? e.sala.salaId : null);
  if (costo.precio == null) return { error: `${costo.motivo} Se carga en Precios y paquetes → Alquiler.` };

  // Sala.
  let salaId: number;
  let esExterna = false;
  let nombreDescriptivo: string | null = null;
  if (e.sala.tipo === "externa") {
    if (!planRow.permite_sala_externa) return { error: "Este plan no permite sala externa. Se activa en Planes." };
    const { data: ext } = await a.from("salas").select("id").eq("es_externa", true).eq("activa", true).maybeSingle();
    if (!ext) return { error: "No hay una sala externa activa configurada." };
    salaId = ext.id as number;
    esExterna = true;
    nombreDescriptivo = e.sala.nombreDescriptivo?.trim() || null;
    if (!nombreDescriptivo) return { error: 'Una sala externa necesita un nombre descriptivo (ej. "Salón X — Hotel Y").' };
  } else {
    const { data: salaRow } = await a.from("salas").select("id, activa, es_externa").eq("id", e.sala.salaId).maybeSingle();
    if (!salaRow || !salaRow.activa || salaRow.es_externa) return { error: "La sala elegida no existe o no está activa." };
    if (planRow.salas_modo === "solo") {
      const { data: permitida } = await a
        .from("plan_salas")
        .select("sala_id")
        .eq("plan_id", planRow.id)
        .eq("sala_id", salaRow.id)
        .maybeSingle();
      if (!permitida) return { error: "Este plan no permite esa sala. Se ajusta en Planes." };
    }
    salaId = salaRow.id as number;
  }

  // Vigencia: cuenta desde la fecha de inicio (primera reserva).
  const mesesVigencia = Math.max(1, Number(await obtenerParametro("vencimiento_paquete_meses")) || 2);
  const vigenciaDias = vigenciaDiasEfectiva(planRow.vigencia_dias, mesesVigencia);
  const fFin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  fFin.setDate(fFin.getDate() + vigenciaDias);
  const fechaFin = isoFecha(fFin);

  // Sesiones: igual que particulares — nunca más minutos que los comprados.
  const minutos = Math.round(horas * 60);
  let pedidas: { fecha: string; hora: string; duracionMin: number }[];
  let leftoverMin = 0;
  if (e.agenda.modalidad === "flexible") {
    if (e.agenda.duracionMin > minutos)
      return { error: `La duración elegida (${e.agenda.duracionMin} min) es mayor a las horas del paquete (${horas} h).` };
    pedidas = [{ fecha: isoFecha(inicio), hora: e.agenda.hora, duracionMin: e.agenda.duracionMin }];
    leftoverMin = minutos - e.agenda.duracionMin;
  } else {
    if (!e.agenda.diasSemana.length) return { error: "Elegí al menos un día para la agenda fija." };
    const necesarias = Math.floor(minutos / e.agenda.duracionMin);
    if (necesarias < 1)
      return { error: `La duración elegida (${e.agenda.duracionMin} min) es mayor a las horas del paquete (${horas} h).` };
    const fechas = fechasAgendaFija(e.agenda.diasSemana, inicio, necesarias);
    if (fechas.length < necesarias) return { error: "No se encontraron suficientes fechas para cubrir las horas del paquete." };
    pedidas = fechas.map((f) => ({ fecha: f, hora: e.agenda.hora, duracionMin: e.agenda.duracionMin }));
    leftoverMin = minutos - necesarias * e.agenda.duracionMin;
  }

  const sesiones = await evaluarSesiones(a, { salaId, esExterna, profesorId: null, sesiones: pedidas, personas });

  return {
    contacto: { id: c.id, nombre: nombreCompleto(c), whatsapp: c.whatsapp },
    planNombre: planRow.nombre as string,
    horas,
    precio: costo.precio,
    ruta: costo.ruta,
    tamano: tamano.clave,
    categoriaPropuesta: propuesta.categoria,
    categoriaMotivo: propuesta.motivo,
    fechaFin,
    leftoverMin,
    sesiones,
    todasOk: sesiones.every((s) => s.ok),
    salaId,
    esExterna,
    nombreDescriptivo,
    dondeTexto: esExterna ? nombreDescriptivo! : "Tropicana",
  };
}

export type ResultadoPreviewAlquiler = {
  error?: string;
  sesiones?: SesionAgendaEvaluada[];
  horas?: number;
  precio?: number;
  ruta?: string;
  leftoverMin?: number;
  todasOk?: boolean;
};

/** Solo lectura: precio de la tabla y disponibilidad de cada reserva, antes de vender. */
export async function previsualizarAlquiler(e: EntradaAgendaAlquiler): Promise<ResultadoPreviewAlquiler> {
  if (!(await tienePermiso("alquileres", "crear"))) return { error: "No tenés permiso para vender alquileres." };
  const r = await calcularAlquiler(admin(), e);
  if (r.error) return { error: r.error };
  return { sesiones: r.sesiones, horas: r.horas, precio: r.precio, ruta: r.ruta, leftoverMin: r.leftoverMin, todasOk: r.todasOk };
}

// ── Venta ─────────────────────────────────────────────────────────────────

type ResultadoVentaAlquiler = {
  ok?: true;
  resumen?: string;
  aviso?: { nombre: string; whatsapp: string | null; mensaje: string };
  error?: string;
};

export async function venderAlquiler(e: EntradaAlquiler): Promise<ResultadoVentaAlquiler> {
  if (!(await tienePermiso("alquileres", "crear"))) return { error: "No tenés permiso para vender alquileres." };

  const a = admin();
  const perfil = await obtenerPerfilActual();
  const propuesta = await categoriaDeContacto(a, e.contactoId);
  const falta = faltaParaAlquiler({
    contactoId: e.contactoId,
    planId: e.planId,
    horasPaqueteId: e.horasPaqueteId,
    personas: e.personas,
    categoria: e.categoria,
    categoriaPropuesta: propuesta.categoria,
    categoriaGlosa: e.categoriaGlosa ?? "",
    salaTipo: e.sala.tipo,
    salaId: e.sala.tipo === "propia" ? e.sala.salaId : null,
    nombreExterna: e.sala.tipo === "externa" ? e.sala.nombreDescriptivo : "",
    fechaInicio: e.fechaInicio,
    esFija: e.agenda.modalidad === "fija",
    diasSemana: e.agenda.modalidad === "fija" ? e.agenda.diasSemana : [],
    hora: e.agenda.hora,
    horaAlineada: true, // el horario real lo valida `evaluarSesiones`
    duracionMin: e.agenda.duracionMin,
  });
  if (falta) return { error: `Falta ${falta}.` };

  const r = await calcularAlquiler(a, e);
  if (r.error) return { error: r.error };
  const { contacto, planNombre, horas, precio, ruta, tamano, categoriaPropuesta, categoriaMotivo, fechaFin, sesiones, todasOk, salaId, nombreDescriptivo, dondeTexto, leftoverMin } = r;
  if (!contacto || !sesiones || salaId == null || precio == null || horas == null) return { error: "No se pudo calcular la venta." };

  // Se vuelve a evaluar acá: entre la revisión y el clic otra venta pudo ocupar la sala.
  if (!todasOk) {
    const conflictos = sesiones.filter((s) => !s.ok);
    return {
      error: `${conflictos.length === 1 ? "Hay una reserva que choca" : `Hay ${conflictos.length} reservas que chocan`}: ${conflictos
        .map((s) => `${formatearAgenda([s])} — ${s.motivo}`)
        .join("; ")}. Revisá la disponibilidad de nuevo.`,
    };
  }

  // ── Cobro (mismo cálculo que venderParticular) ──
  const c = e.cobro;
  const mueveBruto = c.modo === "sin" ? 0 : Math.max(0, (Number(c.total) || 0) - (Number(c.saldo) || 0));
  const mueve = Math.min(precio, Math.max(0, Math.round(mueveBruto)));
  const descManual = Math.min(precio, Math.max(0, Math.round(Number(c.ajuste) || 0)));
  if (mueve > 0 && !c.medio) return { error: "Elegí el medio de pago." };
  if (descManual > 0 && !c.ajusteMotivo.trim()) return { error: "El descuento manual necesita un motivo." };
  const saldo = Math.max(0, precio - mueve - descManual);
  let fechaCompromiso: string | null = null;
  if (saldo > 0) {
    const diasMax = Math.max(1, Number(await obtenerParametro("dias_compromiso_pago")) || 30);
    const fc = parseFechaISO(c.fechaCompromiso ?? "");
    if (!fc) return { error: "Cargá la fecha de compromiso de pago del saldo." };
    const hoy0 = hoyLocal();
    const maxF = new Date(hoy0);
    maxF.setDate(maxF.getDate() + diasMax);
    if (fc < hoy0) return { error: "La fecha de compromiso no puede ser anterior a hoy." };
    if (fc > maxF) return { error: `La fecha de compromiso no puede superar ${diasMax} días desde hoy.` };
    fechaCompromiso = isoFecha(fc);
  }
  const glosaMedio = c.medio && /otro/i.test(c.medio) && c.notaMedio?.trim() ? c.notaMedio.trim() : null;

  const inicio = parseFechaISO(e.fechaInicio)!;

  // ── Grabar ──
  const { data: mem, error: errMem } = await a
    .from("membresias")
    .insert({
      alumno_id: null, // el titular de un alquiler NO adquiere el rol alumno (regla 21)
      contacto_id: contacto.id,
      curso_id: null,
      modalidad: "clase",
      fecha_inicio: isoFecha(inicio),
      fecha_fin: fechaFin,
      estado: "activa",
      plan_id: e.planId,
      precio_aplicado: precio,
      horas_contratadas: horas,
      categoria_propuesta: categoriaPropuesta,
      categoria_aplicada: e.categoria,
      categoria_motivo: categoriaMotivo,
      categoria_glosa: e.categoria !== categoriaPropuesta ? e.categoriaGlosa?.trim() ?? null : null,
      alquiler_personas: Math.trunc(e.personas),
      alquiler_tamano: tamano,
      alquiler_ruta: ruta,
    })
    .select("id")
    .single();
  if (errMem) return { error: errMem.message };
  const membresiaId = mem.id as number;

  const { error: errSala } = await a
    .from("membresia_salas")
    .insert({ membresia_id: membresiaId, sala_id: salaId, nombre_descriptivo: nombreDescriptivo ?? null });
  if (errSala) return { error: "Se creó el alquiler, pero falló guardar la sala: " + errSala.message };

  const { data: cuota, error: errCuota } = await a
    .from("cuotas")
    .insert({
      membresia_id: membresiaId,
      periodo: isoFecha(primerDiaDelMes(inicio)),
      monto_devengado: precio,
      descuento_adelanto: 0,
      vencimiento: fechaCompromiso ?? isoFecha(sumarMeses(inicio, 1)),
      fecha_compromiso: fechaCompromiso,
      estado: precio <= 0 ? "pagada" : mueve + descManual >= precio ? "pagada" : mueve + descManual > 0 ? "parcial" : "pendiente",
    })
    .select("id")
    .single();
  if (errCuota) return { error: "Se creó el alquiler, pero falló crear la cuota: " + errCuota.message };

  if (mueve > 0 || descManual > 0) {
    const { error: errPago } = await a.from("pagos").insert({
      tipo: "cobro",
      motivo: "alquiler",
      alumno_id: null,
      contacto_id: contacto.id,
      membresia_id: membresiaId,
      cuota_id: cuota.id,
      monto: mueve,
      medio: mueve > 0 ? c.medio : null,
      descuento: descManual,
      descuento_motivo: descManual > 0 ? c.ajusteMotivo.trim() : null,
      glosa: glosaMedio,
      registrado_por: perfil?.id ?? null,
    });
    if (errPago) return { error: "Se creó el alquiler, pero falló registrar el cobro: " + errPago.message };
  }

  const { error: errRes } = await a.from("reservas_sala").insert(
    sesiones.map((s) => ({
      sala_id: salaId,
      tipo: "alquiler",
      membresia_id: membresiaId,
      profesor_id: null,
      fecha: s.fecha,
      hora: s.hora,
      duracion_min: s.duracionMin,
      estado: "confirmada",
      creado_por: perfil?.id ?? null,
    }))
  );
  if (errRes) {
    if ((errRes as { code?: string }).code === "23P01")
      return {
        error: "Se creó el alquiler, pero una de las reservas se acaba de ocupar con otra. Revisá las reservas de este alquiler antes de avisar al cliente.",
      };
    return { error: "Se creó el alquiler, pero falló crear las reservas: " + errRes.message };
  }

  revalidatePath("/inscribir");
  revalidatePath("/sala");
  revalidatePath("/alquileres");

  const agendaTexto = formatearAgenda(sesiones);
  const resto = leftoverMin ? " El resto de las horas se coordina después." : "";
  return {
    ok: true,
    resumen: `Alquiler de ${contacto.nombre} — ${planNombre}, ${horas} h en ${dondeTexto}. Reservado: ${agendaTexto}.${resto} ${mueve > 0 ? `Cobrado ${gs(mueve)}.` : "Sin cobro por ahora."}`,
    aviso: {
      nombre: contacto.nombre,
      whatsapp: contacto.whatsapp,
      mensaje: `Hola! Confirmamos tu alquiler de sala (${planNombre}): ${horas} h en ${dondeTexto}. Reservado: ${agendaTexto}.${resto} ¡Te esperamos!`,
    },
  };
}
