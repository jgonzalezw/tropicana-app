import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarReservaSala,
  ocupacionDeProfesor,
  puedeTransicionar,
  solicitudVigente,
  ocupaAhora,
  evaluarCancelacion,
  saldoMembresia,
  ESTADOS_RESERVA,
  ESTADOS_QUE_OCUPAN,
  ESTADOS_QUE_LIBERAN,
  type EstadoReserva,
} from "./reservas.ts";
import type { CursoOcupa, ReservaSalaOcupa, BloqueOcupado } from "./sala.ts";

const PATRON = [{ dia_semana: 5, desde: "09:00", hasta: "22:00" }]; // viernes
const SIN_EXCEPCIONES: [] = [];

const BASE = {
  fecha: "2026-10-02", // viernes
  hora: "19:00",
  duracionMin: 60,
  incrementoMin: 30,
  minimoMin: 30,
  sala: { esExterna: false, capacidad: null },
  patron: PATRON,
  excepciones: SIN_EXCEPCIONES,
  ocupadosSala: [] as BloqueOcupado[],
};

test("validarReservaSala: ok cuando no hay nada que choque", () => {
  assert.deepEqual(validarReservaSala(BASE), { ok: true });
});

test("validarReservaSala: duración que no es múltiplo del incremento", () => {
  const r = validarReservaSala({ ...BASE, duracionMin: 45 });
  assert.equal(r.ok, false);
  assert.match((r as { motivo: string }).motivo, /múltiplo de 30/);
});

test("validarReservaSala: duración menor al mínimo", () => {
  const r = validarReservaSala({ ...BASE, duracionMin: 30, minimoMin: 60, incrementoMin: 30 });
  assert.equal(r.ok, false);
});

test("validarReservaSala: fuera del horario de la sala", () => {
  const r = validarReservaSala({ ...BASE, hora: "23:00" });
  assert.equal(r.ok, false);
  assert.match((r as { motivo: string }).motivo, /abre/);
});

test("validarReservaSala: choca con otra reserva de la sala", () => {
  const ocupado: BloqueOcupado = { tipo: "particular", hora: "19:00", duracionMin: 60, etiqueta: "Clase particular", detalle: null };
  const r = validarReservaSala({ ...BASE, ocupadosSala: [ocupado] });
  assert.equal(r.ok, false);
  assert.match((r as { motivo: string }).motivo, /ya está ocupada/);
});

test("validarReservaSala: no choca si termina justo cuando empieza el otro (medio abierto)", () => {
  const ocupado: BloqueOcupado = { tipo: "curso", hora: "20:00", duracionMin: 60, etiqueta: "Bachata", detalle: null };
  const r = validarReservaSala({ ...BASE, hora: "19:00", duracionMin: 60, ocupadosSala: [ocupado] });
  assert.deepEqual(r, { ok: true });
});

test("validarReservaSala: capacidad insuficiente", () => {
  const r = validarReservaSala({ ...BASE, sala: { esExterna: false, capacidad: 2 }, personas: 3 });
  assert.equal(r.ok, false);
  assert.match((r as { motivo: string }).motivo, /capacidad para 2/);
});

test("validarReservaSala: sin capacidad cargada, no se valida (null = no se valida)", () => {
  const r = validarReservaSala({ ...BASE, sala: { esExterna: false, capacidad: null }, personas: 50 });
  assert.deepEqual(r, { ok: true });
});

test("validarReservaSala: sala externa saltea horario, capacidad y choque de sala", () => {
  const ocupado: BloqueOcupado = { tipo: "particular", hora: "19:00", duracionMin: 60, etiqueta: "x", detalle: null };
  const r = validarReservaSala({
    ...BASE,
    hora: "23:30", // fuera del patrón
    sala: { esExterna: true, capacidad: 1 },
    personas: 50,
    ocupadosSala: [ocupado],
    patron: [], // sin horario cargado -- ni eso importa
  });
  assert.deepEqual(r, { ok: true });
});

test("validarReservaSala: sala externa igual valida el choque del profesor", () => {
  const ocupadoProfesor: BloqueOcupado = { tipo: "curso", hora: "19:00", duracionMin: 60, etiqueta: "Salsa Inicial", detalle: null };
  const r = validarReservaSala({
    ...BASE,
    sala: { esExterna: true, capacidad: null },
    ocupadosProfesor: [ocupadoProfesor],
  });
  assert.equal(r.ok, false);
  assert.match((r as { motivo: string }).motivo, /profesor ya tiene algo agendado/);
});

