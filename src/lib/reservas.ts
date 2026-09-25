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
 */

import {
  choquesCon,
  describirBloque,
  dentroDelHorario,
  ocupacionDeCursos,
  ocupacionDeReservas,
  type BloqueOcupado,
  type CursoOcupa,
  type ExcepcionHorario,
  type FranjaPatron,
  type ReservaSalaOcupa,
  type ResultadoHorario,
} from "./sala.ts";
import { aMinutos, esMultiploDe } from "./horarios.ts";

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
export function validarReservaSala(e: EntradaValidarReserva): ResultadoHorario {
  if (!esMultiploDe(e.duracionMin, e.incrementoMin) || e.duracionMin < e.minimoMin)
    return {
      ok: false,
      motivo: `La duración tiene que ser un múltiplo de ${e.incrementoMin} minutos, de al menos ${e.minimoMin}.`,
    };

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
