/**
 * **Un solo proceso de cálculo de liquidación** (calidad 10).
 *
 * Los dos motores (`calcularDevengos` para regulares y
 * `calcularDevengosParticulares`) son puros; lo que cambiaba de un flujo a otro
 * era cómo cada llamador los invocaba: con qué fecha, con qué `periodo`, con o
 * sin cierre, filtrando después por profesor o curso. Acá eso vive en un solo
 * lugar: el **modo** dice el objetivo del flujo y `liquidar` lo traduce a las
 * opciones de los motores. El flujo solo decide qué hace con el resultado.
 *
 * Modos:
 *  - `vencido`: la liquidación normal y la pre-liquidación del período vencido.
 *  - `simulacion`: el período en curso (D29); "hoy" es el fin del período para
 *    que lo que vence adentro cuente como vencido. Los datos ya vienen
 *    proyectados por quien llama (`simulacion.ts`).
 *  - `retiro`: el cierre de cuentas del profesor que se retira (D34, punto 4):
 *    avanza al corte como el criterio 2, sobre lo cobrado, regulares y
 *    particulares, sea cual sea el criterio de la venta.
 *  - `curso`: lo mismo para UN curso que se desasigna, o para todos los cursos
 *    regulares si `cursoId` es null (los particulares no son de un curso:
 *    quedan afuera).
 */

import { calcularDevengos, type DatosMotor, type DevengoPendiente, type MembresiaBloqueada } from "./motor.ts";
import {
  calcularDevengosParticulares,
  primerDiaMesDe,
  type DatosParticulares,
  type DevengoParticular,
  type ParticularBloqueada,
  type RangoParticulares,
} from "./particulares.ts";

export type ModoLiquidacion =
  | { tipo: "vencido"; hastaISO: string; periodoVencido: string; hoyISO: string }
  | { tipo: "simulacion"; hastaISO: string; periodoVencido: string }
  | { tipo: "retiro"; profesorId: number; corte: string; hoyISO: string }
  | { tipo: "curso"; profesorId: number; cursoId: number | null; corte: string };

/** Fecha "sin límite" con la que los cierres miden el avance (lo corta `cierre.corte`). */
export const SIN_LIMITE = "9999-12-31";

export type ParametrosMotores = {
  regular: { hastaISO: string; cierre?: { profesorId: number; corte: string } };
  /** `null`: este modo no liquida particulares. */
  particulares: RangoParticulares | null;
  /** Solo un curso (desasignar). */
  cursoId?: number;
};

/** Lo que cada modo le pide a los motores: el único lugar donde se arma. */
export function parametrosMotores(modo: ModoLiquidacion): ParametrosMotores {
  switch (modo.tipo) {
    case "vencido":
      return {
        regular: { hastaISO: modo.hastaISO },
        particulares: { hastaISO: modo.hastaISO, periodoVencido: modo.periodoVencido, hoyISO: modo.hoyISO },
      };
    case "simulacion":
      return {
        regular: { hastaISO: modo.hastaISO },
        // Simulado, "hoy" es el fin del período: lo que vence adentro cuenta como vencido.
        particulares: { hastaISO: modo.hastaISO, periodoVencido: modo.periodoVencido, hoyISO: modo.hastaISO },
      };
    case "retiro":
      return {
        regular: { hastaISO: SIN_LIMITE, cierre: { profesorId: modo.profesorId, corte: modo.corte } },
        particulares: {
          hastaISO: modo.corte,
          periodoVencido: primerDiaMesDe(modo.corte),
          hoyISO: modo.hoyISO,
          cierre: { profesorId: modo.profesorId, corte: modo.corte },
        },
      };
    case "curso":
      return {
        regular: { hastaISO: SIN_LIMITE, cierre: { profesorId: modo.profesorId, corte: modo.corte } },
        particulares: null,
        cursoId: modo.cursoId ?? undefined,
      };
  }
}

export type DatosLiquidacion = {
  regular: DatosMotor | null;
  particulares: DatosParticulares | null;
};

export type ResultadoLiquidacion = {
  regular: { pendientes: DevengoPendiente[]; bloqueadas: MembresiaBloqueada[] };
  particulares: { pendientes: DevengoParticular[]; bloqueadas: ParticularBloqueada[] };
};

export function liquidar(datos: DatosLiquidacion, modo: ModoLiquidacion): ResultadoLiquidacion {
  const p = parametrosMotores(modo);

  const reg = datos.regular ? calcularDevengos(datos.regular, p.regular.hastaISO, p.regular.cierre) : { pendientes: [], bloqueadas: [] };
  const regular =
    p.cursoId == null
      ? reg
      : {
          pendientes: reg.pendientes.filter((x) => x.cursoId === p.cursoId),
          bloqueadas: reg.bloqueadas.filter((b) => b.cursos.some((c) => c.cursoId === p.cursoId)),
        };

  const particulares =
    datos.particulares && p.particulares
      ? calcularDevengosParticulares(datos.particulares, p.particulares)
      : { pendientes: [], bloqueadas: [] };

  return { regular, particulares };
}
