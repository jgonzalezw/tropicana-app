/**
 * El avance de membresías regulares **al corte**, leído de la asistencia con la
 * misma regla que Asistencia (`ordinalClase`): en un plan de N cuentan las
 * clases dictadas —una falta también—; en un paquete, las presentes. No
 * `clases_hechas`, que solo suma presentes y subcuenta la clase a la que faltó.
 * Una sola lectura para todo flujo que muestre o decida por el avance
 * (calidad 10): retiro, desasignar.
 */

import { createClient } from "@/lib/supabase/server";
import { exigir } from "@/lib/datos";
import { avanceAlCorte } from "@/lib/ordinalClase";

export type MembresiaParaAvance = { id: number; clases_plan: number | null; clases_total: number | null };
export type Avance = { hechas: number; total: number | null };

export async function leerAvancesAlCorte(
  sb: Awaited<ReturnType<typeof createClient>>,
  membresias: MembresiaParaAvance[],
  corte: string
): Promise<Map<number, Avance>> {
  const out = new Map<number, Avance>();
  if (!membresias.length) return out;

  const raw = await sb
    .from("asistencias")
    .select("membresia_id, estado, sesion:sesiones!inner(fecha, estado)", { count: "exact" })
    .in("membresia_id", membresias.map((m) => m.id));
  const asis = exigir(raw, "las asistencias de las membresías") as unknown as {
    membresia_id: number; estado: string; sesion: { fecha: string; estado: string };
  }[];
  // El tope de filas de la API corta en silencio: un avance truncado subcontaría.
  if (raw.count != null && asis.length < raw.count)
    throw new Error(`No se pudieron cargar las asistencias completas (${asis.length} de ${raw.count}).`);

  const fechasDe = (id: number, soloPresentes: boolean) =>
    asis
      .filter((a) => a.membresia_id === id && a.sesion.estado === "dictada" && (!soloPresentes || a.estado === "presente"))
      .map((a) => a.sesion.fecha);

  for (const m of membresias)
    out.set(
      m.id,
      avanceAlCorte(
        { clasesPlan: m.clases_plan, clasesTotal: m.clases_total, fechasDictadas: fechasDe(m.id, false), fechasPresentes: fechasDe(m.id, true) },
        corte
      )
    );
  return out;
}
