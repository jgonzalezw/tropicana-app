"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import type { DatosProfesor } from "@/lib/tipos";
import { presenteDesdeExtra } from "@/lib/matrizMinimos";
import {
  crearOReusarContactoPersona,
  actualizarContactoPersona,
  guardarDatosExtra,
  validarContraMatriz,
} from "@/app/(privado)/contactos/acciones";

type Resultado = { ok?: true; error?: string; accion?: "eliminada" | "desactivada" };

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

function mapearError(e: { code?: string; message?: string }): string {
  if (e.code === "23505") {
    if (e.message?.includes("usuario_id"))
      return "Esa cuenta ya está vinculada a otro profesor.";
    return "Ese WhatsApp ya es de otro contacto.";
  }
  return e.message ?? "No se pudo guardar.";
}

/**
 * Identidad y estructura del profesor — hardcodeado, no en la matriz (igual
 * criterio que `validarIdentidadAlumno`): el WhatsApp lo identifica, y
 * estilos/tipo son propios del rol, no campos de contacto. Nombre y
 * apellido SÍ pasan por la matriz (`validarContraMatriz`, más abajo).
 */
function validar(d: DatosProfesor): string | null {
  if (!d.whatsapp.trim()) return "El WhatsApp identifica al profesor: cargalo.";
  if (d.estilos.length === 0) return "Elegí al menos un estilo.";
  if (d.tipo !== "activo" && d.tipo !== "externo") return "Tipo inválido.";
  return null;
}

async function guardarEstilos(profesorId: number, estilos: string[]): Promise<{ error?: string }> {
  const a = admin();
  const { error: errDel } = await a.from("profesor_estilos").delete().eq("profesor_id", profesorId);
  if (errDel) return { error: errDel.message };
  if (estilos.length === 0) return {};
  const { error } = await a
    .from("profesor_estilos")
    .insert(estilos.map((estilo) => ({ profesor_id: profesorId, estilo })));
  if (error) return { error: error.message };
  return {};
}