test("validarReservaSala: profesor libre, aunque la sala esté ocupada por otra cosa no chocante", () => {
  const ocupadoProfesor: BloqueOcupado = { tipo: "curso", hora: "09:00", duracionMin: 60, etiqueta: "Zumba", detalle: null };
  const r = validarReservaSala({ ...BASE, ocupadosProfesor: [ocupadoProfesor] });
  assert.deepEqual(r, { ok: true });
});

test("ocupacionDeProfesor: junta sus cursos y sus reservas, ordenado por hora", () => {
  const cursos: CursoOcupa[] = [
    {
      id: 1,
      nombre: "Salsa Inicial",
      dias_semana: [5],
      hora: "20:00",
      duracion_min: 60,
      sala_id: 1,
      vigente_desde: "2026-01-01",
      vigente_hasta: null,
    },
  ];
  const reservas: ReservaSalaOcupa[] = [
    { id: 1, tipo: "particular", hora: "09:00", duracion_min: 30, motivo: null, glosa: null },
  ];
  const bloques = ocupacionDeProfesor(cursos, "2026-10-02", new Set(), reservas);
  assert.equal(bloques.length, 2);
  assert.equal(bloques[0].hora, "09:00");
  assert.equal(bloques[1].hora, "20:00");
});

test("ocupacionDeProfesor: un curso suspendido esa fecha no ocupa", () => {
  const cursos: CursoOcupa[] = [
    {
      id: 1,
      nombre: "Salsa Inicial",
      dias_semana: [5],
      hora: "20:00",
      duracion_min: 60,
      sala_id: 1,
      vigente_desde: "2026-01-01",
      vigente_hasta: null,
    },
  ];
  const bloques = ocupacionDeProfesor(cursos, "2026-10-02", new Set([1]), []);
  assert.equal(bloques.length, 0);
});

// ── Los 7 estados (C3, hito H3) ─────────────────────────────────────────

test("TRANSICIONES: cada transicion de la regla de negocio 23", () => {
  assert.equal(puedeTransicionar("solicitada", "confirmada"), true);
  assert.equal(puedeTransicionar("solicitada", "reagendar"), true);
  assert.equal(puedeTransicionar("solicitada", "suspendida"), true);
  assert.equal(puedeTransicionar("solicitada", "realizada"), false);
  assert.equal(puedeTransicionar("confirmada", "reprogramada"), true);
  assert.equal(puedeTransicionar("confirmada", "ausente"), true);
  assert.equal(puedeTransicionar("confirmada", "realizada"), true);
  assert.equal(puedeTransicionar("confirmada", "confirmada"), false);
});

test("TRANSICIONES: reagendar y suspendida son finales", () => {
  assert.equal(puedeTransicionar("reagendar", "confirmada"), false);
  assert.equal(puedeTransicionar("suspendida", "confirmada"), false);
  assert.deepEqual(TRANSICIONES_VACIAS("reagendar"), true);
  assert.deepEqual(TRANSICIONES_VACIAS("suspendida"), true);
});
function TRANSICIONES_VACIAS(e: EstadoReserva) {
  return ESTADOS_RESERVA.every((destino) => !puedeTransicionar(e, destino));
}

test("TRANSICIONES: ausente y realizada se corrigen entre si, nada mas", () => {
  assert.equal(puedeTransicionar("ausente", "realizada"), true);
  assert.equal(puedeTransicionar("realizada", "ausente"), true);
  assert.equal(puedeTransicionar("ausente", "confirmada"), false);
});

test("solicitudVigente: antes de vencer es vigente, despues no", () => {
  const hasta = "2026-10-02T12:00:00.000Z";
  assert.equal(solicitudVigente(hasta, new Date("2026-10-02T11:59:59.000Z")), true);
  assert.equal(solicitudVigente(hasta, new Date("2026-10-02T12:00:01.000Z")), false);
  assert.equal(solicitudVigente(null, new Date()), false);
});

test("ocupaAhora: bloqueo ocupa solo reservada", () => {
  assert.equal(ocupaAhora({ tipo: "bloqueo", estado: "reservada" }, new Date()), true);
  assert.equal(ocupaAhora({ tipo: "bloqueo", estado: "cancelada" }, new Date()), false);
});

