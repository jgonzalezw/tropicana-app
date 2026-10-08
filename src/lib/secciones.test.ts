import { test } from "node:test";
import assert from "node:assert/strict";
import { seccionesVisibles } from "./secciones.ts";

const NADA = { alumnos: false, particulares: false, alquileres: false };

test("interruptor apagado: Membresías no se ve, con cualquier permiso", () => {
  const todo = { alumnos: true, particulares: true, alquileres: true };
  assert.equal(seccionesVisibles(todo, { membresiasNuevas: false }).membresias, false);
});

test("interruptor prendido: se ve con cualquiera de los tres permisos", () => {
  for (const clave of ["alumnos", "particulares", "alquileres"] as const) {
    const permisos = { ...NADA, [clave]: true };
    assert.equal(
      seccionesVisibles(permisos, { membresiasNuevas: true }).membresias,
      true,
      clave
    );
  }
});

test("interruptor prendido sin ninguno de los tres permisos: no se ve", () => {
  assert.equal(seccionesVisibles(NADA, { membresiasNuevas: true }).membresias, false);
});
