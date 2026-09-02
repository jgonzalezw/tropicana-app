"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

export async function guardarParametro(clave: string, valor: string) {
  // Gobernado por el permiso (no solo el rol administrador): cualquier rol con
  // administracion.editar puede cambiar parámetros. La escritura va por
  // service_role tras el chequeo, igual que el resto de operativos.
  if (!(await tienePermiso("administracion", "editar"))) {
    return { error: "No tenés permiso para editar parámetros." };
  }

  const { error } = await admin()
    .from("parametros")
    .update({ valor, actualizado_en: new Date().toISOString() })
    .eq("clave", clave);

  if (error) return { error: error.message };

  revalidatePath("/administracion/parametros");
  return { ok: true };
}
