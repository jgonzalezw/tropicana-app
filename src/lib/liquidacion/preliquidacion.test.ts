/**
 * Pre-liquidación: lo que el motor descarta en silencio y las clases sin
 * registrar. Sin base de datos, con fechas fijas de agosto de 2026
 * (lunes: 3, 10, 17, 24, 31).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  armarExcepciones,
  armarInforme,
  armarProfesores,
  clasesSinRegistrar,
  razonDeDescarte,
  type EntradaPre,
} from "./preliquidacion.ts";
import type { DatosMotor, DevengoPendiente, MembresiaLiq } from "./motor.ts";
import type { Curso } from "../tipos.ts";

const LUNES = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"];

const curso = (id: number, nombre: string, dias: number[], extra: Partial<Curso> = {}): Curso => ({
  id, nombre, linea: null, estilo: null, nivel: null, dias_semana: dias, hora: "19:00",
  duracion_min: 60, sala_id: 1, precio_mensual: 400, activo: true, vigente_desde: null,
  vigente_hasta: null, creado_en: "2026-01-01", actualizado_en: "2026-01-01", ...extra,
});
const ses = (cursoId: number, fecha: string, estado = "dictada") => ({ curso_id: cursoId, fecha, estado });

function entrada(over: { m?: Partial<MembresiaLiq>; datos?: Partial<DatosMotor>; pre?: Partial<EntradaPre> } = {}): EntradaPre {
  const datos: DatosMotor = {
    membresias: [{
      id: 1, alumno_id: 1, curso_id: 1, plan_id: 1, es_prueba: false, acompanantes: null,
      fecha_inicio: "2026-08-03", fecha_fin: "2026-08-31", estado: "completada", criterio_liquidacion: 1,
      clases_plan: 5, ...over.m,
    }],
    cursosDeMembresia: [{ membresia_id: 1, curso_id: 1, dias: [1], fecha: null }],
    comisionesPrevias: [],
    cuotas: [{ id: 1, membresia_id: 1, monto_devengado: 200, descuento_adelanto: 0 }],
    pagos: [{ cuota_id: 1, monto: 200, descuento: 0 }],
    sesiones: [],
    cursos: [curso(1, "Salsa", [1])],
    tarifas: [],
    asignaciones: [{ id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: null }],
    alumnos: [{ id: 1, nombre: "Ana", apellido: "Pérez" }],
    profesores: [{ id: 1, nombre: "Pedro", apellido: "Álvarez" }],
    ...over.datos,
  };
  return {
    datos,
    periodoVencido: "2026-08-01",
    hastaISO: "2026-08-31",
    hoyISO: "2026-09-02",
    pendientes: [],
    bloqueadas: [],
    particulares: { pendientes: [], bloqueadas: [] },
    descuentos: [],
    profesores: [{ id: 1, nombre: "Pedro", apellido: "Álvarez" }],
    planes: [{ id: 1, nombre: "Plan Salsa" }],
    membresiasSinPlan: [],
    sesionesCal: LUNES.map((f) => ses(1, f)),
    existentes: [],
    ...over.pre,
  };
}

const motivo = (e: EntradaPre, clave: string) => armarExcepciones(e).find((m) => m.clave === clave)!;

test("los seis motivos están siempre, en orden, aunque no haya casos", () => {
  const m = armarExcepciones(entrada());
  assert.deepEqual(
    m.map((x) => x.clave),
    ["sin_plan", "sin_titular", "bloqueada_clases", "particular_bloqueada", "saldo", "ciclo_posterior"]
  );
  assert.ok(m.every((x) => x.casos.length === 0), "una membresía en regla no genera excepciones");
});

test("saldo pendiente: no entra y se dice cuánto falta", () => {
  const e = entrada({ datos: { pagos: [{ cuota_id: 1, monto: 150, descuento: 0 }] } });
  const c = motivo(e, "saldo").casos;
  assert.equal(c.length, 1);
  assert.equal(c[0].persona, "Pérez, Ana");
  assert.match(c[0].detalle, /50\.00/);
  assert.equal(c[0].accion, "Resolver");
  assert.equal(c[0].href, "/caja");
});

test("ciclo que termina después del corte: no tiene arreglo, se mira", () => {
  const e = entrada({ m: { fecha_fin: "2026-09-14" } });
  const c = motivo(e, "ciclo_posterior").casos;
  assert.equal(c.length, 1);
  assert.equal(c[0].accion, "Ver membresía");
  assert.equal(c[0].href, "/alumnos/1/cuenta");
});

test("ciclo posterior de una membresía de varios cursos: lo dice y avisa del prorrateo", () => {
  const e = entrada({
    m: { fecha_fin: "2026-09-14" },
    datos: {
      cursosDeMembresia: [
        { membresia_id: 1, curso_id: 1, dias: [1], fecha: null },
        { membresia_id: 1, curso_id: 2, dias: [1], fecha: null },
      ],
      cursos: [curso(1, "Salsa", [1]), curso(2, "Bachata", [1])],
    },
  });
  const c = motivo(e, "ciclo_posterior").casos;
  assert.match(c[0].detalle, /Membresía de 2 cursos \(Salsa, Bachata\): se prorratea/);
});

test("ciclo posterior de un solo curso no lleva la nota de prorrateo", () => {
  const e = entrada({ m: { fecha_fin: "2026-09-14" } });
  assert.doesNotMatch(motivo(e, "ciclo_posterior").casos[0].detalle, /prorratea/);
});

test("una activa cuyo ciclo ya terminó espera clases por registrar, no desaparece", () => {
  const e = entrada({ m: { estado: "activa" } });
  const c = motivo(e, "bloqueada_clases").casos;
  assert.equal(c.length, 1);
  assert.match(c[0].detalle, /sigue activa/);
});

test("sin plan y sin criterio van al mismo motivo", () => {
  const e = entrada({
    m: { criterio_liquidacion: null },
    pre: { membresiasSinPlan: [{ id: 9, alumnoId: 2, alumno: "Gómez, Luz", curso: "Zumba", fecha_inicio: "2026-08-08", estado: "completada" }] },
  });
  const c = motivo(e, "sin_plan").casos;
  assert.deepEqual(c.map((x) => x.persona).sort(), ["Gómez, Luz", "Pérez, Ana"]);
});

test("una ya devengada no es excepción aunque su ciclo sea posterior", () => {
  const e = entrada({
    m: { fecha_fin: "2026-09-14" },
    datos: { comisionesPrevias: [{ id: 1, membresia_id: 1, curso_id: 1, profesor_id: 1, base: 200, monto: 100, tipo: "comision", periodo: "2026-08-01" }] },
  });
  assert.equal(motivo(e, "ciclo_posterior").casos.length, 0);
});

test("razonDeDescarte repite los filtros del motor, en su orden", () => {
  const m: MembresiaLiq = {
    id: 1, alumno_id: 1, curso_id: 1, plan_id: 1, es_prueba: false, acompanantes: null,
    fecha_inicio: "2026-08-03", fecha_fin: "2026-08-31", estado: "completada", criterio_liquidacion: 1,
  };
  const ctx = { hastaISO: "2026-08-31", saldo: 0, yaDevengada: false };
  assert.equal(razonDeDescarte(m, ctx), null);
  assert.equal(razonDeDescarte({ ...m, criterio_liquidacion: null }, ctx), "sin_criterio");
  assert.equal(razonDeDescarte({ ...m, criterio_liquidacion: 4 }, ctx), "sin_criterio");
  assert.equal(razonDeDescarte({ ...m, fecha_fin: "2026-09-01" }, ctx), "ciclo_posterior");
  assert.equal(razonDeDescarte({ ...m, estado: "activa" }, ctx), "sin_agotar");
  assert.equal(razonDeDescarte(m, { ...ctx, saldo: 10 }), "saldo");
  // Criterio 2 mira el avance: una activa cobrada entra.
  assert.equal(razonDeDescarte({ ...m, criterio_liquidacion: 2, estado: "activa" }, ctx), null);
  // Criterio 3 no espera al corte si ya está completada.
  assert.equal(razonDeDescarte({ ...m, criterio_liquidacion: 3, fecha_fin: "2026-09-20" }, ctx), null);
});

// ── Clases sin registrar ─────────────────────────────────────────────────

test("una clase vencida sin sesión de una membresía de un solo curso: aparece y NO traba", () => {
  const e = entrada({ pre: { sesionesCal: LUNES.filter((f) => f !== "2026-08-24").map((f) => ses(1, f)) } });
  const c = clasesSinRegistrar(e);
  assert.deepEqual(c.vencidas.map((x) => x.fecha), ["2026-08-24"]);
  assert.equal(c.vencidas[0].traba, false);
  assert.equal(c.vencidas[0].alumnosEsperados, 1);
  assert.equal(c.vencidas[0].motivo, "solo membresías de un curso");
});

test("con dos cursos la clase sin registrar SÍ traba, y dice de quién", () => {
  const e = entrada({
    datos: {
      cursosDeMembresia: [
        { membresia_id: 1, curso_id: 1, dias: [1], fecha: null },
        { membresia_id: 1, curso_id: 2, dias: [1], fecha: null },
      ],
      cursos: [curso(1, "Salsa", [1]), curso(2, "Bachata", [1])],
    },
    pre: {
      sesionesCal: [...LUNES.filter((f) => f !== "2026-08-24").map((f) => ses(1, f)), ...LUNES.map((f) => ses(2, f))],
    },
  });
  const c = clasesSinRegistrar(e);
  assert.equal(c.vencidas.length, 1);
  assert.equal(c.vencidas[0].curso, "Salsa");
  assert.equal(c.vencidas[0].traba, true);
  assert.match(c.vencidas[0].motivo, /Pérez, Ana/);
});

test("la clase de hoy sin registrar no vence todavía: va a 'de hoy o futuras'", () => {
  const e = entrada({
    pre: { hoyISO: "2026-08-24", sesionesCal: LUNES.filter((f) => f < "2026-08-24").map((f) => ses(1, f)) },
  });
  const c = clasesSinRegistrar(e);
  assert.deepEqual(c.proximas.map((x) => x.fecha), ["2026-08-24"]);
  assert.equal(c.proximas[0].motivo, "aún no vencida");
  assert.equal(c.vencidas.length, 0);
});

test("un día de calendario sin alumnos no existe para nadie y no traba", () => {
  // El curso da clase lunes y miércoles; la membresía solo va los lunes.
  const e = entrada({
    datos: { cursos: [curso(1, "Salsa", [1, 3])] },
    pre: { sesionesCal: LUNES.map((f) => ses(1, f)) },
  });
  const c = clasesSinRegistrar(e);
  assert.deepEqual(c.sinAlumnos.map((x) => x.fecha), ["2026-08-05", "2026-08-12", "2026-08-19", "2026-08-26"]);
  assert.ok(c.sinAlumnos.every((x) => x.alumnosEsperados === 0 && !x.traba));
  assert.equal(c.vencidas.length, 0);
});

test("una clase suspendida está registrada: no figura como pendiente", () => {
  const e = entrada({
    pre: { sesionesCal: LUNES.map((f) => ses(1, f, f === "2026-08-17" ? "suspendida" : "dictada")) },
  });
  const c = clasesSinRegistrar(e);
  assert.equal(c.vencidas.length + c.proximas.length + c.sinAlumnos.length, 0);
});

test("fuera de la vigencia del curso no hay clase que registrar", () => {
  const e = entrada({
    datos: { cursos: [curso(1, "Salsa", [1], { vigente_desde: "2026-08-17" })] },
    pre: { sesionesCal: [] },
  });
  const c = clasesSinRegistrar(e);
  assert.deepEqual(c.vencidas.map((x) => x.fecha), ["2026-08-17", "2026-08-24", "2026-08-31"]);
});

// ── Curso sin titular ────────────────────────────────────────────────────

test("un día sin titular se dice con curso y fecha; una clase suspendida no cuenta", () => {
  const sinTitular = entrada({
    datos: { asignaciones: [{ id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-08-10", hasta: null }] },
  });
  const c = motivo(sinTitular, "sin_titular").casos;
  assert.equal(c.length, 1);
  assert.match(c[0].detalle, /03\/08/);
  assert.equal(c[0].href, "/profesores");

  const suspendida = entrada({
    datos: { asignaciones: [{ id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-08-10", hasta: null }] },
    pre: { sesionesCal: LUNES.map((f) => ses(1, f, f === "2026-08-03" ? "suspendida" : "dictada")) },
  });
  assert.equal(motivo(suspendida, "sin_titular").casos.length, 0);
});

// ── Por profesor ─────────────────────────────────────────────────────────

const pendiente = (over: Partial<DevengoPendiente>): DevengoPendiente => ({
  membresiaId: 1, profesorId: 1, cursoId: 1, alumno: "Pérez, Ana", curso: "Salsa", tipo: "comision",
  criterio: 1, base: 200, pct: 50, monto: 100, clases: 5, clasesDelCurso: 5, personas: 1,
  cobradoTotal: 200, reparto: [], ...over,
});

test("el neto separa comisiones de reemplazos y ajustes, con su signo", () => {
  const e = entrada({
    pre: {
      pendientes: [pendiente({}), pendiente({ tipo: "ajuste", monto: -20, periodo: "2026-07-01" })],
      descuentos: [{ profesorId: 1, monto: 30, curso: "Salsa", fecha: "2026-08-17", reemplazante: "Gómez, Luz" }],
    },
  });
  const [p] = armarProfesores(e);
  assert.equal(p.lineas.length, 1);
  assert.equal(p.subtotal, 100);
  assert.deepEqual(p.extras.map((x) => x.monto), [-20, -30]);
  assert.equal(p.neto, 50);
  assert.equal(p.membresias, 1);
  assert.equal(p.lineas[0].clases, "5/5");
  assert.equal(p.lineas[0].plan, "Plan Salsa");
});

test("el informe resume: total, profesores, membresías y excepciones", () => {
  const e = entrada({
    pre: {
      pendientes: [pendiente({})],
      membresiasSinPlan: [{ id: 9, alumnoId: 2, alumno: "Gómez, Luz", curso: "Zumba", fecha_inicio: "2026-08-08", estado: "completada" }],
    },
  });
  const i = armarInforme(e);
  assert.equal(i.resumen.total, 100);
  assert.equal(i.resumen.comisiones, 100);
  assert.equal(i.resumen.extras, 0);
  assert.equal(i.resumen.profesoresConDevengo, 1);
  assert.equal(i.resumen.membresiasQueEntran, 1);
  assert.equal(i.resumen.membresiasConExcepcion, 1);
  assert.equal(i.excepciones.length, 6);
});

test("una línea de varios cursos dice qué parte de lo cobrado le tocó al curso", () => {
  const e = entrada({
    pre: {
      pendientes: [pendiente({ base: 120, cobradoTotal: 200, reparto: [
        { cursoId: 1, curso: "Salsa", clases: 5, precioClase: 30, peso: 150, parte: 120 },
        { cursoId: 2, curso: "Bachata", clases: 5, precioClase: 20, peso: 100, parte: 80 },
      ] })],
    },
  });
  assert.equal(armarProfesores(e)[0].lineas[0].notaBase, "Salsa · 60% · membresía de 2 cursos");
});

test("los profesores salen ordenados por apellido", () => {
  const e = entrada({
    pre: {
      profesores: [
        { id: 1, nombre: "Pedro", apellido: "Zapata" },
        { id: 2, nombre: "Ana", apellido: "Álvarez" },
      ],
      pendientes: [pendiente({ profesorId: 1 }), pendiente({ profesorId: 2, membresiaId: 1 })],
    },
  });
  assert.deepEqual(armarProfesores(e).map((p) => p.nombre), ["Álvarez, Ana", "Zapata, Pedro"]);
});

// ── Particulares que el cálculo descarta sin decir nada ─────────────────

import type { DatosParticulares, MembresiaParticular } from "./particulares.ts";

const part = (over: Partial<MembresiaParticular> = {}): MembresiaParticular => ({
  id: 50, profesor_id: 1, plan_id: 1, alumno: "Rojas, Eva", criterio_liquidacion: 2,
  forma_pago_profesor: "fee_hora", fee_hora_aplicado: 40, pago_pct_margen: null, pago_monto_fijo: null,
  pago_descuenta_sala: false, costo_sala_aplicado: null, horas_contratadas: 6, fecha_fin: "2026-11-21",
  es_cortesia: false, ...over,
});
const datosPart = (m: MembresiaParticular, saldo: number, extra: Partial<DatosParticulares> = {}): DatosParticulares => ({
  membresias: [m],
  reservas: [{ membresia_id: m.id, fecha: "2026-08-20", estado: "realizada", duracion_min: 60, es_cortesia: false }],
  cobrado: { [m.id]: 480 - saldo },
  saldo: { [m.id]: saldo },
  previas: [],
  modoVencida: "proporcional",
  ...extra,
});

test("una particular con saldo no desaparece: va a 'Saldo pendiente' con lo que falta", () => {
  const e = entrada({ pre: { datosParticulares: datosPart(part(), 480) } });
  const c = motivo(e, "saldo").casos;
  assert.equal(c.length, 1);
  assert.equal(c[0].persona, "Rojas, Eva");
  assert.equal(c[0].curso, "Clase particular");
  assert.match(c[0].detalle, /480\.00/);
});

test("una particular cobrada y ya devengada no es excepción", () => {
  const e = entrada({
    pre: { datosParticulares: datosPart(part(), 0, { previas: [{ id: 1, membresia_id: 50, monto: 40, tipo: "avance", periodo: "2026-09-01" }] }) },
  });
  assert.equal(motivo(e, "saldo").casos.length, 0);
  assert.equal(motivo(e, "ciclo_posterior").casos.length, 0);
});

test("criterio 1 sin completar: 'aún en curso', con las horas dadas", () => {
  const e = entrada({ pre: { datosParticulares: datosPart(part({ criterio_liquidacion: 1 }), 0) } });
  const c = motivo(e, "ciclo_posterior").casos;
  assert.equal(c.length, 1);
  assert.match(c[0].detalle, /Aún en curso \(1 de 6 h dadas/);
});

test("una membresía de cortesía entera no es excepción: no devenga por decisión", () => {
  const e = entrada({ pre: { datosParticulares: datosPart(part({ es_cortesia: true }), 480) } });
  assert.equal(motivo(e, "saldo").casos.length, 0);
});

test("una particular bloqueada por un dato no se duplica en saldo", () => {
  const e = entrada({
    pre: {
      datosParticulares: datosPart(part(), 480),
      particulares: { pendientes: [], bloqueadas: [{ membresiaId: 50, profesorId: 1, alumno: "Rojas, Eva", motivo: "falta el fee" }] },
    },
  });
  assert.equal(motivo(e, "saldo").casos.length, 0);
  assert.equal(motivo(e, "particular_bloqueada").casos.length, 1);
});

test("una membresía de varios cursos: una línea por curso y profesor, con su parte y cuántos cursos tiene", () => {
  const reparto = [
    { cursoId: 1, curso: "Salsa", clases: 4, precioClase: 30, peso: 120, parte: 120 },
    { cursoId: 2, curso: "Bachata", clases: 4, precioClase: 20, peso: 80, parte: 80 },
  ];
  const e = entrada({
    pre: {
      profesores: [{ id: 1, nombre: "Pedro", apellido: "Álvarez" }, { id: 2, nombre: "Ana", apellido: "Zapata" }],
      pendientes: [
        pendiente({ profesorId: 1, cursoId: 1, curso: "Salsa", base: 120, monto: 60, cobradoTotal: 200, reparto }),
        pendiente({ profesorId: 2, cursoId: 2, curso: "Bachata", base: 80, monto: 40, cobradoTotal: 200, reparto }),
      ],
    },
  });
  const ps = armarProfesores(e);
  assert.equal(ps.length, 2);
  assert.equal(ps[0].lineas[0].notaBase, "Salsa · 60% · membresía de 2 cursos");
  assert.equal(ps[1].lineas[0].notaBase, "Bachata · 40% · membresía de 2 cursos");
  // La membresía se cuenta UNA vez en el resumen, aunque dé dos líneas.
  assert.equal(armarInforme(e).resumen.membresiasQueEntran, 1);
  // Lo repartido suma lo cobrado.
  assert.equal(ps.reduce((a, p) => a + p.lineas[0].base, 0), 200);
});
