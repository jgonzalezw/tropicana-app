/**
 * Lo que se le debe a un profesor por las clases que dictó **como reemplazante**.
 *
 * Es aparte de su cuenta de liquidaciones (`cuenta.ts`) y a propósito. Un
 * suplente **no cobra por liquidación, cobra por tarifa** (regla de negocio
 * 20): la plata existe desde el momento en que se registra la clase, y no hay
 * por qué esperar al cierre del mes para pagarla. *(Javier, 2026-09-18: "para
 * la profesora sustituta, el monto debería estar pagable de inmediato".)* El
 * otro lado —descontarle ese costo al titular— sí va en la liquidación del
 * titular y no se toca acá.
 *
 * Pura, sin base de datos, para poder fijarla con pruebas.
 */

export type ClaseReemplazo = {
  sesionId: number;
  fecha: string;
  /** Lo que se le paga por esa clase (`sesiones.reemplazo_costo`). */
  costo: number;
  /** Lo ya pagado contra esa clase (`pagos.sesion_id`). */
  pagado: number;
};

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Cuánto se le debe. `pagadoSinClase` es lo pagado al profesor por este
 * concepto que ya no cuelga de ninguna clase vigente (la clase se suspendió o
 * se le quitó el reemplazo después de pagar): resta igual, porque esa plata
 * salió. Si supera lo que se debe, el saldo es **negativo** y se ve —un fallo
 * no se disfraza de ausencia—.
 */
export function saldoDeReemplazos(clases: ClaseReemplazo[], pagadoSinClase = 0): number {
  const debe = clases.reduce((t, c) => t + c.costo - c.pagado, 0);
  return redondear(debe - pagadoSinClase);
}

export type FilaDePago = { sesionId: number; monto: number };

/**
 * Reparte un pago entre las clases, de la más vieja a la más nueva, cada una
 * hasta lo que le falta. La suma de las filas es exactamente el efectivo que
 * sale. Rechaza pagar más que el saldo o un monto que no sea positivo.
 */
export function imputarPagoReemplazos(
  clases: ClaseReemplazo[],
  monto: number,
  pagadoSinClase = 0
): { ok: true; filas: FilaDePago[] } | { ok: false; error: string } {
  const pago = redondear(monto);
  if (!(pago > 0)) return { ok: false, error: "Escribí el monto que se le paga." };
  const saldo = saldoDeReemplazos(clases, pagadoSinClase);
  if (saldo <= 0) return { ok: false, error: "No hay clases de reemplazo pendientes de pago." };
  if (pago > saldo + 0.001)
    return { ok: false, error: "El pago supera lo que se le debe por sus reemplazos." };

  const pendientes = clases
    .map((c) => ({ ...c, falta: redondear(c.costo - c.pagado) }))
    .filter((c) => c.falta > 0)
    .sort((a, b) => (a.fecha === b.fecha ? a.sesionId - b.sesionId : a.fecha < b.fecha ? -1 : 1));

  const filas: FilaDePago[] = [];
  let resto = pago;
  for (const c of pendientes) {
    if (resto <= 0) break;
    const aca = redondear(Math.min(c.falta, resto));
    filas.push({ sesionId: c.sesionId, monto: aca });
    resto = redondear(resto - aca);
  }
  return { ok: true, filas };
}
