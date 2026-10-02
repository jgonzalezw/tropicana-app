/**
 * Qué falta para poder vender un alquiler de sala (C3, H7). Una sola función
 * pura, compartida por la pantalla (para deshabilitar el botón y decir qué
 * falta) y por el servidor (para decidir) — regla de calidad 9.
 *
 * Devuelve `null` si está todo; si no, **qué** falta, en el orden en que se
 * pide en la pantalla.
 */
export type EstadoVentaAlquiler = {
  contactoId: number | null;
  planId: number | null;
  horasPaqueteId: number | null;
  personas: number;
  categoria: string | null;
  /** La categoría propuesta por el sistema (para saber si se cambió a mano). */
  categoriaPropuesta: string | null;
  categoriaGlosa: string;
  salaTipo: "propia" | "externa";
  salaId: number | null;
  nombreExterna: string;
  fechaInicio: string;
  /** Agenda fija: al menos un día. Flexible: no aplica. */
  esFija: boolean;
  diasSemana: number[];
  hora: string;
  horaAlineada: boolean;
  duracionMin: number | null;
};

export function faltaParaAlquiler(e: EstadoVentaAlquiler): string | null {
  if (e.contactoId == null) return "el titular";
  if (e.planId == null) return "el plan";
  if (!e.categoria) return "la categoría del cliente";
  if (e.categoriaPropuesta && e.categoria !== e.categoriaPropuesta && !e.categoriaGlosa.trim())
    return "la glosa del cambio de categoría";
  if (!(e.personas >= 1)) return "la cantidad de personas";
  if (e.horasPaqueteId == null) return "el paquete de horas";
  if (e.salaTipo === "propia" ? e.salaId == null : !e.nombreExterna.trim())
    return e.salaTipo === "propia" ? "la sala" : "el nombre del lugar";
  if (!e.fechaInicio) return "la fecha de inicio";
  if (!e.hora || !e.horaAlineada) return "una hora de inicio alineada al intervalo";
  if (!e.duracionMin) return "la duración";
  if (e.esFija && e.diasSemana.length === 0) return "los días de la agenda fija";
  return null;
}

/**
 * Qué falta para vender una clase particular (mismo contrato que el alquiler:
 * pantalla y servidor deciden con esta función). La disponibilidad de la agenda
 * y el cobro los mira el host, que sabe del resultado de la revisión.
 */
export type EstadoVentaParticular = {
  contactoId: number | null;
  planId: number | null;
  tarifaId: number | null;
  profesorId: number | null;
  salaTipo: "propia" | "externa";
  salaId: number | null;
  nombreExterna: string;
  fechaInicio: string;
  esFija: boolean;
  diasSemana: number[];
  hora: string;
  horaAlineada: boolean;
  duracionMin: number | null;
  esCortesia: boolean;
  cortesiaMotivo: string;
};

export function faltaParaParticular(e: EstadoVentaParticular): string | null {
  if (e.contactoId == null) return "el titular";
  if (e.planId == null) return "el plan";
  if (e.tarifaId == null) return "el tramo de horas";
  if (e.esCortesia && !e.cortesiaMotivo.trim()) return "el motivo de la cortesía";
  if (e.profesorId == null) return "el profesor";
  if (e.salaTipo === "propia" ? e.salaId == null : !e.nombreExterna.trim())
    return e.salaTipo === "propia" ? "la sala" : "el nombre del lugar";
  if (!e.fechaInicio) return "la fecha de inicio";
  if (!e.hora || !e.horaAlineada) return "una hora de inicio alineada al intervalo";
  if (!e.duracionMin) return "la duración";
  if (e.esFija && e.diasSemana.length === 0) return "los días de la agenda fija";
  return null;
}
