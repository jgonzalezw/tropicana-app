"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import type { DatosCurso } from "@/lib/tipos";

type Resultado = {
  ok?: true;
  error?: string;
  accion?: "eliminado" | "desactivado" | "baja_programada";
};

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validar(d: DatosCurso): string | null {
  if (!d.nombre.trim()) return "El nombre del curso es obligatorio.";
  if (d.dias_semana.length === 0) return "Elegí al menos un día de la semana.";
  if (!(d.precio_mensual >= 0)) return "El precio mensual no puede ser negativo.";
  // Duración (0034): de acá sale la hora de fin, y con ella el bloque que la
  // sala valida. Sin duración no hay nada que chocar.
  if (!Number.isInteger(d.duracion_min) || d.duracion_min <= 0 || d.duracion_min > 600)
    return "La duración de la clase tiene que ser un número de minutos entre 1 y 600.";
  // Vigencia (0033): de estas fechas depende cuántas clases pone el curso en el
  // prorrateo y qué asistencias se exigen, así que el servidor las valida.
  if (!ISO.test(d.vigente_desde ?? "")) return "Cargá desde cuándo corre el curso.";
  if (d.vigente_hasta) {
    if (!ISO.test(d.vigente_hasta)) return "La fecha de baja no es válida.";
    if (d.vigente_hasta < d.vigente_desde)
      return "La fecha de baja no puede ser anterior a la de activación.";
  }
  return null;
}

const MODALIDADES = ["clase", "semana", "medio_mes", "prueba"] as const;

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * La vigencia no puede dejar afuera lo que ya pasó.
 *
 * **Por qué existe** (Javier, 2026-09-12): *"la fecha de validez hasta de un
 * curso es delicada… no tiene sentido inactivar hacia atrás si tiene clases y/o
 * membresías en curso."* Mover `vigente_desde` hacia adelante o
 * `vigente_hasta` hacia atrás por encima de algo ya registrado le cambiaría el
 * conteo de clases a membresías ya vendidas —y con eso el peso del reparto—
 * sin que nadie lo pidiera: exactamente lo que la regla de negocio 5 prohíbe.
 *
 * Se corre **antes de grabar**, y en vez de un "no se puede" a secas devuelve
 * qué está en el medio y hasta dónde se puede mover.
 */
async function vigenciaChocaConHistorial(
  a: ReturnType<typeof admin>,
  cursoId: number,
  desde: string,
  hasta: string | null
): Promise<string | null> {
  const [{ data: ses }, { data: ic }, { data: insc }] = await Promise.all([
    a.from("sesiones").select("fecha").eq("curso_id", cursoId),
    a
      .from("inscripcion_cursos")
      .select("fecha, inscripcion:inscripciones(fecha_inicio, fecha_fin)")
      .eq("curso_id", cursoId),
    a.from("inscripciones").select("fecha_inicio, fecha_fin").eq("curso_id", cursoId),
  ]);

  const fechas: string[] = [];
  for (const s of (ses as { fecha: string }[]) ?? []) fechas.push(s.fecha.slice(0, 10));
  for (const r of (ic as unknown as {
    fecha: string | null;
    inscripcion: { fecha_inicio: string; fecha_fin: string | null } | null;
  }[]) ?? []) {
    if (r.fecha) fechas.push(r.fecha.slice(0, 10));
    if (r.inscripcion) {
      fechas.push(r.inscripcion.fecha_inicio.slice(0, 10));
      if (r.inscripcion.fecha_fin) fechas.push(r.inscripcion.fecha_fin.slice(0, 10));
    }
  }
  for (const r of (insc as { fecha_inicio: string; fecha_fin: string | null }[]) ?? []) {
    fechas.push(r.fecha_inicio.slice(0, 10));
    if (r.fecha_fin) fechas.push(r.fecha_fin.slice(0, 10));
  }
  if (!fechas.length) return null;

  const primera = fechas.reduce((m, f) => (f < m ? f : m));
  const ultima = fechas.reduce((m, f) => (f > m ? f : m));

  if (desde > primera)
    return (
      `Este curso ya tiene clases o membresías desde el ${primera}. ` +
      `Si lo activás el ${desde}, esas clases dejarían de contar y se movería el reparto de comisiones ` +
      `de membresías ya vendidas. La fecha de activación no puede ser posterior al ${primera}.`
    );
  if (hasta && hasta < ultima)
    return (
      `Este curso tiene clases o membresías en curso hasta el ${ultima}. ` +
      `Darlo de baja el ${hasta} las dejaría afuera y cambiaría el reparto de comisiones ya calculado. ` +
      `La fecha de baja no puede ser anterior al ${ultima}.`
    );
  return null;
}

