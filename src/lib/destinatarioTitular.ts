import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * A quién se le avisa por un alquiler (C3 H7 / Hito B): al titular, o —si el
 * titular es una organización— a la persona que la atiende (relación
 * `trabaja_en`, la primera con WhatsApp); si no hay ninguna, al de la propia
 * organización. Lo comparten la venta (`accionesAlquiler.ts`) y la gestión de
 * reservas (`particulares/acciones.ts`) — regla de proceso 4: una sola pieza.
 * Lee con el cliente admin: el select de `contactos` exige el permiso de ese
 * módulo, y lo que habilita estas lecturas es el permiso `alquileres`.
 */
export async function destinatarioDeTitular(
  a: Admin,
  titular: { id: number; nombre: string; whatsapp: string | null }
): Promise<{ nombre: string; whatsapp: string | null }> {
  let destino = { nombre: titular.nombre, whatsapp: titular.whatsapp };
  const { data: orgRow } = await a.from("contactos").select("tipo").eq("id", titular.id).maybeSingle();
  if ((orgRow as { tipo?: string } | null)?.tipo !== "organizacion") return destino;

  const { data: rel } = await a
    .from("contacto_relaciones")
    .select("desde_id")
    .eq("hacia_id", titular.id)
    .eq("tipo", "trabaja_en");
  const ids = ((rel ?? []) as { desde_id: number }[]).map((r) => r.desde_id);
  if (!ids.length) return destino;

  const { data: pers } = await a
    .from("contactos")
    .select("id, nombre, apellido, whatsapp, activo")
    .in("id", ids)
    .eq("activo", true)
    .not("whatsapp", "is", null)
    .order("id")
    .limit(1);
  const p = ((pers ?? []) as { nombre: string | null; apellido: string | null; whatsapp: string | null }[])[0];
  if (p?.whatsapp) destino = { nombre: [p.nombre, p.apellido].filter(Boolean).join(" "), whatsapp: p.whatsapp };
  return destino;
}
