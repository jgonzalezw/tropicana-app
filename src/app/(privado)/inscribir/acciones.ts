"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual } from "@/lib/sesion";
import { validarIdentidadAlumno, validarFechaNacimiento } from "@/lib/contactos";
import { contextoAlumno, presenteDesdeExtra } from "@/lib/matrizMinimos";
import type { Alumno, CobroInscripcion, Contacto, DatosAlumno, EntradaInscripcion } from "@/lib/tipos";
import {
  crearOReusarContactoPersona,
  resolverTutor,
  vincularTutor,
  guardarDatosExtra,
  validarContraMatriz,
} from "@/app/(privado)/contactos/acciones";
import {
  fechaClaseN,
  fechaLarga,
  gs,
  isoFecha,
  primerDiaDelMes,
  sumarMeses,
} from "@/lib/inscripcion";
import { recalcularFinDeCiclo, recalcularMembresia, registrarCorrimientosPendientes } from "@/lib/membresias";
import { exigir } from "@/lib/datos";
import {
  COLS_VIGENCIA,
  enVigencia,
  motivoFueraDeVigencia,
  type VigenciaCurso,
} from "@/lib/vigencia";
import { validarReservaSala, ocupacionDeProfesor } from "@/lib/reservas";
import { ocupacionDelDia, type CursoOcupa, type ExcepcionHorario, type FranjaPatron, type ReservaSalaOcupa } from "@/lib/sala";
import { COLUMNAS_ASIGNACION } from "@/lib/asignaciones";
import { vigenciaDiasEfectiva } from "@/lib/planesParticular";

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
// Mismo camino que `alumnos/acciones.ts:crearAlumno` — un contacto por
// persona, creado o reusado antes que la fila de alumno — para no repetir
// la validación ni la normalización del WhatsApp (estaba duplicada acá).

