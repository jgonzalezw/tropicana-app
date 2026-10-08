/**
 * Retiro de un profesor (I-005, D34) — la vista simulada, sin base de datos.
 *
 * Junta, en una sola estructura que la pantalla pinta y el servidor vuelve a
 * calcular, tres cosas: (1) las **acciones** que se harían (cerrar cada
 * asignación, dejar o no un sustituto, inactivar), (2) la **composición de la
 * liquidación final** (regulares + particulares, los descuentos aparte, y el
 * saldo previo sin pagar) y (3) las **trabas** que impiden confirmar, cada una
 * con dónde se corrige. Nada de esto escribe: confirmar es otra acción.
 *
 * La validación es una sola (`validarRetiro`) y la comparten la pantalla y el
 * servidor (calidad 9).
 */
import { diaSiguiente, validarDesasignacion, type DatosSustituto } from "../desasignacion.ts";
import type { DevengoPendiente, MembresiaBloqueada } from "./motor.ts";
import type { DevengoParticular, ParticularBloqueada } from "./particulares.ts";
import type { DescuentoPre } from "./preliquidacion.ts";

const r2 = (n: number) => Math.round(n * 100) / 100;

export type AsignacionRetiro = {
  id: number;
  cursoId: number;
  curso: string;
  desde: string;
  hasta: string | null;
};

/** Lo que el alumno debe y pagó por una membresía (`cobroPorMembresia`). */
export type CuentaMembresia = { precio: number; descuento: number; pagado: number; saldo: number };

/**
 * Bono de tolerancia de una membresía (D35), sumado de todos sus cursos:
 * `aplicado` = el que recibió de la venta anterior; `generado` = el que dejó
 * para su renovación, con el vencimiento más próximo.
 */
export type BonoMembresia = { aplicado: number; generado: number; vence: string | null };

/** Lo ya devengado de una membresía (y curso, en regulares) y en qué liquidación quedó. */
/**
 * Una membresía cuyo devengo ya está en una liquidación **sin pagar** del
 * profesor y que el cierre no vuelve a emitir (ya está entera). Se muestra en
 * la misma tabla, con «Este cierre —», porque compone el saldo previo que se le
 * paga al retirarse (Javier, 2026-10-08).
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

/** De dónde sale el saldo previo: lo liquidado sin pagar, menos descuentos y pagos a cuenta. */
export type SaldoDesglose = { liquidado: number; descuentos: number; pagado: number; liquidaciones: number[] };

export type PreviaCierre = { membresiaId: number; cursoId: number | null; monto: number; liquidacionId: number | null };

/** Una membresía que queda sin terminar cuando el profesor se retira. */
export type MembresiaInconclusa = {
  membresiaId: number;
  alumno: string;
  tipo: "regular" | "particular";
  /** Los cursos (regular) o «Clase particular». */
  detalle: string;
  plan: string;
  inicio: string | null;
  fin: string | null;
  /** Lo dado hasta ahora y el total del plan (`null` = ilimitado), en `unidad`. */
  hechas: number;
  total: number | null;
  unidad: "clases" | "horas";
  estado: string;
  /** Criterio de liquidación de la venta (foto), para la sigla. */
  criterio: number | null;
};

/** La inconclusa como se muestra: con su cuenta y sus bonos. */
export type InconclusaVista = MembresiaInconclusa & {
  cuenta: CuentaMembresia;
  bonoAplicado: number;
  bonoGenerado: number;
  bonoVence: string | null;
};

export type EntradaRetiro = {
  profesorId: number;
  profesor: string;
  activo: boolean;
  /** Último día a cargo, inclusive (como en la desasignación). */
  corte: string;
  hoyISO: string;
  /** Asignaciones del profesor (el retiro cierra las abiertas). */
  asignaciones: AsignacionRetiro[];
  /** Sustituto elegido por asignación (ausente o null = el curso queda sin titular). */
  sustitutos: Record<number, DatosSustituto | null>;
  /** Resultado del motor con `cierre`, ya filtrado a este profesor. */
  regular: { pendientes: DevengoPendiente[]; bloqueadas: MembresiaBloqueada[] };
  particulares: { pendientes: DevengoParticular[]; bloqueadas: ParticularBloqueada[] };
  /** Reemplazos que se le descuentan (regla 20a), de este profesor. */
  descuentos: DescuentoPre[];
  /** Lo que ya se le debe de liquidaciones anteriores (Caja → Por pagar). */
  saldoPrevio: number;
  /** Clases que dictó después del corte, por curso: la fecha las deja afuera. */
  posteriores: { cursoId: number; curso: string; fechas: string[] }[];
  /** Reservas particulares futuras del profesor, que quedarían sin profesor. */
  reservasFuturas: { id: number; fecha: string; alumno: string }[];
  /** Membresías de sus cursos y particulares que quedan sin terminar (una por membresía). */
  inconclusas: MembresiaInconclusa[];
  /** Precio, descuento, pagado y saldo por membresía (de las líneas y de las inconclusas). */
  cuentas: Record<number, CuentaMembresia>;
  bonos: Record<number, BonoMembresia>;
  /** Criterio de liquidación de cada membresía de las líneas. */
  criterios: Record<number, number | null>;
  /** Inicio y fin del ciclo de cada membresía de las líneas. */
  ciclos: Record<number, { inicio: string | null; fin: string | null }>;
  /** Membresías ya liquidadas enteras en una liquidación sin pagar (componen el saldo previo). */
  yaLiquidadas: LineaPrevia[];
  saldoDesglose: SaldoDesglose;
  /** Lo ya devengado de las membresías de las líneas (de este profesor). */
  previas: PreviaCierre[];
};

