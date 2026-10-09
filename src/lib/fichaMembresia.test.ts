import { test } from "node:test";
import assert from "node:assert/strict";
import { avisosDe, cuotaMasAntiguaConSaldo, esSustituto, fechaTexto, historialDe, indicadoresDe, iniciales, lineasDePagos, montoCorto, permisosReservasFicha } from "./fichaMembresia.ts";
import type { FichaMembresia } from "./membresiasLectura.ts";
import type { ReservaConHistorial } from "../app/(privado)/particulares/acciones.ts";

const AHORA = new Date("2026-10-08T12:00:00");

type Cuota = FichaMembresia["cuenta"]["cuotas"][number];
const cuota = (o: Partial<Cuota> & { id: number }): Cuota => ({
  periodo: "2026-10", vencimiento: null, fechaCompromiso: null, devengado: 100, descuentoAdelanto: 0,
  cobrado: 0, cubierto: 0, saldo: 0, estado: "pendiente", ...o,
});

function ficha(o: { fila?: Partial<FichaMembresia["fila"]>; cuenta?: Partial<FichaMembresia["cuenta"]>; resto?: Partial<FichaMembresia> } = {}): FichaMembresia {
  const fila = {
    id: 1, tipo: "regular", estado: "activa", chip: { clave: "activa", texto: "Activa" },
    titular: { tipo: "persona", nombre: "Ana", apellido: "Zapata", razon_social: null, whatsapp: null },
    titularNombre: "Ana Zapata", alumnoId: 1, contactoId: 1, esMenor: false, tutor: null, planId: 5,
    planNombre: "Salsa · 8 clases", estilo: null, cursos: [], profesorNombre: null, profesoresCurso: [], fechaInicio: "2026-09-01", fechaFin: "2026-10-27",
    cicloNumero: 1, anteriorId: null, siguienteId: null,
    uso: { hechas: 3, total: 8, unidad: "clases" }, saldo: 0, solicitudesVigentes: 0,
    historica: false, porVencer: false, conDeuda: false, solicitudes: false,
    ...o.fila,
  } as FichaMembresia["fila"];
  const cuenta = {
    id: 1, plan: "Salsa", curso: null, cursos: [], estado: "activa", fechaInicio: "2026-09-01",
    fechaFin: "2026-10-27", fechaFinEstimada: false, progreso: null, restantes: null, horas: null,
    estiloProfesor: null, reservas: null, faltasConLicencia: 0, faltasSinLicencia: 0, bonos: [], bono: 0,
    renovacionBonificada: null, cuotas: [], saldo: 0,
    ...o.cuenta,
  } as FichaMembresia["cuenta"];
  return {
    fila, cuenta, pagos: [], clases: [], profesoresCurso: [],
    titular: { contactoId: 1, rol: "alumno", esMenor: false, avisarA: null },
    alquiler: null, ciclo: { anteriorId: null, siguienteId: null }, extensiones: [],
    ...o.resto,
  };
}

const reserva = (o: Partial<ReservaConHistorial> & { id: number }): ReservaConHistorial => ({
  fecha: "2026-10-09", hora: "10:00", duracion_min: 60, estado: "confirmada", solicitada_hasta: null,
  sala_id: 1, salaNombre: "Sala 1", ocupaAhora: true, esCortesia: false, cortesiaMotivo: null,
  permiteCortesia: false, transicionesPermitidas: [], reagendadaA: null, historial: [], ...o,
});

// ── indicadores ─────────────────────────────────────────────────────────

test("regular: uso en clases, ciclo y saldo; «Cuotas pagadas» cuando no debe nada", () => {
  const [uso, ciclo, saldo] = indicadoresDe(ficha(), AHORA);
  assert.equal(uso.valor, "3 de 8 clases");
  assert.equal(uso.sub, "Quedan 5 clases");
  assert.equal(ciclo.valor, "Mar 27 oct");
  assert.equal(ciclo.sub, "Desde Mar 1 sep · vigencia de 56 días");
  assert.equal(saldo.sub, "Cuotas pagadas");
  assert.equal(saldo.tono, undefined);
});

test("regular: queda 1, agotada y bono al renovar", () => {
  assert.equal(indicadoresDe(ficha({ fila: { uso: { hechas: 7, total: 8, unidad: "clases" } } }), AHORA)[0].sub, "Queda 1 clase");
  assert.equal(indicadoresDe(ficha({ fila: { uso: { hechas: 8, total: 8, unidad: "clases" } } }), AHORA)[0].sub, "Agotada");
  assert.match(indicadoresDe(ficha({ cuenta: { bono: 2 } }), AHORA)[0].sub!, /\+2 de bono al renovar/);
});

