"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import type { DatosAlumno } from "@/lib/tipos";
import { validarIdentidadAlumno } from "@/lib/contactos";
import {
  crearOReusarContactoPersona,
  actualizarContactoPersona,
  resolverTutor,
  vincularTutor,
} from "@/app/(privado)/contactos/acciones";

type Resultado = { ok?: true; error?: string; accion?: "eliminado" | "desactivado" };

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

export async function crearAlumno(d: DatosAlumno): Promise<Resultado> {
  if (!(await tienePermiso("alumnos", "crear"))) return { error: "Sin permiso." };
  const err = validarIdentidadAlumno(d);
  if (err) return { error: err };

  const { contacto, error: errContacto } = await crearOReusarContactoPersona({
    nombre: d.nombre,
    apellido: d.apellido,
    whatsapp: d.es_menor ? null : d.whatsapp,
    canal_captacion: d.canal_captacion,
    reusarSiExiste: false,
  });
  if (errContacto || !contacto) return { error: errContacto ?? "No se pudo crear el contacto." };

  if (d.es_menor) {
    const { contacto: tutor, error: errTutor } = await resolverTutor(d);
    if (errTutor || !tutor) return { error: errTutor ?? "No se pudo resolver el tutor." };
    const { error: errRel } = await vincularTutor(tutor.id, contacto.id);
    if (errRel) return { error: errRel };
  }

  const { error } = await admin().from("alumnos").insert({ contacto_id: contacto.id, es_menor: d.es_menor });
  if (error) return { error: error.message };
  revalidatePath("/alumnos");
  return { ok: true };
}

export async function actualizarAlumno(id: number, d: DatosAlumno): Promise<Resultado> {
  if (!(await tienePermiso("alumnos", "editar"))) return { error: "Sin permiso." };
  const err = validarIdentidadAlumno(d);
  if (err) return { error: err };

  const { data: fila, error: errFila } = await admin().from("alumnos").select("contacto_id").eq("id", id).single();
  if (errFila || !fila) return { error: errFila?.message ?? "Alumno no encontrado." };

  const errContacto = await actualizarContactoPersona(fila.contacto_id, {
    nombre: d.nombre,
    apellido: d.apellido,
    whatsapp: d.es_menor ? null : d.whatsapp,
    canal_captacion: d.canal_captacion,
  });
  if (errContacto.error) return { error: errContacto.error };

  if (d.es_menor) {
    const { contacto: tutor, error: errTutor } = await resolverTutor(d);
    if (errTutor || !tutor) return { error: errTutor ?? "No se pudo resolver el tutor." };
    const { error: errRel } = await vincularTutor(tutor.id, fila.contacto_id);
    if (errRel) return { error: errRel };
  }

  const { error } = await admin()
    .from("alumnos")
    .update({ es_menor: d.es_menor, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/alumnos");
  return { ok: true };
}

/** Historial dependiente de un alumno = inscripciones + pagos. Con historial
 *  se desactiva (conserva lo registrado); sin historial se elimina de verdad. */
async function contarDependencias(id: number): Promise<number> {
  const a = admin();
  const [{ count: insc }, { count: pagos }] = await Promise.all([
    a.from("membresias").select("id", { count: "exact", head: true }).eq("alumno_id", id),
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
