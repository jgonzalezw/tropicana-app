import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarWhatsapp,
  whatsappEnFormato,
  nombreCompleto,
  apellidoNombre,
  apellidoDe,
  normalizarRed,
  validarDocumento,
  compararContactosPorApellido,
  validarIdentidadAlumno,
  edadDesde,
  validarFechaNacimiento,
  documentoNormalizado,
  coincideBusqueda,
  urlPerfilRed,
  urlChatWhatsapp,
} from "./contactos.ts";

/** Fecha ISO de hace `anios` años (y algunos días de margen para no depender del día de la corrida). */
function haceAnios(anios: number, margenDias = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anios);
  d.setDate(d.getDate() - margenDias);
  return d.toISOString().slice(0, 10);
}

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

test('apellidoNombre: "Apellido, Nombre" — para listas ordenadas por apellido (Javier, 2026-09-24)', () => {
  assert.equal(apellidoNombre({ tipo: "persona", nombre: "Natalia", apellido: "Salek", razon_social: null }), "Salek, Natalia");
  assert.equal(apellidoNombre({ tipo: "persona", nombre: "Jessica", apellido: null, razon_social: null }), "Jessica");
  assert.equal(apellidoNombre({ tipo: "organizacion", nombre: null, apellido: null, razon_social: "Sala XYZ" }), "Sala XYZ");
  assert.equal(apellidoNombre(null), "—");
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

test("validarIdentidadAlumno: adulto necesita 6+ dígitos de WhatsApp propio", () => {
  const base = { es_menor: false, whatsapp: "", tutorContactoId: null, tutorWhatsapp: "" };
  assert.match(validarIdentidadAlumno(base) ?? "", /WhatsApp/);
  assert.equal(validarIdentidadAlumno({ ...base, whatsapp: "77644222" }), null);
});

test("validarIdentidadAlumno: menor necesita tutor con WhatsApp o ya vinculado", () => {
  const base = { es_menor: true, whatsapp: "", tutorContactoId: null, tutorWhatsapp: "" };
  assert.match(validarIdentidadAlumno(base) ?? "", /tutor/);
  assert.equal(validarIdentidadAlumno({ ...base, tutorWhatsapp: "77311069" }), null);
  assert.equal(validarIdentidadAlumno({ ...base, tutorContactoId: 5 }), null);
});

test("validarIdentidadAlumno: nombre/apellido ya NO se validan acá (C3-0a.3 — pasan a la matriz)", () => {
  // Antes de C3-0a.3 esto hubiera fallado por nombre/apellido vacíos; ahora
  // esa exigencia vive en la matriz de mínimos (`validarContraMatriz`), no
  // en esta identidad — la firma de la función ya ni recibe esos campos.
  assert.equal(
    validarIdentidadAlumno({ es_menor: false, whatsapp: "77644222", tutorContactoId: null, tutorWhatsapp: "" }),
    null
  );
});

test("edadDesde: cuenta años cumplidos, no solo la resta de años calendario", () => {
  assert.equal(edadDesde(haceAnios(30, 5)), 30);
  // Cumpleaños todavía no llegó este año: un año menos que la resta simple.
  assert.equal(edadDesde(haceAnios(30, -5)), 29);
});

test("validarFechaNacimiento: sin fecha no valida nada (campo opcional/oculto)", () => {
  assert.equal(validarFechaNacimiento(null, false), null);
});

test("validarFechaNacimiento: rechaza una fecha futura", () => {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  assert.match(validarFechaNacimiento(manana.toISOString().slice(0, 10), false) ?? "", /futura/);
});

test("validarFechaNacimiento: menor de 18 sin \"es menor\" se rechaza", () => {
  assert.match(validarFechaNacimiento(haceAnios(17), false) ?? "", /menor de edad/);
});

test("validarFechaNacimiento: menor de 18 CON \"es menor\" pasa", () => {
  assert.equal(validarFechaNacimiento(haceAnios(17), true), null);
});

test("validarFechaNacimiento: 18 o más no exige es_menor", () => {
  assert.equal(validarFechaNacimiento(haceAnios(18, 5), false), null);
  assert.equal(validarFechaNacimiento(haceAnios(40), false), null);
});

const TIPOS = ["ci", "ci_extranjero", "pasaporte", "nit"];

test("documentoNormalizado: sin número es null, no un documento vacío (caso Nadine, prod 2026-09-24)", () => {
  assert.deepEqual(documentoNormalizado(null, TIPOS), { documento: null });
  assert.deepEqual(
    documentoNormalizado({ tipo_documento: "", numero: "", complemento: null, expedido: null }, TIPOS),
    { documento: null }
  );
  assert.deepEqual(
    documentoNormalizado({ tipo_documento: "ci", numero: "   ", complemento: "1A", expedido: null }, TIPOS),
    { documento: null }
  );
});

test("documentoNormalizado: un tipo fuera del catálogo se rechaza con mensaje, no llega a la base", () => {
  const r = documentoNormalizado({ tipo_documento: "", numero: "4455667", complemento: null, expedido: null }, TIPOS);
  assert.match(r.error ?? "", /tipo de documento/);
});

test("documentoNormalizado: válido pasa recortado", () => {
  assert.deepEqual(
    documentoNormalizado({ tipo_documento: "ci", numero: " 4455667 ", complemento: " ", expedido: null }, TIPOS),
    { documento: { tipo_documento: "ci", numero: "4455667", complemento: null, expedido: null } }
  );
});

const ANA = {
  contacto: { tipo: "persona" as const, nombre: "Ana", apellido: "Martínez", razon_social: null, whatsapp: "+59171051234" },
};
const MENOR = {
  contacto: { tipo: "persona" as const, nombre: "Loana", apellido: "Barrientos", razon_social: null, whatsapp: null },
  tutorWhatsapp: "+59170878081",
};

test("coincideBusqueda: los criterios de siempre siguen encontrando igual, con y sin documento", () => {
  for (const conDoc of [null, "4455667"]) {
    const ana = { ...ANA, documento: conDoc };
    assert.equal(coincideBusqueda("martí", ana), true, "por apellido");
    assert.equal(coincideBusqueda("Ana Mar", ana), true, "por nombre completo");
    assert.equal(coincideBusqueda("7105", ana), true, "por WhatsApp");
    assert.equal(coincideBusqueda("a", ana), false, "menos de 2 caracteres no busca");
    assert.equal(coincideBusqueda("Pérez", ana), false);
    const menor = { ...MENOR, documento: conDoc };
    assert.equal(coincideBusqueda("0878", menor), true, "por WhatsApp del tutor");
  }
});

test("coincideBusqueda: el documento se suma como criterio (parcial, sin espacios ni mayúsculas)", () => {
  const ana = { ...ANA, documento: "4455667" };
  assert.equal(coincideBusqueda("4455", ana), true);
  assert.equal(coincideBusqueda("445 5667", ana), true);
  assert.equal(coincideBusqueda("9999", ana), false);
  assert.equal(coincideBusqueda("4455", ANA), false, "sin documento no aparece por un número que no tiene");
  assert.equal(coincideBusqueda("ab12", { ...ANA, documento: "AB123456" }), true, "pasaporte con letras");
});

const PATRON_IG = "https://www.instagram.com/{usuario}";

test("urlPerfilRed: usuario simple, con @ y con URL completa pegada dan el mismo link", () => {
  assert.equal(urlPerfilRed(PATRON_IG, "instagram", "nadinesalek"), "https://www.instagram.com/nadinesalek");
  assert.equal(urlPerfilRed(PATRON_IG, "instagram", "@nadinesalek"), "https://www.instagram.com/nadinesalek");
  assert.equal(
    urlPerfilRed(PATRON_IG, "instagram", "https://instagram.com/nadinesalek/"),
    "https://www.instagram.com/nadinesalek"
  );
});

test("urlPerfilRed: sin plantilla, sin usuario, o plantilla no-https da null", () => {
  assert.equal(urlPerfilRed(null, "instagram", "nadinesalek"), null);
  assert.equal(urlPerfilRed(PATRON_IG, "instagram", ""), null);
  assert.equal(urlPerfilRed("javascript:alert(1)//{usuario}", "instagram", "x"), null);
});

test("urlPerfilRed: un usuario con caracteres especiales queda escapado en la URL", () => {
  assert.equal(urlPerfilRed(PATRON_IG, "instagram", "a b&c"), "https://www.instagram.com/a%20b%26c");
});

test("urlPerfilRed: la red whatsapp usa solo dígitos (wa.me no entiende otra cosa)", () => {
  assert.equal(
    urlPerfilRed("https://wa.me/{usuario}", "whatsapp", "+591 7731 1069"),
    "https://wa.me/59177311069"
  );
  assert.equal(urlPerfilRed("https://wa.me/{usuario}", "whatsapp", "sin números"), null);
});

test("urlChatWhatsapp: numero internacional da el link de wa.me", () => {
  assert.equal(urlChatWhatsapp("+59177311069"), "https://wa.me/59177311069");
  assert.equal(urlChatWhatsapp("+34625844863"), "https://wa.me/34625844863");
});

test("urlChatWhatsapp: numero crudo sin + no arma link (no se inventa el pais)", () => {
  assert.equal(urlChatWhatsapp("776326266"), null);
  assert.equal(urlChatWhatsapp(null), null);
  assert.equal(urlChatWhatsapp(""), null);
});

test("urlChatWhatsapp: con texto agrega ?text= codificado", () => {
  assert.equal(
    urlChatWhatsapp("+59177311069", "Hola! Se suspendió tu clase"),
    "https://wa.me/59177311069?text=Hola!%20Se%20suspendi%C3%B3%20tu%20clase"
  );
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
