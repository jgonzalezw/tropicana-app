"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual } from "@/lib/sesion";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}
type Admin = ReturnType<typeof admin>;

function primerDiaMesISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── Cálculo de devengos criterio 1 (membresías cobradas + completadas) ────
// Base = plata efectivamente cobrada de la membresía; monto = pct_ingresos del
// profesor asignado al curso x base. Solo membresías de 1 curso (v1).

export type DevengoPendiente = {
  membresiaId: number;
  profesorId: number;
  cursoId: number;
  alumno: string;
  curso: string;
  base: number;
  pct: number;
  monto: number;
};

async function calcularPendientes(
  sb: Awaited<ReturnType<typeof createClient>>
): Promise<DevengoPendiente[]> {
  // 1. Membresías completadas (de plan, 1 curso).
  const { data: insc } = await sb
    .from("inscripciones")
    .select("id, alumno_id, curso_id, plan_id, estado")
    .eq("estado", "completada")
    .not("plan_id", "is", null);
  const membresias = (insc as {
    id: number;
    alumno_id: number;
    curso_id: number;
    plan_id: number | null;
  }[]) ?? [];
  if (membresias.length === 0) return [];
  const inscIds = membresias.map((m) => m.id);

  // 2. Ya devengadas (excluir).
  const { data: comis } = await sb
    .from("comisiones_devengadas")
    .select("membresia_id")
    .in("membresia_id", inscIds);
  const yaDevengada = new Set(
    ((comis as { membresia_id: number | null }[]) ?? []).map((c) => c.membresia_id)
  );

  // 3. Cuotas y pagos → saldo y plata cobrada por membresía.
  const { data: cuotas } = await sb
    .from("cuotas")
    .select("id, inscripcion_id, monto_devengado, descuento_adelanto")
    .in("inscripcion_id", inscIds);
  const cuotaRows = (cuotas as {
    id: number;
    inscripcion_id: number;
    monto_devengado: number;
    descuento_adelanto: number;
  }[]) ?? [];
  const cuotaIds = cuotaRows.map((c) => c.id);
  const pagadoPorCuota: Record<number, number> = {};
  const plataPorCuota: Record<number, number> = {};
  if (cuotaIds.length) {
    const { data: pagos } = await sb
      .from("pagos")
      .select("cuota_id, monto, descuento")
      .eq("tipo", "cobro")
      .in("cuota_id", cuotaIds);
    for (const p of (pagos as { cuota_id: number | null; monto: number; descuento: number }[]) ?? []) {
      if (p.cuota_id == null) continue;
      plataPorCuota[p.cuota_id] = (plataPorCuota[p.cuota_id] ?? 0) + Number(p.monto);
      pagadoPorCuota[p.cuota_id] = (pagadoPorCuota[p.cuota_id] ?? 0) + Number(p.monto) + Number(p.descuento);
    }
  }
  const saldoPorInsc: Record<number, number> = {};
  const basePorInsc: Record<number, number> = {};
  for (const c of cuotaRows) {
    const efectivo = Math.max(0, Number(c.monto_devengado) - Number(c.descuento_adelanto));
    const saldo = Math.max(0, efectivo - (pagadoPorCuota[c.id] ?? 0));
    saldoPorInsc[c.inscripcion_id] = (saldoPorInsc[c.inscripcion_id] ?? 0) + saldo;
    basePorInsc[c.inscripcion_id] = (basePorInsc[c.inscripcion_id] ?? 0) + (plataPorCuota[c.id] ?? 0);
  }

  // 4. Asignación vigente por curso (profesor + pct).
  const cursoIds = [...new Set(membresias.map((m) => m.curso_id))];
  const { data: asig } = await sb
    .from("asignaciones")
    .select("curso_id, profesor_id, pct_ingresos, desde")
    .in("curso_id", cursoIds)
    .is("hasta", null)
    .order("desde", { ascending: false });
  const asigPorCurso = new Map<number, { profesor_id: number; pct: number }>();
  for (const r of (asig as { curso_id: number; profesor_id: number; pct_ingresos: number }[]) ?? [])
    if (!asigPorCurso.has(r.curso_id))
      asigPorCurso.set(r.curso_id, { profesor_id: r.profesor_id, pct: Number(r.pct_ingresos) });

  // 5. Nombres.
  const alumnoIds = [...new Set(membresias.map((m) => m.alumno_id))];
  const { data: al } = await sb.from("alumnos").select("id, nombre, apellido").in("id", alumnoIds);
  const alNombre = new Map(
    ((al as { id: number; nombre: string; apellido: string }[]) ?? []).map((a) => [a.id, `${a.apellido}, ${a.nombre}`])
  );
  const { data: cu } = await sb.from("cursos").select("id, nombre").in("id", cursoIds);
  const cuNombre = new Map(((cu as { id: number; nombre: string }[]) ?? []).map((c) => [c.id, c.nombre]));

  // 6. Armar pendientes: completada + cobrada (saldo 0) + con asignación + no devengada.
  const out: DevengoPendiente[] = [];
  for (const m of membresias) {
    if (yaDevengada.has(m.id)) continue;
    if ((saldoPorInsc[m.id] ?? 0) > 0) continue; // no cobrada
    const a = asigPorCurso.get(m.curso_id);
    if (!a) continue; // sin profesor asignado
    const base = basePorInsc[m.id] ?? 0;
    const monto = Math.round((base * a.pct) / 100);
    out.push({
      membresiaId: m.id,
      profesorId: a.profesor_id,
      cursoId: m.curso_id,
      alumno: alNombre.get(m.alumno_id) ?? `#${m.alumno_id}`,
      curso: cuNombre.get(m.curso_id) ?? `#${m.curso_id}`,
      base,
      pct: a.pct,
      monto,
    });
  }
  return out;
}

