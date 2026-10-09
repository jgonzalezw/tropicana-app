import test from "node:test";
import assert from "node:assert/strict";
import {
  armarFranjas,
  bloqueLibre,
  clicEnFranja,
  entraElMinimo,
  fh,
  horasLibresTexto,
  lineaDeHorario,
  marcaDia,
  mismoRango,
  minimoEfectivo,
  rangoActual,
  type ReservaActual,
  seleccionValida,
  vistaFranjas,
  type Reglas,
} from "./franjasReserva.ts";
import { armarDatosFranjas, type BaseFranjas, type ReservaDeSemana, type SemanaFranjas } from "./ocupacionSemana.ts";
import { ventanasDelDia, type BloqueOcupado, type ExcepcionHorario, type FranjaPatron } from "./sala.ts";

const PATRON: FranjaPatron[] = [1, 2, 3, 4, 5].map((d) => ({ dia_semana: d, desde: "14:00", hasta: "22:00" }));
const LUNES = "2026-10-12";
const R: Reglas = { incrementoMin: 30, minimoMin: 60, disponibleMin: 150 };
const bloque = (hora: string, duracionMin: number, tipo: BloqueOcupado["tipo"], etiqueta: string): BloqueOcupado => ({ tipo, hora, duracionMin, etiqueta, detalle: null });
const base = (extra: Partial<Parameters<typeof armarFranjas>[0]> = {}) =>
  armarFranjas({ ventanas: ventanasDelDia(PATRON, [], LUNES).ventanas, ocupadosSala: [], ocupadosProfesor: [], incrementoMin: 30, pasadasAntesDeMin: null, ...extra });

test("las franjas son del tamaño del intervalo y solo dentro del horario", () => {
  const f = base();
  assert.equal(f.length, 16);
  assert.equal(f[0].hora, "14:00");
  assert.equal(f[15].hora, "21:30");
  const de60 = base({ incrementoMin: 60 });
  assert.equal(de60.length, 8);
  assert.deepEqual(de60.slice(0, 2).map((x) => x.hora), ["14:00", "15:00"]);
});

test("una excepción reemplaza al patrón y un día cerrado no tiene franjas", () => {
  const exc: ExcepcionHorario[] = [
    { fecha: LUNES, hasta_fecha: LUNES, cerrado: false, desde: "16:00", hasta: "20:00", motivo: "Evento", glosa: null },
    { fecha: "2026-10-13", hasta_fecha: "2026-10-13", cerrado: true, desde: null, hasta: null, motivo: "Feriado", glosa: null },
  ];
  const reducido = ventanasDelDia(PATRON, exc, LUNES);
  assert.equal(armarFranjas({ ventanas: reducido.ventanas, ocupadosSala: [], ocupadosProfesor: [], incrementoMin: 30, pasadasAntesDeMin: null }).length, 8);
  assert.equal(marcaDia({ ...reducido, fueraDeVigencia: false }), "Reducido");
  const cerrado = ventanasDelDia(PATRON, exc, "2026-10-13");
  assert.equal(armarFranjas({ ventanas: cerrado.ventanas, ocupadosSala: [], ocupadosProfesor: [], incrementoMin: 30, pasadasAntesDeMin: null }).length, 0);
  assert.equal(marcaDia({ ...cerrado, fueraDeVigencia: false }), "Cerrada");
  assert.equal(marcaDia({ ventanas: [], excepcion: null, fueraDeVigencia: true }), "Fuera vig.");
  assert.equal(marcaDia({ ...ventanasDelDia(PATRON, [], LUNES), fueraDeVigencia: false }), "");
});

test("una franja ocupada dice qué la ocupa: curso, reserva o bloqueo", () => {
  const f = base({
    ocupadosSala: [bloque("18:00", 90, "curso", "Salsa Intermedio"), bloque("16:00", 60, "particular", "Nadine"), bloque("20:00", 30, "bloqueo", "Mantenimiento")],
  });
  const v = vistaFranjas(f, R, null);
  const en = (h: string) => v.find((x) => x.hora === h)!;
  assert.equal(en("18:30").aspecto, "ocupada");
  assert.equal(en("18:30").derecha, "Curso");
  assert.equal(en("16:00").derecha, "Reserva");
  assert.equal(en("20:00").derecha, "Bloqueo");
  assert.equal(en("18:00").habilitada, false);
});

