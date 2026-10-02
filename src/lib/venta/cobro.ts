/**
 * El cobro que una venta manda al servidor, armado igual en todos los flujos.
 * Pura: la usan las pantallas y se prueba sin red.
 */

export type CobroVentaEntrada = {
  modo: "entero" | "parcial" | "sin";
  monto: number;
  medio: string | null;
  notaMedio: string;
  ajuste: number;
  ajusteMotivo: string;
  total: number;
  saldo: number;
  fechaCompromiso: string | null;
};

type PayloadMinimo = {
  modo: "entero" | "parcial" | "sin";
  total: number;
  saldo: number;
  medio: string | null;
  notaMedio: string;
  ajuste: number;
  ajusteMotivo: string;
};

/**
 * `payload` es lo que emite `Cobro` (null si todavía no emitió: se vende sin
 * cobrar y todo el precio queda como saldo). La fecha de compromiso solo
 * viaja si hay saldo.
 */
export function cobroParaServidor(
  payload: PayloadMinimo | null,
  precio: number,
  fechaCompromiso: string,
): CobroVentaEntrada {
  const saldo = payload?.saldo ?? precio;
  return {
    modo: payload?.modo ?? "sin",
    monto: payload ? payload.total - payload.saldo : 0,
    medio: payload?.medio ?? null,
    notaMedio: payload?.notaMedio ?? "",
    ajuste: payload?.ajuste ?? 0,
    ajusteMotivo: payload?.ajusteMotivo ?? "",
    total: precio,
    saldo,
    fechaCompromiso: saldo > 0 ? fechaCompromiso : null,
  };
}
