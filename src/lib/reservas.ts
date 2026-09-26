/**
 * ¿Se puede reservar esta franja de sala? Y, si hay profesor, ¿está libre?
 *
 * **Extraída de `crearBloqueoSala`** (C3 H2): esa acción tenía la validación
 * completa escrita inline, y H2 necesitaba la misma lógica para la primera
 * reserva de una venta de particulares. En vez de duplicarla, queda acá, pura
 * y con pruebas, y las dos acciones (`crearBloqueoSala` y `venderParticular`)
 * la llaman.
 *
 * **La sala externa se saltea** (definiciones-v2, sección 9: "no se valida su
 * ocupación") — nunca choca contra horario, capacidad ni otras reservas. El
 * choque del profesor sí se valida siempre: la sala puede ser ajena a
 * Tropicana, pero el profesor sigue siendo uno solo.
 *
 * **C3 H3 (26/09/2026)** agrega acá los 7 estados de la regla de negocio 23:
 * las transiciones válidas, la vigencia de una Solicitada (se calcula al
 * leer — regla de negocio 4, "no se guarda paso a paso") y el saldo de horas
 * de una membresía de particulares.
 */

import {
  choquesCon,
  describirBloque,
  dentroDelHorario,
  impactoDeExcepcion,
  ocupacionDeCursos,
  ocupacionDeReservas,
  type BloqueOcupado,
  type CursoOcupa,
  type ExcepcionHorario,
  type FranjaPatron,
  type ReservaSalaOcupa,
  type ResultadoHorario,
} from "./sala.ts";
import { aMinutos, esMultiploDe, formatearHoras, horaAlineada, seSolapan } from "./horarios.ts";

/** Todo lo que ocupa el tiempo de un profesor una fecha dada: sus cursos
 *  regulares (de cualquier sala) más sus propias reservas. A diferencia de
 *  `ocupacionDelDia` (que filtra por sala), acá no importa la sala: un
 *  profesor no puede estar en dos lugares a la vez. */
export function ocupacionDeProfesor(
  cursosDelProfesor: CursoOcupa[],
  fechaISO: string,
  cursosSuspendidos: Set<number>,
  reservasDelProfesor: ReservaSalaOcupa[],
  etiquetaMotivo?: (valor: string) => string
): BloqueOcupado[] {
  const deCursos = ocupacionDeCursos(cursosDelProfesor, fechaISO, cursosSuspendidos);
  const deReservas = ocupacionDeReservas(reservasDelProfesor, etiquetaMotivo);
  return [...deCursos, ...deReservas].sort((a, b) => (aMinutos(a.hora) ?? 0) - (aMinutos(b.hora) ?? 0));
}

export type EntradaValidarReserva = {
  fecha: string;
  hora: string;
  duracionMin: number;
  /** `tiempos_incremento_min` (0039): el mismo incremento en toda la app. */
  incrementoMin: number;
  /** `duracion_minima_curso_min` (0039). */
  minimoMin: number;
  /** Cuántas personas van a esa sesión, para chequear contra la capacidad. */
  personas?: number;
  sala: {
    /** Definiciones-v2, sección 9: la externa no se valida — ni horario, ni
     *  capacidad, ni choque de sala. */
    esExterna: boolean;
    /** `null` = sin capacidad cargada, no se valida. */
    capacidad: number | null;
  };
  /** Horario base de la sala (C1). Se ignora si `sala.esExterna`. */
  patron: FranjaPatron[];
  excepciones: ExcepcionHorario[];
  /** Lo que ya ocupa la sala esa fecha (cursos + reservas, vía
   *  `ocupacionDelDia`). Se ignora si `sala.esExterna`. */
  ocupadosSala: BloqueOcupado[];
  etiquetaMotivoExcepcion?: (valor: string) => string;
  /** Lo que ya ocupa al profesor esa fecha (vía `ocupacionDeProfesor`).
   *  Sin profesor, no se valida ningún choque de agenda personal. */
  ocupadosProfesor?: BloqueOcupado[];
};

/**
 * Devuelve `{ ok: true }` si la franja se puede reservar, o `{ ok: false,
 * motivo }` con la razón exacta y, cuando aplica, con qué choca — nunca un
 * "no se puede" a secas (regla de calidad 1 y 5).
 */
/**
 * La regla de tiempos de una reserva (Javier, 2026-09-26): la **duración** va
 * en múltiplos del mínimo (`duracion_minima_curso_min`) y la **hora de
 * inicio** en múltiplos del intervalo estándar (`tiempos_incremento_min`).
 * Pura y compartida: la pantalla la usa para deshabilitar el botón y decir
 * qué falta, el servidor para decidir (regla de calidad 9).
 */
