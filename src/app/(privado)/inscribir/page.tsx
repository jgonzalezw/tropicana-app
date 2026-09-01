import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import ClienteInscribir from "./ClienteInscribir";
import type { Alumno, Curso, TarifasCurso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaInscribir() {
  if (!(await tienePermiso("inscripciones", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [
    { data: alumnos },
    { data: cursos },
    { data: tarifaRows },
    { data: descRows },
    { data: catCanal },
    factorParam,
    mediosParam,
  ] = await Promise.all([
    supabase.from("alumnos").select("*").eq("activo", true).order("apellido").order("nombre"),
    supabase.from("cursos").select("*").eq("activo", true).order("nombre"),
    supabase.from("curso_tarifas").select("curso_id, modalidad, precio"),
    supabase.from("descuentos_adelanto").select("meses, porcentaje").order("meses"),
    supabase.from("catalogos").select("id").eq("clave", "canal_captacion").maybeSingle(),
    obtenerParametro("medio_mes_factor"),
    obtenerParametro("medios_pago"),
  ]);

  // Tarifas parciales por curso.
  const tarifas: Record<number, TarifasCurso> = {};
  for (const r of (tarifaRows as { curso_id: number; modalidad: string; precio: number }[]) ?? []) {
    const t = (tarifas[r.curso_id] ??= { clase: null, semana: null, medio_mes: null });
    if (r.modalidad === "clase") t.clase = r.precio;
    else if (r.modalidad === "semana") t.semana = r.precio;
    else if (r.modalidad === "medio_mes") t.medio_mes = r.precio;
  }

  // Descuento por meses adelantados (tabla B).
  const tablaDescuento: Record<number, number> = {};
  for (const r of (descRows as { meses: number; porcentaje: number }[]) ?? [])
    tablaDescuento[r.meses] = Number(r.porcentaje);

  // Canales de captación (para el alta rápida de alumno).
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

  // Estado por alumno: cursos activos y deuda pendiente (para el panel del alumno).
  const cursosNombre = new Map<number, string>(
    ((cursos as Curso[]) ?? []).map((c) => [c.id, c.nombre])
  );
  const [{ data: inscripciones }, { data: cuotas }, { data: pagos }] = await Promise.all([
    supabase
      .from("inscripciones")
      .select("id, alumno_id, curso_id, modalidad, estado")
      .eq("estado", "activa"),
    supabase.from("cuotas").select("id, inscripcion_id, monto_devengado, descuento_adelanto, estado"),
    supabase.from("pagos").select("cuota_id, monto, descuento").eq("tipo", "cobro"),
  ]);

  const inscById = new Map<number, { alumno_id: number; curso_id: number }>();
  const cursosPorAlumno: Record<number, string[]> = {};
  // Cursos con inscripción MENSUAL activa por alumno (para avisar del duplicado).
  const mensualPorAlumno: Record<number, number[]> = {};
  for (const i of (inscripciones as {
    id: number;
    alumno_id: number;
    curso_id: number;
    modalidad: string;
  }[]) ?? []) {
    inscById.set(i.id, { alumno_id: i.alumno_id, curso_id: i.curso_id });
    const nom = cursosNombre.get(i.curso_id);
    if (nom) (cursosPorAlumno[i.alumno_id] ??= []).push(nom);
    if (i.modalidad === "mensual") (mensualPorAlumno[i.alumno_id] ??= []).push(i.curso_id);
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
      cursos={(cursos as Curso[]) ?? []}
      tarifas={tarifas}
      tablaDescuento={tablaDescuento}
      factorMedio={Math.max(1, Number(factorParam) || 2)}
      medios={medios}
      canales={canales}
      cursosPorAlumno={cursosPorAlumno}
      deudaPorAlumno={deudaPorAlumno}
      mensualPorAlumno={mensualPorAlumno}
    />
  );
}
