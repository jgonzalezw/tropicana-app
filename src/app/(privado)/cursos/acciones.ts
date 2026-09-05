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

/**
 * Mantiene el Plan Regular (mensual) del curso en sincronía con su config:
 * N = dias por semana x 4, precio = precio mensual. Lo crea si no existe.
 * Las membresias ya vendidas no se afectan (snapshot en clases_plan/precio_aplicado).
 */
async function sincronizarPlanRegular(
  a: ReturnType<typeof admin>,
  cursoId: number,
  nombreCurso: string,
  diasSemana: number[],
  precioMensual: number
): Promise<string | null> {
  const n = diasSemana.length ? diasSemana.length * 4 : null;
  const nombrePlan = `Plan Regular - ${nombreCurso}`;

  const { data: existente } = await a
    .from("planes")
    .select("id")
    .eq("curso_id", cursoId)
    .eq("tipo_servicio", "curso_regular")
    .eq("modalidad", "mensual")
    .order("id")
    .limit(1)
    .maybeSingle();

  if (existente) {
    const { error } = await a
      .from("planes")
      .update({
        nombre: nombrePlan,
        cantidad_clases: n,
        precio: precioMensual,
        activo: true,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", existente.id);
    return error?.message ?? null;
  }

  const { error } = await a.from("planes").insert({
    nombre: nombrePlan,
    tipo_servicio: "curso_regular",
    modalidad: "mensual",
    curso_id: cursoId,
    cantidad_clases: n,
    precio: precioMensual,
    criterio_liquidacion: 1,
    tolerancia_faltas: null,
    renovable: true,
    activo: true,
  });
  return error?.message ?? null;
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

  const errP = await sincronizarPlanRegular(a, data.id as number, d.nombre.trim(), d.dias_semana, d.precio_mensual);
  if (errP) return { error: "El curso se creó, pero falló crear el Plan Regular: " + errP };

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

  const errP = await sincronizarPlanRegular(a, id, d.nombre.trim(), d.dias_semana, d.precio_mensual);
  if (errP) return { error: "El curso se guardó, pero falló actualizar el Plan Regular: " + errP };

  revalidatePath("/cursos");
  return { ok: true };
}

/** Historial dependiente de un curso: asignaciones y membresias (inscripciones).
 *  Con eso >0 el curso se desactiva en vez de borrarse. El Plan Regular
 *  auto-creado no cuenta (se borra junto al curso si esta vacio). */
async function contarDependencias(id: number): Promise<number> {
  const a = admin();
  const [{ count: asig }, { count: insc }] = await Promise.all([
    a.from("asignaciones").select("id", { count: "exact", head: true }).eq("curso_id", id),
    a.from("inscripciones").select("id", { count: "exact", head: true }).eq("curso_id", id),
  ]);
  return (asig ?? 0) + (insc ?? 0);
}

export async function eliminarODesactivarCurso(id: number): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "eliminar"))) return { error: "Sin permiso." };

  const a = admin();
  const deps = await contarDependencias(id);
  if (deps === 0) {
    // Sin membresias: se borra el Plan Regular vacio (FK restrict) y el curso.
    // curso_tarifas se borra en cascada.
    const { error: errPlan } = await a.from("planes").delete().eq("curso_id", id);
    if (errPlan) return { error: errPlan.message };
    const { error } = await a.from("cursos").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/cursos");
    return { ok: true, accion: "eliminado" };
  }

  const { error } = await a
    .from("cursos")
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  // El plan sigue la vigencia del curso.
  await a
    .from("planes")
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq("curso_id", id)
    .eq("tipo_servicio", "curso_regular");
  revalidatePath("/cursos");
  return { ok: true, accion: "desactivado" };
}

export async function activarCurso(id: number): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "editar"))) return { error: "Sin permiso." };
  const a = admin();
  const { error } = await a
    .from("cursos")
    .update({ activo: true, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  await a
    .from("planes")
    .update({ activo: true, actualizado_en: new Date().toISOString() })
    .eq("curso_id", id)
    .eq("tipo_servicio", "curso_regular")
    .eq("modalidad", "mensual");
  revalidatePath("/cursos");
  return { ok: true };
}