test("ocupaAhora: particular ocupa en los 4 estados que consumen", () => {
  for (const estado of ESTADOS_QUE_OCUPAN)
    assert.equal(ocupaAhora({ tipo: "particular", estado }, new Date()), true, estado);
  assert.equal(ocupaAhora({ tipo: "particular", estado: "reagendar" }, new Date()), false);
  assert.equal(ocupaAhora({ tipo: "particular", estado: "suspendida" }, new Date()), false);
});

test("ocupaAhora: solicitada ocupa solo mientras vigente", () => {
  const ahora = new Date("2026-10-02T10:00:00.000Z");
  const vigente = { tipo: "particular" as const, estado: "solicitada", solicitadaHasta: "2026-10-02T11:00:00.000Z" };
  const vencida = { tipo: "particular" as const, estado: "solicitada", solicitadaHasta: "2026-10-02T09:00:00.000Z" };
  assert.equal(ocupaAhora(vigente, ahora), true);
  assert.equal(ocupaAhora(vencida, ahora), false);
});

test("ESTADOS_QUE_LIBERAN cubre cancelada (bloqueo) y reagendar/suspendida (los 7 estados)", () => {
  assert.deepEqual([...ESTADOS_QUE_LIBERAN].sort(), ["cancelada", "reagendar", "suspendida"]);
});

test("evaluarCancelacion: dentro del plazo pasa a reagendar", () => {
  const ahora = new Date("2026-10-02T10:00:00.000Z");
  const inicio = new Date("2026-10-02T20:00:00.000Z"); // 10 h de anticipacion
  const r = evaluarCancelacion(ahora, inicio, 8);
  assert.deepEqual(r, { destino: "reagendar", fueraDePlazo: false });
});

test("evaluarCancelacion: exactamente en el borde del plazo cuenta como dentro", () => {
  const ahora = new Date("2026-10-02T10:00:00.000Z");
  const inicio = new Date("2026-10-02T18:00:00.000Z"); // exactamente 8 h
  const r = evaluarCancelacion(ahora, inicio, 8);
  assert.equal(r.destino, "reagendar");
});

test("evaluarCancelacion: fuera de plazo pasa a ausente, con la marca", () => {
  const ahora = new Date("2026-10-02T10:00:00.000Z");
  const inicio = new Date("2026-10-02T15:00:00.000Z"); // 5 h de anticipacion
  const r = evaluarCancelacion(ahora, inicio, 8);
  assert.deepEqual(r, { destino: "ausente", fueraDePlazo: true });
});

test("saldoMembresia: consumidas cuenta los 4 estados que ocupan, no las Solicitadas", () => {
  const ahora = new Date("2026-10-02T10:00:00.000Z");
  const s = saldoMembresia({
    horasContratadas: 8,
    ahora,
    reservas: [
      { estado: "confirmada", duracion_min: 60 },
      { estado: "realizada", duracion_min: 60 },
      { estado: "ausente", duracion_min: 60 },
      { estado: "reagendar", duracion_min: 60 }, // liberada, no consume
      { estado: "suspendida", duracion_min: 60 }, // liberada, no consume
    ],
  });
  assert.equal(s.contratadasMin, 480);
  assert.equal(s.consumidasMin, 180);
  assert.equal(s.sinAgendarMin, 300);
});

test("saldoMembresia: las Solicitadas vigentes descuentan del disponible, no de lo consumido", () => {
  const ahora = new Date("2026-10-02T10:00:00.000Z");
  const s = saldoMembresia({
    horasContratadas: 2, // 120 min
    ahora,
    reservas: [
      { estado: "confirmada", duracion_min: 60 },
      { estado: "solicitada", duracion_min: 30, solicitada_hasta: "2026-10-02T12:00:00.000Z" }, // vigente
      { estado: "solicitada", duracion_min: 30, solicitada_hasta: "2026-10-01T00:00:00.000Z" }, // vencida
    ],
  });
  assert.equal(s.consumidasMin, 60);
  assert.equal(s.sinAgendarMin, 60);
  assert.equal(s.solicitadasVigentesMin, 30);
  assert.equal(s.disponibleMin, 30); // 60 sin agendar - 30 solicitada vigente
});

test("saldoMembresia: el disponible nunca es negativo, aunque se pase del paquete", () => {
  const ahora = new Date("2026-10-02T10:00:00.000Z");
  const s = saldoMembresia({
    horasContratadas: 1,
    ahora,
    reservas: [{ estado: "confirmada", duracion_min: 120 }],
  });
  assert.equal(s.sinAgendarMin, 0);
  assert.equal(s.disponibleMin, 0);
});