export function validarTiempoReserva(e: {
  hora: string;
  duracionMin: number;
  incrementoMin: number;
  minimoMin: number;
}): string | null {
  if (aMinutos(e.hora) == null) return "La hora no es válida.";
  if (!horaAlineada(e.hora, e.incrementoMin))
    return `La hora de inicio tiene que caer en intervalos de ${e.incrementoMin} minutos (ej. 18:00${
      e.incrementoMin < 60 ? `, 18:${String(e.incrementoMin).padStart(2, "0")}` : ""
    }).`;
  if (!esMultiploDe(e.duracionMin, e.minimoMin))
    return `La duración tiene que ser un múltiplo de ${formatearHoras(e.minimoMin / 60)} h (la duración mínima de una reserva).`;
  return null;
}

export function validarReservaSala(e: EntradaValidarReserva): ResultadoHorario {
  const tiempo = validarTiempoReserva(e);
  if (tiempo) return { ok: false, motivo: tiempo };

  if (!e.sala.esExterna) {
    if (e.sala.capacidad != null && e.personas != null && e.personas > e.sala.capacidad)
      return {
        ok: false,
        motivo: `La sala tiene capacidad para ${e.sala.capacidad} persona(s) y se pidieron ${e.personas}.`,
      };

    const horario = dentroDelHorario(e.patron, e.excepciones, e.fecha, e.hora, e.duracionMin, e.etiquetaMotivoExcepcion);
    if (!horario.ok) return horario;

    const choques = choquesCon(e.ocupadosSala, e.hora, e.duracionMin);
    if (choques.length)
      return {
        ok: false,
        motivo: `La sala ya está ocupada en ese horario: choca con ${choques.map(describirBloque).join(", ")}.`,
      };
  }

  if (e.ocupadosProfesor) {
    const choquesProfesor = choquesCon(e.ocupadosProfesor, e.hora, e.duracionMin);
    if (choquesProfesor.length)
      return {
        ok: false,
        motivo: `El profesor ya tiene algo agendado en ese horario: choca con ${choquesProfesor
          .map(describirBloque)
          .join(", ")}.`,
      };
  }

  return { ok: true };
}

// ── Los 7 estados de una reserva (C3, hito H3) ─────────────────────────────
//
// Valen para tipo 'particular' | 'alquiler' | 'taller'. Los bloqueos (D7)
// siguen aparte, con su propio par 'reservada'/'cancelada' — no son parte de
// esta máquina de estados.

export const ESTADOS_RESERVA = [
  "solicitada",
  "confirmada",
  "reprogramada",
  "reagendar",
  "suspendida",
  "ausente",
  "realizada",
] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

export const ETIQUETA_ESTADO_RESERVA: Record<EstadoReserva, string> = {
  solicitada: "Solicitada",
  confirmada: "Confirmada",
  reprogramada: "Reprogramada",
  reagendar: "Reagendar",
  suspendida: "Suspendida",
  ausente: "Ausente",
  realizada: "Realizada",
};

/**
 * Estados que de verdad ocupan la sala y al profesor (definiciones-v2 8.2):
 * es el mismo criterio que el EXCLUDE de la base (migración 0054) — sin
 * incluir 'solicitada', que ocupa por código mientras está vigente, no por
 * el estado en sí (ver `ocupaAhora`).
 */
export const ESTADOS_QUE_OCUPAN: readonly EstadoReserva[] = [
  "confirmada",
  "reprogramada",
  "ausente",
  "realizada",
];

/** Los mismos 4 estados, nombrados por lo que hacen con el saldo de horas
 *  (definiciones-v2 8.2: "Consumida"/"Consume la sesión"). Es un alias
 *  intencional de `ESTADOS_QUE_OCUPAN` — hoy coinciden, y se nombran las dos
 *  cosas por separado porque son dos preguntas distintas (¿ocupa un recurso
 *  físico? ¿gastó una sesión del paquete?) que en H3 dan la misma respuesta. */
export const ESTADOS_QUE_CONSUMEN: readonly EstadoReserva[] = ESTADOS_QUE_OCUPAN;

