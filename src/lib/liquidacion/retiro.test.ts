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
    descuentos: [], saldoPrevio: 0, posteriores: [], reservasFuturas: [], inconclusas: [],
    cuentas: {}, bonos: {}, criterios: {}, ciclos: {}, previas: [],
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

test("las inconclusas salen una por membresía, por alumno, y se avisan", () => {
  const base = { tipo: "regular" as const, detalle: "Salsa", plan: "Plan", inicio: "2026-10-01", fin: "2026-10-29", unidad: "clases" as const, estado: "activa", criterio: 1 };
  const v = armarRetiro(
    entrada({
      inconclusas: [
        { ...base, membresiaId: 2, alumno: "Zárate, Ana", hechas: 2, total: 8 },
        { ...base, membresiaId: 1, alumno: "Álvarez, Bo", hechas: 3, total: null },
      ],
    })
  );
  assert.deepEqual(v.inconclusas.map((m) => m.membresiaId), [1, 2]);
  assert.ok(v.avisos.some((a) => /^2 membresía/.test(a)));
});

test("los descuentos por reemplazo se avisan y no entran al cierre", () => {
  const d = [{ profesorId: 7, monto: 20, curso: "Salsa", fecha: "2026-10-01", reemplazante: "X" }];
  const v = armarRetiro(entrada({ descuentos: d }));
  assert.equal(v.totales.cierre, 150);
  assert.equal(v.totales.descuentos, 20);
  assert.ok(v.avisosLiquidacion.some((a) => /regla 20a/.test(a)));
  assert.ok(!v.avisos.some((a) => /regla 20a/.test(a)));
});

test("una línea dice cuánto le toca a la fecha, cuánto ya está liquidado (y dónde) y cuánto es este cierre", () => {
  // Yubinca: 5 h × Bs. 50 = 250 a la fecha; 150 ya devengados en la liquidación N° 3; el cierre es la diferencia.
  const p = particular({
    membresiaId: 43, alumno: "?? , Yubinca", monto: 100,
    detalle: { ...particular().detalle, horasContratadas: 6, horasDadas: 5, objetivo: 250, yaDevengado: 150 },
  });
  const v = armarRetiro(
    entrada({
      regular: { pendientes: [], bloqueadas: [] },
      particulares: { pendientes: [p], bloqueadas: [] },
      previas: [{ membresiaId: 43, cursoId: null, monto: 150, liquidacionId: 3 }],
      cuentas: { 43: { precio: 1000, descuento: 0, pagado: 1000, saldo: 0 } },
      criterios: { 43: 2 },
    })
  );
  const l = v.particulares[0];
  assert.equal(l.aLaFecha, 250);
  assert.equal(l.yaLiquidado, 150);
  assert.deepEqual(l.liquidaciones, [3]);
  assert.equal(l.monto, 100);
  assert.equal(l.aLaFecha, l.yaLiquidado + l.monto);
  assert.equal(l.cuenta.pagado, 1000);
  assert.equal(v.totales.cierre, 100); // los totales no cambian: solo se explican
});

test("una regular suma lo ya devengado de su curso y muestra su bono aplicado y su criterio", () => {
  const v = armarRetiro(
    entrada({
      particulares: { pendientes: [], bloqueadas: [] },
      previas: [
        { membresiaId: 1, cursoId: 1, monto: 20, liquidacionId: 2 },
        { membresiaId: 1, cursoId: 99, monto: 500, liquidacionId: 9 }, // otro curso: no cuenta
      ],
      bonos: { 1: { aplicado: 1, generado: 0, vence: null } },
      criterios: { 1: 3 },
    })
  );
  const l = v.regulares[0];
  assert.equal(l.yaLiquidado, 20);
  assert.equal(l.aLaFecha, 70);
  assert.equal(l.bonoAplicado, 1);
  assert.equal(l.criterio, 3);
});

test("la sigla de una particular es la de la venta, no el 2 con que el cierre mide el avance", () => {
  const v = armarRetiro(entrada({ criterios: { 9: 1 } }));
  assert.equal(v.particulares[0].criterio, 1);
});

test("las inconclusas llevan su cuenta y sus bonos", () => {
  const base = { tipo: "regular" as const, detalle: "Salsa", plan: "Plan", inicio: "2026-10-01", fin: "2026-10-29", unidad: "clases" as const, estado: "activa", criterio: 1, hechas: 2, total: 8 };
  const v = armarRetiro(
    entrada({
      inconclusas: [{ ...base, membresiaId: 5, alumno: "Araujo, Luz" }],
      cuentas: { 5: { precio: 400, descuento: 40, pagado: 360, saldo: 0 } },
      bonos: { 5: { aplicado: 1, generado: 1, vence: "2026-11-03" } },
    })
  );
  const m = v.inconclusas[0];
  assert.deepEqual(m.cuenta, { precio: 400, descuento: 40, pagado: 360, saldo: 0 });
  assert.equal(m.bonoAplicado, 1);
  assert.equal(m.bonoGenerado, 1);
  assert.equal(m.bonoVence, "2026-11-03");
});
