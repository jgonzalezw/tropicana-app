"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esAdministrador } from "@/lib/sesion";
import { generarClave } from "@/lib/texto";
import { MODULOS, ACCIONES } from "@/lib/tipos";
import {
  permitidoEnPlantilla,
  type ClavePlantilla,
} from "@/lib/plantillas";

export async function aplicarPlantilla(
  rol_id: number,
  plantilla: ClavePlantilla
) {
  if (!(await esAdministrador())) return { error: "Sin permiso." };

  const filas = MODULOS.flatMap((modulo) =>
    ACCIONES.map((accion) => ({
      rol_id,
      modulo,
      accion,
      permitido: permitidoEnPlantilla(plantilla, modulo, accion),
    }))
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("rol_permisos")
    .upsert(filas, { onConflict: "rol_id,modulo,accion" });

  if (error) return { error: error.message };

  revalidatePath("/administracion/roles");
  return { ok: true };
}

export async function crearRol(nombre: string, descripcion: string) {
  if (!(await esAdministrador())) return { error: "Sin permiso." };

  const limpio = nombre.trim();
  if (!limpio) return { error: "El nombre del rol no puede estar vacío." };

  const supabase = await createClient();

  // Genera una clave única a partir del nombre.
  const base = generarClave(limpio) || "rol";
  let clave = base;
  let intento = 1;
  while (true) {
    const { data } = await supabase
      .from("roles")
      .select("id")
      .eq("clave", clave)
      .maybeSingle();
    if (!data) break;
    intento += 1;
    clave = `${base}_${intento}`;
  }

  const { error } = await supabase.from("roles").insert({
    clave,
    nombre: limpio,
    descripcion: descripcion.trim() || null,
    es_sistema: false,
  });

  if (error) return { error: error.message };

  revalidatePath("/administracion/roles");
  return { ok: true };
}

export async function actualizarRol(
  id: number,
  nombre: string,
  descripcion: string
) {
  if (!(await esAdministrador())) return { error: "Sin permiso." };

  const limpio = nombre.trim();
  if (!limpio) return { error: "El nombre del rol no puede estar vacío." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("roles")
    .update({ nombre: limpio, descripcion: descripcion.trim() || null })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/administracion/roles");
  return { ok: true };
}

export async function eliminarRol(id: number) {
  if (!(await esAdministrador())) return { error: "Sin permiso." };

  const supabase = await createClient();

  // No permitir borrar roles del sistema.
  const { data: rol } = await supabase
    .from("roles")
    .select("es_sistema")
    .eq("id", id)
    .single();
  if (rol?.es_sistema) {
    return { error: "Los roles base del sistema no se pueden eliminar." };
  }

  // No permitir borrar si hay usuarios asignados.
  const { count } = await supabase
    .from("perfiles")
    .select("id", { count: "exact", head: true })
    .eq("rol_id", id);
  if ((count ?? 0) > 0) {
    return {
      error: `No se puede eliminar: hay ${count} usuario(s) con este rol. Reasignalos primero.`,
    };
  }

  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/administracion/roles");
  return { ok: true };
}

export async function alternarPermiso(
  rol_id: number,
  modulo: string,
  accion: string,
  permitido: boolean
) {
  if (!(await esAdministrador())) {
    return { error: "Sin permiso." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rol_permisos")
    .upsert(
      { rol_id, modulo, accion, permitido },
      { onConflict: "rol_id,modulo,accion" }
    );

  if (error) return { error: error.message };

  revalidatePath("/administracion/roles");
  return { ok: true };
}
