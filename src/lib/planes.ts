import type { DatosPlan } from "./tipos";
import { validarPlanParticular } from "./planesParticular";

/**
 * Valida un plan completo (lo común a todo tipo de servicio, más lo propio
 * de particulares vía `validarPlanParticular`). Vive acá, pura y sin
 * `"use server"`, para que la MISMA regla la corra el servidor
 * (`planes/acciones.ts`, que manda) y el cliente (`ClientePlanes.tsx`, para
 * deshabilitar "Crear plan"/"Guardar cambios" hasta que esté completo —
 * calidad: nunca dejar guardar con datos obligatorios a medio cargar).
 */
export function validarDatosPlan(d: DatosPlan): string | null {
  if (!d.nombre.trim()) return "El nombre del plan es obligatorio.";
  if (!(d.precio >= 0)) return "El precio no puede ser negativo.";
  if (!(d.criterio_liquidacion >= 1 && d.criterio_liquidacion <= 5))
    return "Criterio de liquidación inválido.";
  // Los criterios 4 y 5 son de taller (definiciones-v2, sección 6); acá solo
  // se ofrece curso_regular y particular, así que ningún plan de esta
  // pantalla puede llegar con ellos.
  if (d.criterio_liquidacion >= 4 && d.tipo_servicio !== "taller")
    return "Los criterios 4 y 5 son solo para planes de taller.";

  if (d.tipo_servicio === "particular") return validarPlanParticular(d);

  if (d.acceso_modo === "solo" && (!d.cursoIds || d.cursoIds.length === 0))
    return "Elegí al menos un curso (o cambiá el acceso a Todas).";
  if (!d.clases_ilimitadas && (d.cantidad_clases == null || !(d.cantidad_clases > 0)))
    return "La cantidad de clases (N) debe ser mayor a 0.";
  if (d.clases_ilimitadas && (d.ciclo_dias == null || !(d.ciclo_dias > 0)))
    return "La duración del ciclo (días) debe ser mayor a 0.";
  return null;
}