test("el profesor ocupado va aparte, y la sala ocupada le gana", () => {
  const f = base({
    ocupadosSala: [bloque("17:00", 30, "curso", "Curso X")],
    ocupadosProfesor: [bloque("17:00", 60, "curso", "Natalia da Salsa Inicial")],
  });
  const v = vistaFranjas(f, R, null);
  assert.equal(v.find((x) => x.hora === "17:00")!.aspecto, "ocupada");
  const p = v.find((x) => x.hora === "17:30")!;
  assert.equal(p.aspecto, "profesor");
  assert.equal(p.texto, "Natalia da Salsa Inicial");
  assert.equal(p.derecha, "Profesor");
});

test("las franjas que ya pasaron se ven deshabilitadas", () => {
  const f = base({ pasadasAntesDeMin: 17 * 60 + 10 });
  assert.equal(f.filter((x) => x.estado === "pasada").length, 7); // 14:00 … 17:00
  const v = vistaFranjas(f, R, null);
  assert.equal(v[0].habilitada, false);
  assert.equal(v[0].texto, "Pasada");
});

test("lo liberado (suspendida, Solicitada vencida) llega sin bloque y cuenta como libre", () => {
  // El servidor no arma el bloque de lo que libera; la grilla solo ve «sin bloque».
  const f = base({ ocupadosSala: [] });
  assert.ok(f.every((x) => x.estado === "libre"));
  assert.equal(horasLibresTexto(f, 30), "8 h libres");
});

test("el primer clic marca el inicio con el mínimo, no con un intervalo", () => {
  const f = base();
  const r = clicEnFranja(f, R, null, 15 * 60);
  assert.deepEqual(r.sel, { ini: 900, fin: 960 });
  assert.equal(r.aviso, null);
});

test("MIN = max(intervalo, mínimo)", () => {
  assert.equal(minimoEfectivo(30, 60), 60);
  assert.equal(minimoEfectivo(60, 30), 60);
  assert.equal(minimoEfectivo(30, 30), 30);
  const f = base({ incrementoMin: 60 });
  const r = clicEnFranja(f, { incrementoMin: 60, minimoMin: 30, disponibleMin: 240 }, null, 14 * 60);
  assert.deepEqual(r.sel, { ini: 840, fin: 900 });
});

test("después del mínimo se suma de a un intervalo y acortar no baja del mínimo", () => {
  const f = base();
  let s = clicEnFranja(f, R, null, 900).sel; // 15:00–16:00
  s = clicEnFranja(f, R, s, 960).sel; // 16:00 suma → 16:30
  assert.deepEqual(s, { ini: 900, fin: 990 });
  s = clicEnFranja(f, R, s, 990).sel; // 16:30 suma → 17:00
  assert.deepEqual(s, { ini: 900, fin: 1020 });
  s = clicEnFranja(f, R, s, 930).sel; // clic dentro: acorta, pero no baja de 1 h
  assert.deepEqual(s, { ini: 900, fin: 960 });
  assert.equal(clicEnFranja(f, R, s, 930).sel, null); // tocar el último bloque de lo elegido lo suelta
  assert.equal(clicEnFranja(f, R, s, 900).sel, null); // clic en el inicio deshace
});

test("un clic más lejos extiende si el tramo está libre; si no, empieza de nuevo", () => {
  const f = base({ ocupadosSala: [bloque("17:00", 30, "curso", "X")] });
  const ancho: Reglas = { ...R, disponibleMin: 300 };
  let s = clicEnFranja(f, ancho, null, 900).sel; // 15:00–16:00
  s = clicEnFranja(f, ancho, s, 990).sel; // 16:30 libre y todo el tramo libre → fin 17:00
  assert.deepEqual(s, { ini: 900, fin: 1020 });
  // 18:00 queda detrás de la ocupada: no atraviesa, empieza de nuevo ahí
  s = clicEnFranja(f, ancho, s, 1080).sel;
  assert.deepEqual(s, { ini: 1080, fin: 1140 });
});

