// R20 · E2 · H2 — equivalencia de tres vías para N09/N10:
//   referencia (código anterior a la extracción)
//   = función movida (legado/reserva.ts)
//   = plantilla predeterminada renderizada con el adaptador.
// Igualdad estricta, sin normalizar nada.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { horario, textosDeReserva, mensajeReservaConfirmadaAlumno, mensajeReservaConfirmadaProfesor } from "../legado/reserva.ts";
import { renderizar, validar } from "../plantillas.ts";
import {
  CASOS_RESERVA_CONFIRMADA as CASOS,
  ESQUEMA_RESERVA_CONFIRMADA,
  variablesReservaConfirmada,
  type EntradaReservaConfirmada,
} from "./reservaConfirmada.ts";

type Referencia = { entrada: EntradaReservaConfirmada; alumno: string; profesor: string | null };
const refs = JSON.parse(
  readFileSync(new URL("../__referencias__/N09-N10.json", import.meta.url), "utf8")
) as Record<string, Referencia>;

const vocabulario = (usadas: readonly string[]) => ({
  variables: ESQUEMA_RESERVA_CONFIRMADA.filter((v) => usadas.includes(v.nombre)).map((v) => ({
    nombre: v.nombre,
    obligatoria: v.obligatoria,
  })),
});

test("las plantillas son válidas frente a su esquema y usan solo sus variables", () => {
  for (const caso of [CASOS.alumno, CASOS.profesor]) {
    assert.deepEqual(validar(caso.plantilla, vocabulario(caso.variables)), [], caso.clave);
  }
  const nombres = new Set(ESQUEMA_RESERVA_CONFIRMADA.map((v) => v.nombre));
  for (const caso of [CASOS.alumno, CASOS.profesor]) for (const v of caso.variables) assert.ok(nombres.has(v), v);
});

for (const [id, ref] of Object.entries(refs)) {
  test(`N09/N10 ${id}: referencia = función movida = plantilla`, () => {
    const e = ref.entrada;
    const c = { ...textosDeReserva(e), contratadasMin: e.contratadasMin, disponibleMin: e.disponibleMin };
    const cuando = horario(e.fecha, e.hora, e.duracionMin);
    const vars = variablesReservaConfirmada(e);

    const funcionAlumno = mensajeReservaConfirmadaAlumno(c, cuando, e.lugar);
    const plantillaAlumno = renderizar(CASOS.alumno.plantilla, vars, vocabulario(CASOS.alumno.variables));
    assert.strictEqual(funcionAlumno, ref.alumno, "N09 función movida ≠ referencia");
    assert.strictEqual(plantillaAlumno, ref.alumno, "N09 plantilla ≠ referencia");

    if (e.esAlquiler) {
      // El alquiler no tiene profesor: el aviso N10 no se arma (regla de destinatario).
      assert.strictEqual(ref.profesor, null);
      return;
    }
    const funcionProfesor = mensajeReservaConfirmadaProfesor(c, cuando, e.lugar);
    const plantillaProfesor = renderizar(CASOS.profesor.plantilla, vars, vocabulario(CASOS.profesor.variables));
    assert.strictEqual(funcionProfesor, ref.profesor, "N10 función movida ≠ referencia");
    assert.strictEqual(plantillaProfesor, ref.profesor, "N10 plantilla ≠ referencia");
  });
}
