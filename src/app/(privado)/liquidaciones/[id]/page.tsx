import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import Comprobante, { type DatosComprobante } from "./Comprobante";

export const dynamic = "force-dynamic";

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

  const [{ data: prof }, { data: items }, { data: pagos }] = await Promise.all([
    sb.from("profesores").select("nombre, apellido, whatsapp").eq("id", liq.profesor_id).maybeSingle(),
    sb.from("liquidacion_items").select("descripcion, monto").eq("liquidacion_id", liquidacionId).order("id"),
    sb.from("pagos").select("fecha, monto, medio").eq("tipo", "pago").eq("liquidacion_id", liquidacionId).order("fecha"),
  ]);

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
    items: ((items as { descripcion: string | null; monto: number }[]) ?? []).map((i) => ({
      descripcion: i.descripcion ?? "—",
      monto: Number(i.monto),
    })),
    pagos: ((pagos as { fecha: string; monto: number; medio: string | null }[]) ?? []).map((p) => ({
      fecha: p.fecha,
      monto: Number(p.monto),
      medio: p.medio ?? "—",
    })),
  };

  return <Comprobante datos={datos} />;
}
