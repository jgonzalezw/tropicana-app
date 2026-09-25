import type { DatosPlan } from "./tipos";

/**
 * Vigencia efectiva del paquete, en días: la propia del plan si la tiene, o
 * la política de la academia (parámetro `vencimiento_paquete_meses`, en
 * meses — 0048, sin uso hasta este hito). No se guarda un segundo parámetro
 * para lo mismo (glosario: un concepto, un nombre).
 */
export function vigenciaDiasEfectiva(vigenciaDias: number | null, mesesAcademia: number): number {
  return vigenciaDias ?? mesesAcademia * 30;
}

/**
 * Valida los campos propios de un plan de particulares (C3, hito H1). Lo
 * común a todo plan (nombre, precio, criterio 1-5) lo valida `validar` en
 * `planes/acciones.ts`; acá solo lo que es propio de este tipo de servicio.
 */
export function validarPlanParticular(d: DatosPlan): string | null {
  if (!d.estilo) return "Elegí el estilo del plan.";
  if (!d.reserva_modalidad) return "Elegí la modalidad de reserva: agenda fija o reserva flexible.";
  if (d.salas_modo === "solo" && d.salaIds.length === 0)
    return "Elegí al menos una sala (o cambiá el acceso de salas a Todas).";
  if (!d.forma_pago_profesor) return "Elegí cómo gana el profesor con este plan.";
  if (d.forma_pago_profesor === "pct_margen" && !(d.pago_pct_margen != null && d.pago_pct_margen > 0))
    return "Cargá el % sobre el margen para el profesor.";
  if (d.forma_pago_profesor === "monto_fijo" && !(d.pago_monto_fijo != null && d.pago_monto_fijo >= 0))
    return "Cargá el monto fijo por membresía para el profesor.";
  if (d.extension_modo === "recargo" && !(d.extension_recargo_pct != null && d.extension_recargo_pct > 0))
    return "Cargá el % de recargo de la extensión (o dejá el modo en precio de lista).";
  if (d.criterio_liquidacion < 1 || d.criterio_liquidacion > 3)
    return "Un plan de particulares liquida con el criterio 1, 2 o 3 (el 4 y el 5 son solo de taller).";
  if (d.vigencia_dias != null && !(d.vigencia_dias > 0))
    return "La vigencia del paquete tiene que ser mayor a 0 días.";
  return null;
}
