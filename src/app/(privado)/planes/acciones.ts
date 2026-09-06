"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import type { DatosPlan } from "@/lib/tipos";

type Resultado = { ok?: true; error?: string; accion?: "eliminado" | "desactivado" };

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

function validar(d: DatosPlan): string | null {
  if (!d.nombre.trim()) return "El nombre del plan es obligatorio.";
  if (!d.cursoIds || d.cursoIds.length === 0) return "Elegí al menos un curso.";
  if (d.cantidad_clases == null || !(d.cantidad_clases > 0))
    return "La cantidad de clases (N) debe ser mayor a 0.";
  if (!(d.precio >= 0)) return "El precio no puede ser negativo.";
  if (!(d.criterio_liquidacion >= 1 && d.criterio_liquidacion <= 4))
    return "Criterio de liquidación inválido.";
  return null;
}

/** Sincroniza plan_cursos con la lista de cursos elegida (agrega/borra). */
async function guardarCursos(
  a: ReturnType<typeof admin>,
  planId: number,
  cursoIds: number[]
): Promise<string | null> {
  const { data: actuales } = await a
    .from("plan_cursos")
    .select("curso_id")
    .eq("plan_id", planId);
  const tiene = new Set((actuales as { curso_id: number }[] | null ?? []).map((r) => r.curso_id));
  const quiere = new Set(cursoIds);

  const agregar = cursoIds.filter((c) => !tiene.has(c)).map((c) => ({ plan_id: planId, curso_id: c }));
  const borrar = [...tiene].filter((c) => !quiere.has(c));

  if (agregar.length) {
    const { error } = await a.from("plan_cursos").insert(agregar);
    if (error) return error.message;
  }
  if (borrar.length) {
    const { error } = await a
      .from("plan_cursos")
      .delete()
      .eq("plan_id", planId)
      .in("curso_id", borrar);
    if (error) return error.message;
  }
  return null;
}

export async function crearPlan(d: DatosPlan): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "crear"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const a = admin();
  const { data, error } = await a
    .from("planes")
    .insert({
      nombre: d.nombre.trim(),
      tipo_servicio: "curso_regular",
      modalidad: d.cursoIds.length > 1 ? "combo" : "mensual",
      curso_id: d.cursoIds[0], // curso principal (compat)
      cantidad_clases: d.cantidad_clases,
      precio: d.precio,
      criterio_liquidacion: d.criterio_liquidacion,
      tolerancia_faltas: d.tolerancia_faltas,
      renovable: true,
      activo: true,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const errC = await guardarCursos(a, data.id as number, d.cursoIds);
  if (errC) return { error: "El plan se creó, pero falló asociar los cursos: " + errC };

  revalidatePath("/planes");
  return { ok: true };
}

export async function actualizarPlan(id: number, d: DatosPlan): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "editar"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const a = admin();
  const { error } = await a
    .from("planes")
    .update({
      nombre: d.nombre.trim(),
      modalidad: d.cursoIds.length > 1 ? "combo" : "mensual",
      curso_id: d.cursoIds[0],
      cantidad_clases: d.cantidad_clases,
      precio: d.precio,
      criterio_liquidacion: d.criterio_liquidacion,
      tolerancia_faltas: d.tolerancia_faltas,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const errC = await guardarCursos(a, id, d.cursoIds);
  if (errC) return { error: errC };

  revalidatePath("/planes");
  return { ok: true };
}

/** Membresías (inscripciones) que usan el plan: con historial se desactiva. */
async function contarMembresias(a: ReturnType<typeof admin>, id: number): Promise<number> {
  const { count } = await a
    .from("inscripciones")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", id);
  return count ?? 0;
}

export async function eliminarODesactivarPlan(id: number): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "eliminar"))) return { error: "Sin permiso." };

  const a = admin();
  const membresias = await contarMembresias(a, id);
  if (membresias === 0) {
    // plan_cursos se borra en cascada.
    const { error } = await a.from("planes").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/planes");
    return { ok: true, accion: "eliminado" };
  }

  const { error } = await a
    .from("planes")
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/planes");
  return { ok: true, accion: "desactivado" };
}

export async function activarPlan(id: number): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "editar"))) return { error: "Sin permiso." };
  const { error } = await admin()
    .from("planes")
    .update({ activo: true, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/planes");
  return { ok: true };
}