export async function crearAlumnoDesdeInscripcion(
  d: DatosAlumno
): Promise<{ alumno?: Alumno; error?: string }> {
  if (!(await tienePermiso("alumnos", "crear"))) return { error: "Sin permiso para crear alumnos." };
  const err = validarIdentidadAlumno(d);
  if (err) return { error: err };
  const errEdad = validarFechaNacimiento(d.fecha_nacimiento, d.es_menor);
  if (errEdad) return { error: errEdad };

  const contexto = contextoAlumno({ esMenor: d.es_menor, enPrueba: d.enPrueba ?? false });
  const errMatriz = await validarContraMatriz(contexto, {
    nombre: !!d.nombre.trim(),
    apellido: !!d.apellido.trim(),
    canal_captacion: !!d.canal_captacion,
    ...presenteDesdeExtra(d),
  });
  if (errMatriz) return { error: errMatriz };

  const { contacto, error: errContacto } = await crearOReusarContactoPersona({
    nombre: d.nombre,
    apellido: d.apellido,
    whatsapp: d.es_menor ? null : d.whatsapp,
    canal_captacion: d.canal_captacion,
    sexo: d.sexo,
    email: d.email,
    reusarSiExiste: false,
  });
  if (errContacto || !contacto) return { error: errContacto ?? "No se pudo crear el contacto." };

  let tutor: Contacto | null = null;
  if (d.es_menor) {
    const r = await resolverTutor(d);
    if (r.error || !r.contacto) return { error: r.error ?? "No se pudo resolver el tutor." };
    tutor = r.contacto;
    const errRel = await vincularTutor(tutor.id, contacto.id);
    if (errRel.error) return { error: errRel.error };
  }

  const { data, error } = await admin()
    .from("alumnos")
    .insert({ contacto_id: contacto.id, es_menor: d.es_menor })
    .select("id, contacto_id, es_menor, activo, creado_en, actualizado_en")
    .single();

  if (error) return { error: error.message };

  const errExtra = await guardarDatosExtra(contacto.id, d);
  if (errExtra.error) return { error: errExtra.error };

  revalidatePath("/inscribir");
  return { alumno: { ...(data as Omit<Alumno, "contacto" | "tutor">), contacto, tutor } };
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

  // Una venta retroactiva **ya no se bloquea** (regla de negocio 16, revisada
  // 2026-09-12). Cada membresía se reparte sola, con su propia plata: agregar
  // una no cambia el conteo ni el reparto de ninguna otra, así que no puede
  // mover una comisión ya pagada. Se liquida después, como complemento.
  // Lo que sí sigue protegido es tocar una clase de la que depende un
  // prorrateo ya pagado — eso vive en Asistencia, donde se toca la clase.

  // 1. Alumno y plan (datos autoritativos del servidor).
  const { data: alumnoRowRaw } = await sb
    .from("alumnos")
    .select("id, contacto:contactos(nombre, apellido)")
    .eq("id", e.alumnoId)
    .maybeSingle();
  const alumnoRow = alumnoRowRaw as unknown as { id: number; contacto: { nombre: string | null; apellido: string | null } | null } | null;
  if (!alumnoRow) return { error: "El alumno no existe." };
  const alumno = { nombre: alumnoRow.contacto?.nombre ?? "", apellido: alumnoRow.contacto?.apellido ?? "" };

  const { data: plan } = await sb
    .from("planes")
    .select("id, nombre, cantidad_clases, precio, activo, acceso_modo, clases_ilimitadas, ciclo_dias, prueba_acredita, prueba_plazo_dias")
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
      .from("membresias")
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
  // Conversión: si el alumno probó este mismo plan y el plan acredita el fee,
  // lo que pagó por la prueba se le descuenta de la membresía (regla 11).
  const conversion = await pruebaConvertible(sb, {
    alumnoId: e.alumnoId,
    planId: e.planId,
    acredita: plan.prueba_acredita !== false,
    plazoDias: (plan.prueba_plazo_dias as number | null) ?? null,
    fechaVentaISO: e.fechaInicio,
  });

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

  type CursoVenta = { id: number; nombre: string; dias_semana: number[] } & VigenciaCurso;
  const COLS_CURSO = `id, nombre, dias_semana, ${COLS_VIGENCIA}`;
  const diasValidos = new Map<number, number[]>();
  const cursoDeVenta = new Map<number, CursoVenta>();
  if (acceso === "todas" || acceso === "excepto") {
    const { data: cursoRows } = await sb.from("cursos").select(COLS_CURSO).eq("activo", true);
    for (const r of (cursoRows as unknown as CursoVenta[]) ?? []) {
      if (acceso === "excepto" && seleccionados.has(r.id)) continue;
      diasValidos.set(r.id, r.dias_semana ?? []);
      cursoDeVenta.set(r.id, r);
    }
  } else {
    if (seleccionados.size === 0) return { error: "El plan no tiene cursos asociados." };
    const { data: cursoRows } = await sb
      .from("cursos")
      .select(COLS_CURSO)
      .in("id", [...seleccionados]);
    for (const r of (cursoRows as unknown as CursoVenta[]) ?? []) {
      diasValidos.set(r.id, r.dias_semana ?? []);
      cursoDeVenta.set(r.id, r);
    }
  }
  if (diasValidos.size === 0) return { error: "El plan no tiene cursos disponibles." };

  // 3. Validar la selección de días y armar la lista con repetición.
  const seleccion = (e.diasPorCurso ?? []).filter((x) => x.dias.length > 0);
  const diasConteo: number[] = [];
  for (const s of seleccion) {
    const validos = diasValidos.get(s.cursoId);
    if (!validos) return { error: "Un curso elegido no pertenece al plan." };
    // **Vigencia del curso** (0033): no se vende un plan con un curso que no
    // corría al empezar el ciclo. Javier: si la clase retroactiva existió, lo
    // que se corrige es la fecha de activación del curso, no la venta.
    const cv = cursoDeVenta.get(s.cursoId);
    if (cv && !enVigencia(cv, e.fechaInicio))
      return { error: motivoFueraDeVigencia(cv.nombre, cv, e.fechaInicio) };
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
    .from("membresias")
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
  // El crédito de la prueba cuenta como cobrado: si no, una venta pagada al
  // contado quedaba con un saldo fantasma del tamaño del crédito y pedía una
  // fecha de compromiso que no correspondía.
  const creditoPrev = Math.min(conversion?.monto ?? 0, referencia);
  const saldo = Math.max(0, referencia - creditoPrev - mueve - descManual);
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
    .from("membresias")
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
      // De dónde viene esta membresía: la prueba que el prospecto convirtió.
      membresia_anterior_id: conversion?.pruebaId ?? null,
    })
    .select("id")
    .single();
  if (errInsc) return { error: errInsc.message };
  const inscripcionId = insc.id as number;

  // Marcar como redimidos los bonos que se aplicaron a este ciclo.
  if (bono > 0 && bonoOrigenIds.length)
    await a.from("membresias").update({ bono_redimido: true }).in("id", bonoOrigenIds);

  // 8. Días elegidos por curso (membresia_cursos).
  const icRows = seleccion.map((s) => ({
    membresia_id: inscripcionId,
    curso_id: s.cursoId,
    dias: s.dias,
  }));
  const { error: errIC } = await a.from("membresia_cursos").insert(icRows);
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
      membresia_id: inscripcionId,
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
  // El crédito de la prueba es un DESCUENTO, no plata: baja lo que el alumno
  // paga, y no suma a la base de comisión (regla 8) — el profesor ya cobró su
  // parte cuando se vendió la prueba. Va en su propia línea para poder
  // auditarlo aparte del descuento manual, que tiene otro motivo.
  const credito = creditoPrev;
  const porDesc = Math.min(descManual, Math.max(0, referencia - credito));
  const porPlata = Math.min(mueve, Math.max(0, referencia - credito - porDesc));
  const saldado = credito + porDesc + porPlata;
  const estadoCuota =
    referencia === 0 || saldado >= referencia ? "pagada" : saldado > 0 ? "parcial" : "pendiente";
  if (estadoCuota !== "pendiente")
    await a.from("cuotas").update({ estado: estadoCuota }).eq("id", cuota.id);
  if (porPlata > 0 || porDesc > 0) {
    const { error: errPago } = await a.from("pagos").insert({
      tipo: "cobro",
      motivo: "membresia",
      alumno_id: e.alumnoId,
      membresia_id: inscripcionId,
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
  if (credito > 0 && conversion) {
    const { error: errCred } = await a.from("pagos").insert({
      tipo: "cobro",
      motivo: "membresia",
      alumno_id: e.alumnoId,
      membresia_id: inscripcionId,
      cuota_id: cuota.id,
      monto: 0,
      medio: null,
      descuento: credito,
      descuento_motivo:
        `Crédito de clase de prueba (membresía #${conversion.pruebaId})` +
        (conversion.personas > 1
          ? ` — su parte de ${gs(conversion.pagado)} pagados por ${conversion.personas} personas`
          : ""),
      glosa: "Conversión de clase de prueba",
      registrado_por: perfil?.id ?? null,
    });
    if (errCred)
      return { error: "Se inscribió, pero falló acreditar la clase de prueba: " + errCred.message };
  }

  revalidatePath("/inscribir");
  return {
    ok: true,
    resumen:
      armarResumen(alumno, plan.nombre, inicio, porPlata, c.medio, bono) +
      (credito > 0 ? ` Se acreditó ${gs(credito)} de su clase de prueba.` : ""),
  };
}

/**
 * La clase de prueba que este alumno puede convertir en esta venta, si la hay.
 *
 * **Qué habilita el crédito** (regla 11): el alumno probó **este mismo plan**,
 * el plan acredita el fee (`prueba_acredita`), la prueba todavía está dentro
 * del plazo, y nadie la convirtió ya. El monto acreditado es lo que
 * **efectivamente pagó** por la prueba: si quedó debiendo parte, esa parte no
 * se le acredita porque nunca entró.
 *
 * El plazo lo fija el plan; si no lo fija, el parámetro `prueba_plazo_dias`.
 * Se cuenta desde la **última clase de la prueba**, que es cuando el prospecto
 * terminó de probar y tiene que decidir.
 */
async function pruebaConvertible(
  sb: Awaited<ReturnType<typeof createClient>>,
  args: {
    alumnoId: number;
    planId: number;
    acredita: boolean;
    plazoDias: number | null;
    fechaVentaISO: string;
  }
): Promise<{ pruebaId: number; monto: number; vence: string; personas: number; pagado: number } | null> {
  if (!args.acredita) return null;

  const pruebas = exigir(
    await sb
      .from("membresias")
      .select("id, fecha_fin, acompanantes")
      .eq("alumno_id", args.alumnoId)
      .eq("plan_id", args.planId)
      .eq("es_prueba", true)
      .neq("estado", "baja")
      .order("fecha_fin", { ascending: false }),
    "las clases de prueba del alumno"
  ) as { id: number; fecha_fin: string | null; acompanantes: number | null }[];
  if (!pruebas.length) return null;

  const plazo =
    args.plazoDias ?? Math.max(0, Number(await obtenerParametro("prueba_plazo_dias")) || 7);

  // Ya convertidas: una prueba se acredita una sola vez.
  const yaConvertidas = exigir(
    await sb
      .from("membresias")
      .select("membresia_anterior_id")
      .in("membresia_anterior_id", pruebas.map((p) => p.id)),
    "las conversiones previas"
  ) as { membresia_anterior_id: number | null }[];
  const usadas = new Set(yaConvertidas.map((x) => x.membresia_anterior_id));

  for (const pr of pruebas) {
    if (usadas.has(pr.id)) continue;
    if (!pr.fecha_fin) continue;
    const vence = sumarDias(pr.fecha_fin, plazo);
    if (args.fechaVentaISO > vence) continue; // fuera de plazo

    // Lo efectivamente cobrado por esa prueba.
    const cuotas = exigir(
      await sb.from("cuotas").select("id").eq("membresia_id", pr.id),
      "las cuotas de la prueba"
    ) as { id: number }[];
    if (!cuotas.length) continue;
    const pagos = exigir(
      await sb
        .from("pagos")
        .select("monto")
        .eq("tipo", "cobro")
        .in("cuota_id", cuotas.map((q) => q.id)),
      "los pagos de la prueba"
    ) as { monto: number }[];
    const pagado = pagos.reduce((t, x) => t + Number(x.monto), 0);
    if (pagado <= 0) continue; // no pagó nada: no hay qué acreditar

    // **Se acredita LA PARTE DE ESTE ALUMNO, no el total del grupo** (Javier,
    // 2026-09-11, opción b). En una prueba grupal cada uno paga lo suyo; el
    // titular solo presta sus datos para simplificar el registro y no tiene
    // por qué llevarse el crédito de los demás. Lo de los acompañantes queda
    // disponible para cuando ellos se inscriban, dentro del mismo plazo.
    const personas = 1 + Math.max(0, Number(pr.acompanantes) || 0);
    const monto = Math.round((pagado / personas) * 100) / 100;
    if (monto <= 0) continue;

    return { pruebaId: pr.id, monto, vence, personas, pagado };
  }
  return null;
}

/** `iso` + n días, en ISO local. */
function sumarDias(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const f = new Date(y, m - 1, d);
  f.setDate(f.getDate() + n);
  return isoFecha(f);
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

  // Una prueba con fecha pasada **confirma la asistencia sola**, así que crea o
  // toca la sesión de esa clase. Antes eso se bloqueaba si de la clase dependía
  // un prorrateo ya pagado. **Ya no** (regla de negocio 16, reescrita el
  // 2026-09-18): las clases solo afectan contadores, y si el recálculo de una
  // membresía ya liquidada da otro número, la diferencia sale como un ajuste al
  // liquidar (0044) sin reescribir lo pagado. Una venta retroactiva no se traba.

  const { data: alumnoRowRaw } = await sb
    .from("alumnos")
    .select("id, contacto:contactos(nombre, apellido)")
    .eq("id", e.alumnoId)
    .maybeSingle();
  const alumnoRow = alumnoRowRaw as unknown as { id: number; contacto: { nombre: string | null; apellido: string | null } | null } | null;
  if (!alumnoRow) return { error: "El alumno no existe." };
  const alumno = { nombre: alumnoRow.contacto?.nombre ?? "", apellido: alumnoRow.contacto?.apellido ?? "" };

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

  // No se vende una prueba de un curso donde el alumno YA es socio regular.
  // Sin este chequeo entró un caso real en dev (Aguilar Manuel, 2026-09-14):
  // una prueba se sumó a su membresía activa del mismo curso, y las dos
  // cubrían la misma sesión — cargarPadron no puede mostrar dos filas para un
  // alumno (`asistencias` tiene unique sesion_id+alumno_id, regla de negocio
  // 11: la prueba es preliminar de un plan regular, no algo que conviva con
  // uno ya vendido). La prueba existe para decidir si alguien se inscribe, no
  // para alguien que ya decidió y ya paga.
  const { data: yaSocioRows } = await sb
    .from("membresias")
    .select("id, curso_id, membresia_cursos(curso_id)")
    .eq("alumno_id", e.alumnoId)
    .eq("es_prueba", false)
    .neq("estado", "baja");
  const cursosYaSocio = new Set(
    ((yaSocioRows as { curso_id: number | null; membresia_cursos: { curso_id: number }[] }[]) ?? []).flatMap(
      (r) => [r.curso_id, ...r.membresia_cursos.map((ic) => ic.curso_id)].filter((x): x is number => x != null)
    )
  );
  const yaInscripto = cursoIds.find((c) => cursosYaSocio.has(c));
  if (yaInscripto != null) {
    const nombre = (
      exigir(
        await sb.from("cursos").select("id, nombre").eq("id", yaInscripto).maybeSingle(),
        "el curso"
      ) as { nombre: string } | null
    )?.nombre;
    return {
      error: `El alumno ya es socio regular de ${nombre ?? "ese curso"}: no se le puede vender una prueba de un curso donde ya está inscripto.`,
    };
  }

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
    await sb.from("cursos").select(`id, nombre, dias_semana, ${COLS_VIGENCIA}`).in("id", cursoIds),
    "los cursos de la prueba"
  ) as unknown as ({ id: number; nombre: string; dias_semana: number[] } & VigenciaCurso)[];
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
    // Y fuera de la vigencia del curso esa clase directamente no existe (0033).
    if (!enVigencia(cu, f!)) return { error: motivoFueraDeVigencia(cu.nombre, cu, f!) };
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
    .from("membresias")
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
    membresia_id: inscripcionId,
    curso_id: cu.id,
    dias: cu.dias_semana ?? [],
    fecha: fechaPorCurso.get(cu.id) ?? null,
  }));
  if (icRows.length) {
    const { error: errIC } = await a.from("membresia_cursos").insert(icRows);
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
      membresia_id: inscripcionId,
      estado: "presente",
      con_licencia: false,
      registrado_por: perfil?.id ?? null,
    });
    if (!errAsis) confirmadas++;
  }
  // Con su clase ya confirmada, la prueba agotó su ciclo. Recalcular es lo que
  // la cierra (agotada + cobrada, regla 1) y lo que la deja entrar a
  // liquidación: sin esto quedaba "activa" para siempre.
  if (confirmadas > 0) await recalcularMembresia(a, inscripcionId);

  // Toda venta tiene su cuota (regla 7).
  const { data: cuota, error: errCuota } = await a
    .from("cuotas")
    .insert({
      membresia_id: inscripcionId,
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
      membresia_id: inscripcionId,
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
      .from("membresia_cursos")
      .select("curso_id, fecha")
      .eq("membresia_id", inscripcionId),
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

// ── Vender un plan de particulares (C3, hito H2) ────────────────────────
//
// A diferencia de inscribirYCobrar, esta venta:
//  - no tiene curso_id ni membresia_cursos: el conteo es horas, no clases;
//  - crea la PRIMERA RESERVA real (decisión de Javier, 25/09: ocupa sala y
//    profesor, validada, con el estado 'reservada' que ya existe) — con
//    'fija' genera TODO el calendario que cubre las horas compradas, y si
//    algo choca no se graba nada (se valida todo antes de insertar nada);
//  - no llama a recalcularFinDeCiclo/registrarCorrimientosPendientes: esas
//    dependen de membresia_cursos, que una membresía de particulares no
//    tiene.
//
// **Simplificación de v1 (Code v1 + Design refina, como el resto de C3):**
// los acompañantes quedan como un CONTADOR (membresias.acompanantes), igual
// que en la prueba grupal — no se cargan uno a uno con su propio contacto
// todavía, aunque la tabla `membresia_asistentes` (0053) ya está lista para
// cuando se construya esa parte.

export type EntradaParticular = {
  alumnoId: number;
  planId: number;
  tarifaParticularId: number;
  profesorId: number;
  sala: { tipo: "propia"; salaId: number } | { tipo: "externa"; nombreDescriptivo: string };
  acompanantes: number;
  fechaInicio: string;
  agenda:
    | { modalidad: "flexible"; hora: string; duracionMin: number }
    | { modalidad: "fija"; diasSemana: number[]; hora: string; duracionMin: number };
  cobro: CobroInscripcion;
};

type AvisoPersona = { nombre: string; whatsapp: string | null; mensaje: string };
type ResultadoParticular = {
  ok?: true;
  resumen?: string;
  avisoAlumno?: AvisoPersona;
  avisoProfesor?: AvisoPersona;
  error?: string;
};

function agregarA<K>(mapa: Map<K, Set<number>>, clave: K, valor: number): void {
  const set = mapa.get(clave) ?? new Set<number>();
  set.add(valor);
  mapa.set(clave, set);
}

/** Las próximas fechas (incluida `desde`) en que cae alguno de `diasSemana`
 *  (1=lun..7=dom), hasta juntar `sesiones` fechas. Tope de 400 días, igual
 *  que el resto del motor: una plantilla sin ningún día elegible no puede
 *  colgar el servidor buscando para siempre. */
function fechasAgendaFija(diasSemana: number[], desde: Date, sesiones: number): string[] {
  const out: string[] = [];
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  for (let i = 0; i < 400 && out.length < sesiones; i++) {
    const dow = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (diasSemana.includes(dow)) out.push(isoFecha(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export async function venderParticular(e: EntradaParticular): Promise<ResultadoParticular> {
  if (!(await tienePermiso("particulares", "crear")))
    return { error: "No tenés permiso para vender clases particulares." };

  const perfil = await obtenerPerfilActual();
  const a = admin();
  const sb = await createClient();

  const inicio = parseFechaISO(e.fechaInicio);
  if (!inicio) return { error: "Fecha de inicio inválida." };

  const { data: alumnoRow } = await sb
    .from("alumnos")
    .select("id, contacto_id, es_menor, contacto:contactos(nombre, apellido, whatsapp)")
    .eq("id", e.alumnoId)
    .maybeSingle();
  const alumno = alumnoRow as unknown as {
    id: number;
    contacto_id: number;
    es_menor: boolean;
    contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null;
  } | null;
  if (!alumno) return { error: "El alumno no existe." };

  // Si es menor, la confirmación va al tutor — es quien lo identifica según
  // la matriz de mínimos, no el menor mismo.
  let destinatarioAviso = { nombre: `${alumno.contacto?.nombre ?? ""} ${alumno.contacto?.apellido ?? ""}`.trim(), whatsapp: alumno.contacto?.whatsapp ?? null };
  if (alumno.es_menor) {
    const { data: rel } = await sb
      .from("contacto_relaciones")
      .select("tutor:contactos!contacto_relaciones_desde_id_fkey(nombre, apellido, whatsapp)")
      .eq("tipo", "tutor_de")
      .eq("hacia_id", alumno.contacto_id)
      .maybeSingle();
    const tutor = (rel as unknown as { tutor: { nombre: string | null; apellido: string | null; whatsapp: string | null } } | null)?.tutor;
    if (tutor) destinatarioAviso = { nombre: `${tutor.nombre ?? ""} ${tutor.apellido ?? ""}`.trim(), whatsapp: tutor.whatsapp };
  }

  const { data: planRow } = await sb
    .from("planes")
    .select(
      "id, nombre, tipo_servicio, activo, estilo, vigencia_dias, reserva_modalidad, salas_modo, forma_pago_profesor, pago_pct_margen, pago_descuenta_sala, pago_monto_fijo, registra_acompanantes"
    )
    .eq("id", e.planId)
    .maybeSingle();
  if (!planRow) return { error: "El plan no existe." };
  if (planRow.tipo_servicio !== "particular") return { error: "Ese plan no es de clases particulares." };
  if (!planRow.activo) return { error: "El plan está desactivado." };
  if (!planRow.estilo) return { error: "Al plan le falta el estilo. Se carga en Planes." };

  const { data: tarifaRow } = await sb
    .from("tarifas_particular")
    .select("id, nombre, estilo, horas, precio, activo")
    .eq("id", e.tarifaParticularId)
    .maybeSingle();
  if (!tarifaRow || !tarifaRow.activo) return { error: "El tramo de horas elegido no existe o está desactivado." };
  if (tarifaRow.estilo !== planRow.estilo)
    return { error: "Ese tramo de horas no es del estilo de este plan." };

  const { data: profesorRow } = await sb
    .from("profesores")
    .select("id, fee_hora, activo, contacto:contactos(nombre, apellido, whatsapp)")
    .eq("id", e.profesorId)
    .maybeSingle();
  if (!profesorRow || !profesorRow.activo) return { error: "El profesor no existe o está desactivado." };
  const { data: tieneEstilo } = await sb
    .from("profesor_estilos")
    .select("profesor_id")
    .eq("profesor_id", e.profesorId)
    .eq("estilo", planRow.estilo)
    .maybeSingle();
  if (!tieneEstilo) return { error: "Ese profesor no tiene cargado el estilo de este plan." };

  // Forma de pago: foto del plan al vender (regla 12).
  const formaPago = planRow.forma_pago_profesor as "fee_hora" | "pct_margen" | "monto_fijo" | null;
  if (!formaPago) return { error: "Al plan le falta la forma de pago al profesor. Se carga en Planes." };
  if (formaPago === "fee_hora" && profesorRow.fee_hora == null)
    return { error: "Este profesor no tiene cargado su fee por hora. Se carga en su ficha." };

  // Sala.
  let salaId: number;
  let nombreDescriptivo: string | null = null;
  let esExterna = false;
  if (e.sala.tipo === "externa") {
    const { data: externaRow } = await a.from("salas").select("id").eq("es_externa", true).eq("activa", true).maybeSingle();
    if (!externaRow) return { error: "No hay una sala externa activa configurada." };
    salaId = externaRow.id as number;
    esExterna = true;
    nombreDescriptivo = e.sala.nombreDescriptivo?.trim() || null;
    if (!nombreDescriptivo) return { error: "Una sala externa necesita un nombre descriptivo (ej. \"Salón X — Hotel Y\")." };
  } else {
    const { data: salaRow } = await a.from("salas").select("id, activa, es_externa, capacidad").eq("id", e.sala.salaId).maybeSingle();
    if (!salaRow || !salaRow.activa || salaRow.es_externa) return { error: "La sala elegida no existe o no está activa." };
    if (planRow.salas_modo === "solo") {
      const { data: permitida } = await a.from("plan_salas").select("sala_id").eq("plan_id", planRow.id).eq("sala_id", salaRow.id).maybeSingle();
      if (!permitida) return { error: "Esta plantilla no permite esa sala. Se ajusta en Planes." };
    }
    salaId = salaRow.id as number;
  }

  const horasContratadas = Number(tarifaRow.horas);
  const precio = Number(tarifaRow.precio);
  const personas = 1 + Math.max(0, Math.trunc(e.acompanantes));
  if (planRow.registra_acompanantes === false && e.acompanantes > 0)
    return { error: "Esta plantilla no registra acompañantes." };

  const mesesVigencia = Math.max(1, Number(await obtenerParametro("vencimiento_paquete_meses")) || 2);
  const vigenciaDias = vigenciaDiasEfectiva(planRow.vigencia_dias, mesesVigencia);
  const fFin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  fFin.setDate(fFin.getDate() + vigenciaDias);
  const fechaFin = isoFecha(fFin);

  // Sesiones a reservar (decisión de Javier: la agenda fija se genera
  // entera al vender; la flexible solo reserva la primera).
  type SesionPedida = { fecha: string; hora: string; duracionMin: number };
  let sesiones: SesionPedida[];
  if (e.agenda.modalidad === "flexible") {
    sesiones = [{ fecha: isoFecha(inicio), hora: e.agenda.hora, duracionMin: e.agenda.duracionMin }];
  } else {
    if (!e.agenda.diasSemana.length) return { error: "Elegí al menos un día para la agenda fija." };
    const necesarias = Math.max(1, Math.ceil((horasContratadas * 60) / e.agenda.duracionMin));
    const fechas = fechasAgendaFija(e.agenda.diasSemana, inicio, necesarias);
    if (fechas.length < necesarias)
      return { error: "No se encontraron suficientes fechas para cubrir las horas contratadas." };
    sesiones = fechas.map((f) => ({ fecha: f, hora: e.agenda.hora, duracionMin: e.agenda.duracionMin }));
  }

  const incrementoMin = Math.max(1, Number(await obtenerParametro("tiempos_incremento_min")) || 30);
  const minimoMin = Math.max(1, Number(await obtenerParametro("duracion_minima_curso_min")) || 30);
  const fechasUnicas = [...new Set(sesiones.map((s) => s.fecha))];

  // ── Datos para validar la sala (si es propia) ──────────────────────────
  let patronSala: FranjaPatron[] = [];
  let excepcionesSala: ExcepcionHorario[] = [];
  let cursosSala: CursoOcupa[] = [];
  const reservasSalaPorFecha = new Map<string, ReservaSalaOcupa[]>();
  const suspendidasSalaPorFecha = new Map<string, Set<number>>();
  if (!esExterna) {
    const [patronR, excR, cursosR, resR] = await Promise.all([
      a.from("sala_horario_patron").select("dia_semana, desde, hasta").eq("sala_id", salaId),
      a.from("sala_horario_excepciones").select("fecha, hasta_fecha, cerrado, desde, hasta, motivo, glosa").eq("sala_id", salaId),
      a.from("cursos").select(`id, nombre, dias_semana, hora, duracion_min, sala_id, ${COLS_VIGENCIA}`).eq("sala_id", salaId).eq("activo", true),
      a.from("reservas_sala").select("id, tipo, motivo, glosa, hora, duracion_min, fecha").eq("sala_id", salaId).in("fecha", fechasUnicas).neq("estado", "cancelada"),
    ]);
    patronSala = (patronR.data as FranjaPatron[]) ?? [];
    excepcionesSala = (excR.data as ExcepcionHorario[]) ?? [];
    cursosSala = (cursosR.data as unknown as CursoOcupa[]) ?? [];
    for (const r of (resR.data as (ReservaSalaOcupa & { fecha: string })[]) ?? []) {
      const l = reservasSalaPorFecha.get(r.fecha) ?? [];
      l.push(r);
      reservasSalaPorFecha.set(r.fecha, l);
    }
    const cursoIdsSala = cursosSala.map((c) => c.id);
    if (cursoIdsSala.length) {
      const { data: susRows } = await a
        .from("sesiones")
        .select("curso_id, fecha")
        .in("curso_id", cursoIdsSala)
        .eq("estado", "suspendida")
        .in("fecha", fechasUnicas);
      for (const s of (susRows as { curso_id: number; fecha: string }[]) ?? [])
        agregarA(suspendidasSalaPorFecha, s.fecha, s.curso_id);
    }
  }

  // ── Datos para validar al profesor (siempre, incluso con sala externa) ──
  const { data: asigRows } = await a.from("asignaciones").select(COLUMNAS_ASIGNACION).eq("profesor_id", e.profesorId).is("hasta", null);
  const cursoIdsProfesor = ((asigRows as { curso_id: number }[]) ?? []).map((r) => r.curso_id);
  const [cursosProfR, reservasProfR] = await Promise.all([
    cursoIdsProfesor.length
      ? a.from("cursos").select(`id, nombre, dias_semana, hora, duracion_min, sala_id, ${COLS_VIGENCIA}`).in("id", cursoIdsProfesor)
      : Promise.resolve({ data: [] as unknown[] }),
    a.from("reservas_sala").select("id, tipo, motivo, glosa, hora, duracion_min, fecha").eq("profesor_id", e.profesorId).in("fecha", fechasUnicas).neq("estado", "cancelada"),
  ]);
  const cursosProfesor = (cursosProfR.data as unknown as CursoOcupa[]) ?? [];
  const reservasProfesorPorFecha = new Map<string, ReservaSalaOcupa[]>();
  for (const r of (reservasProfR.data as (ReservaSalaOcupa & { fecha: string })[]) ?? []) {
    const l = reservasProfesorPorFecha.get(r.fecha) ?? [];
    l.push(r);
    reservasProfesorPorFecha.set(r.fecha, l);
  }
  const cursoIdsSusProf = cursosProfesor.map((c) => c.id);
  const suspendidasProfesorPorFecha = new Map<string, Set<number>>();
  if (cursoIdsSusProf.length) {
    const { data: susRows } = await a
      .from("sesiones")
      .select("curso_id, fecha")
      .in("curso_id", cursoIdsSusProf)
      .eq("estado", "suspendida")
      .in("fecha", fechasUnicas);
    for (const s of (susRows as { curso_id: number; fecha: string }[]) ?? [])
      agregarA(suspendidasProfesorPorFecha, s.fecha, s.curso_id);
  }

  // ── Validar cada sesión ANTES de grabar nada (decisión de Javier) ──────
  for (const s of sesiones) {
    const ocupadosSala = esExterna
      ? []
      : ocupacionDelDia(
          cursosSala,
          reservasSalaPorFecha.get(s.fecha) ?? [],
          s.fecha,
          suspendidasSalaPorFecha.get(s.fecha) ?? new Set(),
          salaId
        );
    const ocupadosProfesor = ocupacionDeProfesor(
      cursosProfesor,
      s.fecha,
      suspendidasProfesorPorFecha.get(s.fecha) ?? new Set(),
      reservasProfesorPorFecha.get(s.fecha) ?? []
    );

    const v = validarReservaSala({
      fecha: s.fecha,
      hora: s.hora,
      duracionMin: s.duracionMin,
      incrementoMin,
      minimoMin,
      personas,
      sala: { esExterna, capacidad: null },
      patron: patronSala,
      excepciones: excepcionesSala,
      ocupadosSala,
      ocupadosProfesor,
    });
    if (!v.ok) return { error: `${fechaLarga(new Date(s.fecha + "T00:00:00"))}: ${v.motivo}` };
  }

  // ── Cobro (mismo cálculo que inscribirYCobrar) ─────────────────────────
  const c = e.cobro;
  const glosa = medioGlosa(c);
  const mueveBruto = c.modo === "sin" ? 0 : Math.max(0, (Number(c.total) || 0) - (Number(c.saldo) || 0));
  const mueve = Math.min(precio, Math.max(0, Math.round(mueveBruto)));
  const descManual = Math.min(precio, Math.max(0, Math.round(Number(c.ajuste) || 0)));
  if (mueve > 0 && !c.medio) return { error: "Elegí el medio de pago." };
  if (descManual > 0 && !c.ajusteMotivo.trim()) return { error: "El descuento manual necesita un motivo." };
  const saldo = Math.max(0, precio - mueve - descManual);
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

  // ── Grabar ──────────────────────────────────────────────────────────
  const { data: mem, error: errMem } = await a
    .from("membresias")
    .insert({
      alumno_id: e.alumnoId,
      contacto_id: alumno.contacto_id,
      curso_id: null,
      modalidad: "clase",
      fecha_inicio: isoFecha(inicio),
      fecha_fin: fechaFin,
      estado: "activa",
      plan_id: planRow.id,
      precio_aplicado: precio,
      horas_contratadas: horasContratadas,
      tarifa_particular_id: tarifaRow.id,
      profesor_id: e.profesorId,
      forma_pago_profesor: formaPago,
      pago_pct_margen: planRow.pago_pct_margen,
      pago_descuenta_sala: planRow.pago_descuenta_sala,
      pago_monto_fijo: planRow.pago_monto_fijo,
      fee_hora_aplicado: formaPago === "fee_hora" ? profesorRow.fee_hora : null,
      acompanantes: e.acompanantes,
    })
    .select("id")
    .single();
  if (errMem) return { error: errMem.message };
  const membresiaId = mem.id as number;

  const { error: errSala } = await a.from("membresia_salas").insert({
    membresia_id: membresiaId,
    sala_id: salaId,
    nombre_descriptivo: nombreDescriptivo,
  });
  if (errSala) return { error: "Se creó la membresía, pero falló guardar la sala: " + errSala.message };

  const { data: cuota, error: errCuota } = await a
    .from("cuotas")
    .insert({
      membresia_id: membresiaId,
      periodo: isoFecha(primerDiaDelMes(inicio)),
      monto_devengado: precio,
      descuento_adelanto: 0,
      vencimiento: fechaCompromiso ?? isoFecha(sumarMeses(inicio, 1)),
      fecha_compromiso: fechaCompromiso,
      estado: mueve + descManual >= precio && precio > 0 ? "pagada" : mueve + descManual > 0 ? "parcial" : "pendiente",
    })
    .select("id")
    .single();
  if (errCuota) return { error: "Se creó la membresía, pero falló crear la cuota: " + errCuota.message };

  if (mueve > 0 || descManual > 0) {
    const { error: errPago } = await a.from("pagos").insert({
      tipo: "cobro",
      motivo: "clase_particular",
      alumno_id: e.alumnoId,
      membresia_id: membresiaId,
      cuota_id: cuota.id,
      monto: mueve,
      medio: mueve > 0 ? c.medio : null,
      descuento: descManual,
      descuento_motivo: descManual > 0 ? c.ajusteMotivo.trim() : null,
      glosa,
      registrado_por: perfil?.id ?? null,
    });
    if (errPago) return { error: "Se creó la membresía, pero falló registrar el cobro: " + errPago.message };
  }

  const { error: errRes } = await a.from("reservas_sala").insert(
    sesiones.map((s) => ({
      sala_id: salaId,
      tipo: "particular",
      membresia_id: membresiaId,
      profesor_id: e.profesorId,
      fecha: s.fecha,
      hora: s.hora,
      duracion_min: s.duracionMin,
      estado: "reservada",
      creado_por: perfil?.id ?? null,
    }))
  );
  if (errRes) {
    if ((errRes as { code?: string }).code === "23P01")
      return {
        error:
          "Se creó la membresía, pero una de las clases se acaba de ocupar con otra reserva. Revisá las reservas de esta membresía antes de avisar al alumno.",
      };
    return { error: "Se creó la membresía, pero falló crear las reservas: " + errRes.message };
  }

  revalidatePath("/inscribir");
  revalidatePath("/sala");

  const nombreProfesor = `${(profesorRow.contacto as unknown as { nombre: string | null } | null)?.nombre ?? ""} ${
    (profesorRow.contacto as unknown as { apellido: string | null } | null)?.apellido ?? ""
  }`.trim();
  const primeraSesion = sesiones[0];
  const restoTexto = sesiones.length > 1 ? ` y ${sesiones.length - 1} clase(s) más` : "";
  const dondeTexto = esExterna ? nombreDescriptivo : "Tropicana";

  return {
    ok: true,
    resumen: `Membresía particular de ${destinatarioAviso.nombre || `alumno #${e.alumnoId}`} — ${planRow.nombre}, ${horasContratadas} h con ${nombreProfesor}. Primera clase el ${fechaLarga(
      new Date(primeraSesion.fecha + "T00:00:00")
    )} a las ${primeraSesion.hora.slice(0, 5)}${restoTexto}. ${mueve > 0 ? `Cobrado ${gs(mueve)}.` : "Sin cobro por ahora."}`,
    avisoAlumno: {
      nombre: destinatarioAviso.nombre,
      whatsapp: destinatarioAviso.whatsapp,
      mensaje: `Hola! Confirmamos tu paquete de ${horasContratadas} h de clases particulares (${planRow.nombre}) con ${nombreProfesor} en Tropicana. Tu primera clase es el ${fechaLarga(
        new Date(primeraSesion.fecha + "T00:00:00")
      )} a las ${primeraSesion.hora.slice(0, 5)}, en ${dondeTexto}.${restoTexto ? ` Además quedaron agendadas${restoTexto}.` : ""} ¡Te esperamos!`,
    },
    avisoProfesor: {
      nombre: nombreProfesor,
      whatsapp: (profesorRow.contacto as unknown as { whatsapp: string | null } | null)?.whatsapp ?? null,
      mensaje: `Hola! Se te agendó una clase particular (${planRow.nombre}) con ${destinatarioAviso.nombre || "un alumno"} el ${fechaLarga(
        new Date(primeraSesion.fecha + "T00:00:00")
      )} a las ${primeraSesion.hora.slice(0, 5)}, en ${dondeTexto}.${restoTexto ? ` Quedaron agendadas${restoTexto} más.` : ""}`,
    },
  };
}
