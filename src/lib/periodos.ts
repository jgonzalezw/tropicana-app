/**
 * Hasta dónde se puede tocar el pasado.
 *
 * **El problema.** Desde que la comisión se reparte a prorrata (regla de
 * negocio 10), el monto que cobra cada profesor depende de **cuántas clases
 * dictó su curso**. Entonces suspender una clase vieja, reabrirla, corregir una
 * asistencia o vender con fecha retroactiva no son hechos inocentes: cambian el
 * peso del reparto. Si esa comisión ya se pagó, el cambio deja la plata que
 * salió sin respaldo en los datos, y nadie se entera.
 *
 * **La regla** (regla de negocio 16, decisión de Javier 2026-09-11, opción a):
 * un período **liquidado y pagado** está cerrado. Ningún hecho con fecha dentro
 * de él se crea ni se modifica. Si hay que corregir algo de un período cerrado,
 * se hace con un ajuste con fecha de hoy, que deja rastro — nunca reescribiendo
 * el pasado.
 *
 * **Dónde cae el corte.** En el primer pago, no en el pago total: una
 * liquidación `cerrada` es una con pago parcial, y esa plata ya salió. Mientras
 * la liquidación esté `abierta` (nada pagado), corregir es barato y correcto:
 * ahí el cambio se permite y el devengo se revierte solo para que se recalcule.
 */

import type { createClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createClient>>;

/** Último día ya cerrado por una liquidación con pago, o `null` si no hay ninguna. */
export async function cierreLiquidado(sb: Cliente): Promise<string | null> {
  const { data } = await sb
    .from("liquidaciones")
    .select("periodo, estado")
    .in("estado", ["pagada", "cerrada"]);
  const filas = (data as { periodo: string | null; estado: string }[] | null) ?? [];
  let tope: string | null = null;
  for (const f of filas) {
    if (!f.periodo) continue;
    const fin = finDelMes(f.periodo);
    if (!tope || fin > tope) tope = fin;
  }
  return tope;
}

/** Último día del mes al que pertenece `iso` (el período es su primer día). */
export function finDelMes(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  const d = new Date(y, m, 0); // día 0 del mes siguiente = último del mes
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ¿Esa fecha cae en un período ya liquidado y pagado? */
export function estaCerrado(fechaISO: string, cierre: string | null): boolean {
  return !!cierre && fechaISO.slice(0, 10) <= cierre;
}

/**
 * El mensaje que ve la persona. Dice **por qué** no se puede y **qué hacer**:
 * un "no se puede" a secas manda a buscar el problema donde no está.
 */
export function motivoCerrado(fechaISO: string, cierre: string): string {
  return (
    `Esa fecha (${fechaISO}) está en un período ya liquidado y pagado a los profesores ` +
    `(cerrado hasta el ${cierre}). Cambiarla movería una comisión que ya se pagó. ` +
    `Si hay que corregirlo, se hace con un ajuste con fecha de hoy.`
  );
}
