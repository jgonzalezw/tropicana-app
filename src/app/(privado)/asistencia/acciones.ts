"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual } from "@/lib/sesion";
import { compararPorApellido } from "@/lib/texto";
import { diaIso } from "@/lib/inscripcion";
import type { EntradaAsistencia, FilaAsistencia } from "@/lib/tipos";
import { recalcularFinDeCiclo, recalcularMembresia } from "@/lib/membresias";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}
type Admin = ReturnType<typeof admin>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
type Estado = "presente" | "ausente";
/** Estado de una fecha del curso en el selector de asistencia. */
export type EstadoFecha = "completada" | "incompleta" | "suspendida";

// ── Fechas ──────────────────────────────────────────────────────────────
function hoyISO(): string {
  return fmt(new Date());
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function restarDias(iso: string, dias: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() - dias);
  return fmt(d);
}
/** Próxima fecha (ISO) del patrón semanal del curso, estrictamente posterior a `baseIso`. */
/** Valida la fecha para operar asistencia: nunca futuro; pasado solo con
 *  permiso de edición y dentro de la ventana en semanas. */
async function validarFecha(fecha: string): Promise<string | null> {
  if (!ISO.test(fecha)) return "Fecha inválida.";
  const hoy = hoyISO();
  if (fecha > hoy) return "No se puede operar una fecha futura.";
  if (fecha < hoy) {
    if (!(await tienePermiso("asistencia", "editar")))
      return "No tenés permiso para cargar fechas pasadas.";
    const semanas = Math.max(0, Number(await obtenerParametro("asistencia_semanas_retro")) || 2);
    if (fecha < restarDias(hoy, semanas * 7))
      return `Solo se puede cargar hasta ${semanas} semanas hacia atrás.`;
  }
  return null;
}

// ── Mecanismo compartido: correr / revertir el fin de ciclo ──────────────

/**
 * Deja constancia de que una clase suspendida corrió el fin de ciclo de una
 * membresía, y actualiza ese fin de ciclo.
 *
 * **Desde 0021 el fin de ciclo se CALCULA** (`recalcularFinDeCiclo`, que cuenta
 * las clases que realmente ocurrieron y saltea las suspendidas): esta función
 * ya no decide la fecha, la recalcula y anota el antes/después. La diferencia
 * importa — antes la fecha dependía de que el evento se disparara en el momento
 * justo, y una venta retroactiva sobre una clase ya suspendida se quedaba sin
 * su corrimiento para siempre.
 *
 * La cuota quedó afuera: su vencimiento es el plazo de pago, no el fin de ciclo.
 * Idempotente por (inscripción, sesión).
 */
async function aplicarCorrimiento(
  a: Admin,
  args: {
    inscripcionId: number;
    alumnoId: number;
    sesionId: number;
    tipo: "falta" | "suspension";
    fechaClase: string;
    motivo: string | null;
    registradoPor: string | null;
  }
): Promise<"aplicado" | "ya" | "sin_efecto" | "bloqueado_devengada"> {
  const { data: existe } = await a
    .from("corrimientos_ciclo")
    .select("id")
    .eq("inscripcion_id", args.inscripcionId)
    .eq("sesion_id", args.sesionId)
    .maybeSingle();
  if (existe) return "ya";

  const r = await recalcularFinDeCiclo(a, args.inscripcionId);
  if (r.estado === "no_aplica") return "sin_efecto";
  if (r.estado === "bloqueado_devengada") return "bloqueado_devengada";

  await a.from("corrimientos_ciclo").insert({
    inscripcion_id: args.inscripcionId,
    alumno_id: args.alumnoId,
    sesion_id: args.sesionId,
    tipo: args.tipo,
    fecha_clase: args.fechaClase,
    fin_ciclo_anterior: r.antes,
    fin_ciclo_nuevo: r.despues,
    motivo: args.motivo,
    registrado_por: args.registradoPor,
  });
  return "aplicado";
}

/**
 * Borra la traza de los corrimientos de una sesión y recalcula el fin de ciclo
 * de las membresías que tocaba. No "restaura" una fecha guardada: la vuelve a
 * calcular, que es lo único que no puede quedar desincronizado.
 */
