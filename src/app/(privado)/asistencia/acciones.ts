"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual } from "@/lib/sesion";
import { compararPorApellido } from "@/lib/texto";
import { diaIso } from "@/lib/inscripcion";
import { cargarImpacto, liquidacionesTocadas, avisoDeImpacto } from "@/lib/periodos";
import {
  COLS_VIGENCIA,
  enVigencia,
  motivoFueraDeVigencia,
  type VigenciaCurso,
} from "@/lib/vigencia";
import {
  COLUMNAS_ASIGNACION,
  asignacionEnFecha,
  type AsignacionVigencia,
} from "@/lib/asignaciones";
import type { EntradaAsistencia, FilaAsistencia } from "@/lib/tipos";
import { recalcularFinDeCiclo, recalcularMembresia } from "@/lib/membresias";
import { revertirDevengosAbiertos } from "../liquidaciones/acciones";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}
export type Admin = ReturnType<typeof admin>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
type Estado = "presente" | "ausente";
/** Estado de una fecha del curso en el selector de asistencia. */
/**
 * Estado de una fecha del curso en el selector.
 *
 * `sin_alumnos` = ese día no lo cubre ninguna membresía. No hay a quién marcar
 * y nadie tiene obligación de dictarla: no se registra, no cuenta para el
 * prorrateo y no traba ninguna liquidación. Se muestra igual —marcada— en vez
 * de esconderse: si desapareciera, "no hay clase" y "no hay alumnos" se verían
 * iguales (regla de calidad 5). Javier, 2026-09-12: *"Solo se compromete al
 * profesor para dictar clases donde hay alumnos, sin ellos no tiene obligación
 * alguna en esa clase de la fecha, ni la academia con él."*
 */
export type EstadoFecha = "completada" | "incompleta" | "suspendida" | "sin_alumnos";

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
/** Último día del mes vencido: el tope hasta donde llega una liquidación. */
function finMesVencidoISO(hoy = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  return fmt(d);
}
/** Próxima fecha (ISO) del patrón semanal del curso, estrictamente posterior a `baseIso`. */
/**
 * Valida la fecha para operar asistencia: nunca futuro; pasado solo con
 * permiso de edición y dentro de la ventana en semanas.
 *
 * `permitirFutura` es la única excepción, y es angosta a propósito: un cierre
 * de sala planificado (feriado de la semana que viene) sí necesita suspender
 * clases futuras — es lo que le permite al corrimiento del ciclo aplicarse
 * ya, en vez de esperar a que la fecha llegue. El resto de las reglas —la
 * vigencia del curso, la ventana de semanas hacia atrás— se aplican igual.
 * Una liquidación ya pagada **no** bloquea (regla de negocio 16): si el
 * recálculo cambia lo devengado, la diferencia sale como ajuste (0044).
 */
