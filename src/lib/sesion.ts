import { createClient } from "@/lib/supabase/server";
import type { Alcance, PerfilConRol } from "@/lib/tipos";

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

/**
 * El alcance del usuario actual sobre `modulo`. El Administrador siempre ve
 * todo. **Sin fila en `rol_visibilidad` → 'todo'**: es el default
 * retrocompatible (sin esta config, todo se ve como antes de la 0043).
 */
export async function alcanceDe(modulo: string): Promise<Alcance> {
  const perfil = await obtenerPerfilActual();
  if (!perfil || !perfil.activo) return "todo";
  if (perfil.rol?.clave === "administrador") return "todo";

  const supabase = await createClient();
  const { data } = await supabase
    .from("rol_visibilidad")
    .select("alcance")
    .eq("rol_id", perfil.rol_id)
    .eq("modulo", modulo)
    .maybeSingle();

  return (data?.alcance as Alcance) === "propio" ? "propio" : "todo";
}

/**
 * El profesor vinculado a la cuenta del usuario actual, o `null` si su cuenta
 * no está vinculada a ninguno. Es el "cuál es mi profesor" que hace falta para
 * filtrar a lo propio (asistencia, liquidaciones): el vínculo 1-a-1 vive en
 * `profesores.usuario_id` (0005) desde siempre, pero nada lo usaba.
 */
export async function obtenerProfesorActual(): Promise<{ id: number } | null> {
  const perfil = await obtenerPerfilActual();
  if (!perfil) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profesores")
    .select("id")
    .eq("usuario_id", perfil.id)
    .maybeSingle();
  return (data as { id: number } | null) ?? null;
}
