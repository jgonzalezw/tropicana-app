import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularDevengosParticulares,
  situacionParticular,
  type DatosParticulares,
  type MembresiaParticular,
  type ReservaParticular,
} from "./particulares.ts";

const RANGO = { hastaISO: "2026-08-31", periodoVencido: "2026-08-01", hoyISO: "2026-09-10" };

function mem(o: Partial<MembresiaParticular> = {}): MembresiaParticular {
  return {
    id: 1, profesor_id: 7, plan_id: 3, alumno: "Pérez, Ana", criterio_liquidacion: 1,
    forma_pago_profesor: "fee_hora", fee_hora_aplicado: 50, pago_pct_margen: null, pago_monto_fijo: null,
    pago_descuenta_sala: false, costo_sala_aplicado: null, horas_contratadas: 4, fecha_fin: "2026-12-31",
    es_cortesia: false, ...o,
  };
}
function res(n: number, estado = "realizada", extra: Partial<ReservaParticular> = {}): ReservaParticular[] {
  return Array.from({ length: n }, (_, i) => ({
    membresia_id: 1, fecha: `2026-08-${String(i + 1).padStart(2, "0")}`, estado, duracion_min: 60, es_cortesia: false, ...extra,
  }));
}
function datos(m: MembresiaParticular, reservas: ReservaParticular[], o: Partial<DatosParticulares> = {}): DatosParticulares {
  return { membresias: [m], reservas, cobrado: { 1: 400 }, saldo: { 1: 0 }, previas: [], modoVencida: "proporcional", ...o };
}

test("fee_hora criterio 1: paga realizada+ausente, no reagendar ni suspendida", () => {
  const r = [...res(2), ...res(1, "ausente", { fecha: "2026-08-10" }), ...res(1, "reagendar", { fecha: "2026-08-11" }), ...res(1, "suspendida", { fecha: "2026-08-12" })];
  const { pendientes } = calcularDevengosParticulares(datos(mem({ horas_contratadas: 3 }), r), RANGO);
  assert.equal(pendientes.length, 1);
  assert.equal(pendientes[0].monto, 150);
  assert.equal(pendientes[0].tipo, "comision");
});

test("no liquida si no está cobrada al 100% (regla 1)", () => {
  const { pendientes } = calcularDevengosParticulares(datos(mem(), res(4), { saldo: { 1: 10 } }), RANGO);
  assert.equal(pendientes.length, 0);
});

test("criterio 1 espera al cierre del período; criterio 3 paga al completarse", () => {
  const r = res(4).map((x) => ({ ...x, fecha: x.fecha.replace("-08-", "-09-") }));
  const c1 = calcularDevengosParticulares(datos(mem(), r), RANGO);
  assert.equal(c1.pendientes.length, 0);
  const c3 = calcularDevengosParticulares(datos(mem({ criterio_liquidacion: 3 }), r), RANGO);
  assert.equal(c3.pendientes.length, 1);
  assert.equal(c3.pendientes[0].periodo, "2026-09-01");
});

test("pct_margen descuenta el costo de sala guardado; cobrado 0 da 0 sin error", () => {
  const m = mem({ forma_pago_profesor: "pct_margen", pago_pct_margen: 50, pago_descuenta_sala: true, costo_sala_aplicado: 100, fee_hora_aplicado: null });
  const ok = calcularDevengosParticulares(datos(m, res(4)), RANGO);
  assert.equal(ok.pendientes[0].monto, 150); // 50% de (400-100)
  const cero = calcularDevengosParticulares(datos(m, res(4), { cobrado: { 1: 0 } }), RANGO);
  assert.equal(cero.pendientes[0].monto, 0);
});

test("pct_margen con descuento de sala y sin foto de costo: bloquea y lo dice", () => {
  const m = mem({ forma_pago_profesor: "pct_margen", pago_pct_margen: 50, pago_descuenta_sala: true, costo_sala_aplicado: null });
  const r = calcularDevengosParticulares(datos(m, res(4)), RANGO);
  assert.equal(r.pendientes.length, 0);
  assert.match(r.bloqueadas[0].motivo, /costo de sala/);
});

