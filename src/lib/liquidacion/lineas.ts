/**
 * La línea estándar de una liquidación (L-01 §5): lo que toda exposición de
 * liquidación —retiro, pre-liquidación, simulación, Liquidaciones, comprobante—
 * dice de cada membresía. Un solo tipo y un solo armado; el flujo elige qué
 * columnas mostrar, nunca el dato (calidad 10).
 *
 * Sin base de datos: recibe lo que calcularon los motores y el contexto leído
 * (`lecturaContexto.ts`).
 */
import type { DevengoPendiente } from "./motor.ts";
import type { DevengoParticular } from "./particulares.ts";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Lo que el alumno debe y pagó por una membresía (`cobroPorMembresia`). */
export type CuentaMembresia = { precio: number; descuento: number; pagado: number; saldo: number };

/**
 * Bono de tolerancia de una membresía (D35), sumado de todos sus cursos:
 * `aplicado` = el que recibió de la venta anterior; `generado` = el que dejó
 * para su renovación, con el vencimiento más próximo.
 */
export type BonoMembresia = { aplicado: number; generado: number; vence: string | null };

/**
 * Una membresía cuyo devengo ya está en una liquidación **sin pagar** del
 * profesor y que el cierre no vuelve a emitir (ya está entera). Se muestra en
 * la misma tabla, con «Este cierre —», porque compone el saldo previo.
 */
export type LineaPrevia = {
  membresiaId: number;
  /** null en particulares. */
  cursoId: number | null;
  tipo: "regular" | "particular";
  alumno: string;
  curso: string;
  base: number;
  monto: number;
  horasDadas?: number;
  horasContratadas?: number;
  forma?: string;
};

/** Lo ya devengado de una membresía (y curso, en regulares) y en qué liquidación quedó. */
export type PreviaCierre = {
  membresiaId: number;
  cursoId: number | null;
  monto: number;
  liquidacionId: number | null;
  /** Si viene, la línea de otro profesor no la cuenta. */
  profesorId?: number;
};

/** Todo lo que se lee de la base para decorar las líneas, por membresía. */
export type ContextoLineas = {
  cuentas: Record<number, CuentaMembresia>;
  bonos: Record<number, BonoMembresia>;
  /** Criterio de liquidación de la venta (foto), para la sigla. */
  criterios: Record<number, number | null>;
  ciclos: Record<number, { inicio: string | null; fin: string | null }>;
  previas: PreviaCierre[];
  yaLiquidadas: LineaPrevia[];
};

/** Lo que toda línea de liquidación dice de su membresía y de su cuenta. */
type LineaCuenta = {
  criterio: number | null;
  /** Ciclo de la membresía (inicio y fin), para ubicar la línea en el tiempo. */
  inicio: string | null;
  fin: string | null;
  cuenta: CuentaMembresia;
  /** Clases de bono de tolerancia que recibió al inscribirse. */
  bonoAplicado: number;
  /** Total que le toca a la fecha = ya liquidado + este monto. */
  aLaFecha: number;
  yaLiquidado: number;
  /** N° de las liquidaciones donde está lo ya liquidado. */
  liquidaciones: number[];
  /** Ya liquidada entera en una liquidación sin pagar: este monto no le suma nada. */
  soloLiquidado?: boolean;
};

export type LineaRegular = LineaCuenta & {
  membresiaId: number;
  alumno: string;
  curso: string;
  clases: number;
  clasesDelCurso: number;
  pct: number;
  base: number;
  /** Membresía de varios cursos: qué parte de la venta le tocó a este curso (regla 10). */
  reparto: { cursos: number; pct: number } | null;
  /** Lo que se devenga ahora. */
  monto: number;
};

export type LineaParticular = LineaCuenta & {
  membresiaId: number;
  alumno: string;
  horasDadas: number;
  horasContratadas: number;
  forma: string;
  cobrado: number;
  /** Lo que se devenga ahora. */
  monto: number;
};

const SIN_CUENTA: CuentaMembresia = { precio: 0, descuento: 0, pagado: 0, saldo: 0 };

/**
 * Las líneas estándar de una liquidación: una por (membresía, curso) en
 * regulares y una por membresía en particulares, más las ya liquidadas enteras
 * (`ctx.yaLiquidadas`). Ordenadas por alumno.
 */
