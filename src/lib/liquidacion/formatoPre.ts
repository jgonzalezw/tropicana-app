/** Formato del informe de pre-liquidación (pantalla e impreso), sin DOM. */

import { gs } from "../inscripcion.ts";
import type { LiquidezPre } from "./preliquidacion.ts";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-09-01" → "Septiembre 2026". */
export function periodoLargo(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mes = MESES[Number(m[2]) - 1] ?? m[2];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${m[1]}`;
}

/** "2026-09-28" → "28/09/2026"; vacío → "—". */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** "01/10/2026 a las 09:41" (hora local) desde un instante ISO. */
export function fechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} a las ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** Monto firmado con el menos tipográfico (U+2212): "+ Bs. 12,50" / "− Bs. 40,00". */
export function conSigno(n: number): string {
  return n < 0 ? `− ${gs(-n)}` : `+ ${gs(n)}`;
}

export const LEYENDA_PRE =
  "Informe preliminar: no se ha generado ninguna liquidación ni se ha devengado nada.";

type ConPeriodo = {
  periodoVencido: string;
  hastaISO: string;
  simulacion?: { periodicidad: "mes" | "semana"; alFecha: string };
};

/** El nombre del período del informe: «Septiembre 2026», o el en curso si es simulación. */
export function nombrePeriodoPre(i: ConPeriodo): string {
  if (!i.simulacion) return periodoLargo(i.periodoVencido);
  return i.simulacion.periodicidad === "mes"
    ? `${periodoLargo(i.periodoVencido)} (en curso)`
    : `Semana del ${fechaCorta(i.periodoVencido)} al ${fechaCorta(i.hastaISO)}`;
}

/** Título completo: «Pre-liquidación · …» o «Simulación al <fecha> · …». */
export function tituloPre(i: ConPeriodo): string {
  return i.simulacion
    ? `Simulación al ${fechaCorta(i.simulacion.alFecha)} · ${nombrePeriodoPre(i)}`
    : `Pre-liquidación · ${nombrePeriodoPre(i)}`;
}

export const LEYENDA_SIMULACION =
  "Simulación: proyecta el cierre del período en curso como si ya hubiera terminado. No se ha generado ninguna liquidación ni se ha devengado nada.";

/** La línea de «Período …» bajo el título. */
export function subtituloPre(i: ConPeriodo): string {
  return `Período ${fechaCorta(i.periodoVencido)} – ${fechaCorta(i.hastaISO)}, ${
    i.simulacion ? "proyección del período en curso" : "se liquida a período vencido"
  }`;
}

/** La fecha efectiva de un retiro, tal como la dice una liquidación (pantalla e impreso). */
export function textoRetiroEfectivo(iso: string): string {
  return `Retiro efectivo: hasta el ${fechaCorta(iso)} (último día a cargo)`;
}

/** El desglose de la cifra de liquidez (pantalla e impreso). */
export function notaLiquidez(l: LiquidezPre): string {
  const partes = [`devengo ${gs(l.devengo)}`, `saldo anterior ${gs(l.saldoPrevio)}`, `suplentes ${gs(l.reemplazos)}`];
  const extra = l.soloSaldo ? ` · incluye ${l.soloSaldo} ${l.soloSaldo === 1 ? "profesor" : "profesores"} sin devengo en el período` : "";
  return partes.join(" · ") + extra;
}