export type Accion = { clave: string; texto: string };

/** Lo que toda línea de la liquidación final dice de su membresía y de su cuenta. */
type LineaCuenta = {
  criterio: number | null;
  /** Ciclo de la membresía (inicio y fin), para ubicar la línea en el tiempo. */
  inicio: string | null;
  fin: string | null;
  cuenta: CuentaMembresia;
  /** Clases de bono de tolerancia que recibió al inscribirse. */
  bonoAplicado: number;
  /** Total que le toca a la fecha de corte = ya liquidado + este cierre. */
  aLaFecha: number;
  yaLiquidado: number;
  /** N° de las liquidaciones donde está lo ya liquidado. */
  liquidaciones: number[];
  /** Ya liquidada entera en una liquidación sin pagar: este cierre no le suma nada. */
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
  /** Este cierre: lo que se devenga ahora. */
  monto: number;
};

export type LineaParticular = LineaCuenta & {
  membresiaId: number;
  alumno: string;
  horasDadas: number;
  horasContratadas: number;
  forma: string;
  cobrado: number;
  /** Este cierre: lo que se devenga ahora. */
  monto: number;
};

export type Traba = {
  clave: string;
  texto: string;
  /** A qué pantalla ir a corregirlo. */
  href?: string;
  accion?: string;
};

export type VistaRetiro = {
  acciones: Accion[];
  regulares: LineaRegular[];
  particulares: LineaParticular[];
  descuentos: DescuentoPre[];
  totales: {
    regulares: number;
    particulares: number;
    descuentos: number;
    /** Lo nuevo que se devenga ahora (cierre). */
    cierre: number;
    saldoPrevio: number;
    saldoDesglose: SaldoDesglose;
    /** Todo lo que se le debe al confirmar: cierre + saldo previo. */
    aPagar: number;
  };
  /** Las membresías que quedan inconclusas, una línea por membresía, por alumno. */
  inconclusas: InconclusaVista[];
  /** Cosas que no traban pero se explican. */
  avisos: string[];
  /** Avisos de la plata del profesor que se retira: se esconden con su liquidación. */
  avisosLiquidacion: string[];
  /**
   * Membresías que **no entran al cierre** y por qué (regla 17: bloquea esa
   * membresía, no al profesor). No traban el retiro: se liquidan después, con
   * la liquidación final, cuando se corrija lo que falta.
   */
  quedanAfuera: Traba[];
  trabas: Traba[];
  puedeConfirmar: boolean;
};

const HREF = { asistencia: "/asistencia", reservas: "/sala" };

/** Las asignaciones que el retiro cierra: las abiertas. */
export function abiertasDe(asignaciones: AsignacionRetiro[]): AsignacionRetiro[] {
  return asignaciones.filter((a) => a.hasta == null);
}

/**
 * Qué impide retirarlo, en palabras de la pantalla. Se llama igual en el
 * servidor antes de escribir. Vacío = se puede confirmar.
 */
