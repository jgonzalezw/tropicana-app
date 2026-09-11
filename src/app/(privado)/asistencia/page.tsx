import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import { exigir } from "@/lib/datos";
import ClienteAsistencia from "./ClienteAsistencia";
import type { Curso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaAsistencia() {
  if (!(await tienePermiso("asistencia", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const hoyIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const [
    { data: cursos },
    { data: inscripciones },
    deudaParam,
    semanasParam,
    puedeRetro,
  ] = await Promise.all([
    supabase.from("cursos").select("*").eq("activo", true).order("nombre"),
    supabase
      .from("inscripciones")
      .select(
        "id, curso_id, modalidad, clases_total, plan_id, clases_plan, fecha_fin, fecha_inicio, es_prueba, acompanantes, alumno:alumnos(activo)"
      )
      .eq("estado", "activa")
      .lte("fecha_inicio", hoyIso),
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

  type InscCard = {
    id: number;
    curso_id: number;
    modalidad: string;
    clases_total: number | null;
    plan_id: number | null;
    clases_plan: number | null;
    fecha_fin: string | null;
    es_prueba: boolean | null;
    acompanantes: number | null;
    alumno: { activo: boolean } | null;
  };
  const inscVigentes = ((inscripciones as unknown as InscCard[]) ?? []).filter((r) => r.alumno?.activo);

  // A qué cursos toca cada membresía. `inscripciones.curso_id` es solo el curso
  // principal de la venta: un plan multi-curso (o una prueba de varios cursos)
  // vive en `inscripcion_cursos`, y contando por `curso_id` el alumno quedaba
  // fuera del número de todos los demás cursos.
  const cursosDeInsc = new Map<number, number[]>();
  if (inscVigentes.length) {
    const icRows = exigir(
      await supabase
        .from("inscripcion_cursos")
        .select("inscripcion_id, curso_id")
        .in("inscripcion_id", inscVigentes.map((r) => r.id)),
      "los cursos de cada membresía"
    );
    for (const r of (icRows as { inscripcion_id: number; curso_id: number }[]) ?? []) {
      const ya = cursosDeInsc.get(r.inscripcion_id);
      if (ya) ya.push(r.curso_id);
      else cursosDeInsc.set(r.inscripcion_id, [r.curso_id]);
    }
  }

  // Paquetes por clase ya agotados (consumidas >= clases_total) no cuentan
  // como membresía vigente: hay que saber cuántas clases ya presenció cada
  // inscripción parcial.
  const inscParcialIds = inscVigentes.filter((r) => r.modalidad !== "mensual").map((r) => r.id);
  const consumidasParcial: Record<number, number> = {};
  if (inscParcialIds.length) {
    const data = exigir(
      await supabase
      .from("asistencias")
      .select("inscripcion_id")
        .eq("estado", "presente")
        .in("inscripcion_id", inscParcialIds),
      "las asistencias de los paquetes"
    );
    for (const x of (data as { inscripcion_id: number | null }[]) ?? [])
      if (x.inscripcion_id != null) consumidasParcial[x.inscripcion_id] = (consumidasParcial[x.inscripcion_id] ?? 0) + 1;
  }

  // Cuántos alumnos con membresía NO completada a hoy tiene cada curso: excluye
  // parciales que ya gastaron su paquete e ilimitados cuyo ciclo ya venció (los
  // planes de N clases completados ya salieron de "activa" solos, vía
  // recalcularMembresia, así que no hace falta filtrarlos acá de nuevo).
  const alumnosPorCurso: Record<number, number> = {};
  for (const r of inscVigentes) {
    if (r.modalidad !== "mensual") {
      const restantes = (r.clases_total ?? 0) - (consumidasParcial[r.id] ?? 0);
      if (restantes <= 0) continue;
    } else if (r.plan_id != null && r.clases_plan == null && r.fecha_fin != null && r.fecha_fin < hoyIso) {
      continue; // ilimitado vencido
    }
    // Una prueba grupal es una membresía que trae varias personas a la clase.
    const gente = 1 + Math.max(0, Number(r.acompanantes) || 0);
    for (const cursoId of cursosDeInsc.get(r.id) ?? [r.curso_id])
      alumnosPorCurso[cursoId] = (alumnosPorCurso[cursoId] ?? 0) + gente;
  }

  return (
    <ClienteAsistencia
      cursos={(cursos as Curso[]) ?? []}
      alumnosPorCurso={alumnosPorCurso}
      mostrarDeuda={deudaParam !== "false"}
      minRetroIso={minRetroIso}
      puedeEditar={puedeRetro}
    />
  );
}
