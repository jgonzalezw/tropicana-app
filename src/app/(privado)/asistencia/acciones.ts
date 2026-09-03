"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual } from "@/lib/sesion";
import { compararPorApellido } from "@/lib/texto";
import { diaIso } from "@/lib/inscripcion";
import type { EntradaAsistencia, FilaAsistencia } from "@/lib/tipos";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}
type Admin = ReturnType<typeof admin>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
type Estado = "presente" | "ausente";

// ── Fechas ──────────────────────────────────────────────────────────────
function hoyISO(): string {
  return fmt(new Date());
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function restarDias(iso: string, dias: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() - dias);
  return fmt(d);
}
/** Próxima fecha (ISO) del patrón semanal del curso, estrictamente posterior a `baseIso`. */
function proximaClaseISO(dias: number[], baseIso: string): string {
  const validos = dias?.length ? dias : [1, 2, 3, 4, 5, 6, 7];
  const d = parseISO(baseIso);
  for (let i = 0; i < 400; i++) {
    d.setDate(d.getDate() + 1);
    if (validos.includes(diaIso(d))) return fmt(d);
  }
  return fmt(d);
}

/** Valida la fecha para operar asistencia: nunca futuro; pasado solo con
 *  permiso de edición y dentro de la ventana en semanas. */
async function validarFecha(fecha: string): Promise<string | null> {
  if (!ISO.test(fecha)) return "Fecha inválida.";
  const hoy = hoyISO();
  if (fecha > hoy) return "No se puede operar una fecha futura.";
  if (fecha < hoy) {
    if (!(await tienePermiso("asistencia", "editar")))
      return "No tenés permiso para cargar fechas pasadas.";
    const semanas = Math.max(0, Number(await obtenerParametro("asistencia_semanas_retro")) || 2);
    if (fecha < restarDias(hoy, semanas * 7))
      return `Solo se puede cargar hasta ${semanas} semanas hacia atrás.`;
  }
  return null;
}

// ── Mecanismo compartido: correr / revertir el fin de ciclo ──────────────

/** Corre el fin de ciclo (vencimiento de la cuota vigente) de una inscripción
 *  a la próxima fecha de clase, y deja traza. Idempotente por (inscripción,
 *  sesión). Los parciales (sin cuota) se saltan: se difieren por no consumir. */
async function aplicarCorrimiento(
  a: Admin,
  args: {
    inscripcionId: number;
    alumnoId: number;
    sesionId: number;
    tipo: "falta" | "suspension";
    fechaClase: string;
    motivo: string | null;
    diasSemana: number[];
    registradoPor: string | null;
  }
): Promise<"aplicado" | "ya" | "sin_cuota"> {
  const { data: existe } = await a
    .from("corrimientos_ciclo")
    .select("id")
    .eq("inscripcion_id", args.inscripcionId)
    .eq("sesion_id", args.sesionId)
    .maybeSingle();
  if (existe) return "ya";

  const { data: cuota } = await a
    .from("cuotas")
    .select("id, vencimiento, periodo")
    .eq("inscripcion_id", args.inscripcionId)
    .order("periodo", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cuota) return "sin_cuota";

  const base = (cuota.vencimiento as string | null) ?? args.fechaClase;
  const nuevo = proximaClaseISO(args.diasSemana, base);

  await a.from("cuotas").update({ vencimiento: nuevo }).eq("id", cuota.id);
  await a.from("corrimientos_ciclo").insert({
    inscripcion_id: args.inscripcionId,
    alumno_id: args.alumnoId,
    cuota_id: cuota.id,
    sesion_id: args.sesionId,
    tipo: args.tipo,
    fecha_clase: args.fechaClase,
    vencimiento_anterior: cuota.vencimiento,
    vencimiento_nuevo: nuevo,
    motivo: args.motivo,
    registrado_por: args.registradoPor,
  });
  return "aplicado";
}

/** Revierte los corrimientos de una sesión (restaura vencimientos y borra
 *  traza). Opcionalmente filtra por tipo. Devuelve cuántos revirtió. */