export function validarRetiro(e: EntradaRetiro): Traba[] {
  const trabas: Traba[] = [];
  // Un inactivo con asignaciones abiertas sí se puede retirar: quedó a medias.
  if (!e.activo && abiertasDe(e.asignaciones).length === 0)
    trabas.push({ clave: "inactivo", texto: "El profesor ya está inactivo y no tiene asignaciones abiertas: no hay nada que retirar." });

  for (const a of abiertasDe(e.asignaciones)) {
    const falta = validarDesasignacion({
      desde: a.desde,
      hasta: a.hasta,
      profesorId: e.profesorId,
      fecha: e.corte,
      sustituto: e.sustitutos[a.id] ?? null,
    });
    if (falta) trabas.push({ clave: `asig-${a.id}`, texto: `${a.curso}: ${falta}` });
  }

  for (const p of e.posteriores) {
    if (!p.fechas.length) continue;
    const muestra = p.fechas.slice(0, 3).join(", ") + (p.fechas.length > 3 ? "…" : "");
    trabas.push({
      clave: `post-${p.cursoId}`,
      texto: `${p.curso}: dictó ${p.fechas.length} clase(s) después del corte (${muestra}). Elegí una fecha de corte posterior a ellas.`,
    });
  }

  if (e.reservasFuturas.length)
    trabas.push({
      clave: "reservas",
      texto: `Tiene ${e.reservasFuturas.length} reserva(s) particular(es) futura(s) que quedarían sin profesor. Reasignalas o cancelalas antes.`,
      href: HREF.reservas,
      accion: "Ir a la sala",
    });

  return trabas;
}

/** Lo que el cierre deja afuera: no traba, se explica y lleva a donde se arregla. */
export function quedanAfueraDe(e: EntradaRetiro): Traba[] {
  return [
    ...e.regular.bloqueadas.map((b) => ({
      clave: `bloq-${b.membresiaId}`,
      texto: `${b.alumno}: clases sin registrar en más de un curso (${b.cursos
        .map((c) => c.curso)
        .join(", ")}). Su parte no entra al cierre hasta registrarlas (regla 17).`,
      href: HREF.asistencia,
      accion: "Registrar clases",
    })),
    ...e.particulares.bloqueadas.map((b) => ({
      clave: `part-${b.membresiaId}`,
      texto: `${b.alumno} (particular): ${b.motivo} No entra al cierre.`,
    })),
  ];
}

