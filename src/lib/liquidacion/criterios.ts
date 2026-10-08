/**
 * Los criterios de liquidación (`planes.criterio_liquidacion`), en un solo
 * lugar: el texto que ve quien arma un plan y la sigla corta que usan las
 * tablas de la liquidación (retiro, pre-liquidación). Sin dependencias.
 */

export const CRITERIOS_LIQ: Record<number, { sigla: string; texto: string }> = {
  1: { sigla: "C1", texto: "Al completar la membresía, período vencido" },
  2: { sigla: "C2", texto: "Proporcional al avance, período vencido" },
  3: { sigla: "C3", texto: "Al completar la membresía, inmediato" },
  4: { sigla: "C4", texto: "Taller: al completar, sobre lo cobrado" },
  5: { sigla: "C5", texto: "Taller: monto fijo al completar" },
};

/** «2 — Proporcional al avance, período vencido» (selector de planes). */
export const etiquetaCriterio = (n: number): string => `${n} — ${CRITERIOS_LIQ[n]?.texto ?? "sin definir"}`;

/** «C2»; «—» si la membresía no tiene criterio. */
export const siglaCriterio = (n: number | null | undefined): string =>
  n != null && CRITERIOS_LIQ[n] ? CRITERIOS_LIQ[n].sigla : "—";

/** «Criterio 2: Proporcional al avance, período vencido» (tooltip, comprobante). */
export const textoCriterio = (n: number): string =>
  CRITERIOS_LIQ[n] ? `Criterio ${n}: ${CRITERIOS_LIQ[n].texto}` : `Criterio ${n}`;

/** Leyenda de las siglas que aparecen: «C1 = Al completar…; C2 = …». */
export function leyendaCriterios(usados: (number | null | undefined)[]): string {
  const ns = [...new Set(usados.filter((n): n is number => n != null && !!CRITERIOS_LIQ[n]))].sort((a, b) => a - b);
  return ns.map((n) => `${CRITERIOS_LIQ[n].sigla} = ${CRITERIOS_LIQ[n].texto}`).join(" · ");
}
