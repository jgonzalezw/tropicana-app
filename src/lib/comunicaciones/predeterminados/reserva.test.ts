// R20 · E2 — equivalencia de tres vías para los avisos de reserva (N07–N18):
//   referencia (código anterior a la extracción)
//   = función movida (legado/reserva.ts)
//   = plantilla predeterminada renderizada con el adaptador.
// Igualdad estricta, sin normalizar nada. Incluye los casos en que un aviso NO
// corresponde (sin contexto, sin destinatario, sin profesor, estado que no avisa).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  horario,
  textosDeReserva,
  avisosDeReserva,
  avisaCambioDeEstado,
  mensajeReservaConfirmadaAlumno,
  mensajeReservaConfirmadaProfesor,
  mensajeReservaSolicitadaAlumno,
  mensajeReservaSolicitadaProfesor,
  mensajeReservaSuspendidaAlumno,
  mensajeReservaSuspendidaProfesor,
  mensajeReservaRestablecidaAlumno,
  mensajeReservaRestablecidaProfesor,
  mensajeReservaReprogramadaAlumno,
  mensajeReservaReprogramadaProfesor,
  mensajeCanceladaFueraDePlazoAlumno,
  mensajeCanceladaFueraDePlazoProfesor,
  mensajeCanceladaEnPlazoAlumno,
  mensajeCanceladaEnPlazoProfesor,
  type ContextoDeAviso,
} from "../legado/reserva.ts";
import { renderizar, validar } from "../plantillas.ts";
import { CASOS_RESERVA as CASOS, ESQUEMA_RESERVA, variablesReserva, type EntradaReserva } from "./reserva.ts";

const leer = (nombre: string) => JSON.parse(readFileSync(new URL(`../__referencias__/${nombre}`, import.meta.url), "utf8"));

const vocabulario = (usadas: readonly string[]) => ({
  variables: ESQUEMA_RESERVA.filter((v) => usadas.includes(v.nombre)).map((v) => ({ nombre: v.nombre, obligatoria: true, permiteVacia: v.permiteVacia })),
});
const plantilla = (clave: string, vars: Record<string, string>) =>
  renderizar(CASOS[clave].plantilla, vars, vocabulario(CASOS[clave].variables));

test("todas las plantillas son válidas frente a su esquema y usan solo variables declaradas", () => {
  const nombres = new Set(ESQUEMA_RESERVA.map((v) => v.nombre));
  for (const [id, c] of Object.entries(CASOS)) {
    assert.deepEqual(validar(c.plantilla, vocabulario(c.variables)), [], id);
    for (const v of c.variables) assert.ok(nombres.has(v), `${id}: ${v}`);
  }
});

type Ref = {
  entrada: EntradaReserva & {
    caso?: string;
    sinContexto?: boolean;
    sinDestinatario?: boolean;
    destinatarioNombre?: string;
    destinatarioWhatsapp?: string | null;
    profesorWhatsapp?: string | null;
  };
  resultado: unknown;
};
const ida = (x: unknown) => JSON.parse(JSON.stringify(x));

function contexto(e: Ref["entrada"]): ContextoDeAviso | null {
  if (e.sinContexto) return null;
  return {
    ...textosDeReserva(e),
    contratadasMin: e.contratadasMin,
    disponibleMin: e.disponibleMin,
    destinatario: e.sinDestinatario ? null : { nombre: e.destinatarioNombre ?? "", whatsapp: e.destinatarioWhatsapp ?? null },
    profesor: { nombre: e.profesorNombre, whatsapp: e.profesorWhatsapp ?? null },
  };
}