/** Sincroniza las filas de curso_tarifas con lo cargado (upsert/borra). */
async function guardarTarifas(
  a: ReturnType<typeof admin>,
  cursoId: number,
  tarifas: DatosCurso["tarifas"]
) {
  const upserts = MODALIDADES.filter((m) => tarifas[m] != null).map((m) => ({
    curso_id: cursoId,
    modalidad: m,
    precio: tarifas[m],
  }));
  const borrar = MODALIDADES.filter((m) => tarifas[m] == null);

  if (upserts.length) {
    const { error } = await a
      .from("curso_tarifas")
      .upsert(upserts, { onConflict: "curso_id,modalidad" });
    if (error) return error.message;
  }
  if (borrar.length) {
    const { error } = await a
      .from("curso_tarifas")
      .delete()
      .eq("curso_id", cursoId)
      .in("modalidad", borrar);
    if (error) return error.message;
  }
  return null;
}

/**
 * Mantiene el Plan Regular (mensual) del curso en sincronía con su config:
 * N = dias por semana x 4, precio = precio mensual. Lo crea si no existe.
 * Las membresias ya vendidas no se afectan (snapshot en clases_plan/precio_aplicado).
 */
async function sincronizarPlanRegular(
  a: ReturnType<typeof admin>,
  cursoId: number,
  nombreCurso: string,
  diasSemana: number[],
  precioMensual: number
): Promise<string | null> {
  const n = diasSemana.length ? diasSemana.length * 4 : null;
  const nombrePlan = `Plan Regular - ${nombreCurso}`;

  const { data: existente } = await a
    .from("planes")
    .select("id")
    .eq("curso_id", cursoId)
    .eq("tipo_servicio", "curso_regular")
    .eq("modalidad", "mensual")
    .order("id")
    .limit(1)
    .maybeSingle();

  let planId: number;
  if (existente) {
    const { error } = await a
      .from("planes")
      .update({
        nombre: nombrePlan,
        cantidad_clases: n,
        precio: precioMensual,
        activo: true,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", existente.id);
    if (error) return error.message;
    planId = existente.id as number;
  } else {
    const { data, error } = await a
      .from("planes")
      .insert({
        nombre: nombrePlan,
        tipo_servicio: "curso_regular",
        modalidad: "mensual",
        curso_id: cursoId,
        cantidad_clases: n,
        precio: precioMensual,
        criterio_liquidacion: 1,
        tolerancia_faltas: null,
        renovable: true,
        activo: true,
      })
      .select("id")
      .single();
    if (error) return error.message;
    planId = data.id as number;
  }

  // Relacion plan <-> curso (plan_cursos), idempotente.
  const { data: rel } = await a
    .from("plan_cursos")
    .select("id")
    .eq("plan_id", planId)
    .eq("curso_id", cursoId)
    .maybeSingle();
  if (!rel) {
    const { error } = await a.from("plan_cursos").insert({ plan_id: planId, curso_id: cursoId });
    if (error) return error.message;
  }
  return null;
}

export async function crearCurso(d: DatosCurso): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "crear"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const a = admin();
  const { data, error } = await a
    .from("cursos")
    .insert({
      nombre: d.nombre.trim(),
      linea: d.linea.trim() || null,
      nivel: d.nivel.trim() || null,
      dias_semana: d.dias_semana,
      hora: d.hora,
      duracion_min: d.duracion_min,
      precio_mensual: d.precio_mensual,
      vigente_desde: d.vigente_desde,
      vigente_hasta: d.vigente_hasta,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const errT = await guardarTarifas(a, data.id as number, d.tarifas);
  if (errT) return { error: "El curso se creó, pero falló guardar tarifas: " + errT };

  const errP = await sincronizarPlanRegular(a, data.id as number, d.nombre.trim(), d.dias_semana, d.precio_mensual);
  if (errP) return { error: "El curso se creó, pero falló crear el Plan Regular: " + errP };

  revalidatePath("/cursos");
  return { ok: true };
}

export async function actualizarCurso(id: number, d: DatosCurso): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "editar"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const a = admin();
  const choque = await vigenciaChocaConHistorial(a, id, d.vigente_desde, d.vigente_hasta);
  if (choque) return { error: choque };

  const { error } = await a
    .from("cursos")
    .update({
      nombre: d.nombre.trim(),
      linea: d.linea.trim() || null,
      nivel: d.nivel.trim() || null,
      dias_semana: d.dias_semana,
      hora: d.hora,
      duracion_min: d.duracion_min,
      precio_mensual: d.precio_mensual,
      vigente_desde: d.vigente_desde,
      vigente_hasta: d.vigente_hasta,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const errT = await guardarTarifas(a, id, d.tarifas);
  if (errT) return { error: errT };

  const errP = await sincronizarPlanRegular(a, id, d.nombre.trim(), d.dias_semana, d.precio_mensual);
  if (errP) return { error: "El curso se guardó, pero falló actualizar el Plan Regular: " + errP };

  revalidatePath("/cursos");
  return { ok: true };
}

/** Historial dependiente de un curso: asignaciones, membresías (por `curso_id`
 *  y por `inscripcion_cursos` — regla del glosario: los cursos de una membresía
 *  viven ahí) y clases registradas. Con eso >0 el curso se da de baja en vez de
 *  borrarse. El Plan Regular auto-creado no cuenta (se borra junto al curso si
 *  está vacío). */
async function contarDependencias(id: number): Promise<number> {
  const a = admin();
  const [{ count: asig }, { count: insc }, { count: ic }, { count: ses }] = await Promise.all([
    a.from("asignaciones").select("id", { count: "exact", head: true }).eq("curso_id", id),
    a.from("inscripciones").select("id", { count: "exact", head: true }).eq("curso_id", id),
    a.from("inscripcion_cursos").select("id", { count: "exact", head: true }).eq("curso_id", id),
    a.from("sesiones").select("id", { count: "exact", head: true }).eq("curso_id", id),
  ]);
  return (asig ?? 0) + (insc ?? 0) + (ic ?? 0) + (ses ?? 0);
}

/**
 * Elimina el curso (si no tiene historial) o lo da de baja **en la fecha que la
 * persona indica**.
 *
 * **La fecha no se asigna sola, y es a propósito** (Javier, 2026-09-12): *"la
 * fecha de validez hasta de un curso es delicada como para que la asignes sin
 * intervención… es importante que el usuario intervenga y pueda establecerla o
 * confirmarla antes de grabar la inactivación, porque puede ser otra fecha la
 * que refleja la inactivación, ya sea adelantada o atrasada."*
 *
 * De esa fecha depende cuántas clases pone el curso en el prorrateo y qué
 * asistencias se exigen: ponerla por default sería decidir plata por omisión.
 * Si la fecha es **futura**, es una baja programada y el curso sigue activo
 * hasta entonces; si es hoy o pasada, se desactiva ahora.
 */
export async function eliminarODesactivarCurso(
  id: number,
  vigenteHasta?: string | null
): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "eliminar"))) return { error: "Sin permiso." };

  const a = admin();
  const deps = await contarDependencias(id);
  if (deps === 0) {
    // Sin historial: se borra el Plan Regular vacio (FK restrict) y el curso.
    // curso_tarifas se borra en cascada.
    const { error: errPlan } = await a.from("planes").delete().eq("curso_id", id);
    if (errPlan) return { error: errPlan.message };
    const { error } = await a.from("cursos").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/cursos");
    return { ok: true, accion: "eliminado" };
  }

  if (!vigenteHasta || !ISO.test(vigenteHasta))
    return { error: "Indicá desde qué fecha el curso deja de dictarse." };

  const { data: cur } = await a
    .from("cursos")
    .select("vigente_desde")
    .eq("id", id)
    .maybeSingle();
  const desde = (cur as { vigente_desde: string } | null)?.vigente_desde?.slice(0, 10);
  if (desde && vigenteHasta < desde)
    return { error: `La baja no puede ser anterior a la activación del curso (${desde}).` };

  const choque = await vigenciaChocaConHistorial(a, id, desde ?? vigenteHasta, vigenteHasta);
  if (choque) return { error: choque };

  // Baja futura = baja programada: el curso sigue activo hasta esa fecha.
  const programada = vigenteHasta > hoyISO();
  const { error } = await a
    .from("cursos")
    .update({
      activo: programada,
      vigente_hasta: vigenteHasta,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  // El plan sigue la vigencia del curso.
  await a
    .from("planes")
    .update({ activo: programada, actualizado_en: new Date().toISOString() })
    .eq("curso_id", id)
    .eq("tipo_servicio", "curso_regular");
  revalidatePath("/cursos");
  return { ok: true, accion: programada ? "baja_programada" : "desactivado" };
}

export async function activarCurso(id: number): Promise<Resultado> {
  if (!(await tienePermiso("cursos", "editar"))) return { error: "Sin permiso." };
  const a = admin();
  // Reactivar borra la fecha de baja: un curso "activo" con baja vencida no
  // generaría ninguna clase y quedaría activo sin poder usarse — dos señales
  // que se contradicen y ninguna lo dice (regla de calidad 5).
  const { error } = await a
    .from("cursos")
    .update({ activo: true, vigente_hasta: null, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  await a
    .from("planes")
    .update({ activo: true, actualizado_en: new Date().toISOString() })
    .eq("curso_id", id)
    .eq("tipo_servicio", "curso_regular")
    .eq("modalidad", "mensual");
  revalidatePath("/cursos");
  return { ok: true };
}
