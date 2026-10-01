/**
 * Liquidación de clases particulares (C3, H5) — el cálculo, sin base de datos,
 * para poder fijarlo con pruebas deterministas (igual que `motor.ts`).
 *
 * Decisiones de Javier (2026-09-27, `docs/DECISIONES.md`, fila "H5"):
 *  - **Fee por hora**: paga las horas `realizada` + `ausente` (las dos son
 *    "consumida"); `reagendar`/`suspendida` no pagan (regla 19).
 *  - **Costo de sala**: foto tomada al vender (`costo_sala_aplicado`); acá solo
 *    se lee, nunca se recalcula (regla 12).
 *  - **Vencida con horas sin usar**: `proporcional` a lo dado o `completo`,
 *    según el parámetro `particular_vencida_modo`. No aplica a `fee_hora`.
 *  - **Criterio 2 (avance)**: paga "el avance a la fecha menos lo ya devengado"
 *    como `avance` en el período que se liquida; excepción a la regla 16.
 *  - **Cobrado 0 con saldo 0**: fee y monto fijo pagan igual; % margen da 0.
 *  - **Cortesía**: no devenga ni cuenta como hora dada.
 *
 * Criterios 1 y 3 pagan al completarse la membresía (agotada **y** cobrada,
 * regla 1): el 1 a período vencido, el 3 sin esperar el cierre del período.
 */

export type FormaPago = "fee_hora" | "pct_margen" | "monto_fijo";
export type ModoVencida = "proporcional" | "completo";

export type MembresiaParticular = {
  id: number;
  profesor_id: number;
  plan_id: number;
  alumno: string;
  criterio_liquidacion: number | null;
  forma_pago_profesor: FormaPago | null;
  fee_hora_aplicado: number | null;
  pago_pct_margen: number | null;
  pago_monto_fijo: number | null;
  pago_descuenta_sala: boolean;
  costo_sala_aplicado: number | null;
  horas_contratadas: number;
  fecha_fin: string | null;
  es_cortesia: boolean;
};

export type ReservaParticular = {
  membresia_id: number;
  fecha: string;
  estado: string;
  duracion_min: number;
  es_cortesia: boolean;
};

export type ComisionPreviaParticular = {
  id: number;
  membresia_id: number | null;
  monto: number;
  tipo: string;
  periodo: string | null;
};

export type DatosParticulares = {
  membresias: MembresiaParticular[];
  reservas: ReservaParticular[];
  /** Plata efectivamente cobrada y saldo por membresía (`cobroPorMembresia`). */
  cobrado: Record<number, number>;
  saldo: Record<number, number>;
  previas: ComisionPreviaParticular[];
  modoVencida: ModoVencida;
};

export type RangoParticulares = {
  /** Último día del período vencido (tope de "lo dado" y de completada). */
  hastaISO: string;
  /** Primer día del período vencido: donde cae una comisión de criterio 1. */
  periodoVencido: string;
  /** Hoy, para saber si ya venció la vigencia. */
  hoyISO: string;
};

export type DetalleParticular = {
  forma: FormaPago;
  criterio: number;
  horasContratadas: number;
  horasDadas: number;
  factor: number;
  completadaPor: "horas" | "vencimiento" | null;
  cobrado: number;
  costoSala: number | null;
  pct: number | null;
  fee: number | null;
  montoFijo: number | null;
  modoVencida: ModoVencida;
  objetivo: number;
  yaDevengado: number;
};

export type DevengoParticular = {
  membresiaId: number;
  profesorId: number;
  planId: number;
  alumno: string;
  tipo: "comision" | "ajuste" | "avance";
  criterio: 1 | 2 | 3;
  /** Período destino; en un ajuste, el de la comisión que corrige. */
  periodo: string;
  ajustaComisionId?: number;
  base: number;
  monto: number;
  detalle: DetalleParticular;
};

/** Una membresía que no se puede liquidar y por qué (calidad 5: se dice). */
export type ParticularBloqueada = { membresiaId: number; profesorId: number; alumno: string; motivo: string };

const EPS = 0.005;
const r2 = (n: number) => Math.round(n * 100) / 100;
const PAGABLES = ["realizada", "ausente"];

export function primerDiaMesDe(fechaISO: string): string {
  return `${fechaISO.slice(0, 7)}-01`;
}

/** Horas dadas de una membresía: `realizada`+`ausente`, sin cortesías. */
export function horasDadas(reservas: ReservaParticular[], hastaISO?: string): number {
  const min = reservas
    .filter((r) => PAGABLES.includes(r.estado) && !r.es_cortesia && (!hastaISO || r.fecha <= hastaISO))
    .reduce((acc, r) => acc + r.duracion_min, 0);
  return min / 60;
}