export function armarLineas(
  regulares: DevengoPendiente[],
  particulares: DevengoParticular[],
  ctx: ContextoLineas
): { regulares: LineaRegular[]; particulares: LineaParticular[] } {
  const cuentaDe = (id: number) => ctx.cuentas[id] ?? SIN_CUENTA;
  /** Lo ya devengado de esa membresía (y curso, si es regular) y dónde quedó. */
  const previoDe = (membresiaId: number, cursoId: number | null, profesorId?: number) => {
    const filas = ctx.previas.filter(
      (x) =>
        x.membresiaId === membresiaId &&
        x.cursoId === cursoId &&
        (profesorId == null || x.profesorId == null || x.profesorId === profesorId)
    );
    return {
      monto: r2(filas.reduce((s, x) => s + x.monto, 0)),
      liquidaciones: [...new Set(filas.map((x) => x.liquidacionId).filter((x): x is number => x != null))].sort(
        (a, b) => a - b
      ),
    };
  };
  const comunDe = (membresiaId: number, criterioMotor: number | null) => ({
    criterio: ctx.criterios[membresiaId] ?? criterioMotor,
    inicio: ctx.ciclos[membresiaId]?.inicio ?? null,
    fin: ctx.ciclos[membresiaId]?.fin ?? null,
    cuenta: cuentaDe(membresiaId),
    bonoAplicado: ctx.bonos[membresiaId]?.aplicado ?? 0,
  });

  const reg: LineaRegular[] = regulares.map((p) => {
    const ya = previoDe(p.membresiaId, p.cursoId, p.profesorId);
    return {
      membresiaId: p.membresiaId,
      alumno: p.alumno,
      curso: p.curso,
      ...comunDe(p.membresiaId, p.criterio),
      clases: p.clases,
      clasesDelCurso: p.clasesDelCurso,
      pct: p.pct,
      base: p.base,
      reparto:
        p.reparto.length > 1
          ? { cursos: p.reparto.length, pct: Math.round((100 * p.base) / (p.cobradoTotal || 1)) }
          : null,
      yaLiquidado: ya.monto,
      liquidaciones: ya.liquidaciones,
      aLaFecha: r2(ya.monto + p.monto),
      monto: p.monto,
    };
  });
  const par: LineaParticular[] = particulares.map((p) => ({
    membresiaId: p.membresiaId,
    alumno: p.alumno,
    // El cierre mide como el criterio 2, pero la sigla es la de la venta.
    ...comunDe(p.membresiaId, p.criterio),
    horasDadas: p.detalle.horasDadas,
    horasContratadas: p.detalle.horasContratadas,
    forma: p.detalle.forma,
    cobrado: p.detalle.cobrado,
    yaLiquidado: p.detalle.yaDevengado,
    liquidaciones: previoDe(p.membresiaId, null, p.profesorId).liquidaciones,
    aLaFecha: p.detalle.objetivo,
    monto: p.monto,
  }));

  // Las ya liquidadas enteras en una liquidación sin pagar: misma tabla, «Este cierre —».
  for (const y of ctx.yaLiquidadas) {
    const ya = previoDe(y.membresiaId, y.cursoId);
    const comun = {
      membresiaId: y.membresiaId,
      alumno: y.alumno,
      ...comunDe(y.membresiaId, null),
      yaLiquidado: ya.monto,
      liquidaciones: ya.liquidaciones,
      aLaFecha: ya.monto,
      monto: 0,
      soloLiquidado: true,
    };
    if (y.tipo === "regular") {
      if (reg.some((l) => l.membresiaId === y.membresiaId && l.curso === y.curso)) continue;
      reg.push({
        ...comun, curso: y.curso, clases: 0, clasesDelCurso: 0,
        pct: y.base > 0 ? Math.round((y.monto / y.base) * 100) : 0, base: y.base,
        reparto: null,
      });
    } else {
      if (par.some((l) => l.membresiaId === y.membresiaId)) continue;
      par.push({
        ...comun, horasDadas: y.horasDadas ?? 0, horasContratadas: y.horasContratadas ?? 0,
        forma: y.forma ?? "", cobrado: comun.cuenta.pagado,
      });
    }
  }
  reg.sort((a, b) => a.alumno.localeCompare(b.alumno, "es") || a.curso.localeCompare(b.curso, "es"));
  par.sort((a, b) => a.alumno.localeCompare(b.alumno, "es"));
  return { regulares: reg, particulares: par };
}
