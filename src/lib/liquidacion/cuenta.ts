/**
 * La cuenta corriente del profesor.
 *
 * **Por qué el saldo y no cada liquidación.** Una liquidación deja una deuda, y
 * una reliquidación también — con la diferencia de que el ajuste puede ser
 * negativo y dejar un período con plata **pagada de más** (migración 0044). Si
 * cada período fuera una deuda aislada, ese negativo solo se podría recuperar
 * al generar la liquidación siguiente: un profesor que deja de devengar se
 * llevaría el saldo sin que apareciera en ningún lado. Con la cuenta, el
 * negativo se ve desde el momento cero y no se va hasta saldarse.
 * *(Javier, 2026-09-18.)*
 *
 * **Y además los períodos cierran.** El saldo es lo operativo, pero al pagar la
 * imputación cancela los negativos contra los positivos, así que ninguna de las
 * dos vistas —la cuenta y el período— queda con un número que haya que explicar.
 *
 * **La frontera, que importa no equivocar.** Este saldo es el de las
 * **liquidaciones**: comisiones por planes de cursos regulares y pruebas, más
 * el descuento al reemplazado (regla 20a); el pago al reemplazante es aparte, ver `reemplazos.ts`. Los
 * conceptos ad-hoc —multas, bonificaciones, débitos y créditos de
 * administración— **se resuelven enteros en Caja y no entran acá**: son
 * movimientos que se cierran en sí mismos y no acumulan deuda. Por eso la línea
 * de "Por pagar" dice *saldo de liquidaciones* y no "lo que se le debe": un
 * pago con motivo `otro_pago_profesor` cae en el mismo bucket y no salda esto.
 *
 * **Lo que viene**: con C3 se suman a la liquidación las comisiones por clases
 * particulares y talleres, y los cargos por alquiler de sala. Por eso el saldo
 * se calcula como *la suma de los conceptos liquidables del profesor*, hoy
 * alimentada solo por `liquidaciones`: agregar una fuente tiene que ser sumar
 * un sumando, no rehacer esto.
 */

/** Un período liquidado, con lo que hace falta para saber cuánto queda. */
export type PeriodoLiquidado = {
  id: number;
  /** Primer día del período. Ordena la imputación: se paga lo más viejo primero. */
  periodo: string;
  totalDevengado: number;
  totalDescuentos: number;
  totalPagado: number;
};

/** A qué liquidación va cuánto, en un pago. */
export type Imputacion = {
  liquidacionId: number;
  periodo: string;
  /**
   * Firmado. **Positivo** = plata que sale para ese período. **Negativo** = una
   * reimputación: ese período tenía pagado de más y se le devuelve, contra lo
   * que se le paga a otro. No es plata que entra a la caja por separado — la
   * suma de todas las imputaciones **es** el efectivo del movimiento.
   */
  monto: number;
  /** `true` cuando es la cancelación de un pagado de más, para la glosa. */
  esReimputacion: boolean;
};

/** Lo que queda de un período: devengado menos descuentos menos pagado. */
export function netoDelPeriodo(p: PeriodoLiquidado): number {
  return redondear(p.totalDevengado - p.totalDescuentos - p.totalPagado);
}

/**
 * El saldo de la cuenta: la suma de todos sus períodos.
 *
 * Positivo = Tropicana le debe. Negativo = se le pagó de más y hay plata que
 * recuperar. Cero = al día.
 */
export function saldoDeProfesor(periodos: PeriodoLiquidado[]): number {
  return redondear(periodos.reduce((t, p) => t + netoDelPeriodo(p), 0));
}

/** Los centavos no se arrastran: toda la cuenta trabaja con dos decimales. */
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ResultadoImputacion =
  | { ok: true; imputaciones: Imputacion[] }
  | { ok: false; error: string };

/**
 * Reparte un pago entre los períodos del profesor.
 *
 * El criterio, que es lo que hace que los períodos cierren:
 *
 *  1. **Primero se cancelan los negativos.** Cada período con pagado de más
 *     recibe una imputación por su propio neto —negativa— que lo deja en cero.
 *     No cuesta caja: es reimputar plata que ya había salido.
 *  2. **Después se reparte el efectivo entre los positivos, del más viejo al
 *     más nuevo.** Lo disponible es el monto del pago **más** lo que liberaron
 *     los negativos.
 *
 * La suma de las imputaciones da exactamente el efectivo que sale, así que la
 * caja cuadra sin que nadie tenga que compensar nada a mano.
 */
export function imputarPago(periodos: PeriodoLiquidado[], monto: number): ResultadoImputacion {
  const importe = redondear(monto);
  if (!(importe > 0)) return { ok: false, error: "El monto tiene que ser mayor a cero." };

  const saldo = saldoDeProfesor(periodos);
  if (saldo <= 0)
    return {
      ok: false,
      error:
        saldo === 0
          ? "Ese profesor no tiene saldo pendiente."
          : `Ese profesor no tiene saldo a favor: se le pagó ${Math.abs(saldo)} de más.`,
    };
  if (importe > saldo) return { ok: false, error: `El pago supera el saldo del profesor (${saldo}).` };

  // Del más viejo al más nuevo: una deuda vieja se salda antes que una nueva.
  const ordenados = [...periodos].sort((a, b) => a.periodo.localeCompare(b.periodo) || a.id - b.id);

  const imputaciones: Imputacion[] = [];
  let disponible = importe;

  // 1. Cancelar los negativos. Cada uno libera su importe para repartir.
  for (const p of ordenados) {
    const neto = netoDelPeriodo(p);
    if (neto >= 0) continue;
    imputaciones.push({
      liquidacionId: p.id,
      periodo: p.periodo,
      monto: neto, // negativo: se le devuelve lo que se le había pagado de más
      esReimputacion: true,
    });
    disponible = redondear(disponible - neto); // restar un negativo suma
  }

  // 2. Repartir entre los positivos, del más viejo al más nuevo.
  for (const p of ordenados) {
    if (disponible <= 0) break;
    const neto = netoDelPeriodo(p);
    if (neto <= 0) continue;
    const aplica = redondear(Math.min(neto, disponible));
    imputaciones.push({
      liquidacionId: p.id,
      periodo: p.periodo,
      monto: aplica,
      esReimputacion: false,
    });
    disponible = redondear(disponible - aplica);
  }

  return { ok: true, imputaciones };
}
