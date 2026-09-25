import { test } from "node:test";
import assert from "node:assert/strict";
import { validarReservaSala, ocupacionDeProfesor } from "./reservas.ts";
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
