import { test } from "node:test";
import assert from "node:assert/strict";
import { liquidar, parametrosMotores, SIN_LIMITE } from "./liquidar.ts";

test("vencido: los dos motores miden al fin del período vencido, con el hoy real", () => {
  const p = parametrosMotores({ tipo: "vencido", hastaISO: "2026-09-30", periodoVencido: "2026-09-01", hoyISO: "2026-10-08" });
  assert.deepEqual(p.regular, { hastaISO: "2026-09-30" });
  assert.deepEqual(p.particulares, { hastaISO: "2026-09-30", periodoVencido: "2026-09-01", hoyISO: "2026-10-08" });
  assert.equal(p.cursoId, undefined);
});

test("simulación: «hoy» de los particulares es el fin del período", () => {
  const p = parametrosMotores({ tipo: "simulacion", hastaISO: "2026-10-31", periodoVencido: "2026-10-01" });
  assert.equal(p.particulares?.hoyISO, "2026-10-31");
  assert.equal(p.regular.cierre, undefined);
});

test("retiro: avance al corte para regulares y particulares, período del mes del corte", () => {
  const p = parametrosMotores({ tipo: "retiro", profesorId: 7, corte: "2026-10-06", hoyISO: "2026-10-08" });
  assert.deepEqual(p.regular, { hastaISO: SIN_LIMITE, cierre: { profesorId: 7, corte: "2026-10-06" } });
  assert.deepEqual(p.particulares, {
    hastaISO: "2026-10-06", periodoVencido: "2026-10-01", hoyISO: "2026-10-08",
    cierre: { profesorId: 7, corte: "2026-10-06" },
  });
});

test("curso: solo regulares y solo ese curso", () => {
  const p = parametrosMotores({ tipo: "curso", profesorId: 7, cursoId: 3, corte: "2026-10-06" });
  assert.equal(p.particulares, null);
  assert.equal(p.cursoId, 3);
  assert.deepEqual(p.regular.cierre, { profesorId: 7, corte: "2026-10-06" });
});

test("sin datos no hay nada que liquidar, en ningún modo", () => {
  const r = liquidar({ regular: null, particulares: null }, { tipo: "retiro", profesorId: 1, corte: "2026-10-06", hoyISO: "2026-10-08" });
  assert.deepEqual(r, { regular: { pendientes: [], bloqueadas: [] }, particulares: { pendientes: [], bloqueadas: [] } });
});

// ---- Multi-curso: el prorrateo sigue saliendo por el proceso único ----
import { calcularDevengos, type DatosMotor } from "./motor.ts";
import type { Curso } from "../tipos.ts";

const cursoMC = (id: number, nombre: string, dia: number, precio: number): Curso => ({
  id, nombre, linea: null, estilo: null, nivel: null, dias_semana: [dia], hora: "19:00",
  duracion_min: 60, sala_id: 1, precio_mensual: precio, activo: true, vigente_desde: null,
  vigente_hasta: null, creado_en: "2026-01-01", actualizado_en: "2026-01-01",
});
// Lunes (curso 1) y miércoles (curso 2) de agosto 2026.
const LUNES = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"];
const MIERC = ["2026-08-05", "2026-08-12", "2026-08-19", "2026-08-26"];

function datosMultiCurso(): DatosMotor {
  return {
    membresias: [{
      id: 1, alumno_id: 1, curso_id: 1, plan_id: 1, es_prueba: false, acompanantes: null,
      fecha_inicio: "2026-08-03", fecha_fin: "2026-08-31", estado: "completada", criterio_liquidacion: 1,
    }],
    cursosDeMembresia: [
      { membresia_id: 1, curso_id: 1, dias: [1], fecha: null },
      { membresia_id: 1, curso_id: 2, dias: [3], fecha: null },
    ],
    comisionesPrevias: [],
    cuotas: [{ id: 1, membresia_id: 1, monto_devengado: 900, descuento_adelanto: 0 }],
    pagos: [{ cuota_id: 1, monto: 900, descuento: 0 }],
    sesiones: [
      ...LUNES.map((f) => ({ curso_id: 1, fecha: f, estado: "dictada", reemplazo_motivo: null })),
      ...MIERC.map((f) => ({ curso_id: 2, fecha: f, estado: "dictada", reemplazo_motivo: null })),
    ],
    cursos: [cursoMC(1, "Salsa", 1, 400), cursoMC(2, "Bachata", 3, 400)],
    tarifas: [{ curso_id: 1, modalidad: "clase", precio: 50 }, { curso_id: 2, modalidad: "clase", precio: 50 }],
    asignaciones: [
      { id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: null },
      { id: 2, curso_id: 2, profesor_id: 2, pct_ingresos: 50, desde: "2026-01-01", hasta: null },
    ],
    alumnos: [{ id: 1, nombre: "Ana", apellido: "Pérez" }],
    profesores: [{ id: 1, nombre: "P", apellido: "A" }, { id: 2, nombre: "Q", apellido: "B" }],
  };
}

test("multi-curso: vencido por el proceso único = el motor directo, con prorrateo entre cursos y profesores", () => {
  const d = datosMultiCurso();
  const directo = calcularDevengos(d, "2026-08-31");
  const r = liquidar({ regular: d, particulares: null }, { tipo: "vencido", hastaISO: "2026-08-31", periodoVencido: "2026-08-01", hoyISO: "2026-09-08" });
  assert.deepEqual(r.regular, directo);
  assert.equal(r.regular.pendientes.length, 2, "una línea por profesor y curso (regla 10)");
  assert.deepEqual(r.regular.pendientes.map((p) => p.profesorId).sort(), [1, 2]);
  for (const p of r.regular.pendientes) assert.equal(p.reparto.length, 2, "cada línea trae el reparto entre los dos cursos");
  const repartoTotal = r.regular.pendientes[0].reparto.reduce((s, x) => s + x.parte, 0);
  assert.equal(Math.round(repartoTotal * 100) / 100, 900, "el reparto suma lo cobrado");
});

test("multi-curso: el curso con más clases se lleva la parte mayor (5 vs 4 clases, 5/9 y 4/9)", () => {
  const r = liquidar({ regular: datosMultiCurso(), particulares: null }, { tipo: "vencido", hastaISO: "2026-08-31", periodoVencido: "2026-08-01", hoyISO: "2026-09-08" });
  const c1 = r.regular.pendientes.find((p) => p.cursoId === 1)!;
  const c2 = r.regular.pendientes.find((p) => p.cursoId === 2)!;
  assert.equal(c1.monto, 250, "5/9 de 900 = 500 × 50%");
  assert.equal(c2.monto, 200, "4/9 de 900 = 400 × 50%");
});

test("multi-curso con una clase sin registrar: la membresía espera (regla 17), en vencido y en curso", () => {
  const d = datosMultiCurso();
  d.sesiones = d.sesiones.filter((s) => !(s.curso_id === 2 && s.fecha === "2026-08-26")); // falta registrar una del curso 2
  const v = liquidar({ regular: d, particulares: null }, { tipo: "vencido", hastaISO: "2026-08-31", periodoVencido: "2026-08-01", hoyISO: "2026-09-08" });
  assert.equal(v.regular.pendientes.length, 0);
  assert.equal(v.regular.bloqueadas.length, 1);
  assert.deepEqual(v.regular, calcularDevengos(d, "2026-08-31"));
});
