"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esAdministrador } from "@/lib/sesion";

export async function guardarParametro(clave: string, valor: string) {
  if (!(await esAdministrador())) {
    return { error: "Sin permiso." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("parametros")
    .update({ valor, actualizado_en: new Date().toISOString() })
    .eq("clave", clave);

  if (error) return { error: error.message };

  revalidatePath("/administracion/parametros");
  return { ok: true };
}