async function revertirCorrimientos(a: Admin, sesionId: number, tipo?: "falta" | "suspension"): Promise<number> {
  let q = a
    .from("corrimientos_ciclo")
    .select("id, cuota_id, vencimiento_anterior")
    .eq("sesion_id", sesionId);
  if (tipo) q = q.eq("tipo", tipo);
  const { data } = await q;
  const filas = (data as { id: number; cuota_id: number | null; vencimiento_anterior: string | null }[]) ?? [];
  for (const f of filas) {
    if (f.cuota_id != null)
      await a.from("cuotas").update({ vencimiento: f.vencimiento_anterior }).eq("id", f.cuota_id);
    await a.from("corrimientos_ciclo").delete().eq("id", f.id);
  }
  return filas.length;
}

// ── Padrón de la sesión ─────────────────────────────────────────────────

export async function cargarPadron(
  cursoId: number,
  fecha: string
): Promise<{
  filas: FilaAsistencia[];
  marcas: Record<number, Estado>;
  suspendida: boolean;
  motivoSuspension: string | null;
  completada: boolean;
  /** Estado por fecha (ISO) del curso dentro de la ventana: para el selector. */
  estadosPorFecha: Record<string, "completada" | "suspendida">;
}> {
  const vacio = {
    filas: [],
    marcas: {},
    suspendida: false,
    motivoSuspension: null,
    completada: false,
    estadosPorFecha: {} as Record<string, "completada" | "suspendida">,
  };
  if (!(await tienePermiso("asistencia", "ver"))) return vacio;
  if (!ISO.test(fecha)) return vacio;

  const sb = await createClient();

  // Estado de las sesiones del curso en la ventana (para marcar el selector).
  const semanas = Math.max(0, Number(await obtenerParametro("asistencia_semanas_retro")) || 2);
  const hoy = hoyISO();
  const minVentana = restarDias(hoy, semanas * 7);
  const estadosPorFecha: Record<string, "completada" | "suspendida"> = {};
  const { data: sesWin } = await sb
    .from("sesiones")
    .select("id, fecha, estado")
    .eq("curso_id", cursoId)
    .gte("fecha", minVentana)
    .lte("fecha", hoy);
  const winRows = (sesWin as { id: number; fecha: string; estado: string }[]) ?? [];
  const conAsistencia = new Set<number>();
  if (winRows.length) {
    const { data } = await sb
      .from("asistencias")
      .select("sesion_id")
      .in("sesion_id", winRows.map((s) => s.id));
    for (const r of (data as { sesion_id: number }[]) ?? []) conAsistencia.add(r.sesion_id);
  }
  for (const s of winRows) {
    if (s.estado === "suspendida") estadosPorFecha[s.fecha] = "suspendida";
    else if (conAsistencia.has(s.id)) estadosPorFecha[s.fecha] = "completada";
  }

  const { data: insc } = await sb
    .from("inscripciones")
    .select("id, alumno_id, modalidad, clases_total, alumno:alumnos(id, nombre, apellido, activo)")
    .eq("curso_id", cursoId)
    .eq("estado", "activa")
    // Vigente a esa fecha: la inscripción ya había empezado (no aparece quien
    // se inscribió después de la fecha elegida, p. ej. en cargas retroactivas).
    .lte("fecha_inicio", fecha);

  type InscRow = {
    id: number;
    alumno_id: number;
    modalidad: FilaAsistencia["modalidad"];
    clases_total: number | null;
    alumno: { id: number; nombre: string; apellido: string; activo: boolean } | null;
  };
  const inscripciones = ((insc as unknown as InscRow[]) ?? []).filter((r) => r.alumno?.activo);
  const inscIds = inscripciones.map((r) => r.id);
  const alumnoIds = [...new Set(inscripciones.map((r) => r.alumno_id))];

  const consumidas: Record<number, number> = {};
  if (inscIds.length) {
    const { data } = await sb
      .from("asistencias")
      .select("inscripcion_id")
      .eq("estado", "presente")
      .in("inscripcion_id", inscIds);
    for (const x of (data as { inscripcion_id: number | null }[]) ?? [])
      if (x.inscripcion_id != null) consumidas[x.inscripcion_id] = (consumidas[x.inscripcion_id] ?? 0) + 1;
  }

  const [y, m] = fecha.split("-").map(Number);
  const desde = `${y}-${String(m).padStart(2, "0")}-01`;
  const finMes = new Date(y, m, 0);
  const hasta = fmt(finMes);
  const faltasMes: Record<number, number> = {};
  const { data: sesMes } = await sb
    .from("sesiones")
    .select("id")
    .eq("curso_id", cursoId)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const sesMesIds = ((sesMes as { id: number }[]) ?? []).map((s) => s.id);
  if (sesMesIds.length && alumnoIds.length) {
    const { data } = await sb
      .from("asistencias")
      .select("alumno_id")
      .eq("estado", "ausente")
      .in("sesion_id", sesMesIds)
      .in("alumno_id", alumnoIds);
    for (const x of (data as { alumno_id: number }[]) ?? [])
      faltasMes[x.alumno_id] = (faltasMes[x.alumno_id] ?? 0) + 1;
  }

  const deuda = await deudaPorAlumno(sb, alumnoIds);

  // Sesión existente (marcas + estado suspendida).
  const marcas: Record<number, Estado> = {};
  const extras: FilaAsistencia[] = [];
  let suspendida = false;
  let motivoSuspension: string | null = null;
  const { data: sesion } = await sb
    .from("sesiones")
    .select("id, estado, motivo")
    .eq("curso_id", cursoId)
    .eq("fecha", fecha)
    .maybeSingle();
  if (sesion) {
    suspendida = sesion.estado === "suspendida";
    motivoSuspension = (sesion.motivo as string | null) ?? null;
    const { data } = await sb
      .from("asistencias")
      .select("estado, inscripcion_id, alumno:alumnos(id, nombre, apellido)")
      .eq("sesion_id", sesion.id);
    const idsBase = new Set(alumnoIds);
    for (const r of (data as unknown as {
      estado: Estado;
      inscripcion_id: number | null;
      alumno: { id: number; nombre: string; apellido: string } | null;
    }[]) ?? []) {
      if (!r.alumno) continue;
      marcas[r.alumno.id] = r.estado;
      if (!idsBase.has(r.alumno.id))
        extras.push({
          inscripcionId: r.inscripcion_id,
          alumnoId: r.alumno.id,
          apellido: r.alumno.apellido,
          nombre: r.alumno.nombre,
          modalidad: "mensual",
          restantes: null,
          faltasMes: faltasMes[r.alumno.id] ?? 0,
          deuda: deuda[r.alumno.id] ?? 0,
        });
    }
  }

  const filas: FilaAsistencia[] = inscripciones
    .map((r) => {
      const esMensual = r.modalidad === "mensual";
      const restantes = esMensual ? null : Math.max(0, (r.clases_total ?? 0) - (consumidas[r.id] ?? 0));
      return {
        inscripcionId: r.id,
        alumnoId: r.alumno!.id,
        apellido: r.alumno!.apellido,
        nombre: r.alumno!.nombre,
        modalidad: r.modalidad,
        restantes,
        faltasMes: faltasMes[r.alumno_id] ?? 0,
        deuda: deuda[r.alumno_id] ?? 0,
      };
    })
    .filter((f) => f.modalidad === "mensual" || f.restantes === null || f.restantes > 0 || marcas[f.alumnoId]);

  return {
    filas: [...filas, ...extras].sort(compararPorApellido),
    marcas,
    suspendida,
    motivoSuspension,
    completada: estadosPorFecha[fecha] === "completada",
    estadosPorFecha,
  };
}

