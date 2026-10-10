// R20 · E2 · H1 — equivalencia de N09/N10 (reserva confirmada).
// Compara, con igualdad estricta, lo que arman las funciones movidas contra las
// referencias capturadas del código ANTERIOR a la extracción
// (`__referencias__/N09-N10.json`, generadas por `scripts/capturar-referencias-n09-n10.mjs`).
// No se normalizan espacios ni formatos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  horario,
  textosDeReserva,
  mensajeReservaConfirmadaAlumno,
  mensajeReservaConfirmadaProfesor,
} from "./reserva.ts";

type Entrada = {
  esAlquiler: boolean;
  planNombre: string | null;
  profesorNombre: string;
  alumnoNombre: string;
  contratadasMin: number;
  disponibleMin: number;
  fecha: string;
  hora: string;
  duracionMin: number;
  lugar: string;
};
type Referencia = { entrada: Entrada; alumno: string; profesor: string | null };

const refs = JSON.parse(
  readFileSync(new URL("../__referencias__/N09-N10.json", import.meta.url), "utf8")
) as Record<string, Referencia>;

function armar(e: Entrada) {
  const textos = textosDeReserva(e);
  const c = { ...textos, contratadasMin: e.contratadasMin, disponibleMin: e.disponibleMin };
  const cuando = horario(e.fecha, e.hora, e.duracionMin);
  return {
    alumno: mensajeReservaConfirmadaAlumno(c, cuando, e.lugar),
    // En un alquiler `avisos()` no arma el aviso al profesor.
    profesor: e.esAlquiler ? null : mensajeReservaConfirmadaProfesor(c, cuando, e.lugar),
  };
}

test("hay variantes de particular y de alquiler", () => {
  const ids = Object.keys(refs);
  assert.ok(ids.some((i) => i.startsWith("particular.")));
  assert.ok(ids.some((i) => i.startsWith("alquiler.")));
});

for (const [id, ref] of Object.entries(refs)) {
  test(`N09/N10 ${id}: igual a la referencia`, () => {
    const r = armar(ref.entrada);
    assert.strictEqual(r.alumno, ref.alumno);
    assert.strictEqual(r.profesor, ref.profesor);
  });
}
