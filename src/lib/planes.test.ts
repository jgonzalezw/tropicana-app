import { test } from "node:test";
import assert from "node:assert/strict";
import { validarDatosPlan } from "./planes.ts";
import type { DatosPlan } from "./tipos.ts";

const base = {
  nombre: "X",
  precio: 100,
  criterio_liquidacion: 1,
  tipo_servicio: "curso_regular",
  acceso_modo: "todas",
  cursoIds: [],
  clases_ilimitadas: true,
  cantidad_clases: null,
  ciclo_dias: 30,
} as unknown as DatosPlan;

test("criterio 2 no se permite en un plan ilimitado", () => {
  assert.match(validarDatosPlan({ ...base, criterio_liquidacion: 2 }) ?? "", /ilimitado/);
});

test("criterio 1 y 3 valen en un plan ilimitado", () => {
  assert.equal(validarDatosPlan({ ...base, criterio_liquidacion: 1 }), null);
  assert.equal(validarDatosPlan({ ...base, criterio_liquidacion: 3 }), null);
});

test("criterio 2 sí vale en un plan con N clases", () => {
  assert.equal(
    validarDatosPlan({ ...base, criterio_liquidacion: 2, clases_ilimitadas: false, cantidad_clases: 8, ciclo_dias: null }),
    null
  );
});
