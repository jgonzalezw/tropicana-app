import { test } from "node:test";
import assert from "node:assert/strict";
import { proponerCategoria, type EntradaCategoria } from "./categoriaAlquiler.ts";

const base: EntradaCategoria = {
  hoy: "2026-10-10",
  diasGracia: 7,
  comoAlumno: [],
  esProfesor: false,
  asignaciones: [],
  particularesComoProfesor: [],
};

test("sin ningún vínculo, es tercero y dice por qué", () => {
  const r = proponerCategoria(base);
  assert.equal(r.categoria, "tercero");
  assert.match(r.motivo, /No es alumno ni profesor/);
});

test("una membresía activa lo hace alumno", () => {
  const r = proponerCategoria({ ...base, comoAlumno: [{ estado: "activa", fecha_fin: null }] });
  assert.equal(r.categoria, "alumno");
});

test("cerró una membresía dentro de los días de gracia: sigue siendo alumno", () => {
  const r = proponerCategoria({ ...base, comoAlumno: [{ estado: "completada", fecha_fin: "2026-10-03" }] });
  assert.equal(r.categoria, "alumno");
  assert.match(r.motivo, /7 días de gracia/);
});

test("cerró hace más que la gracia: ya no es alumno", () => {
  const r = proponerCategoria({ ...base, comoAlumno: [{ estado: "completada", fecha_fin: "2026-10-02" }] });
  assert.equal(r.categoria, "tercero");
});

test("el borde de la gracia cuenta: justo hace 7 días todavía es alumno", () => {
  const r = proponerCategoria({ ...base, comoAlumno: [{ estado: "completada", fecha_fin: "2026-10-03" }] });
  assert.equal(r.categoria, "alumno");
  const fuera = proponerCategoria({ ...base, comoAlumno: [{ estado: "completada", fecha_fin: "2026-10-02" }] });
  assert.equal(fuera.categoria, "tercero");
});

test("una baja no hace alumno, aunque su fecha sea reciente", () => {
  const r = proponerCategoria({ ...base, comoAlumno: [{ estado: "baja", fecha_fin: "2026-10-09" }] });
  assert.equal(r.categoria, "tercero");
});

test("alumno gana a profesor: es el primero del orden", () => {
  const r = proponerCategoria({
    ...base,
    comoAlumno: [{ estado: "activa", fecha_fin: null }],
    esProfesor: true,
    asignaciones: [{ hasta: null }],
  });
  assert.equal(r.categoria, "alumno");
});

test("profesor con un curso asignado vigente: profesor de Tropicana", () => {
  const r = proponerCategoria({ ...base, esProfesor: true, asignaciones: [{ hasta: null }] });
  assert.equal(r.categoria, "profesor_tropicana");
});

test("profesor con un plan de particulares activo: profesor de Tropicana", () => {
  const r = proponerCategoria({
    ...base,
    esProfesor: true,
    particularesComoProfesor: [{ estado: "activa", fecha_fin: null }],
  });
  assert.equal(r.categoria, "profesor_tropicana");
});

test("profesor cuyo curso cerró dentro de la gracia: sigue siendo de Tropicana", () => {
  const r = proponerCategoria({ ...base, esProfesor: true, asignaciones: [{ hasta: "2026-10-05" }] });
  assert.equal(r.categoria, "profesor_tropicana");
  assert.match(r.motivo, /Terminó hace poco/);
});

test("profesor sin nada vigente ni reciente: externo", () => {
  const r = proponerCategoria({ ...base, esProfesor: true, asignaciones: [{ hasta: "2026-08-01" }] });
  assert.equal(r.categoria, "profesor_externo");
});

test("gracia 0: solo cuenta lo que termina hoy o después", () => {
  const r = proponerCategoria({
    ...base,
    diasGracia: 0,
    comoAlumno: [{ estado: "completada", fecha_fin: "2026-10-09" }],
  });
  assert.equal(r.categoria, "tercero");
  const hoyMismo = proponerCategoria({
    ...base,
    diasGracia: 0,
    comoAlumno: [{ estado: "completada", fecha_fin: "2026-10-10" }],
  });
  assert.equal(hoyMismo.categoria, "alumno");
});
