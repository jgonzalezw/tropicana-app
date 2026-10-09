import test from "node:test";
import assert from "node:assert/strict";
import { armarDatosFranjas, contextoDelDia, rangoDeSemana, type BaseFranjas, type ReservaDeSemana, type SemanaFranjas } from "./ocupacionSemana.ts";
import { ocupacionDelDia, type CursoOcupa, type ExcepcionHorario } from "./sala.ts";
import { ocupacionDeProfesor } from "./reservas.ts";

const LUNES = "2026-10-12";
const MARTES = "2026-10-13";
const AHORA = new Date(`${LUNES}T10:00:00`);
const CURSO: CursoOcupa = { id: 10, nombre: "Salsa Inicial", dias_semana: [1], hora: "18:00", duracion_min: 90, sala_id: 1, vigente_desde: null, vigente_hasta: null };
const EXCEPCION: ExcepcionHorario = { fecha: LUNES, hasta_fecha: LUNES, cerrado: false, desde: "16:00", hasta: "20:00", motivo: "evento", glosa: null };

const base = (extra: Partial<BaseFranjas["salas"][0]> = {}): BaseFranjas => ({
  incrementoMin: 30,
  minimoMin: 60,
  disponibleMin: 300,
  fechaInicio: "2026-10-01",
  fechaFin: "2026-12-31",
  profesorId: 5,
  profesorNombre: "Ana",
  salas: [{ id: 1, nombre: "Sala 1", patron: [1, 2, 3, 4, 5].map((d) => ({ dia_semana: d, desde: "14:00", hasta: "22:00" })), excepciones: [], cursos: [CURSO], ...extra }],
  cursosProfesor: [],
  etiquetasBloqueo: {},
  etiquetasExcepcion: { evento: "Evento del edificio" },
});
const reserva = (r: Partial<ReservaDeSemana> & { id: number }): ReservaDeSemana => ({
  tipo: "particular",
  hora: "16:00",
  duracion_min: 60,
  motivo: null,
  glosa: null,
  estado: "confirmada",
  solicitada_hasta: null,
  sala_id: 1,
  profesor_id: 5,
  fecha: LUNES,
  ...r,
});
const semana = (extra: Partial<SemanaFranjas> = {}): SemanaFranjas => ({ desde: LUNES, hasta: "2026-10-18", reservas: [], suspendidas: [], ...extra });
const armar = (b: BaseFranjas, s: SemanaFranjas, fecha = LUNES, excluirReservaId?: number) =>
  armarDatosFranjas(b, s, { salaId: 1, fecha, semanaDesde: LUNES, ahora: AHORA, excluirReservaId });

test("día normal: la sala y el profesor salen igual que con la ocupación de siempre", () => {
  const r = reserva({ id: 1 });
  const d = armar(base(), semana({ reservas: [r, reserva({ id: 2, fecha: MARTES })] }));
  assert.deepEqual(d.salas[0].ocupadosSala, ocupacionDelDia([CURSO], [r], LUNES, new Set(), 1));
  assert.deepEqual(
    d.ocupadosProfesor.map((b) => b.hora),
    ocupacionDeProfesor([], LUNES, new Set(), [r]).map((b) => b.hora)
  );
  assert.ok(d.ocupadosProfesor[0].etiqueta.startsWith("Ana da "));
  assert.equal(d.disponibleMin, 300);
  assert.equal(d.dias.length, 7);
  assert.equal(d.proxima, null);
});

test("día con excepción de horario: ventanas reducidas, motivo con su etiqueta y marca «Reducido»", () => {
  const d = armar(base({ excepciones: [EXCEPCION] }), semana());
  assert.deepEqual(d.salas[0].ventanas, [{ desde: "16:00", hasta: "20:00" }]);
  assert.equal(d.excepcionMotivo, "Evento del edificio");
  assert.equal(d.dias[0].marca, "Reducido");
  assert.equal(d.dias[1].marca, "");
});

test("clase suspendida: no ocupa ese día, y la de otro día no cambia nada", () => {
  const con = armar(base(), semana());
  assert.ok(con.salas[0].ocupadosSala.some((b) => b.tipo === "curso"));
  const suspendida = armar(base(), semana({ suspendidas: [{ curso_id: 10, fecha: LUNES }] }));
  assert.equal(suspendida.salas[0].ocupadosSala.length, 0);
  const otroDia = armar(base(), semana({ suspendidas: [{ curso_id: 10, fecha: MARTES }] }));
  assert.equal(otroDia.salas[0].ocupadosSala.length, con.salas[0].ocupadosSala.length);
});

test("Solicitada vencida no ocupa; la vigente sí", () => {
  const vencida = reserva({ id: 1, estado: "solicitada", solicitada_hasta: "2026-10-12T08:00:00" });
  const vigente = reserva({ id: 2, estado: "solicitada", solicitada_hasta: "2026-10-13T08:00:00", hora: "15:00" });
  const d = armar(base({ cursos: [] }), semana({ reservas: [vencida, vigente] }));
  assert.deepEqual(d.salas[0].ocupadosSala.map((b) => b.hora), ["15:00"]);
  assert.deepEqual(d.ocupadosProfesor.map((b) => b.hora), ["15:00"]);
});

test("excluirReservaId saca la reserva de la sala y del profesor (reprogramar)", () => {
  const r = reserva({ id: 7 });
  const s = semana({ reservas: [r] });
  const ctx = contextoDelDia(base(), s, 1, LUNES, { conProfesor: true, excluirReservaId: 7 });
  assert.equal(ctx.reservasSala.length, 0);
  assert.equal(ctx.reservasProfesor.length, 0);
  assert.equal(contextoDelDia(base(), s, 1, LUNES, { conProfesor: true }).reservasProfesor.length, 1);
  assert.equal(armar(base({ cursos: [] }), s, LUNES, 7).ocupadosProfesor.length, 0);
});

test("el rango cubre la semana y también la fecha pedida si queda afuera", () => {
  assert.deepEqual(rangoDeSemana(LUNES, MARTES), { desde: LUNES, hasta: "2026-10-18" });
  assert.deepEqual(rangoDeSemana(LUNES, "2026-10-25"), { desde: LUNES, hasta: "2026-10-25" });
});
