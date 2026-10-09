import { test } from "node:test";
import assert from "node:assert/strict";
import { nombreVisible } from "./formato.ts";

test("nombreVisible: un nombre con minúsculas se deja intacto", () => {
  assert.equal(nombreVisible("Salsa Intermedio · 8 clases"), "Salsa Intermedio · 8 clases");
  assert.equal(nombreVisible("Plan Regular - Contemporaneo"), "Plan Regular - Contemporaneo");
  // Una sola minúscula alcanza para que se respete (así se corrige a mano en Planes).
  assert.equal(nombreVisible("WEDING DANCE Escencia"), "WEDING DANCE Escencia");
});

test("nombreVisible: todo en mayúsculas pasa a mayúscula inicial y conserva palabras con números", () => {
  assert.equal(nombreVisible("FLEX 6H PARTICULARES SALSA"), "Flex 6H particulares salsa");
  assert.equal(nombreVisible("NIVEL C1 BACHATA"), "Nivel C1 bachata");
  assert.equal(nombreVisible("CR - TU RITMO 8 - SBIN/BCON/DCOM/CONT-8CL"), "Cr - tu ritmo 8 - SBIN/BCON/DCOM/CONT-8CL");
});

test("nombreVisible: la mayúscula inicial no se la lleva un número que abre el texto", () => {
  assert.equal(nombreVisible("1 PREVENTA - TROPICANA HISTORY FEST ONE"), "1 Preventa - tropicana history fest one");
});

test("nombreVisible: conserva las siglas de la lista", () => {
  assert.equal(nombreVisible("PAGO QR COLEGIO SRL"), "Pago QR colegio SRL");
  assert.equal(nombreVisible("CLASE UMSA"), "Clase UMSA");
  assert.equal(nombreVisible("ALQUILER (QR)"), "Alquiler (QR)");
});

test("nombreVisible: acentos, ñ y vacíos", () => {
  assert.equal(nombreVisible("DANZA CONTEMPORÁNEA NIÑOS"), "Danza contemporánea niños");
  assert.equal(nombreVisible("ÁRABE"), "Árabe");
  assert.equal(nombreVisible(""), "");
  assert.equal(nombreVisible(null), "");
  assert.equal(nombreVisible(undefined), "");
});

test("nombreVisible: no cubre nombres propios dentro del plan (queda en minúsculas)", () => {
  assert.equal(nombreVisible("WEDING DANCE ESCENCIA"), "Weding dance escencia");
});
