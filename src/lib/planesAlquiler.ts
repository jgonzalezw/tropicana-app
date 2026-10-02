import type { DatosPlan } from "./tipos.ts";

/**
 * Valida el recargo de extensión de un plan contra el tope que fija la
 * gerente (parámetro `extension_recargo_max_pct`, 0060). Compartida por los
 * planes de particulares y de alquiler: el campo es el mismo.
 */
export function validarRecargoExtension(d: DatosPlan, maxPct: number | null): string | null {
  if (d.extension_modo !== "recargo") return null;
  if (!(d.extension_recargo_pct != null && d.extension_recargo_pct > 0))
    return "Cargá el % de recargo de la extensión (o dejá el modo en precio de lista).";
  if (maxPct != null && d.extension_recargo_pct > maxPct)
    return `El recargo de extensión no puede pasar de ${maxPct}% (tope que fija la academia en Parámetros).`;
  return null;
}

/**
 * Valida los campos propios de un plan de alquiler de sala (C3, hito H7).
 * Lo común a todo plan (nombre, precio, criterio) lo valida `validarDatosPlan`
 * en `planes.ts`; acá solo lo propio del tipo.
 *
 * Un alquiler **no lleva** estilo, profesor, forma de pago, criterio de
 * liquidación ni precio: el precio sale de la tabla de alquiler de *Precios y
 * paquetes* (categoría × tamaño × horas) y el alquiler no le paga nada a
 * ningún profesor (definiciones v2, regla 22).
 */
export function validarPlanAlquiler(d: DatosPlan, maxRecargoPct: number | null = null): string | null {
  if (!d.reserva_modalidad) return "Elegí la modalidad de reserva: agenda fija o flexible.";
  if (!(d.vigencia_dias != null && d.vigencia_dias > 0))
    return "Falta la vigencia en días: cuenta desde la primera reserva y lo no usado se pierde.";
  if (d.salas_modo === "solo" && d.salaIds.length === 0)
    return "Elegí al menos una sala (o cambiá el acceso de salas a Todas).";
  return validarRecargoExtension(d, maxRecargoPct);
}
