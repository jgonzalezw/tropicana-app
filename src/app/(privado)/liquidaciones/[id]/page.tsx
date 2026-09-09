import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import Comprobante, { type DatosComprobante } from "./Comprobante";

export const dynamic = "force-dynamic";

const ETIQUETA_TIPO_SERVICIO: Record<string, string> = {
  curso_regular: "Curso regular",
  taller: "Taller",
  particular: "Particular",
  alquiler: "Alquiler de sala",
  prueba: "Clase de prueba",
};

export default async function PaginaComprobante({ params }: { params: Promise<{ id: string }> }) {
  if (!(await tienePermiso("comisiones", "ver"))) return <SinAcceso />;
  const { id } = await params;
  const liquidacionId = Number(id);
  if (!Number.isFinite(liquidacionId)) return <SinAcceso />;

  const sb = await createClient();
  const { data: liq } = await sb
    .from("liquidaciones")
    .select("id, profesor_id, periodo, periodicidad, estado, total_devengado, total_pagado, neto, creado_en")
    .eq("id", liquidacionId)
    .maybeSingle();
  if (!liq) return <div className="p-8">La liquidación no existe.</div>;

  const [{ data: prof }, { data: comis }, { data: pagosLiq }] = await Promise.all([
    sb.from("profesores").select("nombre, apellido, whatsapp").eq("id", liq.profesor_id).maybeSingle(),
    sb.from("comisiones_devengadas").select("id, membresia_id, base, monto").eq("liquidacion_id", liquidacionId).order("id"),
    sb.from("pagos").select("fecha, monto, medio, motivo").eq("tipo", "pago").eq("liquidacion_id", liquidacionId).order("fecha"),
  ]);

  const comisiones = (comis as { id: number; membresia_id: number | null; base: number; monto: number }[]) ?? [];
  const membresiaIds = [...new Set(comisiones.map((c) => c.membresia_id).filter((x): x is number => x != null))];

  const inscById = new Map<
    number,
    {
      alumno_id: number; curso_id: number; plan_id: number | null; fecha_inicio: string | null;
      fecha_fin: string | null; clases_plan: number | null; clases_hechas: number | null;
    }
  >();
  const corrSuspPorInsc: Record<number, number> = {};
  const faltasConLicPorInsc: Record<number, number> = {};
  const faltasSinLicPorInsc: Record<number, number> = {};
  const alNombre = new Map<number, string>();
  const cuNombre = new Map<number, string>();
  const planNombre = new Map<number, string>();
  const planTipo = new Map<number, string>();
  // Por membresía: valor total (precio), descuento, motivos, cobrado (plata).
  const totalPorInsc: Record<number, number> = {};
  const descPorInsc: Record<number, number> = {};
  const cobradoPorInsc: Record<number, number> = {};
  const motivosPorInsc: Record<number, Set<string>> = {};

  if (membresiaIds.length) {
    const [{ data: insc }, { data: corr }, { data: cuotas }, { data: asis }] = await Promise.all([
      sb.from("inscripciones").select("id, alumno_id, curso_id, plan_id, fecha_inicio, fecha_fin, clases_plan, clases_hechas").in("id", membresiaIds),
      sb.from("corrimientos_ciclo").select("inscripcion_id, tipo").in("inscripcion_id", membresiaIds),
      sb.from("cuotas").select("id, inscripcion_id, monto_devengado, descuento_adelanto").in("inscripcion_id", membresiaIds),
      sb.from("asistencias").select("inscripcion_id, sesion_id, estado, con_licencia").in("inscripcion_id", membresiaIds),
    ]);
    for (const r of (insc as {
      id: number; alumno_id: number; curso_id: number; plan_id: number | null; fecha_inicio: string | null;
      fecha_fin: string | null; clases_plan: number | null; clases_hechas: number | null;
    }[]) ?? [])
      inscById.set(r.id, r);
    // Corrimientos: en el comprobante solo cuentan los de SUSPENSION (la falta con
    // licencia se muestra aparte como bono; la falta sin licencia no corre nada).
    for (const r of (corr as { inscripcion_id: number | null; tipo: string | null }[]) ?? [])
      if (r.inscripcion_id != null && r.tipo === "suspension")
        corrSuspPorInsc[r.inscripcion_id] = (corrSuspPorInsc[r.inscripcion_id] ?? 0) + 1;

    // Faltas del ciclo (solo sobre sesiones dictadas), separadas por licencia.
    const asisRows =
      (asis as { inscripcion_id: number | null; sesion_id: number; estado: string; con_licencia: boolean }[]) ?? [];
    const sesAusIds = [...new Set(asisRows.filter((r) => r.estado === "ausente").map((r) => r.sesion_id))];
    const dictadas = new Set<number>();
    if (sesAusIds.length) {
      const { data: ses } = await sb.from("sesiones").select("id, estado").in("id", sesAusIds);
      for (const s of (ses as { id: number; estado: string }[]) ?? [])
        if (s.estado === "dictada") dictadas.add(s.id);
    }
    for (const r of asisRows) {
      if (r.inscripcion_id == null || r.estado !== "ausente" || !dictadas.has(r.sesion_id)) continue;
      // La licencia (bono de tolerancia) solo existe en planes con N; un plan
      // ilimitado nunca bonifica, aunque la fila tenga con_licencia=true (dato
      // viejo de antes de ocultar esa opcion para ilimitados).
      const esIlimitado = inscById.get(r.inscripcion_id)?.clases_plan == null;
      if (r.con_licencia && !esIlimitado)
        faltasConLicPorInsc[r.inscripcion_id] = (faltasConLicPorInsc[r.inscripcion_id] ?? 0) + 1;
      else faltasSinLicPorInsc[r.inscripcion_id] = (faltasSinLicPorInsc[r.inscripcion_id] ?? 0) + 1;
    }

    const cuotaRows = (cuotas as { id: number; inscripcion_id: number; monto_devengado: number; descuento_adelanto: number }[]) ?? [];
    const cuotaToInsc = new Map<number, number>();
    for (const c of cuotaRows) {
      cuotaToInsc.set(c.id, c.inscripcion_id);
      totalPorInsc[c.inscripcion_id] = (totalPorInsc[c.inscripcion_id] ?? 0) + Number(c.monto_devengado);
      const da = Number(c.descuento_adelanto);
      if (da > 0) {
        descPorInsc[c.inscripcion_id] = (descPorInsc[c.inscripcion_id] ?? 0) + da;
        (motivosPorInsc[c.inscripcion_id] ??= new Set()).add("adelanto");
      }
    }
    const cuotaIds = cuotaRows.map((c) => c.id);
    if (cuotaIds.length) {
      const { data: pagosCobro } = await sb
        .from("pagos")
        .select("cuota_id, monto, descuento, descuento_motivo")
        .eq("tipo", "cobro")
        .in("cuota_id", cuotaIds);
      for (const p of (pagosCobro as { cuota_id: number | null; monto: number; descuento: number; descuento_motivo: string | null }[]) ?? []) {
        if (p.cuota_id == null) continue;
        const insId = cuotaToInsc.get(p.cuota_id);
        if (insId == null) continue;
        cobradoPorInsc[insId] = (cobradoPorInsc[insId] ?? 0) + Number(p.monto);
        const d = Number(p.descuento);
        if (d > 0) {
          descPorInsc[insId] = (descPorInsc[insId] ?? 0) + d;
          if (p.descuento_motivo?.trim()) (motivosPorInsc[insId] ??= new Set()).add(p.descuento_motivo.trim());
        }
      }
    }

    const alIds = [...new Set([...inscById.values()].map((i) => i.alumno_id))];
    const cuIds = [...new Set([...inscById.values()].map((i) => i.curso_id))];
    const planIds = [...new Set([...inscById.values()].map((i) => i.plan_id).filter((x): x is number => x != null))];
    const [{ data: al }, { data: cu }, { data: pl }] = await Promise.all([
      sb.from("alumnos").select("id, nombre, apellido").in("id", alIds),
      sb.from("cursos").select("id, nombre").in("id", cuIds),
      planIds.length
        ? sb.from("planes").select("id, nombre, tipo_servicio").in("id", planIds)
        : Promise.resolve({ data: [] }),
    ]);
    for (const a of (al as { id: number; nombre: string; apellido: string }[]) ?? [])
      alNombre.set(a.id, `${a.apellido}, ${a.nombre}`);
    for (const c of (cu as { id: number; nombre: string }[]) ?? []) cuNombre.set(c.id, c.nombre);
    for (const p of (pl as { id: number; nombre: string; tipo_servicio: string }[]) ?? []) {
      planNombre.set(p.id, p.nombre);
      planTipo.set(p.id, p.tipo_servicio);
    }
  }

  const items: DatosComprobante["items"] = comisiones.map((c) => {
    const mid = c.membresia_id;
    const i = mid != null ? inscById.get(mid) : undefined;
    const base = Number(c.base);
    const monto = Number(c.monto);
    return {
      alumno: i ? alNombre.get(i.alumno_id) ?? `#${i.alumno_id}` : "—",
      curso: i ? cuNombre.get(i.curso_id) ?? `#${i.curso_id}` : "—",
      plan: i?.plan_id != null ? planNombre.get(i.plan_id) ?? `#${i.plan_id}` : "—",
      tipoServicio: ETIQUETA_TIPO_SERVICIO[i?.plan_id != null ? planTipo.get(i.plan_id) ?? "" : ""] ?? "—",
      cicloInicio: i?.fecha_inicio ?? null,
      cicloFin: i?.fecha_fin ?? null,
      clasesPlan: i?.clases_plan ?? null,
      clasesHechas: i?.clases_hechas ?? null,
      faltasConLic: mid != null ? faltasConLicPorInsc[mid] ?? 0 : 0,
      faltasSinLic: mid != null ? faltasSinLicPorInsc[mid] ?? 0 : 0,
      corrSuspension: mid != null ? corrSuspPorInsc[mid] ?? 0 : 0,
      valorTotal: mid != null ? totalPorInsc[mid] ?? base : base,
      descuento: mid != null ? descPorInsc[mid] ?? 0 : 0,
      motivo: mid != null ? [...(motivosPorInsc[mid] ?? [])].join(", ") : "",
      cobrado: mid != null ? cobradoPorInsc[mid] ?? base : base,
      pct: base > 0 ? Math.round((monto / base) * 100) : 0,
      monto,
    };
  });

  const datos: DatosComprobante = {
    id: liq.id as number,
    profesor: prof ? `${prof.nombre} ${prof.apellido}` : `#${liq.profesor_id}`,
    whatsapp: (prof?.whatsapp as string | null) ?? null,
    periodo: liq.periodo as string,
    periodicidad: liq.periodicidad as string,
    estado: liq.estado as string,
    totalDevengado: Number(liq.total_devengado),
    totalPagado: Number(liq.total_pagado),
    neto: Number(liq.neto),
    creadoEn: liq.creado_en as string,
    items,
    pagos: ((pagosLiq as { fecha: string; monto: number; medio: string | null; motivo: string | null }[]) ?? []).map((p) => ({
      fecha: p.fecha,
      monto: Number(p.monto),
      medio: p.medio ?? "—",
      concepto: p.motivo === "liquidacion" ? "Pago de liquidación" : p.motivo ?? "Pago",
    })),
  };

  return <Comprobante datos={datos} />;
}