test("horas: uso en horas y lo disponible para pedir", () => {
  const f = ficha({
    fila: { tipo: "particular", uso: { hechas: 1.5, total: 4, unidad: "h" } },
    cuenta: { horas: { contratadasMin: 240, consumidasMin: 90, disponibleMin: 120 } },
  });
  const [uso] = indicadoresDe(f, AHORA);
  assert.equal(uso.valor, "1.5 de 4 h");
  assert.equal(uso.sub, "Disponible para pedir 2 h");
});

test("el saldo mira la cuota más antigua con saldo y se pinta de peligro", () => {
  const cuotas = [
    cuota({ id: 2, vencimiento: "2026-11-10", saldo: 50 }),
    cuota({ id: 1, vencimiento: "2026-10-10", saldo: 30 }),
    cuota({ id: 3, saldo: 0 }),
  ];
  assert.equal(cuotaMasAntiguaConSaldo(cuotas)?.id, 1);
  const saldo = indicadoresDe(ficha({ cuenta: { cuotas, saldo: 80 } }), AHORA)[2];
  assert.equal(saldo.tono, "peligro");
  assert.equal(saldo.sub, "Vence Sáb 10 oct");
});

test("sin fecha de fin el ciclo dice que termina con la última clase; ningún texto trae un plazo escrito", () => {
  const ciclo = indicadoresDe(ficha({ cuenta: { fechaFin: null } }), AHORA)[1];
  assert.equal(ciclo.valor, "—");
  assert.match(ciclo.sub!, /termina con la última clase/);
  const todo = JSON.stringify(indicadoresDe(ficha(), AHORA));
  // La única duración es la vigencia que sale de las fechas del ciclo (1 sep → 27 oct), nunca un plazo escrito.
  assert.deepEqual(todo.match(/\b\d+ días\b/g), ["56 días"]);
});

test("fechaTexto no se corre de día por la zona horaria", () => {
  assert.equal(fechaTexto("2026-10-01", AHORA), "Jue 1 oct");
  assert.equal(fechaTexto(null), "—");
});

test("fechaTexto: sin año en el año actual, con año en otro", () => {
  assert.equal(fechaTexto("2026-12-27", AHORA), "Dom 27 dic");
  assert.equal(fechaTexto("2027-01-03", AHORA), "Dom 3 ene 2027");
});

test("montoCorto: sin ,00 vacío; con centavos los muestra", () => {
  assert.equal(montoCorto(250), "Bs. 250");
  assert.equal(montoCorto(250.5), "Bs. 250,50");
  assert.equal(montoCorto(0), "Bs. 0");
  assert.equal(montoCorto(1250), "Bs. 1.250");
});

test("iniciales: nombre y último apellido", () => {
  assert.equal(iniciales("Manuel Aguilar"), "MA");
  assert.equal(iniciales("Luz Marina Araujo"), "LA");
  assert.equal(iniciales("Colegio"), "C");
  assert.equal(iniciales("  "), "?");
});

// ── avisos ──────────────────────────────────────────────────────────────

test("sin nada pendiente no hay avisos", () => {
  assert.deepEqual(avisosDe(ficha(), null, AHORA), []);
});

test("queda 1 clase, saldo con vencimiento", () => {
  const f = ficha({
    fila: { porVencer: true, uso: { hechas: 7, total: 8, unidad: "clases" } },
    cuenta: { saldo: 40, cuotas: [cuota({ id: 1, vencimiento: "2026-10-12", saldo: 40 })] },
  });
  const a = avisosDe(f, null, AHORA);
  assert.deepEqual(a.map((x) => x.clave), ["por-vencer", "saldo"]);
  assert.equal(a[0].titulo, "Queda 1 clase");
  assert.match(a[1].sub, /Vence Lun 12 oct/);
});

test("reserva solicitada vigente y reserva por cerrar; una solicitud vencida no avisa", () => {
  const reservas = [
    reserva({ id: 1, estado: "solicitada", solicitada_hasta: "2026-10-09T08:00:00" }),
    reserva({ id: 2, estado: "solicitada", solicitada_hasta: "2026-10-07T08:00:00" }),
    reserva({ id: 3, estado: "confirmada", fecha: "2026-10-08", hora: "09:00", duracion_min: 60 }),
    reserva({ id: 4, estado: "confirmada", fecha: "2026-10-08", hora: "11:30", duracion_min: 60 }),
    reserva({ id: 5, estado: "realizada", fecha: "2026-10-01" }),
  ];
  const f = ficha({ fila: { tipo: "particular" } });
  assert.deepEqual(avisosDe(f, reservas, AHORA).map((x) => x.clave), ["solicitada-1", "por-cerrar-3"]);
});

// ── historial ───────────────────────────────────────────────────────────