export async function validarFecha(
  cursoId: number,
  fecha: string,
  opts?: { permitirFutura?: boolean }
): Promise<string | null> {
  if (!ISO.test(fecha)) return "Fecha inválida.";
  const hoy = hoyISO();
  if (fecha > hoy && !opts?.permitirFutura) return "No se puede operar una fecha futura.";

  // **Vigencia del curso** (0033). Fuera de sus fechas el curso no corría, así
  // que no hay clase que registrar ni que suspender. El desplegable ya no
  // ofrece esas fechas, pero el que decide es el servidor.
  const sbVig = await createClient();
  const { data: cVig } = await sbVig
    .from("cursos")
    .select(`nombre, ${COLS_VIGENCIA}`)
    .eq("id", cursoId)
    .maybeSingle();
  const vig = cVig as unknown as ({ nombre: string } & VigenciaCurso) | null;
  if (vig && !enVigencia(vig, fecha)) return motivoFueraDeVigencia(vig.nombre, vig, fecha);

  // **Acá ya no se bloquea por la liquidación** (regla de negocio 16, reescrita
  // el 2026-09-18). Las clases solo afectan contadores: la plata sale de las
  // membresías completadas y cobradas, y el conteo es apenas el insumo del
  // prorrateo. Registrar tarde, corregir o suspender son hechos que pasaron y
  // el sistema tiene que poder reflejarlos. Si eso cambia lo devengado de una
  // membresía ya liquidada, la diferencia sale como un **ajuste** al liquidar
  // (0044) — lo pagado no se reescribe. Lo que queda es avisar antes de
  // guardar, y de eso se encarga el que llama (`guardarAsistencia`).

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
export async function aplicarCorrimiento(
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
): Promise<{ estado: "aplicado" | "ya" | "sin_efecto" | "bloqueado_devengada"; finCicloNuevo: string | null }> {
  const { data: existe } = await a
    .from("corrimientos_ciclo")
    .select("id")
    .eq("membresia_id", args.inscripcionId)
    .eq("sesion_id", args.sesionId)
    .maybeSingle();
  if (existe) return { estado: "ya", finCicloNuevo: null };

  const r = await recalcularFinDeCiclo(a, args.inscripcionId);
  if (r.estado === "no_aplica") return { estado: "sin_efecto", finCicloNuevo: null };
  if (r.estado === "bloqueado_devengada") return { estado: "bloqueado_devengada", finCicloNuevo: null };

  await a.from("corrimientos_ciclo").insert({
    membresia_id: args.inscripcionId,
    alumno_id: args.alumnoId,
    sesion_id: args.sesionId,
    tipo: args.tipo,
    fecha_clase: args.fechaClase,
    fin_ciclo_anterior: r.antes,
    fin_ciclo_nuevo: r.despues,
    motivo: args.motivo,
    registrado_por: args.registradoPor,
  });
  return { estado: "aplicado", finCicloNuevo: r.despues };
}

/**
 * Borra la traza de los corrimientos de una sesión y recalcula el fin de ciclo
 * de las membresías que tocaba. No "restaura" una fecha guardada: la vuelve a
 * calcular, que es lo único que no puede quedar desincronizado.
 */
export async function revertirCorrimientos(a: Admin, sesionId: number, tipo?: "falta" | "suspension"): Promise<number> {
  let q = a.from("corrimientos_ciclo").select("id, membresia_id").eq("sesion_id", sesionId);
  if (tipo) q = q.eq("tipo", tipo);
  const { data } = await q;
  const filas = (data as { id: number; membresia_id: number }[]) ?? [];
  if (!filas.length) return 0;
  await a.from("corrimientos_ciclo").delete().in("id", filas.map((f) => f.id));
  for (const insc of [...new Set(filas.map((f) => f.membresia_id))])
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
   * **Quién tenía el curso ESE día.** `null` = el curso estaba desasignado, y
   * entonces registrar un reemplazo es obligatorio si la clase se dictó
   * (regla de negocio 20). Se muestra siempre: quien toma asistencia tiene que
   * saber a nombre de quién la está registrando.
   */
  titular: { id: number; nombre: string } | null;
  /** El reemplazo ya registrado en esta clase, si lo hubo. */
  reemplazo: { profesorId: number; motivo: string; costo: number } | null;
  /** Para elegir reemplazante, con su tarifa de referencia. */
  profesores: { id: number; nombre: string; tarifa: number | null }[];
  /** Catálogo `motivo_reemplazo` (regla 13: los motivos no se hardcodean). */
  motivosReemplazo: { valor: string; etiqueta: string }[];
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
    titular: null,
    reemplazo: null,
    profesores: [] as { id: number; nombre: string; tarifa: number | null }[],
    motivosReemplazo: [] as { valor: string; etiqueta: string }[],
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
  // Qué membresías toca este curso. NO alcanza con `membresias.curso_id`:
  // ese campo guarda el curso *principal* de la venta, y una membresía de plan
  // multi-curso (o una prueba de varios cursos) vive en `membresia_cursos`.
  // Filtrando solo por `curso_id`, un alumno con un plan de 5 cursos aparecía
  // en el padrón de uno y era invisible en los otros cuatro.
  const { data: icCurso, error: errIC } = await sb
    .from("membresia_cursos")
    .select("membresia_id, dias, fecha")
    .eq("curso_id", cursoId);
  if (errIC) return { ...vacio, error: `No se pudo leer qué alumnos toma este curso: ${errIC.message}` };
  const icRows =
    (icCurso as { membresia_id: number; dias: number[] | null; fecha: string | null }[]) ?? [];
  const diasPorInsc = new Map<number, number[]>();
  // Una prueba tiene UNA clase en este curso, en una fecha elegida al vender
  // (0024): figura ese día y ningún otro, aunque el curso se dicte dos veces
  // por semana.
  const fechaPruebaPorInsc = new Map<number, string>();
  for (const r of icRows) {
    if (r.dias?.length) diasPorInsc.set(r.membresia_id, r.dias);
    if (r.fecha) fechaPruebaPorInsc.set(r.membresia_id, r.fecha.slice(0, 10));
  }
  const idsPorCurso = [...new Set(icRows.map((r) => r.membresia_id))];

  const COLS =
    "id, alumno_id, estado, modalidad, fecha_inicio, clases_total, plan_id, clases_plan, fecha_fin, tolerancia_faltas, bono_generado, es_prueba, acompanantes, creado_en, alumno:alumnos(id, activo, contacto:contactos(nombre, apellido))";
  // Dos lecturas y se unen por id: las que declaran este curso en
  // `membresia_cursos`, y las viejas que solo tienen `curso_id` (legado).
  const [porCursoPrincipal, porInscCursos] = await Promise.all([
    sb.from("membresias").select(COLS).eq("curso_id", cursoId).neq("estado", "baja"),
    idsPorCurso.length
      ? sb.from("membresias").select(COLS).in("id", idsPorCurso).neq("estado", "baja")
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
    alumno: { id: number; activo: boolean; contacto: { nombre: string | null; apellido: string | null } | null } | null;
  };
  const membresias = ((insc as unknown as InscRow[]) ?? []).filter((r) => r.alumno?.activo);
  /**
   * **El padrón NO mira `estado`** (regla de negocio 2). Quién figura lo decide
   * el período de la membresía y su consumo real al día que se está mirando
   * —`enPeriodo` y `cicloAgotadoAl`—, nunca el estado de la venta.
   *
   * Acá había un filtro `estado === "activa"` que contradecía la regla y al
   * comentario de treinta líneas más arriba, que trae a propósito las
   * membresías de **todas** las fechas porque "un ciclo ya completado igual
   * tenía que estar marcado en las clases que cayeron dentro de su período".
   * Con el filtro puesto, una membresía `completada` —agotada y cobrada, o sea
   * el final normal de toda venta— desaparecía del padrón de sus propias
   * clases pasadas. Al volver a una fecha vieja la clase se veía **vacía**, y
   * una clase que parece vacía se suspende "sin alumnos": eso le borra el peso
   * de esa clase al profesor en el prorrateo. Pasó con Heels en agosto.
   *
   * Lo único que se excluye es la baja, y eso ya lo hace la consulta.
   */
  const activas = membresias;

  // Historial de cada membresía sobre sesiones DICTADAS: clases consumidas
  // (presentes) y clases del ciclo ya ocurridas (presentes + faltas).
  const consumidas: Record<number, number> = {};
  const dictadasPorInsc: Record<number, number> = {};
  // Las MISMAS clases, pero con su fecha. Hacen falta para poder preguntar
  // "¿este ciclo estaba agotado **el día que estoy mirando**?". Con los totales
  // de hoy no se puede: una membresía que terminó sus 8 clases da "agotada"
  // siempre, también el 25 de agosto, cuando le faltaban tres.
  const fechasDictadas: Record<number, string[]> = {};
  const fechasPresentes: Record<number, string[]> = {};
  if (membresias.length) {
    const { data } = await sb
      .from("asistencias")
      .select("membresia_id, sesion_id, estado")
      .in("membresia_id", membresias.map((r) => r.id));
    const filasAsis = (data as { membresia_id: number | null; sesion_id: number; estado: Estado }[]) ?? [];
    const sesIds = [...new Set(filasAsis.map((f) => f.sesion_id))];
    const dictadas = new Map<number, string>(); // sesión dictada → su fecha
    if (sesIds.length) {
      const { data: ses } = await sb.from("sesiones").select("id, estado, fecha").in("id", sesIds);
      for (const s of (ses as { id: number; estado: string; fecha: string }[]) ?? [])
        if (s.estado === "dictada") dictadas.set(s.id, s.fecha);
    }
    for (const f of filasAsis) {
      if (f.membresia_id == null) continue;
      const fechaSesion = dictadas.get(f.sesion_id);
      if (!fechaSesion) continue;
      dictadasPorInsc[f.membresia_id] = (dictadasPorInsc[f.membresia_id] ?? 0) + 1;
      (fechasDictadas[f.membresia_id] ??= []).push(fechaSesion);
      if (f.estado === "presente") {
        consumidas[f.membresia_id] = (consumidas[f.membresia_id] ?? 0) + 1;
        (fechasPresentes[f.membresia_id] ??= []).push(fechaSesion);
      }
    }
  }

  /**
   * El ciclo estaba AGOTADO **al día `f`**: para esa fecha ya habían ocurrido
   * sus N clases (plan) o ya había consumido el paquete comprado (venta por
   * clase). Es lo que decide si seguía tomando clases, y va aparte de `estado`:
   * una membresía agotada pero impaga sigue `activa` (se cierra recién al
   * cobrarse) y aun así no debe seguir en el padrón.
   *
   * **Se pregunta al día, no de hoy.** Antes se comparaba contra los totales
   * actuales, y eso dejaba a una membresía terminada fuera del padrón de las
   * clases de su propio ciclo: al volver a una fecha vieja la lista salía
   * vacía. Solo cuentan las clases **anteriores** a `f` — la del propio día `f`
   * es la que se está por marcar, no puede haberla agotado.
   */
  const cicloAgotadoAl = (r: InscRow, f: string) =>
    r.clases_plan != null
      ? (fechasDictadas[r.id] ?? []).filter((x) => x < f).length >= r.clases_plan
      : r.clases_total != null &&
        (fechasPresentes[r.id] ?? []).filter((x) => x < f).length >= r.clases_total;

  /**
   * ¿Toma ESTE curso ESE día? Cuando la membresía declaró días para este curso
   * (`membresia_cursos.dias`), manda esa elección: es la misma que usa el
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
    // Al día `f`, no con el saldo de hoy: un paquete agotado en septiembre
    // igual cubría sus clases de agosto, y si no, el chip de esa fecha diría
    // "completa" con gente del padrón sin marcar.
    (r.modalidad === "mensual" || !cicloAgotadoAl(r, f));

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

  // Fechas de la ventana que no cubre ninguna membresía. Se marcan para que no
  // se confundan con "falta cargar": no hay nada que cargar ahí.
  const conSesion = new Set(winRows.map((s) => s.fecha));
  for (const d = parseISO(minVentana); fmt(d) <= hoy; d.setDate(d.getDate() + 1)) {
    const f = fmt(d);
    if (conSesion.has(f)) continue;
    if (!membresias.some((r) => cubriaLaClase(r, f))) estadosPorFecha[f] = "sin_alumnos";
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
    .select("id, estado, motivo, reemplazo_motivo, reemplazo_costo, profesor_id")
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
      .select("estado, con_licencia, membresia_id, alumno:alumnos(id, contacto:contactos(nombre, apellido))")
      .eq("sesion_id", sesion.id);
    const idsBase = new Set(alumnoIds);
    for (const r of (data as unknown as {
      estado: Estado;
      con_licencia: boolean;
      membresia_id: number | null;
      alumno: { id: number; contacto: { nombre: string | null; apellido: string | null } | null } | null;
    }[]) ?? []) {
      if (!r.alumno) continue;
      marcas[r.alumno.id] = r.estado;
      if (r.estado === "ausente" && r.con_licencia) licencias[r.alumno.id] = true;
      if (!idsBase.has(r.alumno.id))
        extrasCrudos.push({
          inscripcionId: r.membresia_id,
          alumnoId: r.alumno.id,
          apellido: r.alumno.contacto?.apellido ?? "",
          nombre: r.alumno.contacto?.nombre ?? "",
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
      .select("membresia_id, sesion_id, con_licencia")
      .eq("estado", "ausente")
      .in("membresia_id", todosInscIds);
    for (const x of (data as { membresia_id: number | null; sesion_id: number; con_licencia: boolean }[]) ?? []) {
      if (x.membresia_id == null) continue;
      faltasCicloPorInsc[x.membresia_id] = (faltasCicloPorInsc[x.membresia_id] ?? 0) + 1;
      // La falta de la sesión que se está editando no se bloquea a sí misma:
      // justo ahora se está decidiendo si es justificada o no.
      if (!x.con_licencia && x.sesion_id !== sesionId)
        faltasSinLicPrevias[x.membresia_id] = (faltasSinLicPrevias[x.membresia_id] ?? 0) + 1;
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

  // Datos de desempate para cuando el mismo alumno aparece dos veces (más
  // abajo, `filasPorAlumno`): si ya está agotada al día que se mira, y desde
  // cuándo corre. No van en `FilaAsistencia` — son de uso interno acá nomás.
  const desempatePorInsc = new Map<number, { agotada: boolean; fechaInicio: string }>();

  const filas: FilaAsistencia[] = inscripciones
    // Un ciclo agotado ya no toma clases, esté cobrado o no. Se pregunta **al
    // día que se está mirando**: el 25 de agosto un ciclo que terminó el 8 de
    // septiembre todavía estaba corriendo. Si tiene marca en esta sesión se
    // queda igual, para poder corregirla.
    .filter((r) => !cicloAgotadoAl(r, fecha) || marcas[r.alumno!.id] != null)
    .map((r) => {
      const esMensual = r.modalidad === "mensual";
      const restantes = esMensual ? null : Math.max(0, (r.clases_total ?? 0) - (consumidas[r.id] ?? 0));
      const progreso = r.clases_plan != null ? { hechas: consumidas[r.id] ?? 0, total: r.clases_plan } : null;
      desempatePorInsc.set(r.id, { agotada: cicloAgotadoAl(r, fecha), fechaInicio: r.fecha_inicio });
      return {
        inscripcionId: r.id,
        alumnoId: r.alumno!.id,
        apellido: r.alumno!.contacto?.apellido ?? "",
        nombre: r.alumno!.contacto?.nombre ?? "",
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

  // Quién tenía el curso ESE día, y con qué se puede registrar un reemplazo.
  // El titular se resuelve con el mismo criterio que usa la liquidación para
  // repartir la plata (`@/lib/asignaciones`): si discreparan, la pantalla
  // diría un nombre y se le pagaría a otro.
  const { data: asigRows } = await sb
    .from("asignaciones")
    .select(COLUMNAS_ASIGNACION)
    .eq("curso_id", cursoId);
  const asigDelDia = asignacionEnFecha((asigRows as AsignacionVigencia[]) ?? [], fecha);

  const { data: profRows } = await sb
    .from("profesores")
    .select("id, tarifa_reemplazo, contacto:contactos(nombre, apellido)")
    .eq("activo", true);
  const profesores = ((profRows as unknown as {
    id: number; tarifa_reemplazo: number | null; contacto: { nombre: string | null; apellido: string | null } | null;
  }[]) ?? [])
    .map((p) => ({
      id: p.id,
      nombre: `${p.contacto?.apellido ?? ""}, ${p.contacto?.nombre ?? ""}`,
      tarifa: p.tarifa_reemplazo == null ? null : Number(p.tarifa_reemplazo),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const { data: motRows } = await sb
    .from("catalogo_valores")
    .select("valor, etiqueta, orden, catalogo:catalogos!inner(clave)")
    .eq("catalogo.clave", "motivo_reemplazo")
    .eq("activo", true)
    .order("orden");
  const motivosReemplazo = ((motRows as unknown as { valor: string; etiqueta: string }[]) ?? []).map(
    (m) => ({ valor: m.valor, etiqueta: m.etiqueta })
  );

  // Un alumno no puede tener dos filas en el mismo padrón. `asistencias` tiene
  // unique(sesion_id, alumno_id) (0007): solo puede haber UNA marca por persona
  // y sesión, así que dos filas para el mismo alumno no son "dos cosas para
  // registrar" — son un choque. Sin este filtro, la pantalla mostraba las dos
  // (mismo `key` de React) y **guardar perdía una silenciosamente**: el Map
  // alumnoId→inscripcionId de la pantalla se queda con la última que procesa.
  //
  // Pasa cuando a un alumno se le vende una prueba de un curso en el que ya es
  // socio regular (detectado 2026-09-14 con datos de prueba: Aguilar Manuel,
  // inscripción 35 sobre el curso de la inscripción 4). `venderPrueba` ya lo
  // bloquea de acá en más; esto es la red de contención para lo anterior a ese
  // chequeo, o cualquier otro camino que produzca el mismo choque.
  //
  // Se queda con la membresía REGULAR: una prueba redundante sobre un curso ya
  // pagado no aporta nada, y es la fila que de verdad consume el ciclo del
  // alumno.
  //
  // El MISMO choque pasa con dos membresías REGULARES (una renovación: el
  // ciclo viejo ya completado + el nuevo activo) y acá el criterio de arriba
  // no alcanza — ninguna es prueba. Sin desempate propio se quedaba con la
  // PRIMERA que encontraba, sin mirar si seguía vigente (R23, encontrado con
  // datos reales el 2026-09-17: a Yubinca, en Bachata Conexión, una clase de
  // su ciclo nuevo quedó acreditada al viejo, ya cerrado). Gana la que sigue
  // vigente sobre la agotada/completada; si las dos están igual (el límite
  // exacto en que una termina y la otra empieza el mismo día), gana la que
  // arrancó después — es la que de verdad corre hoy.
  const filasPorAlumno = new Map<number, FilaAsistencia>();
  for (const f of filas) {
    const previa = filasPorAlumno.get(f.alumnoId);
    if (!previa) {
      filasPorAlumno.set(f.alumnoId, f);
      continue;
    }
    // Acá `inscripcionId` nunca es null: `filas` sale de `inscripciones`
    // (siempre con `id`), y los "extras" (que sí pueden no tenerlo) se suman
    // después de este desempate.
    const dPrevia = desempatePorInsc.get(previa.inscripcionId!)!;
    const dActual = desempatePorInsc.get(f.inscripcionId!)!;
    const prefiereActual =
      (previa.esPrueba && !f.esPrueba) ||
      (previa.esPrueba === f.esPrueba &&
        ((dPrevia.agotada && !dActual.agotada) ||
          (dPrevia.agotada === dActual.agotada && dActual.fechaInicio > dPrevia.fechaInicio)));
    if (prefiereActual) filasPorAlumno.set(f.alumnoId, f);
  }

  return {
    filas: [...filasPorAlumno.values(), ...extras].sort(compararPorApellido),
    marcas,
    licencias,
    suspendida,
    motivoSuspension,
    completada: estadosPorFecha[fecha] === "completada",
    incompleta: estadosPorFecha[fecha] === "incompleta",
    estadosPorFecha,
    titular: asigDelDia
      ? {
          id: asigDelDia.profesor_id,
          nombre:
            profesores.find((p) => p.id === asigDelDia.profesor_id)?.nombre ??
            `#${asigDelDia.profesor_id}`,
        }
      : null,
    reemplazo:
      sesion?.reemplazo_motivo != null
        ? {
            profesorId: (sesion.profesor_id as number) ?? 0,
            motivo: sesion.reemplazo_motivo as string,
            costo: Number(sesion.reemplazo_costo ?? 0),
          }
        : null,
    profesores,
    motivosReemplazo,
    error: null,
  };
}

async function deudaPorAlumno(
  sb: Awaited<ReturnType<typeof createClient>>,
  alumnoIds: number[]
): Promise<Record<number, number>> {
  const deuda: Record<number, number> = {};
  if (!alumnoIds.length) return deuda;
  const { data: inscAll } = await sb.from("membresias").select("id, alumno_id").in("alumno_id", alumnoIds);
  const inscToAlumno = new Map<number, number>(
    ((inscAll as { id: number; alumno_id: number }[]) ?? []).map((r) => [r.id, r.alumno_id])
  );
  const allInscIds = [...inscToAlumno.keys()];
  if (!allInscIds.length) return deuda;
  const { data: cuotas } = await sb
    .from("cuotas")
    .select("id, membresia_id, monto_devengado, descuento_adelanto, estado")
    .in("membresia_id", allInscIds)
    .neq("estado", "pagada");
  const cuotaRows =
    (cuotas as { id: number; membresia_id: number; monto_devengado: number; descuento_adelanto: number }[]) ?? [];
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
    const al = inscToAlumno.get(c.membresia_id);
    if (al != null && saldo > 0) deuda[al] = (deuda[al] ?? 0) + saldo;
  }
  return deuda;
}

// ── Guardar asistencia (con disparador de falta individual) ──────────────

export async function guardarAsistencia(
  e: EntradaAsistencia
): Promise<{
  ok?: true;
  resumen?: string;
  error?: string;
  /** Hay liquidaciones ya cobradas que esto va a recalcular: el host confirma. */
  requiereConfirmacion?: true;
  aviso?: string;
}> {
  if (!(await tienePermiso("asistencia", "crear")))
    return { error: "No tenés permiso para registrar asistencia." };
  if (!e.marcas.length) return { error: "No hay nada marcado." };
  const errFecha = await validarFecha(e.cursoId, e.fecha);
  if (errFecha) return { error: errFecha };

  // **Aviso, no bloqueo** (regla de negocio 16, reescrita el 2026-09-18). Si
  // esta clase entra en el ciclo de una membresía ya liquidada y cobrada,
  // guardar la va a recalcular y la diferencia va a salir como un ajuste. Eso
  // se puede hacer —lo pagado no se reescribe, se complementa— pero quien opera
  // tiene que enterarse antes, no después.
  //
  // Solo se pregunta por fechas del **mes vencido hacia atrás**, y eso no es
  // una heurística: una liquidación cubre hasta el último día del mes anterior,
  // y una clase pertenece al ciclo de su membresía, así que una clase de este
  // mes no puede estar dentro de una membresía ya liquidada. Sin este corte,
  // la consulta —que recorre todas las comisiones y los ciclos que tocan—
  // correría en cada asistencia del día a día, que es el caso más frecuente y
  // el único que tiene que ser rápido.
  if (!e.confirmado && e.fecha <= finMesVencidoISO()) {
    const tocadas = liquidacionesTocadas(await cargarImpacto(await createClient()), e.cursoId, e.fecha);
    if (tocadas.length)
      return { requiereConfirmacion: true, aviso: avisoDeImpacto(e.fecha, tocadas) };
  }

  const perfil = await obtenerPerfilActual();
  const a = admin();

  // Si esta clase ya habia devengado comision en una liquidacion ABIERTA, el
  // devengo se revierte para que se recalcule con los datos nuevos: sin eso la
  // membresia quedaria marcada como "ya devengada" y la correccion nunca
  // llegaria a la comision. Si la liquidacion ya tiene pago no se toca nada
  // aca: el desvio se compensa con un ajuste al liquidar (0044).
  const devengosRehechos = await revertirDevengosAbiertos(a, e.cursoId, e.fecha);

  const { data: curso } = await a
    .from("cursos")
    .select("id, dias_semana")
    .eq("id", e.cursoId)
    .maybeSingle();
  if (!curso) return { error: "El curso no existe." };

  // **Quién dictó la clase** (regla de negocio 20). Antes acá se estampaba el
  // profesor de la asignación ABIERTA, sin mirar la fecha de la clase: una
  // suposición, y encima la equivocada — si el titular cambió, quedaba el de
  // hoy en una clase de hace dos meses.
  const { data: asigRows } = await a
    .from("asignaciones")
    .select(COLUMNAS_ASIGNACION)
    .eq("curso_id", e.cursoId);
  const titular = asignacionEnFecha((asigRows as AsignacionVigencia[]) ?? [], e.fecha);

  const r = e.reemplazo ?? null;
  if (r) {
    if (!r.profesorId) return { error: "Elegí quién dictó la clase como reemplazante." };
    if (r.profesorId === titular?.profesor_id)
      return { error: "El reemplazante no puede ser el mismo titular del curso." };
    // El motivo decide la plata (regla 20), así que sale de un catálogo y lo
    // valida el servidor — el desplegable ayuda, no decide (calidad 6).
    const { data: mot } = await a
      .from("catalogo_valores")
      .select("valor, catalogo:catalogos!inner(clave)")
      .eq("catalogo.clave", "motivo_reemplazo")
      .eq("valor", r.motivo)
      .eq("activo", true)
      .maybeSingle();
    if (!mot) return { error: "El motivo del reemplazo no es válido." };
    if (!(Number(r.costo) >= 0)) return { error: "El monto del reemplazo no es válido." };
  } else if (!titular) {
    // Regla 20: alguien la dictó. Si el curso no tenía titular ese día y la
    // clase no se cancela, hay que decir quién la dio — si no, la plata de esa
    // clase se va a Tropicana sin que nadie lo haya decidido.
    return {
      error:
        "Este curso no tenía profesor asignado esa fecha. Registrá quién la dictó como " +
        "reemplazante, o suspendé la clase si no se dio.",
    };
  }

  // Guardar asistencia = la clase se dictó (revierte una suspensión previa).
  const { data: sesion, error: errSesion } = await a
    .from("sesiones")
    .upsert(
      {
        curso_id: e.cursoId,
        fecha: e.fecha,
        estado: "dictada",
        motivo: null,
        profesor_id: r ? r.profesorId : titular?.profesor_id ?? null,
        titular_id: titular?.profesor_id ?? null,
        reemplazo_motivo: r ? r.motivo : null,
        reemplazo_costo: r ? Number(r.costo) : null,
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

  // Quién tenía marcada esta sesión ANTES de guardar. El unique es
  // (sesion_id, alumno_id) — no incluye la membresía —, así que si el padrón
  // ahora resuelve a otra inscripción para el mismo alumno (R23: dos
  // membresías regulares, se prefiere la vigente), el upsert de abajo le
  // saca la marca a la vieja en silencio. Sin recalcularla también, se queda
  // con un contador que ya no corresponde a ninguna asistencia real.
  const { data: previas } = await a.from("asistencias").select("membresia_id").eq("sesion_id", sesionId);
  const inscIdsPrevias = ((previas as { membresia_id: number | null }[]) ?? [])
    .map((r) => r.membresia_id)
    .filter((x): x is number => x != null);

  const filas = e.marcas.map((m) => ({
    sesion_id: sesionId,
    alumno_id: m.alumnoId,
    membresia_id: m.inscripcionId,
    estado: m.estado,
    con_licencia: m.estado === "ausente" ? !!m.conLicencia : false,
  }));
  const { error: errAsis } = await a.from("asistencias").upsert(filas, { onConflict: "sesion_id,alumno_id" });
  if (errAsis) return { error: errAsis.message };

  // El fin de ciclo no se corre por faltas individuales: la falta con licencia
  // acredita un bono de tolerancia (se redime al renovar); la falta sin licencia
  // no corre nada. Solo limpiamos corrimientos 'falta' heredados de la sesión.
  await revertirCorrimientos(a, sesionId, "falta");

  // Motor: recalcular contador/"completada"/bono de las membresías tocadas —
  // las nuevas Y las que tenían la marca antes de este guardado (arriba). El
  // resumen de "completadas" solo cuenta las nuevas: una vieja que ya estaba
  // completada y solo se resincroniza no es una completación que reportar.
  const inscIdsNuevas = new Set(e.marcas.map((m) => m.inscripcionId).filter((x): x is number => x != null));
  const inscIds = new Set([...inscIdsNuevas, ...inscIdsPrevias]);
  let completadas = 0;
  for (const id of inscIds) {
    const cerrada = await recalcularMembresia(a, id);
    if (cerrada && inscIdsNuevas.has(id)) completadas++;
  }

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
    )}.${notaLic}${notaComp}${
      devengosRehechos > 0
        ? ` Se dio de baja ${plu(devengosRehechos, "una comisión ya devengada", "comisiones ya devengadas")} de una liquidación abierta: hay que volver a generarla.`
        : ""
    }`,
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
    .from("membresias")
    .select("id")
    .or("clases_plan.not.is.null,clases_total.not.is.null")
    .neq("estado", "baja");
  const ids = ((data as { id: number }[]) ?? []).map((r) => r.id);
  for (const id of ids) await recalcularMembresia(a, id);
  revalidatePath("/asistencia");
  return { ok: true, total: ids.length };
}

// ── Suspender / reabrir una clase ────────────────────────────────────────

/**
 * El núcleo de suspender una clase: crea (o reafirma) la sesión suspendida,
 * limpia sus marcas, y corre el ciclo de cada membresía mensual afectada.
 *
 * **Compartido entre dos disparadores**: la asistencia del día a día
 * (`suspenderClase`, abajo) y el cierre planificado de sala (feriados —
 * `administracion/sala/acciones.ts`). Los dos tienen que dejar exactamente el
 * mismo rastro; separarlos en dos implementaciones es la clase de duplicación
 * que termina divergiendo sola. Lo único que cambia entre los dos disparadores
 * es **qué fechas se les permite tocar** (`validarFecha`, con `permitirFutura`
 * para el cierre de sala) — esta función no valida nada, ya llega validada.
 */
export type AlumnoCorrido = { alumnoId: number; inscripcionId: number; finCicloNuevo: string | null };

export async function ejecutarSuspension(
  a: Admin,
  args: { cursoId: number; fecha: string; motivo: string; registradoPor: string | null }
): Promise<{
  sesionId: number;
  corridos: number;
  alumnosCorridos: AlumnoCorrido[];
  /** Todos los alumnos con membresía activa que tomaban esta clase, corridos o no. */
  alumnosAfectados: number[];
}> {
  // Suspender cambia cuantas clases dicto el curso, y con eso el reparto de la
  // comision (regla de negocio 10). Si el devengo esta en una liquidacion
  // abierta se revierte para que se recalcule; si ya tenia pago, no se toca:
  // la diferencia sale como ajuste al liquidar (regla 16, 0044).
  await revertirDevengosAbiertos(a, args.cursoId, args.fecha);

  // Una clase suspendida no la dictó nadie: no lleva profesor ni reemplazo.
  const { data: asigSusp } = await a
    .from("asignaciones")
    .select(COLUMNAS_ASIGNACION)
    .eq("curso_id", args.cursoId);
  const titularSusp = asignacionEnFecha((asigSusp as AsignacionVigencia[]) ?? [], args.fecha);

  const { data: sesion, error: errSesion } = await a
    .from("sesiones")
    .upsert(
      {
        curso_id: args.cursoId,
        fecha: args.fecha,
        estado: "suspendida",
        motivo: args.motivo.trim() || null,
        // Nadie la dictó: sin profesor y sin reemplazo. Si la clase venía
        // registrada con reemplazante, suspenderla lo borra — es lo correcto,
        // porque la clase deja de haber existido.
        profesor_id: null,
        titular_id: titularSusp?.profesor_id ?? null,
        reemplazo_motivo: null,
        reemplazo_costo: null,
        registrado_por: args.registradoPor,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "curso_id,fecha" }
    )
    .select("id")
    .single();
  if (errSesion) throw new Error(errSesion.message);
  const sesionId = sesion.id as number;

  // Una clase suspendida no computa asistencia: se borran marcas y se
  // rehacen los corrimientos como 'suspension' (limpiando faltas previas).
  await a.from("asistencias").delete().eq("sesion_id", sesionId);
  await revertirCorrimientos(a, sesionId);

  // Por `membresia_cursos`, no por `membresias.curso_id`: el glosario dice
  // que ese campo es un resabio mono-curso y que qué cursos toca una membresía
  // se mira ahí. La versión anterior de esta consulta usaba `curso_id` directo
  // — se corrige acá porque una membresía multi-curso que tomara esta clase se
  // habría quedado sin corrimiento y sin aviso, en silencio.
  const { data: icRows } = await a
    .from("membresia_cursos")
    .select("inscripcion:membresias!inner(id, alumno_id, modalidad, estado, fecha_inicio)")
    .eq("curso_id", args.cursoId);
  const insc = (
    (icRows as unknown as {
      inscripcion: { id: number; alumno_id: number; modalidad: string; estado: string; fecha_inicio: string };
    }[]) ?? []
  )
    .map((r) => r.inscripcion)
    .filter((r) => r.estado === "activa" && r.fecha_inicio <= args.fecha);

  let corridos = 0;
  const alumnosCorridos: AlumnoCorrido[] = [];
  for (const r of insc) {
    if (r.modalidad !== "mensual") continue; // parciales se difieren solos
    const res = await aplicarCorrimiento(a, {
      inscripcionId: r.id,
      alumnoId: r.alumno_id,
      sesionId,
      tipo: "suspension",
      fechaClase: args.fecha,
      motivo: args.motivo.trim() || null,
      registradoPor: args.registradoPor,
    });
    if (res.estado === "aplicado") {
      corridos++;
      alumnosCorridos.push({ alumnoId: r.alumno_id, inscripcionId: r.id, finCicloNuevo: res.finCicloNuevo });
    }
  }

  return {
    sesionId,
    corridos,
    alumnosCorridos,
    alumnosAfectados: [...new Set(insc.map((r) => r.alumno_id))],
  };
}

export async function suspenderClase(args: {
  cursoId: number;
  fecha: string;
  motivo: string;
}): Promise<{ ok?: true; resumen?: string; error?: string }> {
  if (!(await tienePermiso("asistencia", "crear")))
    return { error: "No tenés permiso para suspender clases." };
  const errFecha = await validarFecha(args.cursoId, args.fecha);
  if (errFecha) return { error: errFecha };

  const { data: curso } = await admin()
    .from("cursos")
    .select("id")
    .eq("id", args.cursoId)
    .maybeSingle();
  if (!curso) return { error: "El curso no existe." };

  const perfil = await obtenerPerfilActual();
  const { corridos } = await ejecutarSuspension(admin(), {
    cursoId: args.cursoId,
    fecha: args.fecha,
    motivo: args.motivo,
    registradoPor: perfil?.id ?? null,
  });

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
  // Reabrir tambien cambia el conteo de clases dictadas: mismo tratamiento.
  await revertirDevengosAbiertos(a, args.cursoId, args.fecha);
  await revertirCorrimientos(a, sesion.id);
  await a
    .from("sesiones")
    .update({ estado: "dictada", motivo: null, actualizado_en: new Date().toISOString() })
    .eq("id", sesion.id);
  revalidatePath("/asistencia");
  return { ok: true };
}