export type FilaProfesor = {
  profesorId: number;
  nombre: string;
  pendienteMonto: number;
  pendienteCount: number;
};

export type FilaLiquidacion = {
  id: number;
  profesorId: number;
  profesor: string;
  periodo: string;
  periodicidad: string;
  estado: string;
  totalDevengado: number;
  totalPagado: number;
  neto: number;
};

export async function cargarLiquidaciones(): Promise<{
  profesores: FilaProfesor[];
  liquidaciones: FilaLiquidacion[];
}> {
  if (!(await tienePermiso("comisiones", "ver"))) return { profesores: [], liquidaciones: [] };
  const sb = await createClient();

  const pendientes = await calcularPendientes(sb);
  const porProf = new Map<number, { monto: number; count: number }>();
  for (const p of pendientes) {
    const cur = porProf.get(p.profesorId) ?? { monto: 0, count: 0 };
    cur.monto += p.monto;
    cur.count += 1;
    porProf.set(p.profesorId, cur);
  }

  const { data: profs } = await sb.from("profesores").select("id, nombre, apellido").order("apellido");
  const profesores: FilaProfesor[] = ((profs as { id: number; nombre: string; apellido: string }[]) ?? [])
    .map((p) => ({
      profesorId: p.id,
      nombre: `${p.apellido}, ${p.nombre}`,
      pendienteMonto: porProf.get(p.id)?.monto ?? 0,
      pendienteCount: porProf.get(p.id)?.count ?? 0,
    }))
    .filter((p) => p.pendienteCount > 0);

  const { data: liqs } = await sb
    .from("liquidaciones")
    .select("id, profesor_id, periodo, periodicidad, estado, total_devengado, total_pagado, neto")
    .order("periodo", { ascending: false });
  const profNombre = new Map(
    ((profs as { id: number; nombre: string; apellido: string }[]) ?? []).map((p) => [p.id, `${p.apellido}, ${p.nombre}`])
  );
  const liquidaciones: FilaLiquidacion[] = ((liqs as {
    id: number;
    profesor_id: number;
    periodo: string;
    periodicidad: string;
    estado: string;
    total_devengado: number;
    total_pagado: number;
    neto: number;
  }[]) ?? []).map((l) => ({
    id: l.id,
    profesorId: l.profesor_id,
    profesor: profNombre.get(l.profesor_id) ?? `#${l.profesor_id}`,
    periodo: l.periodo,
    periodicidad: l.periodicidad,
    estado: l.estado,
    totalDevengado: Number(l.total_devengado),
    totalPagado: Number(l.total_pagado),
    neto: Number(l.neto),
  }));

  return { profesores, liquidaciones };
}

