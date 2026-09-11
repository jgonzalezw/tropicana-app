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
import { recalcularFinDeCiclo, registrarCorrimientosPendientes } from "@/lib/membresias";
import { exigir } from "@/lib/datos";

const DIAS_ROTULO = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
/** "martes y jueves" — para decirle a la persona qué días sí tiene el curso. */
function rotuloDias(dias: number[]): string {
  const n = dias.map((d) => DIAS_ROTULO[d]).filter(Boolean);
  if (n.length <= 1) return n[0] ?? "sin días cargados";
  return `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`;
}

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
    .select("id, nombre, cantidad_clases, precio, activo, acceso_modo, clases_ilimitadas, ciclo_dias")
    .eq("id", e.planId)
    .maybeSingle();
  if (!plan) return { error: "El plan no existe." };
  if (!plan.activo) return { error: "El plan está desactivado." };

  const ilimitado = plan.clases_ilimitadas as boolean;
  const cicloDias = plan.ciclo_dias as number | null;
  const clasesPlanBase = ilimitado ? null : (plan.cantidad_clases as number | null);
  if (ilimitado) {
    if (!cicloDias || cicloDias <= 0)
      return { error: "El plan ilimitado no tiene duración de ciclo (días)." };
  } else if (!clasesPlanBase || clasesPlanBase <= 0) {
    return { error: "El plan no tiene una cantidad de clases (N) cargada." };
  }

  // Bono de tolerancia pendiente: faltas con licencia de ciclos completados del
  // mismo plan aun no redimidas. Suma clases al nuevo ciclo (solo planes con N).
  let bono = 0;
  let bonoOrigenIds: number[] = [];
  if (!ilimitado) {
    const { data: previos } = await sb
      .from("inscripciones")
      .select("id, bono_generado")
      .eq("alumno_id", e.alumnoId)
      .eq("plan_id", e.planId)
      .eq("estado", "completada")
      .eq("bono_redimido", false)
      .gt("bono_generado", 0);
    const rows = (previos as { id: number; bono_generado: number }[]) ?? [];
    bono = rows.reduce((s, r) => s + Math.max(0, Number(r.bono_generado)), 0);
    bonoOrigenIds = rows.map((r) => r.id);
  }
  const clasesPlan = clasesPlanBase != null ? clasesPlanBase + bono : null;
  const precioUnit = Number(plan.precio);
  const referencia = Math.max(0, precioUnit);

  // 2. Cursos a los que da acceso el plan (segun acceso_modo), con sus días.
  const acceso = (plan.acceso_modo as string) ?? "solo";
  const { data: pcRows } = await sb
    .from("plan_cursos")
    .select("curso_id")
    .eq("plan_id", e.planId);
  const seleccionados = new Set(((pcRows as { curso_id: number }[]) ?? []).map((r) => r.curso_id));

  const diasValidos = new Map<number, number[]>();
  if (acceso === "todas" || acceso === "excepto") {
    const { data: cursoRows } = await sb
      .from("cursos")
      .select("id, dias_semana")
      .eq("activo", true);
    for (const r of (cursoRows as { id: number; dias_semana: number[] }[]) ?? []) {
      if (acceso === "excepto" && seleccionados.has(r.id)) continue;
      diasValidos.set(r.id, r.dias_semana ?? []);
    }
  } else {
    if (seleccionados.size === 0) return { error: "El plan no tiene cursos asociados." };
    const { data: cursoRows } = await sb
      .from("cursos")
      .select("id, dias_semana")
      .in("id", [...seleccionados]);
    for (const r of (cursoRows as { id: number; dias_semana: number[] }[]) ?? [])
      diasValidos.set(r.id, r.dias_semana ?? []);
  }
  if (diasValidos.size === 0) return { error: "El plan no tiene cursos disponibles." };

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
  let fechaFin: string | null = null;
  if (ilimitado && cicloDias) {
    const f = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    f.setDate(f.getDate() + cicloDias);
    fechaFin = isoFecha(f);
  } else if (clasesPlan) {
    const ultima = fechaClaseN(diasConteo, inicio, clasesPlan);
    fechaFin = ultima ? isoFecha(ultima) : null;
  }

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

  // Marcar como redimidos los bonos que se aplicaron a este ciclo.
  if (bono > 0 && bonoOrigenIds.length)
    await a.from("inscripciones").update({ bono_redimido: true }).in("id", bonoOrigenIds);

  // 8. Días elegidos por curso (inscripcion_cursos).
  const icRows = seleccion.map((s) => ({
    inscripcion_id: inscripcionId,
    curso_id: s.cursoId,
    dias: s.dias,
  }));
  const { error: errIC } = await a.from("inscripcion_cursos").insert(icRows);
  if (errIC) return { error: "Se creó la membresía, pero falló guardar los días: " + errIC.message };

  // El fin de ciclo se calcula recién ahora, con los días ya guardados: la
  // proyección de arriba no sabe de clases suspendidas, y una venta con fecha
  // retroactiva puede cubrir clases que ya se suspendieron. Se recalcula y se
  // deja la traza de esos corrimientos, que antes nunca se registraban.
  await recalcularFinDeCiclo(a, inscripcionId);
  await registrarCorrimientosPendientes(a, inscripcionId, perfil?.id ?? null);

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
      motivo: "membresia",
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
    resumen: armarResumen(alumno, plan.nombre, inicio, porPlata, c.medio, bono),
  };
}

