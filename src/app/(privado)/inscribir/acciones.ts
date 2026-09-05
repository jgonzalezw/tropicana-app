"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual } from "@/lib/sesion";
import { soloDigitos } from "@/lib/texto";
import type { Alumno, DatosAlumno, EntradaInscripcion } from "@/lib/tipos";
import {
  type Modalidad,
  type TarifasParciales,
  clasesModalidad,
  clasesPorConteo,
  diasMedioMes,
  fechaLarga,
  gs,
  isoFecha,
  precioModalidad,
  primerDiaDelMes,
  sumarMeses,
  totalMedioMes,
} from "@/lib/inscripcion";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

// ── Alta rápida de alumno desde la inscripción ──────────────────────────
// Igual que crearAlumno pero devuelve el alumno creado, para seleccionarlo
// en el acto sin recargar el padrón.

function validarAlumno(d: DatosAlumno): string | null {
  if (!d.nombre.trim() || !d.apellido.trim()) return "Nombre y apellido son obligatorios.";
  if (d.es_menor) {
    if (soloDigitos(d.tutor_whatsapp).length < 6)
      return "El WhatsApp del tutor identifica al menor (6+ dígitos).";
  } else if (soloDigitos(d.whatsapp).length < 6) {
    return "El WhatsApp identifica al alumno (6+ dígitos).";
  }
  return null;
}