async function deudaPorAlumno(
  sb: Awaited<ReturnType<typeof createClient>>,
  alumnoIds: number[]
): Promise<Record<number, number>> {
  const deuda: Record<number, number> = {};
  if (!alumnoIds.length) return deuda;
  const { data: inscAll } = await sb.from("inscripciones").select("id, alumno_id").in("alumno_id", alumnoIds);
  const inscToAlumno = new Map<number, number>(
    ((inscAll as { id: number; alumno_id: number }[]) ?? []).map((r) => [r.id, r.alumno_id])
  );
  const allInscIds = [...inscToAlumno.keys()];
  if (!allInscIds.length) return deuda;
  const { data: cuotas } = await sb
    .from("cuotas")
    .select("id, inscripcion_id, monto_devengado, descuento_adelanto, estado")
    .in("inscripcion_id", allInscIds)
    .neq("estado", "pagada");
  const cuotaRows =
    (cuotas as { id: number; inscripcion_id: number; monto_devengado: number; descuento_adelanto: number }[]) ?? [];
  const pagado: Record<number, number> = {};
  if (cuotaRows.length) {
    const { data: pagos } = await sb
      .from("pagos")
      .select("cuota_id, monto, descuento")
      .eq("tipo", "cobro")
      .in("cuota_id", cuotaRows.map((c) => c.id));
    for (const p of (pagos as { cuota_id: number | null; monto: number; descuento: number }[]) ?? [])
      if (p.cuota_id != null) pagado[p.cuota_id] = (pagado[p.cuota_id] ?? 0) + Number(p.monto) + Number(p.descuento);
  }
  for (const c of cuotaRows) {
    const efectivo = Math.max(0, Number(c.monto_devengado) - Number(c.descuento_adelanto));
    const saldo = Math.max(0, efectivo - (pagado[c.id] ?? 0));
    const al = inscToAlumno.get(c.inscripcion_id);
    if (al != null && saldo > 0) deuda[al] = (deuda[al] ?? 0) + saldo;
  }
  return deuda;
}

