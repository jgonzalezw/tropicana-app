/**
 * Certificación de la cuenta corriente del profesor.
 *
 * Es matemática de plata, así que se fija con números verificables a mano y no
 * mirando lo que haya en dev. Mismo estándar que el motor de liquidación.
 *
 * La invariante que gobierna todo: **la suma de las imputaciones es el efectivo
 * que sale**. Si eso se rompe, la caja deja de cuadrar y nadie se entera hasta
 * el arqueo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  saldoDeProfesor,
  netoDelPeriodo,
  imputarPago,
  type PeriodoLiquidado,
} from "./cuenta.ts";

function periodo(
  id: number,
  mes: string,
  devengado: number,
  pagado = 0,
  descuentos = 0
): PeriodoLiquidado {
  return {
    id,
    periodo: `2026-${mes}-01`,
    totalDevengado: devengado,
    totalDescuentos: descuentos,
    totalPagado: pagado,
  };
}

/** El caso real de dev: a Góngora se le pagó agosto y después el recálculo lo bajó. */
const AGOSTO_PAGADO_DE_MAS = periodo(5, "08", 26.28, 54.14);

// ── El saldo ─────────────────────────────────────────────────────────────

test("1. el neto de un período resta los descuentos y lo ya pagado", () => {
  assert.equal(netoDelPeriodo(periodo(1, "08", 100)), 100);
  assert.equal(netoDelPeriodo(periodo(1, "08", 100, 40)), 60);
  assert.equal(netoDelPeriodo(periodo(1, "08", 100, 40, 10)), 50);
  assert.equal(netoDelPeriodo(AGOSTO_PAGADO_DE_MAS), -27.86, "pagado de más da negativo");
});

test("2. el saldo suma todos los períodos, positivos y negativos", () => {
  // El caso que decidió el modelo: agosto en −27,86 y septiembre en +100.
  const saldo = saldoDeProfesor([AGOSTO_PAGADO_DE_MAS, periodo(9, "09", 100)]);
  assert.equal(saldo, 72.14, "el negativo se compensa solo contra el positivo");

  assert.equal(saldoDeProfesor([]), 0);
  assert.equal(saldoDeProfesor([AGOSTO_PAGADO_DE_MAS]), -27.86, "solo el negativo: hay plata a recuperar");
});

// ── La imputación ────────────────────────────────────────────────────────

test("3. pagar el saldo deja TODOS los períodos en cero", () => {
  const periodos = [AGOSTO_PAGADO_DE_MAS, periodo(9, "09", 100)];
  const r = imputarPago(periodos, 72.14);
  assert.ok(r.ok);

  // Dos filas: la reimputación de agosto y el pago de septiembre.
  assert.equal(r.imputaciones.length, 2);
  const agosto = r.imputaciones.find((i) => i.liquidacionId === 5)!;
  const septiembre = r.imputaciones.find((i) => i.liquidacionId === 9)!;
  assert.equal(agosto.monto, -27.86);
  assert.equal(agosto.esReimputacion, true, "agosto no recibe plata: se le devuelve");
  assert.equal(septiembre.monto, 100);
  assert.equal(septiembre.esReimputacion, false);

  // La invariante: lo imputado es el efectivo.
  const efectivo = r.imputaciones.reduce((t, i) => t + i.monto, 0);
  assert.equal(Math.round(efectivo * 100) / 100, 72.14);

  // Y los dos períodos cierran.
  const cerrados = periodos.map((p) => {
    const suma = r.imputaciones.filter((i) => i.liquidacionId === p.id).reduce((t, i) => t + i.monto, 0);
    return Math.round((p.totalDevengado - p.totalDescuentos - (p.totalPagado + suma)) * 100) / 100;
  });
  assert.deepEqual(cerrados, [0, 0], "ninguno queda con número que explicar");
});

test("4. se salda del más viejo al más nuevo", () => {
  const r = imputarPago([periodo(2, "09", 50), periodo(1, "08", 30)], 40);
  assert.ok(r.ok);
  // Alcanza para agosto entero (30) y 10 de septiembre.
  assert.deepEqual(
    r.imputaciones.map((i) => [i.liquidacionId, i.monto]),
    [
      [1, 30],
      [2, 10],
    ]
  );
});

test("5. un pago parcial cierra igual los negativos", () => {
  const r = imputarPago([AGOSTO_PAGADO_DE_MAS, periodo(9, "09", 100)], 10);
  assert.ok(r.ok);
  const agosto = r.imputaciones.find((i) => i.liquidacionId === 5)!;
  const septiembre = r.imputaciones.find((i) => i.liquidacionId === 9)!;
  assert.equal(agosto.monto, -27.86, "el pagado de más se recupera aunque se pague poco");
  assert.equal(septiembre.monto, 37.86, "y lo liberado se suma a lo que se aplica");
  assert.equal(
    Math.round(r.imputaciones.reduce((t, i) => t + i.monto, 0) * 100) / 100,
    10,
    "de la caja salen 10, no 37,86"
  );
});

// ── Lo que no se puede hacer ─────────────────────────────────────────────

test("6. no se puede pagar más que el saldo", () => {
  const r = imputarPago([periodo(1, "08", 100)], 150);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /supera el saldo/);
});

test("7. no se puede pagar a quien no tiene saldo a favor", () => {
  const sinSaldo = imputarPago([periodo(1, "08", 100, 100)], 10);
  assert.equal(sinSaldo.ok, false);
  assert.match((sinSaldo as { error: string }).error, /no tiene saldo pendiente/);

  // Con saldo negativo el que debe es el profesor: no hay nada que pagarle.
  const enContra = imputarPago([AGOSTO_PAGADO_DE_MAS], 10);
  assert.equal(enContra.ok, false);
  assert.match((enContra as { error: string }).error, /27\.86 de más/);
});

test("8. el monto tiene que ser positivo", () => {
  for (const malo of [0, -5]) {
    const r = imputarPago([periodo(1, "08", 100)], malo);
    assert.equal(r.ok, false, `${malo} no es un pago`);
  }
});

test("9. los centavos no se arrastran", () => {
  // Tres períodos que obligan a redondear en cada paso.
  const r = imputarPago([periodo(1, "08", 33.33), periodo(2, "09", 33.33), periodo(3, "10", 33.34)], 100);
  assert.ok(r.ok);
  assert.equal(
    Math.round(r.imputaciones.reduce((t, i) => t + i.monto, 0) * 100) / 100,
    100,
    "la suma sigue siendo exacta"
  );
});
