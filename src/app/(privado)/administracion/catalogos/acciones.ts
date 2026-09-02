"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

function claveDesde(etiqueta: string) {
  return etiqueta
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function agregarValor(catalogo_id: number, etiqueta: string) {
  if (!(await tienePermiso("administracion", "editar")))
    return { error: "No tenés permiso para editar catálogos." };

  const limpio = etiqueta.trim();
  if (!limpio) return { error: "La etiqueta no puede estar vacía." };

  const a = admin();

  const { data: max } = await a
    .from("catalogo_valores")
    .select("orden")
    .eq("catalogo_id", catalogo_id)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orden = (max?.orden ?? 0) + 1;
  const valor = claveDesde(limpio) || `valor_${orden}`;

  const { error } = await a
    .from("catalogo_valores")
    .insert({ catalogo_id, valor, etiqueta: limpio, orden, activo: true });

  if (error) return { error: error.message };

  revalidatePath("/administracion/catalogos");
  return { ok: true };
}

export async function actualizarValor(id: number, etiqueta: string, activo: boolean) {
  if (!(await tienePermiso("administracion", "editar")))
    return { error: "No tenés permiso para editar catálogos." };

  const limpio = etiqueta.trim();
  if (!limpio) return { error: "La etiqueta no puede estar vacía." };

  const { error } = await admin()
    .from("catalogo_valores")
    .update({ etiqueta: limpio, activo })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/administracion/catalogos");
  return { ok: true };
}