// ── Venta de clase de prueba ────────────────────────────────────────────

/** Lo que la pantalla manda para vender una prueba. */
export type EntradaPrueba = {
  alumnoId: number;
  planId: number;
  /**
   * Cursos que va a probar, **con la fecha de su clase**: una clase en cada
   * uno, y cada una puede caer un día distinto. Por eso la fecha es por curso
   * y no una sola de la membresía (0024, pedido de Javier).
   */
  cursos: { cursoId: number; fecha: string }[];
  /** Acompañantes SIN identificar. Personas cubiertas = 1 + esto. */
  acompanantes: number;
  cobro: EntradaInscripcion["cobro"];
};

/**
 * Vende una clase de prueba: una **membresía preliminar** del mismo plan
 * regular (regla 11 de `docs/REGLAS.md`). No es un plan aparte.
 *
 * El monto es la **suma del precio de prueba de los cursos elegidos**, por la
 * cantidad de personas — no el precio del plan. El grupo es un titular
 * identificado más N acompañantes sin nombre, con un solo monto.
 *
 * La membresía nace con `clases_plan` = cantidad de cursos elegidos (una clase
 * en cada uno) y sin tolerancia: una prueba no genera bono.
 */
export async function venderPrueba(
  e: EntradaPrueba
): Promise<{ ok?: true; error?: string; resumen?: string }> {
  if (!(await tienePermiso("inscripciones", "crear")))
    return { error: "No tenés permiso para vender." };

  const sb = await createClient();
  const a = admin();
  const perfil = await obtenerPerfilActual();

  // Una fecha por curso: cada clase de prueba cae en su propio día. El inicio
  // de la membresía es la primera y el fin la última — la prueba dura
  // exactamente lo que sus clases, ni un día más.
  const elegidos = (e.cursos ?? []).filter((c) => Number.isFinite(c.cursoId));
  if (!elegidos.length) return { error: "Elegí al menos un curso para probar." };
  for (const c of elegidos)
    if (!parseFechaISO(c.fecha)) return { error: "Falta la fecha de la clase de un curso." };
  const fechasOrdenadas = elegidos.map((c) => c.fecha).sort();
  const inicio = parseFechaISO(fechasOrdenadas[0])!;
  const finPrueba = fechasOrdenadas[fechasOrdenadas.length - 1];

  const { data: alumno } = await sb
    .from("alumnos")
    .select("id, nombre, apellido")
    .eq("id", e.alumnoId)
    .maybeSingle();
  if (!alumno) return { error: "El alumno no existe." };

  const { data: plan } = await sb
    .from("planes")
    .select("id, nombre, acepta_prueba, prueba_cursos_max, acceso_modo")
    .eq("id", e.planId)
    .maybeSingle();
  if (!plan) return { error: "El plan no existe." };
  if (!plan.acepta_prueba) return { error: "Ese plan no se ofrece como clase de prueba." };

  const cursoIds = [...new Set(elegidos.map((c) => c.cursoId))];
  if (cursoIds.length !== elegidos.length)
    return { error: "Un curso aparece repetido en la prueba." };
  const fechaPorCurso = new Map(elegidos.map((c) => [c.cursoId, c.fecha]));
  const tope = Math.max(1, Number(plan.prueba_cursos_max) || 1);
  if (cursoIds.length > tope)
    return { error: `Este plan permite probar ${tope} ${tope === 1 ? "curso" : "cursos"}.` };

  // Los cursos tienen que pertenecer al plan.
  const permitidos = await cursosDelPlan(sb, plan.id, (plan.acceso_modo as string) ?? "solo");
  const fuera = cursoIds.filter((c) => !permitidos.has(c));
  if (fuera.length) return { error: "Un curso elegido no pertenece al plan." };

  // Precio de prueba de cada curso. Sin precio no se vende: no se inventa 0.
  const { data: tarifas } = await sb
    .from("curso_tarifas")
    .select("curso_id, precio")
    .eq("modalidad", "prueba")
    .in("curso_id", cursoIds);
  const precioPrueba = new Map(
    ((tarifas as { curso_id: number; precio: number }[]) ?? []).map((t) => [
      t.curso_id,
      Number(t.precio),
    ])
  );
  const sinPrecio = cursoIds.filter((c) => !(precioPrueba.get(c)! > 0));
  if (sinPrecio.length)
    return { error: "Falta cargar el precio de prueba de un curso elegido (ficha del curso)." };

  // Cada fecha tiene que ser un día en que ESE curso se dicta. Sin esta
  // validación entró una prueba de Bachata Conexión (martes y jueves) un
  // sábado: una "clase" que no existe, que nunca aparece en un padrón y que
  // no liquida. La pantalla ya solo ofrece clases reales; esto lo sostiene
  // aunque la pantalla cambie.
  const cursoRows = exigir(
    await sb.from("cursos").select("id, nombre, dias_semana").in("id", cursoIds),
    "los cursos de la prueba"
  ) as { id: number; nombre: string; dias_semana: number[] }[];
  const suspendidasPrueba = exigir(
    await sb
      .from("sesiones")
      .select("curso_id, fecha")
      .eq("estado", "suspendida")
      .in("curso_id", cursoIds),
    "las clases suspendidas"
  ) as { curso_id: number; fecha: string }[];
  const suspSet = new Set(suspendidasPrueba.map((x) => `${x.curso_id}|${x.fecha}`));

  for (const cu of cursoRows) {
    const f = fechaPorCurso.get(cu.id);
    const d = f ? parseFechaISO(f) : null;
    if (!d) return { error: `Falta la fecha de la clase de ${cu.nombre}.` };
    const diaIso = d.getDay() === 0 ? 7 : d.getDay();
    if (!(cu.dias_semana ?? []).includes(diaIso))
      return {
        error: `${cu.nombre} no se dicta ese día: elegí una de sus clases (${rotuloDias(cu.dias_semana ?? [])}).`,
      };
    // Una clase suspendida no se dictó: no se puede probar en ella.
    if (suspSet.has(`${cu.id}|${f}`))
      return { error: `La clase de ${cu.nombre} de ese día está suspendida: elegí otra.` };
  }

  const acompanantes = Math.max(0, Math.trunc(Number(e.acompanantes) || 0));
  const personas = 1 + acompanantes;
  const referencia = cursoIds.reduce((t, c) => t + (precioPrueba.get(c) ?? 0), 0) * personas;

  // El cobro se recomputa en el servidor, igual que la venta de plan.
  const c = e.cobro;
  const mueve = Math.max(0, Math.round(Number(c.monto) || 0));
  const descManual = Math.max(0, Math.round(Number(c.ajuste) || 0));
  if (descManual > 0 && !c.ajusteMotivo.trim())
    return { error: "El descuento manual necesita un motivo." };

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

  // La membresía preliminar. Sin tolerancia: una prueba no genera bono.
  const { data: insc, error: errInsc } = await a
    .from("inscripciones")
    .insert({
      alumno_id: e.alumnoId,
      curso_id: cursoIds[0],
      modalidad: "clase",
      fecha_inicio: isoFecha(inicio),
      fecha_fin: finPrueba,
      estado: "activa",
      plan_id: plan.id,
      es_prueba: true,
      acompanantes,
      clases_plan: cursoIds.length,
      ciclo_numero: 1,
      tolerancia_faltas: 0,
      clases_total: null,
      dias_elegidos: null,
      precio_aplicado: referencia,
    })
    .select("id")
    .single();
  if (errInsc) return { error: errInsc.message };
  const inscripcionId = insc.id as number;

  // La clase de cada curso: la FECHA elegida es la que manda (es la que hace
  // aparecer al alumno en ese padrón y en ningún otro día). `dias` guarda los
  // días reales del curso, que es lo que le permite al motor correr la prueba
  // a la clase siguiente si la elegida se suspende (regla de negocio 4).
  const icRows = cursoRows.map((cu) => ({
    inscripcion_id: inscripcionId,
    curso_id: cu.id,
    dias: cu.dias_semana ?? [],
    fecha: fechaPorCurso.get(cu.id) ?? null,
  }));
  if (icRows.length) {
    const { error: errIC } = await a.from("inscripcion_cursos").insert(icRows);
    if (errIC) return { error: "Se creó la prueba, pero falló guardar las clases: " + errIC.message };
  }

  await recalcularFinDeCiclo(a, inscripcionId);
  await registrarCorrimientosPendientes(a, inscripcionId, perfil?.id ?? null);

  //
  // Una prueba con fecha pasada YA ocurrió: inscribirla con esa fecha es la
  // manifestación explícita de que el alumno la tomó (Javier, 2026-09-11). Así
  // que su asistencia se confirma sola, sin que nadie tenga que pasar por el
  // padrón — y sin tocar el estado de la clase: no la reabre ni la marca
  // incompleta. Es lo que hace que la prueba entre a liquidación por sí misma.
  //
  // Solo si la clase existe y se dictó. Si no hay sesión, la clase todavía no
  // se registró: crearla acá cambiaría el estado de una clase que nadie dictó.
  const hoyIso = isoFecha(hoyLocal());
  const pasadas = cursoRows
    .map((cu) => ({ cursoId: cu.id, fecha: fechaPorCurso.get(cu.id)! }))
    .filter((x) => x.fecha < hoyIso);
  let confirmadas = 0;
  for (const x of pasadas) {
    const { data: ses } = await a
      .from("sesiones")
      .select("id, estado")
      .eq("curso_id", x.cursoId)
      .eq("fecha", x.fecha)
      .maybeSingle();
    if (!ses || ses.estado !== "dictada") continue;
    const { data: ya } = await a
      .from("asistencias")
      .select("id")
      .eq("sesion_id", ses.id)
      .eq("alumno_id", e.alumnoId)
      .maybeSingle();
    if (ya) continue;
    const { error: errAsis } = await a.from("asistencias").insert({
      sesion_id: ses.id,
      alumno_id: e.alumnoId,
      inscripcion_id: inscripcionId,
      estado: "presente",
      con_licencia: false,
      registrado_por: perfil?.id ?? null,
    });
    if (!errAsis) confirmadas++;
  }

  // Toda venta tiene su cuota (regla 7).
  const { data: cuota, error: errCuota } = await a
    .from("cuotas")
    .insert({
      inscripcion_id: inscripcionId,
      periodo: isoFecha(primerDiaDelMes(inicio)),
      monto_devengado: referencia,
      descuento_adelanto: 0,
      vencimiento: fechaCompromiso ?? isoFecha(sumarMeses(inicio, 1)),
      fecha_compromiso: fechaCompromiso,
      estado: "pendiente",
    })
    .select("id")
    .single();
  if (errCuota) return { error: errCuota.message };

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
      motivo: "membresia",
      alumno_id: e.alumnoId,
      inscripcion_id: inscripcionId,
      cuota_id: cuota.id,
      monto: porPlata,
      medio: porPlata > 0 ? c.medio : null,
      descuento: porDesc,
      descuento_motivo: porDesc > 0 ? c.ajusteMotivo.trim() : null,
      glosa: medioGlosa(c),
      registrado_por: perfil?.id ?? null,
    });
    if (errPago) return { error: "Se vendió la prueba, pero falló el cobro: " + errPago.message };
  }

  revalidatePath("/inscribir");
  const quien = `${alumno.nombre} ${alumno.apellido}`;
  const gente = personas === 1 ? "1 persona" : `${personas} personas`;
  const cursosTxt = cursoIds.length === 1 ? "1 curso" : `${cursoIds.length} cursos`;

  // Cuándo asiste: se leen las fechas que quedaron guardadas, no las que la
  // pantalla calculó — es lo que confirma que las dos coinciden. Se listan
  // TODAS: con dos cursos hay dos clases, en días distintos, y mostrar una
  // sola dejaba la otra invisible.
  const guardadas = exigir(
    await sb
      .from("inscripcion_cursos")
      .select("curso_id, fecha")
      .eq("inscripcion_id", inscripcionId),
    "las clases de la prueba"
  ) as { curso_id: number; fecha: string | null }[];
  const nombreCurso = new Map(cursoRows.map((c) => [c.id, c.nombre]));
  const clases = guardadas
    .filter((g) => g.fecha)
    .sort((x, y) => (x.fecha! < y.fecha! ? -1 : 1))
    .map((g) => `${nombreCurso.get(g.curso_id) ?? "curso"} el ${fechaLarga(new Date(g.fecha! + "T00:00:00"))}`);
  // Pasada la fecha ya ocurrió: decir "asiste" sobre una fecha vieja hace
  // dudar de si el sistema entendió bien. Y si vienen varios, van en plural.
  const todasPasadas = guardadas.every((g) => g.fecha && g.fecha < isoFecha(hoyLocal()));
  const verbo = todasPasadas
    ? personas === 1 ? "Asistió" : "Asistieron"
    : personas === 1 ? "Asiste" : "Asisten";
  const asiste = clases.length ? ` ${verbo} a ${clases.join(" y ")}.` : "";
  const nota = confirmadas > 0
    ? ` Asistencia confirmada en ${confirmadas === 1 ? "la clase ya dictada" : `${confirmadas} clases ya dictadas`}.`
    : "";

  return {
    ok: true,
    resumen:
      `Clase de prueba de ${quien} — ${cursosTxt}, ${gente}, ${gs(referencia)}.${asiste} ` +
      (porPlata > 0 ? `Cobrado ${gs(porPlata)}${c.medio ? ` (${c.medio})` : ""}.` : "Sin cobro por ahora.") +
      nota,
  };
}

