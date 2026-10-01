/**
 * Cierre de cuentas de un profesor que se retira (excepción a la regla 8,
 * Javier 2026-10-01): el avance al corte se devenga ya, a cuenta de la
 * liquidación final. Misma base que los criterios 1–3; cambia cuándo se paga.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularDevengos, type DatosMotor, type MembresiaLiq } from "./motor.ts";
import type { Curso } from "../tipos.ts";

/** Lunes de agosto 2026: 3, 10, 17, 24, 31. */
const LUNES = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"];
const FIN = "2026-08-31";
const CORTE = "2026-08-17"; // 3 de las 5 clases

const curso = (id: number, nombre: string, dias: number[]): Curso => ({
  id, nombre, linea: null, estilo: null, nivel: null, dias_semana: dias, hora: "19:00",
  duracion_min: 60, sala_id: 1, precio_mensual: 400, activo: true, vigente_desde: null,
  vigente_hasta: null, creado_en: "2026-01-01", actualizado_en: "2026-01-01",
});
const sesion = (cursoId: number, fecha: string, estado = "dictada") => ({
  curso_id: cursoId, fecha, estado, reemplazo_motivo: null,
});

/** Una membresía de criterio 1, activa, cobrada `cobrado` de 1000, con el profesor 1 al 50 %. */
function datos(m: Partial<MembresiaLiq> = {}, cobrado = 1000): DatosMotor {
  return {
    membresias: [{
      id: 1, alumno_id: 1, curso_id: 1, plan_id: 1, es_prueba: false, acompanantes: null,
      fecha_inicio: "2026-08-03", fecha_fin: FIN, estado: "activa", criterio_liquidacion: 1, ...m,
    }],
    cursosDeMembresia: [{ membresia_id: 1, curso_id: 1, dias: [1], fecha: null }],
    comisionesPrevias: [],
    cuotas: [{ id: 1, membresia_id: 1, monto_devengado: 1000, descuento_adelanto: 0 }],
    pagos: [{ cuota_id: 1, monto: cobrado, descuento: 0 }],
    sesiones: LUNES.map((f) => sesion(1, f)),
    cursos: [curso(1, "Salsa", [1])],
    tarifas: [{ curso_id: 1, modalidad: "clase", precio: 50 }],
    asignaciones: [{ id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: null }],
    alumnos: [{ id: 1, nombre: "Ana", apellido: "Pérez" }],
    profesores: [{ id: 1, nombre: "P", apellido: "A" }, { id: 2, nombre: "S", apellido: "B" }],
  };
}

/** El profesor 1 se retira: tuvo el curso hasta el corte; el 2 lo toma al día siguiente. */
function conSustituto(d: DatosMotor): DatosMotor {
  d.asignaciones = [
    { id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: CORTE },
    { id: 2, curso_id: 1, profesor_id: 2, pct_ingresos: 40, desde: "2026-08-18", hasta: null },
  ];
  return d;
}

const cierre = (d: DatosMotor, profesorId = 1, corte = CORTE) =>
  calcularDevengos(d, "9999-12-31", { profesorId, corte });

test("cierre: paga el avance al corte aunque la membresía siga activa (criterio 1 no lo haría)", () => {
  const d = datos();
  assert.deepEqual(calcularDevengos(d, FIN).pendientes, [], "el criterio 1 espera a que se complete");
  const r = cierre(d).pendientes;
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "cierre");
  assert.equal(r[0].criterio, 1, "conserva el criterio de la membresía");
  assert.equal(r[0].clases, 3);
  assert.equal(r[0].clasesDelCurso, 5);
  assert.equal(r[0].base, 600);
  assert.equal(r[0].monto, 300);
  assert.equal(r[0].periodo, undefined, "el período lo decide quien liquida");
});

test("cierre: con saldo se paga proporcional a lo cobrado, y el resto llega como ajuste al cobrarse", () => {
  const parcial = datos({}, 600);
  const r = cierre(parcial).pendientes;
  assert.equal(r.length, 1);
  assert.equal(r[0].base, 360, "3/5 de lo cobrado (600)");
  assert.equal(r[0].monto, 180);

  // Después el alumno paga todo y la membresía se completa: sale un ajuste, no otro cierre.
  const completa = conSustituto(datos({ estado: "completada" }, 1000));
  completa.comisionesPrevias = [
    { id: 7, membresia_id: 1, curso_id: 1, profesor_id: 1, base: 360, monto: 180, tipo: "cierre", periodo: "2026-08-01" },
  ];
  const fin = calcularDevengos(completa, FIN).pendientes.filter((p) => p.profesorId === 1);
  assert.equal(fin.length, 1);
  assert.equal(fin[0].tipo, "ajuste");
  assert.equal(fin[0].base, 240);
  assert.equal(fin[0].monto, 120);
  assert.equal(fin[0].ajustaComisionId, 7);
  assert.equal(fin[0].periodo, "2026-08-01", "entra como complemento del período del cierre");
});