test("el mínimo no entra por una ocupación, por el profesor, por el cierre ni por el saldo", () => {
  const f = base({ ocupadosSala: [bloque("15:30", 30, "curso", "X")], ocupadosProfesor: [bloque("19:00", 30, "curso", "Prof")] });
  const en = (reglas: Reglas, h: string) => vistaFranjas(f, reglas, null).find((x) => x.hora === h)!;
  // ocupación: 15:00–16:00 pisa a 15:30
  assert.equal(en(R, "15:00").texto, "No entra el mínimo de 1 h");
  assert.equal(en(R, "15:00").titulo, "Desde acá no hay 1 h libres seguidas");
  // 14:00–15:00 sí entra
  assert.equal(en(R, "14:00").aspecto, "libre");
  // profesor: 18:30–19:30 pisa a las 19:00
  assert.equal(en(R, "18:30").aspecto, "bloqueada");
  // cierre: 21:30 + 1 h pasa de las 22:00
  assert.equal(en(R, "21:30").aspecto, "bloqueada");
  assert.equal(en(R, "21:00").aspecto, "libre");
  // saldo: con 30 min para pedir no entra un mínimo de 1 h en ningún lado
  const poco: Reglas = { ...R, disponibleMin: 30 };
  assert.equal(en(poco, "14:00").aspecto, "bloqueada");
  assert.equal(en(poco, "14:00").titulo, "Te quedan 0,5 h para pedir");
  assert.equal(entraElMinimo(f, poco, 14 * 60), false);
});

test("el tope es lo disponible para pedir", () => {
  const f = base();
  const r: Reglas = { incrementoMin: 30, minimoMin: 60, disponibleMin: 150 };
  let s = clicEnFranja(f, r, null, 900).sel; // 15:00–16:00
  for (const m of [960, 990, 1020, 1050]) s = clicEnFranja(f, r, s, m).sel; // suma hasta 17:30 (150 min); el último clic ya no cabe
  assert.deepEqual(s, { ini: 900, fin: 1050 });
  const v = vistaFranjas(f, r, s);
  const sig = v.find((x) => x.inicio === 1050)!;
  assert.equal(sig.texto, "Supera lo disponible para pedir");
  assert.equal(sig.habilitada, false);
  assert.equal(clicEnFranja(f, r, s, 1050).aviso, "Te quedan 2,5 h para pedir");
  assert.equal(seleccionValida(f, r, s), true);
  assert.equal(seleccionValida(f, r, null), false);
  assert.equal(seleccionValida(f, { ...r, disponibleMin: 120 }, s), false);
});

test("la franja siguiente al rango invita a sumar, con el intervalo del parámetro", () => {
  const f = base();
  const s = clicEnFranja(f, R, null, 900).sel;
  assert.equal(vistaFranjas(f, R, s).find((x) => x.inicio === 960)!.texto, "+ sumar 30 min");
});

test("bloqueLibre exige franjas seguidas", () => {
  const f = base({ ocupadosSala: [bloque("15:00", 30, "curso", "X")] });
  assert.equal(bloqueLibre(f, 840, 900, 30), true);
  assert.equal(bloqueLibre(f, 840, 960, 30), false);
  assert.equal(bloqueLibre(f, 1290, 1350, 30), false); // se pasa del cierre
});

