/**
 * Fija el CONTEO DE CLASES del prorrateo tal como está hoy (regla 10:
 * calendario menos suspendidas), para planes multi-curso y para pruebas
 * grupales. Reproduce a escala el caso real de dev que Javier pidió revisar
 * (membresía #37, "Plan de Prueba Ili", ilimitada, 5 cursos; pruebas #32/#36).
 *
 * **Estas pruebas NO deciden** si en ilimitadas deben contar las clases
 * asistidas por el alumno: esa decisión está abierta (`docs/DECISIONES.md`,
 * fila H5). Si se cambia la regla 10, estas pruebas cambian con ella — y esa
 * decisión pasa primero por REGLAS.md.
 *
 * Archivo aparte a propósito: `motor.test.ts` queda intacto.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularDevengos, type DatosMotor, type MembresiaLiq } from "./motor.ts";
import type { Curso } from "../tipos.ts";

const HASTA = "2026-08-31";

function curso(id: number, nombre: string, dias: number[]): Curso {
  return {
    id, nombre, linea: null, estilo: null, nivel: null, dias_semana: dias, hora: "19:00",
    duracion_min: 60, sala_id: 1, precio_mensual: 400, activo: true, vigente_desde: null,
    vigente_hasta: null, creado_en: "2026-01-01", actualizado_en: "2026-01-01",
  };
}

const sesion = (cursoId: number, fecha: string, estado: "dictada" | "suspendida" = "dictada") => ({
  curso_id: cursoId, fecha, estado, reemplazo_motivo: null,
});

/** Lunes de agosto 2026: 3, 10, 17, 24, 31. Miércoles: 5, 12, 19, 26. Sábados: 1, 8, 15, 22, 29. */
const LUNES = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"];
const MIERC = ["2026-08-05", "2026-08-12", "2026-08-19", "2026-08-26"];
const SABAD = ["2026-08-01", "2026-08-08", "2026-08-15", "2026-08-22", "2026-08-29"];

const asign = (id: number, cursoId: number, profId: number) => ({
  id, curso_id: cursoId, profesor_id: profId, pct_ingresos: 50, desde: "2026-01-01", hasta: null as string | null,
});

function base(m: Partial<MembresiaLiq>): DatosMotor {
  return {
    membresias: [{
      id: 1, alumno_id: 1, curso_id: 1, plan_id: 1, es_prueba: false, acompanantes: null,
      fecha_inicio: "2026-08-01", fecha_fin: "2026-08-31", ...m,
    }],
    cursosDeMembresia: [],
    comisionesPrevias: [],
    cuotas: [{ id: 1, membresia_id: 1, monto_devengado: 1000, descuento_adelanto: 0 }],
    pagos: [{ cuota_id: 1, monto: 1000, descuento: 0 }],
    sesiones: [],
    cursos: [],
    tarifas: [],
    asignaciones: [],
    alumnos: [{ id: 1, nombre: "Ana", apellido: "Pérez" }],
    profesores: [1, 2, 3].map((id) => ({ id, nombre: `P${id}`, apellido: `A${id}` })),
  };
}

