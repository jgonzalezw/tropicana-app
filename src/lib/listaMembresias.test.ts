import { test } from "node:test";
import assert from "node:assert/strict";
import {
  banderas,
  chipEstado,
  filtrarMembresias,
  siguienteCiclo,
  tipoDeMembresia,
  usoDelCiclo,
  type EntradaBanderas,
  type EntradaCiclo,
  type FilaMembresia,
} from "./listaMembresias.ts";

const AHORA = new Date("2026-10-08T12:00:00");

// ── tipo ────────────────────────────────────────────────────────────────

test("el tipo se deduce de las columnas, no del plan", () => {
  assert.equal(tipoDeMembresia({ esPrueba: false, cursoId: 3, categoriaAplicada: null }), "regular");
  assert.equal(tipoDeMembresia({ esPrueba: true, cursoId: 3, categoriaAplicada: null }), "prueba");
  assert.equal(tipoDeMembresia({ esPrueba: false, cursoId: null, categoriaAplicada: null }), "particular");
  assert.equal(tipoDeMembresia({ esPrueba: false, cursoId: null, categoriaAplicada: "tercero" }), "alquiler");
});

// ── renovada ────────────────────────────────────────────────────────────

const ciclo = (o: Partial<EntradaCiclo> & { id: number }): EntradaCiclo => ({
  esPrueba: false, cursoId: 3, categoriaAplicada: null, alumnoId: 1, contactoId: 10,
  planId: 5, anteriorId: null, fechaInicio: "2026-09-01", ...o,
});

test("una posterior del mismo alumno y plan la renueva", () => {
  const a = ciclo({ id: 1 });
  const b = ciclo({ id: 2, fechaInicio: "2026-10-01" });
  assert.equal(siguienteCiclo(a, [a, b]), 2);
  assert.equal(siguienteCiclo(b, [a, b]), null);
});

test("otro plan u otro alumno no es una renovación", () => {
  const a = ciclo({ id: 1 });
  assert.equal(siguienteCiclo(a, [a, ciclo({ id: 2, planId: 6, fechaInicio: "2026-10-01" })]), null);
  assert.equal(siguienteCiclo(a, [a, ciclo({ id: 3, alumnoId: 2, fechaInicio: "2026-10-01" })]), null);
});

test("el encadenado explícito manda, aunque cambie el plan", () => {
  const a = ciclo({ id: 1 });
  const b = ciclo({ id: 2, planId: 6, anteriorId: 1, fechaInicio: "2026-10-01" });
  assert.equal(siguienteCiclo(a, [a, b]), 2);
});

test("una prueba seguida de un regular es conversión, no renovación", () => {
  const p = ciclo({ id: 1, esPrueba: true });
  const r = ciclo({ id: 2, fechaInicio: "2026-10-01" });
  assert.equal(siguienteCiclo(p, [p, r]), null);
  assert.equal(siguienteCiclo(r, [p, r]), null);
});

test("una extensión agranda la misma membresía y no la renueva", () => {
  const a = ciclo({ id: 1 });
  assert.equal(siguienteCiclo(a, [a]), null);
});

test("un alquiler a una institución se encadena por su contacto", () => {
  const a = ciclo({ id: 1, alumnoId: null, contactoId: 77, cursoId: null, categoriaAplicada: "tercero" });
  const b = ciclo({ id: 2, alumnoId: null, contactoId: 77, cursoId: null, categoriaAplicada: "tercero", fechaInicio: "2026-10-01" });
  const c = ciclo({ id: 3, alumnoId: null, contactoId: 78, cursoId: null, categoriaAplicada: "tercero", fechaInicio: "2026-10-02" });
  assert.equal(siguienteCiclo(a, [a, b, c]), 2);
});

// ── uso del ciclo ───────────────────────────────────────────────────────

test("en clases toma el avance de Asistencia tal cual", () => {
  const avance = { hechas: 2, total: 8 };
  assert.deepEqual(usoDelCiclo({ tipo: "regular", avance, horas: null }), { hechas: 2, total: 8, unidad: "clases" });
  assert.deepEqual(usoDelCiclo({ tipo: "prueba", avance: { hechas: 0, total: 1 }, horas: null }), { hechas: 0, total: 1, unidad: "clases" });
});

test("un ilimitado no tiene total", () => {
  assert.equal(usoDelCiclo({ tipo: "regular", avance: { hechas: 5, total: null }, horas: null }).total, null);
});

