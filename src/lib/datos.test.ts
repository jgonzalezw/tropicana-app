import { test } from "node:test";
import assert from "node:assert/strict";
import { exigir, exigirUno } from "./datos.ts";

test("exigir devuelve los datos, o [] si no hay", () => {
  assert.deepEqual(exigir({ data: [1, 2], error: null }, "x"), [1, 2]);
  assert.deepEqual(exigir({ data: null, error: null }, "x"), []);
});

test("exigir lanza nombrando qué se estaba leyendo (un fallo no es una ausencia)", () => {
  assert.throws(
    () => exigir({ data: null, error: { message: "boom" } }, "las excepciones del horario de la sala"),
    /No se pudieron cargar las excepciones del horario de la sala: boom/
  );
});

test("exigirUno acepta null como resultado válido, pero no un error", () => {
  assert.equal(exigirUno({ data: null, error: null }, "el alumno"), null);
  assert.throws(() => exigirUno({ data: null, error: { message: "boom" } }, "el alumno"), /No se pudo cargar el alumno: boom/);
});
