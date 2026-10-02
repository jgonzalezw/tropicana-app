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


/**
 * Qué falta para inscribir a un plan regular. Lo intrínseco: el plan fija cuántas
 * clases (o el ciclo, si es ilimitado), y la persona elige los días de cada curso
 * y la fecha de inicio de entre las clases reales. Pantalla y servidor deciden
 * con esta función.
 */
export type EstadoVentaInscripcion = {
  contactoId: number | null;
  planId: number | null;
  /** El plan tiene N de clases (o ciclo, si es ilimitado) cargado. */
  planCompleto: boolean;
  /** Ya tiene una membresía activa de este plan. */
  yaTiene: boolean;
  /** Cantidad de (curso, día) elegidos. */
  diasElegidos: number;
  fechaInicio: string | null;
};

export function faltaParaInscripcion(e: EstadoVentaInscripcion): string | null {
  if (e.contactoId == null) return "el alumno";
  if (e.planId == null) return "el plan";
  if (!e.planCompleto) return "completar el plan (clases o ciclo) en Planes";
  if (e.yaTiene) return "otro plan: este alumno ya tiene una membresía activa de este";
  if (e.diasElegidos <= 0) return "al menos un día de clase";
  if (!e.fechaInicio) return "una fecha de inicio válida";
  return null;
}

/**
 * Qué falta para vender una clase de prueba: el plan, los cursos a probar (hasta
 * el tope del plan) y la fecha de la clase de cada uno.
 */
export type EstadoVentaPrueba = {
  contactoId: number | null;
  planId: number | null;
  cursosElegidos: number;
  /** Cuántos de los cursos elegidos no tienen fecha de clase. */
  cursosSinFecha: number;
};

export function faltaParaPrueba(e: EstadoVentaPrueba): string | null {
  if (e.contactoId == null) return "quién viene a probar";
  if (e.planId == null) return "el plan";
  if (e.cursosElegidos <= 0) return "al menos un curso para probar";
  if (e.cursosSinFecha > 0) return "la fecha de la clase de cada curso";
  return null;
}
