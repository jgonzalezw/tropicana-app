import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import ClienteAsistencia from "./ClienteAsistencia";
import type { Curso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaAsistencia() {
  if (!(await tienePermiso("asistencia", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [{ data: cursos }, { data: inscripciones }, faltasParam, deudaParam, puedeRetro] =
    await Promise.all([
      supabase.from("cursos").select("*").eq("activo", true).order("nombre"),
      supabase
        .from("inscripciones")
        .select("curso_id, alumno:alumnos(activo)")
        .eq("estado", "activa"),
      obtenerParametro("faltas_toleradas"),
      obtenerParametro("mostrar_deuda"),
      tienePermiso("asistencia", "editar"),
    ]);

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
      puedeRetro={puedeRetro}
    />
  );
}
