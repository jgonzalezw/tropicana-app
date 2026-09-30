/**
 * El rango de fechas de "período vencido", según `periodicidad_liquidacion`
 * (H5, C3). Sacado de `liquidaciones/acciones.ts`: hasta H5 el parámetro se
 * leía y no se usaba — el rango quedaba fijo en mes calendario aunque el
 * parámetro dijera otra cosa (calidad 5: una capacidad que no está no debe
 * quedar muda). Hoy solo `mes` está implementado; el check de la tabla
 * `liquidaciones.periodicidad` admite además `semana` y `membresia`, pero
 * cambiarlas de verdad es un cálculo propio que no se construye acá.
 */

export type Periodicidad = "semana" | "mes" | "membresia";

export type RangoLiquidable =
  | { ok: true; periodicidad: "mes"; periodoVencido: string; hastaISO: string }
  | { ok: false; error: string };

/** Primer día del MES VENCIDO (mes anterior a `hoy`). */
export function primerDiaMesVencidoISO(hoy = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Último día del MES VENCIDO (mes anterior a `hoy`): tope de elegibilidad. */
export function finMesVencidoISO(hoy = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), 0); // día 0 del mes actual = último día del anterior
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Primer día del mes de una fecha ISO cualquiera ("2026-09-20" → "2026-09-01"). */
export function primerDiaMesDe(fechaISO: string): string {
  return `${fechaISO.slice(0, 7)}-01`;
}

/**
 * El rango liquidable para la periodicidad configurada. Con `mes`, el mes
 * vencido de siempre. Con cualquier otra cosa, un error explícito — nada de
 * calcular en silencio como si fuera mes (calidad 5).
 */
export function rangoLiquidable(periodicidad: string, hoy = new Date()): RangoLiquidable {
  if (periodicidad !== "mes")
    return {
      ok: false,
      error:
        `La periodicidad de liquidación está en "${periodicidad}", y el motor todavía ` +
        `solo sabe liquidar por "mes". Cambiá el parámetro "periodicidad_liquidacion" a ` +
        `"mes" en Administración → Parámetros, o pedí que se construya ese rango.`,
    };
  return {
    ok: true,
    periodicidad: "mes",
    periodoVencido: primerDiaMesVencidoISO(hoy),
    hastaISO: finMesVencidoISO(hoy),
  };
}
