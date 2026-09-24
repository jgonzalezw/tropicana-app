import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nivelesDe,
  contextoAlumno,
  faltantes,
  celdaBloqueada,
  CELDAS_BLOQUEADAS,
  CAMPOS_SIN_ALMACENAMIENTO,
} from "./matrizMinimos.ts";
import { CAMPOS_MINIMO, CONTEXTOS_MINIMO } from "./tipos.ts";
import type { MatrizMinimo } from "./tipos.ts";

test("nivelesDe: lo que no está en la fila queda oculto por default", () => {
  const matriz: MatrizMinimo[] = [
    { contexto: "alumno_adulto", campo: "nombre", nivel: "O" },
    { contexto: "alumno_adulto", campo: "email", nivel: "V" },
  ];
  const niveles = nivelesDe(matriz, "alumno_adulto");
  assert.equal(niveles.nombre, "O");
  assert.equal(niveles.email, "V");
  assert.equal(niveles.documento, "-");
});

test("nivelesDe: no mezcla contextos", () => {
  const matriz: MatrizMinimo[] = [
    { contexto: "alumno_adulto", campo: "red_social", nivel: "O" },
    { contexto: "profesor", campo: "red_social", nivel: "-" },
  ];
  assert.equal(nivelesDe(matriz, "alumno_adulto").red_social, "O");
  assert.equal(nivelesDe(matriz, "profesor").red_social, "-");
});

test("contextoAlumno: menor manda, incluso en una prueba (Javier, 2026-09-24)", () => {
  assert.equal(contextoAlumno({ esMenor: true, enPrueba: true }), "alumno_menor");
  assert.equal(contextoAlumno({ esMenor: true, enPrueba: false }), "alumno_menor");
});

test("contextoAlumno: adulto, según de dónde se abrió el formulario", () => {
  assert.equal(contextoAlumno({ esMenor: false, enPrueba: true }), "prueba");
  assert.equal(contextoAlumno({ esMenor: false, enPrueba: false }), "alumno_adulto");
});

test("faltantes: solo cuenta los obligatorios sin completar", () => {
  const niveles = {
    nombre: "O",
    apellido: "V",
    razon_social: "-",
    whatsapp: "O",
    red_social: "O",
    es_menor: "O",
    tutor: "-",
    tipo_profesor: "-",
    canal_captacion: "V",
    interes: "-",
    consentimiento: "V",
    email: "-",
    documento: "-",
    facturacion: "-",
    nacimiento: "-",
    sexo: "-",
  } as const;
  const f = faltantes(niveles, { nombre: true, whatsapp: true, red_social: false, es_menor: true });
  assert.deepEqual(f, ["red_social"]);
});

test("faltantes: nada obligatorio → lista vacía aunque no haya nada presente", () => {
  const niveles = Object.fromEntries(CAMPOS_MINIMO.map((c) => [c, "-"])) as Record<
    (typeof CAMPOS_MINIMO)[number],
    "O" | "V" | "-"
  >;
  assert.deepEqual(faltantes(niveles, {}), []);
});

test("celdaBloqueada: nombre bloqueado en O para toda persona, en - para organización", () => {
  for (const c of CONTEXTOS_MINIMO) {
    if (c === "tercero_org") continue;
    assert.equal(celdaBloqueada(c, "nombre")?.nivel, "O", c);
  }
  assert.equal(celdaBloqueada("tercero_org", "nombre")?.nivel, "-");
  assert.equal(celdaBloqueada("tercero_org", "razon_social")?.nivel, "O");
});

test("celdaBloqueada: identidad de alumno/prueba bloqueada, el resto no", () => {
  assert.equal(celdaBloqueada("alumno_adulto", "whatsapp")?.nivel, "O");
  assert.equal(celdaBloqueada("prueba", "whatsapp")?.nivel, "O");
  assert.equal(celdaBloqueada("alumno_menor", "whatsapp")?.nivel, "-");
  assert.equal(celdaBloqueada("alumno_menor", "tutor")?.nivel, "O");
  assert.equal(celdaBloqueada("profesor", "tipo_profesor")?.nivel, "O");
  assert.equal(celdaBloqueada("alumno_adulto", "canal_captacion"), undefined);
  assert.equal(celdaBloqueada("prospecto", "whatsapp"), undefined);
});

test("CELDAS_BLOQUEADAS: sin pares (contexto, campo) repetidos", () => {
  const claves = CELDAS_BLOQUEADAS.map((c) => `${c.contexto}:${c.campo}`);
  assert.equal(new Set(claves).size, claves.length);
});

test("CAMPOS_SIN_ALMACENAMIENTO: interés y facturación, nada más", () => {
  assert.deepEqual([...CAMPOS_SIN_ALMACENAMIENTO].sort(), ["facturacion", "interes"]);
});
