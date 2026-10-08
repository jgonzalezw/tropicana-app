import test from "node:test";
import assert from "node:assert/strict";
import { construirHTMLRetiro } from "./imprimirRetiro.ts";
import { armarRetiro, type EntradaRetiro, type MembresiaInconclusa } from "./retiro.ts";

const inc = (o: Partial<MembresiaInconclusa> = {}): MembresiaInconclusa => ({
  membresiaId: 1, alumno: "Pérez, Ana", tipo: "regular", detalle: "Salsa, Bachata", plan: "Plan Regular",
  inicio: "2026-10-01", fin: "2026-10-29", hechas: 3, total: 8, unidad: "clases", estado: "activa", criterio: 1, ...o,
});
function vista(inconclusas: MembresiaInconclusa[], cuentas: EntradaRetiro["cuentas"] = {}, bonos: EntradaRetiro["bonos"] = {}) {
  const e: EntradaRetiro = {
    profesorId: 7, profesor: "Salek, Natalia", activo: true, corte: "2026-10-31", hoyISO: "2026-10-07",
    asignaciones: [], sustitutos: {}, regular: { pendientes: [], bloqueadas: [] },
    particulares: { pendientes: [], bloqueadas: [] }, descuentos: [], saldoPrevio: 0, posteriores: [],
    reservasFuturas: [], inconclusas, cuentas, bonos, criterios: {}, ciclos: {}, previas: [],
  };
  return armarRetiro(e);
}
const ctx = { profesor: "Salek, Natalia", corte: "2026-10-31", generadoEn: "2026-10-07T20:00:00Z" };

test("el impreso es papel blanco, no una foto de la pantalla", () => {
  const html = construirHTMLRetiro(vista([]), ctx);
  assert.match(html, /background: #fff/);
  assert.match(html, /<title>Retiro de Salek, Natalia<\/title>/);
  assert.match(html, /Simulación: no se guardó nada/);
});

test("una línea por membresía inconclusa, con fechas, avance y estado", () => {
  const html = construirHTMLRetiro(
    vista([inc(), inc({ membresiaId: 2, alumno: "Ruiz, Mar", tipo: "particular", detalle: "Clase particular", plan: "Clase particular", hechas: 4, total: 6, unidad: "horas" })], { 2: { precio: 600, descuento: 0, pagado: 500, saldo: 100 } }),
    ctx
  );
  assert.match(html, /Membresías activas que quedan inconclusas · 2/);
  assert.equal((html.match(/<tr><td>(Pérez|Ruiz)/g) ?? []).length, 2);
  assert.match(html, /3 de 8 clases<br>.*faltan 5/);
  assert.match(html, /4 de 6 horas<br>.*faltan 2/);
  assert.match(html, /01\/10\/2026/);
  assert.match(html, /con saldo/);
  assert.doesNotMatch(html, /cobrada/);
});

test("un plan ilimitado se rotula y no inventa un total", () => {
  const html = construirHTMLRetiro(vista([inc({ total: null })]), ctx);
  assert.match(html, /3 clases<br>.*ilimitado/);
});

test("escapa el HTML de los nombres", () => {
  const html = construirHTMLRetiro(vista([inc({ alumno: "<b>X</b>" })]), ctx);
  assert.ok(!html.includes("<b>X</b>"));
  assert.match(html, /&lt;b&gt;X&lt;\/b&gt;/);
});

test("confirmado, el mismo informe es la liquidación por finalización con sus datos finales", () => {
  const html = construirHTMLRetiro(vista([inc()]), {
    ...ctx,
    confirmado: { liquidacionId: 12, confirmadoEn: "2026-10-07T21:00:00Z" },
  });
  assert.match(html, /<title>Liquidación por finalización de Salek, Natalia<\/title>/);
  assert.match(html, /Retiro confirmado el/);
  assert.match(html, /liquidación N° 12/);
  assert.match(html, /Qué se hizo al confirmar/);
  assert.match(html, /Documento final/);
  assert.ok(!html.includes("Simulación: no se guardó nada. Ninguna"));
  assert.match(html, /Membresías activas que quedan inconclusas · 1/);
});

test("las inconclusas muestran la cuenta, el criterio y los bonos", () => {
  const html = construirHTMLRetiro(
    vista(
      [inc({ criterio: 1 })],
      { 1: { precio: 400, descuento: 40, pagado: 360, saldo: 0 } },
      { 1: { aplicado: 1, generado: 2, vence: "2026-11-03" } }
    ),
    ctx
  );
  assert.match(html, /Bs\. 400,00/);
  assert.match(html, /Bs\. 40,00/);
  assert.match(html, /\+1/);
  assert.match(html, /2 · hasta 03\/11\/2026/);
  assert.match(html, /C1 = Al completar la membresía, período vencido/);
});

test("sin la liquidación del que se retira, quedan las membresías y no su plata", () => {
  const v = vista([inc()]);
  const con = construirHTMLRetiro(v, ctx);
  const sin = construirHTMLRetiro(v, { ...ctx, incluirLiquidacion: false });
  assert.match(con, /Total a pagarle/);
  assert.match(con, /Se devenga su cierre de cuentas/);
  assert.ok(!sin.includes("Liquidación final"));
  assert.ok(!sin.includes("Total a pagarle"));
  assert.ok(!sin.includes("Se devenga su cierre de cuentas"));
  assert.match(sin, /<title>Membresías de los cursos de Salek, Natalia al 31\/10\/2026<\/title>/);
  assert.match(sin, /Membresías activas que quedan inconclusas · 1/);
});

test("confirmado y sin su liquidación, el impreso no habla de lo devengado", () => {
  const html = construirHTMLRetiro(vista([inc()]), {
    ...ctx,
    incluirLiquidacion: false,
    confirmado: { liquidacionId: 12, confirmadoEn: "2026-10-07T21:00:00Z" },
  });
  assert.match(html, /Retiro confirmado el/);
  assert.ok(!html.includes("liquidación N° 12"));
  assert.ok(!html.includes("cierre de cuentas quedó devengado"));
});

test("inconclusas: ciclo en dos líneas, sin columna Estado y con «con saldo»", () => {
  const html = construirHTMLRetiro(vista([inc({ membresiaId: 2 })], { 2: { precio: 600, descuento: 0, pagado: 500, saldo: 100 } }), ctx);
  assert.doesNotMatch(html, /<th>Estado<\/th>/);
  assert.match(html, /01\/10\/2026<br>29\/10\/2026/);
  assert.match(html, /con saldo/);
});
