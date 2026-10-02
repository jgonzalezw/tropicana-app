import { test } from "node:test";
import assert from "node:assert/strict";
import { cobroParaServidor } from "./cobro.ts";

const base = { medio: "efectivo", notaMedio: "", ajuste: 0, ajusteMotivo: "" };

test("sin payload: todo el precio queda como saldo con fecha de compromiso", () => {
  const c = cobroParaServidor(null, 200, "2026-10-10");
  assert.equal(c.modo, "sin");
  assert.equal(c.monto, 0);
  assert.equal(c.saldo, 200);
  assert.equal(c.fechaCompromiso, "2026-10-10");
});

test("cobro entero: sin saldo no viaja fecha de compromiso", () => {
  const c = cobroParaServidor({ ...base, modo: "entero", total: 200, saldo: 0 }, 200, "2026-10-10");
  assert.equal(c.monto, 200);
  assert.equal(c.fechaCompromiso, null);
});

test("cobro parcial: monto = total - saldo y la fecha viaja", () => {
  const c = cobroParaServidor({ ...base, modo: "parcial", total: 180, saldo: 80, ajuste: 20, ajusteMotivo: "amigo" }, 200, "2026-10-10");
  assert.equal(c.monto, 100);
  assert.equal(c.ajuste, 20);
  assert.equal(c.fechaCompromiso, "2026-10-10");
});
