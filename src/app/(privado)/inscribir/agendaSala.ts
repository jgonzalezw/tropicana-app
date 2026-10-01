/**
 * Piezas compartidas por las ventas que agendan sala: particulares (H2) y
 * alquiler (H7). Salieron de `acciones.ts` para no copiarlas: son las mismas
 * fechas, el mismo formato de agenda y **la misma validación de choques** —
 * una sala no se vende dos veces, sea para una clase o para un alquiler.
 *
 * No es un archivo `"use server"` a propósito: son helpers del servidor, no
 * acciones que el navegador pueda invocar.
 */
import type { createAdminClient } from "@/lib/supabase/admin";
import { obtenerParametro } from "@/lib/sesion";
import { isoFecha } from "@/lib/inscripcion";
import { COLS_VIGENCIA } from "@/lib/vigencia";
import { validarReservaSala, ocupacionDeProfesor, ocupaAhora, FILTRO_ESTADOS_QUE_LIBERAN } from "@/lib/reservas";
import {
  ocupacionDelDia,
  type CursoOcupa,
  type ExcepcionHorario,
  type FranjaPatron,
  type ReservaSalaOcupa,
} from "@/lib/sala";
import { COLUMNAS_ASIGNACION } from "@/lib/asignaciones";

type ClienteAdmin = NonNullable<ReturnType<typeof createAdminClient>>;

export function parseFechaISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Hoy a medianoche local (para comparar contra fechas ISO sin hora). */
export function hoyLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function agregarA<K>(mapa: Map<K, Set<number>>, clave: K, valor: number): void {
  const set = mapa.get(clave) ?? new Set<number>();
  set.add(valor);
  mapa.set(clave, set);
}

/** Las próximas fechas (incluida `desde`) en que cae alguno de `diasSemana`
 *  (1=lun..7=dom), hasta juntar `sesiones` fechas. Tope de 400 días, igual
 *  que el resto del motor: una plantilla sin ningún día elegible no puede
 *  colgar el servidor buscando para siempre. */
