// R20 · E4b — estado visible, declaración y rectificación, clave idempotente.
import { test } from "node:test";
import assert from "node:assert/strict";
import { claveAviso, declaracionVigente, estadoVisible, type AccionAviso, type TipoAccionAviso } from "./estado.ts";

let n = 0;
const acc = (tipo: TipoAccionAviso, rectificaId: number | null = null): AccionAviso => ({
  id: ++n,
  tipo,
  actor: "Ana",
  actorId: "u1",
  creadoEn: "2026-10-10T10:00:00Z",
  motivo: null,
  rectificaId,
});

test("sin acciones el aviso está preparado", () => {
  assert.equal(estadoVisible([]), "preparado");
});

test("abrir WhatsApp es «abierto», nunca «declarado enviado»", () => {
  assert.equal(estadoVisible([acc("abierto_whatsapp")]), "abierto");
  assert.equal(estadoVisible([acc("copiado")]), "copiado");
  assert.equal(estadoVisible([acc("abierto_whatsapp"), acc("copiado")]), "copiado");
});

test("la declaración de envío se suma; rectificarla vuelve a la última acción operativa y no borra nada", () => {
  const abierto = acc("abierto_whatsapp");
  const declarado = acc("declarado_enviado");
  assert.equal(estadoVisible([abierto, declarado]), "declarado");
  const rectificada = acc("declaracion_rectificada", declarado.id);
  const todas = [abierto, declarado, rectificada];
  assert.equal(estadoVisible(todas), "abierto");
  assert.equal(declaracionVigente(todas), null);
  assert.equal(todas.length, 3); // el historial conserva las dos entradas
});

test("una declaración nueva después de rectificar vuelve a estar vigente", () => {
  const d1 = acc("declarado_enviado");
  const r1 = acc("declaracion_rectificada", d1.id);
  const d2 = acc("declarado_enviado");
  assert.equal(declaracionVigente([d1, r1, d2])?.id, d2.id);
});

test("la clave es evento + caso + variante + destinatario + canal (N09 y N10 no se pisan)", () => {
  const base = { fuenteEvento: "reservas_historial", idEvento: 77, variante: "unica", canal: "whatsapp" };
  const n09 = claveAviso({ ...base, caso: "N09", contactoId: 5 });
  const n10 = claveAviso({ ...base, caso: "N10", contactoId: 9 });
  assert.equal(n09, "reservas_historial:77:N09:unica:5:whatsapp");
  assert.notEqual(n09, n10);
  assert.equal(n09, claveAviso({ ...base, caso: "N09", contactoId: 5 }));
});
