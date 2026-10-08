import { test } from "node:test";
import assert from "node:assert/strict";
import { avanceAlCorte, ordinalDeClase, type EntradaOrdinal } from "./ordinalClase.ts";

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

test("avance al corte: en un plan de N cuenta la clase dictada a la que faltó (la falta también es clase)", () => {
  // Luz Marina: 01/10 presente, 06/10 ausente. Antes salía 1 de 8 por contar solo presentes.
  const e = {
    clasesPlan: 8, clasesTotal: null,
    fechasDictadas: ["2026-10-01", "2026-10-06"], fechasPresentes: ["2026-10-01"],
  };
  assert.deepEqual(avanceAlCorte(e, "2026-10-06"), { hechas: 2, total: 8 });
  assert.deepEqual(avanceAlCorte(e, "2026-10-05"), { hechas: 1, total: 8 }); // el corte es inclusive, no más
});

test("avance al corte: un paquete cuenta solo las presentes y un ilimitado no inventa total", () => {
  const paquete = { clasesPlan: null, clasesTotal: 4, fechasDictadas: ["2026-10-01", "2026-10-06"], fechasPresentes: ["2026-10-01"] };
  assert.deepEqual(avanceAlCorte(paquete, "2026-10-31"), { hechas: 1, total: 4 });
  const ilimitado = { clasesPlan: null, clasesTotal: null, fechasDictadas: ["2026-10-01"], fechasPresentes: ["2026-10-01"] };
  assert.deepEqual(avanceAlCorte(ilimitado, "2026-10-31"), { hechas: 1, total: null });
});

test("el avance al corte y el número de clase usan la misma regla", () => {
  const e = { clasesPlan: 8, clasesTotal: null, fechasDictadas: ["2026-10-01", "2026-10-06"], fechasPresentes: ["2026-10-01"] };
  // La clase 3 es la del 08/10: antes de ella hay 2 consumidas = lo que el avance cuenta al 06/10.
  assert.equal(ordinalDeClase({ ...e, fecha: "2026-10-08" })!.numero, avanceAlCorte(e, "2026-10-06").hechas + 1);
});