async function revertirCorrimientos(a: Admin, sesionId: number, tipo?: "falta" | "suspension"): Promise<number> {
  let q = a.from("corrimientos_ciclo").select("id, inscripcion_id").eq("sesion_id", sesionId);
  if (tipo) q = q.eq("tipo", tipo);
  const { data } = await q;
  const filas = (data as { id: number; inscripcion_id: number }[]) ?? [];
  if (!filas.length) return 0;
  await a.from("corrimientos_ciclo").delete().in("id", filas.map((f) => f.id));
  for (const insc of [...new Set(filas.map((f) => f.inscripcion_id))])
    await recalcularFinDeCiclo(a, insc);
  return filas.length;
}

// ── Padrón de la sesión ─────────────────────────────────────────────────

export async function cargarPadron(
  cursoId: number,
  fecha: string
): Promise<{
  filas: FilaAsistencia[];
  marcas: Record<number, Estado>;
  /** Faltas justificadas de la sesión: alumnoId -> true. */
  licencias: Record<number, boolean>;
  suspendida: boolean;
  motivoSuspension: string | null;
  completada: boolean;
  /** Ya se tomó asistencia, pero quedan alumnos del padrón de esa fecha sin marcar. */
  incompleta: boolean;
  /** Estado por fecha (ISO) del curso dentro de la ventana: para el selector. */
  estadosPorFecha: Record<string, EstadoFecha>;
  /**
   * Falló la lectura del padrón. Un padrón vacío y un padrón que no se pudo
   * leer se ven igual, y confundirlos hace que la clase se tome sin nadie
   * (regla de calidad 1). Con esto la pantalla puede decir cuál de los dos es.
   */
  error: string | null;
}> {
  const vacio = {
    filas: [],
    marcas: {},
    licencias: {},
    suspendida: false,
    motivoSuspension: null,
    completada: false,
    incompleta: false,
    estadosPorFecha: {} as Record<string, EstadoFecha>,
    error: null,
  };
  if (!(await tienePermiso("asistencia", "ver"))) return vacio;
  if (!ISO.test(fecha)) return vacio;

  const sb = await createClient();

  // Sesiones del curso dentro de la ventana (para marcar el selector).
  const semanas = Math.max(0, Number(await obtenerParametro("asistencia_semanas_retro")) || 2);
  const hoy = hoyISO();
  const minVentana = restarDias(hoy, semanas * 7);
  const { data: sesWin } = await sb
    .from("sesiones")
    .select("id, fecha, estado")
    .eq("curso_id", cursoId)
    .gte("fecha", minVentana)
    .lte("fecha", hoy);
  const winRows = (sesWin as { id: number; fecha: string; estado: string }[]) ?? [];

  // Quiénes ya tienen marca en cada sesión de la ventana.
  const marcadosPorSesion = new Map<number, Set<number>>();
  if (winRows.length) {
    const { data } = await sb
      .from("asistencias")
      .select("sesion_id, alumno_id")
      .in("sesion_id", winRows.map((s) => s.id));
    for (const r of (data as { sesion_id: number; alumno_id: number }[]) ?? []) {
      const set = marcadosPorSesion.get(r.sesion_id) ?? new Set<number>();
      set.add(r.alumno_id);
      marcadosPorSesion.set(r.sesion_id, set);
    }
  }

  // Membresías del curso (todas menos las dadas de baja), de TODAS las fechas:
  // hacen falta para saber quién debía figurar en el padrón de cada fecha de la
  // ventana, no solo en la fecha elegida (una inscripción retroactiva cambia
  // padrones ya tomados, y un ciclo ya completado igual tenía que estar
  // marcado en las clases que cayeron dentro de su período).
  //
  // Qué membresías toca este curso. NO alcanza con `inscripciones.curso_id`:
  // ese campo guarda el curso *principal* de la venta, y una membresía de plan
  // multi-curso (o una prueba de varios cursos) vive en `inscripcion_cursos`.
  // Filtrando solo por `curso_id`, un alumno con un plan de 5 cursos aparecía
  // en el padrón de uno y era invisible en los otros cuatro.
  const { data: icCurso, error: errIC } = await sb
    .from("inscripcion_cursos")
    .select("inscripcion_id, dias, fecha")
    .eq("curso_id", cursoId);
  if (errIC) return { ...vacio, error: `No se pudo leer qué alumnos toma este curso: ${errIC.message}` };
  const icRows =
    (icCurso as { inscripcion_id: number; dias: number[] | null; fecha: string | null }[]) ?? [];
  const diasPorInsc = new Map<number, number[]>();
  // Una prueba tiene UNA clase en este curso, en una fecha elegida al vender
  // (0024): figura ese día y ningún otro, aunque el curso se dicte dos veces
  // por semana.
  const fechaPruebaPorInsc = new Map<number, string>();
  for (const r of icRows) {
    if (r.dias?.length) diasPorInsc.set(r.inscripcion_id, r.dias);
    if (r.fecha) fechaPruebaPorInsc.set(r.inscripcion_id, r.fecha.slice(0, 10));
  }
  const idsPorCurso = [...new Set(icRows.map((r) => r.inscripcion_id))];

  const COLS =
    "id, alumno_id, estado, modalidad, fecha_inicio, clases_total, plan_id, clases_plan, fecha_fin, tolerancia_faltas, bono_generado, es_prueba, acompanantes, creado_en, alumno:alumnos(id, nombre, apellido, activo)";
  // Dos lecturas y se unen por id: las que declaran este curso en
  // `inscripcion_cursos`, y las viejas que solo tienen `curso_id` (legado).
  const [porCursoPrincipal, porInscCursos] = await Promise.all([
    sb.from("inscripciones").select(COLS).eq("curso_id", cursoId).neq("estado", "baja"),
    idsPorCurso.length
      ? sb.from("inscripciones").select(COLS).in("id", idsPorCurso).neq("estado", "baja")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const errInsc = porCursoPrincipal.error ?? porInscCursos.error;
  if (errInsc) return { ...vacio, error: `No se pudo leer el padrón: ${errInsc.message}` };
  const porId = new Map<number, unknown>();
  for (const r of [...(porCursoPrincipal.data ?? []), ...(porInscCursos.data ?? [])])
    porId.set((r as { id: number }).id, r);
  const insc = [...porId.values()];

  type InscRow = {
    id: number;
    alumno_id: number;
    estado: string;
    modalidad: FilaAsistencia["modalidad"];
    fecha_inicio: string;
    clases_total: number | null;
    plan_id: number | null;
    clases_plan: number | null;
    fecha_fin: string | null;
    tolerancia_faltas: number | null;
    bono_generado: number;
    es_prueba: boolean | null;
    acompanantes: number | null;
    creado_en: string | null;
    alumno: { id: number; nombre: string; apellido: string; activo: boolean } | null;
  };
  const membresias = ((insc as unknown as InscRow[]) ?? []).filter((r) => r.alumno?.activo);
  const activas = membresias.filter((r) => r.estado === "activa");

  // Historial de cada membresía sobre sesiones DICTADAS: clases consumidas
  // (presentes) y clases del ciclo ya ocurridas (presentes + faltas).
  const consumidas: Record<number, number> = {};
  const dictadasPorInsc: Record<number, number> = {};
  if (membresias.length) {
    const { data } = await sb
      .from("asistencias")
      .select("inscripcion_id, sesion_id, estado")
      .in("inscripcion_id", membresias.map((r) => r.id));
    const filasAsis = (data as { inscripcion_id: number | null; sesion_id: number; estado: Estado }[]) ?? [];
    const sesIds = [...new Set(filasAsis.map((f) => f.sesion_id))];
    const dictadas = new Set<number>();
    if (sesIds.length) {
      const { data: ses } = await sb.from("sesiones").select("id, estado").in("id", sesIds);
      for (const s of (ses as { id: number; estado: string }[]) ?? [])
        if (s.estado === "dictada") dictadas.add(s.id);
    }
    for (const f of filasAsis) {
      if (f.inscripcion_id == null || !dictadas.has(f.sesion_id)) continue;
      dictadasPorInsc[f.inscripcion_id] = (dictadasPorInsc[f.inscripcion_id] ?? 0) + 1;
      if (f.estado === "presente") consumidas[f.inscripcion_id] = (consumidas[f.inscripcion_id] ?? 0) + 1;
    }
  }

  /**
   * El ciclo se AGOTÓ: ya ocurrieron sus N clases (plan) o consumió el paquete
   * comprado (venta por clase). Es lo que decide si sigue tomando clases, y va
   * aparte de `estado`: una membresía agotada pero impaga sigue `activa`
   * (se cierra recién al cobrarse) y aun así no debe seguir en el padrón.
   */
  const cicloAgotado = (r: InscRow) =>
    r.clases_plan != null
      ? (dictadasPorInsc[r.id] ?? 0) >= r.clases_plan
      : r.clases_total != null && (consumidas[r.id] ?? 0) >= r.clases_total;

  /**
   * ¿Toma ESTE curso ESE día? Cuando la membresía declaró días para este curso
   * (`inscripcion_cursos.dias`), manda esa elección: es la misma que usa el
   * motor para contar el ciclo. Sin días declarados (legado), no filtra.
   */
  const tomaEseDia = (r: InscRow, f: string) => {
    // La fecha de una prueba es exacta: manda sobre los días del curso.
    const fechaPrueba = fechaPruebaPorInsc.get(r.id);
    if (r.es_prueba === true && fechaPrueba) return f === fechaPrueba;
    const dias = diasPorInsc.get(r.id);
    return !dias?.length || dias.includes(diaIso(parseISO(f)));
  };

  /**
   * Respaldo para una prueba sin fecha explícita por curso (dato viejo, previo
   * a 0024): igual es **una clase**, así que pasada su fecha de fin deja de
   * figurar, la hayan marcado o no. Sin esto una prueba que nadie marcó nunca
   * agota su ciclo —el ciclo se agota contando asistencias— y el alumno se
   * quedaría en el padrón para siempre.
   */
  const pruebaVencida = (r: InscRow, f: string) =>
    r.es_prueba === true && r.fecha_fin != null && f > r.fecha_fin;

  /** Ya había empezado a esa fecha y su ciclo no terminó (ilimitada vencida). */
  const enPeriodo = (r: InscRow, f: string) =>
    r.fecha_inicio <= f &&
    tomaEseDia(r, f) &&
    !pruebaVencida(r, f) &&
    !(r.plan_id != null && r.clases_plan == null && r.fecha_fin != null && r.fecha_fin < f);
  /**
   * ¿Esa clase caía dentro del período de esta membresía? Para el conteo de
   * "faltan por marcar" se mira el período real (incluido el de un ciclo ya
   * completado) y se descartan los paquetes por clase ya agotados.
   */
  /**
   * Una **prueba vendida después** de que la clase se dictara no reabre esa
   * clase (decisión de Javier, 2026-09-11): registrar la asistencia de una
   * prueba pasada no le da nada al profesor ni al alumno — lo que importa es
   * si el alumno decide convertirse. Sigue listada por si Natalia la quiere
   * marcar, pero su ausencia no deja la clase "incompleta".
   *
   * Ojo: esto vale **solo** para pruebas. Una membresía regular vendida con
   * fecha retroactiva sí reabre la clase, que es lo que hizo falta con Lucas
   * Campero: él había ido y faltaba marcarlo.
   */
  const pruebaPosterior = (r: InscRow, f: string) =>
    r.es_prueba === true && r.creado_en != null && r.creado_en.slice(0, 10) > f;

  const cubriaLaClase = (r: InscRow, f: string) =>
    r.fecha_inicio <= f &&
    tomaEseDia(r, f) &&
    !pruebaPosterior(r, f) &&
    !(r.fecha_fin != null && r.fecha_fin < f) &&
    (r.modalidad === "mensual" || Math.max(0, (r.clases_total ?? 0) - (consumidas[r.id] ?? 0)) > 0);

  // Estado de cada fecha para el selector. "incompleta" = la asistencia ya se
  // tomó pero quedan alumnos del padrón de ESA fecha sin marcar: es lo que pasa
  // al inscribir a alguien con fecha retroactiva sobre clases ya tomadas.
  const estadosPorFecha: Record<string, EstadoFecha> = {};
  for (const s of winRows) {
    if (s.estado === "suspendida") {
      estadosPorFecha[s.fecha] = "suspendida";
      continue;
    }
    const marcados = marcadosPorSesion.get(s.id);
    if (!marcados?.size) continue; // sesión sin asistencia tomada
    const faltan = membresias.filter((r) => cubriaLaClase(r, s.fecha) && !marcados.has(r.alumno_id)).length;
    estadosPorFecha[s.fecha] = faltan > 0 ? "incompleta" : "completada";
  }

  // Padrón de la fecha elegida (los ciclos agotados se filtran al final, salvo
  // que ya tengan marca en esta sesión: hay que poder corregirla).
  const inscripciones = activas.filter((r) => enPeriodo(r, fecha));
  const inscIds = inscripciones.map((r) => r.id);
  const alumnoIds = [...new Set(inscripciones.map((r) => r.alumno_id))];

  const deuda = await deudaPorAlumno(sb, alumnoIds);

  // Sesión existente (marcas + estado suspendida).
  const marcas: Record<number, Estado> = {};
  const licencias: Record<number, boolean> = {};
  const extras: FilaAsistencia[] = [];
  let suspendida = false;
  let motivoSuspension: string | null = null;
  const { data: sesion } = await sb
    .from("sesiones")
    .select("id, estado, motivo")
    .eq("curso_id", cursoId)
    .eq("fecha", fecha)
    .maybeSingle();
  const sesionId = (sesion?.id as number | undefined) ?? null;
  const extrasCrudos: { inscripcionId: number | null; alumnoId: number; apellido: string; nombre: string }[] = [];
  if (sesion) {
    suspendida = sesion.estado === "suspendida";
    motivoSuspension = (sesion.motivo as string | null) ?? null;
    const { data } = await sb
      .from("asistencias")
      .select("estado, con_licencia, inscripcion_id, alumno:alumnos(id, nombre, apellido)")
      .eq("sesion_id", sesion.id);
    const idsBase = new Set(alumnoIds);
    for (const r of (data as unknown as {
      estado: Estado;
      con_licencia: boolean;
      inscripcion_id: number | null;
      alumno: { id: number; nombre: string; apellido: string } | null;
    }[]) ?? []) {
      if (!r.alumno) continue;
      marcas[r.alumno.id] = r.estado;
      if (r.estado === "ausente" && r.con_licencia) licencias[r.alumno.id] = true;
      if (!idsBase.has(r.alumno.id))
        extrasCrudos.push({
          inscripcionId: r.inscripcion_id,
          alumnoId: r.alumno.id,
          apellido: r.alumno.apellido,
          nombre: r.alumno.nombre,
        });
    }
  }

  // Faltas del CICLO actual de cada membresía (desde que empezó esta fila de
  // inscripción, no por mes calendario: cada renovación es una fila nueva).
  // Aparte, las faltas SIN licencia previas: una sola falta sin justificar
  // deja al ciclo sin derecho a bono (política de Javier, 2026-09-10).
  const faltasCicloPorInsc: Record<number, number> = {};
  const faltasSinLicPrevias: Record<number, number> = {};
  const todosInscIds = [
    ...new Set([...inscIds, ...extrasCrudos.map((e) => e.inscripcionId).filter((x): x is number => x != null)]),
  ];
  if (todosInscIds.length) {
    const { data } = await sb
      .from("asistencias")
      .select("inscripcion_id, sesion_id, con_licencia")
      .eq("estado", "ausente")
      .in("inscripcion_id", todosInscIds);
    for (const x of (data as { inscripcion_id: number | null; sesion_id: number; con_licencia: boolean }[]) ?? []) {
      if (x.inscripcion_id == null) continue;
      faltasCicloPorInsc[x.inscripcion_id] = (faltasCicloPorInsc[x.inscripcion_id] ?? 0) + 1;
      // La falta de la sesión que se está editando no se bloquea a sí misma:
      // justo ahora se está decidiendo si es justificada o no.
      if (!x.con_licencia && x.sesion_id !== sesionId)
        faltasSinLicPrevias[x.inscripcion_id] = (faltasSinLicPrevias[x.inscripcion_id] ?? 0) + 1;
    }
  }

  // Tolerancia de faltas con licencia restante, por inscripción (solo membresías
  // de plan con N: donde la falta con licencia acredita un bono real). El resto
  // (ilimitadas, parciales, legado sin plan) no tiene esta opción.
  const planNRows = inscripciones.filter((r) => r.plan_id != null && r.clases_plan != null);
  const planIds = [...new Set(planNRows.map((r) => r.plan_id as number))];
  const toleranciaPorPlan = new Map<number, number | null>();
  if (planIds.length) {
    const { data: planesRows } = await sb.from("planes").select("id, tolerancia_faltas").in("id", planIds);
    for (const p of (planesRows as { id: number; tolerancia_faltas: number | null }[]) ?? [])
      toleranciaPorPlan.set(p.id, p.tolerancia_faltas);
  }
  const toleranciaParam = Math.max(0, Number(await obtenerParametro("faltas_toleradas")) || 0);
  const toleranciaRestantePorInsc = new Map<number, number>();
  for (const r of planNRows) {
    const efectiva = r.tolerancia_faltas ?? toleranciaPorPlan.get(r.plan_id as number) ?? toleranciaParam;
    const sinDerecho = (faltasSinLicPrevias[r.id] ?? 0) > 0;
    toleranciaRestantePorInsc.set(r.id, sinDerecho ? 0 : Math.max(0, efectiva - (r.bono_generado ?? 0)));
  }

  for (const e of extrasCrudos)
    extras.push({
      inscripcionId: e.inscripcionId,
      alumnoId: e.alumnoId,
      apellido: e.apellido,
      nombre: e.nombre,
      modalidad: "mensual",
      restantes: null,
      faltasCiclo: e.inscripcionId != null ? faltasCicloPorInsc[e.inscripcionId] ?? 0 : 0,
      progreso: null,
      deuda: deuda[e.alumnoId] ?? 0,
      toleranciaRestante: null,
      faltaSinLicenciaEnCiclo: false,
      esPrueba: false,
      personas: 1,
    });

  const filas: FilaAsistencia[] = inscripciones
    // Un ciclo agotado ya no toma clases, esté cobrado o no. Si tiene marca en
    // esta sesión se queda, para poder corregirla.
    .filter((r) => !cicloAgotado(r) || marcas[r.alumno!.id] != null)
    .map((r) => {
      const esMensual = r.modalidad === "mensual";
      const restantes = esMensual ? null : Math.max(0, (r.clases_total ?? 0) - (consumidas[r.id] ?? 0));
      const progreso = r.clases_plan != null ? { hechas: consumidas[r.id] ?? 0, total: r.clases_plan } : null;
      return {
        inscripcionId: r.id,
        alumnoId: r.alumno!.id,
        apellido: r.alumno!.apellido,
        nombre: r.alumno!.nombre,
        modalidad: r.modalidad,
        restantes,
        faltasCiclo: faltasCicloPorInsc[r.id] ?? 0,
        progreso,
        deuda: deuda[r.alumno_id] ?? 0,
        toleranciaRestante: toleranciaRestantePorInsc.has(r.id) ? toleranciaRestantePorInsc.get(r.id)! : null,
        faltaSinLicenciaEnCiclo: (faltasSinLicPrevias[r.id] ?? 0) > 0,
        esPrueba: r.es_prueba === true,
        // Un grupo de prueba es un titular más N acompañantes sin nombre: una
        // sola fila y una sola asistencia, pero cuentan todos para la clase.
        personas: 1 + Math.max(0, Number(r.acompanantes) || 0),
      };
    });

  return {
    filas: [...filas, ...extras].sort(compararPorApellido),
    marcas,
    licencias,
    suspendida,
    motivoSuspension,
    completada: estadosPorFecha[fecha] === "completada",
    incompleta: estadosPorFecha[fecha] === "incompleta",
    estadosPorFecha,
    error: null,
  };
}

async function deudaPorAlumno(
  sb: Awaited<ReturnType<typeof createClient>>,
  alumnoIds: number[]
): Promise<Record<number, number>> {
  const deuda: Record<number, number> = {};
  if (!alumnoIds.length) return deuda;
  const { data: inscAll } = await sb.from("inscripciones").select("id, alumno_id").in("alumno_id", alumnoIds);
  const inscToAlumno = new Map<number, number>(
    ((inscAll as { id: number; alumno_id: number }[]) ?? []).map((r) => [r.id, r.alumno_id])
  );
  const allInscIds = [...inscToAlumno.keys()];
  if (!allInscIds.length) return deuda;
  const { data: cuotas } = await sb
    .from("cuotas")
    .select("id, inscripcion_id, monto_devengado, descuento_adelanto, estado")
    .in("inscripcion_id", allInscIds)
    .neq("estado", "pagada");
  const cuotaRows =
    (cuotas as { id: number; inscripcion_id: number; monto_devengado: number; descuento_adelanto: number }[]) ?? [];
  const pagado: Record<number, number> = {};
  if (cuotaRows.length) {
    const { data: pagos } = await sb
      .from("pagos")
      .select("cuota_id, monto, descuento")
      .eq("tipo", "cobro")
      .in("cuota_id", cuotaRows.map((c) => c.id));
    for (const p of (pagos as { cuota_id: number | null; monto: number; descuento: number }[]) ?? [])
      if (p.cuota_id != null) pagado[p.cuota_id] = (pagado[p.cuota_id] ?? 0) + Number(p.monto) + Number(p.descuento);
  }
  for (const c of cuotaRows) {
    const efectivo = Math.max(0, Number(c.monto_devengado) - Number(c.descuento_adelanto));
    const saldo = Math.max(0, efectivo - (pagado[c.id] ?? 0));
    const al = inscToAlumno.get(c.inscripcion_id);
    if (al != null && saldo > 0) deuda[al] = (deuda[al] ?? 0) + saldo;
  }
  return deuda;
}

// ── Guardar asistencia (con disparador de falta individual) ──────────────

export async function guardarAsistencia(
  e: EntradaAsistencia
): Promise<{ ok?: true; resumen?: string; error?: string }> {
  if (!(await tienePermiso("asistencia", "crear")))
    return { error: "No tenés permiso para registrar asistencia." };
  if (!e.marcas.length) return { error: "No hay nada marcado." };
  const errFecha = await validarFecha(e.fecha);
  if (errFecha) return { error: errFecha };

  const perfil = await obtenerPerfilActual();
  const a = admin();

  const { data: curso } = await a
    .from("cursos")
    .select("id, dias_semana")
    .eq("id", e.cursoId)
    .maybeSingle();
  if (!curso) return { error: "El curso no existe." };

  const { data: asig } = await a
    .from("asignaciones")
    .select("profesor_id")
    .eq("curso_id", e.cursoId)
    .is("hasta", null)
    .maybeSingle();

  // Guardar asistencia = la clase se dictó (revierte una suspensión previa).
  const { data: sesion, error: errSesion } = await a
    .from("sesiones")
    .upsert(
      {
        curso_id: e.cursoId,
        fecha: e.fecha,
        estado: "dictada",
        motivo: null,
        profesor_id: asig?.profesor_id ?? null,
        registrado_por: perfil?.id ?? null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "curso_id,fecha" }
    )
    .select("id")
    .single();
  if (errSesion) return { error: errSesion.message };
  const sesionId = sesion.id as number;

  await revertirCorrimientos(a, sesionId, "suspension");

  const filas = e.marcas.map((m) => ({
    sesion_id: sesionId,
    alumno_id: m.alumnoId,
    inscripcion_id: m.inscripcionId,
    estado: m.estado,
    con_licencia: m.estado === "ausente" ? !!m.conLicencia : false,
  }));
  const { error: errAsis } = await a.from("asistencias").upsert(filas, { onConflict: "sesion_id,alumno_id" });
  if (errAsis) return { error: errAsis.message };

  // El fin de ciclo no se corre por faltas individuales: la falta con licencia
  // acredita un bono de tolerancia (se redime al renovar); la falta sin licencia
  // no corre nada. Solo limpiamos corrimientos 'falta' heredados de la sesión.
  await revertirCorrimientos(a, sesionId, "falta");

  // Motor: recalcular contador/"completada"/bono de las membresías tocadas.
  const inscIds = [...new Set(e.marcas.map((m) => m.inscripcionId).filter((x): x is number => x != null))];
  let completadas = 0;
  for (const id of inscIds) if (await recalcularMembresia(a, id)) completadas++;

  const presentes = e.marcas.filter((m) => m.estado === "presente").length;
  const ausentes = e.marcas.filter((m) => m.estado === "ausente").length;
  const conLic = e.marcas.filter((m) => m.estado === "ausente" && m.conLicencia).length;
  const plu = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  const notaLic =
    conLic > 0 ? ` ${plu(conLic, "falta con licencia", "faltas con licencia")} (bono de tolerancia).` : "";
  const notaComp =
    completadas > 0 ? ` ${plu(completadas, "membresía completada", "membresías completadas")}.` : "";

  revalidatePath("/asistencia");
  return {
    ok: true,
    resumen: `Asistencia guardada · ${plu(presentes, "presente", "presentes")} y ${plu(
      ausentes,
      "ausente",
      "ausentes"
    )}.${notaLic}${notaComp}`,
  };
}

// El motor de membresías (cuándo se cierra un ciclo) vive en @/lib/membresias:
// lo comparten tomar asistencia y cobrar, y los dos tienen que coincidir.

/** Recalcula todas las membresías cerrables (uso puntual / previo a liquidar). */
export async function recalcularMembresiasPlan(): Promise<{ ok?: true; error?: string; total?: number }> {
  if (!(await tienePermiso("asistencia", "editar"))) return { error: "Sin permiso." };
  const a = admin();
  // Planes con N y paquetes por clase: los dos se cierran por consumo. Las
  // ilimitadas no entran (su ciclo termina por fecha, no por contador).
  const { data } = await a
    .from("inscripciones")
    .select("id")
    .or("clases_plan.not.is.null,clases_total.not.is.null")
    .neq("estado", "baja");
  const ids = ((data as { id: number }[]) ?? []).map((r) => r.id);
  for (const id of ids) await recalcularMembresia(a, id);
  revalidatePath("/asistencia");
  return { ok: true, total: ids.length };
}

// ── Suspender / reabrir una clase ────────────────────────────────────────

export async function suspenderClase(args: {
  cursoId: number;
  fecha: string;
  motivo: string;
}): Promise<{ ok?: true; resumen?: string; error?: string }> {
  if (!(await tienePermiso("asistencia", "crear")))
    return { error: "No tenés permiso para suspender clases." };
  const errFecha = await validarFecha(args.fecha);
  if (errFecha) return { error: errFecha };

  const perfil = await obtenerPerfilActual();
  const a = admin();

  const { data: curso } = await a
    .from("cursos")
    .select("id")
    .eq("id", args.cursoId)
    .maybeSingle();
  if (!curso) return { error: "El curso no existe." };

  const { data: asig } = await a
    .from("asignaciones")
    .select("profesor_id")
    .eq("curso_id", args.cursoId)
    .is("hasta", null)
    .maybeSingle();

  const { data: sesion, error: errSesion } = await a
    .from("sesiones")
    .upsert(
      {
        curso_id: args.cursoId,
        fecha: args.fecha,
        estado: "suspendida",
        motivo: args.motivo.trim() || null,
        profesor_id: asig?.profesor_id ?? null,
        registrado_por: perfil?.id ?? null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "curso_id,fecha" }
    )
    .select("id")
    .single();
  if (errSesion) return { error: errSesion.message };
  const sesionId = sesion.id as number;

  // Una clase suspendida no computa asistencia: se borran marcas y se
  // rehacen los corrimientos como 'suspension' (limpiando faltas previas).
  await a.from("asistencias").delete().eq("sesion_id", sesionId);
  await revertirCorrimientos(a, sesionId);

  const { data: insc } = await a
    .from("inscripciones")
    .select("id, alumno_id, modalidad")
    .eq("curso_id", args.cursoId)
    .eq("estado", "activa")
    .lte("fecha_inicio", args.fecha);

  let corridos = 0;
  for (const r of (insc as { id: number; alumno_id: number; modalidad: string }[]) ?? []) {
    if (r.modalidad !== "mensual") continue; // parciales se difieren solos
    const res = await aplicarCorrimiento(a, {
      inscripcionId: r.id,
      alumnoId: r.alumno_id,
      sesionId,
      tipo: "suspension",
      fechaClase: args.fecha,
      motivo: args.motivo.trim() || null,
      registradoPor: perfil?.id ?? null,
    });
    if (res === "aplicado") corridos++;
  }

  const plu = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  revalidatePath("/asistencia");
  return {
    ok: true,
    resumen: `Clase suspendida. Se corrió el fin de ciclo de ${plu(
      corridos,
      "alumno mensual",
      "alumnos mensuales"
    )}. Los paquetes por clase se difieren solos.`,
  };
}

export async function reabrirSesion(args: {
  cursoId: number;
  fecha: string;
}): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("asistencia", "crear")))
    return { error: "No tenés permiso." };
  const a = admin();
  const { data: sesion } = await a
    .from("sesiones")
    .select("id")
    .eq("curso_id", args.cursoId)
    .eq("fecha", args.fecha)
    .maybeSingle();
  if (!sesion) return { ok: true };
  await revertirCorrimientos(a, sesion.id);
  await a
    .from("sesiones")
    .update({ estado: "dictada", motivo: null, actualizado_en: new Date().toISOString() })
    .eq("id", sesion.id);
  revalidatePath("/asistencia");
  return { ok: true };
}
