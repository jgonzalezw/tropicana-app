import { test } from "node:test";
import assert from "node:assert/strict";
import { mensajeSuspension, mensajeReapertura, mensajeSuspensionProfesor } from "./avisosClase.ts";

test("suspensión: una clase, con el ciclo corrido", () => {
  const m = mensajeSuspension({
    nombrePila: "Ana",
    clases: [{ curso: "Salsa", fecha: "2026-10-05", finCicloNuevo: "2026-11-09", motivoTexto: "un feriado" }],
  });
  assert.match(m, /^Hola Ana!/);
  assert.match(m, /Salsa del .*qued[óo] suspendida por un feriado\./);
  assert.match(m, /Tu ciclo se corrió: ahora vence el /);
});

test("suspensión: varias clases van en plural y sin ciclo no lo menciona", () => {
  const m = mensajeSuspension({
    nombrePila: "Ana",
    clases: [
      { curso: "Salsa", fecha: "2026-10-05", finCicloNuevo: null, motivoTexto: "un feriado" },
      { curso: "Bachata", fecha: "2026-10-06", finCicloNuevo: null, motivoTexto: "un feriado" },
    ],
  });
  assert.match(m, /quedaron suspendidas/);
  assert.doesNotMatch(m, /ciclo se corrió/);
});

test("reapertura: dice que se restableció y cuándo vence el ciclo", () => {
  const m = mensajeReapertura({ nombrePila: "Luis", curso: "Salsa", fecha: "2026-10-05", finCiclo: "2026-11-02" });
  assert.match(m, /se restableció/);
  assert.match(m, /Tu ciclo vuelve a vencer el /);
  assert.doesNotMatch(mensajeReapertura({ nombrePila: "Luis", curso: "Salsa", fecha: "2026-10-05", finCiclo: null }), /ciclo/);
});

test("profesor: la clase suspendida no hace falta dictarla", () => {
  const m = mensajeSuspensionProfesor({ nombrePila: "Ana", curso: "Salsa", fecha: "2026-10-05", motivoTexto: "un feriado" });
  assert.match(m, /quedó suspendida por un feriado/);
});
