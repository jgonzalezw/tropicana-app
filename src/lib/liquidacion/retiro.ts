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
  /** Membresías activas de sus cursos con clases por dar. */
  membresiasQueQuedan: { id: number; alumno: string; curso: string; hechas: number; plan: number }[];
};

export type Accion = { clave: string; texto: string };

export type LineaRegular = {
  membresiaId: number;
  alumno: string;
  curso: string;
  clases: number;
  clasesDelCurso: number;
  pct: number;
  base: number;
  monto: number;
};

export type LineaParticular = {
  membresiaId: number;
  alumno: string;
  horasDadas: number;
  horasContratadas: number;
  forma: string;
  cobrado: number;
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
    /** Todo lo que se le debe al confirmar: cierre + saldo previo. */
    aPagar: number;
  };
  /** Cosas que no traban pero se explican. */
  avisos: string[];
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
  if (!e.activo) trabas.push({ clave: "inactivo", texto: "El profesor ya está inactivo." });

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

  for (const b of e.regular.bloqueadas)
    trabas.push({
      clave: `bloq-${b.membresiaId}`,
      texto: `${b.alumno}: tiene clases sin registrar en más de un curso (${b.cursos
        .map((c) => c.curso)
        .join(", ")}). No se puede calcular su parte hasta registrarlas (regla 17).`,
      href: HREF.asistencia,
      accion: "Registrar clases",
    });

  for (const b of e.particulares.bloqueadas)
    trabas.push({ clave: `part-${b.membresiaId}`, texto: `${b.alumno} (particular): ${b.motivo}` });

  return trabas;
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

  const regulares: LineaRegular[] = e.regular.pendientes.map((p) => ({
    membresiaId: p.membresiaId,
    alumno: p.alumno,
    curso: p.curso,
    clases: p.clases,
    clasesDelCurso: p.clasesDelCurso,
    pct: p.pct,
    base: p.base,
    monto: p.monto,
  }));
  const particulares: LineaParticular[] = e.particulares.pendientes.map((p) => ({
    membresiaId: p.membresiaId,
    alumno: p.alumno,
    horasDadas: p.detalle.horasDadas,
    horasContratadas: p.detalle.horasContratadas,
    forma: p.detalle.forma,
    cobrado: p.detalle.cobrado,
    monto: p.monto,
  }));

  const tReg = r2(regulares.reduce((s, l) => s + l.monto, 0));
  const tPar = r2(particulares.reduce((s, l) => s + l.monto, 0));
  const tDesc = r2(e.descuentos.reduce((s, d) => s + d.monto, 0));
  const cierre = r2(tReg + tPar);

  const avisos: string[] = [];
  if (e.membresiasQueQuedan.length)
    avisos.push(
      `${e.membresiasQueQuedan.length} membresía(s) activa(s) siguen con clases por dar: quedan con el sustituto o sin titular, según lo elegido. Lo que se cobre o dicte después se liquida como ajuste (regla 16).`
    );
  avisos.push("Los alquileres no se liquidan al profesor: él es quien paga la sala, no hay nada que cerrarle.");
  if (tDesc > 0)
    avisos.push(
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
      aPagar: r2(cierre + e.saldoPrevio),
    },
    avisos,
    trabas,
    puedeConfirmar: trabas.length === 0,
  };
}