// ── Guardar asistencia (con disparador de falta individual) ──────────────

export async function guardarAsistencia(
  e: EntradaAsistencia
): Promise<{ ok?: true; resumen?: string; error?: string }> {
  if (!(await tienePermiso("asistencia", "crear")))
    return { error: "No tenés permiso para registrar asistencia." };
  if (!e.marcas.length) return { error: "No hay nada marcado." };
  const errFecha = await validarFecha(e.fecha);
  if (errFecha) return { error: errFecha };

  const perfil = await obtenerPerfilActual();
  const a = admin();

  const { data: curso } = await a
    .from("cursos")
    .select("id, dias_semana")
    .eq("id", e.cursoId)
    .maybeSingle();
  if (!curso) return { error: "El curso no existe." };
  const diasSemana = (curso.dias_semana as number[]) ?? [];

  const { data: asig } = await a
    .from("asignaciones")
    .select("profesor_id")
    .eq("curso_id", e.cursoId)
    .is("hasta", null)
    .maybeSingle();

  // Guardar asistencia = la clase se dictó (revierte una suspensión previa).
  const { data: sesion, error: errSesion } = await a
    .from("sesiones")
    .upsert(
      {
        curso_id: e.cursoId,
        fecha: e.fecha,
        estado: "dictada",
        motivo: null,
        profesor_id: asig?.profesor_id ?? null,
        registrado_por: perfil?.id ?? null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "curso_id,fecha" }
    )
    .select("id")
    .single();
  if (errSesion) return { error: errSesion.message };
  const sesionId = sesion.id as number;

  await revertirCorrimientos(a, sesionId, "suspension");

  const filas = e.marcas.map((m) => ({
    sesion_id: sesionId,
    alumno_id: m.alumnoId,
    inscripcion_id: m.inscripcionId,
    estado: m.estado,
  }));
  const { error: errAsis } = await a.from("asistencias").upsert(filas, { onConflict: "sesion_id,alumno_id" });
  if (errAsis) return { error: errAsis.message };

  // Disparador de falta individual tolerada: reconciliar corrimientos 'falta'
  // de esta sesión con las marcas actuales (aplica/revierte según toque).
  const reposiciones = await reconciliarFaltas(a, {
    cursoId: e.cursoId,
    sesionId,
    fecha: e.fecha,
    diasSemana,
    marcas: e.marcas,
    registradoPor: perfil?.id ?? null,
  });

  const presentes = e.marcas.filter((m) => m.estado === "presente").length;
  const ausentes = e.marcas.filter((m) => m.estado === "ausente").length;
  const plu = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  const notaRepo =
    reposiciones > 0
      ? ` Se corrió el fin de ciclo de ${plu(reposiciones, "alumno", "alumnos")} por falta con tolerancia.`
      : "";

  revalidatePath("/asistencia");
  return {
    ok: true,
    resumen: `Asistencia guardada · ${plu(presentes, "presente", "presentes")} y ${plu(
      ausentes,
      "ausente",
      "ausentes"
    )}.${notaRepo}`,
  };
}