test("monto_fijo con fee/cobrado 0 paga igual (100% de descuento)", () => {
  const m = mem({ forma_pago_profesor: "monto_fijo", pago_monto_fijo: 200, fee_hora_aplicado: null });
  const r = calcularDevengosParticulares(datos(m, res(4), { cobrado: { 1: 0 } }), RANGO);
  assert.equal(r.pendientes[0].monto, 200);
});

test("vencida con horas sin usar: proporcional vs completo; fee_hora no cambia", () => {
  const vencida = { fecha_fin: "2026-08-20" };
  const prop = calcularDevengosParticulares(
    datos(mem({ ...vencida, forma_pago_profesor: "monto_fijo", pago_monto_fijo: 200, fee_hora_aplicado: null }), res(1)), RANGO);
  assert.equal(prop.pendientes[0].monto, 50); // 1 de 4 horas
  const comp = calcularDevengosParticulares(
    datos(mem({ ...vencida, forma_pago_profesor: "monto_fijo", pago_monto_fijo: 200, fee_hora_aplicado: null }), res(1), { modoVencida: "completo" }), RANGO);
  assert.equal(comp.pendientes[0].monto, 200);
  const fee = calcularDevengosParticulares(datos(mem(vencida), res(1), { modoVencida: "completo" }), RANGO);
  assert.equal(fee.pendientes[0].monto, 50); // solo la hora dada
});

test("cortesía: la membresía entera no devenga, y la reserva de cortesía no cuenta como dada", () => {
  assert.equal(calcularDevengosParticulares(datos(mem({ es_cortesia: true }), res(4)), RANGO).pendientes.length, 0);
  const r = [...res(3), ...res(1, "realizada", { fecha: "2026-08-20", es_cortesia: true })];
  const sit = situacionParticular(mem(), r, 0, RANGO.hoyISO);
  assert.equal(sit.horasDadas, 3);
  assert.equal(sit.completa, false);
});

test("criterio 2: paga el avance a la fecha y luego solo el delta, como 'avance'", () => {
  const m = mem({ criterio_liquidacion: 2 });
  const primera = calcularDevengosParticulares(datos(m, res(2)), RANGO);
  assert.equal(primera.pendientes[0].tipo, "avance");
  assert.equal(primera.pendientes[0].monto, 100);
  const previas = [{ id: 9, membresia_id: 1, monto: 100, tipo: "avance", periodo: "2026-07-01" }];
  const sinCambio = calcularDevengosParticulares(datos(m, res(2), { previas }), RANGO);
  assert.equal(sinCambio.pendientes.length, 0);
  // una reserva de un período ya liquidado se corrige: la diferencia entra ahora
  const corregida = calcularDevengosParticulares(datos(m, res(3), { previas }), RANGO);
  assert.equal(corregida.pendientes[0].monto, 50);
  assert.equal(corregida.pendientes[0].periodo, RANGO.periodoVencido);
});

test("criterio 2 no paga si no está cobrada al 100%", () => {
  const r = calcularDevengosParticulares(datos(mem({ criterio_liquidacion: 2 }), res(2), { saldo: { 1: 5 } }), RANGO);
  assert.equal(r.pendientes.length, 0);
});

test("recálculo de una comisión ya devengada sale como ajuste firmado al período original", () => {
  const previas = [{ id: 5, membresia_id: 1, monto: 150, tipo: "comision", periodo: "2026-07-01" }];
  const r = calcularDevengosParticulares(datos(mem(), res(4), { previas }), RANGO);
  assert.equal(r.pendientes[0].tipo, "ajuste");
  assert.equal(r.pendientes[0].monto, 50);
  assert.equal(r.pendientes[0].periodo, "2026-07-01");
  assert.equal(r.pendientes[0].ajustaComisionId, 5);
  const menos = calcularDevengosParticulares(datos(mem(), res(4), { previas: [{ ...previas[0], monto: 250 }] }), RANGO);
  assert.equal(menos.pendientes[0].monto, -50);
});

test("criterio de taller (4/5) en una particular: bloquea con motivo", () => {
  const r = calcularDevengosParticulares(datos(mem({ criterio_liquidacion: 4 }), res(4)), RANGO);
  assert.equal(r.bloqueadas.length, 1);
});
