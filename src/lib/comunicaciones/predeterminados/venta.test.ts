// R20 · E2 — equivalencia de tres vías para los avisos de venta (N01–N06):
//   referencia (código anterior a la extracción, `__referencias__/ventas.json`)
//   = función (movida a legado/venta.ts, o la ya pura de lib/venta)
//   = plantilla predeterminada renderizada con el adaptador.
// Igualdad estricta. Incluye cuándo el recibo (N02) NO se manda.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gs } from "../../inscripcion.ts";
import { mensajeConfirmacionInscripcion, mensajeReciboPago } from "../../venta/mensajeInscripcion.ts";
import { avisaRecibo, mensajeAlquiler, mensajePrueba, mensajesParticular } from "../legado/venta.ts";
import { renderizar, validar } from "../plantillas.ts";
import {
  CASOS_VENTA,
  claveAlquiler,
  variablesAlquiler,
  variablesInscripcion,
  variablesParticular,
  variablesPrueba,
  variablesRecibo,
  vocabularioVenta,
} from "./venta.ts";

const refs = JSON.parse(readFileSync(new URL("../__referencias__/ventas.json", import.meta.url), "utf8")) as Record<
  string,
  { entrada: any; resultado: any }
>;
const variantes = Object.entries(refs).filter(([id]) => !id.startsWith("__"));
const plantilla = (clave: keyof typeof CASOS_VENTA, datos: Parameters<typeof renderizar>[1]) =>
  renderizar(CASOS_VENTA[clave].plantilla, datos, vocabularioVenta(clave));

test("todas las plantillas son válidas frente a su vocabulario", () => {
  for (const clave of Object.keys(CASOS_VENTA) as (keyof typeof CASOS_VENTA)[])
    assert.deepEqual(validar(CASOS_VENTA[clave].plantilla, vocabularioVenta(clave)), [], clave);
});

test("hay variantes de los seis casos y de los bordes conocidos", () => {
  const ids = variantes.map(([id]) => id);
  for (const n of ["N01", "N02", "N03", "N04-N05", "N06"]) assert.ok(ids.some((i) => i.startsWith(n + ".")), n);
  for (const i of ["N01.sin_cursos", "N01.ilimitado_sin_ciclo", "N03.sin_clases", "N04-N05.profesor_sin_nombre", "N06.a_persona_de_contacto_con_resto"])
    assert.ok(ids.includes(i), i);
});

for (const [id, ref] of variantes) {
  test(`${id}: referencia = función = plantilla`, () => {
    const e = ref.entrada;
    if (e.caso === "inscripcion") {
      assert.strictEqual(mensajeConfirmacionInscripcion(e.datos, gs), ref.resultado, "función ≠ referencia");
      assert.strictEqual(plantilla("N01", variablesInscripcion(e.datos, gs)), ref.resultado, "plantilla ≠ referencia");
    } else if (e.caso === "recibo") {
      assert.strictEqual(mensajeReciboPago(e.datos, gs), ref.resultado, "función ≠ referencia");
      assert.strictEqual(plantilla("N02", variablesRecibo(e.datos, gs)), ref.resultado, "plantilla ≠ referencia");
    } else if (e.caso === "prueba") {
      const d = { ...e, nombreCurso: new Map<number, string>(e.nombreCurso) };
      assert.strictEqual(mensajePrueba(d), ref.resultado, "función ≠ referencia");
      assert.strictEqual(plantilla("N03", variablesPrueba(d)), ref.resultado, "plantilla ≠ referencia");
    } else if (e.caso === "particular") {
      const d = { ...e, esFija: e.modalidad === "fija" };
      const f = mensajesParticular(d);
      assert.deepStrictEqual(f, ref.resultado, "función ≠ referencia");
      const vars = variablesParticular(d);
      assert.deepStrictEqual({ alumno: plantilla("N04", vars), profesor: plantilla("N05", vars) }, ref.resultado, "plantilla ≠ referencia");
    } else {
      assert.strictEqual(mensajeAlquiler(e), ref.resultado, "función ≠ referencia");
      assert.strictEqual(plantilla(claveAlquiler(e), variablesAlquiler(e)), ref.resultado, "plantilla ≠ referencia");
    }
  });
}

test("el recibo (N02) solo se manda si se cobró algo: igual que el código anterior", () => {
  const esperado = refs.__avisaRecibo as unknown as Record<string, boolean>;
  assert.equal(Object.keys(esperado).length, 6);
  for (const [monto, avisa] of Object.entries(esperado)) assert.equal(avisaRecibo(Number(monto)), avisa, monto);
});
