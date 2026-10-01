/**
 * Criterios 2 y 3 para cursos regulares (Paso 4 de H5). Misma base que el
 * criterio 1 —lo cobrado repartido a prorrata—; cambia solo cuándo se paga.
 * Archivo aparte: `motor.test.ts` (criterio 1) queda intacto.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularDevengos, type DatosMotor, type MembresiaLiq } from "./motor.ts";
import type { Curso } from "../tipos.ts";

/** Lunes de agosto 2026: 3, 10, 17, 24, 31. */
const LUNES = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"];

const curso = (id: number, nombre: string, dias: number[]): Curso => ({
  id, nombre, linea: null, estilo: null, nivel: null, dias_semana: dias, hora: "19:00",
  duracion_min: 60, sala_id: 1, precio_mensual: 400, activo: true, vigente_desde: null,
  vigente_hasta: null, creado_en: "2026-01-01", actualizado_en: "2026-01-01",
});
const sesion = (cursoId: number, fecha: string) => ({ curso_id: cursoId, fecha, estado: "dictada", reemplazo_motivo: null });

function datos(m: Partial<MembresiaLiq>, cobrado = 1000): DatosMotor {
  return {
    membresias: [{
      id: 1, alumno_id: 1, curso_id: 1, plan_id: 1, es_prueba: false, acompanantes: null,
      fecha_inicio: "2026-08-03", fecha_fin: "2026-08-31", estado: "completada", criterio_liquidacion: 1, ...m,
    }],
    cursosDeMembresia: [{ membresia_id: 1, curso_id: 1, dias: [1], fecha: null }],
    comisionesPrevias: [],
    cuotas: [{ id: 1, membresia_id: 1, monto_devengado: cobrado, descuento_adelanto: 0 }],
    pagos: [{ cuota_id: 1, monto: cobrado, descuento: 0 }],
    sesiones: LUNES.map((f) => sesion(1, f)),
    cursos: [curso(1, "Salsa", [1])],
    tarifas: [{ curso_id: 1, modalidad: "clase", precio: 50 }],
    asignaciones: [{ id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: null }],
    alumnos: [{ id: 1, nombre: "Ana", apellido: "Pérez" }],
    profesores: [{ id: 1, nombre: "P", apellido: "A" }],
  };
}

test("criterio 1 es el default: una activa no liquida, una completada sí", () => {
  assert.deepEqual(calcularDevengos(datos({ estado: "activa" }), "2026-08-31").pendientes, []);
  const r = calcularDevengos(datos({ criterio_liquidacion: null }), "2026-08-31").pendientes;
  assert.equal(r.length, 1);
  assert.equal(r[0].criterio, 1);
  assert.equal(r[0].monto, 500);
  assert.equal(r[0].periodo, undefined, "cae en el período vencido");
});

test("criterio 3: paga al completarse, en el mes que terminó el ciclo, sin esperar el cierre", () => {
  const d = datos({ criterio_liquidacion: 3, fecha_fin: "2026-09-15", fecha_inicio: "2026-08-17" });
  d.sesiones = ["2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14"].map((f) => sesion(1, f));
  const c1 = calcularDevengos({ ...d, membresias: [{ ...d.membresias[0], criterio_liquidacion: 1 }] }, "2026-08-31");
  assert.deepEqual(c1.pendientes, [], "el criterio 1 espera al período vencido");
  const r = calcularDevengos(d, "2026-08-31").pendientes;
  assert.equal(r.length, 1);
  assert.equal(r[0].criterio, 3);
  assert.equal(r[0].tipo, "comision");
  assert.equal(r[0].periodo, "2026-09-01");
  assert.equal(r[0].monto, 500, "misma base que el criterio 1");
});

test("criterio 3 sin completar (activa) no paga", () => {
  assert.deepEqual(calcularDevengos(datos({ criterio_liquidacion: 3, estado: "activa" }), "2026-08-31").pendientes, []);
});

test("criterio 2: paga el avance a la fecha, aun con la membresía en curso", () => {
  const r = calcularDevengos(datos({ criterio_liquidacion: 2, estado: "activa" }), "2026-08-17").pendientes;
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "avance");
  assert.equal(r[0].criterio, 2);
  assert.equal(r[0].clases, 3, "3 de las 5 clases dictadas al corte");
  assert.equal(r[0].clasesDelCurso, 5);
  assert.equal(r[0].base, 600);
  assert.equal(r[0].monto, 300);
  assert.equal(r[0].periodo, undefined, "va al período que se liquida");
});

test("criterio 2: la siguiente liquidación paga solo la diferencia, y al final suma lo mismo que el criterio 1", () => {
  const d = datos({ criterio_liquidacion: 2, estado: "activa" });
  d.comisionesPrevias = [{ id: 1, membresia_id: 1, curso_id: 1, profesor_id: 1, base: 600, monto: 300, tipo: "avance", periodo: "2026-08-01" }];
  const r = calcularDevengos(d, "2026-08-31").pendientes;
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "avance");
  assert.equal(r[0].base, 400);
  assert.equal(r[0].monto, 200);
  assert.equal(300 + r[0].monto, 500);
  // Ya al día: no emite nada.
  d.comisionesPrevias[0] = { ...d.comisionesPrevias[0], base: 1000, monto: 500 };
  assert.deepEqual(calcularDevengos(d, "2026-08-31").pendientes, []);
});

test("criterio 2: exige estar cobrada al 100%", () => {
  const d = datos({ criterio_liquidacion: 2, estado: "activa" });
  d.cuotas = [{ id: 1, membresia_id: 1, monto_devengado: 1000, descuento_adelanto: 0 }];
  d.pagos = [{ cuota_id: 1, monto: 600, descuento: 0 }];
  assert.deepEqual(calcularDevengos(d, "2026-08-31").pendientes, []);
});

