import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import ClienteAsistencia from "./ClienteAsistencia";
import { compararPorApellido } from "@/lib/texto";
import type { AlumnoSesion, Curso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

type InscRow = {
  id: number;
  curso_id: number;
  modalidad: "mensual" | "clase" | "semana" | "medio_mes";
  clases_total: number | null;
  alumno: { id: number; nombre: string; apellido: string; activo: boolean } | null;
};

export default async function PaginaAsistencia() {
  if (!(await tienePermiso("asistencia", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [{ data: cursos }, { data: inscripciones }, { data: presentes }] = await Promise.all([
    supabase.from("cursos").select("*").eq("activo", true).order("nombre"),
    supabase
      .from("inscripciones")
      .select("id, curso_id, modalidad, clases_total, alumno:alumnos(id, nombre, apellido, activo)")
      .eq("estado", "activa"),
    supabase.from("asistencias").select("inscripcion_id").eq("estado", "presente"),
  ]);

  // Clases consumidas por inscripción parcial = asistencias 'presente'.
  const consumidas: Record<number, number> = {};
  for (const p of (presentes as { inscripcion_id: number | null }[]) ?? [])
    if (p.inscripcion_id != null) consumidas[p.inscripcion_id] = (consumidas[p.inscripcion_id] ?? 0) + 1;

  // Padrón por curso: alumnos con inscripción activa. Los parciales sin clases
  // restantes ya se consumieron y no aparecen (se pueden re-inscribir).
  const rosterPorCurso: Record<number, AlumnoSesion[]> = {};
  for (const r of (inscripciones as unknown as InscRow[]) ?? []) {
    if (!r.alumno || !r.alumno.activo) continue;
    const esMensual = r.modalidad === "mensual";
    const restantes = esMensual
      ? null
      : Math.max(0, (r.clases_total ?? 0) - (consumidas[r.id] ?? 0));
    if (!esMensual && restantes !== null && restantes <= 0) continue;
    (rosterPorCurso[r.curso_id] ??= []).push({
      inscripcionId: r.id,
      alumnoId: r.alumno.id,
      apellido: r.alumno.apellido,
      nombre: r.alumno.nombre,
      modalidad: r.modalidad,
      restantes,
    });
  }
  for (const id of Object.keys(rosterPorCurso))
    rosterPorCurso[Number(id)].sort(compararPorApellido);

  return (
    <ClienteAsistencia cursos={(cursos as Curso[]) ?? []} rosterPorCurso={rosterPorCurso} />
  );
}
