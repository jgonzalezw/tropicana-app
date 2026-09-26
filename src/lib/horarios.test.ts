import { test } from "node:test";
import assert from "node:assert/strict";
import { formatearHoras } from "./horarios.ts";

test("formatearHoras: entero sin decimales", () => {
  assert.equal(formatearHoras(7), "7");
  assert.equal(formatearHoras(8), "8");
  assert.equal(formatearHoras(0), "0");
});

test("formatearHoras: fracción con el mínimo de decimales", () => {
  assert.equal(formatearHoras(7.5), "7.5");
  assert.equal(formatearHoras(0.5), "0.5");
});

test("formatearHoras: hasta 2 decimales, sin ceros de más", () => {
  assert.equal(formatearHoras(1.25), "1.25");
  assert.equal(formatearHoras(1.2), "1.2");
});