// Por caso: [claves de plantilla alumno/profesor, función movida alumno/profesor].
type Par = {
  plantillas: [string, string];
  funciones: (c: ContextoDeAviso, e: Ref["entrada"], cuando: string, antes: string) => [string, string];
};
const PARES: Record<string, Par> = {
  solicitada: {
    plantillas: ["N07", "N08"],
    funciones: (c, e, cuando) => [mensajeReservaSolicitadaAlumno(c, cuando, e.lugar), mensajeReservaSolicitadaProfesor(c, cuando, e.lugar)],
  },
  suspendida_estado: {
    plantillas: ["N11", "N12"],
    funciones: (c, e, cuando) => [mensajeReservaSuspendidaAlumno(c, cuando, e.motivo ?? null), mensajeReservaSuspendidaProfesor(c, cuando, e.lugar, e.motivo ?? null)],
  },
  suspendida_operativa: {
    plantillas: ["N11", "N12"],
    funciones: (c, e, cuando) => [mensajeReservaSuspendidaAlumno(c, cuando, e.motivo ?? null), mensajeReservaSuspendidaProfesor(c, cuando, e.lugar, e.motivo ?? null)],
  },
  restablecida: {
    plantillas: ["N13", "N14"],
    funciones: (c, e, cuando) => [mensajeReservaRestablecidaAlumno(c, cuando, e.lugar), mensajeReservaRestablecidaProfesor(c, cuando, e.lugar)],
  },
  reprogramada: {
    plantillas: ["N15", "N16"],
    funciones: (c, e, cuando, antes) => [mensajeReservaReprogramadaAlumno(c, antes, cuando, e.lugar), mensajeReservaReprogramadaProfesor(c, antes, cuando, e.lugar)],
  },
  cancelada_fuera_plazo: {
    plantillas: ["N17.fuera_de_plazo", "N18.fuera_de_plazo"],
    funciones: (c, e, cuando) => [mensajeCanceladaFueraDePlazoAlumno(c, cuando, e.plazoHoras ?? 0), mensajeCanceladaFueraDePlazoProfesor(c, cuando, e.lugar)],
  },
  cancelada_en_plazo: {
    plantillas: ["N17.en_plazo", "N18.en_plazo"],
    funciones: (c, e, cuando) => [mensajeCanceladaEnPlazoAlumno(c, cuando), mensajeCanceladaEnPlazoProfesor(c, cuando, e.lugar)],
  },
};

const refs = leer("reservas.json") as Record<string, Ref | Record<string, boolean>>;
const variantes = Object.entries(refs).filter(([id]) => !id.startsWith("__")) as [string, Ref][];

test("hay variantes de los 7 casos, de particular y de alquiler, y de los casos en que no corresponde aviso", () => {
  assert.equal(new Set(variantes.map(([, r]) => r.entrada.caso)).size, 7);
  assert.ok(variantes.some(([id]) => id.includes(".alquiler.")));
  assert.ok(variantes.some(([id]) => id.endsWith(".sin_contexto")));
  assert.ok(variantes.some(([id]) => id.endsWith(".sin_destinatario")));
  assert.ok(variantes.some(([id]) => id.endsWith(".sin_nombre_profesor")));
});

for (const [id, ref] of variantes) {
  test(`${id}: referencia = función movida = plantilla`, () => {
    const e = ref.entrada;
    const par = PARES[e.caso as string];
    const c = contexto(e);
    const cuando = horario(e.fecha, e.hora, e.duracionMin);
    const antes = e.anterior ? horario(e.anterior.fecha, e.anterior.hora, e.anterior.duracionMin) : "";

    const [fa, fp] = c ? par.funciones(c, e, cuando, antes) : ["", ""];
    assert.deepStrictEqual(ida(avisosDeReserva(c, fa, fp)), ref.resultado, "función movida ≠ referencia");

    const vars = variablesReserva(e);
    const [pa, pp] = c
      ? [plantilla(par.plantillas[0], vars), e.esAlquiler || !e.profesorNombre ? "" : plantilla(par.plantillas[1], vars)]
      : ["", ""];
    assert.deepStrictEqual(ida(avisosDeReserva(c, pa, pp)), ref.resultado, "plantilla ≠ referencia");
  });
}

test("qué cambios de estado de una reserva avisan: igual que el código anterior", () => {
  const esperado = refs.__avisaPorEstado as Record<string, boolean>;
  assert.equal(Object.keys(esperado).length, 7);
  for (const [estado, avisa] of Object.entries(esperado)) assert.equal(avisaCambioDeEstado(estado), avisa, estado);
});

// N09/N10 (H2): se conservan sus 23 variantes.
const refsN09 = leer("N09-N10.json") as Record<string, { entrada: EntradaReserva; alumno: string; profesor: string | null }>;
for (const [id, ref] of Object.entries(refsN09)) {
  test(`N09/N10 ${id}: referencia = función movida = plantilla`, () => {
    const e = ref.entrada;
    const c = { ...textosDeReserva(e), contratadasMin: e.contratadasMin, disponibleMin: e.disponibleMin };
    const cuando = horario(e.fecha, e.hora, e.duracionMin);
    const vars = variablesReserva(e);
    assert.strictEqual(mensajeReservaConfirmadaAlumno(c, cuando, e.lugar), ref.alumno);
    assert.strictEqual(plantilla("N09", vars), ref.alumno);
    if (e.esAlquiler) return assert.strictEqual(ref.profesor, null);
    assert.strictEqual(mensajeReservaConfirmadaProfesor(c, cuando, e.lugar), ref.profesor);
    assert.strictEqual(plantilla("N10", vars), ref.profesor);
  });
}
