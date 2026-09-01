"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import { soloDigitos } from "@/lib/texto";
import type { DatosAlumno } from "@/lib/tipos";

type Resultado = { ok?: true; error?: string; accion?: "eliminado" | "desactivado" };

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

function mapearError(e: { code?: string; message?: string }): string {
  if (e.code === "23505") {
    if (e.message?.includes("menor")) return "Ese menor ya está cargado (mismo tutor y nombre).";
    return "Ese WhatsApp ya es de un alumno.";
  }
  return e.message ?? "No se pudo guardar.";
}

function validar(d: DatosAlumno): string | null {
  if (!d.nombre.trim() || !d.apellido.trim()) return "Nombre y apellido son obligatorios.";
  if (d.es_menor) {
    if (soloDigitos(d.tutor_whatsapp).length < 6)
      return "El WhatsApp del tutor identifica al menor (6+ dígitos).";
  } else if (soloDigitos(d.whatsapp).length < 6) {
    return "El WhatsApp identifica al alumno (6+ dígitos).";
  }
  return null;
}

function payload(d: DatosAlumno) {
  return {
    nombre: d.nombre.trim(),
    apellido: d.apellido.trim(),
    whatsapp: d.whatsapp.trim() || null,
    es_menor: d.es_menor,
    tutor_alumno_id: d.es_menor ? d.tutor_alumno_id : null,
    tutor_nombre: d.es_menor ? d.tutor_nombre.trim() || null : null,
    tutor_whatsapp: d.es_menor ? d.tutor_whatsapp.trim() || null : null,
    canal_captacion: d.canal_captacion,
  };
}

export async function crearAlumno(d: DatosAlumno): Promise<Resultado> {
  if (!(await tienePermiso("alumnos", "crear"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const { error } = await admin().from("alumnos").insert(payload(d));
  if (error) return { error: mapearError(error) };
  revalidatePath("/alumnos");
  return { ok: true };
}

export async function actualizarAlumno(id: number, d: DatosAlumno): Promise<Resultado> {
  if (!(await tienePermiso("alumnos", "editar"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const { error } = await admin()
    .from("alumnos")
    .update({ ...payload(d), actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: mapearError(error) };
  revalidatePath("/alumnos");
  return { ok: true };
}

/** Historial dependiente de un alumno = inscripciones + pagos. Con historial
 *  se desactiva (conserva lo registrado); sin historial se elimina de verdad. */
async function contarDependencias(id: number): Promise<number> {
  const a = admin();
  const [{ count: insc }, { count: pagos }] = await Promise.all([
    a.from("inscripciones").select("id", { count: "exact", head: true }).eq("alumno_id", id),
    a.from("pagos").select("id", { count: "exact", head: true }).eq("alumno_id", id),
  ]);
  return (insc ?? 0) + (pagos ?? 0);
}

export async function eliminarODesactivarAlumno(id: number): Promise<Resultado> {
  if (!(await tienePermiso("alumnos", "eliminar"))) return { error: "Sin permiso." };

  if ((await contarDependencias(id)) > 0) {
    const { error } = await admin()
      .from("alumnos")
      .update({ activo: false, actualizado_en: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/alumnos");
    return { ok: true, accion: "desactivado" };
  }

  const { error } = await admin().from("alumnos").delete().eq("id", id);
  if (error) {
    // Defensa: si una FK lo impide igual, degradamos a desactivar.
    const { error: e2 } = await admin()
      .from("alumnos")
      .update({ activo: false, actualizado_en: new Date().toISOString() })
      .eq("id", id);
    if (e2) return { error: e2.message };
    revalidatePath("/alumnos");
    return { ok: true, accion: "desactivado" };
  }
  revalidatePath("/alumnos");
  return { ok: true, accion: "eliminado" };
}

export async function activarAlumno(id: number): Promise<Resultado> {
  if (!(await tienePermiso("alumnos", "editar"))) return { error: "Sin permiso." };
  const { error } = await admin()
    .from("alumnos")
    .update({ activo: true, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/alumnos");
  return { ok: true };
}
