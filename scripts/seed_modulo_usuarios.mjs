// Aplica la migración 0002 (módulo de permisos "usuarios" para el rol
// Administrador) usando la clave service_role. Uso puntual, idempotente.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Carga simple de .env.local
const env = {};
for (const linea of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// 1) Rol administrador
const { data: rol, error: e1 } = await supabase
  .from("roles")
  .select("id, nombre")
  .eq("clave", "administrador")
  .single();
if (e1) { console.error("Error buscando rol:", e1.message); process.exit(1); }
console.log("Rol administrador:", rol);

// 2) Insertar permisos del módulo usuarios
const filas = ["ver", "crear", "editar", "eliminar"].map((accion) => ({
  rol_id: rol.id,
  modulo: "usuarios",
  accion,
  permitido: true,
}));

const { error: e2 } = await supabase
  .from("rol_permisos")
  .upsert(filas, { onConflict: "rol_id,modulo,accion" });
if (e2) { console.error("Error upsert permisos:", e2.message); process.exit(1); }

console.log("OK: módulo 'usuarios' habilitado para Administrador.");