export function armarRetiro(e: EntradaRetiro): VistaRetiro {
  const abiertas = abiertasDe(e.asignaciones);

  const acciones: Accion[] = [];
  for (const a of abiertas) {
    const s = e.sustitutos[a.id];
    acciones.push({
      clave: `asig-${a.id}`,
      texto: s?.profesorId
        ? `${a.curso}: se cierra su asignación el ${e.corte}; el sustituto empieza el ${diaSiguiente(e.corte)} (${s.pctIngresos}% de ingresos).`
        : `${a.curso}: se cierra su asignación el ${e.corte}; el curso queda sin titular.`,
    });
  }
  acciones.push({ clave: "cierre", texto: "Se devenga su cierre de cuentas (pago a cuenta, a pagar en Caja)." });
  acciones.push({ clave: "inactivar", texto: `${e.profesor} pasa a inactivo.` });

  const sinCuenta: CuentaMembresia = { precio: 0, descuento: 0, pagado: 0, saldo: 0 };
  const cuentaDe = (id: number) => e.cuentas[id] ?? sinCuenta;
  /** Lo ya devengado de esa membresía (y curso, si es regular) y dónde quedó. */
  const previoDe = (membresiaId: number, cursoId: number | null) => {
    const filas = e.previas.filter((x) => x.membresiaId === membresiaId && x.cursoId === cursoId);
    return {
      monto: r2(filas.reduce((s, x) => s + x.monto, 0)),
      liquidaciones: [...new Set(filas.map((x) => x.liquidacionId).filter((x): x is number => x != null))].sort(
        (a, b) => a - b
      ),
    };
  };

  const regulares: LineaRegular[] = e.regular.pendientes.map((p) => {
    const ya = previoDe(p.membresiaId, p.cursoId);
    return {
      membresiaId: p.membresiaId,
      alumno: p.alumno,
      curso: p.curso,
      criterio: e.criterios[p.membresiaId] ?? p.criterio,
      inicio: e.ciclos[p.membresiaId]?.inicio ?? null,
      fin: e.ciclos[p.membresiaId]?.fin ?? null,
      cuenta: cuentaDe(p.membresiaId),
      clases: p.clases,
      clasesDelCurso: p.clasesDelCurso,
      bonoAplicado: e.bonos[p.membresiaId]?.aplicado ?? 0,
      pct: p.pct,
      base: p.base,
      yaLiquidado: ya.monto,
      liquidaciones: ya.liquidaciones,
      aLaFecha: r2(ya.monto + p.monto),
      monto: p.monto,
    };
  });
  const particulares: LineaParticular[] = e.particulares.pendientes.map((p) => ({
    membresiaId: p.membresiaId,
    alumno: p.alumno,
    // El cierre mide como el criterio 2, pero la sigla es la de la venta.
    criterio: e.criterios[p.membresiaId] ?? p.criterio,
    inicio: e.ciclos[p.membresiaId]?.inicio ?? null,
    fin: e.ciclos[p.membresiaId]?.fin ?? null,
    cuenta: cuentaDe(p.membresiaId),
    bonoAplicado: e.bonos[p.membresiaId]?.aplicado ?? 0,
    horasDadas: p.detalle.horasDadas,
    horasContratadas: p.detalle.horasContratadas,
    forma: p.detalle.forma,
    cobrado: p.detalle.cobrado,
    yaLiquidado: p.detalle.yaDevengado,
    liquidaciones: previoDe(p.membresiaId, null).liquidaciones,
    aLaFecha: p.detalle.objetivo,
    monto: p.monto,
  }));

  // Las ya liquidadas enteras en una liquidación sin pagar: misma tabla, «Este cierre —».
  for (const y of e.yaLiquidadas) {
    const ya = previoDe(y.membresiaId, y.cursoId);
    const comun = {
      membresiaId: y.membresiaId,
      alumno: y.alumno,
      criterio: e.criterios[y.membresiaId] ?? null,
      inicio: e.ciclos[y.membresiaId]?.inicio ?? null,
      fin: e.ciclos[y.membresiaId]?.fin ?? null,
      cuenta: cuentaDe(y.membresiaId),
      bonoAplicado: e.bonos[y.membresiaId]?.aplicado ?? 0,
      yaLiquidado: ya.monto,
      liquidaciones: ya.liquidaciones,
      aLaFecha: ya.monto,
      monto: 0,
      soloLiquidado: true,
    };
    if (y.tipo === "regular") {
      if (regulares.some((l) => l.membresiaId === y.membresiaId && l.curso === y.curso)) continue;
      regulares.push({
        ...comun, curso: y.curso, clases: 0, clasesDelCurso: 0,
        pct: y.base > 0 ? Math.round((y.monto / y.base) * 100) : 0, base: y.base,
      });
    } else {
      if (particulares.some((l) => l.membresiaId === y.membresiaId)) continue;
      particulares.push({
        ...comun, horasDadas: y.horasDadas ?? 0, horasContratadas: y.horasContratadas ?? 0,
        forma: y.forma ?? "", cobrado: comun.cuenta.pagado,
      });
    }
  }
  regulares.sort((a, b) => a.alumno.localeCompare(b.alumno, "es") || a.curso.localeCompare(b.curso, "es"));
  particulares.sort((a, b) => a.alumno.localeCompare(b.alumno, "es"));

  const tReg = r2(regulares.reduce((s, l) => s + l.monto, 0));
  const tPar = r2(particulares.reduce((s, l) => s + l.monto, 0));
  const tDesc = r2(e.descuentos.reduce((s, d) => s + d.monto, 0));
  const cierre = r2(tReg + tPar);

  const avisos: string[] = [];
  const avisosLiquidacion: string[] = [];
  if (e.inconclusas.length)
    avisos.push(
      `${e.inconclusas.length} membresía(s) siguen con clases por dar: quedan con el sustituto o sin titular, según lo elegido. Lo que se cobre o dicte después se liquida como ajuste (regla 16).`
    );
  avisosLiquidacion.push("Los alquileres no se liquidan al profesor: él es quien paga la sala, no hay nada que cerrarle.");
  if (tDesc > 0)
    avisosLiquidacion.push(
      `Hay ${e.descuentos.length} reemplazo(s) atribuibles a él por ${tDesc.toFixed(2)}: se descuentan en su liquidación mensual (regla 20a), no en el cierre.`
    );

  const trabas = validarRetiro(e);
  return {
    acciones,
    regulares,
    particulares,
    descuentos: e.descuentos,
    totales: {
      regulares: tReg,
      particulares: tPar,
      descuentos: tDesc,
      cierre,
      saldoPrevio: r2(e.saldoPrevio),
      saldoDesglose: e.saldoDesglose,
      aPagar: r2(cierre + e.saldoPrevio),
    },
    inconclusas: [...e.inconclusas]
      .sort((a, b) => a.alumno.localeCompare(b.alumno, "es"))
      .map((m) => ({
        ...m,
        cuenta: cuentaDe(m.membresiaId),
        bonoAplicado: e.bonos[m.membresiaId]?.aplicado ?? 0,
        bonoGenerado: e.bonos[m.membresiaId]?.generado ?? 0,
        bonoVence: e.bonos[m.membresiaId]?.vence ?? null,
      })),
    avisos,
    avisosLiquidacion,
    quedanAfuera: quedanAfueraDe(e),
    trabas,
    puedeConfirmar: trabas.length === 0,
  };
}