/** Genera (o completa) la liquidación de un profesor con sus devengos pendientes. */
export async function generarLiquidacion(profesorId: number): Promise<{ ok?: true; liquidacionId?: number; error?: string }> {
  if (!(await tienePermiso("comisiones", "crear"))) return { error: "Sin permiso." };
  const a = admin();
  const sb = await createClient();

  const pendientes = (await calcularPendientes(sb)).filter((p) => p.profesorId === profesorId);
  if (pendientes.length === 0) return { error: "No hay devengos pendientes para este profesor." };

  const periodicidad = (await obtenerParametro("periodicidad_liquidacion")) || "mes";
  const periodo = primerDiaMesISO();

  // Liquidación abierta del profesor en ese período, o nueva.
  const { data: existente } = await a
    .from("liquidaciones")
    .select("id, estado")
    .eq("profesor_id", profesorId)
    .eq("periodo", periodo)
    .eq("periodicidad", periodicidad)
    .maybeSingle();

  let liquidacionId: number;
  if (existente) {
    if (existente.estado === "pagada") return { error: "La liquidación del período ya está pagada." };
    liquidacionId = existente.id as number;
  } else {
    const { data: nueva, error } = await a
      .from("liquidaciones")
      .insert({ profesor_id: profesorId, periodo, periodicidad, estado: "abierta" })
      .select("id")
      .single();
    if (error) return { error: error.message };
    liquidacionId = nueva.id as number;
  }

  // Devengar cada membresía pendiente y crear el ítem.
  for (const p of pendientes) {
    const { data: com, error: errCom } = await a
      .from("comisiones_devengadas")
      .insert({
        profesor_id: p.profesorId,
        membresia_id: p.membresiaId,
        criterio: 1,
        periodo,
        tipo: "comision",
        base: p.base,
        monto: p.monto,
        origen: `Criterio 1: ${p.pct}% de ${p.base} (${p.curso} / ${p.alumno})`,
        liquidacion_id: liquidacionId,
      })
      .select("id")
      .single();
    if (errCom) return { error: "Falló devengar una comisión: " + errCom.message };
    await a.from("liquidacion_items").insert({
      liquidacion_id: liquidacionId,
      comision_id: com.id,
      membresia_id: p.membresiaId,
      descripcion: `${p.alumno} — ${p.curso} (${p.pct}% de ${p.base})`,
      monto: p.monto,
    });
  }

  await recomputarTotales(a, liquidacionId);
  revalidatePath("/liquidaciones");
  return { ok: true, liquidacionId };
}

/** Registra un pago al profesor contra su liquidación. */
export async function registrarPagoLiquidacion(args: {
  liquidacionId: number;
  monto: number;
  medio: string | null;
  notaMedio?: string;
}): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("comisiones", "crear"))) return { error: "Sin permiso." };
  const a = admin();
  const perfil = await obtenerPerfilActual();

  const monto = Math.max(0, Math.round(Number(args.monto) || 0));
  if (monto <= 0) return { error: "El monto debe ser mayor a 0." };
  if (!args.medio) return { error: "Elegí el medio de pago." };

  const { data: liq } = await a
    .from("liquidaciones")
    .select("id, profesor_id, total_devengado, total_pagado")
    .eq("id", args.liquidacionId)
    .maybeSingle();
  if (!liq) return { error: "La liquidación no existe." };

  const restante = Math.max(0, Number(liq.total_devengado) - Number(liq.total_pagado));
  if (monto > restante) return { error: `El pago supera el neto pendiente (${restante}).` };

  const glosa = args.medio && /otro/i.test(args.medio) && args.notaMedio?.trim() ? args.notaMedio.trim() : null;
  const { error: errPago } = await a.from("pagos").insert({
    tipo: "pago",
    motivo: "liquidacion",
    profesor_id: liq.profesor_id,
    liquidacion_id: args.liquidacionId,
    monto,
    medio: args.medio,
    glosa,
    registrado_por: perfil?.id ?? null,
  });
  if (errPago) return { error: errPago.message };

  await recomputarTotales(a, args.liquidacionId);
  revalidatePath("/liquidaciones");
  revalidatePath(`/liquidaciones/${args.liquidacionId}`);
  return { ok: true };
}

/** Recalcula total_devengado (ítems), total_pagado (pagos) y neto/estado. */
async function recomputarTotales(a: Admin, liquidacionId: number): Promise<void> {
  const { data: items } = await a
    .from("liquidacion_items")
    .select("monto")
    .eq("liquidacion_id", liquidacionId);
  const devengado = ((items as { monto: number }[]) ?? []).reduce((s, r) => s + Number(r.monto), 0);

  const { data: pagos } = await a
    .from("pagos")
    .select("monto")
    .eq("tipo", "pago")
    .eq("liquidacion_id", liquidacionId);
  const pagado = ((pagos as { monto: number }[]) ?? []).reduce((s, r) => s + Number(r.monto), 0);

  const neto = devengado - pagado;
  const estado = pagado <= 0 ? "abierta" : neto <= 0 ? "pagada" : "cerrada";
  await a
    .from("liquidaciones")
    .update({
      total_devengado: devengado,
      total_pagado: pagado,
      neto,
      estado,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", liquidacionId);
}