test("una particular y un alquiler se miden en horas", () => {
  const horas = { contratadasMin: 240, consumidasMin: 60 };
  assert.deepEqual(usoDelCiclo({ tipo: "particular", avance: null, horas }), { hechas: 1, total: 4, unidad: "h" });
  assert.deepEqual(usoDelCiclo({ tipo: "alquiler", avance: null, horas }), { hechas: 1, total: 4, unidad: "h" });
});

// ── banderas y chip ─────────────────────────────────────────────────────

const base: EntradaBanderas = {
  tipo: "regular", estado: "activa", uso: { hechas: 3, total: 8, unidad: "clases" },
  renovada: false, saldo: 0, reservas: [],
};
const chip = (o: Partial<EntradaBanderas> = {}) => {
  const e = { ...base, ...o };
  return chipEstado({ estado: e.estado, renovada: e.renovada, ...banderas(e, AHORA) }).clave;
};

test("completada es histórica; baja también; activa no", () => {
  assert.equal(banderas({ ...base, estado: "completada" }, AHORA).historica, true);
  assert.equal(banderas({ ...base, estado: "baja" }, AHORA).historica, true);
  assert.equal(banderas(base, AHORA).historica, false);
});

test("por vencer: regular activa con una clase o menos, y no renovada", () => {
  const una = { uso: { hechas: 7, total: 8, unidad: "clases" as const } };
  assert.equal(banderas({ ...base, ...una }, AHORA).porVencer, true);
  assert.equal(banderas({ ...base, uso: { hechas: 6, total: 8, unidad: "clases" } }, AHORA).porVencer, false);
  assert.equal(banderas({ ...base, ...una, renovada: true }, AHORA).porVencer, false);
  assert.equal(banderas({ ...base, ...una, tipo: "prueba" }, AHORA).porVencer, false);
  assert.equal(banderas({ ...base, uso: { hechas: 7, total: null, unidad: "clases" } }, AHORA).porVencer, false);
  // una preventa o clase suelta (ciclo de 1) no se renueva
  assert.equal(banderas({ ...base, uso: { hechas: 0, total: 1, unidad: "clases" } }, AHORA).porVencer, false);
  // agotada pero todavía activa (debe plata): sigue pidiendo renovación
  assert.equal(banderas({ ...base, uso: { hechas: 8, total: 8, unidad: "clases" } }, AHORA).porVencer, true);
});

test("una particular nunca está por vencer", () => {
  const e = { ...base, tipo: "particular" as const, uso: { hechas: 4, total: 4, unidad: "h" as const } };
  assert.equal(banderas(e, AHORA).porVencer, false);
});

test("con deuda: saldo mayor que cero", () => {
  assert.equal(banderas({ ...base, saldo: 50 }, AHORA).conDeuda, true);
  assert.equal(banderas(base, AHORA).conDeuda, false);
});

test("una solicitud vencida no cuenta", () => {
  const vigente = { estado: "solicitada", solicitadaHasta: "2026-10-09T10:00:00" };
  const vencida = { estado: "solicitada", solicitadaHasta: "2026-10-07T10:00:00" };
  const confirmada = { estado: "confirmada", solicitadaHasta: null };
  assert.equal(banderas({ ...base, reservas: [vigente] }, AHORA).solicitudes, true);
  assert.equal(banderas({ ...base, reservas: [vencida, confirmada] }, AHORA).solicitudes, false);
});

test("el chip sigue la precedencia: baja › renovada › solicitud › deuda › por vencer › activa", () => {
  const vigente = { estado: "solicitada", solicitadaHasta: "2026-10-09T10:00:00" };
  const porVencer = { uso: { hechas: 7, total: 8, unidad: "clases" as const } };
  assert.equal(chip({ estado: "baja", saldo: 10, renovada: true }), "baja");
  assert.equal(chip({ renovada: true, saldo: 10 }), "renovada");
  assert.equal(chip({ reservas: [vigente], saldo: 10 }), "solicitud");
  assert.equal(chip({ saldo: 10, ...porVencer }), "deuda");
  assert.equal(chip(porVencer), "por_vencer");
  assert.equal(chip({ estado: "completada" }), "completada");
  assert.equal(chip(), "activa");
});

// ── filtro y orden ──────────────────────────────────────────────────────

