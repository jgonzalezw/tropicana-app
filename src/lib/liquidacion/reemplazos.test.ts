import { test } from "node:test";
import assert from "node:assert/strict";
import { imputarPagoReemplazos, saldoDeReemplazos, type ClaseReemplazo } from "./reemplazos.ts";

const clase = (sesionId: number, fecha: string, costo: number, pagado = 0): ClaseReemplazo => ({
  sesionId,
  fecha,
  costo,
  pagado,
});

test("saldo: suma lo que falta de cada clase", () => {
  assert.equal(saldoDeReemplazos([clase(1, "2026-09-01", 45), clase(2, "2026-09-10", 65, 20)]), 90);
});

test("saldo: lo pagado sin clase vigente resta, y puede dejarlo negativo", () => {
  assert.equal(saldoDeReemplazos([clase(1, "2026-09-01", 45)], 45), 0);
  assert.equal(saldoDeReemplazos([], 30), -30);
});

test("pagar una clase entera: una fila por el costo completo", () => {
  const r = imputarPagoReemplazos([clase(104, "2026-09-15", 70)], 70);
  assert.ok(r.ok);
  assert.deepEqual(r.filas, [{ sesionId: 104, monto: 70 }]);
});

test("pago a cuenta: cubre primero la clase mas vieja", () => {
  const r = imputarPagoReemplazos(
    [clase(2, "2026-09-10", 65), clase(1, "2026-09-01", 45), clase(3, "2026-09-15", 70)],
    80
  );
  assert.ok(r.ok);
  assert.deepEqual(r.filas, [
    { sesionId: 1, monto: 45 },
    { sesionId: 2, monto: 35 },
  ]);
  assert.equal(r.filas.reduce((t, f) => t + f.monto, 0), 80);
});

test("una clase pagada a medias se completa antes de pasar a la siguiente", () => {
  const r = imputarPagoReemplazos([clase(1, "2026-09-01", 45, 30), clase(2, "2026-09-10", 65)], 20);
  assert.ok(r.ok);
  assert.deepEqual(r.filas, [
    { sesionId: 1, monto: 15 },
    { sesionId: 2, monto: 5 },
  ]);
});

test("rechaza pagar mas que el saldo", () => {
  const r = imputarPagoReemplazos([clase(1, "2026-09-01", 45)], 46);
  assert.equal(r.ok, false);
});

test("rechaza un monto que no es positivo, y pagar sin nada pendiente", () => {
  assert.equal(imputarPagoReemplazos([clase(1, "2026-09-01", 45)], 0).ok, false);
  assert.equal(imputarPagoReemplazos([clase(1, "2026-09-01", 45, 45)], 10).ok, false);
});

test("un pago sin clase vigente reduce lo que se puede pagar", () => {
  const r = imputarPagoReemplazos([clase(1, "2026-09-01", 45)], 45, 10);
  assert.equal(r.ok, false);
  const ok = imputarPagoReemplazos([clase(1, "2026-09-01", 45)], 35, 10);
  assert.ok(ok.ok);
});

test("centavos: la suma de las filas es exactamente el efectivo", () => {
  const r = imputarPagoReemplazos([clase(1, "2026-09-01", 33.33), clase(2, "2026-09-02", 33.33)], 50.5);
  assert.ok(r.ok);
  assert.equal(Math.round(r.filas.reduce((t, f) => t + f.monto, 0) * 100) / 100, 50.5);
});
