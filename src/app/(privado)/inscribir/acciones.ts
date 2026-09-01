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
  descuentoAdelanto,
  diasMedioMes,
  fechaLarga,
  gs,
  isoFecha,
  precioModalidad,
  primerDiaDelMes,
  repartirDescuento,
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

  // No dejar dos inscripciones MENSUALES activas del mismo alumno en el mismo
  // curso. Las parciales (clase/semana/medio mes) son paquetes y sí pueden
  // repetirse.
  if (e.modalidad === "mensual") {
    const { data: dup } = await sb
      .from("inscripciones")
      .select("id")
      .eq("alumno_id", e.alumnoId)
      .eq("curso_id", e.cursoId)
      .eq("modalidad", "mensual")
      .eq("estado", "activa")
      .maybeSingle();
    if (dup)
      return { error: "Este alumno ya tiene una inscripción mensual activa en este curso." };
  }

  const [{ data: tarifaRows }, { data: descRows }, factorParam] = await Promise.all([
    sb.from("curso_tarifas").select("modalidad, precio").eq("curso_id", e.cursoId),
    sb.from("descuentos_adelanto").select("meses, porcentaje"),
    obtenerParametro("medio_mes_factor"),
  ]);

  const tarifas = tarifasDesde((tarifaRows as { modalidad: string; precio: number }[]) ?? []);
  const tabla: Record<number, number> = {};
  for (const r of (descRows as { meses: number; porcentaje: number }[]) ?? [])
    tabla[r.meses] = Number(r.porcentaje);
  const factorMedio = Math.max(1, Number(factorParam) || 2);

  const modalidad = e.modalidad as Modalidad;
  const esMensual = modalidad === "mensual";
  const meses = esMensual ? Math.max(1, Math.trunc(e.meses || 1)) : 1;

  // 2. Precios recomputados en el servidor.
  const precioUnit = precioModalidad(modalidad, Number(curso.precio_mensual), tarifas, 1);
  const subtotal = esMensual ? precioUnit * meses : precioUnit;
  const { monto: descTotal } = esMensual
    ? descuentoAdelanto(subtotal, meses, tabla)
    : { monto: 0 };
  const referencia = Math.max(0, subtotal - descTotal);

  // 3. Fecha de inicio y clases del paquete (parciales).
  const inicio = parseFechaISO(e.fechaInicio);
  if (!inicio) return { error: "Fecha de inicio inválida." };

  const diasElegidos =
    modalidad === "medio_mes" ? diasMedioMes(curso.dias_semana, e.diasElegidos) : null;
  const clasesTotal = esMensual
    ? null
    : clasesModalidad(curso.dias_semana, inicio, modalidad, factorMedio, e.diasElegidos).length ||
      (modalidad === "medio_mes" ? totalMedioMes(curso.dias_semana, factorMedio) : 1);

  // 4. Movimiento de dinero (recomputado): lo que se mueve = total − saldo.
  const c = e.cobro;
  const mueveBruto = c.modo === "sin" ? 0 : Math.max(0, (Number(c.total) || 0) - (Number(c.saldo) || 0));
  const mueve = Math.min(referencia, Math.max(0, Math.round(mueveBruto)));
  const descManual = Math.min(referencia, Math.max(0, Math.round(Number(c.ajuste) || 0)));

  if (mueve > 0 && !c.medio) return { error: "Elegí el medio de pago." };
  if (descManual > 0 && !c.ajusteMotivo.trim())
    return { error: "El descuento manual necesita un motivo." };

  // 5. Inscripción.
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

  // 6. Cuotas (solo mensual) y asentado del cobro contra ellas.
  const glosa = medioGlosa(c);
  let coberturaDisc = descManual; // el descuento "salda" sin mover plata
  let coberturaMoney = mueve;
  const pagosInsert: Record<string, unknown>[] = [];

  if (esMensual) {
    const descPorCuota = repartirDescuento(descTotal, meses);
    const cuotasInsert = Array.from({ length: meses }, (_, i) => ({
      inscripcion_id: inscripcionId,
      periodo: isoFecha(primerDiaDelMes(sumarMeses(inicio, i))),
      monto_devengado: precioUnit,
      descuento_adelanto: descPorCuota[i],
      vencimiento: isoFecha(sumarMeses(inicio, i)),
      estado: "pendiente",
    }));
    const { data: cuotas, error: errCuotas } = await a
      .from("cuotas")
      .insert(cuotasInsert)
      .select("id, monto_devengado, descuento_adelanto");
    if (errCuotas) return { error: errCuotas.message };

    for (const cuota of cuotas as {
      id: number;
      monto_devengado: number;
      descuento_adelanto: number;
    }[]) {
      const efectivo = Math.max(0, Number(cuota.monto_devengado) - Number(cuota.descuento_adelanto));
      const porDesc = Math.min(coberturaDisc, efectivo);
      coberturaDisc -= porDesc;
      const porPlata = Math.min(coberturaMoney, efectivo - porDesc);
      coberturaMoney -= porPlata;
      const saldado = porDesc + porPlata;
      const estado = efectivo === 0 || saldado >= efectivo ? "pagada" : saldado > 0 ? "parcial" : "pendiente";
      if (estado !== "pendiente") {
        await a.from("cuotas").update({ estado }).eq("id", cuota.id);
      }
      if (porPlata > 0 || porDesc > 0) {
        pagosInsert.push({
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
      }
    }
  } else if (mueve > 0 || descManual > 0) {
    // Parciales: un solo cobro contra la inscripción, sin cuota.
    const porDesc = Math.min(descManual, referencia);
    const porPlata = Math.min(mueve, referencia - porDesc);
    pagosInsert.push({
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
  }

  if (pagosInsert.length) {
    const { error: errPagos } = await a.from("pagos").insert(pagosInsert);
    if (errPagos) return { error: "Se inscribió, pero falló registrar el cobro: " + errPagos.message };
  }

  revalidatePath("/inscribir");
  return { ok: true, resumen: armarResumen(alumno, curso.nombre, modalidad, meses, inicio, mueve, c.medio) };
}

// ── Auxiliares ──────────────────────────────────────────────────────────

function parseFechaISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
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