test("el historial junta venta, pagos, licencias, sustitutos y reservas, de lo más nuevo a lo más viejo", () => {
  const f = ficha({
    resto: {
      pagos: [{ id: 9, cuotaId: 1, fecha: "2026-09-02", monto: 100, descuento: 20, descuentoMotivo: "Anticipo", medio: "efectivo", concepto: null }],
      clases: [
        { sesionId: 1, fecha: "2026-09-10", cursoNombre: "Salsa", estadoSesion: "dictada", presente: false, conLicencia: true, profesorNombre: "Luis", sustituto: false },
        { sesionId: 2, fecha: "2026-09-17", cursoNombre: "Salsa", estadoSesion: "dictada", presente: true, conLicencia: false, profesorNombre: "Oscar Nuñez", sustituto: true },
        { sesionId: 3, fecha: "2026-09-24", cursoNombre: "Salsa", estadoSesion: "cancelada", presente: false, conLicencia: false, profesorNombre: null, sustituto: false },
      ],
    },
    fila: { siguienteId: 7 },
  });
  const h = historialDe(f, null, AHORA);
  assert.deepEqual(h.map((e) => e.etiqueta), ["Renovación", "Sustituto", "Licencia", "Pago", "Descuento", "Venta"]);
  assert.equal(h.find((e) => e.etiqueta === "Sustituto")?.sub, "Salsa · Oscar Nuñez");
});

test("el historial incluye lo que cambió en cada reserva", () => {
  const f = ficha({ fila: { tipo: "particular" } });
  const r = reserva({
    id: 4,
    historial: [{ estado_nuevo: "confirmada", fecha_nueva: "2026-10-09", hora_nueva: "10:00:00", motivo: null, glosa: "Pedida por WhatsApp", fuera_de_plazo: false, creado_en: "2026-10-05T10:00:00Z" }],
  });
  const h = historialDe(f, [r], AHORA);
  const ev = h.find((e) => e.etiqueta === "Reserva");
  assert.match(ev!.titulo, /Reserva Vie 9 oct 10:00: /);
  assert.equal(ev!.sub, "Pedida por WhatsApp");
});

// ── pestaña Pagos ───────────────────────────────────────────────────────

test("pagos: cuota, descuento, cobro con recibo y compromiso, en orden", () => {
  const f = ficha({
    cuenta: { cuotas: [cuota({ id: 1, periodo: "2026-10", devengado: 200, descuentoAdelanto: 20, saldo: 80, fechaCompromiso: "2026-10-20" })] },
    resto: { pagos: [{ id: 9, cuotaId: 1, fecha: "2026-09-05", monto: 100, descuento: 0, descuentoMotivo: null, medio: "qr", concepto: null }] },
  });
  const l = lineasDePagos(f);
  assert.deepEqual(l.map((x) => x.titulo), ["Cuota oct 2026", "Descuento por adelanto", "Pago", "Compromiso"]);
  assert.equal(l.find((x) => x.titulo === "Pago")?.pagoId, 9);
  assert.equal(l.filter((x) => x.pagoId != null).length, 1, "solo el cobro lleva recibo");
});

test("sustituto: dictó alguien que no es el titular del curso ese día", () => {
  assert.equal(esSustituto(7, 9, false), true);
  assert.equal(esSustituto(7, 7, false), false);
  assert.equal(esSustituto(7, 7, true), false); // un motivo anotado no hace sustituto a quien es el titular
});

test("sin titular asignado ese día, vale el motivo de reemplazo anotado", () => {
  assert.equal(esSustituto(null, 9, true), true);
  assert.equal(esSustituto(null, 9, false), false);
  assert.equal(esSustituto(7, null, true), true);
});

test("permisosReservasFicha: el alta se explica cuando no se puede", () => {
  const base = { estado: "activa", puedeCrear: true, puedeEditar: true, planPermiteExterna: true, hayExternaActiva: true };
  assert.deepEqual(permisosReservasFicha(base), { crear: true, editar: true, ofrecerExterna: true, motivo: null });
  // sin permiso de crear: no hay alta y dice por qué (aunque pueda editar)
  const sinCrear = permisosReservasFicha({ ...base, puedeCrear: false });
  assert.equal(sinCrear.crear, false);
  assert.equal(sinCrear.editar, true);
  assert.match(sinCrear.motivo ?? "", /permiso/);
  // membresía no activa: sin alta, con su motivo; las acciones sobre lo existente siguen según el permiso
  const baja = permisosReservasFicha({ ...base, estado: "baja" });
  assert.equal(baja.crear, false);
  assert.match(baja.motivo ?? "", /no está activa/);
  // solo ver: nada de acciones
  const soloVer = permisosReservasFicha({ ...base, puedeCrear: false, puedeEditar: false });
  assert.equal(soloVer.editar, false);
  // el lugar externo se ofrece si el plan lo permite Y hay una sala externa activa
  assert.equal(permisosReservasFicha({ ...base, planPermiteExterna: false }).ofrecerExterna, false);
  assert.equal(permisosReservasFicha({ ...base, hayExternaActiva: false }).ofrecerExterna, false);
});