function fila(o: Partial<FilaMembresia> & { id: number }): FilaMembresia {
  const e: FilaMembresia = {
    tipo: "regular", estado: "activa",
    chip: { clave: "activa", texto: "Activa" },
    titular: { tipo: "persona", nombre: "Ana", apellido: "Zapata", razon_social: null, whatsapp: "+59171111111" },
    titularNombre: "Ana Zapata", alumnoId: 1, contactoId: 1, tutorWhatsapp: null,
    planId: 5, planNombre: "Salsa Intermedio · 8 clases", profesorNombre: "Luis Peña",
    fechaInicio: "2026-09-01", fechaFin: null, cicloNumero: 1, anteriorId: null, siguienteId: null,
    uso: { hechas: 3, total: 8, unidad: "clases" }, saldo: 0, solicitudesVigentes: 0,
    historica: false, porVencer: false, conDeuda: false, solicitudes: false,
    ...o,
  };
  return e;
}

const persona = (nombre: string, apellido: string, whatsapp: string | null = null) =>
  ({ tipo: "persona" as const, nombre, apellido, razon_social: null, whatsapp });

const filas: FilaMembresia[] = [
  fila({ id: 1, titular: persona("Ana", "Zapata", "+59171111111") }),
  fila({ id: 2, titular: persona("Beto", "Aguilar", "+59172222222"), tipo: "particular", planNombre: "Particular 4 h", profesorNombre: "Raquel Soto" }),
  fila({ id: 3, titular: persona("Carla", "Mendez"), estado: "completada", historica: true }),
  fila({ id: 4, titular: persona("Dani", "Lopez"), conDeuda: true, saldo: 80 }),
  fila({ id: 5, titular: persona("Eva", "Rojas"), porVencer: true }),
  fila({ id: 6, titular: persona("Fede", "Vaca"), solicitudes: true, tipo: "particular", titularNombre: "Fede Vaca", tutorWhatsapp: "+59173333333" }),
  fila({ id: 7, titular: { tipo: "organizacion", nombre: null, apellido: null, razon_social: "Colegio San Andrés", whatsapp: null }, tipo: "alquiler", titularNombre: "Colegio San Andrés", alumnoId: null }),
  fila({ id: 8, titular: persona("Gina", "Ibañez"), estado: "baja", historica: true, tipo: "prueba" }),
];
const ids = (r: FilaMembresia[]) => r.map((m) => m.id);

test("por defecto muestra las activas, ordenadas por apellido y la razón social como apellido", () => {
  assert.deepEqual(ids(filtrarMembresias(filas)), [2, 7, 4, 5, 6, 1]);
});

test("filtra por tipo", () => {
  assert.deepEqual(ids(filtrarMembresias(filas, { tipo: "particular" })), [2, 6]);
  assert.deepEqual(ids(filtrarMembresias(filas, { tipo: "alquiler" })), [7]);
  assert.deepEqual(ids(filtrarMembresias(filas, { tipo: "todas", estado: "todas" })).length, 8);
});

test("filtra por cada estado", () => {
  assert.deepEqual(ids(filtrarMembresias(filas, { estado: "historicas" })), [8, 3]);
  assert.deepEqual(ids(filtrarMembresias(filas, { estado: "con_deuda" })), [4]);
  assert.deepEqual(ids(filtrarMembresias(filas, { estado: "por_vencer" })), [5]);
  assert.deepEqual(ids(filtrarMembresias(filas, { estado: "solicitudes" })), [6]);
});

test("busca por apellido, WhatsApp, WhatsApp del tutor, plan y profesor", () => {
  assert.deepEqual(ids(filtrarMembresias(filas, { q: "aguilar" })), [2]);
  assert.deepEqual(ids(filtrarMembresias(filas, { q: "7111" })), [1]);
  assert.deepEqual(ids(filtrarMembresias(filas, { q: "73333" })), [6]);
  assert.deepEqual(ids(filtrarMembresias(filas, { q: "particular 4" })), [2]);
  assert.deepEqual(ids(filtrarMembresias(filas, { q: "raquel" })), [2]);
  assert.deepEqual(ids(filtrarMembresias(filas, { q: "colegio" })), [7]);
});

test("menos de 2 caracteres no filtra", () => {
  assert.equal(filtrarMembresias(filas, { q: "a" }).length, 6);
});

test("a igual titular, la más reciente primero", () => {
  const dos = [
    fila({ id: 10, fechaInicio: "2026-08-01" }),
    fila({ id: 11, fechaInicio: "2026-09-15" }),
  ];
  assert.deepEqual(ids(filtrarMembresias(dos)), [11, 10]);
});
