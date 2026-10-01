/** Formato del informe de pre-liquidación (pantalla e impreso), sin DOM. */

import { gs } from "../inscripcion.ts";

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

export const TEXTO_CRITERIO: Record<number, string> = {
  1: "Criterio 1: al completarse la membresía, a período vencido",
  2: "Criterio 2: proporcional al avance de la membresía",
  3: "Criterio 3: al completarse la membresía, sin esperar el cierre",
};

export const LEYENDA_PRE =
  "Informe preliminar: no se ha generado ninguna liquidación ni se ha devengado nada.";
