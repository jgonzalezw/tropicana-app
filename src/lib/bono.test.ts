import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bonosPorCurso, venceBono, textoBonos, bonosAplicables, clasesDeBono, cursoAgotadoAl, finConBono,
  type AsistenciaDeCurso, type BonoPendiente,
} from "./bono.ts";

const falta = (curso_id: number, con_licencia: boolean): AsistenciaDeCurso => ({
  curso_id, estado: "ausente", con_licencia,
});
const pres = (curso_id: number): AsistenciaDeCurso => ({ curso_id, estado: "presente", con_licencia: false });

test("falta con licencia en A y sin licencia en B: bono solo en A", () => {
  assert.deepEqual(bonosPorCurso([falta(1, true), falta(2, false), pres(2)], 2), [{ curso_id: 1, clases: 1 }]);
});

test("una falta sin licencia anula solo su curso, aunque haya con licencia en él", () => {
  assert.deepEqual(bonosPorCurso([falta(1, true), falta(1, false), falta(2, true)], 2), [{ curso_id: 2, clases: 1 }]);
});

test("el tope de tolerancia es por curso", () => {
  const f = [falta(1, true), falta(1, true), falta(1, true), falta(2, true), falta(2, true), falta(2, true)];
  assert.deepEqual(bonosPorCurso(f, 2), [{ curso_id: 1, clases: 2 }, { curso_id: 2, clases: 2 }]);
});

test("sin faltas o tolerancia 0 no hay bono", () => {
  assert.deepEqual(bonosPorCurso([pres(1)], 2), []);
  assert.deepEqual(bonosPorCurso([falta(1, true)], 0), []);
});

// 2026-10-05 es lunes (dia 1).
test("vence en la siguiente clase del curso después del fin de ciclo", () => {
  const curso = { curso_id: 1, dias: [1, 3] };
  assert.equal(venceBono(curso, "2026-10-05", new Set()), "2026-10-07");
  assert.equal(venceBono(curso, "2026-10-05", new Set(["1|2026-10-07"])), "2026-10-12");
  assert.equal(venceBono({ curso_id: 1, dias: [] }, "2026-10-05", new Set()), null);
});

const b = (id: number, curso_id: number, clases: number, vence: string | null): BonoPendiente => ({
  id, membresia_id: 10, curso_id, clases, vence,
});

test("bonos aplicables: aplica, vencido y no entra", () => {
  const pend = [b(1, 1, 1, "2026-10-20"), b(2, 2, 2, "2026-10-01"), b(3, 3, 1, null)];
  const r = bonosAplicables(pend, [1, 2], "2026-10-10", false);
  assert.deepEqual(r.aplican.map((x) => x.id), [1]);
  assert.deepEqual(r.vencidos.map((x) => x.id), [2]);
  assert.deepEqual(r.noEntran.map((x) => x.id), [3]);
  assert.equal(clasesDeBono(r), 1);
});

test("vence el mismo día: todavía vale", () => {
  const r = bonosAplicables([b(1, 1, 1, "2026-10-10")], [1], "2026-10-10", false);
  assert.equal(r.aplican.length, 1);
});

test("ilimitado: se consume sin efecto y no suma clases", () => {
  const r = bonosAplicables([b(1, 1, 2, "2026-10-20")], [1], "2026-10-10", true);
  assert.deepEqual(r.sinEfecto.map((x) => x.id), [1]);
  assert.equal(r.aplican.length, 0);
  assert.equal(clasesDeBono(r), 0);
});

test("agotado por curso: el bono de A no extiende a B", () => {
  const bonos = new Map([[1, 1]]);
  const hechas = [
    { fecha: "2026-10-05", curso_id: 1 }, { fecha: "2026-10-06", curso_id: 2 },
  ];
  assert.equal(cursoAgotadoAl(2, bonos, hechas, 1), false); // A: el plan se agotó pero tiene su bono
  assert.equal(cursoAgotadoAl(2, bonos, hechas, 2), true); // B: sin bono
  assert.equal(cursoAgotadoAl(3, bonos, hechas, 2), false); // el plan sigue abierto
});

test("agotado por curso: el bono de A se gasta en A", () => {
  const bonos = new Map([[1, 1]]);
  const hechas = [
    { fecha: "2026-10-05", curso_id: 1 }, { fecha: "2026-10-06", curso_id: 2 }, { fecha: "2026-10-12", curso_id: 1 },
  ];
  assert.equal(cursoAgotadoAl(2, bonos, hechas, 1), true);
});

test("dos cursos con bono: cada uno gasta el suyo sin pisar al otro", () => {
  const bonos = new Map([[1, 1], [2, 1]]);
  const hechas = [
    { fecha: "2026-10-05", curso_id: 1 }, { fecha: "2026-10-06", curso_id: 2 }, { fecha: "2026-10-12", curso_id: 1 },
  ];
  assert.equal(cursoAgotadoAl(2, bonos, hechas, 1), true);
  assert.equal(cursoAgotadoAl(2, bonos, hechas, 2), false);
});

test("fin con bono: el plan en todos los cursos y el bono solo en los días de su curso", () => {
  const cursos = [{ curso_id: 1, dias: [1] }, { curso_id: 2, dias: [3] }]; // lun y mié
  // Base 2 desde el lunes 5: lun 5 (A) y mié 7 (B).
  assert.equal(finConBono("2026-10-05", cursos, new Set(), 2, new Map()), "2026-10-07");
  // Bono 1 en A: la siguiente clase de A es el lunes 12.
  assert.equal(finConBono("2026-10-05", cursos, new Set(), 2, new Map([[1, 1]])), "2026-10-12");
  // Bono 1 en B: la siguiente de B es el miércoles 14.
  assert.equal(finConBono("2026-10-05", cursos, new Set(), 2, new Map([[2, 1]])), "2026-10-14");
});

test("texto de bonos para la cuenta", () => {
  assert.equal(
    textoBonos([{ cursoNombre: "Salsa", clases: 1, vence: "2026-10-15" }, { cursoNombre: "Heels", clases: 2, vence: null }]),
    "Salsa 1 (hasta 15/10), Heels 2"
  );
});

test("caso Manuel Aguilar: 2 faltas con licencia y tolerancia 1 dan 1 solo bono", () => {
  const ciclo = [pres(2), pres(2), pres(2), falta(2, true), pres(2), pres(2), falta(2, true), pres(2)];
  assert.deepEqual(bonosPorCurso(ciclo, 1), [{ curso_id: 2, clases: 1 }]);
});
