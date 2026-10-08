import { test } from "node:test";
import assert from "node:assert/strict";
import { ordinalDeClase, type EntradaOrdinal } from "./ordinalClase.ts";

const dictadas = ["2026-09-01", "2026-09-03", "2026-09-08", "2026-09-10"];

const plan: EntradaOrdinal = {
  clasesPlan: 8,
  clasesTotal: null,
  fechasDictadas: dictadas,
  fechasPresentes: dictadas,
  fecha: "2026-09-15",
};

test("la primera clase es la 1", () => {
  assert.deepEqual(ordinalDeClase({ ...plan, fechasDictadas: [], fechasPresentes: [] }), {
    numero: 1, total: 8, quedan: 7, ultima: false,
  });
});

test("la del medio cuenta las dictadas anteriores", () => {
  assert.deepEqual(ordinalDeClase(plan), { numero: 5, total: 8, quedan: 3, ultima: false });
});

test("la última se marca y no deja quedan negativos", () => {
  const siete = ["2026-09-01", "2026-09-03", "2026-09-08", "2026-09-10", "2026-09-15", "2026-09-17", "2026-09-22"];
  assert.deepEqual(ordinalDeClase({ ...plan, fechasDictadas: siete, fecha: "2026-09-24" }), {
    numero: 8, total: 8, quedan: 0, ultima: true,
  });
  assert.equal(ordinalDeClase({ ...plan, fechasDictadas: [...siete, "2026-09-24"], fecha: "2026-09-29" })!.quedan, 0);
});

test("en una fecha pasada no cuentan las clases posteriores ni la del propio día", () => {
  assert.deepEqual(ordinalDeClase({ ...plan, fecha: "2026-09-03" }), { numero: 2, total: 8, quedan: 6, ultima: false });
});

test("un paquete por clase cuenta las presentes: una falta no consume", () => {
  const r = ordinalDeClase({
    clasesPlan: null,
    clasesTotal: 8,
    fechasDictadas: dictadas,
    fechasPresentes: ["2026-09-01", "2026-09-08"],
    fecha: "2026-09-15",
  });
  assert.deepEqual(r, { numero: 3, total: 8, quedan: 5, ultima: false });
});

test("ilimitado o legado sin N no tiene número", () => {
  assert.equal(ordinalDeClase({ ...plan, clasesPlan: null, clasesTotal: null }), null);
});
