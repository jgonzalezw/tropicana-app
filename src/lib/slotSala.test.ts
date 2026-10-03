import { test } from "node:test";
import assert from "node:assert/strict";
import {
  slotDeCurso,
  slotDeReserva,
  slotExterno,
  estadoDeCurso,
  resumirAgenda,
  filtrarSlots,
  accionPendiente,
  finDelSlot,
  esUrgente,
} from "./slotSala.ts";

const curso = (o: Partial<Parameters<typeof slotDeCurso>[0]> = {}) =>
  slotDeCurso({
    cursoId: 1,
    fecha: "2026-10-05",
    hora: "19:00",
    duracionMin: 60,
    cursoNombre: "Salsa",
    titularNombre: "Ana Pérez",
    suspendida: false,
    sesion: null,
    sustitutoNombre: null,
    gestionable: true,
    ...o,
  });
const reserva = (estado: string, o: Partial<Parameters<typeof slotDeReserva>[0]> = {}) =>
  slotDeReserva({
    reservaId: 9,
    tipo: "particular",
    fecha: "2026-10-05",
    hora: "10:00",
    duracionMin: 60,
    estado,
    titulo: "Salsa",
    titular: "Luis Gómez",
    profesor: "Ana Pérez",
    personas: 2,
    notas: null,
    detalle: null,
    membresiaId: 3,
    gestionable: true,
    ...o,
  });

test("estadoDeCurso: programada, suspendida, con relevo y asistencia tomada", () => {
  assert.equal(estadoDeCurso({ suspendida: false, sesion: null }).clave, "programada");
  assert.equal(estadoDeCurso({ suspendida: true, sesion: null }).etiqueta, "Suspendida · sala liberada");
  assert.equal(
    estadoDeCurso({ suspendida: false, sesion: { estado: "dictada", profesorId: 2, titularId: 1, conAsistencia: true } }).clave,
    "con_relevo"
  );
  assert.equal(
    estadoDeCurso({ suspendida: false, sesion: { estado: "dictada", profesorId: 1, titularId: 1, conAsistencia: true } }).clave,
    "tomada"
  );
});

test("estadoDeCurso: una sesión reabierta, sin marcas, vuelve a Programada (no 'Asistencia tomada')", () => {
  const e = estadoDeCurso({
    suspendida: false,
    sesion: { estado: "dictada", profesorId: 1, titularId: 1, conAsistencia: false },
  });
  assert.equal(e.clave, "programada");
  const relevoSinMarcas = estadoDeCurso({
    suspendida: false,
    sesion: { estado: "dictada", profesorId: 2, titularId: 1, conAsistencia: false },
  });
  assert.equal(relevoSinMarcas.clave, "programada");
});

test("slot: el estado es el de la reserva, y un curso suspendido sale atenuado", () => {
  assert.equal(reserva("solicitada").estado.etiqueta, "Solicitada");
  assert.equal(reserva("solicitada").estado.tono, "ambar");
  assert.equal(curso({ suspendida: true }).atenuado, true);
});

test("slot: admite un tipo nuevo (taller) anclado en un plan", () => {
  const s = reserva("confirmada", { tipo: "taller", membresiaId: null, planId: 12 });
  assert.equal(s.tipo, "taller");
  assert.equal(s.planId, 12);
  assert.equal(s.membresiaId, null);
});

test("slotExterno lleva el lugar como título", () => {
  const s = slotExterno({
    reservaId: 5,
    tipo: "alquiler",
    fecha: "2026-10-05",
    hora: "20:00:00",
    duracionMin: 120,
    estado: "confirmada",
    lugar: "Hotel Camino Real",
    titular: null,
    profesor: null,
    personas: null,
    membresiaId: 4,
    gestionable: false,
  });
  assert.equal(s.titulo, "Hotel Camino Real");
  assert.equal(s.hora, "20:00");
});

test("finDelSlot", () => {
  assert.equal(finDelSlot("19:30", 90), "21:00");
});

test("resumen: solicitudes (con urgentes) y clases por cerrar", () => {
  const ahora = new Date("2026-10-05T12:00:00");
  const slots = [
    reserva("solicitada", { reservaId: 1, hora: "15:00" }), // urgente (en 3 h)
    reserva("solicitada", { reservaId: 2, fecha: "2026-10-09" }), // no urgente
    curso({ hora: "08:00" }), // terminó 09:00 sin asistencia
    curso({ cursoId: 2, hora: "19:00" }), // futura
    curso({ cursoId: 3, hora: "08:00", sesion: { estado: "dictada", profesorId: 1, titularId: 1, conAsistencia: true } }), // tomada
    curso({ cursoId: 4, hora: "08:00", suspendida: true }), // suspendida: no cierra
    reserva("confirmada", { reservaId: 3, hora: "09:00" }), // pasó, sin cerrar
  ];
  assert.deepEqual(resumirAgenda(slots, ahora), { solicitudes: 2, urgentes: 1, porCerrar: 2 });
  assert.equal(esUrgente(slots[1], ahora), false);
  assert.equal(filtrarSlots(slots, "solicitudes", ahora).length, 2);
  assert.equal(filtrarSlots(slots, "por_cerrar", ahora).length, 2);
});

test("botón primario solo si hay algo pendiente y es gestionable", () => {
  const ahora = new Date("2026-10-05T12:00:00");
  assert.equal(accionPendiente(reserva("solicitada"), ahora), "Responder");
  assert.equal(accionPendiente(curso({ hora: "08:00" }), ahora), "Tomar asistencia");
  assert.equal(accionPendiente(reserva("confirmada", { hora: "18:00" }), ahora), null);
  assert.equal(accionPendiente(reserva("solicitada", { gestionable: false }), ahora), null);
});
