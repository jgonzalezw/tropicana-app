/**
 * Control (calidad 10): `razonDeDescarte` (la pre-liquidación explica por qué una
 * membresía no entra) y el motor (que decide si entra) tienen que coincidir en
 * toda la matriz de criterio × estado × fin de ciclo × saldo. Si alguien toca un
 * filtro de un lado y no del otro, esta prueba lo dice.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularDevengos, type DatosMotor, type MembresiaLiq } from "./motor.ts";
import { razonDeDescarte } from "./preliquidacion.ts";
import type { Curso } from "../tipos.ts";

const LUNES = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"];
const curso: Curso = {
  id: 1, nombre: "Salsa", linea: null, estilo: null, nivel: null, dias_semana: [1], hora: "19:00",
  duracion_min: 60, sala_id: 1, precio_mensual: 400, activo: true, vigente_desde: null,
  vigente_hasta: null, creado_en: "2026-01-01", actualizado_en: "2026-01-01",
};

function datos(m: Partial<MembresiaLiq>, pagado: number): DatosMotor {
  return {
    membresias: [{
      id: 1, alumno_id: 1, curso_id: 1, plan_id: 1, es_prueba: false, acompanantes: null,
      fecha_inicio: "2026-08-03", fecha_fin: "2026-08-31", estado: "completada", criterio_liquidacion: 1, ...m,
    }],
    cursosDeMembresia: [{ membresia_id: 1, curso_id: 1, dias: [1], fecha: null }],
    comisionesPrevias: [],
    cuotas: [{ id: 1, membresia_id: 1, monto_devengado: 1000, descuento_adelanto: 0 }],
    pagos: [{ cuota_id: 1, monto: pagado, descuento: 0 }],
    sesiones: LUNES.map((f) => ({ curso_id: 1, fecha: f, estado: "dictada", reemplazo_motivo: null })),
    cursos: [curso],
    tarifas: [{ curso_id: 1, modalidad: "clase", precio: 50 }],
    asignaciones: [{ id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: null }],
    alumnos: [{ id: 1, nombre: "Ana", apellido: "Pérez" }],
    profesores: [{ id: 1, nombre: "P", apellido: "A" }],
  };
}

test("razonDeDescarte coincide con el motor en toda la matriz", () => {
  const hastaISO = "2026-08-31";
  for (const criterio of [1, 2, 3, null, 4])
    for (const estado of ["activa", "completada", "cancelada"])
      for (const fin of ["2026-08-31", "2026-09-15"])
        for (const pagado of [1000, 400]) {
          const d = datos({ criterio_liquidacion: criterio as never, estado, fecha_fin: fin }, pagado);
          const entra = calcularDevengos(d, hastaISO).pendientes.length > 0;
          const razon = razonDeDescarte(d.membresias[0], { hastaISO, saldo: 1000 - pagado, yaDevengada: false });
          // criterio null = «sin definir»: el motor lo trata como 1; la pre-liquidación lo marca.
          if (criterio == null) continue;
          assert.equal(
            razon === null,
            entra,
            `criterio ${criterio}, estado ${estado}, fin ${fin}, pagado ${pagado}: motor ${entra ? "entra" : "no entra"}, razón ${razon}`
          );
        }
});
