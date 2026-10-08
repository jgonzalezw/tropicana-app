import { test } from "node:test";
import assert from "node:assert/strict";
import { finDePeriodoISO, rangoEnCurso } from "./periodo.ts";

test("mes: del 1 al último día, también en febrero bisiesto", () => {
  const r = rangoEnCurso("mes", new Date(2028, 1, 10));
  assert.ok(r.ok);
  assert.deepEqual([r.desdeISO, r.hastaISO, r.periodo], ["2028-02-01", "2028-02-29", "2028-02-01"]);
});

test("semana: de lunes a domingo, con un domingo como hoy", () => {
  const r = rangoEnCurso("semana", new Date(2026, 9, 11)); // domingo 11/10/2026
  assert.ok(r.ok);
  assert.deepEqual([r.desdeISO, r.hastaISO], ["2026-10-05", "2026-10-11"]);
});

test("semana: cruza el cambio de mes y de año", () => {
  const r = rangoEnCurso("semana", new Date(2026, 11, 31)); // jueves 31/12/2026
  assert.ok(r.ok);
  assert.deepEqual([r.desdeISO, r.hastaISO], ["2026-12-28", "2027-01-03"]);
});

test("un valor desconocido es un error explícito", () => {
  const r = rangoEnCurso("quincena", new Date(2026, 9, 7));
  assert.ok(!r.ok);
  assert.match(r.error, /quincena/);
});

test("finDePeriodoISO: fin del mes o semana de un período", () => {
  assert.equal(finDePeriodoISO("2026-09-01", "mes"), "2026-09-30");
  assert.equal(finDePeriodoISO("2026-02-01", "mes"), "2026-02-28");
  assert.equal(finDePeriodoISO("2026-09-28", "semana"), "2026-10-04");
});
