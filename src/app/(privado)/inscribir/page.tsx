import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import ClienteInscribir, { type PlanVenta } from "./ClienteInscribir";
import type { Alumno, Curso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaInscribir() {
  if (!(await tienePermiso("inscripciones", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [
    { data: alumnos },
    { data: cursos },
    { data: planes },
    { data: planCursos },
    { data: catCanal },
    mediosParam,
    diasCompromisoParam,
  ] = await Promise.all([
    supabase.from("alumnos").select("*").eq("activo", true).order("apellido").order("nombre"),
    supabase.from("cursos").select("*").eq("activo", true).order("nombre"),
    supabase
      .from("planes")
      .select("id, nombre, cantidad_clases, precio")
      .eq("tipo_servicio", "curso_regular")
      .eq("activo", true)
      .order("nombre"),
    supabase.from("plan_cursos").select("plan_id, curso_id"),
    supabase.from("catalogos").select("id").eq("clave", "canal_captacion").maybeSingle(),
    obtenerParametro("medios_pago"),
    obtenerParametro("dias_compromiso_pago"),
  ]);

  const cursosById = new Map<number, Curso>(((cursos as Curso[]) ?? []).map((c) => [c.id, c]));

  // Cursos por plan.
  const cursosPorPlan: Record<number, number[]> = {};
  for (const r of (planCursos as { plan_id: number; curso_id: number }[]) ?? [])
    (cursosPorPlan[r.plan_id] ??= []).push(r.curso_id);

  // Planes vendibles con sus cursos (solo cursos activos que existan).
  const planesVenta: PlanVenta[] = ((planes as {
    id: number;
    nombre: string;
    cantidad_clases: number | null;
    precio: number;
  }[]) ?? [])
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      cantidadClases: p.cantidad_clases,
      precio: Number(p.precio),
      cursos: (cursosPorPlan[p.id] ?? [])
        .map((cid) => cursosById.get(cid))
        .filter((c): c is Curso => !!c)
        .map((c) => ({ id: c.id, nombre: c.nombre, dias_semana: c.dias_semana, hora: c.hora })),
    }))
    .filter((p) => p.cursos.length > 0);

  // Canales de captación (alta rápida de alumno).
  let canales: { valor: string; etiqueta: string }[] = [];
  if (catCanal?.id) {
    const { data: valores } = await supabase
      .from("catalogo_valores")
      .select("valor, etiqueta")
      .eq("catalogo_id", catCanal.id)
      .eq("activo", true)
      .order("orden");
    canales = (valores as { valor: string; etiqueta: string }[]) ?? [];
  }

  // Panel del alumno: cursos activos y deuda pendiente + planes activos (dup).
  const [{ data: inscripciones }, { data: cuotas }, { data: pagos }] = await Promise.all([
    supabase.from("inscripciones").select("id, alumno_id, curso_id, plan_id, estado").eq("estado", "activa"),
    supabase.from("cuotas").select("id, inscripcion_id, monto_devengado, descuento_adelanto, estado"),
    supabase.from("pagos").select("cuota_id, monto, descuento").eq("tipo", "cobro"),
  ]);

  const inscById = new Map<number, { alumno_id: number }>();
  const cursosPorAlumno: Record<number, string[]> = {};
  const planesActivosPorAlumno: Record<number, number[]> = {};
  for (const i of (inscripciones as {
    id: number;
    alumno_id: number;
    curso_id: number;
    plan_id: number | null;
    estado: string;
  }[]) ?? []) {
    inscById.set(i.id, { alumno_id: i.alumno_id });
    const nom = cursosById.get(i.curso_id)?.nombre;
    if (nom) (cursosPorAlumno[i.alumno_id] ??= []).push(nom);
    if (i.plan_id != null) (planesActivosPorAlumno[i.alumno_id] ??= []).push(i.plan_id);
  }

  const pagadoPorCuota: Record<number, number> = {};
  for (const p of (pagos as { cuota_id: number | null; monto: number; descuento: number }[]) ?? []) {
    if (p.cuota_id == null) continue;
    pagadoPorCuota[p.cuota_id] = (pagadoPorCuota[p.cuota_id] ?? 0) + Number(p.monto) + Number(p.descuento);
  }
  const deudaPorAlumno: Record<number, number> = {};
  for (const q of (cuotas as {
    id: number;
    inscripcion_id: number;
    monto_devengado: number;
    descuento_adelanto: number;
    estado: string;
  }[]) ?? []) {
    if (q.estado === "pagada") continue;
    const insc = inscById.get(q.inscripcion_id);
    if (!insc) continue;
    const efectivo = Math.max(0, Number(q.monto_devengado) - Number(q.descuento_adelanto));
    const saldo = Math.max(0, efectivo - (pagadoPorCuota[q.id] ?? 0));
    if (saldo > 0) deudaPorAlumno[insc.alumno_id] = (deudaPorAlumno[insc.alumno_id] ?? 0) + saldo;
  }

  const medios = (mediosParam ?? "Efectivo,QR / transf.,Otro")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <ClienteInscribir
      alumnos={(alumnos as Alumno[]) ?? []}
      planes={planesVenta}
      diasCompromiso={Math.max(1, Number(diasCompromisoParam) || 30)}
      medios={medios}
      canales={canales}
      cursosPorAlumno={cursosPorAlumno}
      deudaPorAlumno={deudaPorAlumno}
      planesActivosPorAlumno={planesActivosPorAlumno}
    />
  );
}
