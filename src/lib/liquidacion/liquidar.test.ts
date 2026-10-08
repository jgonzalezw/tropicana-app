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
