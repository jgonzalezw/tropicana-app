import test from "node:test";
import assert from "node:assert/strict";
import { armarRetiro, validarRetiro, type EntradaRetiro } from "./retiro.ts";
import type { DevengoPendiente } from "./motor.ts";
import type { DevengoParticular } from "./particulares.ts";

function regular(o: Partial<DevengoPendiente> = {}): DevengoPendiente {
  return {
    membresiaId: 1, profesorId: 7, cursoId: 1, alumno: "Pérez, Ana", curso: "Salsa", tipo: "cierre", criterio: 2,
    base: 100, pct: 50, monto: 50, clases: 2, clasesDelCurso: 4, personas: 1, cobradoTotal: 100, reparto: [], ...o,
  };
}
function particular(o: Partial<DevengoParticular> = {}): DevengoParticular {
  return {
    membresiaId: 9, profesorId: 7, planId: 3, alumno: "Gómez, Eva", tipo: "cierre", criterio: 2, periodo: "2026-10-01",
    base: 2, monto: 100,
    detalle: {
      forma: "fee_hora", criterio: 2, horasContratadas: 4, horasDadas: 2, factor: 0.5, completadaPor: null, cobrado: 400,
      costoSala: null, pct: null, fee: 50, montoFijo: null, modoVencida: "proporcional", objetivo: 100, yaDevengado: 0,
    },
    ...o,
  };
}
function entrada(o: Partial<EntradaRetiro> = {}): EntradaRetiro {
  return {
    profesorId: 7, profesor: "Salek, Natalia", activo: true, corte: "2026-10-31", hoyISO: "2026-10-07",
    asignaciones: [{ id: 1, cursoId: 1, curso: "Salsa", desde: "2026-01-01", hasta: null }],
    sustitutos: {},
    regular: { pendientes: [regular()], bloqueadas: [] },
    particulares: { pendientes: [particular()], bloqueadas: [] },
    descuentos: [], saldoPrevio: 0, posteriores: [], reservasFuturas: [], membresiasQueQuedan: [],
    ...o,
  };
}

test("compone el cierre con regulares y particulares y suma el saldo previo", () => {
  const v = armarRetiro(entrada({ saldoPrevio: 30 }));
  assert.equal(v.totales.regulares, 50);
  assert.equal(v.totales.particulares, 100);
  assert.equal(v.totales.cierre, 150);
  assert.equal(v.totales.aPagar, 180);
  assert.equal(v.puedeConfirmar, true);
});

test("las acciones nombran cada curso, el cierre y la inactivación", () => {
  const v = armarRetiro(entrada());
  assert.deepEqual(v.acciones.map((a) => a.clave), ["asig-1", "cierre", "inactivar"]);
  assert.match(v.acciones[0].texto, /queda sin titular/);
});

test("con sustituto, la acción dice desde cuándo empieza", () => {
  const v = armarRetiro(entrada({ sustitutos: { 1: { profesorId: 8, pctIngresos: 40, pctReferido: 0 } } }));
  assert.match(v.acciones[0].texto, /empieza el 2026-11-01/);
});

test("una clase dictada después del corte traba y dice qué hacer", () => {
  const v = armarRetiro(entrada({ posteriores: [{ cursoId: 1, curso: "Salsa", fechas: ["2026-11-03"] }] }));
  assert.equal(v.puedeConfirmar, false);
  assert.match(v.trabas[0].texto, /fecha de corte posterior/);
});

test("reservas particulares futuras traban y llevan a la sala", () => {
  const v = armarRetiro(entrada({ reservasFuturas: [{ id: 1, fecha: "2026-10-20", alumno: "Gómez, Eva" }] }));
  assert.equal(v.puedeConfirmar, false);
  assert.equal(v.trabas[0].href, "/sala");
});

test("una multi-curso con clases sin registrar no traba: queda afuera del cierre (regla 17), con dónde registrarlas", () => {
  const b = { membresiaId: 4, alumno: "Ruiz, Mar", cursos: [{ cursoId: 1, curso: "Salsa", fechas: ["2026-10-01"] }], profesorIds: [7] };
  const v = armarRetiro(entrada({ regular: { pendientes: [], bloqueadas: [b] } }));
  assert.equal(v.puedeConfirmar, true);
  assert.equal(v.quedanAfuera.length, 1);
  assert.equal(v.quedanAfuera[0].href, "/asistencia");
  assert.match(v.quedanAfuera[0].texto, /regla 17/);
});

test("una particular sin la foto de pago queda afuera y se explica", () => {
  const b = { membresiaId: 9, profesorId: 7, alumno: "Gómez, Eva", motivo: "La venta no guardó el fee por hora del profesor." };
  const v = armarRetiro(entrada({ particulares: { pendientes: [], bloqueadas: [b] } }));
  assert.equal(v.puedeConfirmar, true);
  assert.match(v.quedanAfuera[0].texto, /No entra al cierre/);
});

test("un sustituto igual al profesor o una fecha anterior al inicio traban", () => {
  const igual = validarRetiro(entrada({ sustitutos: { 1: { profesorId: 7, pctIngresos: 40, pctReferido: 0 } } }));
  assert.match(igual[0].texto, /mismo profesor/);
  const antes = validarRetiro(entrada({ corte: "2025-12-31" }));
  assert.match(antes[0].texto, /anterior al inicio/);
});

test("un inactivo sin asignaciones abiertas no se retira de nuevo; con asignaciones abiertas sí", () => {
  assert.equal(armarRetiro(entrada({ activo: false, asignaciones: [] })).puedeConfirmar, false);
  assert.equal(armarRetiro(entrada({ activo: false })).puedeConfirmar, true);
});

test("los descuentos por reemplazo se avisan y no entran al cierre", () => {
  const d = [{ profesorId: 7, monto: 20, curso: "Salsa", fecha: "2026-10-01", reemplazante: "X" }];
  const v = armarRetiro(entrada({ descuentos: d }));
  assert.equal(v.totales.cierre, 150);
  assert.equal(v.totales.descuentos, 20);
  assert.ok(v.avisos.some((a) => /regla 20a/.test(a)));
});
