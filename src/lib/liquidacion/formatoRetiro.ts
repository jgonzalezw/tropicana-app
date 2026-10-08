/**
 * Cómo se dicen las cifras de la vista del retiro, en pantalla y en el impreso:
 * un solo lugar para que las dos hablen igual. Sin DOM.
 */

import { gs } from "../inscripcion.ts";
import { fechaCorta } from "./formatoPre.ts";
import type { InconclusaVista, LineaParticular, LineaRegular } from "./retiro.ts";

/** Un monto, o «—» si es cero (la tabla se lee mejor sin ceros). */
export const montoOGuion = (n: number): string => (Math.abs(n) < 0.005 ? "—" : gs(n));

/** Un número de clases u horas: sin ceros de más y con coma. */
export const cantidad = (n: number): string => String(Math.round(n * 100) / 100).replace(".", ",");

/** «Bs. 150,00 · N° 3», o «—» si no hay nada liquidado antes. */
export function textoYaLiquidado(l: Pick<LineaRegular | LineaParticular, "yaLiquidado" | "liquidaciones">): string {
  if (Math.abs(l.yaLiquidado) < 0.005) return "—";
  return l.liquidaciones.length ? `${gs(l.yaLiquidado)} · N° ${l.liquidaciones.join(", ")}` : gs(l.yaLiquidado);
}

/**
 * El avance en dos líneas como mucho: «2 de 8 clases» y debajo «faltan 6»
 * (o «ilimitado», que no tiene total contra el cual faltar).
 */
export function avanceEnDosLineas(m: Pick<InconclusaVista, "hechas" | "total" | "unidad">): { principal: string; resto: string } {
  return m.total == null
    ? { principal: `${cantidad(m.hechas)} ${m.unidad}`, resto: "ilimitado" }
    : {
        principal: `${cantidad(m.hechas)} de ${cantidad(m.total)} ${m.unidad}`,
        resto: `faltan ${cantidad(Math.max(0, m.total - m.hechas))}`,
      };
}

/** El ciclo en una línea y corto: «01/10/26 – 27/10/26» (cabe junto al curso sin ensanchar la tabla). */
export const textoCiclo = (inicio: string | null, fin: string | null): string => {
  const corta = (f: string | null) => {
    const t = fechaCorta(f);
    return /^\d\d\/\d\d\/\d{4}$/.test(t) ? `${t.slice(0, 6)}${t.slice(8)}` : t;
  };
  return `${corta(inicio)} – ${corta(fin)}`;
};

/** Bono que recibió de la venta anterior: «+1 clase» o «—». */
export const textoBonoAplicado = (n: number): string => (n > 0 ? `+${n}` : "—");

/** Bono que deja para su renovación: «1 · hasta 08/10/2026» o «—». */
export function textoBonoGenerado(m: Pick<InconclusaVista, "bonoGenerado" | "bonoVence">): string {
  if (m.bonoGenerado <= 0) return "—";
  return m.bonoVence ? `${m.bonoGenerado} · hasta ${fechaCorta(m.bonoVence)}` : String(m.bonoGenerado);
}
