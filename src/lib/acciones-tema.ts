"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obtenerTemas } from "@/lib/temas";

/** Guarda el tema elegido por el usuario actual (preferencia por usuario). */
export async function cambiarTema(clave: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  // Validar contra el catálogo, para no guardar un tema inexistente.
  const temas = await obtenerTemas();
  if (!temas.some((t) => t.clave === clave)) return { error: "Tema desconocido." };

  const { error } = await supabase
    .from("perfiles")
    .update({ tema: clave })
    .eq("id", user.id);
  if (error) return { error: "No se pudo guardar el tema." };

  // Re-renderiza el layout raíz para reinyectar los tokens del tema.
  revalidatePath("/", "layout");
  return {};
}