export function fechasAgendaFija(diasSemana: number[], desde: Date, sesiones: number): string[] {
  const out: string[] = [];
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  for (let i = 0; i < 400 && out.length < sesiones; i++) {
    const dow = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (diasSemana.includes(dow)) out.push(isoFecha(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

const DIAS_ABREV = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/** Lista legible de fechas/horas ("lun 29/09 18:00, mié 01/10 18:00, …"), para
 *  el mensaje de confirmación (detallar la agenda completa, no solo "primera
 *  clase + N más" — ver hallazgo del 26/09) y para listar los choques de la
 *  agenda fija. */
export function formatearAgenda(sesiones: { fecha: string; hora: string }[]): string {
  return sesiones
    .map((s) => {
      const d = parseFechaISO(s.fecha)!;
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${DIAS_ABREV[dow]} ${dd}/${mm} ${s.hora.slice(0, 5)}`;
    })
    .join(", ");
}

export type SesionAgendaEvaluada = { fecha: string; hora: string; duracionMin: number; ok: boolean; motivo?: string };
export type SesionPedida = { fecha: string; hora: string; duracionMin: number };

/**
 * Evalúa **cada** sesión contra la disponibilidad real, sin cortar en el
 * primer choque (así la pantalla puede mostrar el calendario completo con qué
 * está libre y qué no — "elegir de slots disponibles sin prueba y error",
 * Javier 26/09). Mira el horario base de la sala, sus cursos, las reservas y
 * los bloqueos; y, si la venta lleva profesor, también su agenda (siempre,
 * incluso con sala externa). Un alquiler no tiene profesor: `profesorId: null`.
 */
export async function evaluarSesiones(
  a: ClienteAdmin,
  e: {
    salaId: number;
    esExterna: boolean;
    profesorId: number | null;
    sesiones: SesionPedida[];
    personas: number;
  }
): Promise<SesionAgendaEvaluada[]> {
  const { salaId, esExterna, profesorId, personas } = e;
  const sesionesPedidas = e.sesiones;
  const incrementoMin = Math.max(1, Number(await obtenerParametro("tiempos_incremento_min")) || 30);
  const minimoMin = Math.max(1, Number(await obtenerParametro("duracion_minima_curso_min")) || 30);
  const fechasUnicas = [...new Set(sesionesPedidas.map((s) => s.fecha))];

  // ── Datos para validar la sala (si es propia) ──────────────────────────
  let patronSala: FranjaPatron[] = [];
  let excepcionesSala: ExcepcionHorario[] = [];
  let cursosSala: CursoOcupa[] = [];
  const reservasSalaPorFecha = new Map<string, ReservaSalaOcupa[]>();
  const suspendidasSalaPorFecha = new Map<string, Set<number>>();
  if (!esExterna) {
    const [patronR, excR, cursosR, resR] = await Promise.all([
      a.from("sala_horario_patron").select("dia_semana, desde, hasta").eq("sala_id", salaId),
      a.from("sala_horario_excepciones").select("fecha, hasta_fecha, cerrado, desde, hasta, motivo, glosa").eq("sala_id", salaId),
      a.from("cursos").select(`id, nombre, dias_semana, hora, duracion_min, sala_id, ${COLS_VIGENCIA}`).eq("sala_id", salaId).eq("activo", true),
      a
        .from("reservas_sala")
        .select("id, tipo, motivo, glosa, hora, duracion_min, fecha, estado, solicitada_hasta")
        .eq("sala_id", salaId)
        .in("fecha", fechasUnicas)
        .not("estado", "in", FILTRO_ESTADOS_QUE_LIBERAN),
    ]);
    patronSala = (patronR.data as FranjaPatron[]) ?? [];
    excepcionesSala = (excR.data as ExcepcionHorario[]) ?? [];
    cursosSala = (cursosR.data as unknown as CursoOcupa[]) ?? [];
    const ahoraSala = new Date();
    for (const r of (resR.data as (ReservaSalaOcupa & { fecha: string; estado: string; solicitada_hasta: string | null })[]) ?? []) {
      if (!ocupaAhora({ tipo: r.tipo, estado: r.estado, solicitadaHasta: r.solicitada_hasta }, ahoraSala)) continue;
      const l = reservasSalaPorFecha.get(r.fecha) ?? [];
      l.push(r);
      reservasSalaPorFecha.set(r.fecha, l);
    }
    const cursoIdsSala = cursosSala.map((c) => c.id);
    if (cursoIdsSala.length) {
      const { data: susRows } = await a
        .from("sesiones")
        .select("curso_id, fecha")
        .in("curso_id", cursoIdsSala)
        .eq("estado", "suspendida")
        .in("fecha", fechasUnicas);
      for (const s of (susRows as { curso_id: number; fecha: string }[]) ?? [])
        agregarA(suspendidasSalaPorFecha, s.fecha, s.curso_id);
    }
  }

  // ── Datos para validar al profesor (si la venta lleva uno) ─────────────
  let cursosProfesor: CursoOcupa[] = [];
  const reservasProfesorPorFecha = new Map<string, ReservaSalaOcupa[]>();
  const suspendidasProfesorPorFecha = new Map<string, Set<number>>();
  if (profesorId != null) {
    const { data: asigRows } = await a.from("asignaciones").select(COLUMNAS_ASIGNACION).eq("profesor_id", profesorId).is("hasta", null);
    const cursoIdsProfesor = ((asigRows as { curso_id: number }[]) ?? []).map((r) => r.curso_id);
    const [cursosProfR, reservasProfR] = await Promise.all([
      cursoIdsProfesor.length
        ? a.from("cursos").select(`id, nombre, dias_semana, hora, duracion_min, sala_id, ${COLS_VIGENCIA}`).in("id", cursoIdsProfesor)
        : Promise.resolve({ data: [] as unknown[] }),
      a
        .from("reservas_sala")
        .select("id, tipo, motivo, glosa, hora, duracion_min, fecha, estado, solicitada_hasta")
        .eq("profesor_id", profesorId)
        .in("fecha", fechasUnicas)
        .not("estado", "in", FILTRO_ESTADOS_QUE_LIBERAN),
    ]);
    cursosProfesor = (cursosProfR.data as unknown as CursoOcupa[]) ?? [];
    const ahoraProf = new Date();
    for (const r of (reservasProfR.data as (ReservaSalaOcupa & { fecha: string; estado: string; solicitada_hasta: string | null })[]) ?? []) {
      if (!ocupaAhora({ tipo: r.tipo, estado: r.estado, solicitadaHasta: r.solicitada_hasta }, ahoraProf)) continue;
      const l = reservasProfesorPorFecha.get(r.fecha) ?? [];
      l.push(r);
      reservasProfesorPorFecha.set(r.fecha, l);
    }
    const cursoIdsSusProf = cursosProfesor.map((c) => c.id);
    if (cursoIdsSusProf.length) {
      const { data: susRows } = await a
        .from("sesiones")
        .select("curso_id, fecha")
        .in("curso_id", cursoIdsSusProf)
        .eq("estado", "suspendida")
        .in("fecha", fechasUnicas);
      for (const s of (susRows as { curso_id: number; fecha: string }[]) ?? [])
        agregarA(suspendidasProfesorPorFecha, s.fecha, s.curso_id);
    }
  }

  return sesionesPedidas.map((s) => {
    const ocupadosSala = esExterna
      ? []
      : ocupacionDelDia(
          cursosSala,
          reservasSalaPorFecha.get(s.fecha) ?? [],
          s.fecha,
          suspendidasSalaPorFecha.get(s.fecha) ?? new Set(),
          salaId
        );
    const ocupadosProfesor =
      profesorId == null
        ? []
        : ocupacionDeProfesor(
            cursosProfesor,
            s.fecha,
            suspendidasProfesorPorFecha.get(s.fecha) ?? new Set(),
            reservasProfesorPorFecha.get(s.fecha) ?? []
          );
    const v = validarReservaSala({
      fecha: s.fecha,
      hora: s.hora,
      duracionMin: s.duracionMin,
      incrementoMin,
      minimoMin,
      personas,
      sala: { esExterna, capacidad: null },
      patron: patronSala,
      excepciones: excepcionesSala,
      ocupadosSala,
      ocupadosProfesor,
    });
    return v.ok ? { ...s, ok: true } : { ...s, ok: false, motivo: v.motivo };
  });
}