/** Ids de los cursos a los que un plan da acceso, según su modo. */
async function cursosDelPlan(
  sb: Awaited<ReturnType<typeof createClient>>,
  planId: number,
  modo: string
): Promise<Set<number>> {
  const { data: activos } = await sb.from("cursos").select("id").eq("activo", true);
  const todos = new Set(((activos as { id: number }[]) ?? []).map((c) => c.id));
  if (modo === "todas") return todos;
  const { data: pc } = await sb.from("plan_cursos").select("curso_id").eq("plan_id", planId);
  const sel = new Set(((pc as { curso_id: number }[]) ?? []).map((r) => r.curso_id));
  if (modo === "excepto") return new Set([...todos].filter((c) => !sel.has(c)));
  return sel;
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
  medio: string | null,
  bono: number
): string {
  const quien = `${alumno.nombre} ${alumno.apellido}`;
  const cobro = mueve > 0 ? `Cobrado ${gs(mueve)}${medio ? ` (${medio})` : ""}.` : "Sin cobro por ahora.";
  const notaBono =
    bono > 0 ? ` Se aplicó bono de tolerancia: +${bono} ${bono === 1 ? "clase" : "clases"}.` : "";
  return `Membresía de ${quien} — ${plan}, empieza el ${fechaLarga(inicio)}. ${cobro}${notaBono}`;
}