test("cierre: al completarse con sustituto, el que se fue no cobra dos veces y el sustituto cobra lo suyo", () => {
  const d = conSustituto(datos({ estado: "completada" }));
  d.comisionesPrevias = [
    { id: 7, membresia_id: 1, curso_id: 1, profesor_id: 1, base: 600, monto: 300, tipo: "cierre", periodo: "2026-08-01" },
  ];
  const r = calcularDevengos(d, FIN).pendientes;
  assert.equal(r.filter((p) => p.profesorId === 1).length, 0, "ya cobró lo suyo: delta 0");
  const s = r.filter((p) => p.profesorId === 2);
  assert.equal(s.length, 1);
  assert.equal(s[0].tipo, "comision");
  assert.equal(s[0].clases, 2);
  assert.equal(s[0].base, 400);
  assert.equal(s[0].monto, 160, "40 % de 400");
});

test("cierre: repetirlo no vuelve a pagar (idempotente)", () => {
  const d = datos();
  d.comisionesPrevias = [
    { id: 7, membresia_id: 1, curso_id: 1, profesor_id: 1, base: 600, monto: 300, tipo: "cierre", periodo: "2026-08-01" },
  ];
  assert.deepEqual(cierre(d).pendientes, []);
});

test("cierre: nunca descuenta lo ya devengado, aunque el cálculo dé menos", () => {
  const d = datos();
  d.comisionesPrevias = [
    { id: 7, membresia_id: 1, curso_id: 1, profesor_id: 1, base: 1000, monto: 500, tipo: "comision", periodo: "2026-08-01" },
  ];
  assert.deepEqual(cierre(d).pendientes, []);
});

test("cierre: es de UN profesor; el sustituto no entra", () => {
  const d = conSustituto(datos());
  assert.deepEqual(cierre(d, 2).pendientes.filter((p) => p.profesorId === 1), []);
  const r = cierre(d, 1).pendientes;
  assert.ok(r.every((p) => p.profesorId === 1));
});

test("cierre: sin nada cobrado no hay avance que pagar", () => {
  assert.deepEqual(cierre(datos({}, 0)).pendientes, []);
});

test("cierre: ilimitado se mide por calendario al corte, no por asistidas", () => {
  const d = datos({ clases_plan: null });
  const r = cierre(d).pendientes;
  assert.equal(r.length, 1);
  assert.equal(r[0].clases, 3);
  assert.equal(r[0].clasesDelCurso, 5);
  assert.equal(r[0].monto, 300);
});

test("cierre multi-curso: una clase pasada sin registrar traba esa membresía; las futuras no", () => {
  const d = datos();
  d.cursosDeMembresia = [
    { membresia_id: 1, curso_id: 1, dias: [1], fecha: null },
    { membresia_id: 1, curso_id: 2, dias: [3], fecha: null },
  ];
  d.cursos = [curso(1, "Salsa", [1]), curso(2, "Bachata", [3])];
  d.tarifas = [1, 2].map((c) => ({ curso_id: c, modalidad: "clase", precio: 50 }));
  d.asignaciones.push({ id: 3, curso_id: 2, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: null });
  // Bachata (miércoles) sin ninguna sesión registrada: faltan las pasadas.
  const trabada = cierre(d);
  assert.equal(trabada.pendientes.length, 0);
  assert.equal(trabada.bloqueadas.length, 1);
  assert.ok(trabada.bloqueadas[0].cursos.every((c) => c.fechas.every((f) => f <= CORTE)));
});

test("cierre: una clase suspendida después del corte no cambia lo que le toca", () => {
  const d = datos();
  d.sesiones = LUNES.map((f, i) => sesion(1, f, i === 4 ? "suspendida" : "dictada"));
  // Con una suspendida el ciclo tiene 4 clases (las 3 dictadas + 1): 3/4 de 1000 → base 750.
  const r = cierre(d).pendientes;
  assert.equal(r.length, 1);
  assert.equal(r[0].clasesDelCurso, 4);
  assert.equal(r[0].base, 750);
});