export type SituacionParticular = {
  horasDadas: number;
  agotadaPorHoras: boolean;
  vencida: boolean;
  /** Agotada (por horas o por vigencia) **y** cobrada al 100% — regla 1. */
  completa: boolean;
  completadaPor: "horas" | "vencimiento" | null;
  /** Fecha en que se agotó: la de la última hora dada, o el fin de vigencia. */
  fechaCompletada: string | null;
};

/**
 * ¿En qué punto está una particular? La comparte el liquidador y el cierre de
 * la membresía (`estado='completada'`), para que los dos lleguen a lo mismo.
 */
export function situacionParticular(
  m: Pick<MembresiaParticular, "horas_contratadas" | "fecha_fin">,
  reservas: ReservaParticular[],
  saldo: number,
  hoyISO: string
): SituacionParticular {
  const dadas = horasDadas(reservas);
  const agotadaPorHoras = m.horas_contratadas > 0 && dadas + 1e-9 >= m.horas_contratadas;
  const vencida = !!m.fecha_fin && m.fecha_fin < hoyISO;
  const cobrada = saldo <= EPS;
  const completadaPor = agotadaPorHoras ? "horas" : vencida ? "vencimiento" : null;
  let fechaCompletada: string | null = null;
  if (completadaPor === "horas") {
    const fechas = reservas
      .filter((r) => PAGABLES.includes(r.estado) && !r.es_cortesia)
      .map((r) => r.fecha)
      .sort();
    fechaCompletada = fechas[fechas.length - 1] ?? null;
  } else if (completadaPor === "vencimiento") fechaCompletada = m.fecha_fin;
  return { horasDadas: dadas, agotadaPorHoras, vencida, completa: completadaPor != null && cobrada, completadaPor, fechaCompletada };
}

/**
 * Cuánto le corresponde al profesor por una membresía, dado lo dado hasta la
 * fecha. `factor` es la fracción del paquete que se paga en `pct_margen` y
 * `monto_fijo`: 1 si se agotó por horas (o vencida con modo `completo`), y
 * lo dado sobre lo contratado si venció con horas sin usar (modo
 * `proporcional`) o si se está pagando el avance (criterio 2).
 */
function objetivoDe(
  m: MembresiaParticular,
  dadas: number,
  cobrado: number,
  factor: number
): { ok: true; monto: number; base: number } | { ok: false; motivo: string } {
  switch (m.forma_pago_profesor) {
    case "fee_hora":
      if (m.fee_hora_aplicado == null) return { ok: false, motivo: "La venta no guardó el fee por hora del profesor." };
      return { ok: true, base: r2(dadas), monto: r2(Number(m.fee_hora_aplicado) * dadas) };
    case "monto_fijo":
      if (m.pago_monto_fijo == null) return { ok: false, motivo: "La venta no guardó el monto fijo del plan." };
      return { ok: true, base: r2(Number(m.pago_monto_fijo)), monto: r2(Number(m.pago_monto_fijo) * factor) };
    case "pct_margen": {
      if (m.pago_pct_margen == null) return { ok: false, motivo: "La venta no guardó el % sobre el margen del plan." };
      if (m.pago_descuenta_sala && m.costo_sala_aplicado == null)
        return {
          ok: false,
          motivo: "El plan descuenta sala y la venta no tiene la foto del costo de sala. Cargala a mano antes de liquidar.",
        };
      const costo = m.pago_descuenta_sala ? Number(m.costo_sala_aplicado) : 0;
      const base = Math.max(0, cobrado - costo);
      return { ok: true, base: r2(base), monto: r2((Number(m.pago_pct_margen) / 100) * base * factor) };
    }
    default:
      return { ok: false, motivo: "La membresía no tiene forma de pago al profesor." };
  }
}

