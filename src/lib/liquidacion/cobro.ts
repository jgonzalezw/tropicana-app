/**
 * Saldo y plata efectivamente cobrada, por membresía — sacado de
 * `motor.ts` (H5, C3) para que lo compartan el motor de cursos regulares
 * y el de particulares (`particulares.ts`) sin duplicar la cuenta.
 *
 * La comisión se calcula sobre lo COBRADO: el descuento no suma (regla 8).
 */

export type CuotaCobro = {
  id: number;
  membresia_id: number;
  monto_devengado: number;
  descuento_adelanto: number;
};

export type PagoCobro = { cuota_id: number | null; monto: number; descuento: number };

export type CobroPorMembresia = {
  /** Lo que todavía falta cobrar de esa membresía (0 = pagada entera). */
  saldo: Record<number, number>;
  /** La plata que efectivamente entró (sin contar el descuento). */
  cobrado: Record<number, number>;
  /** Lo vendido: Σ de las cuotas devengadas (antes de descuentos). */
  precio: Record<number, number>;
  /** Lo que se perdonó: descuento por adelanto + descuento en los pagos. */
  descuento: Record<number, number>;
};

export function cobroPorMembresia(cuotas: CuotaCobro[], pagos: PagoCobro[]): CobroPorMembresia {
  const pagadoPorCuota: Record<number, number> = {};
  const plataPorCuota: Record<number, number> = {};
  for (const p of pagos) {
    if (p.cuota_id == null) continue;
    plataPorCuota[p.cuota_id] = (plataPorCuota[p.cuota_id] ?? 0) + Number(p.monto);
    pagadoPorCuota[p.cuota_id] = (pagadoPorCuota[p.cuota_id] ?? 0) + Number(p.monto) + Number(p.descuento);
  }
  const saldo: Record<number, number> = {};
  const cobrado: Record<number, number> = {};
  const precio: Record<number, number> = {};
  const descuento: Record<number, number> = {};
  const descPagos: Record<number, number> = {};
  for (const p of pagos) if (p.cuota_id != null) descPagos[p.cuota_id] = (descPagos[p.cuota_id] ?? 0) + Number(p.descuento);
  for (const c of cuotas) {
    precio[c.membresia_id] = (precio[c.membresia_id] ?? 0) + Number(c.monto_devengado);
    descuento[c.membresia_id] =
      (descuento[c.membresia_id] ?? 0) + Number(c.descuento_adelanto) + (descPagos[c.id] ?? 0);
    const efectivo = Math.max(0, Number(c.monto_devengado) - Number(c.descuento_adelanto));
    saldo[c.membresia_id] =
      (saldo[c.membresia_id] ?? 0) + Math.max(0, efectivo - (pagadoPorCuota[c.id] ?? 0));
    cobrado[c.membresia_id] = (cobrado[c.membresia_id] ?? 0) + (plataPorCuota[c.id] ?? 0);
  }
  return { saldo, cobrado, precio, descuento };
}
