import { test } from "node:test";
import assert from "node:assert/strict";
import { validarPlanAlquiler, validarRecargoExtension } from "./planesAlquiler.ts";
import { validarDatosPlan } from "./planes.ts";
import type { DatosPlan } from "./tipos.ts";

const BASE: DatosPlan = {
  nombre: "ALQUILER AGENDA FIJA",
  tipo_servicio: "alquiler",
  precio: 0,
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
  estilo: null,
  vigencia_dias: 30,
  reserva_modalidad: "fija",
  salas_modo: "todas",
  salaIds: [],
  forma_pago_profesor: null,
  pago_pct_margen: null,
  pago_descuenta_sala: false,
  pago_monto_fijo: null,
  extension_modo: "lista",
  extension_recargo_pct: null,
  registra_acompanantes: false,
  permite_sala_externa: false,
  permite_cortesia: false,
};

test("un plan de alquiler completo es válido, sin estilo, profesor ni precio", () => {
  assert.equal(validarPlanAlquiler(BASE), null);
  assert.equal(validarDatosPlan(BASE), null);
});

test("exige modalidad de reserva", () => {
  assert.match(validarPlanAlquiler({ ...BASE, reserva_modalidad: null })!, /modalidad/);
});

test("exige vigencia en días mayor a 0", () => {
  assert.match(validarPlanAlquiler({ ...BASE, vigencia_dias: null })!, /vigencia/i);
  assert.match(validarPlanAlquiler({ ...BASE, vigencia_dias: 0 })!, /vigencia/i);
});

test("salas 'solo algunas' exige al menos una", () => {
  assert.match(validarPlanAlquiler({ ...BASE, salas_modo: "solo", salaIds: [] })!, /sala/);
  assert.equal(validarPlanAlquiler({ ...BASE, salas_modo: "solo", salaIds: [1] }), null);
});

test("recargo: exige porcentaje y respeta el tope", () => {
  const conRecargo = { ...BASE, extension_modo: "recargo" as const };
  assert.match(validarPlanAlquiler({ ...conRecargo, extension_recargo_pct: null })!, /recargo/i);
  assert.equal(validarPlanAlquiler({ ...conRecargo, extension_recargo_pct: 100 }, 100), null);
  assert.match(validarPlanAlquiler({ ...conRecargo, extension_recargo_pct: 101 }, 100)!, /100%/);
  assert.equal(validarRecargoExtension({ ...BASE, extension_modo: "lista" }, 100), null);
});

test("un alquiler no puede usar los criterios 4 y 5 (son de taller)", () => {
  assert.match(validarDatosPlan({ ...BASE, criterio_liquidacion: 4 })!, /taller/);
});
