import test from "node:test";
import assert from "node:assert/strict";
import { cobroPorMembresia } from "./cobro.ts";

test("la cuenta cuadra: precio − descuento − pagado = saldo", () => {
  const cuotas = [
    { id: 1, membresia_id: 7, monto_devengado: 400, descuento_adelanto: 40 },
    { id: 2, membresia_id: 7, monto_devengado: 400, descuento_adelanto: 0 },
  ];
  const pagos = [
    { cuota_id: 1, monto: 360, descuento: 0 },
    { cuota_id: 2, monto: 300, descuento: 20 },
  ];
  const c = cobroPorMembresia(cuotas, pagos);
  assert.equal(c.precio[7], 800);
  assert.equal(c.descuento[7], 60); // 40 por adelanto + 20 en el pago
  assert.equal(c.cobrado[7], 660);
  assert.equal(c.saldo[7], 80);
  assert.equal(c.precio[7] - c.descuento[7] - c.cobrado[7], c.saldo[7]);
});

test("una membresía sin pagos debe todo su precio menos el descuento por adelanto", () => {
  const c = cobroPorMembresia([{ id: 1, membresia_id: 3, monto_devengado: 500, descuento_adelanto: 50 }], []);
  assert.deepEqual([c.precio[3], c.descuento[3], c.cobrado[3], c.saldo[3]], [500, 50, 0, 450]);
});
