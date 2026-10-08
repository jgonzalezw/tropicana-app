/**
 * Lo que decora una línea de liquidación (L-01 §5): la cuenta del alumno, los
 * bonos, el criterio de la venta y el ciclo de cada membresía. Una sola lectura
 * para todo flujo (retiro, pre-liquidación, simulación, Liquidaciones); la
 * línea en sí se arma en `lineas.ts`. No escribe nada.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { exigir } from "@/lib/datos";
import { cobroPorMembresia } from "@/lib/liquidacion/cobro";
import type { BonoMembresia, ContextoLineas, CuentaMembresia, PreviaCierre } from "@/lib/liquidacion/lineas";
import type { DatosMotor } from "@/lib/liquidacion/motor";
import type { DatosParticulares } from "@/lib/liquidacion/particulares";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Precio, descuento, pagado y saldo, y los bonos, de las membresías `ids`. */
export async function leerCuentasYBonos(
  sb: SupabaseClient,
  ids: number[]
): Promise<{ cuentas: Record<number, CuentaMembresia>; bonos: Record<number, BonoMembresia> }> {
  const cuentas: Record<number, CuentaMembresia> = {};
  const bonos: Record<number, BonoMembresia> = {};
  if (!ids.length) return { cuentas, bonos };

  const cuotas = exigir(
    await sb.from("cuotas").select("id, membresia_id, monto_devengado, descuento_adelanto").in("membresia_id", ids),
    "las cuotas de las membresías"
  ) as { id: number; membresia_id: number; monto_devengado: number; descuento_adelanto: number }[];
  const pagos = cuotas.length
    ? (exigir(
        await sb.from("pagos").select("cuota_id, monto, descuento").eq("tipo", "cobro").in("cuota_id", cuotas.map((c) => c.id)),
        "los pagos de las membresías"
      ) as { cuota_id: number | null; monto: number; descuento: number }[])
    : [];
  const cobro = cobroPorMembresia(cuotas, pagos);
  for (const id of ids)
    cuentas[id] = {
      precio: r2(cobro.precio[id] ?? 0),
      descuento: r2(cobro.descuento[id] ?? 0),
      pagado: r2(cobro.cobrado[id] ?? 0),
      saldo: r2(cobro.saldo[id] ?? 0),
    };

  // Bono por curso (D35): el que recibió (`redimido_en_membresia_id`) y el que
  // deja pendiente para su renovación (`aplicado` nulo).
  const filas = exigir(
    await sb
      .from("membresia_bonos")
      .select("membresia_id, clases, vence, aplicado, redimido_en_membresia_id")
      .or(`membresia_id.in.(${ids.join(",")}),redimido_en_membresia_id.in.(${ids.join(",")})`),
    "los bonos de tolerancia"
  ) as { membresia_id: number; clases: number; vence: string | null; aplicado: string | null; redimido_en_membresia_id: number | null }[];
  // Las ventas anteriores a la 0064 recibieron el bono sumándolo a `clases_plan`
  // sin dejar `redimido_en_membresia_id`: lo que excede al plan es ese bono.
  const planes = exigir(
    await sb.from("membresias").select("id, clases_plan, plan:planes(cantidad_clases, clases_ilimitadas)").in("id", ids),
    "los planes de las membresías"
  ) as unknown as { id: number; clases_plan: number | null; plan: { cantidad_clases: number | null; clases_ilimitadas: boolean | null } | null }[];
  const excedente = (id: number): number => {
    const m = planes.find((x) => x.id === id);
    if (!m?.plan || m.plan.clases_ilimitadas || m.plan.cantidad_clases == null || m.clases_plan == null) return 0;
    return Math.max(0, m.clases_plan - m.plan.cantidad_clases);
  };
  for (const id of ids) {
    const generados = filas.filter((f) => f.membresia_id === id && f.aplicado == null);
    bonos[id] = {
      aplicado:
        filas.filter((f) => f.redimido_en_membresia_id === id && f.aplicado != null).reduce((t, f) => t + f.clases, 0) ||
        excedente(id),
      generado: generados.reduce((t, f) => t + f.clases, 0),
      vence: generados.map((f) => f.vence).filter((v): v is string => v != null).sort()[0] ?? null,
    };
  }
  return { cuentas, bonos };
}

/** Criterio de la venta y ciclo de cada membresía que leyeron los motores. */
export function criteriosYCiclos(
  datos: DatosMotor | null,
  datosPart: DatosParticulares | null
): Pick<ContextoLineas, "criterios" | "ciclos"> {
  const criterios: ContextoLineas["criterios"] = {};
  const ciclos: ContextoLineas["ciclos"] = {};
  for (const m of datos?.membresias ?? []) {
    criterios[m.id] = m.criterio_liquidacion ?? null;
    ciclos[m.id] = { inicio: m.fecha_inicio, fin: m.fecha_fin };
  }
  for (const m of datosPart?.membresias ?? []) {
    criterios[m.id] = m.criterio_liquidacion;
    ciclos[m.id] = { inicio: m.fecha_inicio ?? null, fin: m.fecha_fin };
  }
  return { criterios, ciclos };
}

/** Lo ya devengado de las membresías, con su liquidación (y su profesor, en regulares). */
export function previasDe(datos: DatosMotor | null, datosPart: DatosParticulares | null): PreviaCierre[] {
  return [
    ...(datos?.comisionesPrevias ?? [])
      .filter((c) => c.membresia_id != null)
      .map((c) => ({
        membresiaId: c.membresia_id as number,
        cursoId: c.curso_id,
        monto: Number(c.monto),
        liquidacionId: c.liquidacion_id ?? null,
        profesorId: c.profesor_id,
      })),
    ...(datosPart?.previas ?? [])
      .filter((c) => c.membresia_id != null)
      .map((c) => ({
        membresiaId: c.membresia_id as number,
        cursoId: null,
        monto: Number(c.monto),
        liquidacionId: c.liquidacion_id ?? null,
      })),
  ];
}

/** El contexto completo para decorar las líneas de `ids`. */
export async function leerContextoLineas(
  sb: SupabaseClient,
  datos: DatosMotor | null,
  datosPart: DatosParticulares | null,
  ids: number[]
): Promise<ContextoLineas> {
  const { cuentas, bonos } = await leerCuentasYBonos(sb, ids);
  return { cuentas, bonos, ...criteriosYCiclos(datos, datosPart), previas: previasDe(datos, datosPart), yaLiquidadas: [] };
}
