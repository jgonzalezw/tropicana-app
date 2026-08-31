"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import type { DatosCurso } from "@/lib/tipos";

type Resultado = { ok?: true; error?: string; accion?: "eliminado" | "desactivado" };

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

function validar(d: DatosCurso): string | null {
  if (!d.nombre.trim()) return "El nombre del curso es obligatorio.";
  if (d.dias_semana.length === 0) return "Elegí al menos un día de la semana.";
  if (!(d.precio_mensual >= 0)) return "El precio mensual no puede ser negativo.";
  return null;
}

const MODALIDADES = ["clase", "semana", "medio_mes"] as const;

/** Sincroniza las filas de curso_tarifas con lo cargado (upsert/borra). */
async function guardarTarifas(
  a: ReturnType<typeof admin>,
  cursoId: number,
  tarifas: DatosCurso["tarifas"]
) {
  const upserts = MODALIDADES.filter((m) => tarifas[m] != null).map((m) => ({
    curso_id: cursoId,
    modalidad: m,
    precio: tarifas[m],
  }));
  const borrar = MODALIDADES.filter((m) => tarifas[m] == null);

  if (upserts.length) {
    const { error } = await a
      .from("curso_tarifas")
      .upsert(upserts, { onConflict: "curso_id,modalidad" });
    if (error) return error.message;
  }
  if (borrar.length) {
    const { error } = await a
      .from("curso_tarifas")
      .delete()
      .eq("curso_id", cursoId)
      .in("modalidad", borrar);
    if (error) return error.message;
  }
  return null;
}

export async function crearCurso(d: DatosCurso): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "crear"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const a = admin();
  const { data, error } = await a
    .from("cursos")
    .insert({
      nombre: d.nombre.trim(),
      linea: d.linea.trim() || null,
      nivel: d.nivel.trim() || null,
      dias_semana: d.dias_semana,
      hora: d.hora,
      precio_mensual: d.precio_mensual,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const errT = await guardarTarifas(a, data.id as number, d.tarifas);
  if (errT) return { error: "El curso se creó, pero falló guardar tarifas: " + errT };

  revalidatePath("/cursos");
  return { ok: true };
}

export async function actualizarCurso(id: number, d: DatosCurso): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "editar"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const a = admin();
  const { error } = await a
    .from("cursos")
    .update({
      nombre: d.nombre.trim(),
      linea: d.linea.trim() || null,
      nivel: d.nivel.trim() || null,
      dias_semana: d.dias_semana,
      hora: d.hora,
      precio_mensual: d.precio_mensual,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const errT = await guardarTarifas(a, id, d.tarifas);
  if (errT) return { error: errT };

  revalidatePath("/cursos");
  return { ok: true };
}

/** Historial dependiente de un curso (por ahora solo asignaciones;
 *  inscripciones/cuotas llegan en 0006). Las tarifas son config, no historial. */
async function contarDependencias(id: number): Promise<number> {
  const { count } = await admin()
    .from("asignaciones")
    .select("id", { count: "exact", head: true })
    .eq("curso_id", id);
  return count ?? 0;
}

export async function eliminarODesactivarCurso(id: number): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "eliminar"))) return { error: "Sin permiso." };

  const deps = await contarDependencias(id);
  if (deps === 0) {
    // curso_tarifas se borra en cascada.
    const { error } = await admin().from("cursos").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/cursos");
    return { ok: true, accion: "eliminado" };
  }

  const { error } = await admin()
    .from("cursos")
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/cursos");
  return { ok: true, accion: "desactivado" };
}

export async function activarCurso(id: number): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "editar"))) return { error: "Sin permiso." };
  const { error } = await admin()
    .from("cursos")
    .update({ activo: true, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/cursos");
  return { ok: true };
}
