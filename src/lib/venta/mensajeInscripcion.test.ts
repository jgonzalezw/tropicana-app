/** Los textos de WhatsApp de una inscripción (I-001). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mensajeConfirmacionInscripcion, mensajeReciboPago, textoAsistencia, textoClases, type DatosConfirmacion } from "./mensajeInscripcion.ts";

const gs = (n: number) => `Gs. ${n}`;

const base = (): DatosConfirmacion => ({
  alumno: "Ana Pérez",
  esMenor: false,
  plan: "Plan Doble",
  cursos: [
    { nombre: "Salsa", dias: [1, 3], hora: "19:00", duracionMin: 90 },
    { nombre: "Bachata", dias: [5], hora: null, duracionMin: null },
  ],
  clasesPlan: 12,
  bono: 2,
  cicloDias: null,
  inicio: "lun 5 oct",
  fin: "vie 6 nov",
  tolerancia: 1,
  precio: 300000,
  credito: 0,
  cobrado: 100000,
  medio: "Efectivo",
  saldo: 200000,
  compromiso: "vie 16 oct",
});

test("lista cada curso con sus días y horario", () => {
  const t = mensajeConfirmacionInscripcion(base(), gs);
  assert.match(t, /Cursos:/);
  assert.match(t, /• Salsa: lunes y miércoles, 19:00 → 20:30/);
  assert.match(t, /• Bachata: viernes/);
});

test("incluye clases con bono, ciclo, asistencia, cuota y pago", () => {
  const t = mensajeConfirmacionInscripcion(base(), gs);
  assert.match(t, /12 clases \(incluye 2 clases de bono\)/);
  assert.match(t, /termina aprox\. el vie 6 nov/);
  assert.match(t, /hasta 1 vez por ciclo/);
  assert.match(t, /Pagado: Gs\. 100000 \(Efectivo\)/);
  assert.match(t, /Saldo: Gs\. 200000 hasta el vie 16 oct/);
});

test("un menor: el mensaje habla de su inscripción", () => {
  const t = mensajeConfirmacionInscripcion({ ...base(), esMenor: true }, gs);
  assert.match(t, /la inscripción de Ana Pérez/);
});

test("plan ilimitado y sin tolerancia", () => {
  assert.equal(textoClases({ clasesPlan: null, bono: 0, cicloDias: 30 }), "clases ilimitadas durante 30 días");
  assert.equal(textoAsistencia(0), "Las faltas no se reponen.");
});

test("cuota saldada y un solo curso", () => {
  const t = mensajeConfirmacionInscripcion(
    { ...base(), cursos: [base().cursos[0]], cobrado: 300000, saldo: 0, compromiso: null },
    gs
  );
  assert.match(t, /Curso:/);
  assert.match(t, /Cuota saldada\./);
});

test("el recibo dice monto, concepto y saldo", () => {
  const t = mensajeReciboPago(
    { alumno: "Ana Pérez", plan: "Plan Doble", fecha: "lun 5 oct", monto: 100000, medio: "Efectivo", saldo: 200000, compromiso: "vie 16 oct" },
    gs
  );
  assert.match(t, /Recibimos de Ana Pérez: Gs\. 100000 \(Efectivo\)/);
  assert.match(t, /Saldo pendiente: Gs\. 200000 hasta el vie 16 oct/);
});
