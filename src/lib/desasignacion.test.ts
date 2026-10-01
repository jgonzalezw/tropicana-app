import { test } from "node:test";
import assert from "node:assert/strict";
import { diaSiguiente, validarDesasignacion, type EntradaDesasignacion } from "./desasignacion.ts";

const base: EntradaDesasignacion = {
  desde: "2026-08-18",
  hasta: null,
  profesorId: 4,
  fecha: "2026-09-10",
  sustituto: null,
};

test("una fecha válida sin sustituto se acepta", () => {
  assert.equal(validarDesasignacion(base), null);
});

test("la fecha es obligatoria, válida y no anterior al inicio", () => {
  assert.match(validarDesasignacion({ ...base, fecha: "" })!, /Indicá/);
  assert.match(validarDesasignacion({ ...base, fecha: "2026-02-31" })!, /no es válida/);
  assert.match(validarDesasignacion({ ...base, fecha: "2026-08-17" })!, /anterior/);
  assert.equal(validarDesasignacion({ ...base, fecha: "2026-08-18" }), null);
});

test("una asignación cerrada no se vuelve a cerrar", () => {
  assert.match(validarDesasignacion({ ...base, hasta: "2026-09-01" })!, /ya está cerrada/);
});

test("el sustituto exige profesor distinto y porcentajes válidos", () => {
  const s = { profesorId: 9, pctIngresos: 50, pctReferido: 0 };
  assert.equal(validarDesasignacion({ ...base, sustituto: s }), null);
  assert.match(validarDesasignacion({ ...base, sustituto: { ...s, profesorId: null } })!, /Elegí/);
  assert.match(validarDesasignacion({ ...base, sustituto: { ...s, profesorId: 4 } })!, /mismo/);
  assert.match(validarDesasignacion({ ...base, sustituto: { ...s, pctIngresos: 0 } })!, /entre 1 y 100/);
  assert.match(validarDesasignacion({ ...base, sustituto: { ...s, pctReferido: 101 } })!, /entre 0 y 100/);
});

test("el día siguiente cruza fin de mes y de año", () => {
  assert.equal(diaSiguiente("2026-09-10"), "2026-09-11");
  assert.equal(diaSiguiente("2026-09-30"), "2026-10-01");
  assert.equal(diaSiguiente("2026-12-31"), "2027-01-01");
});
