import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la clave service_role. SOLO puede usarse en
 * código de servidor (server actions / route handlers). Nunca importar
 * desde un componente cliente: la clave service_role salta todas las
 * reglas de seguridad (RLS) y jamás debe llegar al navegador.
 *
 * Devuelve null si la clave no está configurada, para poder mostrar un
 * mensaje claro en la interfaz en vez de romper.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