/** Aplica/revierte el corrimiento por falta tolerada de cada alumno mensual
 *  según las marcas de la sesión. Devuelve cuántos corrimientos quedaron. */
async function reconciliarFaltas(
  a: Admin,
  args: {
    cursoId: number;
    sesionId: number;
    fecha: string;
    diasSemana: number[];
    marcas: EntradaAsistencia["marcas"];
    registradoPor: string | null;
  }
): Promise<number> {
  const faltasToleradas = Math.max(1, Number(await obtenerParametro("faltas_toleradas")) || 2);

  // Modalidad por inscripción (solo mensuales corren fin de ciclo).
  const { data: insc } = await a
    .from("inscripciones")
    .select("id, alumno_id, modalidad")
    .eq("curso_id", args.cursoId)
    .eq("estado", "activa")
    .lte("fecha_inicio", args.fecha);
  const mensual = new Map<number, number>(); // inscripcion_id -> alumno_id
  for (const r of (insc as { id: number; alumno_id: number; modalidad: string }[]) ?? [])
    if (r.modalidad === "mensual") mensual.set(r.id, r.alumno_id);

  // Faltas del mes por alumno EXCLUYENDO esta sesión (para saber si hay tolerancia).
  const [y, m] = args.fecha.split("-").map(Number);
  const desde = `${y}-${String(m).padStart(2, "0")}-01`;
  const hasta = fmt(new Date(y, m, 0));
  const { data: sesMes } = await a
    .from("sesiones")
    .select("id")
    .eq("curso_id", args.cursoId)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const otrasSes = ((sesMes as { id: number }[]) ?? []).map((s) => s.id).filter((id) => id !== args.sesionId);
  const faltasPrevias: Record<number, number> = {};
  if (otrasSes.length) {
    const { data } = await a
      .from("asistencias")
      .select("alumno_id")
      .eq("estado", "ausente")
      .in("sesion_id", otrasSes);
    for (const x of (data as { alumno_id: number }[]) ?? [])
      faltasPrevias[x.alumno_id] = (faltasPrevias[x.alumno_id] ?? 0) + 1;
  }

  const marcaPorInsc = new Map<number, Estado>();
  for (const mk of args.marcas) if (mk.inscripcionId != null) marcaPorInsc.set(mk.inscripcionId, mk.estado);

  for (const [inscripcionId, alumnoId] of mensual) {
    const estado = marcaPorInsc.get(inscripcionId);
    const conTolerancia = (faltasPrevias[alumnoId] ?? 0) < faltasToleradas;
    const debeCorrer = estado === "ausente" && conTolerancia;
    if (debeCorrer) {
      await aplicarCorrimiento(a, {
        inscripcionId,
        alumnoId,
        sesionId: args.sesionId,
        tipo: "falta",
        fechaClase: args.fecha,
        motivo: null,
        diasSemana: args.diasSemana,
        registradoPor: args.registradoPor,
      });
    } else {
      // Ya no corresponde (presente, o sin tolerancia): revertir si existía.
      const { data: ex } = await a
        .from("corrimientos_ciclo")
        .select("id, cuota_id, vencimiento_anterior")
        .eq("inscripcion_id", inscripcionId)
        .eq("sesion_id", args.sesionId)
        .eq("tipo", "falta")
        .maybeSingle();
      if (ex) {
        if (ex.cuota_id != null)
          await a.from("cuotas").update({ vencimiento: ex.vencimiento_anterior }).eq("id", ex.cuota_id);
        await a.from("corrimientos_ciclo").delete().eq("id", ex.id);
      }
    }
  }

  const { count } = await a
    .from("corrimientos_ciclo")
    .select("id", { count: "exact", head: true })
    .eq("sesion_id", args.sesionId)
    .eq("tipo", "falta");
  return count ?? 0;
}

