import { test } from "node:test";
import assert from "node:assert/strict";
import { vigenciaDiasEfectiva, validarPlanParticular } from "./planesParticular.ts";
import type { DatosPlan } from "./tipos.ts";

test("vigenciaDiasEfectiva: usa la propia del plan si la tiene", () => {
  assert.equal(vigenciaDiasEfectiva(45, 2), 45);
});

test("vigenciaDiasEfectiva: sin la propia, usa el parámetro de la academia en meses", () => {
  assert.equal(vigenciaDiasEfectiva(null, 2), 60);
  assert.equal(vigenciaDiasEfectiva(null, 3), 90);
});

const BASE: DatosPlan = {
  nombre: "Pack 5 horas — Salsa",
  tipo_servicio: "particular",
  precio: 500,
  acceso_modo: "todas",
  clases_ilimitadas: false,
  cantidad_clases: null,
  ciclo_dias: null,
  criterio_liquidacion: 1,
  tolerancia_faltas: null,
  cursoIds: [],
  acepta_prueba: false,
  prueba_cursos_max: null,
  prueba_acredita: true,
  prueba_plazo_dias: null,
  estilo: "salsa",
  vigencia_dias: null,
  reserva_modalidad: "flexible",
  salas_modo: "todas",
  salaIds: [],
  forma_pago_profesor: "fee_hora",
  pago_pct_margen: null,
  pago_descuenta_sala: false,
  pago_monto_fijo: null,
  extension_modo: "lista",
  extension_recargo_pct: null,
  registra_acompanantes: false,
};

test("validarPlanParticular: un plan bien formado no da error", () => {
  assert.equal(validarPlanParticular(BASE), null);
});

test("validarPlanParticular: exige estilo", () => {
  assert.match(validarPlanParticular({ ...BASE, estilo: null })!, /estilo/);
});

test("validarPlanParticular: exige modalidad de reserva", () => {
  assert.match(validarPlanParticular({ ...BASE, reserva_modalidad: null })!, /modalidad de reserva/);
});

test("validarPlanParticular: salas_modo='solo' sin salas elegidas", () => {
  assert.match(
    validarPlanParticular({ ...BASE, salas_modo: "solo", salaIds: [] })!,
    /Elegí al menos una sala/
  );
  assert.equal(validarPlanParticular({ ...BASE, salas_modo: "solo", salaIds: [1] }), null);
});

test("validarPlanParticular: pct_margen exige el porcentaje", () => {
  assert.match(
    validarPlanParticular({ ...BASE, forma_pago_profesor: "pct_margen", pago_pct_margen: null })!,
    /% sobre el margen/
  );
  assert.equal(
    validarPlanParticular({ ...BASE, forma_pago_profesor: "pct_margen", pago_pct_margen: 40 }),
    null
  );
});

test("validarPlanParticular: monto_fijo exige el monto", () => {
  assert.match(
    validarPlanParticular({ ...BASE, forma_pago_profesor: "monto_fijo", pago_monto_fijo: null })!,
    /monto fijo/
  );
  assert.equal(
    validarPlanParticular({ ...BASE, forma_pago_profesor: "monto_fijo", pago_monto_fijo: 0 }),
    null
  );
});

test("validarPlanParticular: extension a recargo exige el porcentaje", () => {
  assert.match(
    validarPlanParticular({ ...BASE, extension_modo: "recargo", extension_recargo_pct: null })!,
    /recargo/
  );
  assert.equal(
    validarPlanParticular({ ...BASE, extension_modo: "recargo", extension_recargo_pct: 10 }),
    null
  );
});

test("validarPlanParticular: el criterio de particulares es 1, 2 o 3 (4 y 5 son de taller)", () => {
  assert.match(validarPlanParticular({ ...BASE, criterio_liquidacion: 4 })!, /criterio 1, 2 o 3/);
  assert.match(validarPlanParticular({ ...BASE, criterio_liquidacion: 5 })!, /criterio 1, 2 o 3/);
  assert.equal(validarPlanParticular({ ...BASE, criterio_liquidacion: 2 }), null);
});

test("validarPlanParticular: vigencia propia debe ser positiva", () => {
  assert.match(validarPlanParticular({ ...BASE, vigencia_dias: 0 })!, /vigencia/);
  assert.equal(validarPlanParticular({ ...BASE, vigencia_dias: 45 }), null);
});