export async function crearAlumnoDesdeInscripcion(
  d: DatosAlumno
): Promise<{ alumno?: Alumno; error?: string }> {
  if (!(await tienePermiso("alumnos", "crear"))) return { error: "Sin permiso para crear alumnos." };
  const err = validarAlumno(d);
  if (err) return { error: err };

  const { data, error } = await admin()
    .from("alumnos")
    .insert({
      nombre: d.nombre.trim(),
      apellido: d.apellido.trim(),
      whatsapp: d.whatsapp.trim() || null,
      es_menor: d.es_menor,
      tutor_alumno_id: d.es_menor ? d.tutor_alumno_id : null,
      tutor_nombre: d.es_menor ? d.tutor_nombre.trim() || null : null,
      tutor_whatsapp: d.es_menor ? d.tutor_whatsapp.trim() || null : null,
      canal_captacion: d.canal_captacion,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505")
      return { error: d.es_menor ? "Ese menor ya está cargado." : "Ese WhatsApp ya es de un alumno." };
    return { error: error.message };
  }
  revalidatePath("/inscribir");
  return { alumno: data as Alumno };
}

// ── Inscribir y cobrar ──────────────────────────────────────────────────

type ResultadoInscripcion = { ok?: true; resumen?: string; error?: string };

function tarifasDesde(rows: { modalidad: string; precio: number }[]): TarifasParciales {
  const t: TarifasParciales = { clase: null, semana: null, medio_mes: null };
  for (const r of rows) {
    if (r.modalidad === "clase") t.clase = Number(r.precio);
    else if (r.modalidad === "semana") t.semana = Number(r.precio);
    else if (r.modalidad === "medio_mes") t.medio_mes = Number(r.precio);
  }
  return t;
}

export async function inscribirYCobrar(e: EntradaInscripcion): Promise<ResultadoInscripcion> {
  if (!(await tienePermiso("inscripciones", "crear")))
    return { error: "No tenés permiso para inscribir." };

  const perfil = await obtenerPerfilActual();
  const a = admin();
  const sb = await createClient();

  // 1. Datos reales de la base (nunca se confía en los montos del navegador).
  const { data: curso } = await sb
    .from("cursos")
    .select("id, nombre, dias_semana, precio_mensual, activo")
    .eq("id", e.cursoId)
    .maybeSingle();
  if (!curso) return { error: "El curso no existe." };
  if (!curso.activo) return { error: "El curso está desactivado." };

  const { data: alumno } = await sb
    .from("alumnos")
    .select("id, nombre, apellido")
    .eq("id", e.alumnoId)
    .maybeSingle();
  if (!alumno) return { error: "El alumno no existe." };

  const modalidad = e.modalidad as Modalidad;
  const inicio = parseFechaISO(e.fechaInicio);
  if (!inicio) return { error: "Fecha de inicio inválida." };
  const c = e.cobro;
  const glosa = medioGlosa(c);

  // ── Plan Regular (mensual): membresía + una cuota por ciclo ───────────
  if (modalidad === "mensual") {
    // No repetir una membresía activa del mismo alumno en el mismo curso.
    const { data: dup } = await sb
      .from("inscripciones")
      .select("id")
      .eq("alumno_id", e.alumnoId)
      .eq("curso_id", e.cursoId)
      .eq("modalidad", "mensual")
      .eq("estado", "activa")
      .maybeSingle();
    if (dup) return { error: "Este alumno ya tiene una membresía activa en este curso." };

    // Plan Regular del curso (dato autoritativo del servidor).
    const { data: plan } = await sb
      .from("planes")
      .select("id, cantidad_clases, precio")
      .eq("curso_id", e.cursoId)
      .eq("tipo_servicio", "curso_regular")
      .eq("modalidad", "mensual")
      .eq("activo", true)
      .order("id")
      .limit(1)
      .maybeSingle();
    if (!plan) return { error: "El curso no tiene un Plan Regular configurado." };

    const clasesPlan = plan.cantidad_clases as number | null;
    const precioUnit = Number(plan.precio);
    const referencia = Math.max(0, precioUnit);

    // fecha_fin = fecha de la clase N por el calendario del curso.
    let fechaFin: string | null = null;
    const dias = (curso.dias_semana as number[]) ?? [];
    if (clasesPlan && clasesPlan > 0 && dias.length > 0) {
      const clases = clasesPorConteo(dias, inicio, clasesPlan);
      const ultima = clases[clases.length - 1];
      if (ultima) fechaFin = isoFecha(ultima);
    }

    // Movimiento de dinero (recomputado): lo que se mueve = total − saldo.
    const mueveBruto = c.modo === "sin" ? 0 : Math.max(0, (Number(c.total) || 0) - (Number(c.saldo) || 0));
    const mueve = Math.min(referencia, Math.max(0, Math.round(mueveBruto)));
    const descManual = Math.min(referencia, Math.max(0, Math.round(Number(c.ajuste) || 0)));
    if (mueve > 0 && !c.medio) return { error: "Elegí el medio de pago." };
    if (descManual > 0 && !c.ajusteMotivo.trim())
      return { error: "El descuento manual necesita un motivo." };

    // Fecha de compromiso de pago (solo si queda saldo), tope por parámetro.
    const saldo = Math.max(0, referencia - mueve - descManual);
    let fechaCompromiso: string | null = null;
    if (saldo > 0) {
      const diasMax = Math.max(1, Number(await obtenerParametro("dias_compromiso_pago")) || 30);
      const fc = parseFechaISO(c.fechaCompromiso ?? "");
      if (!fc) return { error: "Cargá la fecha de compromiso de pago del saldo." };
      const hoy0 = hoyLocal();
      const maxF = new Date(hoy0);
      maxF.setDate(maxF.getDate() + diasMax);
      if (fc < hoy0) return { error: "La fecha de compromiso no puede ser anterior a hoy." };
      if (fc > maxF) return { error: `La fecha de compromiso no puede superar ${diasMax} días desde hoy.` };
      fechaCompromiso = isoFecha(fc);
    }

    // Membresía.
    const { data: insc, error: errInsc } = await a
      .from("inscripciones")
      .insert({
        alumno_id: e.alumnoId,
        curso_id: e.cursoId,
        modalidad: "mensual",
        fecha_inicio: isoFecha(inicio),
        estado: "activa",
        plan_id: plan.id,
        clases_plan: clasesPlan,
        ciclo_numero: 1,
        fecha_fin: fechaFin,
        clases_total: null,
        dias_elegidos: null,
        precio_aplicado: precioUnit,
      })
      .select("id")
      .single();
    if (errInsc) return { error: errInsc.message };
    const inscripcionId = insc.id as number;

    // Una sola cuota por el ciclo.
    const { data: cuota, error: errCuota } = await a
      .from("cuotas")
      .insert({
        inscripcion_id: inscripcionId,
        periodo: isoFecha(primerDiaDelMes(inicio)),
        monto_devengado: precioUnit,
        descuento_adelanto: 0,
        vencimiento: fechaCompromiso ?? isoFecha(sumarMeses(inicio, 1)),
        fecha_compromiso: fechaCompromiso,
        estado: "pendiente",
      })
      .select("id")
      .single();
    if (errCuota) return { error: errCuota.message };

    // Asentar el cobro contra la cuota del ciclo.
    const porDesc = Math.min(descManual, referencia);
    const porPlata = Math.min(mueve, referencia - porDesc);
    const saldado = porDesc + porPlata;
    const estadoCuota =
      referencia === 0 || saldado >= referencia ? "pagada" : saldado > 0 ? "parcial" : "pendiente";
    if (estadoCuota !== "pendiente")
      await a.from("cuotas").update({ estado: estadoCuota }).eq("id", cuota.id);
    if (porPlata > 0 || porDesc > 0) {
      const { error: errPago } = await a.from("pagos").insert({
        tipo: "cobro",
        motivo: "cuota",
        alumno_id: e.alumnoId,
        inscripcion_id: inscripcionId,
        cuota_id: cuota.id,
        monto: porPlata,
        medio: porPlata > 0 ? c.medio : null,
        descuento: porDesc,
        descuento_motivo: porDesc > 0 ? c.ajusteMotivo.trim() : null,
        glosa,
        registrado_por: perfil?.id ?? null,
      });
      if (errPago) return { error: "Se inscribió, pero falló registrar el cobro: " + errPago.message };
    }

    revalidatePath("/inscribir");
    return {
      ok: true,
      resumen: armarResumen(alumno, curso.nombre, "mensual", 1, inicio, porPlata, c.medio),
    };
  }

  // ── Parciales (clase/semana/medio_mes): flujo de paquete existente ────
  const [{ data: tarifaRows }, factorParam] = await Promise.all([
    sb.from("curso_tarifas").select("modalidad, precio").eq("curso_id", e.cursoId),
    obtenerParametro("medio_mes_factor"),
  ]);
  const tarifas = tarifasDesde((tarifaRows as { modalidad: string; precio: number }[]) ?? []);
  const factorMedio = Math.max(1, Number(factorParam) || 2);

  const precioUnit = precioModalidad(modalidad, Number(curso.precio_mensual), tarifas, 1);
  const referencia = Math.max(0, precioUnit);

  const diasElegidos =
    modalidad === "medio_mes" ? diasMedioMes(curso.dias_semana, e.diasElegidos) : null;
  const clasesTotal =
    clasesModalidad(curso.dias_semana, inicio, modalidad, factorMedio, e.diasElegidos).length ||
    (modalidad === "medio_mes" ? totalMedioMes(curso.dias_semana, factorMedio) : 1);

  const mueveBruto = c.modo === "sin" ? 0 : Math.max(0, (Number(c.total) || 0) - (Number(c.saldo) || 0));
  const mueve = Math.min(referencia, Math.max(0, Math.round(mueveBruto)));
  const descManual = Math.min(referencia, Math.max(0, Math.round(Number(c.ajuste) || 0)));
  if (mueve > 0 && !c.medio) return { error: "Elegí el medio de pago." };
  if (descManual > 0 && !c.ajusteMotivo.trim())
    return { error: "El descuento manual necesita un motivo." };

  const { data: insc, error: errInsc } = await a
    .from("inscripciones")
    .insert({
      alumno_id: e.alumnoId,
      curso_id: e.cursoId,
      modalidad,
      fecha_inicio: isoFecha(inicio),
      estado: "activa",
      clases_total: clasesTotal,
      dias_elegidos: diasElegidos,
      precio_aplicado: precioUnit,
    })
    .select("id")
    .single();
  if (errInsc) return { error: errInsc.message };
  const inscripcionId = insc.id as number;

  if (mueve > 0 || descManual > 0) {
    const porDesc = Math.min(descManual, referencia);
    const porPlata = Math.min(mueve, referencia - porDesc);
    const { error: errPago } = await a.from("pagos").insert({
      tipo: "cobro",
      motivo: "inscripcion",
      alumno_id: e.alumnoId,
      inscripcion_id: inscripcionId,
      monto: porPlata,
      medio: porPlata > 0 ? c.medio : null,
      descuento: porDesc,
      descuento_motivo: porDesc > 0 ? c.ajusteMotivo.trim() : null,
      glosa,
      registrado_por: perfil?.id ?? null,
    });
    if (errPago) return { error: "Se inscribió, pero falló registrar el cobro: " + errPago.message };
  }

  revalidatePath("/inscribir");
  return { ok: true, resumen: armarResumen(alumno, curso.nombre, modalidad, 1, inicio, mueve, c.medio) };
}

// ── Auxiliares ──────────────────────────────────────────────────────────

function parseFechaISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Hoy a medianoche local (para comparar contra fechas ISO sin hora). */
function hoyLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function medioGlosa(c: EntradaInscripcion["cobro"]): string | null {
  if (c.medio && /otro/i.test(c.medio) && c.notaMedio.trim()) return c.notaMedio.trim();
  return null;
}

function armarResumen(
  alumno: { nombre: string; apellido: string },
  curso: string,
  modalidad: Modalidad,
  meses: number,
  inicio: Date,
  mueve: number,
  medio: string | null
): string {
  const quien = `${alumno.nombre} ${alumno.apellido}`;
  const detalle =
    modalidad !== "mensual"
      ? ` (${ETIQUETA_MODALIDAD_LOWER[modalidad]})`
      : meses > 1
      ? ` (${meses} meses adelantados)`
      : "";
  const cobro = mueve > 0 ? `Cobrado ${gs(mueve)}${medio ? ` (${medio})` : ""}.` : "Sin cobro por ahora.";
  return `Inscripción de ${quien} en ${curso}${detalle}, empieza el ${fechaLarga(inicio)}. ${cobro}`;
}

const ETIQUETA_MODALIDAD_LOWER: Record<Modalidad, string> = {
  mensual: "mensual",
  clase: "una clase",
  semana: "una semana",
  medio_mes: "medio mes",
};
