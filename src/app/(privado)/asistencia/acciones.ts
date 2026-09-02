"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerPerfilActual } from "@/lib/sesion";
import type { EntradaAsistencia } from "@/lib/tipos";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Marcas ya guardadas de una sesión (curso + fecha), para editar. */
export async function cargarSesion(
  cursoId: number,
  fecha: string
): Promise<{
  marcas: {
    alumnoId: number;
    inscripcionId: number | null;
    estado: "presente" | "ausente";
    apellido: string;
    nombre: string;
  }[];
}> {
  if (!(await tienePermiso("asistencia", "ver"))) return { marcas: [] };
  if (!ISO.test(fecha)) return { marcas: [] };

  const sb = await createClient();
  const { data: sesion } = await sb
    .from("sesiones")
    .select("id")
    .eq("curso_id", cursoId)
    .eq("fecha", fecha)
    .maybeSingle();
  if (!sesion) return { marcas: [] };

  const { data } = await sb
    .from("asistencias")
    .select("estado, inscripcion_id, alumno:alumnos(id, nombre, apellido)")
    .eq("sesion_id", sesion.id);

  const marcas = ((data as unknown as {
    estado: "presente" | "ausente";
    inscripcion_id: number | null;
    alumno: { id: number; nombre: string; apellido: string } | null;
  }[]) ?? [])
    .filter((r) => r.alumno)
    .map((r) => ({
      alumnoId: r.alumno!.id,
      inscripcionId: r.inscripcion_id,
      estado: r.estado,
      apellido: r.alumno!.apellido,
      nombre: r.alumno!.nombre,
    }));

  return { marcas };
}

export async function guardarAsistencia(
  e: EntradaAsistencia
): Promise<{ ok?: true; resumen?: string; error?: string }> {
  if (!(await tienePermiso("asistencia", "crear")))
    return { error: "No tenés permiso para registrar asistencia." };
  if (!ISO.test(e.fecha)) return { error: "Fecha inválida." };
  if (!e.marcas.length) return { error: "No hay nada marcado." };

  const perfil = await obtenerPerfilActual();
  const a = admin();

  // Curso válido.
  const { data: curso } = await a
    .from("cursos")
    .select("id")
    .eq("id", e.cursoId)
    .maybeSingle();
  if (!curso) return { error: "El curso no existe." };

  // Titular vigente del curso (asignación sin cerrar), si hay.
  const { data: asig } = await a
    .from("asignaciones")
    .select("profesor_id")
    .eq("curso_id", e.cursoId)
    .is("hasta", null)
    .maybeSingle();

  // Sesión: una por curso+fecha. Upsert para poder re-editar.
  const { data: sesion, error: errSesion } = await a
    .from("sesiones")
    .upsert(
      {
        curso_id: e.cursoId,
        fecha: e.fecha,
        profesor_id: asig?.profesor_id ?? null,
        registrado_por: perfil?.id ?? null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "curso_id,fecha" }
    )
    .select("id")
    .single();
  if (errSesion) return { error: errSesion.message };

  const filas = e.marcas.map((m) => ({
    sesion_id: sesion.id as number,
    alumno_id: m.alumnoId,
    inscripcion_id: m.inscripcionId,
    estado: m.estado,
  }));
  const { error: errAsis } = await a
    .from("asistencias")
    .upsert(filas, { onConflict: "sesion_id,alumno_id" });
  if (errAsis) return { error: errAsis.message };

  const presentes = e.marcas.filter((m) => m.estado === "presente").length;
  const ausentes = e.marcas.filter((m) => m.estado === "ausente").length;
  const plu = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

  revalidatePath("/asistencia");
  return {
    ok: true,
    resumen: `Asistencia guardada · ${plu(presentes, "presente", "presentes")} y ${plu(
      ausentes,
      "ausente",
      "ausentes"
    )}.`,
  };
}
