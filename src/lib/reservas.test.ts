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
  reservasAfectadasPorExcepciones,
  reservasQueChocanCon,
  ESTADOS_RESERVA,
  ESTADOS_QUE_OCUPAN,
  ESTADOS_QUE_LIBERAN,
  type EstadoReserva,
} from "./reservas.ts";
import { impactoDeExcepcion, clasesAfectadasPorExcepciones } from "./sala.ts";
import type { CursoOcupa, ReservaSalaOcupa, BloqueOcupado, ExcepcionHorario, MembresiaCobertura } from "./sala.ts";

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

test("validarReservaSala: duración que no es múltiplo del mínimo", () => {
  const r = validarReservaSala({ ...BASE, duracionMin: 90, minimoMin: 60 });
  assert.equal(r.ok, false);
  assert.match((r as { motivo: string }).motivo, /múltiplo de 1 h/);
});

test("validarReservaSala: 2 h con mínimo de 1 h es válida (múltiplo del mínimo)", () => {
  assert.deepEqual(validarReservaSala({ ...BASE, duracionMin: 120, minimoMin: 60 }), { ok: true });
});

test("validarReservaSala: la hora de inicio tiene que caer en el intervalo", () => {
  const r = validarReservaSala({ ...BASE, hora: "19:15", incrementoMin: 30 });
  assert.equal(r.ok, false);
  assert.match((r as { motivo: string }).motivo, /intervalos de 30 minutos/);
  assert.deepEqual(validarReservaSala({ ...BASE, hora: "19:30", incrementoMin: 30 }), { ok: true });
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

// ── Cierres de sala sobre reservas (C3, hito H4) ────────────────────────────

const CIERRE: ExcepcionHorario = {
  fecha: "2026-12-24",
  hasta_fecha: "2026-12-26",
  cerrado: true,
  desde: null,
  hasta: null,
  motivo: "feriado",
  glosa: null,
};

const HORARIO_REDUCIDO: ExcepcionHorario = {
  fecha: "2026-12-31",
  hasta_fecha: "2026-12-31",
  cerrado: false,
  desde: "09:00",
  hasta: "14:00",
  motivo: "feriado",
  glosa: null,
};

test("impactoDeExcepcion: ninguna excepción cubre la fecha → no afecta", () => {
  const r = impactoDeExcepcion("2026-12-27", "19:00", 60, [CIERRE, HORARIO_REDUCIDO]);
  assert.deepEqual(r, { afectada: false, motivo: null });
});

test("impactoDeExcepcion: un cierre completo afecta cualquier hora de esos días", () => {
  const r = impactoDeExcepcion("2026-12-25", "19:00", 60, [CIERRE]);
  assert.deepEqual(r, { afectada: true, motivo: "cierre" });
});

test("impactoDeExcepcion: horario reducido que igual entra en la ventana nueva no afecta", () => {
  const r = impactoDeExcepcion("2026-12-31", "10:00", 60, [HORARIO_REDUCIDO]);
  assert.deepEqual(r, { afectada: false, motivo: null });
});

test("impactoDeExcepcion: horario reducido que deja la franja afuera sí afecta", () => {
  const r = impactoDeExcepcion("2026-12-31", "18:00", 60, [HORARIO_REDUCIDO]);
  assert.deepEqual(r, { afectada: true, motivo: "horario_reducido" });
});

const CURSO_VIERNES: CursoOcupa = {
  id: 1,
  nombre: "Salsa Inicial",
  dias_semana: [5], // viernes
  hora: "19:00",
  duracion_min: 60,
  sala_id: 10,
};

test("clasesAfectadasPorExcepciones: alumno activo dentro del cierre queda listado, motivo cierre", () => {
  const membresias: MembresiaCobertura[] = [
    { alumno_id: 1, curso_id: 1, fecha_inicio: "2026-01-01", fecha_fin: null },
  ];
  const r = clasesAfectadasPorExcepciones(
    [CURSO_VIERNES],
    membresias,
    [CIERRE],
    "2026-12-24",
    "2026-12-26",
    new Set()
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].fecha, "2026-12-25"); // el único viernes del rango
  assert.equal(r[0].alumnosActivos, 1);
  assert.equal(r[0].motivoImpacto, "cierre");
});

test("clasesAfectadasPorExcepciones: sin membresía activa no hay nada que confirmar (regla 18)", () => {
  const r = clasesAfectadasPorExcepciones([CURSO_VIERNES], [], [CIERRE], "2026-12-24", "2026-12-26", new Set());
  assert.deepEqual(r, []);
});

test("clasesAfectadasPorExcepciones: una clase ya suspendida no se repite", () => {
  const membresias: MembresiaCobertura[] = [
    { alumno_id: 1, curso_id: 1, fecha_inicio: "2026-01-01", fecha_fin: null },
  ];
  const yaSuspendidas = new Set(["1|2026-12-25"]);
  const r = clasesAfectadasPorExcepciones(
    [CURSO_VIERNES],
    membresias,
    [CIERRE],
    "2026-12-24",
    "2026-12-26",
    yaSuspendidas
  );
  assert.deepEqual(r, []);
});

test("clasesAfectadasPorExcepciones: horario reducido que deja la clase afuera también se lista", () => {
  const membresias: MembresiaCobertura[] = [
    { alumno_id: 1, curso_id: 1, fecha_inicio: "2026-01-01", fecha_fin: null },
  ];
  // El viernes 19:00-20:00 no entra en un horario reducido de ese día.
  const reducidoViernes: ExcepcionHorario = { ...HORARIO_REDUCIDO, fecha: "2027-01-01", hasta_fecha: "2027-01-01" };
  const cursoQueCaeElViernes: CursoOcupa = { ...CURSO_VIERNES, dias_semana: [5] };
  const r = clasesAfectadasPorExcepciones(
    [cursoQueCaeElViernes],
    membresias,
    [reducidoViernes],
    "2027-01-01",
    "2027-01-01",
    new Set()
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].motivoImpacto, "horario_reducido");
});

test("reservasAfectadasPorExcepciones: solo lista las que una excepción de verdad afecta", () => {
  const candidatas = [
    { reservaId: 1, fecha: "2026-12-25", hora: "19:00", duracionMin: 60, etiqueta: "Ana Pérez", detalle: null },
    { reservaId: 2, fecha: "2026-12-27", hora: "19:00", duracionMin: 60, etiqueta: "Beto Ruiz", detalle: null },
    { reservaId: 3, fecha: "2026-12-31", hora: "10:00", duracionMin: 60, etiqueta: "Cami Díaz", detalle: null },
  ];
  const r = reservasAfectadasPorExcepciones(candidatas, [CIERRE, HORARIO_REDUCIDO]);
  assert.deepEqual(
    r.map((x) => x.reservaId),
    [1]
  );
  assert.equal(r[0].motivoImpacto, "cierre");
});

test("reservasQueChocanCon: filtra por solapamiento, criterio de intervalo medio abierto", () => {
  const candidatas = [
    { reservaId: 1, hora: "18:00", duracionMin: 60 }, // 18-19, no choca con 19-20
    { reservaId: 2, hora: "19:30", duracionMin: 60 }, // 19:30-20:30, sí choca
  ];
  const r = reservasQueChocanCon(candidatas, "19:00", 60);
  assert.deepEqual(
    r.map((x) => x.reservaId),
    [2]
  );
});
