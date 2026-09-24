import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarWhatsapp,
  whatsappEnFormato,
  nombreCompleto,
  apellidoDe,
  normalizarRed,
  validarDocumento,
  compararContactosPorApellido,
} from "./contactos.ts";

test("normalizarWhatsapp: 8 dígitos locales → +591", () => {
  assert.equal(normalizarWhatsapp("77311069"), "+59177311069");
  assert.equal(normalizarWhatsapp("7731 1069"), "+59177311069");
  assert.equal(normalizarWhatsapp("+591 7731 1069"), "+59177311069");
});

test("normalizarWhatsapp: los dos casos raros medidos en producción no se inventan", () => {
  // 9 dígitos (posible dígito de más, medido en prod) y 11 dígitos que no
  // arrancan con 591 (parece un número de otro país). Sin un "+" explícito
  // se dejan en dígitos crudos, para que el control 23 los señale.
  assert.equal(normalizarWhatsapp("776045115"), "776045115");
  assert.equal(normalizarWhatsapp("34600000000"), "34600000000");
});

test("normalizarWhatsapp: un + escrito a mano para un número extranjero se respeta", () => {
  // Caso real (Manuel Aguilar, profesor, dev): el relleno automático de la
  // 0048 lo dejó en dígitos crudos "34625844863" porque no es boliviano. Al
  // corregirlo a mano con el prefijo de su país, el "+" no se puede perder
  // silenciosamente — quien lo escribió ya decidió el país.
  assert.equal(normalizarWhatsapp("+34625844863"), "+34625844863");
  assert.equal(normalizarWhatsapp("+34 625 84 48 63"), "+34625844863");
});

test("normalizarWhatsapp: vacío o sin dígitos → null", () => {
  assert.equal(normalizarWhatsapp(""), null);
  assert.equal(normalizarWhatsapp(null), null);
  assert.equal(normalizarWhatsapp("---"), null);
});

test("whatsappEnFormato", () => {
  assert.equal(whatsappEnFormato("+59177311069"), true);
  assert.equal(whatsappEnFormato("77311069"), false);
  assert.equal(whatsappEnFormato(null), false);
});

test("nombreCompleto: persona, organización y faltante", () => {
  assert.equal(nombreCompleto({ tipo: "persona", nombre: "Natalia", apellido: "Salek", razon_social: null }), "Natalia Salek");
  assert.equal(nombreCompleto({ tipo: "persona", nombre: "Jessica", apellido: null, razon_social: null }), "Jessica");
  assert.equal(nombreCompleto({ tipo: "organizacion", nombre: null, apellido: null, razon_social: "Sala XYZ" }), "Sala XYZ");
  assert.equal(nombreCompleto(null), "—");
});

test("apellidoDe: usa nombre si no hay apellido (caso tutor de texto)", () => {
  assert.equal(apellidoDe({ apellido: "Vivancos", nombre: "Sebastian" }), "Vivancos");
  assert.equal(apellidoDe({ apellido: null, nombre: "Jessica Galvis" }), "Jessica Galvis");
});

test("normalizarRed: acepta URL o @usuario", () => {
  assert.equal(normalizarRed("instagram", "https://instagram.com/tropicana.bo/"), "tropicana.bo");
  assert.equal(normalizarRed("instagram", "@tropicana.bo"), "tropicana.bo");
  assert.equal(normalizarRed("tiktok", "https://www.tiktok.com/@tropicana.bo"), "tropicana.bo");
});

test("validarDocumento: sin patrón siempre pasa; con patrón lo exige", () => {
  assert.equal(validarDocumento(null, "cualquier-cosa"), true);
  assert.equal(validarDocumento("^[0-9]{5,10}$", "1234567"), true);
  assert.equal(validarDocumento("^[0-9]{5,10}$", "abc"), false);
  assert.equal(validarDocumento("^[0-9]{5,10}$", ""), false);
});

test("compararContactosPorApellido: ordena por apellido, luego nombre", () => {
  const lista = [
    { nombre: "Fabian", apellido: "Vivancos" },
    { nombre: "Bruna", apellido: null },
    { nombre: "Loana", apellido: "Barrientos" },
  ];
  const ordenado = [...lista].sort(compararContactosPorApellido);
  assert.deepEqual(
    ordenado.map((c) => c.apellido ?? c.nombre),
    ["Barrientos", "Bruna", "Vivancos"]
  );
});
