// R20 · E4b — contactabilidad: lo que respalda cada registro y su texto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluarContactabilidad, type RegistroConsentimiento, type TextoPolitica } from "./contactabilidad.ts";

const V1: TextoPolitica = {
  version: "v1",
  finalidad: "contacto",
  texto:
    "Tropicana guarda tu nombre, WhatsApp y los datos que nos compartas para gestionar tu inscripcion, tus clases y tus pagos, " +
    "y para avisarte por WhatsApp sobre tus clases, vencimientos y novedades de la academia.",
};
const SERVICIO_EMAIL: TextoPolitica = { version: "s1", finalidad: "servicio", texto: "Te avisamos por email sobre tus clases." };
const SERVICIO_WA: TextoPolitica = { version: "s2", finalidad: "servicio", texto: "Te avisamos por WhatsApp sobre tus clases." };
const textos = [V1, SERVICIO_EMAIL, SERVICIO_WA];

const reg = (finalidad: string, otorgado: boolean, version: string | null, creado_en = "2026-10-01T00:00:00Z"): RegistroConsentimiento => ({
  finalidad,
  otorgado,
  medio: "presencial",
  version_politica: version,
  creado_en,
});
const eval_ = (noContactar: boolean, vigentes: RegistroConsentimiento[], canal: "whatsapp" | "email" = "whatsapp") =>
  evaluarContactabilidad({ noContactar, vigentes, textos, finalidad: "servicio", canal });

test("no_contactar=true bloquea, sea cual sea el resto", () => {
  const c = eval_(true, [reg("servicio", true, "s2")]);
  assert.equal(c.estado, "no_contactar");
  assert.equal(c.bloquea, true);
});

test("no_contactar=false no es un consentimiento: sin registros queda pendiente, con advertencia y sin bloquear", () => {
  const c = eval_(false, []);
  assert.equal(c.estado, "pendiente");
  assert.equal(c.bloquea, false);
  assert.match(c.advertencia ?? "", /Sin consentimiento/);
  assert.equal(c.registro, null);
});

test("v1 otorgado respalda servicio por WhatsApp (su texto lo nombra) y conserva su procedencia", () => {
  const c = eval_(false, [reg("contacto", true, "v1")]);
  assert.equal(c.estado, "registrado");
  assert.equal(c.advertencia, null);
  assert.deepEqual(c.registro, { finalidad: "contacto", otorgado: true, medio: "presencial", version: "v1", fecha: "2026-10-01T00:00:00Z" });
});

test("v1 otorgado para email: su texto no nombra el email, no se le atribuye", () => {
  const c = eval_(false, [reg("contacto", true, "v1")], "email");
  assert.equal(c.estado, "pendiente");
});

test("v1 otorgado SIN versión: no se atribuye el canal (canal no identificado, sin bloqueo)", () => {
  const c = eval_(false, [reg("contacto", true, null)]);
  assert.equal(c.estado, "registrado_canal_no_identificado");
  assert.equal(c.bloquea, false);
});

test("v1 rechazado es AMBIGUO: advertencia, no bloquea, queda para revisión", () => {
  const c = eval_(false, [reg("contacto", false, "v1")]);
  assert.equal(c.estado, "rechazo_ambiguo");
  assert.equal(c.bloquea, false);
  assert.match(c.advertencia ?? "", /por revisar/);
});

test("rechazo de servicio cuyo texto identifica WhatsApp: explícito, bloquea", () => {
  const c = eval_(false, [reg("servicio", false, "s2")]);
  assert.equal(c.estado, "rechazo_explicito");
  assert.equal(c.bloquea, true);
});

test("rechazo de servicio cuyo texto habla de email: no aplica a WhatsApp", () => {
  assert.equal(eval_(false, [reg("servicio", false, "s1")]).estado, "pendiente");
  assert.equal(eval_(false, [reg("servicio", false, "s1")], "email").estado, "rechazo_explicito");
});

test("rechazo de servicio sin texto que identifique el canal: ambiguo, no bloquea", () => {
  const c = eval_(false, [reg("servicio", false, null)]);
  assert.equal(c.estado, "rechazo_ambiguo");
  assert.equal(c.bloquea, false);
});

test("rechazo «todas» es general y bloquea; un otorgado «todas» registra", () => {
  assert.equal(eval_(false, [reg("todas", false, null)]).bloquea, true);
  assert.equal(eval_(false, [reg("todas", true, null)]).estado, "registrado");
});

test("el registro más reciente que aplica decide", () => {
  const viejoRechazo = reg("servicio", false, "s2", "2026-09-01T00:00:00Z");
  const nuevoOtorgado = reg("todas", true, null, "2026-10-05T00:00:00Z");
  assert.equal(eval_(false, [viejoRechazo, nuevoOtorgado]).estado, "registrado");
  assert.equal(eval_(false, [nuevoOtorgado, viejoRechazo]).estado, "registrado");
  // y al revés: un rechazo posterior pisa el otorgado anterior
  const otorgadoViejo = reg("servicio", true, "s2", "2026-09-01T00:00:00Z");
  const rechazoNuevo = reg("servicio", false, "s2", "2026-10-05T00:00:00Z");
  assert.equal(eval_(false, [otorgadoViejo, rechazoNuevo]).estado, "rechazo_explicito");
});

test("una finalidad comercial no usa el otorgado v1 como autorización", () => {
  const c = evaluarContactabilidad({
    noContactar: false,
    vigentes: [reg("contacto", true, "v1")],
    textos,
    finalidad: "comercial",
    canal: "whatsapp",
  });
  assert.equal(c.estado, "pendiente");
});
