import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Qué salas propias puede pedir una membresía: la misma regla que aplica
 * `crearReserva` al guardar — las del plan si `salas_modo = 'solo'`, todas si
 * no, y siempre las que la membresía ya usa (`membresia_salas`). Una sola
 * función para la hoja «Nueva reserva» (que no ofrece lo que el servidor va a
 * rechazar) y para la acción que consulta las franjas.
 *
 * `null` = sin restricción (todas las salas activas).
 */
export async function salasPermitidasDeMembresia(a: Admin, membresiaId: number): Promise<number[] | null> {
  const { data: m, error: errM } = await a.from("membresias").select("plan_id").eq("id", membresiaId).maybeSingle();
  if (errM) throw new Error(`No se pudo leer la membresía: ${errM.message}`);
  if (!m) return null;
  return salasPermitidasDelPlan(a, membresiaId, m.plan_id as number | null);
}

/**
 * Lo mismo con el `plan_id` ya leído (quien ya leyó la membresía no la vuelve a
 * leer). Las tres lecturas salen juntas: el modo del plan, las salas del plan y
 * las que la membresía ya usa.
 */
export async function salasPermitidasDelPlan(a: Admin, membresiaId: number, planId: number | null): Promise<number[] | null> {
  if (planId == null) return null; // sin plan (p. ej. un alquiler): sin restricción
  const [plan, delPlan, usadas] = await Promise.all([
    a.from("planes").select("salas_modo").eq("id", planId).maybeSingle(),
    a.from("plan_salas").select("sala_id").eq("plan_id", planId),
    a.from("membresia_salas").select("sala_id").eq("membresia_id", membresiaId),
  ]);
  if (plan.error) throw new Error(`No se pudo leer el plan: ${plan.error.message}`);
  if (plan.data?.salas_modo !== "solo") return null;
  if (delPlan.error) throw new Error(`No se pudieron leer las salas del plan: ${delPlan.error.message}`);
  if (usadas.error) throw new Error(`No se pudieron leer las salas de la membresía: ${usadas.error.message}`);
  return [...new Set([...(delPlan.data ?? []), ...(usadas.data ?? [])].map((r) => r.sala_id as number))];
}
