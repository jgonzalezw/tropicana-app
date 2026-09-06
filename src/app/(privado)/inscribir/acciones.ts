"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual } from "@/lib/sesion";
import { soloDigitos } from "@/lib/texto";
import type { Alumno, DatosAlumno, EntradaInscripcion } from "@/lib/tipos";
import {
  fechaClaseN,
  fechaLarga,
  gs,
  isoFecha,
  primerDiaDelMes,
  sumarMeses,
} from "@/lib/inscripcion";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

// ── Alta rápida de alumno desde la inscripción ──────────────────────────

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

// ── Vender plan y cobrar ────────────────────────────────────────────────

type ResultadoInscripcion = { ok?: true; resumen?: string; error?: string };

export async function inscribirYCobrar(e: EntradaInscripcion): Promise<ResultadoInscripcion> {
  if (!(await tienePermiso("inscripciones", "crear")))
    return { error: "No tenés permiso para inscribir." };

  const perfil = await obtenerPerfilActual();
  const a = admin();
  const sb = await createClient();

  const inicio = parseFechaISO(e.fechaInicio);
  if (!inicio) return { error: "Fecha de inicio inválida." };

  // 1. Alumno y plan (datos autoritativos del servidor).
  const { data: alumno } = await sb
    .from("alumnos")
    .select("id, nombre, apellido")
    .eq("id", e.alumnoId)
    .maybeSingle();
  if (!alumno) return { error: "El alumno no existe." };

  const { data: plan } = await sb
    .from("planes")
    .select("id, nombre, cantidad_clases, precio, activo")
    .eq("id", e.planId)
    .maybeSingle();
  if (!plan) return { error: "El plan no existe." };
  if (!plan.activo) return { error: "El plan está desactivado." };

  const clasesPlan = plan.cantidad_clases as number | null;
  if (!clasesPlan || clasesPlan <= 0)
    return { error: "El plan no tiene una cantidad de clases (N) cargada." };
  const precioUnit = Number(plan.precio);
  const referencia = Math.max(0, precioUnit);

  // 2. Cursos del plan (con sus días válidos).
  const { data: pcRows } = await sb
    .from("plan_cursos")
    .select("curso_id")
    .eq("plan_id", e.planId);
  const cursoIds = ((pcRows as { curso_id: number }[]) ?? []).map((r) => r.curso_id);
  if (cursoIds.length === 0) return { error: "El plan no tiene cursos asociados." };

  const { data: cursoRows } = await sb
    .from("cursos")
    .select("id, dias_semana")
    .in("id", cursoIds);
  const diasValidos = new Map<number, number[]>();
  for (const r of (cursoRows as { id: number; dias_semana: number[] }[]) ?? [])
    diasValidos.set(r.id, r.dias_semana ?? []);

  // 3. Validar la selección de días y armar la lista con repetición.
  const seleccion = (e.diasPorCurso ?? []).filter((x) => x.dias.length > 0);
  const diasConteo: number[] = [];
  for (const s of seleccion) {
    const validos = diasValidos.get(s.cursoId);
    if (!validos) return { error: "Un curso elegido no pertenece al plan." };
    for (const d of s.dias) {
      if (!validos.includes(d)) return { error: "Un día elegido no corresponde al curso." };
      diasConteo.push(d);
    }
  }
  if (diasConteo.length === 0) return { error: "Elegí al menos un día de clase." };

  const cursoPrincipal = seleccion[0].cursoId;
  const ultima = fechaClaseN(diasConteo, inicio, clasesPlan);
  const fechaFin = ultima ? isoFecha(ultima) : null;

  // 4. No repetir una membresía activa del mismo plan para el alumno.
  const { data: dup } = await sb
    .from("inscripciones")
    .select("id")
    .eq("alumno_id", e.alumnoId)
    .eq("plan_id", e.planId)
    .eq("estado", "activa")
    .maybeSingle();
  if (dup) return { error: "Este alumno ya tiene una membresía activa de este plan." };

  // 5. Movimiento de dinero (recomputado): lo que se mueve = total − saldo.
  const c = e.cobro;
  const glosa = medioGlosa(c);
  const mueveBruto = c.modo === "sin" ? 0 : Math.max(0, (Number(c.total) || 0) - (Number(c.saldo) || 0));
  const mueve = Math.min(referencia, Math.max(0, Math.round(mueveBruto)));
  const descManual = Math.min(referencia, Math.max(0, Math.round(Number(c.ajuste) || 0)));
  if (mueve > 0 && !c.medio) return { error: "Elegí el medio de pago." };
  if (descManual > 0 && !c.ajusteMotivo.trim())
    return { error: "El descuento manual necesita un motivo." };

  // 6. Fecha de compromiso de pago (solo si queda saldo), tope por parámetro.
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

  // 7. Membresía.
  const { data: insc, error: errInsc } = await a
    .from("inscripciones")
    .insert({
      alumno_id: e.alumnoId,
      curso_id: cursoPrincipal,
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

  // 8. Días elegidos por curso (inscripcion_cursos).
  const icRows = seleccion.map((s) => ({
    inscripcion_id: inscripcionId,
    curso_id: s.cursoId,
    dias: s.dias,
  }));
  const { error: errIC } = await a.from("inscripcion_cursos").insert(icRows);
  if (errIC) return { error: "Se creó la membresía, pero falló guardar los días: " + errIC.message };

  // 9. Una sola cuota por el ciclo.
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

  // 10. Asentar el cobro contra la cuota del ciclo.
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
    resumen: armarResumen(alumno, plan.nombre, inicio, porPlata, c.medio),
  };
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
  plan: string,
  inicio: Date,
  mueve: number,
  medio: string | null
): string {
  const quien = `${alumno.nombre} ${alumno.apellido}`;
  const cobro = mueve > 0 ? `Cobrado ${gs(mueve)}${medio ? ` (${medio})` : ""}.` : "Sin cobro por ahora.";
  return `Membresía de ${quien} — ${plan}, empieza el ${fechaLarga(inicio)}. ${cobro}`;
}
