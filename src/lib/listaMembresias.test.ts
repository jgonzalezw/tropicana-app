import { test } from "node:test";
import assert from "node:assert/strict";
import {
  banderas,
  busquedaMuyCorta,
  chipEstado,
  coincideMembresia,
  enOtrosEstados,
  filtrarMembresias,
  textoMenorFila,
  membresiaVisible,
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
    titularNombre: "Ana Zapata", alumnoId: 1, contactoId: 1, esMenor: false, tutor: null,
    planId: 5, planNombre: "Salsa Intermedio · 8 clases", estilo: "Salsa", cursos: ["Salsa Intermedio"],
    profesorNombre: null, profesoresCurso: ["Luis Peña"],
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
  fila({ id: 2, titular: persona("Beto", "Aguilar", "+59172222222"), tipo: "particular", planNombre: "Particular 4 h", profesorNombre: "Raquel Soto", profesoresCurso: [], cursos: [] }),
  fila({ id: 3, titular: persona("Carla", "Mendez"), estado: "completada", historica: true }),
  fila({ id: 4, titular: persona("Dani", "Lopez"), conDeuda: true, saldo: 80 }),
  fila({ id: 5, titular: persona("Eva", "Rojas"), porVencer: true }),
  fila({ id: 6, titular: persona("Fede", "Vaca"), solicitudes: true, tipo: "particular", titularNombre: "Fede Vaca", esMenor: true, tutor: { id: 90, nombre: "Marta Vaca", whatsapp: "+59173333333" } }),
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

// ── fase 1b: profesor, titulares que no son alumnos, visibilidad ────────

test("el buscador promete «profesor»: buscar por su nombre encuentra la fila", () => {
  const r = filtrarMembresias(filas, { estado: "todas", q: "raquel" });
  assert.deepEqual(r.map((m) => m.id), [2]);
});

test("el titular puede ser una organización, un profesor de la escuela o una persona sin rol", () => {
  const colegio = fila({
    id: 20, tipo: "alquiler", alumnoId: null, contactoId: 90, titularNombre: "Colegio San Andrés",
    titular: { tipo: "organizacion", nombre: null, apellido: null, razon_social: "Colegio San Andrés", whatsapp: "+59174444444" },
  });
  const profe = fila({ id: 21, tipo: "alquiler", alumnoId: null, contactoId: 91, titular: persona("Luis", "Peña", "+59175555555"), titularNombre: "Luis Peña" });
  const externo = fila({ id: 22, tipo: "alquiler", alumnoId: null, contactoId: 92, titular: persona("Marta", "Quiroga"), titularNombre: "Marta Quiroga" });
  const todas = [colegio, profe, externo];
  assert.deepEqual(filtrarMembresias(todas, { q: "san andrés" }).map((m) => m.id), [20]);
  assert.deepEqual(filtrarMembresias(todas, { q: "75555" }).map((m) => m.id), [21]);
  assert.deepEqual(filtrarMembresias(todas, { q: "quiroga" }).map((m) => m.id), [22]);
  // Orden por apellido: la razón social cuenta como apellido.
  assert.deepEqual(filtrarMembresias(todas, {}).map((m) => m.id), [20, 21, 22]);
});

test("visibilidad: un rol sin el permiso de un tipo no lo ve, y el alcance propio recorta las particulares", () => {
  const sinAlquileres = { tipos: new Set(["regular", "particular"] as const), profesorIdPropio: null };
  assert.equal(membresiaVisible(sinAlquileres, { tipo: "alquiler", profesorId: null }), false);
  assert.equal(membresiaVisible(sinAlquileres, { tipo: "regular", profesorId: null }), true);
  const propio = { tipos: new Set(["particular"] as const), profesorIdPropio: 7 };
  assert.equal(membresiaVisible(propio, { tipo: "particular", profesorId: 7 }), true);
  assert.equal(membresiaVisible(propio, { tipo: "particular", profesorId: 8 }), false);
  assert.equal(membresiaVisible(propio, { tipo: "particular", profesorId: null }), false);
});

test("visibilidad: con alumnos en alcance propio, una regular o prueba solo si alguno de sus cursos es del profesor", () => {
  const profesor = { tipos: new Set(["regular", "prueba", "particular"] as const), profesorIdPropio: 7, cursosPropios: new Set([3, 4]) };
  assert.equal(membresiaVisible(profesor, { tipo: "regular", profesorId: null, cursoIds: [3] }), true);
  assert.equal(membresiaVisible(profesor, { tipo: "regular", profesorId: null, cursoIds: [9, 4] }), true);
  assert.equal(membresiaVisible(profesor, { tipo: "regular", profesorId: null, cursoIds: [9] }), false);
  assert.equal(membresiaVisible(profesor, { tipo: "prueba", profesorId: null, cursoIds: [] }), false);
  assert.equal(membresiaVisible(profesor, { tipo: "particular", profesorId: 7 }), true);
  // Con alcance todo (cursosPropios null) no se recorta nada.
  assert.equal(membresiaVisible({ ...profesor, cursosPropios: null }, { tipo: "regular", profesorId: null, cursoIds: [9] }), true);
});

// ── búsqueda: menores, tutores, WhatsApp, acentos (datos de dev: Bruna y Natalia) ──

const natalia = { id: 6, nombre: "Natalia Salek", whatsapp: "+59177311069" };
const bruna = fila({
  id: 30, titular: persona("Bruna", "Marquez"), titularNombre: "Bruna Marquez", esMenor: true, tutor: natalia,
  planNombre: "CR - TROPICOREOGRAFICO 8CL", estilo: "Tropicoreografico", cursos: ["Tropicoreografico"], profesoresCurso: ["Yubinca Rojas"],
});
const nataliaAlumna = fila({
  id: 31, titular: persona("Natalia", "Salek", "+59177311069"), titularNombre: "Natalia Salek", tipo: "particular",
  planNombre: "MA-10HS-FIX", estilo: "Salsa", cursos: [], profesorNombre: "Raquel Soto", profesoresCurso: [],
});
const familia = [bruna, nataliaAlumna, ...filas];
const idsDe = (q: string) => ids(filtrarMembresias(familia, { estado: "todas", q }));

test("buscar al tutor por nombre trae su membresía y la de su hijo menor", () => {
  assert.deepEqual(idsDe("Natalia Salek").sort(), [30, 31]);
  assert.deepEqual(idsDe("natalia").sort(), [30, 31]);
});

test("buscar al menor por nombre y apellido, con o sin acento", () => {
  assert.deepEqual(idsDe("Bruna"), [30]);
  assert.deepEqual(idsDe("Bruna Marquez"), [30]);
  assert.deepEqual(idsDe("Márquez"), [30]);
  assert.deepEqual(idsDe("MARQUEZ"), [30]);
});

test("el WhatsApp del titular y el del tutor, en cualquier formato y parcial", () => {
  for (const q of ["77311069", "+59177311069", "+591 773-11069", "591 77311069", "7731", "311069", "773 110"]) {
    assert.deepEqual(idsDe(q).sort(), [30, 31], q);
  }
  assert.deepEqual(idsDe("99999999"), []);
});

test("el plan, el curso, el estilo y el profesor (del curso o de la particular)", () => {
  assert.deepEqual(idsDe("tropicoreografico"), [30]);
  assert.deepEqual(idsDe("TROPICO"), [30]);
  assert.deepEqual(idsDe("yubinca"), [30]);
  assert.deepEqual(idsDe("ma-10hs"), [31]);
  assert.deepEqual(idsDe("raquel soto").sort((a, b) => a - b), [2, 31]);
});

test("un acento en lo guardado también se encuentra sin escribirlo", () => {
  const f = fila({ id: 40, titular: persona("José", "Pérez"), titularNombre: "José Pérez", cursos: ["Bachata Básico"] });
  assert.equal(coincideMembresia("jose perez", f), true);
  assert.equal(coincideMembresia("JOSÉ", f), true);
  assert.equal(coincideMembresia("basico", f), true);
});

test("el menor se muestra como en Alumnos e Inscripción: «Menor · tutor …»", () => {
  assert.equal(textoMenorFila(bruna), "Menor · tutor Natalia Salek");
  assert.equal(textoMenorFila(nataliaAlumna), null);
  assert.equal(textoMenorFila({ esMenor: true, tutor: null }), "Menor · sin tutor cargado");
});

test("menos de 2 caracteres se avisa; vacío no", () => {
  assert.equal(busquedaMuyCorta("a"), true);
  assert.equal(busquedaMuyCorta(" b "), true);
  assert.equal(busquedaMuyCorta(""), false);
  assert.equal(busquedaMuyCorta(undefined), false);
  assert.equal(busquedaMuyCorta("ab"), false);
});

// ── otros estados: «Hay 6 en Históricas · Ver» ──────────────────────────

test("un tipo sin filas activas dice cuántas hay en Históricas", () => {
  assert.deepEqual(filtrarMembresias(filas, { tipo: "prueba", estado: "activas" }), []);
  assert.deepEqual(enOtrosEstados(filas, { tipo: "prueba", estado: "activas" }), [{ estado: "historicas", cantidad: 1 }]);
});

test("con la búsqueda puesta, cuenta solo lo que coincide en el otro estado", () => {
  assert.deepEqual(enOtrosEstados(filas, { tipo: "todas", estado: "activas", q: "mendez" }), [{ estado: "historicas", cantidad: 1 }]);
  assert.deepEqual(enOtrosEstados(filas, { tipo: "todas", estado: "activas", q: "zapata" }), []);
  assert.deepEqual(enOtrosEstados(filas, { tipo: "todas", estado: "historicas", q: "zapata" }), [{ estado: "activas", cantidad: 1 }]);
});

test("en un estado de seguimiento (con deuda) sugiere Activas e Históricas con lo que haya", () => {
  const r = enOtrosEstados(filas, { tipo: "todas", estado: "con_deuda" });
  assert.deepEqual(r.map((x) => x.estado), ["activas", "historicas"]);
});

// ── conteo: por cada tipo × estado, lo que se ve es lo que hay ──────────

test("cada combinación de tipo × estado cuenta lo mismo que el recuento directo", () => {
  const tipos = ["todas", "regular", "prueba", "particular", "alquiler"] as const;
  const estados = ["activas", "por_vencer", "con_deuda", "solicitudes", "historicas", "todas"] as const;
  const directo = (t: string, e: string) =>
    familia.filter(
      (m) =>
        (t === "todas" || m.tipo === t) &&
        (e === "todas" ||
          (e === "activas" && !m.historica) ||
          (e === "historicas" && m.historica) ||
          (e === "por_vencer" && m.porVencer) ||
          (e === "con_deuda" && m.conDeuda) ||
          (e === "solicitudes" && m.solicitudes))
    ).length;
  for (const t of tipos) for (const e of estados) assert.equal(filtrarMembresias(familia, { tipo: t, estado: e }).length, directo(t, e), `${t} × ${e}`);
  // Volver a Todas + Activas, después de pasar por cualquier otra, da lo mismo.
  const inicial = filtrarMembresias(familia, {}).length;
  for (const t of tipos) for (const e of estados) filtrarMembresias(familia, { tipo: t, estado: e, q: "ab" });
  assert.equal(filtrarMembresias(familia, { tipo: "todas", estado: "activas", q: "" }).length, inicial);
});
