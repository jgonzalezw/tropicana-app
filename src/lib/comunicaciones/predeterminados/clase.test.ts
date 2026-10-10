// R20 · E2 — equivalencia de tres vías para los avisos de clase (N19–N21):
//   referencia (código anterior a la extracción, `__referencias__/clases.json`)
//   = función movida (legado/clase.ts)
//   = plantilla predeterminada renderizada con el adaptador.
// Igualdad estricta. Incluye los casos en que un aviso NO corresponde.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  armarAvisosSuspension,
  armarAvisoProfesor,
  armarAvisosReapertura,
  type ClaseSuspendida,
  type ContactoAviso,
} from "../legado/clase.ts";
import { renderizar, validar } from "../plantillas.ts";
import {
  CASOS_CLASE,
  vocabularioClase,
  variablesSuspension,
  variablesSuspensionProfesor,
  variablesReapertura,
} from "./clase.ts";

const refs = JSON.parse(readFileSync(new URL("../__referencias__/clases.json", import.meta.url), "utf8")) as Record<
  string,
  { entrada: any; resultado: unknown }
>;

const plantillaSuspension = (e: Parameters<typeof variablesSuspension>[0]) =>
  renderizar(CASOS_CLASE.N19.plantilla, variablesSuspension(e), vocabularioClase("N19"));
const plantillaProfesor = (e: Parameters<typeof variablesSuspensionProfesor>[0]) =>
  renderizar(CASOS_CLASE.N20.plantilla, variablesSuspensionProfesor(e), vocabularioClase("N20"));
const plantillaReapertura = (e: Parameters<typeof variablesReapertura>[0]) =>
  renderizar(CASOS_CLASE.N21.plantilla, variablesReapertura(e), vocabularioClase("N21"));

const mapa = (d: { id: number; contacto: ContactoAviso }[] | undefined) =>
  new Map<number, ContactoAviso>((d ?? []).map((x) => [x.id, x.contacto]));
const ida = (x: unknown) => JSON.parse(JSON.stringify(x));

test("las tres plantillas son válidas frente a su vocabulario", () => {
  for (const id of Object.keys(CASOS_CLASE) as (keyof typeof CASOS_CLASE)[])
    assert.deepEqual(validar(CASOS_CLASE[id].plantilla, vocabularioClase(id)), [], id);
});

test("hay variantes de los tres casos y de los avisos que no corresponden", () => {
  const ids = Object.keys(refs);
  for (const n of ["N19", "N20", "N21"]) assert.ok(ids.some((i) => i.startsWith(n + ".")), n);
  assert.ok(ids.includes("N19.sin_alumnos_afectados"));
  assert.ok(ids.includes("N20.sin_profesor_titular"));
  assert.ok(ids.includes("N20.profesor_sin_contacto"));
  assert.ok(ids.includes("N21.no_estaba_suspendida"));
  assert.ok(ids.includes("N21.nadie_restablecido"));
});

for (const [id, ref] of Object.entries(refs)) {
  test(`${id}: referencia = función movida = plantilla`, () => {
    const e = ref.entrada;
    if (e.caso === "suspension") {
      const porAlumno = new Map<number, ClaseSuspendida[]>(e.porAlumno.map((x: any) => [x.id, x.clases]));
      const datos = mapa(e.contactos);
      assert.deepStrictEqual(ida(armarAvisosSuspension(datos, porAlumno)), ref.resultado, "función movida ≠ referencia");
      assert.deepStrictEqual(ida(armarAvisosSuspension(datos, porAlumno, plantillaSuspension)), ref.resultado, "plantilla ≠ referencia");
    } else if (e.caso === "profesor") {
      assert.deepStrictEqual(ida(armarAvisoProfesor(e.profesorId, e.p, e.datos)), ref.resultado, "función movida ≠ referencia");
      assert.deepStrictEqual(ida(armarAvisoProfesor(e.profesorId, e.p, e.datos, plantillaProfesor)), ref.resultado, "plantilla ≠ referencia");
    } else {
      const r = { alumnosRestablecidos: e.restablecidos };
      const args = { fecha: e.fecha };
      const datos = mapa(e.contactos);
      assert.deepStrictEqual(ida(armarAvisosReapertura(e.estabaSuspendida, r, e.curso, datos, args)), ref.resultado, "función movida ≠ referencia");
      assert.deepStrictEqual(
        ida(armarAvisosReapertura(e.estabaSuspendida, r, e.curso, datos, args, plantillaReapertura)),
        ref.resultado,
        "plantilla ≠ referencia"
      );
    }
  });
}