test("textos: horas libres, línea de horario y horas", () => {
  assert.equal(horasLibresTexto([], 30), "cerrada");
  const f = base({ ocupadosSala: [bloque("18:00", 90, "curso", "X")] });
  assert.equal(horasLibresTexto(f, 30), "6,5 h libres");
  assert.equal(
    lineaDeHorario({ ventanas: [{ desde: "14:00", hasta: "22:00" }], excepcionMotivo: null, incrementoMin: 30, minimoMin: 60 }),
    "Abierta 14:00–22:00 · mínimo 1 h, luego de a 30 min"
  );
  assert.equal(
    lineaDeHorario({ ventanas: [{ desde: "14:00", hasta: "20:00" }], excepcionMotivo: "Evento del edificio", incrementoMin: 30, minimoMin: 60 }),
    "Abierta 14:00–20:00 · Evento del edificio · mínimo 1 h, luego de a 30 min"
  );
  assert.equal(lineaDeHorario({ ventanas: [], excepcionMotivo: null, incrementoMin: 30, minimoMin: 60 }), "");
  assert.equal(fh(90), "1,5 h");
});

// ── Reprogramar ──────────────────────────────────────────────────────────

const ACTUAL: ReservaActual = { id: 7, fecha: LUNES, hora: "16:00", duracionMin: 90, salaId: 1, salaNombre: "Sala 1" };
const baseRep = (cursos: BaseFranjas["salas"][0]["cursos"] = []): BaseFranjas => ({
  incrementoMin: 30,
  minimoMin: 60,
  disponibleMin: 150, // el saldo ya con la duración de la reserva que se mueve
  fechaInicio: "2026-10-01",
  fechaFin: "2026-12-31",
  profesorId: 5,
  profesorNombre: "Ana",
  salas: [{ id: 1, nombre: "Sala 1", patron: PATRON, excepciones: [], cursos }],
  cursosProfesor: [],
  etiquetasBloqueo: {},
  etiquetasExcepcion: {},
});
const reservaDe = (r: Partial<ReservaDeSemana> & { id: number }): ReservaDeSemana => ({
  tipo: "particular",
  hora: "16:00",
  duracion_min: 90,
  motivo: null,
  glosa: null,
  estado: "confirmada",
  solicitada_hasta: null,
  sala_id: 1,
  profesor_id: 5,
  fecha: LUNES,
  ...r,
});
const semanaRep = (reservas: ReservaDeSemana[]): SemanaFranjas => ({ desde: LUNES, hasta: "2026-10-18", reservas, suspendidas: [] });
const armarRep = (b: BaseFranjas, s: SemanaFranjas, excluir?: number) => {
  const d = armarDatosFranjas(b, s, { salaId: 1, fecha: LUNES, semanaDesde: LUNES, ahora: new Date(`${LUNES}T08:00:00`), excluirReservaId: excluir });
  const sala = d.salas[0];
  const franjas = armarFranjas({
    ventanas: sala.ventanas,
    ocupadosSala: sala.ocupadosSala,
    ocupadosProfesor: d.ocupadosProfesor,
    incrementoMin: d.incrementoMin,
    pasadasAntesDeMin: null,
    actual: rangoActual(ACTUAL, 1, LUNES),
  });
  return { d, franjas, r: { incrementoMin: d.incrementoMin, minimoMin: d.minimoMin, disponibleMin: d.disponibleMin, propuestaMin: ACTUAL.duracionMin } satisfies Reglas };
};

test("reprogramar: correr 30 min no choca con la propia reserva, ni en la sala ni en el profesor", () => {
  const propia = reservaDe({ id: 7 });
  // Sin excluirla, 16:30 queda ocupada por ella misma (sala y profesor).
  const sin = armarRep(baseRep(), semanaRep([propia]));
  assert.equal(vistaFranjas(sin.franjas, sin.r, null).find((x) => x.hora === "16:30")!.aspecto, "ocupada");
  // Excluida: sus franjas son «actual» y se puede empezar a las 16:30.
  const con = armarRep(baseRep(), semanaRep([propia]), 7);
  assert.equal(con.d.salas[0].ocupadosSala.length, 0);
  assert.equal(con.d.ocupadosProfesor.length, 0);
  const v = vistaFranjas(con.franjas, con.r, null);
  assert.equal(v.find((x) => x.hora === "16:30")!.aspecto, "actual");
  assert.equal(v.find((x) => x.hora === "17:30")!.aspecto, "libre");
  assert.deepEqual(clicEnFranja(con.franjas, con.r, null, 990).sel, { ini: 990, fin: 990 + 90 });
  // Reserva en un lugar externo: no ocupa la sala pero sí al profesor; también se libera.
  const externa = reservaDe({ id: 7, sala_id: 99 });
  assert.equal(armarRep(baseRep(), semanaRep([externa])).d.ocupadosProfesor.length, 1);
  assert.equal(armarRep(baseRep(), semanaRep([externa]), 7).d.ocupadosProfesor.length, 0);
});

