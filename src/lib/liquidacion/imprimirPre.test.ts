/** El impreso y el formato de la pre-liquidación. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { construirHTMLPreliquidacion, pantallaDe } from "./imprimirPre.ts";
import { conSigno, fechaCorta, periodoLargo } from "./formatoPre.ts";
import type { InformePre } from "./preliquidacion.ts";

const informe = (): InformePre => ({
  periodoVencido: "2026-09-01",
  hastaISO: "2026-09-30",
  profesores: [
    {
      profesorId: 1, nombre: "Álvarez, <Pedro>", membresias: 1, cursos: ["Salsa"], subtotal: 100, neto: 80,
      extras: [{ titulo: "Reemplazo", detalle: "Salsa · 17/08", monto: -20 }],
      lineas: [{
        membresiaId: 1, alumno: "Pérez, Ana", curso: "Salsa", plan: "Plan Salsa", criterio: 1,
        cicloInicio: "2026-08-03", cicloFin: "2026-08-31", clases: "5/5", cobrado: 200, base: 200,
        notaBase: null, pct: 50, comision: 100, particular: false,
      }],
    },
    { profesorId: 2, nombre: "Zapata, Luz", membresias: 0, cursos: [], subtotal: 0, neto: 0, extras: [], lineas: [] },
  ],
  resumen: { total: 80, comisiones: 100, extras: -20, profesoresConDevengo: 2, membresiasQueEntran: 1, membresiasConExcepcion: 1 },
  excepciones: [
    { clave: "sin_plan", titulo: "Membresía sin plan o sin criterio de liquidación", casos: [] },
    { clave: "sin_titular", titulo: "Curso sin titular en esa fecha", casos: [] },
    { clave: "bloqueada_clases", titulo: "Bloqueada por clases sin registrar", casos: [] },
    { clave: "particular_bloqueada", titulo: "Clase particular bloqueada", casos: [] },
    {
      clave: "saldo", titulo: "Saldo pendiente",
      casos: [{ persona: "Gómez, Luz", curso: "Zumba", detalle: "Faltan Bs. 50,00", href: "/caja", accion: "Resolver", membresiaId: 9 }],
    },
    { clave: "ciclo_posterior", titulo: "Ciclo que termina después del corte", casos: [] },
  ],
  clases: {
    vencidas: [
      { cursoId: 1, curso: "Salsa", fecha: "2026-09-28", alumnosEsperados: 2, traba: true, motivo: "Pérez, Ana · membresía de varios cursos" },
      { cursoId: 2, curso: "Zumba", fecha: "2026-09-29", alumnosEsperados: 1, traba: false, motivo: "solo membresías de un curso" },
    ],
    proximas: [],
    sinAlumnos: [],
  },
  existentes: [],
});

test("el impreso lleva la leyenda fija, una hoja por profesor y TRABA / NO TRABA en mayúsculas", () => {
  const h = construirHTMLPreliquidacion(informe(), "2026-10-01T10:41:00.000Z");
  assert.match(h, /Informe preliminar: no se ha generado ninguna liquidación/);
  assert.equal((h.match(/class="hoja"/g) ?? []).length, 2);
  assert.match(h, />TRABA</);
  assert.match(h, />NO TRABA</);
  assert.match(h, /counter\(pages\)/);
  assert.match(h, /Se resuelve en: Caja/);
});

test("un motivo sin casos sigue en el papel y dice 'Ninguna en este período'", () => {
  const h = construirHTMLPreliquidacion(informe(), "2026-10-01T10:41:00.000Z");
  assert.equal((h.match(/Ninguna en este período\./g) ?? []).length, 5);
});

test("el texto que viene de la base se escapa", () => {
  const h = construirHTMLPreliquidacion(informe(), "2026-10-01T10:41:00.000Z");
  assert.ok(!h.includes("<Pedro>"));
  assert.match(h, /&lt;Pedro&gt;/);
});

test("un profesor sin comisiones no rompe la hoja", () => {
  const h = construirHTMLPreliquidacion(informe(), "2026-10-01T10:41:00.000Z");
  assert.match(h, /Sin comisiones en este período\./);
});

test("las liquidaciones existentes se avisan en el papel", () => {
  const i = informe();
  i.existentes = [{ id: 1, profesor: "Núñez, Oscar", estado: "abierta", total: 475 }];
  const h = construirHTMLPreliquidacion(i, "2026-10-01T10:41:00.000Z");
  assert.match(h, /Ya hay una liquidación generada para septiembre 2026/);
});

test("pantallaDe nombra la pantalla donde se arregla", () => {
  const caso = (href: string) => ({ persona: "", curso: null, detalle: "", href, accion: "Resolver" as const, membresiaId: null });
  assert.equal(pantallaDe(caso("/precios")), "Precios y paquetes");
  assert.equal(pantallaDe(caso("/asistencia")), "Asistencia");
  assert.equal(pantallaDe(caso("/alumnos/3/cuenta")), "la cuenta del alumno");
});

test("formato: período largo, fecha corta y monto firmado con el menos tipográfico", () => {
  assert.equal(periodoLargo("2026-09-01"), "Septiembre 2026");
  assert.equal(fechaCorta("2026-09-05"), "05/09/2026");
  assert.equal(fechaCorta(null), "—");
  assert.equal(conSigno(12.5), "+ Bs. 12,50");
  assert.equal(conSigno(-40), "− Bs. 40,00");
});
