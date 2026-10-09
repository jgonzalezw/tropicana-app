/**
 * Validar sala + profesor para una franja dada — compartido entre las
 * acciones de particulares (crear, reprogramar, revertir una suspensión) y
 * las de sala (bloqueo que pisa una reserva, cierre que la suspende, H4).
 *
 * **Extraído de `particulares/acciones.ts`** (H4): la carga de contexto
 * (horario, cursos, reservas de la sala y del profesor) y la validación en sí
 * eran privadas ahí, pero H4 necesita exactamente la misma lógica desde
 * `administracion/sala/acciones.ts` y `sala/acciones.ts` — en vez de
 * duplicarla, vive en un módulo aparte, sin `"use server"` (no son Server
 * Actions, son funciones de datos que cualquier acción del servidor importa).
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { obtenerParametro } from "@/lib/sesion";
import { exigir } from "@/lib/datos";
import { COLS_VIGENCIA } from "@/lib/vigencia";
import { COLUMNAS_ASIGNACION } from "@/lib/asignaciones";
import type { CursoOcupa, ExcepcionHorario, FranjaPatron, ResultadoHorario } from "@/lib/sala";
import { FILTRO_ESTADOS_QUE_LIBERAN, validarReservaSala } from "@/lib/reservas";
import { bloquesDelContexto, type ContextoValidacion, type ReservaConEstado } from "@/lib/ocupacionSemana";

// La ocupación del día vive en `lib/ocupacionSemana` (la hoja de franjas la arma en el navegador);
// acá se re-exporta para las acciones que ya la importan de este módulo.
export { bloquesDelContexto };
export type { ContextoValidacion };

export type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Trae todo lo que hace falta para validar una franja: horario/ocupación de
 *  la sala (si es propia) y del profesor, ya con los estados que liberan
 *  (`ESTADOS_QUE_LIBERAN`) afuera de la consulta. `excluirReservaId` se usa
 *  al reprogramar o revertir: la reserva no puede chocar consigo misma. */
export async function cargarContextoValidacion(
  a: Admin,
  salaId: number | null,
  /** `null` en un alquiler: no tiene profesor, solo se valida la sala. */
  profesorId: number | null,
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
  let reservasSala: ReservaConEstado[] = [];
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
    // Un fallo no se disfraza de ausencia (calidad 1): sin el horario o sin las
    // excepciones, la sala parecería cerrada o libre y la validación mentiría.
    patronSala = exigir(patronR, "el horario semanal de la sala") as FranjaPatron[];
    excepcionesSala = exigir(excR, "las excepciones del horario de la sala") as ExcepcionHorario[];
    cursosSala = exigir(cursosR, "los cursos de la sala") as unknown as CursoOcupa[];
    reservasSala = exigir(resR, "las reservas de la sala") as unknown as ReservaConEstado[];

    const cursoIds = cursosSala.map((c) => c.id);
    if (cursoIds.length) {
      const { data: susRows, error: errSusSala } = await a
        .from("sesiones")
        .select("curso_id")
        .in("curso_id", cursoIds)
        .eq("estado", "suspendida")
        .eq("fecha", fecha);
      const susSala = exigir({ data: susRows, error: errSusSala }, "las clases suspendidas de la sala") as { curso_id: number }[];
      suspendidasSala = new Set(susSala.map((s) => s.curso_id));
    }
  }

  let cursosProfesor: CursoOcupa[] = [];
  let reservasProfesor: ReservaConEstado[] = [];
  let suspendidasProfesor = new Set<number>();

  if (profesorId != null) {
    const { data: asigRows, error: errAsig } = await a.from("asignaciones").select(COLUMNAS_ASIGNACION).eq("profesor_id", profesorId).is("hasta", null);
    const cursoIdsProfesor = (exigir({ data: asigRows, error: errAsig }, "las asignaciones del profesor") as { curso_id: number }[]).map(
      (r) => r.curso_id
    );
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
    cursosProfesor = exigir(cursosProfR as Parameters<typeof exigir>[0], "los cursos del profesor") as unknown as CursoOcupa[];
    reservasProfesor = exigir(reservasProfR, "la agenda del profesor") as unknown as ReservaConEstado[];

    const cursoIdsSusProf = cursosProfesor.map((c) => c.id);
    if (cursoIdsSusProf.length) {
      const { data: susRows, error: errSusProf } = await a
        .from("sesiones")
        .select("curso_id")
        .in("curso_id", cursoIdsSusProf)
        .eq("estado", "suspendida")
        .eq("fecha", fecha);
      const susProf = exigir({ data: susRows, error: errSusProf }, "las clases suspendidas del profesor") as { curso_id: number }[];
      suspendidasProfesor = new Set(susProf.map((s) => s.curso_id));
    }
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

/**
 * `cargarContextoValidacion` para las acciones: si una lectura falla, devuelve
 * el error como texto para el panel rojo de siempre, en vez de dejar caer la
 * acción con una excepción. Nada se guarda: la validación no se pudo hacer.
 */
export async function cargarContextoOError(
  ...args: Parameters<typeof cargarContextoValidacion>
): Promise<{ ctx: ContextoValidacion; error?: undefined } | { ctx?: undefined; error: string }> {
  try {
    return { ctx: await cargarContextoValidacion(...args) };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    return { error: `No se pudo validar el horario de la sala, así que no se guardó nada. ${detalle}. Probá de nuevo; si se repite, avisá.` };
  }
}

export function validarFranja(
  ctx: ContextoValidacion,
  fecha: string,
  hora: string,
  duracionMin: number,
  esExterna: boolean,
  personas: number | undefined,
  ahora: Date
): ResultadoHorario {
  const { ocupadosSala, ocupadosProfesor } = bloquesDelContexto(ctx, fecha, ahora, esExterna);
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
