/**
 * ¿Este curso corría en esta fecha?
 *
 * **Por qué existe.** Desde que las clases se cuentan por calendario menos
 * suspendidas (regla de negocio 10), `dias_semana` genera clases hacia atrás
 * sin límite: un curso que arrancó el 31 de agosto igual "tiene" ocho clases
 * de agosto. Esas clases inventadas pesan en el prorrateo y traban
 * liquidaciones por sesiones sin registrar (regla 17), aunque nunca existieron.
 *
 * La vigencia le pone principio y fin al calendario. Javier (2026-09-12): *"Un
 * curso tiene fecha de activación y de baja. El registro de asistencia es
 * exigible solo entre esas fechas: fuera de ellas nunca se pide y nada queda
 * sin registrar."*
 *
 * **No es lo mismo que `activo`.** `activo` es un interruptor sin fecha —
 * gobierna si el curso se puede vender hoy. La vigencia gobierna el
 * calendario, que es una pregunta con fecha: *¿corría el 12 de agosto?*
 * Conviven, y cada uno manda en lo suyo.
 *
 * **Un curso que no llegó se considera vigente.** Es deliberado: negar la
 * vigencia cuando el dato no se cargó convertiría un curso no leído en un
 * curso sin clases, y el conteo caería a cero sin decir por qué — la regla de
 * calidad 1 al revés. Los llamadores cargan siempre las dos columnas; si
 * alguna vez falta, el comportamiento es el de antes de esta regla, no uno
 * peor.
 */

export type VigenciaCurso = {
  vigente_desde?: string | null;
  vigente_hasta?: string | null;
};

/** Las columnas que hay que traer en el `select` para poder preguntar. */
export const COLS_VIGENCIA = "vigente_desde, vigente_hasta";

export function enVigencia(curso: VigenciaCurso | null | undefined, fechaISO: string): boolean {
  if (!curso) return true;
  const f = fechaISO.slice(0, 10);
  const desde = curso.vigente_desde?.slice(0, 10);
  const hasta = curso.vigente_hasta?.slice(0, 10);
  if (desde && f < desde) return false;
  if (hasta && f > hasta) return false;
  return true;
}

/**
 * El motivo que ve la persona, listo para mostrar. Dice **qué pasa** y **dónde
 * se arregla**: un "no se puede" a secas manda a buscar el problema donde no
 * está (regla de calidad 1).
 *
 * Javier fue explícito sobre cuál es el arreglo: *"Si aparecen clases
 * retroactivas, la fecha de activación se corrige… que haya clase retroactiva
 * significa que sí había profesor, alumno y clase."*
 */
export function motivoFueraDeVigencia(
  nombreCurso: string,
  curso: VigenciaCurso,
  fechaISO: string
): string {
  const f = fechaISO.slice(0, 10);
  const desde = curso.vigente_desde?.slice(0, 10);
  const hasta = curso.vigente_hasta?.slice(0, 10);
  if (desde && f < desde)
    return (
      `${nombreCurso} recién corre desde el ${desde}, y esta clase es del ${f}. ` +
      `Si el curso sí se dictaba antes, corregí su fecha de activación en Cursos y volvé a intentar.`
    );
  if (hasta && f > hasta)
    return `${nombreCurso} tiene fecha de baja el ${hasta}, así que el ${f} ya no se dictaba.`;
  return `${nombreCurso} no estaba vigente el ${f}.`;
}

/** Etiqueta corta para listas y fichas: "desde 01/08/2026", "01/08 → 30/09". */
export function etiquetaVigencia(curso: VigenciaCurso): string {
  const desde = curso.vigente_desde?.slice(0, 10);
  const hasta = curso.vigente_hasta?.slice(0, 10);
  if (desde && hasta) return `${desde} → ${hasta}`;
  if (desde) return `desde ${desde}`;
  if (hasta) return `hasta ${hasta}`;
  return "sin vigencia cargada";
}
