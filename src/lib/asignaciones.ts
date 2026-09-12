/**
 * Quién tenía un curso a su cargo en una fecha.
 *
 * **Existe para que haya una sola respuesta.** La pantalla de asistencia
 * muestra el titular del día y la liquidación reparte la plata por el titular
 * del día: si cada una lo resolviera por su cuenta, podrían discrepar y nadie
 * se enteraría hasta que un profesor reclame.
 *
 * El desempate importa tanto como el criterio: hay datos con asignaciones
 * solapadas (dos filas que cubren la misma fecha), así que la elección tiene
 * que ser **determinista** — de acá sale a quién se le paga.
 */

export type AsignacionVigencia = {
  id: number;
  curso_id: number;
  profesor_id: number;
  pct_ingresos: number;
  desde: string;
  hasta: string | null;
};

/** Las columnas que hay que traer para poder resolver el titular de un día. */
export const COLUMNAS_ASIGNACION = "id, curso_id, profesor_id, pct_ingresos, desde, hasta";

/**
 * La asignación que cubría `fechaISO`, o `null` si ese día el curso no tenía
 * titular. Si varias filas cubren la fecha gana la que **empezó después**, y
 * entre esas la **abierta**, y después la de **id más alto**.
 */
export function asignacionEnFecha(
  asignaciones: AsignacionVigencia[],
  fechaISO: string
): AsignacionVigencia | null {
  const f = fechaISO.slice(0, 10);
  const cubren = asignaciones.filter((a) => a.desde <= f && (a.hasta == null || a.hasta >= f));
  if (!cubren.length) return null;
  return cubren.sort(
    (a, b) =>
      b.desde.localeCompare(a.desde) ||
      Number(b.hasta == null) - Number(a.hasta == null) ||
      b.id - a.id
  )[0];
}

/** El titular de hoy: para decir de quién es un curso, no para repartir plata. */
export function titularVigente(asignaciones: AsignacionVigencia[]): AsignacionVigencia | null {
  const abiertas = asignaciones.filter((a) => a.hasta == null);
  if (!abiertas.length) return null;
  return abiertas.sort((a, b) => b.desde.localeCompare(a.desde) || b.id - a.id)[0];
}
