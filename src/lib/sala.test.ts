import { test } from "node:test";
import assert from "node:assert/strict";
import { costoSalaDeVenta, type TarifaSala, type TamanoSala } from "./sala.ts";

const PAREJA: TamanoSala = { clave: "pareja", etiqueta: "Pareja", max_personas: 2, orden: 2 };

const TARIFAS: TarifaSala[] = [
  { sala_id: null, categoria: "profesor_tropicana", tamano: "pareja", horas: 4, precio: 100 },
  { sala_id: 2, categoria: "profesor_tropicana", tamano: "pareja", horas: 4, precio: 150 },
  { sala_id: null, categoria: "profesor_tropicana", tamano: "pareja", horas: 8, precio: null },
];

const base = {
  descuentaSala: true,
  esExterna: false,
  categoria: "profesor_tropicana" as const,
  tamano: PAREJA,
  horas: 4,
  tarifas: TARIFAS,
};

test("costoSalaDeVenta: el plan no descuenta sala -> no_aplica", () => {
  const r = costoSalaDeVenta({ ...base, descuentaSala: false });
  assert.equal(r.estado, "no_aplica");
});

test("costoSalaDeVenta: sala externa -> ok con costo 0, aunque descuente sala", () => {
  const r = costoSalaDeVenta({ ...base, esExterna: true });
  assert.deepEqual(r, { estado: "ok", precio: 0, ruta: "Sala externa (sin costo de alquiler)" });
});

test("costoSalaDeVenta: matriz general da el precio y la ruta", () => {
  const r = costoSalaDeVenta(base);
  assert.equal(r.estado, "ok");
  if (r.estado === "ok") {
    assert.equal(r.precio, 100);
    assert.match(r.ruta ?? "", /Pareja.*4 h/);
  }
});

test("costoSalaDeVenta: tarifa propia de la sala gana a la general", () => {
  const r = costoSalaDeVenta({ ...base, salaId: 2 });
  assert.equal(r.estado, "ok");
  if (r.estado === "ok") assert.equal(r.precio, 150);
});

test("costoSalaDeVenta: paquete de horas faltante en la matriz -> falta, con motivo", () => {
  const r = costoSalaDeVenta({ ...base, horas: 2 });
  assert.equal(r.estado, "falta");
  if (r.estado === "falta") assert.match(r.motivo, /paquete de 2 h/);
});

test("costoSalaDeVenta: celda vacía (fila existe, precio null) -> falta, con motivo", () => {
  const r = costoSalaDeVenta({ ...base, horas: 8 });
  assert.equal(r.estado, "falta");
  if (r.estado === "falta") assert.match(r.motivo, /está vacía/);
});

test("costoSalaDeVenta: sin tamaño (nadie cubre la cantidad de personas) -> falta", () => {
  const r = costoSalaDeVenta({ ...base, tamano: null });
  assert.equal(r.estado, "falta");
});
