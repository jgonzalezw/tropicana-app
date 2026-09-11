import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import ClienteVentas from "./ClienteVentas";
import type { PlanVenta } from "./ClienteInscribir";
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
      .select("id, nombre, cantidad_clases, precio, acceso_modo, clases_ilimitadas, ciclo_dias, acepta_prueba, prueba_cursos_max")
      .eq("tipo_servicio", "curso_regular")
      .eq("activo", true)
      .order("nombre"),
    supabase.from("plan_cursos").select("plan_id, curso_id"),
    supabase.from("catalogos").select("id").eq("clave", "canal_captacion").maybeSingle(),
    obtenerParametro("medios_pago"),
    obtenerParametro("dias_compromiso_pago"),
  ]);

  const cursosById = new Map<number, Curso>(((cursos as Curso[]) ?? []).map((c) => [c.id, c]));

  // Precio de prueba por curso: sin él, ese curso no se puede ofrecer a prueba.
  const { data: tarifasPrueba } = await supabase
    .from("curso_tarifas")
    .select("curso_id, precio")
    .eq("modalidad", "prueba");
  const precioPruebaPorCurso = new Map<number, number>(
    ((tarifasPrueba as { curso_id: number; precio: number }[]) ?? []).map((t) => [
      t.curso_id,
      Number(t.precio),
    ])
  );

  // Cursos por plan.
  const cursosPorPlan: Record<number, number[]> = {};
  for (const r of (planCursos as { plan_id: number; curso_id: number }[]) ?? [])
    (cursosPorPlan[r.plan_id] ??= []).push(r.curso_id);

  // Cursos que da acceso un plan segun su modo (todas / excepto / solo).
  const activos = (cursos as Curso[]) ?? [];
  function cursosDelPlan(planId: number, modo: string): Curso[] {
    const sel = cursosPorPlan[planId] ?? [];
    if (modo === "todas") return activos;
    if (modo === "excepto") return activos.filter((c) => !sel.includes(c.id));
    return sel.map((cid) => cursosById.get(cid)).filter((c): c is Curso => !!c);
  }

  // Planes vendibles con sus cursos resueltos.
  const planesVenta: PlanVenta[] = ((planes as {
    id: number;
    nombre: string;
    cantidad_clases: number | null;
    precio: number;
    acceso_modo: string;
    clases_ilimitadas: boolean;
    ciclo_dias: number | null;
    acepta_prueba: boolean;
    prueba_cursos_max: number | null;
  }[]) ?? [])
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      cantidadClases: p.cantidad_clases,
      precio: Number(p.precio),
      ilimitado: p.clases_ilimitadas,
      cicloDias: p.ciclo_dias,
      aceptaPrueba: p.acepta_prueba,
      pruebaCursosMax: Math.max(1, Number(p.prueba_cursos_max) || 1),
      cursos: cursosDelPlan(p.id, p.acceso_modo).map((c) => ({
        id: c.id,
        nombre: c.nombre,
        dias_semana: c.dias_semana,
        hora: c.hora,
        precioPrueba: precioPruebaPorCurso.get(c.id) ?? null,
      })),
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

  // Bonos de tolerancia pendientes de redimir, por alumno y plan.
  const { data: bonos } = await supabase
    .from("inscripciones")
    .select("alumno_id, plan_id, bono_generado")
    .eq("estado", "completada")
    .eq("bono_redimido", false)
    .gt("bono_generado", 0);
  const bonoPorAlumnoPlan: Record<number, Record<number, number>> = {};
  for (const b of (bonos as { alumno_id: number; plan_id: number | null; bono_generado: number }[]) ?? []) {
    if (b.plan_id == null) continue;
    (bonoPorAlumnoPlan[b.alumno_id] ??= {});
    bonoPorAlumnoPlan[b.alumno_id][b.plan_id] =
      (bonoPorAlumnoPlan[b.alumno_id][b.plan_id] ?? 0) + Math.max(0, Number(b.bono_generado));
  }

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
    <ClienteVentas
      alumnos={(alumnos as Alumno[]) ?? []}
      planes={planesVenta}
      diasCompromiso={Math.max(1, Number(diasCompromisoParam) || 30)}
      medios={medios}
      canales={canales}
      cursosPorAlumno={cursosPorAlumno}
      deudaPorAlumno={deudaPorAlumno}
      planesActivosPorAlumno={planesActivosPorAlumno}
      bonoPorAlumnoPlan={bonoPorAlumnoPlan}
    />
  );
}
