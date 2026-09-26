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
import { COLS_VIGENCIA } from "@/lib/vigencia";
import { COLUMNAS_ASIGNACION } from "@/lib/asignaciones";
import {
  ocupacionDelDia,
  type CursoOcupa,
  type ExcepcionHorario,
  type FranjaPatron,
  type ReservaSalaOcupa,
  type ResultadoHorario,
} from "@/lib/sala";
import { FILTRO_ESTADOS_QUE_LIBERAN, ocupaAhora, ocupacionDeProfesor, validarReservaSala } from "@/lib/reservas";

export type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

type ReservaConEstado = ReservaSalaOcupa & { estado: string; solicitada_hasta: string | null };

export type ContextoValidacion = {
  /** `null` cuando la sala es externa — no se valida su horario ni choque. */
  salaId: number | null;
  incrementoMin: number;
  minimoMin: number;
  patronSala: FranjaPatron[];
  excepcionesSala: ExcepcionHorario[];
  cursosSala: CursoOcupa[];
  reservasSala: ReservaConEstado[];
  suspendidasSala: Set<number>;
  cursosProfesor: CursoOcupa[];
  reservasProfesor: ReservaConEstado[];
  suspendidasProfesor: Set<number>;
};

/** Trae todo lo que hace falta para validar una franja: horario/ocupación de
 *  la sala (si es propia) y del profesor, ya con los estados que liberan
 *  (`ESTADOS_QUE_LIBERAN`) afuera de la consulta. `excluirReservaId` se usa
 *  al reprogramar o revertir: la reserva no puede chocar consigo misma. */
export async function cargarContextoValidacion(
  a: Admin,
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
    patronSala = (patronR.data as FranjaPatron[]) ?? [];
    excepcionesSala = (excR.data as ExcepcionHorario[]) ?? [];
    cursosSala = (cursosR.data as unknown as CursoOcupa[]) ?? [];
    reservasSala = (resR.data as unknown as ReservaConEstado[]) ?? [];

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
  const reservasProfesor = (reservasProfR.data as unknown as ReservaConEstado[]) ?? [];

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

export function validarFranja(
  ctx: ContextoValidacion,
  fecha: string,
  hora: string,
  duracionMin: number,
  esExterna: boolean,
  personas: number | undefined,
  ahora: Date
): ResultadoHorario {
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