/** Estados que liberan sala y profesor: la sesión vuelve al saldo y hace
 *  falta una reserva nueva para recuperarla (definiciones-v2 8.2). Junto con
 *  'cancelada' (el único estado que libera un *bloqueo*), es el filtro único
 *  que reemplaza el viejo `.neq('estado', 'cancelada')` en las consultas de
 *  ocupación: un bloqueo cancelado y una reserva Reagendar/Suspendida dejan
 *  de ocupar por el mismo motivo, aunque tengan nombres de estado distintos. */
export const ESTADOS_QUE_LIBERAN = ["cancelada", "reagendar", "suspendida"] as const;

/** `ESTADOS_QUE_LIBERAN` ya armado para `.not("estado", "in", ...)` de
 *  supabase-js — para no repetir el `join`/paréntesis en cada consulta. */
export const FILTRO_ESTADOS_QUE_LIBERAN = `(${ESTADOS_QUE_LIBERAN.join(",")})`;

/**
 * Las transiciones válidas desde cada estado. `solicitada`/`confirmada` son
 * las altas; `reagendar` y `suspendida` son finales — lo que sigue es una
 * reserva NUEVA, no reabrir esta (definiciones-v2 8.2). `ausente`⇄`realizada`
 * es la única corrección permitida, para cuando se marcó el estado que no era.
 */
export const TRANSICIONES: Record<EstadoReserva, readonly EstadoReserva[]> = {
  solicitada: ["confirmada", "reagendar", "suspendida"],
  confirmada: ["reprogramada", "reagendar", "suspendida", "ausente", "realizada"],
  reprogramada: ["reprogramada", "reagendar", "suspendida", "ausente", "realizada"],
  reagendar: [],
  suspendida: [],
  ausente: ["realizada"],
  realizada: ["ausente"],
};

export function puedeTransicionar(actual: EstadoReserva, destino: EstadoReserva): boolean {
  return TRANSICIONES[actual].includes(destino);
}

/**
 * ¿Sigue vigente una Solicitada? Se calcula contra `ahora` — nunca se guarda
 * un booleano "vencida" en la fila (regla de negocio 4: como el fin de
 * ciclo, esto se recalcula al leer, no paso a paso).
 */
export function solicitudVigente(solicitadaHasta: string | null, ahora: Date): boolean {
  if (!solicitadaHasta) return false;
  return new Date(solicitadaHasta).getTime() > ahora.getTime();
}

/** Lo mínimo de una reserva para saber si ocupa un recurso ahora mismo.
 *  `tipo` acepta el `TipoOcupacion` de `sala.ts` (incluye `"curso"`, que
 *  nunca aparece en una fila de `reservas_sala` pero sí en el tipo genérico
 *  que devuelven esas consultas) para no forzar un cast en cada llamada. */
export type ReservaOcupaEntrada = {
  tipo: "particular" | "alquiler" | "taller" | "bloqueo" | "curso";
  estado: string;
  solicitadaHasta?: string | null;
};

/**
 * ¿Esta reserva ocupa sala/profesor en este instante? Un bloqueo ocupa
 * mientras esté 'reservada'; las demás, en los `ESTADOS_QUE_OCUPAN`, o en
 * 'solicitada' mientras no haya vencido su validez (decisión de Javier,
 * 25/09: "no tiene sentido... que cuando todo esté coordinado el espacio
 * horario ya se asignó a otra persona").
 */
export function ocupaAhora(r: ReservaOcupaEntrada, ahora: Date): boolean {
  if (r.tipo === "bloqueo") return r.estado === "reservada";
  if ((ESTADOS_QUE_OCUPAN as string[]).includes(r.estado)) return true;
  if (r.estado === "solicitada") return solicitudVigente(r.solicitadaHasta ?? null, ahora);
  return false;
}

export type ResultadoCancelacion = { destino: "reagendar" | "ausente"; fueraDePlazo: boolean };

/**
 * Cancelar a pedido del alumno (definiciones-v2, 8.3). Dentro del plazo de
 * anticipación (parámetro `reserva_cancelacion_plazo_horas`, hoy 8 h) pasa a
 * Reagendar y la sesión vuelve al saldo; fuera de plazo, la sesión se da por
 * consumida (Ausente) con la marca de incumplimiento. Son los mismos 2
 * estados finales de siempre — nunca un octavo estado (decisión de Javier,
 * 25/09).
 */
export function evaluarCancelacion(ahora: Date, inicioReserva: Date, plazoHoras: number): ResultadoCancelacion {
  const horasDeAnticipacion = (inicioReserva.getTime() - ahora.getTime()) / (1000 * 60 * 60);
  return horasDeAnticipacion >= plazoHoras
    ? { destino: "reagendar", fueraDePlazo: false }
    : { destino: "ausente", fueraDePlazo: true };
}

