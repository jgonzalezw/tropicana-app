import { test } from "node:test";
import assert from "node:assert/strict";
import { simularCierre, simularParticulares } from "./simulacion.ts";
import { calcularDevengos, type DatosMotor } from "./motor.ts";
import type { Curso } from "../tipos.ts";

// Curso de lunes (dia 1) con vigencia abierta; una membresía de 4 clases
// del 5/10 al 26/10/2026 (lunes), 100 cobrados, profesor 7 al 100 %.
const curso = { id: 1, dias_semana: [1], precio_mensual: 100, porcentaje_profesor: 100 } as unknown as Curso;
function datos(over: Partial<DatosMotor> = {}): DatosMotor {
  return {
    membresias: [
      {
        id: 1, alumno_id: 1, curso_id: 1, plan_id: 1, es_prueba: false, acompanantes: 0,
        fecha_inicio: "2026-10-05", fecha_fin: "2026-10-26", estado: "activa", clases_plan: 4, criterio_liquidacion: 1,
      },
    ],
    cursosDeMembresia: [{ membresia_id: 1, curso_id: 1, dias: [1], fecha: null }],
    comisionesPrevias: [],
    cuotas: [{ id: 1, membresia_id: 1, monto_devengado: 100, descuento_adelanto: 0 }],
    pagos: [{ cuota_id: 1, monto: 100, descuento: 0 }],
    sesiones: [{ curso_id: 1, fecha: "2026-10-05", estado: "dictada", reemplazo_motivo: null }],
    cursos: [curso],
    tarifas: [{ curso_id: 1, modalidad: "clase", precio: 25 }],
    asignaciones: [{ id: 1, curso_id: 1, profesor_id: 7, pct_ingresos: 100, desde: "2026-01-01", hasta: null }],
    alumnos: [{ id: 1, nombre: "A", apellido: "Z" }],
    profesores: [{ id: 7, nombre: "P", apellido: "Q" }],
    ...over,
  };
}

test("sin simular, una membresía activa de criterio 1 no devenga", () => {
  const r = calcularDevengos(datos(), "2026-10-31");
  assert.equal(r.pendientes.length, 0);
});

test("simulada al fin del mes: pasa a completada, las clases futuras no traban y devenga", () => {
  const sim = simularCierre(datos(), "2026-10-07", "2026-10-31");
  assert.equal(sim.membresias[0].estado, "completada");
  const r = calcularDevengos(sim, "2026-10-31");
  assert.equal(r.bloqueadas.length, 0);
  assert.equal(r.pendientes.length, 1);
  assert.equal(r.pendientes[0].monto, 100);
});

test("con saldo pendiente no se da por completada", () => {
  const d = datos({ pagos: [{ cuota_id: 1, monto: 40, descuento: 0 }] });
  const sim = simularCierre(d, "2026-10-07", "2026-10-31");
  assert.equal(sim.membresias[0].estado, "activa");
});

test("una clase pasada sin registrar sigue siendo real: no se inventa", () => {
  const d = datos({ sesiones: [] }); // el 5/10 (pasado) sin registrar
  const sim = simularCierre(d, "2026-10-07", "2026-10-31");
  assert.ok(!sim.sesiones.some((s) => s.fecha === "2026-10-05"));
  assert.ok(sim.sesiones.some((s) => s.fecha === "2026-10-12"));
});

test("no muta la entrada", () => {
  const d = datos();
  simularCierre(d, "2026-10-07", "2026-10-31");
  assert.equal(d.membresias[0].estado, "activa");
  assert.equal(d.sesiones.length, 1);
});

test("particulares: reservas futuras del período cuentan como dadas", () => {
  const dp = {
    membresias: [], cobrado: {}, saldo: {}, previas: [], modoVencida: "proporcional" as const,
    reservas: [
      { membresia_id: 1, fecha: "2026-10-10", estado: "confirmada", duracion_min: 60, es_cortesia: false },
      { membresia_id: 1, fecha: "2026-11-02", estado: "confirmada", duracion_min: 60, es_cortesia: false },
      { membresia_id: 1, fecha: "2026-10-03", estado: "suspendida", duracion_min: 60, es_cortesia: false },
    ],
  };
  const s = simularParticulares(dp, "2026-10-07", "2026-10-31");
  assert.deepEqual(s.reservas.map((r) => r.estado), ["realizada", "confirmada", "suspendida"]);
});