export async function crearProfesor(d: DatosProfesor): Promise<Resultado> {
  if (!(await tienePermiso("profesores", "crear"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const errMatriz = await validarContraMatriz("profesor", {
    nombre: !!d.nombre.trim(),
    apellido: !!d.apellido.trim(),
    ...presenteDesdeExtra(d),
  });
  if (errMatriz) return { error: errMatriz };

  const { contacto, error: errContacto } = await crearOReusarContactoPersona({
    nombre: d.nombre,
    apellido: d.apellido,
    whatsapp: d.whatsapp,
    email: d.email,
    sexo: d.sexo,
    reusarSiExiste: false,
  });
  if (errContacto || !contacto) return { error: errContacto ?? "No se pudo crear el contacto." };

  const { data: fila, error } = await admin()
    .from("profesores")
    .insert({
      contacto_id: contacto.id,
      tipo: d.tipo,
      tarifa_reemplazo: d.tarifa_reemplazo,
      usuario_id: d.usuario_id,
    })
    .select("id")
    .single();
  if (error || !fila) return { error: error ? mapearError(error) : "No se pudo crear el profesor." };

  const errEst = await guardarEstilos(fila.id, d.estilos);
  if (errEst.error) return { error: errEst.error };

  const errExtra = await guardarDatosExtra(contacto.id, d);
  if (errExtra.error) return { error: errExtra.error };

  revalidatePath("/profesores");
  return { ok: true };
}

export async function actualizarProfesor(
  id: number,
  d: DatosProfesor
): Promise<Resultado> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const errMatriz = await validarContraMatriz("profesor", {
    nombre: !!d.nombre.trim(),
    apellido: !!d.apellido.trim(),
    ...presenteDesdeExtra(d),
  });
  if (errMatriz) return { error: errMatriz };

  const { data: fila, error: errFila } = await admin().from("profesores").select("contacto_id").eq("id", id).single();
  if (errFila || !fila) return { error: errFila?.message ?? "Profesor no encontrado." };

  const errContacto = await actualizarContactoPersona(fila.contacto_id, {
    nombre: d.nombre,
    apellido: d.apellido,
    whatsapp: d.whatsapp,
    email: d.email,
    sexo: d.sexo,
  });
  if (errContacto.error) return { error: mapearError({ message: errContacto.error }) };

  const errExtra = await guardarDatosExtra(fila.contacto_id, d);
  if (errExtra.error) return { error: errExtra.error };

  const { error } = await admin()
    .from("profesores")
    .update({
      tipo: d.tipo,
      tarifa_reemplazo: d.tarifa_reemplazo,
      usuario_id: d.usuario_id,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: mapearError(error) };

  const errEst = await guardarEstilos(id, d.estilos);
  if (errEst.error) return { error: errEst.error };

  revalidatePath("/profesores");
  return { ok: true };
}

/** Cuenta las dependencias de un profesor (decide eliminar vs. desactivar).
 *  Por ahora solo existen asignaciones; comisiones/liquidaciones/sala llegan
 *  en 0007 y se suman acá cuando existan. */
async function contarDependencias(id: number): Promise<number> {
  const { count } = await admin()
    .from("asignaciones")
    .select("id", { count: "exact", head: true })
    .eq("profesor_id", id);
  return count ?? 0;
}

export async function eliminarODesactivarProfesor(id: number): Promise<Resultado> {
  if (!(await tienePermiso("profesores", "eliminar"))) return { error: "Sin permiso." };

  const deps = await contarDependencias(id);
  if (deps === 0) {
    const { error } = await admin().from("profesores").delete().eq("id", id);
    if (error) return { error: mapearError(error) };
    revalidatePath("/profesores");
    return { ok: true, accion: "eliminada" };
  }

  const { error } = await admin()
    .from("profesores")
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: mapearError(error) };
  revalidatePath("/profesores");
  return { ok: true, accion: "desactivada" };
}

export async function activarProfesor(id: number): Promise<Resultado> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  const { error } = await admin()
    .from("profesores")
    .update({ activo: true, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: mapearError(error) };
  revalidatePath("/profesores");
  return { ok: true };
}

// ── Asignaciones profesor×curso ───────────────────────────────────────

export async function crearAsignacion(
  cursoId: number,
  profesorId: number,
  pctIngresos: number,
  pctReferido: number
): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  if (!(pctIngresos >= 1 && pctIngresos <= 100))
    return { error: "El % sobre los ingresos tiene que estar entre 1 y 100." };
  if (!(pctReferido >= 0 && pctReferido <= 100))
    return { error: "El % por referido tiene que estar entre 0 y 100." };

  const a = admin();
  // Cierra la asignación vigente del curso (si hay) antes de insertar la nueva,
  // para no violar el índice de un solo titular vigente por curso.
  const hoy = new Date().toISOString().slice(0, 10);
  const { error: errCierre } = await a
    .from("asignaciones")
    .update({ hasta: hoy })
    .eq("curso_id", cursoId)
    .is("hasta", null);
  if (errCierre) return { error: errCierre.message };

  const { error } = await a.from("asignaciones").insert({
    curso_id: cursoId,
    profesor_id: profesorId,
    pct_ingresos: pctIngresos,
    pct_referido: pctReferido,
  });
  if (error) return { error: error.message };

  revalidatePath("/profesores");
  return { ok: true };
}

export async function cerrarAsignacion(id: number): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  const hoy = new Date().toISOString().slice(0, 10);
  const { error } = await admin()
    .from("asignaciones")
    .update({ hasta: hoy })
    .eq("id", id)
    .is("hasta", null);
  if (error) return { error: error.message };
  revalidatePath("/profesores");
  return { ok: true };
}

export async function eliminarAsignacion(id: number): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("profesores", "eliminar"))) return { error: "Sin permiso." };
  // Sin comisiones devengadas todavía (esa tabla llega en 0007): se elimina.
  const { error } = await admin().from("asignaciones").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/profesores");
  return { ok: true };
}
