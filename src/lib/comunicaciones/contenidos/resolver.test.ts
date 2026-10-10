import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirResolucion, type FilaUso, type FilaVersion } from "./resolver.ts";
import { hashContenido } from "./hash.ts";
import { validarAprobacion, validarLiberacion, validarPublicacion, validarRetiro } from "./validacion.ts";

const esquema = { condiciones: [], listas: [], variables: [{ nombre: "a", obligatoria: true, permiteVacia: false }] };
const cuerpo = "Hola {{a}}";
const hash = hashContenido({ cuerpo, asunto: null, esquema });
const uso = (o: Partial<FilaUso> = {}): FilaUso => ({ id: 1, modo: "legado", contenido_id: 7, version_id: null, ...o });
const ver = (o: Partial<FilaVersion> = {}): FilaVersion => ({ id: 3, contenido_id: 7, estado: "publicado", cuerpo, asunto: null, esquema, hash, ...o });

test("legado: no hay liberación y la operación sigue con el código", () => {
  assert.deepEqual(decidirResolucion("x", uso(), null), { modo: "legado" });
});
test("módulo con una versión publicada y consistente devuelve el texto", () => {
  assert.deepEqual(decidirResolucion("x", uso({ modo: "modulo", version_id: 3 }), ver()), { modo: "modulo", versionId: 3, cuerpo, asunto: null, hash });
});
test("una inconsistencia lanza: nunca cae en legado", () => {
  const m = uso({ modo: "modulo", version_id: 3 });
  assert.throws(() => decidirResolucion("x", null, null), /No existe la asignación/);
  assert.throws(() => decidirResolucion("x", uso({ modo: "modulo" }), null), /sin versión liberada/);
  assert.throws(() => decidirResolucion("x", m, null), /no se pudo leer/);
  assert.throws(() => decidirResolucion("x", m, ver({ contenido_id: 8 })), /no es del contenido/);
  assert.throws(() => decidirResolucion("x", m, ver({ estado: "aprobado" })), /no publicada/);
  assert.throws(() => decidirResolucion("x", m, ver({ estado: "retirado" })), /no publicada/);
  assert.throws(() => decidirResolucion("x", m, ver({ cuerpo: cuerpo + " " })), /no reproduce su hash/);
});

test("validación de las acciones editoriales (una sola función, compartida)", () => {
  const h = "a".repeat(64);
  assert.equal(validarAprobacion({ versionId: 1, hashVisto: h }), null);
  assert.match(validarAprobacion({ versionId: 1, hashVisto: "x" }) ?? "", /hash/);
  assert.match(validarAprobacion({ versionId: 0, hashVisto: h }) ?? "", /versión/);
  assert.match(validarPublicacion({ versionId: 1, hashVisto: h, etiqueta: " " }) ?? "", /etiqueta/);
  assert.equal(validarPublicacion({ versionId: 1, hashVisto: h, etiqueta: "v1" }), null);
  assert.match(validarRetiro({ versionId: 1, motivo: "" }) ?? "", /motivo/);
  const base = { uso: "u", variante: "unica", canal: "whatsapp", versionId: 1, modo: "modulo" as const, motivo: "m", hashAprobado: h, aprobacionRef: "ref" };
  assert.equal(validarLiberacion(base), null);
  assert.match(validarLiberacion({ ...base, aprobacionRef: " " }) ?? "", /aprobación/);
  assert.match(validarLiberacion({ ...base, motivo: "" }) ?? "", /motivo/);
  assert.match(validarLiberacion({ ...base, hashAprobado: null }) ?? "", /hash/);
  assert.match(validarLiberacion({ ...base, versionId: null }) ?? "", /exige una versión/);
  assert.equal(validarLiberacion({ ...base, versionId: null, modo: "legado", hashAprobado: null }), null, "volver a legado no exige versión");
  assert.match(validarLiberacion({ ...base, uso: "" }) ?? "", /asignación/);
});
