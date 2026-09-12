import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClienteCursos from "./ClienteCursos";
import type { Curso, TarifasCurso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaCursos() {
  if (!(await tienePermiso("cursos", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [
    { data: cursos },
    { data: tarifasRows },
    { data: asigRows },
    especialidadesParam,
    duracionParam,
  ] = await Promise.all([
      supabase.from("cursos").select("*").order("nombre"),
      supabase.from("curso_tarifas").select("curso_id, modalidad, precio"),
      supabase.from("asignaciones").select("curso_id"),
      obtenerParametro("especialidades"),
      obtenerParametro("duracion_clase_min"),
    ]);

  const tarifas: Record<number, TarifasCurso> = {};
  for (const r of (tarifasRows as { curso_id: number; modalidad: string; precio: number }[]) ?? []) {
    const t = (tarifas[r.curso_id] ??= {
      clase: null,
      semana: null,
      medio_mes: null,
      prueba: null,
    });
    if (r.modalidad === "clase") t.clase = r.precio;
    else if (r.modalidad === "semana") t.semana = r.precio;
    else if (r.modalidad === "medio_mes") t.medio_mes = r.precio;
    else if (r.modalidad === "prueba") t.prueba = r.precio;
  }

  const deps: Record<number, number> = {};
  for (const a of (asigRows as { curso_id: number }[]) ?? []) {
    deps[a.curso_id] = (deps[a.curso_id] ?? 0) + 1;
  }

  // Duración propuesta para un curso nuevo: del parámetro, no del código.
  const duracionPorDefecto = Math.max(1, Number(duracionParam) || 60);

  const especialidades = (especialidadesParam ?? "Salsa,Bachata,Zumba,Urbano,Heels")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="p-8 max-w-6xl">
      <EncabezadoPagina
        titulo="Cursos"
        descripcion="Los cursos de la escuela, su precio mensual y las tarifas parciales (una clase, una semana, medio mes)."
      />
      <ClienteCursos
        cursos={(cursos as Curso[]) ?? []}
        tarifas={tarifas}
        deps={deps}
        especialidades={especialidades}
        duracionPorDefecto={duracionPorDefecto}
      />
    </div>
  );
}
