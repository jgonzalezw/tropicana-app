import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import ClienteAsistencia from "./ClienteAsistencia";
import type { Curso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaAsistencia() {
  if (!(await tienePermiso("asistencia", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [
    { data: cursos },
    { data: inscripciones },
    faltasParam,
    deudaParam,
    semanasParam,
    puedeRetro,
  ] = await Promise.all([
    supabase.from("cursos").select("*").eq("activo", true).order("nombre"),
    supabase
      .from("inscripciones")
      .select("curso_id, alumno:alumnos(activo)")
      .eq("estado", "activa"),
    obtenerParametro("faltas_toleradas"),
    obtenerParametro("mostrar_deuda"),
    obtenerParametro("asistencia_semanas_retro"),
    tienePermiso("asistencia", "editar"),
  ]);

  // Ventana de carga retroactiva (semanas). Sin permiso de edición, solo hoy.
  const semanasRetro = Math.max(0, Number(semanasParam) || 2);
  const min = new Date();
  min.setDate(min.getDate() - (puedeRetro ? semanasRetro * 7 : 0));
  const minRetroIso = `${min.getFullYear()}-${String(min.getMonth() + 1).padStart(2, "0")}-${String(
    min.getDate()
  ).padStart(2, "0")}`;

  // Cuántos alumnos activos tiene cada curso (para el selector).
  const alumnosPorCurso: Record<number, number> = {};
  for (const r of (inscripciones as unknown as { curso_id: number; alumno: { activo: boolean } | null }[]) ?? [])
    if (r.alumno?.activo) alumnosPorCurso[r.curso_id] = (alumnosPorCurso[r.curso_id] ?? 0) + 1;

  return (
    <ClienteAsistencia
      cursos={(cursos as Curso[]) ?? []}
      alumnosPorCurso={alumnosPorCurso}
      faltasToleradas={Math.max(1, Number(faltasParam) || 2)}
      mostrarDeuda={deudaParam !== "false"}
      minRetroIso={minRetroIso}
    />
  );
}
