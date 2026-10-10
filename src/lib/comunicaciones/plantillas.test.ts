import { test } from "node:test";
import assert from "node:assert/strict";
import { renderizar, validar, parsear, ErrorPlantilla } from "./plantillas.ts";

const voc = { variables: [{ nombre: "a", obligatoria: true }, { nombre: "b" }], condiciones: ["hay"], listas: ["xs"] };

test("variables: copia el texto fuera de las llaves sin tocar espacios ni saltos", () => {
  assert.equal(renderizar("  Hola {{a}}!\n\n  ¡ñ «{{b}}» \t", { a: "Ana", b: "" }), "  Hola Ana!\n\n  ¡ñ «» \t");
});
test("el valor se inserta tal cual (sin escapar ni recortar)", () => {
  assert.equal(renderizar("[{{a}}]", { a: "  x {{b}} ${y} " }), "[  x {{b}} ${y} ]");
});
test("filtro mayuscula_inicial", () => {
  assert.equal(renderizar("{{a|mayuscula_inicial}}", { a: "ñandú" }), "Ñandú");
});
test("si / sino", () => {
  const p = "{{#si hay}}con{{#sino}}sin{{/si}}";
  assert.equal(renderizar(p, { hay: true }), "con");
  assert.equal(renderizar(p, { hay: false }), "sin");
  assert.equal(renderizar("{{#si hay}}x{{/si}}", { hay: false }), "");
});
test("cada con separador y último", () => {
  const p = '{{#cada xs sep=", " ultimo=" y "}}{{.}}{{/cada}}';
  assert.equal(renderizar(p, { xs: ["a", "b", "c"] }), "a, b y c");
  assert.equal(renderizar(p, { xs: ["a", "b"] }), "a y b");
  assert.equal(renderizar(p, { xs: ["a"] }), "a");
  assert.equal(renderizar(p, { xs: [] }), "");
});
test("marcador desconocido, filtro desconocido y sintaxis rota fallan", () => {
  assert.deepEqual(validar("{{zzz}}{{a}}", voc), ["Variable desconocida: «zzz»"]);
  assert.throws(() => parsear("{{a|inventado}}"), ErrorPlantilla);
  assert.throws(() => parsear("{{#si hay}}x"), ErrorPlantilla);
  assert.throws(() => parsear("{{a"), ErrorPlantilla);
  assert.throws(() => parsear("{{/si}}"), ErrorPlantilla);
  assert.throws(() => parsear("{{#codigo alert(1)}}"), ErrorPlantilla);
  assert.throws(() => parsear("{{a.b c}}"), ErrorPlantilla);
});
test("falta una obligatoria en la plantilla, o el dato está vacío: no genera mensaje", () => {
  assert.deepEqual(validar("hola", voc), ["Falta la variable obligatoria «a»"]);
  assert.throws(() => renderizar("{{a}}", { a: "" }, voc), /obligatoria y está vacía/);
  assert.throws(() => renderizar("{{a}}", {}, voc), /Falta el dato/);
});
test("condición o lista con el tipo equivocado fallan", () => {
  assert.throws(() => renderizar("{{#si hay}}x{{/si}}", { hay: "si" }), ErrorPlantilla);
  assert.throws(() => renderizar("{{#cada xs}}{{.}}{{/cada}}", { xs: "a" }), ErrorPlantilla);
});

test("permiteVacia: una variable obligatoria puede imprimirse vacía solo si el esquema lo permite", () => {
  const con = { variables: [{ nombre: "m", obligatoria: true, permiteVacia: true }] };
  const sin = { variables: [{ nombre: "m", obligatoria: true }] };
  assert.equal(renderizar("({{m}})", { m: "" }, con), "()");
  assert.throws(() => renderizar("({{m}})", { m: "" }, sin), /obligatoria y está vacía/);
});
