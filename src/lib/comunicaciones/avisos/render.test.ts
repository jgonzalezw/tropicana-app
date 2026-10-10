// R20 · E4b — el texto del aviso sale de la versión seleccionada; un fallo no deja un mensaje a medias.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderizarVersion } from "./render.ts";
import { construirCatalogo } from "../contenidos/catalogo.ts";
import { variablesReserva, type EntradaReserva } from "../predeterminados/reserva.ts";
import { mensajeReservaConfirmadaAlumno, mensajeReservaConfirmadaProfesor, horario } from "../legado/reserva.ts";

const entrada: EntradaReserva = {
  esAlquiler: false,
  planNombre: "Paquete 10 h",
  profesorNombre: "Mario Rojas",
  alumnoNombre: "Ana Pérez",
  contratadasMin: 600,
  disponibleMin: 450,
  fecha: "2026-10-02",
  hora: "15:00:00",
  duracionMin: 60,
  lugar: "Tropicana (Sala 1)",
};
const cat = Object.fromEntries(construirCatalogo().map((c) => [c.caso + "." + c.variante, c]));
const n09 = cat["N09.unica"];
const n10 = cat["N10.unica"];

test("N09 y N10 por la versión seleccionada = el texto del código actual", () => {
  const cuando = horario(entrada.fecha, entrada.hora, entrada.duracionMin);
  const ctx = {
    tuClase: "tu clase particular (Paquete 10 h) con Mario Rojas",
    planNombre: "Paquete 10 h",
    alumnoNombre: "Ana Pérez",
    paquete: "paquete",
    disponibleMin: 450,
    contratadasMin: 600,
  };
  const a = renderizarVersion(n09, variablesReserva(entrada));
  const p = renderizarVersion(n10, variablesReserva(entrada));
  assert.ok(a.ok && p.ok);
  assert.equal(a.ok && a.texto, mensajeReservaConfirmadaAlumno(ctx, cuando, "Tropicana (Sala 1)"));
  assert.equal(p.ok && p.texto, mensajeReservaConfirmadaProfesor(ctx, cuando, "Tropicana (Sala 1)"));
});

test("falta un dato indispensable: variable_faltante, sin texto", () => {
  const vars = variablesReserva(entrada);
  delete (vars as Record<string, string>)["reserva.lugar"];
  const r = renderizarVersion(n09, vars);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, "variable_faltante");
});

test("dato indispensable vacío: variable_faltante", () => {
  const r = renderizarVersion(n09, { ...variablesReserva(entrada), "reserva.lugar": "" });
  assert.equal(!r.ok && r.motivo, "variable_faltante");
});

test("marcador desconocido en la versión: contenido (único caso con respaldo posible)", () => {
  const r = renderizarVersion({ cuerpo: "Hola {{no.existe}}", esquema: n09.esquema }, variablesReserva(entrada));
  assert.equal(!r.ok && r.motivo, "contenido");
});
