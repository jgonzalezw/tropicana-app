import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Alcance, PerfilConRol } from "@/lib/tipos";
import { seccionesVisibles, type SeccionesVisibles } from "@/lib/secciones";

// Todo lo de abajo se memoriza con `cache` de React: vive SOLO durante una
// petición (página o acción) y se descarta al terminar; nunca se comparte entre
// peticiones ni entre usuarios. La identidad se sigue verificando igual
// (`auth.getUser()`), solo que una vez por petición en vez de una por chequeo.

/** Devuelve el perfil (con su rol) del usuario autenticado, o null. */
export const obtenerPerfilActual = cache(async (): Promise<PerfilConRol | null> => {
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
});

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
export const tienePermiso = cache(async (
  modulo: string,
  accion: string
): Promise<boolean> => {
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
});

/**
 * El alcance del usuario actual sobre `modulo`. El Administrador siempre ve
 * todo. **Sin fila en `rol_visibilidad` → 'todo'**: es el default
 * retrocompatible (sin esta config, todo se ve como antes de la 0043).
 */
export const alcanceDe = cache(async (modulo: string): Promise<Alcance> => {
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
});

/**
 * El profesor vinculado a la cuenta del usuario actual, o `null` si su cuenta
 * no está vinculada a ninguno. Es el "cuál es mi profesor" que hace falta para
 * filtrar a lo propio (asistencia, liquidaciones): el vínculo 1-a-1 vive en
 * `profesores.usuario_id` (0005) desde siempre, pero nada lo usaba.
 */
export const obtenerProfesorActual = cache(async (): Promise<{ id: number } | null> => {
  const perfil = await obtenerPerfilActual();
  if (!perfil) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profesores")
    .select("id")
    .eq("usuario_id", perfil.id)
    .maybeSingle();
  return (data as { id: number } | null) ?? null;
});

/**
 * Atajo de `alcanceDe` + `obtenerProfesorActual` para los módulos con dueño
 * "profesor" (asistencia, liquidaciones, particulares — 0043/H4): dice si hay
 * que acotar a lo propio y, si es así, a qué profesor. Con `propio: true` y
 * `profesorId: null` la cuenta no está vinculada a ningún profesor — no ve
 * nada, y quien llama tiene que explicarlo (regla de calidad 5), nunca
 * mostrar una lista vacía sin más.
 */
export async function alcancePropioDe(modulo: string): Promise<{ propio: boolean; profesorId: number | null }> {
  const alcance = await alcanceDe(modulo);
  if (alcance !== "propio") return { propio: false, profesorId: null };
  const profesor = await obtenerProfesorActual();
  return { propio: true, profesorId: profesor?.id ?? null };
}

/**
 * Los cursos que un profesor tiene hoy como titular (asignación vigente). Es la
 * regla de "propio" para cursos: la usan la lista de Asistencia y el guardia de
 * servidor (`errorAccesoCurso`), para que las dos digan lo mismo.
 */
export async function cursosDeProfesor(profesorId: number): Promise<number[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("asignaciones")
    .select("curso_id")
    .eq("profesor_id", profesorId)
    .is("hasta", null);
  return ((data as { curso_id: number }[]) ?? []).map((a) => a.curso_id);
}

/**
 * El guardia de servidor del alcance "propio" sobre un curso (módulo
 * asistencia): que la pantalla filtre la lista no alcanza, quien decide es el
 * servidor. `null` = puede operar el curso; si no, el mensaje para mostrar.
 * Con alcance "todo" no consulta nada más.
 */
export async function errorAccesoCurso(cursoId: number): Promise<string | null> {
  const { propio, profesorId } = await alcancePropioDe("asistencia");
  if (!propio) return null;
  if (profesorId == null) return "Tu cuenta no está vinculada a ningún profesor.";
  return (await cursosDeProfesor(profesorId)).includes(cursoId) ? null : "Ese curso no es tuyo.";
}

/** Secciones del shell que ve el usuario actual: permisos (`tienePermiso`) +
 *  interruptor `membresias_nuevas`. La lógica pura vive en `secciones.ts`. */
export const obtenerSeccionesVisibles = cache(async (): Promise<SeccionesVisibles> => {
  const [alumnos, particulares, alquileres, interruptor] = await Promise.all([
    tienePermiso("alumnos", "ver"),
    tienePermiso("particulares", "ver"),
    tienePermiso("alquileres", "ver"),
    obtenerParametro("membresias_nuevas"),
  ]);
  return seccionesVisibles(
    { alumnos, particulares, alquileres },
    { membresiasNuevas: interruptor === "true" }
  );
});