export type SaldoEntrada = {
  /** `membresias.horas_contratadas` (decimal, ver `formatearHoras`). */
  horasContratadas: number;
  reservas: { estado: string; duracion_min: number; solicitada_hasta?: string | null }[];
  ahora: Date;
};

export type SaldoMembresia = {
  contratadasMin: number;
  consumidasMin: number;
  solicitadasVigentesMin: number;
  /** Contratadas − consumidas: lo que todavía no pasó, sin descontar las
   *  Solicitadas vigentes — es lo que muestra "sin agendar" en la pantalla. */
  sinAgendarMin: number;
  /** `sinAgendarMin` − las Solicitadas vigentes: lo que de verdad se puede
   *  pedir ahora (decisión de Javier, 26/09: el saldo cuenta las Solicitadas
   *  vigentes, para no dejar pedir más horas de las que quedan). */
  disponibleMin: number;
};

/**
 * El saldo de horas de una membresía de particulares/alquiler, calculado
 * sobre sus reservas — nunca guardado paso a paso (regla de negocio 23: "el
 * saldo se calcula desde las reservas").
 */
export function saldoMembresia(e: SaldoEntrada): SaldoMembresia {
  const contratadasMin = Math.round(e.horasContratadas * 60);
  const consumidasMin = e.reservas
    .filter((r) => (ESTADOS_QUE_CONSUMEN as string[]).includes(r.estado))
    .reduce((acc, r) => acc + r.duracion_min, 0);
  const solicitadasVigentesMin = e.reservas
    .filter((r) => r.estado === "solicitada" && solicitudVigente(r.solicitada_hasta ?? null, e.ahora))
    .reduce((acc, r) => acc + r.duracion_min, 0);
  const sinAgendarMin = Math.max(0, contratadasMin - consumidasMin);
  const disponibleMin = Math.max(0, sinAgendarMin - solicitadasVigentesMin);
  return { contratadasMin, consumidasMin, solicitadasVigentesMin, sinAgendarMin, disponibleMin };
}

// ── Cierres de sala sobre reservas (C3, hito H4) ────────────────────────────

/** Lo mínimo de una reserva confirmada/reprogramada para saber si un cierre
 *  o un horario reducido la afecta, y para poder mostrarla en la lista de
 *  confirmación con quién y cuándo. */
export type ReservaOcupanteExcepcion = {
  reservaId: number;
  fecha: string;
  hora: string;
  duracionMin: number;
  etiqueta: string;
  detalle: string | null;
};

export type ReservaAfectadaPorExcepcion = ReservaOcupanteExcepcion & {
  motivoImpacto: "cierre" | "horario_reducido";
};

/**
 * Qué reservas de particular/alquiler ya **confirmadas** (`confirmada` o
 * `reprogramada`: las únicas que de verdad ocupan la sala hoy — regla de
 * negocio 23) caen dentro de las excepciones que se están por guardar. Es el
 * lado reservas de C5 (ROADMAP R1), con el mismo criterio cierre/horario
 * reducido que `clasesAfectadasPorExcepciones` (`@/lib/sala`).
 *
 * Solo recibe reservas que ya vienen filtradas por sala y por esos dos
 * estados: acá no se vuelve a filtrar, para no duplicar el criterio de qué
 * ocupa (`ESTADOS_QUE_OCUPAN`) en dos lugares.
 */
export function reservasAfectadasPorExcepciones(
  reservas: ReservaOcupanteExcepcion[],
  excepciones: ExcepcionHorario[]
): ReservaAfectadaPorExcepcion[] {
  return reservas.flatMap((r) => {
    const impacto = impactoDeExcepcion(r.fecha, r.hora, r.duracionMin, excepciones);
    if (!impacto.afectada) return [];
    return [{ ...r, motivoImpacto: impacto.motivo! }];
  });
}

/**
 * De un grupo de reservas ya ocupantes (mismo criterio que arriba), cuáles
 * chocan con la franja de un bloqueo nuevo. Se usa cuando un bloqueo pisa una
 * particular/alquiler: en vez de rechazarlo de una, se lista qué se tendría
 * que suspender primero (H4).
 */
export function reservasQueChocanCon<T extends { hora: string; duracionMin: number }>(
  reservas: T[],
  hora: string,
  duracionMin: number
): T[] {
  return reservas.filter((r) => seSolapan(hora, duracionMin, r.hora, r.duracionMin));
}
