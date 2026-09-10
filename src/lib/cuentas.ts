import type { createClient } from "@/lib/supabase/server";
import { recalcularMembresia, type ClienteAdmin } from "@/lib/membresias";
import { obtenerParametro } from "@/lib/sesion";
import type { CuotaCuenta, EntradaCobro, EstadoCuenta, MembresiaCuenta, PagoCuenta } from "@/lib/tipos";
import type { LineaPendiente } from "@/lib/caja";

function hoyLocal(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function parseFechaISO(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isoFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * La cuenta del alumno: qué compró, qué consumió, qué debe y qué pagó.
 *
 * Es la contracara de `@/lib/membresias`: allá vive cuándo se cierra un ciclo,
 * acá cómo se lee esa historia y cómo entra la plata. Las dos pantallas que la
 * usan (estado de cuenta y el cobro) comparten esta pieza para no volver a
 * calcular la deuda cada una por su lado, que es como se desincronizan.
 *
 * No es "use server": son piezas internas, no acciones expuestas al cliente.
 */

type ClienteLectura = Awaited<ReturnType<typeof createClient>>;

const num = (v: unknown) => Number(v ?? 0);

/** Saldo de una cuota: lo devengado menos lo cubierto (plata + descuentos). */
function saldoCuota(devengado: number, descuentoAdelanto: number, cubierto: number) {
  return Math.max(0, devengado - descuentoAdelanto - cubierto);
}

/** El estado que le corresponde a una cuota según lo efectivamente cubierto. */
export function estadoQueCorresponde(devengado: number, descuentoAdelanto: number, cubierto: number) {
  const referencia = Math.max(0, devengado - descuentoAdelanto);
  if (referencia === 0 || cubierto >= referencia) return "pagada";
  return cubierto > 0 ? "parcial" : "pendiente";
}

// ── Lectura: el estado de cuenta ────────────────────────────────────────

export async function estadoDeCuenta(sb: ClienteLectura, alumnoId: number): Promise<EstadoCuenta | null> {
  const { data: al } = await sb
    .from("alumnos")
    .select("id, nombre, apellido")
    .eq("id", alumnoId)
    .maybeSingle();
  if (!al) return null;
  const alumno = al as { id: number; nombre: string; apellido: string };

  const { data: inscRows } = await sb
    .from("inscripciones")
    .select(
      "id, estado, fecha_inicio, fecha_fin, clases_plan, clases_total, bono_generado, bono_redimido, " +
        "plan:planes(nombre), curso:cursos(nombre)"
    )
    .eq("alumno_id", alumnoId)
    .neq("estado", "baja")
    .order("fecha_inicio", { ascending: false });

  type InscRow = {
    id: number;
    estado: string;
    fecha_inicio: string;
    fecha_fin: string | null;
    clases_plan: number | null;
    clases_total: number | null;
    bono_generado: number;
    bono_redimido: boolean;
    plan: { nombre: string } | null;
    curso: { nombre: string } | null;
  };
  const inscripciones = (inscRows as unknown as InscRow[]) ?? [];
  if (!inscripciones.length)
    return { alumno, membresias: [], pagos: [], deuda: 0 };
  const inscIds = inscripciones.map((r) => r.id);

  // Consumo y faltas, solo sobre sesiones dictadas.
  const presentes: Record<number, number> = {};
  const conLic: Record<number, number> = {};
  const sinLic: Record<number, number> = {};
  const { data: asisRows } = await sb
    .from("asistencias")
    .select("inscripcion_id, sesion_id, estado, con_licencia")
    .in("inscripcion_id", inscIds);
  const asis =
    (asisRows as { inscripcion_id: number | null; sesion_id: number; estado: string; con_licencia: boolean }[]) ?? [];
  if (asis.length) {
    const { data: ses } = await sb
      .from("sesiones")
      .select("id, estado")
      .in("id", [...new Set(asis.map((a) => a.sesion_id))]);
    const dictadas = new Set(
      ((ses as { id: number; estado: string }[]) ?? []).filter((s) => s.estado === "dictada").map((s) => s.id)
    );
    for (const a of asis) {
      if (a.inscripcion_id == null || !dictadas.has(a.sesion_id)) continue;
      if (a.estado === "presente") presentes[a.inscripcion_id] = (presentes[a.inscripcion_id] ?? 0) + 1;
      else if (a.con_licencia) conLic[a.inscripcion_id] = (conLic[a.inscripcion_id] ?? 0) + 1;
      else sinLic[a.inscripcion_id] = (sinLic[a.inscripcion_id] ?? 0) + 1;
    }
  }

  // Cuotas y lo cobrado contra cada una.
  const { data: cuotaRows } = await sb
    .from("cuotas")
    .select("id, inscripcion_id, periodo, vencimiento, fecha_compromiso, monto_devengado, descuento_adelanto, estado")
    .in("inscripcion_id", inscIds)
    .order("periodo", { ascending: true });
  const cuotas =
    (cuotaRows as {
      id: number;
      inscripcion_id: number;
      periodo: string;
      vencimiento: string | null;
      fecha_compromiso: string | null;
      monto_devengado: number;
      descuento_adelanto: number;
      estado: string;
    }[]) ?? [];

  const { data: pagoRows } = await sb
    .from("pagos")
    .select("id, cuota_id, fecha, monto, descuento, descuento_motivo, medio, motivo")
    .eq("tipo", "cobro")
    .eq("alumno_id", alumnoId)
    .order("fecha", { ascending: false });
  const pagosCrudos =
    (pagoRows as {
      id: number;
      cuota_id: number | null;
      fecha: string;
      monto: number;
      descuento: number;
      descuento_motivo: string | null;
      medio: string | null;
      motivo: string | null;
    }[]) ?? [];

  const plataPorCuota: Record<number, number> = {};
  const cubiertoPorCuota: Record<number, number> = {};
  for (const p of pagosCrudos) {
    if (p.cuota_id == null) continue;
    plataPorCuota[p.cuota_id] = (plataPorCuota[p.cuota_id] ?? 0) + num(p.monto);
    cubiertoPorCuota[p.cuota_id] = (cubiertoPorCuota[p.cuota_id] ?? 0) + num(p.monto) + num(p.descuento);
  }

  const cuotasPorInsc = new Map<number, CuotaCuenta[]>();
  for (const c of cuotas) {
    const cubierto = cubiertoPorCuota[c.id] ?? 0;
    const fila: CuotaCuenta = {
      id: c.id,
      periodo: c.periodo,
      vencimiento: c.vencimiento,
      fechaCompromiso: c.fecha_compromiso,
      devengado: num(c.monto_devengado),
      descuentoAdelanto: num(c.descuento_adelanto),
      cobrado: plataPorCuota[c.id] ?? 0,
      cubierto,
      saldo: saldoCuota(num(c.monto_devengado), num(c.descuento_adelanto), cubierto),
      estado: c.estado,
    };
    const lista = cuotasPorInsc.get(c.inscripcion_id) ?? [];
    lista.push(fila);
    cuotasPorInsc.set(c.inscripcion_id, lista);
  }

  const membresias: MembresiaCuenta[] = inscripciones.map((r) => {
    const propias = cuotasPorInsc.get(r.id) ?? [];
    const hechas = presentes[r.id] ?? 0;
    return {
      id: r.id,
      plan: r.plan?.nombre ?? null,
      curso: r.curso?.nombre ?? null,
      estado: r.estado,
      fechaInicio: r.fecha_inicio,
      fechaFin: r.fecha_fin,
      progreso: r.clases_plan != null ? { hechas, total: r.clases_plan } : null,
      restantes: r.clases_total != null ? Math.max(0, r.clases_total - hechas) : null,
      faltasConLicencia: conLic[r.id] ?? 0,
      faltasSinLicencia: sinLic[r.id] ?? 0,
      bono: r.bono_redimido ? 0 : num(r.bono_generado),
      cuotas: propias,
      saldo: propias.reduce((t, c) => t + c.saldo, 0),
    };
  });

  const pagos: PagoCuenta[] = pagosCrudos.map((p) => ({
    id: p.id,
    fecha: p.fecha,
    monto: num(p.monto),
    descuento: num(p.descuento),
    descuentoMotivo: p.descuento_motivo,
    medio: p.medio,
    concepto: p.motivo,
  }));

  return {
    alumno,
    membresias,
    pagos,
    deuda: membresias.reduce((t, m) => t + m.saldo, 0),
  };
}

// ── Cuentas por cobrar ──────────────────────────────────────────────────

/**
 * Las deudas abiertas contra las que se puede imputar un cobro: una línea por
 * cuota con saldo, con el nombre de quien debe y contra qué. Es la lista que
 * Caja usa para navegar ("¿a quién se le cobra?") y la misma que alimenta el
 * atajo desde la operación. Una línea saldada desaparece.
 *
 * Hoy solo produce el bucket `cuotas`: particulares, alquiler, pruebas y
 * productos van a entrar cuando existan esas ventas.
 */
export async function lineasPorCobrar(
  sb: ClienteLectura,
  filtro?: { alumnoId?: number }
): Promise<LineaPendiente[]> {
  const { data } = await sb
    .from("cuotas")
    .select(
      "id, inscripcion_id, monto_devengado, descuento_adelanto, vencimiento, " +
        "inscripcion:inscripciones(id, alumno_id, alumno:alumnos(id, nombre, apellido), " +
        "plan:planes(nombre), curso:cursos(nombre))"
    )
    .neq("estado", "pagada");

  type Fila = {
    id: number;
    inscripcion_id: number;
    monto_devengado: number;
    descuento_adelanto: number;
    vencimiento: string | null;
    inscripcion: {
      id: number;
      alumno_id: number;
      alumno: { id: number; nombre: string; apellido: string } | null;
      plan: { nombre: string } | null;
      curso: { nombre: string } | null;
    } | null;
  };
  let filas = ((data as unknown as Fila[]) ?? []).filter((f) => f.inscripcion?.alumno);
  if (filtro?.alumnoId != null)
    filas = filas.filter((f) => f.inscripcion!.alumno_id === filtro.alumnoId);
  if (!filas.length) return [];

  // Lo ya cubierto de cada cuota (plata + descuentos).
  const cubierto: Record<number, number> = {};
  const { data: pagos } = await sb
    .from("pagos")
    .select("cuota_id, monto, descuento")
    .eq("tipo", "cobro")
    .in("cuota_id", filas.map((f) => f.id));
  for (const p of (pagos as { cuota_id: number | null; monto: number; descuento: number }[]) ?? [])
    if (p.cuota_id != null) cubierto[p.cuota_id] = (cubierto[p.cuota_id] ?? 0) + num(p.monto) + num(p.descuento);

  return filas
    .map((f) => {
      const al = f.inscripcion!.alumno!;
      const servicio = f.inscripcion!.plan?.nombre ?? f.inscripcion!.curso?.nombre ?? "Membresía";
      return {
        clave: `cuota:${f.id}`,
        bucket: "cuotas" as const,
        cuotaId: f.id,
        sujetoTipo: "alumno" as const,
        sujetoId: al.id,
        sujeto: `${al.apellido}, ${al.nombre}`,
        detalle: servicio,
        saldo: saldoCuota(num(f.monto_devengado), num(f.descuento_adelanto), cubierto[f.id] ?? 0),
      };
    })
    .filter((l) => l.saldo > 0)
    .sort((a, b) => a.sujeto.localeCompare(b.sujeto, "es") || a.detalle.localeCompare(b.detalle, "es"));
}

// ── Escritura: registrar un cobro contra una cuota ──────────────────────

/**
 * Asienta plata (y/o un descuento con motivo) contra una cuota existente, deja
 * la cuota en el estado que le corresponde y **recalcula la membresía**: cobrar
 * puede ser lo que cierre el ciclo, porque una membresía se cierra agotada Y
 * cobrada.
 *
 * Es lo que faltaba para poder cobrar una deuda después de la venta: hasta
 * ahora esto vivía incrustado dentro de `venderPlan` y no se podía reusar.
 */
export async function registrarCobro(
  a: ClienteAdmin,
  e: EntradaCobro,
  registradoPor: string | null
): Promise<{ ok?: true; error?: string; cerroMembresia?: boolean; saldoRestante?: number }> {
  const { data: cuotaRow } = await a
    .from("cuotas")
    .select("id, inscripcion_id, monto_devengado, descuento_adelanto")
    .eq("id", e.cuotaId)
    .maybeSingle();
  if (!cuotaRow) return { error: "La cuota no existe." };
  const cuota = cuotaRow as {
    id: number;
    inscripcion_id: number;
    monto_devengado: number;
    descuento_adelanto: number;
  };

  const { data: inscRow } = await a
    .from("inscripciones")
    .select("id, alumno_id")
    .eq("id", cuota.inscripcion_id)
    .maybeSingle();
  if (!inscRow) return { error: "La membresía de esa cuota no existe." };
  const insc = inscRow as { id: number; alumno_id: number };

  // Cuánto se debe hoy, antes de este cobro.
  const { data: previos } = await a
    .from("pagos")
    .select("monto, descuento")
    .eq("tipo", "cobro")
    .eq("cuota_id", cuota.id);
  const cubiertoPrevio = ((previos as { monto: number; descuento: number }[]) ?? []).reduce(
    (t, p) => t + num(p.monto) + num(p.descuento),
    0
  );
  const saldo = saldoCuota(num(cuota.monto_devengado), num(cuota.descuento_adelanto), cubiertoPrevio);
  if (saldo <= 0) return { error: "Esa cuota ya está saldada." };

  const plata = Math.max(0, Math.round(num(e.monto)));
  const descuento = Math.max(0, Math.round(num(e.descuento)));
  if (plata + descuento <= 0) return { error: "Cargá un monto a cobrar o un descuento." };
  if (plata + descuento > saldo)
    return { error: `No se puede cobrar más de lo que se debe (saldo: ${saldo}).` };
  if (plata > 0 && !e.medio) return { error: "Elegí el medio de pago." };
  if (descuento > 0 && !e.descuentoMotivo.trim())
    return { error: "El descuento necesita un motivo." };

  // Fecha de compromiso de pago del saldo: misma regla que la venta (§ /inscribir)
  // — obligatoria si queda saldo, entre hoy y el tope del parámetro.
  const saldoRestanteAntes = saldo - plata - descuento;
  let fechaCompromiso: string | null = null;
  if (saldoRestanteAntes > 0) {
    const diasMax = Math.max(1, Number(await obtenerParametro("dias_compromiso_pago")) || 30);
    const fc = parseFechaISO(e.fechaCompromiso ?? "");
    if (!fc) return { error: "Cargá la fecha de compromiso de pago del saldo." };
    const hoy0 = hoyLocal();
    const maxF = new Date(hoy0);
    maxF.setDate(maxF.getDate() + diasMax);
    if (fc < hoy0) return { error: "La fecha de compromiso no puede ser anterior a hoy." };
    if (fc > maxF) return { error: `La fecha de compromiso no puede superar ${diasMax} días desde hoy.` };
    fechaCompromiso = isoFecha(fc);
  }

  const { error: errPago } = await a.from("pagos").insert({
    tipo: "cobro",
    motivo: "cuota",
    alumno_id: insc.alumno_id,
    inscripcion_id: insc.id,
    cuota_id: cuota.id,
    monto: plata,
    medio: plata > 0 ? e.medio : null,
    descuento,
    descuento_motivo: descuento > 0 ? e.descuentoMotivo.trim() : null,
    glosa: e.notaMedio?.trim() || null,
    registrado_por: registradoPor,
  });
  if (errPago) return { error: "No se pudo registrar el cobro: " + errPago.message };

  const cubierto = cubiertoPrevio + plata + descuento;
  await a
    .from("cuotas")
    .update({
      estado: estadoQueCorresponde(num(cuota.monto_devengado), num(cuota.descuento_adelanto), cubierto),
      // Saldada: no hay nada que prometer, se limpia. Con saldo: la fecha nueva
      // reemplaza cualquier compromiso anterior (se está renegociando).
      fecha_compromiso: fechaCompromiso,
    })
    .eq("id", cuota.id);

  // Cobrar puede cerrar la membresía: es la segunda condición de la regla base.
  const cerroMembresia = await recalcularMembresia(a, insc.id);

  return {
    ok: true,
    cerroMembresia,
    saldoRestante: saldoCuota(num(cuota.monto_devengado), num(cuota.descuento_adelanto), cubierto),
  };
}