test("criterio 2: una reserva corregida tarde da un delta negativo en el período actual, sin reabrir nada", () => {
  const d = datos({ criterio_liquidacion: 2, estado: "activa" });
  // Ya se le devengaron 3 de 5 clases (300); ahora una de ellas se suspendió
  // y quedan 4 clases en el ciclo: 2 de 4 dictadas al corte = 50% → 250.
  d.sesiones = LUNES.map((f, i) => ({ ...sesion(1, f), estado: i === 1 ? "suspendida" : "dictada" }));
  d.comisionesPrevias = [{ id: 1, membresia_id: 1, curso_id: 1, profesor_id: 1, base: 600, monto: 300, tipo: "avance", periodo: "2026-08-01" }];
  const r = calcularDevengos(d, "2026-08-17").pendientes;
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "avance");
  assert.equal(r[0].monto, -50);
  assert.equal(r[0].periodo, undefined);
});

test("criterio 2 multi-curso: las clases futuras sin registrar no bloquean; las pasadas sí", () => {
  const d = datos({ criterio_liquidacion: 2, estado: "activa" });
  d.cursosDeMembresia = [
    { membresia_id: 1, curso_id: 1, dias: [1], fecha: null },
    { membresia_id: 1, curso_id: 2, dias: [3], fecha: null },
  ];
  d.cursos = [curso(1, "Salsa", [1]), curso(2, "Bachata", [3])];
  d.tarifas = [1, 2].map((c) => ({ curso_id: c, modalidad: "clase", precio: 50 }));
  d.asignaciones = [1, 2].map((c) => ({ id: c, curso_id: c, profesor_id: c, pct_ingresos: 50, desde: "2026-01-01", hasta: null }));
  d.profesores = [1, 2].map((id) => ({ id, nombre: `P${id}`, apellido: "A" }));
  const miercoles = ["2026-08-05", "2026-08-12", "2026-08-19", "2026-08-26"];
  d.sesiones = [...LUNES.map((f) => sesion(1, f)), ...miercoles.slice(0, 2).map((f) => sesion(2, f))];
  // Al 12/08 las dos clases de miércoles ya pasaron y están registradas; las
  // del 19 y 26 son futuras: no traban.
  const ok = calcularDevengos(d, "2026-08-12");
  assert.deepEqual(ok.bloqueadas, []);
  assert.ok(ok.pendientes.length > 0);
  // Al 19/08 la del 19 ya pasó y no está registrada: la membresía espera.
  const traba = calcularDevengos(d, "2026-08-19");
  assert.equal(traba.bloqueadas.length, 1);
  assert.deepEqual(traba.bloqueadas[0].cursos[0].fechas, ["2026-08-19"]);
});

test("criterio 4 o 5 en una regular no se liquida por este motor", () => {
  assert.deepEqual(calcularDevengos(datos({ criterio_liquidacion: 4 }), "2026-08-31").pendientes, []);
});

// ── Ilimitadas: cuentan solo las clases asistidas (regla 10, 2026-10-01) ─────

const MIERC = ["2026-08-05", "2026-08-12", "2026-08-19", "2026-08-26"];

function multi(m: Partial<MembresiaLiq>): DatosMotor {
  const d = datos(m);
  d.cursosDeMembresia = [
    { membresia_id: 1, curso_id: 1, dias: [1], fecha: null },
    { membresia_id: 1, curso_id: 2, dias: [3], fecha: null },
  ];
  d.cursos = [curso(1, "Salsa", [1]), curso(2, "Bachata", [3])];
  d.tarifas = [1, 2].map((c) => ({ curso_id: c, modalidad: "clase", precio: 50 }));
  d.asignaciones = [1, 2].map((c) => ({ id: c, curso_id: c, profesor_id: c, pct_ingresos: 50, desde: "2026-01-01", hasta: null }));
  d.profesores = [1, 2].map((id) => ({ id, nombre: `P${id}`, apellido: "A" }));
  d.sesiones = [...LUNES.map((f) => sesion(1, f)), ...MIERC.map((f) => sesion(2, f))];
  return d;
}

test("ilimitada: el conteo es lo que el alumno asistió, no el calendario", () => {
  const d = multi({ clases_plan: null });
  d.asistencias = [
    ...LUNES.slice(0, 3).map((f) => ({ membresia_id: 1, curso_id: 1, fecha: f })),
    ...MIERC.map((f) => ({ membresia_id: 1, curso_id: 2, fecha: f })),
  ];
  const p = calcularDevengos(d, "2026-08-31").pendientes;
  assert.deepEqual(Object.fromEntries(p.map((x) => [x.cursoId, x.clases])), { 1: 3, 2: 4 });
  assert.equal(Math.round(p.reduce((s, x) => s + x.base, 0) * 100) / 100, 1000);
});

test("plan con N clases sigue por calendario aunque falte asistencia", () => {
  const d = multi({ clases_plan: 8 });
  d.asistencias = LUNES.slice(0, 3).map((f) => ({ membresia_id: 1, curso_id: 1, fecha: f }));
  const p = calcularDevengos(d, "2026-08-31").pendientes;
  assert.deepEqual(Object.fromEntries(p.map((x) => [x.cursoId, x.clases])), { 1: 5, 2: 4 });
});

test("ilimitada: un curso sin ninguna asistencia no cobra", () => {
  const d = multi({ clases_plan: null });
  d.asistencias = LUNES.map((f) => ({ membresia_id: 1, curso_id: 1, fecha: f }));
  const p = calcularDevengos(d, "2026-08-31").pendientes;
  assert.deepEqual(p.map((x) => x.cursoId), [1]);
  assert.equal(p[0].base, 1000);
});
