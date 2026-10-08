import { caminarClases, sumarDiasISO } from "./calendarioCiclo.ts";

/**
 * Bono de tolerancia POR CURSO (I-003, D35, regla de negocio 6).
 *
 * Funciones puras: las usan el motor (`recalcularMembresia`), la venta y el
 * estado de cuenta sin duplicar la regla, y se prueban sin base.
 */

export type AsistenciaDeCurso = {
  curso_id: number;
  estado: "presente" | "ausente";
  con_licencia: boolean;
};

export type BonoCurso = { curso_id: number; clases: number };

/**
 * Bono que genera cada curso: faltas **con** licencia de ese curso, con el tope
 * de la tolerancia por curso, y 0 si hubo una sola falta **sin** licencia en
 * **ese** curso. Un curso sin bono no aparece. Recibe solo clases dictadas.
 */
export function bonosPorCurso(dictadas: AsistenciaDeCurso[], tolerancia: number): BonoCurso[] {
  const tope = Math.max(0, tolerancia);
  const por = new Map<number, { conLic: number; sinLic: number }>();
  for (const r of dictadas) {
    if (r.estado === "presente") continue;
    const c = por.get(r.curso_id) ?? { conLic: 0, sinLic: 0 };
    if (r.con_licencia) c.conLic++;
    else c.sinLic++;
    por.set(r.curso_id, c);
  }
  const out: BonoCurso[] = [];
  for (const [curso_id, c] of por) {
    const clases = c.sinLic > 0 ? 0 : Math.min(c.conLic, tope);
    if (clases > 0) out.push({ curso_id, clases });
  }
  return out.sort((x, y) => x.curso_id - y.curso_id);
}

/**
 * Hasta cuándo vale el bono de un curso: la siguiente clase **de ese curso**
 * después del fin de ciclo (renovación bonificada). `null` si el curso no tiene
 * días: sin fecha, no vence.
 */
export function venceBono(
  curso: { curso_id: number; dias: number[] },
  finDeCiclo: string,
  suspendidas: Set<string>
): string | null {
  if (!curso.dias?.length) return null;
  return caminarClases(sumarDiasISO(finDeCiclo, 1), [curso], suspendidas, 1);
}

export type BonoPendiente = {
  id: number;
  membresia_id: number;
  curso_id: number;
  clases: number;
  vence: string | null;
};

export type ResultadoBonos = {
  /** Suman clases de su curso a la venta (plan de N clases). */
  aplican: BonoPendiente[];
  /** Se consumen sin efecto en contadores ni ciclo (plan ilimitado). */
  sinEfecto: BonoPendiente[];
  /** Su curso entra en la venta pero la fecha de inicio es posterior al vencimiento. */
  vencidos: BonoPendiente[];
  /** Su curso no está entre los elegidos: no se toca y sigue pendiente. */
  noEntran: BonoPendiente[];
};

/**
 * Qué pasa con los bonos pendientes de un alumno al venderle un plan: cada uno
 * se aplica, se consume sin efecto, venció o no entra. La venta muestra los
 * cuatro grupos para que una capacidad no disponible se explique (calidad 5).
 */
export function bonosAplicables(
  pendientes: BonoPendiente[],
  cursosElegidos: number[],
  fechaInicio: string,
  ilimitado: boolean
): ResultadoBonos {
  const r: ResultadoBonos = { aplican: [], sinEfecto: [], vencidos: [], noEntran: [] };
  const elegidos = new Set(cursosElegidos);
  for (const b of pendientes) {
    if (!elegidos.has(b.curso_id)) r.noEntran.push(b);
    else if (b.vence && fechaInicio > b.vence) r.vencidos.push(b);
    else if (ilimitado) r.sinEfecto.push(b);
    else r.aplican.push(b);
  }
  return r;
}

/** Total de clases de bono que suma una venta (solo los que aplican). */
export function clasesDeBono(res: ResultadoBonos): number {
  return res.aplican.reduce((s, b) => s + b.clases, 0);
}

/**
 * ¿El ciclo está agotado **para un curso** a una fecha? Las primeras
 * `clasesBase` clases dictadas de la membresía (de cualquier curso) son el
 * plan; las siguientes son bono y se cargan al curso donde se dictaron. Un
 * curso sigue admitiendo alumno mientras no se agote el plan o mientras no
 * haya gastado su propio bono. Así el bono de A no extiende el padrón de B.
 *
 * `dictadas`: clases dictadas de la membresía **anteriores** a la fecha
 * mirada. `bonoPorCurso`: bono recibido en esta membresía, por curso.
 */
export function cursoAgotadoAl(
  clasesBase: number,
  bonoPorCurso: Map<number, number>,
  dictadas: { fecha: string; curso_id: number }[],
  cursoId: number
): boolean {
  if (dictadas.length < clasesBase) return false;
  const orden = [...dictadas].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.curso_id - y.curso_id);
  const gastadoEnCurso = orden.slice(clasesBase).filter((d) => d.curso_id === cursoId).length;
  return gastadoEnCurso >= (bonoPorCurso.get(cursoId) ?? 0);
}

/**
 * Fin de ciclo con bono: se camina el plan base sobre todos los cursos, y
 * después cada curso con bono camina **solo sus días** las clases que recibió.
 * El fin es la última de esas fechas.
 */
export function finConBono(
  desde: string,
  cursos: { curso_id: number; dias: number[] }[],
  suspendidas: Set<string>,
  clasesBase: number,
  bonoPorCurso: Map<number, number>
): string | null {
  const fin0 = caminarClases(desde, cursos, suspendidas, clasesBase);
  if (!fin0) return null;
  let fin = fin0;
  for (const [cursoId, b] of bonoPorCurso) {
    if (!(b > 0)) continue;
    const c = cursos.find((x) => x.curso_id === cursoId);
    if (!c) continue;
    const f = caminarClases(sumarDiasISO(fin0, 1), [c], suspendidas, b);
    if (f && f > fin) fin = f;
  }
  return fin;
}

/** «Salsa 1 (hasta 15/10), Heels 2»: los bonos por usar de una membresía, para la cuenta. */
export function textoBonos(bonos: { cursoNombre: string; clases: number; vence: string | null }[]): string {
  return bonos
    .map((b) => {
      const hasta = b.vence ? ` (hasta ${b.vence.slice(8, 10)}/${b.vence.slice(5, 7)})` : "";
      return `${b.cursoNombre} ${b.clases}${hasta}`;
    })
    .join(", ");
}
