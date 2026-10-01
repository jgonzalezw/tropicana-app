/**
 * Desasignar a un profesor de un curso a partir de una fecha.
 *
 * La fecha que se digita es el **último día que el profesor tuvo el curso a su
 * cargo** (`asignaciones.hasta`, inclusive: `asignacionEnFecha` cubre `hasta`).
 * Un sustituto, si corresponde, empieza **el día siguiente**.
 *
 * Una sola función de validación, compartida por la pantalla (para deshabilitar
 * el botón y decir qué falta) y el servidor (para decidir) — regla de calidad 9.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function esFechaISO(s: string): boolean {
  if (!ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** El día siguiente a `fechaISO` (calendario, sin zonas horarias). */
export function diaSiguiente(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type DatosSustituto = {
  profesorId: number | null;
  pctIngresos: number;
  pctReferido: number;
};

export type EntradaDesasignacion = {
  /** Cuándo empezó la asignación que se cierra. */
  desde: string;
  /** La asignación tiene que estar abierta. */
  hasta: string | null;
  /** Profesor que se desasigna, para que el sustituto no sea el mismo. */
  profesorId: number;
  fecha: string;
  /** Si se define un sustituto (`null` = el curso queda sin titular). */
  sustituto: DatosSustituto | null;
};

/** `null` si se puede; si no, qué falta o qué está mal, en palabras de la pantalla. */
export function validarDesasignacion(e: EntradaDesasignacion): string | null {
  if (e.hasta != null) return "Esta asignación ya está cerrada.";
  if (!e.fecha) return "Indicá el último día que el profesor tuvo el curso a su cargo.";
  if (!esFechaISO(e.fecha)) return "La fecha no es válida.";
  if (e.fecha < e.desde)
    return `La fecha no puede ser anterior al inicio de la asignación (${e.desde}).`;
  if (e.sustituto) {
    const s = e.sustituto;
    if (s.profesorId == null) return "Elegí el profesor sustituto, o dejá el curso sin titular.";
    if (s.profesorId === e.profesorId) return "El sustituto no puede ser el mismo profesor.";
    if (!(s.pctIngresos >= 1 && s.pctIngresos <= 100))
      return "El % sobre los ingresos del sustituto tiene que estar entre 1 y 100.";
    if (!(s.pctReferido >= 0 && s.pctReferido <= 100))
      return "El % por referido del sustituto tiene que estar entre 0 y 100.";
  }
  return null;
}

/** El día anterior a `fechaISO` (calendario, sin zonas horarias). */
export function diaAnterior(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type AsignacionDelCurso = { desde: string; hasta: string | null };

/**
 * Asignar un profesor a un curso desde `desde` (hoy por defecto en pantalla).
 * La abierta, si hay, se cierra el día anterior; no se admite empezar antes de
 * que termine una ya cerrada ni antes del inicio de la abierta (se pisarían las
 * clases de quien dictó, regla 10). Un hueco entre la baja y el inicio es válido:
 * el curso queda sin titular esos días.
 */
export function validarAsignacionNueva(e: { desde: string; asignaciones: AsignacionDelCurso[] }): string | null {
  if (!e.desde) return "Indicá desde qué fecha empieza a cargo del curso.";
  if (!esFechaISO(e.desde)) return "La fecha de inicio no es válida.";
  for (const a of e.asignaciones) {
    if (a.hasta != null && e.desde <= a.hasta)
      return `La fecha de inicio tiene que ser posterior al ${a.hasta}, cuando terminó otra asignación del curso.`;
    if (a.hasta == null && e.desde <= a.desde)
      return `La fecha de inicio tiene que ser posterior al ${a.desde}, cuando empezó la asignación vigente.`;
  }
  return null;
}
