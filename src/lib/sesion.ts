import { createClient } from "@/lib/supabase/server";
import type { PerfilConRol } from "@/lib/tipos";

/** Devuelve el perfil (con su rol) del usuario autenticado, o null. */
export async function obtenerPerfilActual(): Promise<PerfilConRol | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("perfiles")
    .select("*, rol:roles(*)")
    .eq("id", user.id)
    .single();

  return (data as PerfilConRol) ?? null;
}

export async function esAdministrador(): Promise<boolean> {
  const perfil = await obtenerPerfilActual();
  return perfil?.rol?.clave === "administrador" && perfil.activo;
}

/** Lee el valor (texto) de un parámetro configurable, o null si no existe. */
export async function obtenerParametro(clave: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parametros")
    .select("valor")
    .eq("clave", clave)
    .maybeSingle();
  return (data?.valor as string) ?? null;
}

/** ¿El usuario actual puede ejecutar `accion` sobre `modulo`? El
 *  Administrador siempre puede; el resto, según su matriz de permisos. */
export async function tienePermiso(
  modulo: string,
  accion: string
): Promise<boolean> {
  const perfil = await obtenerPerfilActual();
  if (!perfil || !perfil.activo) return false;
  if (perfil.rol?.clave === "administrador") return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("rol_permisos")
    .select("permitido")
    .eq("rol_id", perfil.rol_id)
    .eq("modulo", modulo)
    .eq("accion", accion)
    .maybeSingle();

  return data?.permitido === true;
}
