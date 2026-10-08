import test from "node:test";
import assert from "node:assert/strict";
import { construirHTMLRetiro } from "./imprimirRetiro.ts";
import { armarRetiro, type EntradaRetiro, type MembresiaInconclusa } from "./retiro.ts";

const inc = (o: Partial<MembresiaInconclusa> = {}): MembresiaInconclusa => ({
  membresiaId: 1, alumno: "Pérez, Ana", tipo: "regular", detalle: "Salsa, Bachata", plan: "Plan Regular",
  inicio: "2026-10-01", fin: "2026-10-29", hechas: 3, total: 8, unidad: "clases", estado: "activa", saldo: 0, ...o,
});
function vista(inconclusas: MembresiaInconclusa[]) {
  const e: EntradaRetiro = {
    profesorId: 7, profesor: "Salek, Natalia", activo: true, corte: "2026-10-31", hoyISO: "2026-10-07",
    asignaciones: [], sustitutos: {}, regular: { pendientes: [], bloqueadas: [] },
    particulares: { pendientes: [], bloqueadas: [] }, descuentos: [], saldoPrevio: 0, posteriores: [],
    reservasFuturas: [], inconclusas,
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
    vista([inc(), inc({ membresiaId: 2, alumno: "Ruiz, Mar", tipo: "particular", detalle: "Clase particular", plan: "Clase particular", hechas: 4, total: 6, unidad: "horas", saldo: 100 })]),
    ctx
  );
  assert.match(html, /Membresías que quedan inconclusas · 2/);
  assert.equal((html.match(/<tr><td>(Pérez|Ruiz)/g) ?? []).length, 2);
  assert.match(html, /3 de 8 clases · faltan 5/);
  assert.match(html, /4 de 6 horas · faltan 2/);
  assert.match(html, /01\/10\/2026/);
  assert.match(html, /activa · con saldo/);
  assert.match(html, /activa · cobrada/);
});

test("un plan ilimitado se rotula y no inventa un total", () => {
  const html = construirHTMLRetiro(vista([inc({ total: null })]), ctx);
  assert.match(html, /3 clases \(ilimitado\)/);
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
  assert.match(html, /Membresías que quedan inconclusas · 1/);
});
