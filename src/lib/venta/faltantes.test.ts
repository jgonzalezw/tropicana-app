import { test } from "node:test";
import assert from "node:assert/strict";
import {
  faltaParaInscripcion,
  faltaParaParticular,
  faltaParaPrueba,
  type EstadoVentaInscripcion,
  type EstadoVentaParticular,
  type EstadoVentaPrueba,
} from "./faltantes.ts";

const completo: EstadoVentaParticular = {
  contactoId: 1,
  planId: 2,
  tarifaId: 3,
  profesorId: 4,
  salaTipo: "propia",
  salaId: 5,
  nombreExterna: "",
  fechaInicio: "2026-10-05",
  esFija: true,
  diasSemana: [1],
  hora: "18:00",
  horaAlineada: true,
  duracionMin: 60,
  esCortesia: false,
  cortesiaMotivo: "",
};

test("particular completa: no falta nada", () => {
  assert.equal(faltaParaParticular(completo), null);
});

test("particular: dice lo primero que falta, en el orden de la pantalla", () => {
  assert.equal(faltaParaParticular({ ...completo, contactoId: null, planId: null }), "el titular");
  assert.equal(faltaParaParticular({ ...completo, profesorId: null }), "el profesor");
  assert.equal(faltaParaParticular({ ...completo, salaId: null }), "la sala");
  assert.equal(faltaParaParticular({ ...completo, salaTipo: "externa", nombreExterna: " " }), "el nombre del lugar");
  assert.equal(faltaParaParticular({ ...completo, diasSemana: [] }), "los días de la agenda fija");
  assert.equal(faltaParaParticular({ ...completo, esFija: false, diasSemana: [] }), null);
});

test("particular: la cortesía exige su motivo", () => {
  assert.equal(faltaParaParticular({ ...completo, esCortesia: true }), "el motivo de la cortesía");
  assert.equal(faltaParaParticular({ ...completo, esCortesia: true, cortesiaMotivo: "bienvenida" }), null);
});

const inscripcion: EstadoVentaInscripcion = {
  contactoId: 1,
  planId: 2,
  planCompleto: true,
  yaTiene: false,
  diasElegidos: 2,
  fechaInicio: "2026-10-05",
};

test("inscripción completa: no falta nada", () => {
  assert.equal(faltaParaInscripcion(inscripcion), null);
});

test("inscripción: dice lo primero que falta, en el orden de la pantalla", () => {
  assert.equal(faltaParaInscripcion({ ...inscripcion, contactoId: null, planId: null }), "el alumno");
  assert.equal(faltaParaInscripcion({ ...inscripcion, planId: null }), "el plan");
  assert.match(faltaParaInscripcion({ ...inscripcion, yaTiene: true }) ?? "", /ya tiene/);
  assert.equal(faltaParaInscripcion({ ...inscripcion, diasElegidos: 0 }), "al menos un día de clase");
  assert.equal(faltaParaInscripcion({ ...inscripcion, fechaInicio: null }), "una fecha de inicio válida");
});

const prueba: EstadoVentaPrueba = { contactoId: 1, planId: 2, cursosElegidos: 1, cursosSinFecha: 0 };

test("prueba: completa y con faltantes en orden", () => {
  assert.equal(faltaParaPrueba(prueba), null);
  assert.equal(faltaParaPrueba({ ...prueba, contactoId: null }), "quién viene a probar");
  assert.equal(faltaParaPrueba({ ...prueba, cursosElegidos: 0 }), "al menos un curso para probar");
  assert.equal(faltaParaPrueba({ ...prueba, cursosSinFecha: 1 }), "la fecha de la clase de cada curso");
});
