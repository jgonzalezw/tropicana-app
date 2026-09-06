import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClientePlanes from "./ClientePlanes";
import type { Curso, Plan } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaPlanes() {
  if (!(await tienePermiso("cursos", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [{ data: planes }, { data: cursos }, { data: planCursos }, { data: insc }] =
    await Promise.all([
      supabase.from("planes").select("*").eq("tipo_servicio", "curso_regular").order("nombre"),
      supabase.from("cursos").select("*").eq("activo", true).order("nombre"),
      supabase.from("plan_cursos").select("plan_id, curso_id"),
      supabase.from("inscripciones").select("plan_id"),
    ]);

  // Cursos por plan.
  const cursosPorPlan: Record<number, number[]> = {};
  for (const r of (planCursos as { plan_id: number; curso_id: number }[]) ?? [])
    (cursosPorPlan[r.plan_id] ??= []).push(r.curso_id);

  // Membresías por plan (para decidir eliminar vs desactivar).
  const deps: Record<number, number> = {};
  for (const r of (insc as { plan_id: number | null }[]) ?? [])
    if (r.plan_id != null) deps[r.plan_id] = (deps[r.plan_id] ?? 0) + 1;

  const planesConCursos = ((planes as Plan[]) ?? []).map((p) => ({
    ...p,
    cursoIds: cursosPorPlan[p.id] ?? (p.curso_id != null ? [p.curso_id] : []),
  }));

  return (
    <div className="p-8 max-w-6xl">
      <EncabezadoPagina
        titulo="Planes"
        descripcion="Lo que se vende: cada plan da acceso a uno o varios cursos, con su cantidad de clases (N) y precio por ciclo."
      />
      <ClientePlanes
        planes={planesConCursos}
        cursos={(cursos as Curso[]) ?? []}
        deps={deps}
      />
    </div>
  );
}
