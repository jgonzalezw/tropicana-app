import { test } from "node:test";
import assert from "node:assert/strict";
import { contextoTercero, faltantesAlta, rolDe, textoFaltaAlta, type FormAltaContacto } from "./contactoVenta.ts";
import { CAMPOS_MINIMO, type CampoMinimo, type NivelMinimo } from "./tipos.ts";

function niveles(o: Partial<Record<CampoMinimo, NivelMinimo>>): Record<CampoMinimo, NivelMinimo> {
  const n = {} as Record<CampoMinimo, NivelMinimo>;
  for (const c of CAMPOS_MINIMO) n[c] = o[c] ?? "-";
  return n;
}

const vacio: FormAltaContacto = {
  tipo: "persona",
  nombre: "",
  apellido: "",
  razonSocial: "",
  whatsapp: "",
  extra: { email: null, sexo: null, redes: [], documento: null, fecha_nacimiento: null, consentimiento: null },
};

test("rolDe combina los dos roles", () => {
  assert.equal(rolDe(true, true), "alumno_profesor");
  assert.equal(rolDe(true, false), "alumno");
  assert.equal(rolDe(false, true), "profesor");
  assert.equal(rolDe(false, false), "contacto");
});

test("el contexto de un tercero depende del tipo", () => {
  assert.equal(contextoTercero("persona"), "tercero_persona");
  assert.equal(contextoTercero("organizacion"), "tercero_org");
});

test("persona: pide nombre y WhatsApp; el resto, solo si la matriz lo marca obligatorio", () => {
  const n = niveles({ nombre: "O", whatsapp: "O", apellido: "V" });
  assert.deepEqual(faltantesAlta(vacio, n), ["nombre", "whatsapp"]);
  assert.equal(textoFaltaAlta(faltantesAlta(vacio, n), vacio), "Falta el nombre y el WhatsApp.");
  const ok = { ...vacio, nombre: "Ana", whatsapp: "71234567" };
  assert.deepEqual(faltantesAlta(ok, n), []);
});

test("organización: razón social y NIT, y el documento se llama NIT", () => {
  const f: FormAltaContacto = { ...vacio, tipo: "organizacion", whatsapp: "71234567" };
  const n = niveles({ razon_social: "O", whatsapp: "O", documento: "O" });
  const falt = faltantesAlta(f, n);
  assert.deepEqual(falt, ["razon_social", "documento"]);
  assert.equal(textoFaltaAlta(falt, f), "Falta la razón social y el NIT.");
});

test("el nombre de una persona no se pide a una organización", () => {
  const f: FormAltaContacto = { ...vacio, tipo: "organizacion", razonSocial: "Colegio", whatsapp: "71234567" };
  assert.deepEqual(faltantesAlta(f, niveles({ nombre: "O", razon_social: "O", whatsapp: "O" })), []);
});

test("un WhatsApp con menos de 6 dígitos no cuenta", () => {
  const f = { ...vacio, nombre: "Ana", whatsapp: "123" };
  assert.deepEqual(faltantesAlta(f, niveles({ nombre: "O", whatsapp: "O" })), ["whatsapp"]);
});

test("el consentimiento obligatorio exige que esté otorgado", () => {
  const n = niveles({ nombre: "O", consentimiento: "O" });
  const base = { ...vacio, nombre: "Ana" };
  assert.deepEqual(faltantesAlta(base, n), ["consentimiento"]);
  const otorgado = { ...base, extra: { ...base.extra, consentimiento: { otorgado: true, medio: "en_persona" } } };
  assert.deepEqual(faltantesAlta(otorgado, n), []);
});

test("sin faltantes no hay texto", () => {
  assert.equal(textoFaltaAlta([], vacio), null);
});