export function calcularDevengosParticulares(
  datos: DatosParticulares,
  rango: RangoParticulares
): { pendientes: DevengoParticular[]; bloqueadas: ParticularBloqueada[] } {
  const pendientes: DevengoParticular[] = [];
  const bloqueadas: ParticularBloqueada[] = [];

  for (const m of datos.membresias) {
    // Una membresía entera de cortesía no devenga nada (decisión 6).
    if (m.es_cortesia) continue;
    const criterio = m.criterio_liquidacion;
    if (criterio !== 1 && criterio !== 2 && criterio !== 3) {
      bloqueadas.push({
        membresiaId: m.id,
        profesorId: m.profesor_id,
        alumno: m.alumno,
        motivo: `El criterio de liquidación ${criterio ?? "(sin definir)"} no aplica a clases particulares.`,
      });
      continue;
    }
    const reservas = datos.reservas.filter((r) => r.membresia_id === m.id);
    const saldo = datos.saldo[m.id] ?? 0;
    const cobrado = datos.cobrado[m.id] ?? 0;
    const sit = situacionParticular(m, reservas, saldo, rango.hoyISO);
    const previas = datos.previas.filter((p) => p.membresia_id === m.id);
    const yaDevengado = r2(previas.reduce((acc, p) => acc + Number(p.monto), 0));
    const cobrada = saldo <= EPS;

    const armar = (
      dadas: number,
      factor: number,
      objetivo: { monto: number; base: number },
      tipo: DevengoParticular["tipo"],
      periodo: string,
      monto: number,
      ajustaComisionId?: number
    ): DevengoParticular => ({
      membresiaId: m.id,
      profesorId: m.profesor_id,
      planId: m.plan_id,
      alumno: m.alumno,
      tipo,
      criterio,
      periodo,
      ajustaComisionId,
      base: objetivo.base,
      monto,
      detalle: {
        forma: m.forma_pago_profesor as FormaPago,
        criterio,
        horasContratadas: m.horas_contratadas,
        horasDadas: dadas,
        factor: r2(factor),
        completadaPor: sit.completadaPor,
        cobrado,
        costoSala: m.pago_descuenta_sala ? m.costo_sala_aplicado : null,
        pct: m.pago_pct_margen,
        fee: m.fee_hora_aplicado,
        montoFijo: m.pago_monto_fijo,
        modoVencida: datos.modoVencida,
        objetivo: objetivo.monto,
        yaDevengado,
      },
    });

    if (criterio === 2) {
      // Avance: siempre que esté cobrada al 100%, sobre lo dado a la fecha.
      if (!cobrada) continue;
      const dadas = horasDadas(reservas, rango.hastaISO);
      const completoPorVencer = sit.vencida && !sit.agotadaPorHoras && datos.modoVencida === "completo";
      const factor = completoPorVencer ? 1 : m.horas_contratadas > 0 ? Math.min(1, dadas / m.horas_contratadas) : 0;
      const obj = objetivoDe(m, dadas, cobrado, factor);
      if (!obj.ok) {
        bloqueadas.push({ membresiaId: m.id, profesorId: m.profesor_id, alumno: m.alumno, motivo: obj.motivo });
        continue;
      }
      const delta = r2(obj.monto - yaDevengado);
      if (Math.abs(delta) < EPS) continue;
      pendientes.push(armar(dadas, factor, obj, "avance", rango.periodoVencido, delta));
      continue;
    }

    // Criterios 1 y 3: al completarse (agotada y cobrada).
    if (!sit.completa || !sit.fechaCompletada) continue;
    // El 1 espera al cierre del período vencido; el 3 paga al completarse.
    if (criterio === 1 && sit.fechaCompletada > rango.hastaISO) continue;
    // El período es el MES EN QUE SE COMPLETÓ la membresía (criterio 3), no el
    // mes en curso: así la liquidación de septiembre lleva lo completado en
    // septiembre aunque se genere en octubre (Javier, 2026-10-01).
    const periodo = criterio === 1 ? rango.periodoVencido : primerDiaMesDe(sit.fechaCompletada);
    const dadas = sit.horasDadas;
    const factor =
      sit.completadaPor === "horas" || datos.modoVencida === "completo"
        ? 1
        : m.horas_contratadas > 0
          ? Math.min(1, dadas / m.horas_contratadas)
          : 0;
    const obj = objetivoDe(m, dadas, cobrado, factor);
    if (!obj.ok) {
      bloqueadas.push({ membresiaId: m.id, profesorId: m.profesor_id, alumno: m.alumno, motivo: obj.motivo });
      continue;
    }

    const original = previas.filter((p) => p.tipo === "comision").sort((a, b) => a.id - b.id)[0];
    if (!original) {
      pendientes.push(armar(dadas, factor, obj, "comision", periodo, obj.monto));
      continue;
    }
    // Ya devengó: si el recálculo da otro número, la diferencia va como ajuste
    // firmado al período de la comisión original (regla 16).
    const delta = r2(obj.monto - yaDevengado);
    if (Math.abs(delta) < EPS) continue;
    pendientes.push(
      armar(dadas, factor, obj, "ajuste", original.periodo ?? periodo, delta, original.id)
    );
  }
  return { pendientes, bloqueadas };
}