// ── Suspender / reabrir una clase ────────────────────────────────────────

export async function suspenderClase(args: {
  cursoId: number;
  fecha: string;
  motivo: string;
}): Promise<{ ok?: true; resumen?: string; error?: string }> {
  if (!(await tienePermiso("asistencia", "crear")))
    return { error: "No tenés permiso para suspender clases." };
  const errFecha = await validarFecha(args.fecha);
  if (errFecha) return { error: errFecha };

  const perfil = await obtenerPerfilActual();
  const a = admin();

  const { data: curso } = await a
    .from("cursos")
    .select("id, dias_semana")
    .eq("id", args.cursoId)
    .maybeSingle();
  if (!curso) return { error: "El curso no existe." };
  const diasSemana = (curso.dias_semana as number[]) ?? [];

  const { data: asig } = await a
    .from("asignaciones")
    .select("profesor_id")
    .eq("curso_id", args.cursoId)
    .is("hasta", null)
    .maybeSingle();

  const { data: sesion, error: errSesion } = await a
    .from("sesiones")
    .upsert(
      {
        curso_id: args.cursoId,
        fecha: args.fecha,
        estado: "suspendida",
        motivo: args.motivo.trim() || null,
        profesor_id: asig?.profesor_id ?? null,
        registrado_por: perfil?.id ?? null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "curso_id,fecha" }
    )
    .select("id")
    .single();
  if (errSesion) return { error: errSesion.message };
  const sesionId = sesion.id as number;

  // Una clase suspendida no computa asistencia: se borran marcas y se
  // rehacen los corrimientos como 'suspension' (limpiando faltas previas).
  await a.from("asistencias").delete().eq("sesion_id", sesionId);
  await revertirCorrimientos(a, sesionId);

  const { data: insc } = await a
    .from("inscripciones")
    .select("id, alumno_id, modalidad")
    .eq("curso_id", args.cursoId)
    .eq("estado", "activa")
    .lte("fecha_inicio", args.fecha);

  let corridos = 0;
  for (const r of (insc as { id: number; alumno_id: number; modalidad: string }[]) ?? []) {
    if (r.modalidad !== "mensual") continue; // parciales se difieren solos
    const res = await aplicarCorrimiento(a, {
      inscripcionId: r.id,
      alumnoId: r.alumno_id,
      sesionId,
      tipo: "suspension",
      fechaClase: args.fecha,
      motivo: args.motivo.trim() || null,
      diasSemana,
      registradoPor: perfil?.id ?? null,
    });
    if (res === "aplicado") corridos++;
  }

  const plu = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  revalidatePath("/asistencia");
  return {
    ok: true,
    resumen: `Clase suspendida. Se corrió el fin de ciclo de ${plu(
      corridos,
      "alumno mensual",
      "alumnos mensuales"
    )}. Los paquetes por clase se difieren solos.`,
  };
}

export async function reabrirSesion(args: {
  cursoId: number;
  fecha: string;
}): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("asistencia", "crear")))
    return { error: "No tenés permiso." };
  const a = admin();
  const { data: sesion } = await a
    .from("sesiones")
    .select("id")
    .eq("curso_id", args.cursoId)
    .eq("fecha", args.fecha)
    .maybeSingle();
  if (!sesion) return { ok: true };
  await revertirCorrimientos(a, sesion.id);
  await a
    .from("sesiones")
    .update({ estado: "dictada", motivo: null, actualizado_en: new Date().toISOString() })
    .eq("id", sesion.id);
  revalidatePath("/asistencia");
  return { ok: true };
}
