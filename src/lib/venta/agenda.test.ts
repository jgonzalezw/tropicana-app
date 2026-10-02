import { test } from "node:test";
import assert from "node:assert/strict";
import { planificarSesiones } from "./agenda.ts";

const lunes = new Date(2026, 9, 5); // lunes 5/10/2026

test("flexible: una sola sesión y el resto queda sin agendar", () => {
  const r = planificarSesiones({ modalidad: "flexible", hora: "18:00", duracionMin: 60 }, lunes, 4);
  assert.ok("pedidas" in r);
  assert.equal(r.pedidas.length, 1);
  assert.equal(r.pedidas[0].fecha, "2026-10-05");
  assert.equal(r.leftoverMin, 180);
});

test("fija: genera todas las sesiones que caben, por piso, sin pasarse de las horas", () => {
  const r = planificarSesiones({ modalidad: "fija", diasSemana: [1, 3], hora: "18:00", duracionMin: 90 }, lunes, 4);
  assert.ok("pedidas" in r);
  assert.deepEqual(
    r.pedidas.map((s) => s.fecha),
    ["2026-10-05", "2026-10-07"],
  );
  assert.equal(r.leftoverMin, 60);
});

test("duración mayor al paquete: error", () => {
  const r = planificarSesiones({ modalidad: "fija", diasSemana: [1], hora: "18:00", duracionMin: 300 }, lunes, 4);
  assert.ok("error" in r);
});

test("fija sin días: error", () => {
  const r = planificarSesiones({ modalidad: "fija", diasSemana: [], hora: "18:00", duracionMin: 60 }, lunes, 4);
  assert.ok("error" in r);
});