test("reprogramar: más corta y más larga, hasta lo que entra y lo disponible", () => {
  const f = base();
  // Más corta: el primer clic no puede bajar del mínimo; después se ajusta como al crear.
  const corta: Reglas = { ...R, disponibleMin: 150, propuestaMin: 60 };
  assert.deepEqual(clicEnFranja(f, corta, null, 900).sel, { ini: 900, fin: 960 });
  const mas = clicEnFranja(f, corta, { ini: 900, fin: 960 }, 960).sel;
  assert.deepEqual(mas, { ini: 900, fin: 990 });
  // Más larga: propone la actual, pero no más de lo disponible.
  const larga: Reglas = { ...R, disponibleMin: 120, propuestaMin: 180 };
  assert.deepEqual(clicEnFranja(f, larga, null, 900).sel, { ini: 900, fin: 1020 });
  // Y no más de lo libre seguido.
  const tope = base({ ocupadosSala: [bloque("15:00", 30, "curso", "X")] });
  assert.deepEqual(clicEnFranja(tope, { ...R, disponibleMin: 240, propuestaMin: 180 }, null, 840).sel, { ini: 840, fin: 900 });
});

test("reprogramar: un inicio donde entra el mínimo pero no la duración actual propone lo que entra", () => {
  const f = base({ ocupadosSala: [bloque("15:30", 30, "curso", "X")] });
  const r: Reglas = { ...R, disponibleMin: 240, propuestaMin: 120 };
  // Desde 14:00 entran 90 min (14:00–15:30), no los 120 actuales.
  assert.equal(entraElMinimo(f, r, 840), true);
  assert.deepEqual(clicEnFranja(f, r, null, 840).sel, { ini: 840, fin: 930 });
});

test("reprogramar: el mismo rango, sala y día no se puede mover", () => {
  const ini = 960;
  assert.equal(mismoRango({ ini, fin: ini + 90 }, ACTUAL, 1, LUNES), true);
  assert.equal(mismoRango({ ini, fin: ini + 60 }, ACTUAL, 1, LUNES), false);
  assert.equal(mismoRango({ ini: ini + 30, fin: ini + 120 }, ACTUAL, 1, LUNES), false);
  assert.equal(mismoRango({ ini, fin: ini + 90 }, ACTUAL, 2, LUNES), false);
  assert.equal(mismoRango({ ini, fin: ini + 90 }, ACTUAL, 1, "2026-10-13"), false);
  assert.equal(mismoRango(null, ACTUAL, 1, LUNES), false);
});

test("reprogramar: un alquiler sin plan (sin restricción de salas) arma la grilla igual", () => {
  // Sin plan las salas llegan todas (`salasPermitidasDelPlan` devuelve null): la grilla no depende del plan.
  const b = baseRep();
  b.salas.push({ id: 2, nombre: "Sala 2", patron: PATRON, excepciones: [], cursos: [] });
  const d = armarDatosFranjas(b, semanaRep([reservaDe({ id: 7 })]), { salaId: 2, fecha: LUNES, semanaDesde: LUNES, ahora: new Date(`${LUNES}T08:00:00`), excluirReservaId: 7 });
  assert.deepEqual(d.salas.map((x) => x.id), [1, 2]);
  assert.equal(d.salas[1].ocupadosSala.length, 0);
  assert.equal(rangoActual(ACTUAL, 2, LUNES), null);
});