test("C1. ilimitada multi-curso: cada curso cuenta calendario menos SUS suspendidas", () => {
  const d = base({});
  d.cursosDeMembresia = [
    { membresia_id: 1, curso_id: 1, dias: [1], fecha: null }, // lunes: 5, 2 suspendidas → 3
    { membresia_id: 1, curso_id: 2, dias: [3], fecha: null }, // miércoles: 4, ninguna → 4
    { membresia_id: 1, curso_id: 3, dias: [6], fecha: null }, // sábados: 5, 4 suspendidas → 1
  ];
  d.cursos = [curso(1, "Salsa", [1]), curso(2, "Bachata", [3]), curso(3, "Heels", [6])];
  d.tarifas = [1, 2, 3].map((c) => ({ curso_id: c, modalidad: "clase", precio: 50 }));
  d.asignaciones = [asign(1, 1, 1), asign(2, 2, 2), asign(3, 3, 3)];
  d.sesiones = [
    sesion(1, LUNES[0]), sesion(1, LUNES[1]), sesion(1, LUNES[2], "suspendida"),
    sesion(1, LUNES[3], "suspendida"), sesion(1, LUNES[4]),
    ...MIERC.map((f) => sesion(2, f)),
    sesion(3, SABAD[0]), ...SABAD.slice(1).map((f) => sesion(3, f, "suspendida")),
  ];
  const p = calcularDevengos(d, HASTA).pendientes;
  const clases = Object.fromEntries(p.map((x) => [x.cursoId, x.clases]));
  assert.deepEqual(clases, { 1: 3, 2: 4, 3: 1 });
  // Pesos 3×50, 4×50, 1×50 = 400 sobre 1000 cobrados: las bases suman exacto.
  assert.equal(Math.round(p.reduce((s, x) => s + x.base, 0) * 100) / 100, 1000);
  const porCurso = Object.fromEntries(p.map((x) => [x.cursoId, x.base]));
  assert.equal(porCurso[1], 375);
  assert.equal(porCurso[2], 500);
  assert.equal(porCurso[3], 125);
});

test("C2. prueba grupal de 3 personas: una clase por curso, peso ×3, partes iguales si cuestan igual", () => {
  const d = base({
    es_prueba: true, acompanantes: 2, fecha_inicio: "2026-08-03", fecha_fin: "2026-08-05",
  });
  d.cuotas = [{ id: 1, membresia_id: 1, monto_devengado: 180, descuento_adelanto: 0 }];
  d.pagos = [{ cuota_id: 1, monto: 180, descuento: 0 }];
  d.cursosDeMembresia = [
    { membresia_id: 1, curso_id: 1, dias: null, fecha: "2026-08-03" },
    { membresia_id: 1, curso_id: 2, dias: null, fecha: "2026-08-05" },
  ];
  d.cursos = [curso(1, "Salsa", [1]), curso(2, "Tropico", [3])];
  d.tarifas = [
    { curso_id: 1, modalidad: "prueba", precio: 30 },
    { curso_id: 2, modalidad: "prueba", precio: 30 },
  ];
  d.asignaciones = [asign(1, 1, 1), asign(2, 2, 2)];
  d.sesiones = [sesion(1, "2026-08-03"), sesion(2, "2026-08-05")];
  const p = calcularDevengos(d, HASTA).pendientes;
  assert.equal(p.length, 2);
  for (const x of p) {
    assert.equal(x.clases, 1);
    assert.equal(x.personas, 3);
    assert.equal(x.base, 90, "180 ÷ 2 cursos");
  }
});

test("C3. prueba multi-curso con precios distintos: pesa el precio de prueba de cada curso × personas", () => {
  const d = base({
    es_prueba: true, acompanantes: 0, fecha_inicio: "2026-08-31", fecha_fin: "2026-08-31",
  });
  d.cuotas = [{ id: 1, membresia_id: 1, monto_devengado: 210, descuento_adelanto: 0 }];
  d.pagos = [{ cuota_id: 1, monto: 210, descuento: 0 }];
  d.cursosDeMembresia = [
    { membresia_id: 1, curso_id: 1, dias: null, fecha: "2026-08-31" },
    { membresia_id: 1, curso_id: 2, dias: null, fecha: "2026-08-31" },
  ];
  d.cursos = [curso(1, "Salsa", [1]), curso(2, "Tropico", [1])];
  d.tarifas = [
    { curso_id: 1, modalidad: "prueba", precio: 40 },
    { curso_id: 2, modalidad: "prueba", precio: 30 },
  ];
  d.asignaciones = [asign(1, 1, 1), asign(2, 2, 2)];
  d.sesiones = [sesion(1, "2026-08-31"), sesion(2, "2026-08-31")];
  const porCurso = Object.fromEntries(
    calcularDevengos(d, HASTA).pendientes.map((x) => [x.cursoId, x.base])
  );
  // Pesos 40 y 30 (tarifa de prueba) sobre 210 → 120 y 90, como la membresía #36 de dev.
  assert.equal(porCurso[1], 120);
  assert.equal(porCurso[2], 90);
});
