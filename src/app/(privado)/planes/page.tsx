import { createClient } from "@/lib/supabase/server";
import { obtenerParametro, tienePermiso } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClientePlanes from "./ClientePlanes";
import type { Curso, Plan, Estilo } from "@/lib/tipos";
import type { TarifasDeCurso } from "@/lib/precios";
import Pagina from "@/components/Pagina";

export const dynamic = "force-dynamic";

export default async function PaginaPlanes() {
  if (!(await tienePermiso("planes", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const toleranciaAcademia = Math.max(0, Number(await obtenerParametro("tolerancia_faltas")) || 0);
  const plazoAcademia = Math.max(0, Number(await obtenerParametro("prueba_plazo_dias")) || 7);
  const factorMedioMes = Math.max(1, Number(await obtenerParametro("medio_mes_factor")) || 2);
  const vigenciaMesesAcademia = Math.max(1, Number(await obtenerParametro("vencimiento_paquete_meses")) || 2);

  const [
    { data: planes },
    { data: cursos },
    { data: planCursos },
    { data: insc },
    { data: estilosRaw },
    { data: salasRaw },
    { data: planSalas },
  ] = await Promise.all([
    // Todos los tipos: la pantalla se abre a tipo_servicio (C3, hito H1) y
    // filtra por pestaña en el cliente, no en la consulta.
    supabase.from("planes").select("*").order("nombre"),
    supabase.from("cursos").select("*").eq("activo", true).order("nombre"),
    supabase.from("plan_cursos").select("plan_id, curso_id"),
    supabase.from("membresias").select("plan_id"),
    supabase.from("estilos").select("*").eq("activo", true).order("orden"),
    supabase.from("salas").select("*").eq("activa", true).eq("es_externa", false).order("orden"),
    supabase.from("plan_salas").select("plan_id, sala_id"),
  ]);

  // Tarifas parciales por curso: la referencia de precio estima el valor de
  // una clase desde el tramo que corresponde a la cantidad que se vende.
  const { data: tarifaRows } = await supabase
    .from("curso_tarifas")
    .select("curso_id, modalidad, precio");
  const tarifas: Record<number, TarifasDeCurso> = {};
  for (const t of (tarifaRows as { curso_id: number; modalidad: string; precio: number }[]) ?? []) {
    if (t.modalidad !== "clase" && t.modalidad !== "semana" && t.modalidad !== "medio_mes") continue;
    (tarifas[t.curso_id] ??= {})[t.modalidad] = Number(t.precio);
  }

  // Cursos por plan.
  const cursosPorPlan: Record<number, number[]> = {};
  for (const r of (planCursos as { plan_id: number; curso_id: number }[]) ?? [])
    (cursosPorPlan[r.plan_id] ??= []).push(r.curso_id);

  // Membresías por plan (para decidir eliminar vs desactivar).
  const deps: Record<number, number> = {};
  for (const r of (insc as { plan_id: number | null }[]) ?? [])
    if (r.plan_id != null) deps[r.plan_id] = (deps[r.plan_id] ?? 0) + 1;

  // Salas por plan (plan_salas, 0052).
  const salasPorPlan: Record<number, number[]> = {};
  for (const r of (planSalas as { plan_id: number; sala_id: number }[]) ?? [])
    (salasPorPlan[r.plan_id] ??= []).push(r.sala_id);

  const planesConCursos = ((planes as Plan[]) ?? []).map((p) => ({
    ...p,
    cursoIds: cursosPorPlan[p.id] ?? (p.curso_id != null ? [p.curso_id] : []),
    salaIds: salasPorPlan[p.id] ?? [],
  }));

  return (
    <Pagina ancho="6xl">
      <EncabezadoPagina
        titulo="Planes"
        descripcion="Lo que se vende: cada plan da acceso a uno o varios cursos, con su cantidad de clases (N) y precio por ciclo."
      />
      <ClientePlanes
        planes={planesConCursos}
        cursos={(cursos as Curso[]) ?? []}
        estilos={(estilosRaw as Estilo[]) ?? []}
        salas={(salasRaw as { id: number; nombre: string }[]) ?? []}
        deps={deps}
        toleranciaAcademia={toleranciaAcademia}
        plazoAcademia={plazoAcademia}
        tarifas={tarifas}
        factorMedioMes={factorMedioMes}
        vigenciaMesesAcademia={vigenciaMesesAcademia}
      />
    </Pagina>
  );
}
