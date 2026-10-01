"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import type { DatosPlan } from "@/lib/tipos";
import { validarDatosPlan } from "@/lib/planes";

type Resultado = { ok?: true; error?: string; accion?: "eliminado" | "desactivado" };

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

const validar = validarDatosPlan;

/** Cursos a guardar en plan_cursos según el modo de acceso. */
function cursosParaGuardar(d: DatosPlan): number[] {
  return d.acceso_modo === "todas" ? [] : d.cursoIds;
}

/** Campos del plan derivados del modo (N vs ilimitado). */
function camposLimite(d: DatosPlan) {
  return {
    clases_ilimitadas: d.clases_ilimitadas,
    cantidad_clases: d.clases_ilimitadas ? null : d.cantidad_clases,
    ciclo_dias: d.clases_ilimitadas ? d.ciclo_dias : null,
  };
}

/** Sincroniza plan_cursos con la lista de cursos elegida (agrega/borra). */
async function guardarCursos(
  a: ReturnType<typeof admin>,
  planId: number,
  cursoIds: number[]
): Promise<string | null> {
  const { data: actuales } = await a
    .from("plan_cursos")
    .select("curso_id")
    .eq("plan_id", planId);
  const tiene = new Set((actuales as { curso_id: number }[] | null ?? []).map((r) => r.curso_id));
  const quiere = new Set(cursoIds);

  const agregar = cursoIds.filter((c) => !tiene.has(c)).map((c) => ({ plan_id: planId, curso_id: c }));
  const borrar = [...tiene].filter((c) => !quiere.has(c));

  if (agregar.length) {
    const { error } = await a.from("plan_cursos").insert(agregar);
    if (error) return error.message;
  }
  if (borrar.length) {
    const { error } = await a
      .from("plan_cursos")
      .delete()
      .eq("plan_id", planId)
      .in("curso_id", borrar);
    if (error) return error.message;
  }
  return null;
}

/** Salas a guardar en plan_salas: solo tiene sentido cuando salas_modo='solo'. */
function salasParaGuardar(d: DatosPlan): number[] {
  return d.salas_modo === "solo" ? d.salaIds : [];
}

/** Sincroniza plan_salas con la lista de salas elegida (agrega/borra). Mismo
 *  patrón que guardarCursos. */
async function guardarSalas(
  a: ReturnType<typeof admin>,
  planId: number,
  salaIds: number[]
): Promise<string | null> {
  const { data: actuales } = await a.from("plan_salas").select("sala_id").eq("plan_id", planId);
  const tiene = new Set((actuales as { sala_id: number }[] | null ?? []).map((r) => r.sala_id));
  const quiere = new Set(salaIds);

  const agregar = salaIds.filter((s) => !tiene.has(s)).map((s) => ({ plan_id: planId, sala_id: s }));
  const borrar = [...tiene].filter((s) => !quiere.has(s));

  if (agregar.length) {
    const { error } = await a.from("plan_salas").insert(agregar);
    if (error) return error.message;
  }
  if (borrar.length) {
    const { error } = await a.from("plan_salas").delete().eq("plan_id", planId).in("sala_id", borrar);
    if (error) return error.message;
  }
  return null;
}

/** Columnas propias de un plan de particulares (0052, H1); null/default en
 *  cualquier otro tipo_servicio, para no dejar restos configurados que
 *  confundan si el tipo cambiara. */
function camposParticular(d: DatosPlan) {
  if (d.tipo_servicio !== "particular") {
    return {
      estilo: null,
      vigencia_dias: null,
      reserva_modalidad: null,
      salas_modo: "todas" as const,
      forma_pago_profesor: null,
      pago_pct_margen: null,
      pago_descuenta_sala: false,
      pago_monto_fijo: null,
      extension_modo: "lista" as const,
      extension_recargo_pct: null,
      registra_acompanantes: false,
      permite_sala_externa: false,
      permite_cortesia: false,
    };
  }
  return {
    estilo: d.estilo,
    vigencia_dias: d.vigencia_dias,
    reserva_modalidad: d.reserva_modalidad,
    salas_modo: d.salas_modo,
    forma_pago_profesor: d.forma_pago_profesor,
    pago_pct_margen: d.forma_pago_profesor === "pct_margen" ? d.pago_pct_margen : null,
    pago_descuenta_sala: d.pago_descuenta_sala,
    pago_monto_fijo: d.forma_pago_profesor === "monto_fijo" ? d.pago_monto_fijo : null,
    extension_modo: d.extension_modo,
    extension_recargo_pct: d.extension_modo === "recargo" ? d.extension_recargo_pct : null,
    registra_acompanantes: d.registra_acompanantes,
    permite_sala_externa: d.permite_sala_externa,
    permite_cortesia: d.permite_cortesia,
  };
}

export async function crearPlan(d: DatosPlan): Promise<Resultado> {
  if (!(await tienePermiso("planes", "crear"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const a = admin();
  const { data, error } = await a
    .from("planes")
    .insert({
      nombre: d.nombre.trim().toUpperCase(),
      tipo_servicio: d.tipo_servicio,
      // modalidad es una etiqueta heredada; los planes de esta pantalla la dejan
      // en null (el motor usa plan_cursos + acceso_modo, no la modalidad).
      curso_id: d.cursoIds[0] ?? null, // curso principal (compat)
      acceso_modo: d.acceso_modo,
      ...camposLimite(d),
      precio: d.precio,
      criterio_liquidacion: d.criterio_liquidacion,
      tolerancia_faltas: d.tolerancia_faltas,
      acepta_prueba: d.acepta_prueba,
      // Las condiciones solo se guardan si el plan acepta prueba: si se apaga,
      // no quedan restos configurados que confundan después.
      prueba_cursos_max: d.acepta_prueba ? d.prueba_cursos_max : null,
      prueba_acredita: d.acepta_prueba ? d.prueba_acredita : true,
      prueba_plazo_dias: d.acepta_prueba ? d.prueba_plazo_dias : null,
      ...camposParticular(d),
      renovable: true,
      activo: true,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const errC = await guardarCursos(a, data.id as number, cursosParaGuardar(d));
  if (errC) return { error: "El plan se creó, pero falló asociar los cursos: " + errC };

  const errS = await guardarSalas(a, data.id as number, salasParaGuardar(d));
  if (errS) return { error: "El plan se creó, pero falló asociar las salas: " + errS };

  revalidatePath("/planes");
  return { ok: true };
}

/**
 * Membresías del plan **sin nada devengado** cuyo criterio de liquidación (foto
 * de la venta, regla 12) difiere del nuevo. Son las únicas a las que se puede
 * ofrecer el cambio: una con comisión ya devengada no se reescribe.
 */
async function membresiasSinDevengarConOtroCriterio(
  a: ReturnType<typeof admin>,
  planId: number,
  nuevo: number
): Promise<{ libres: number[]; conDevengo: number }> {
  const { data: ms, error } = await a
    .from("membresias")
    .select("id, criterio_liquidacion")
    .eq("plan_id", planId)
    .in("estado", ["activa", "completada"]);
  if (error) throw new Error("No se pudieron leer las membresías del plan: " + error.message);
  const candidatas = ((ms as { id: number; criterio_liquidacion: number | null }[]) ?? [])
    .filter((m) => m.criterio_liquidacion !== nuevo)
    .map((m) => m.id);
  if (!candidatas.length) return { libres: [], conDevengo: 0 };
  const { data: dev, error: e2 } = await a
    .from("comisiones_devengadas")
    .select("membresia_id")
    .in("membresia_id", candidatas);
  if (e2) throw new Error("No se pudieron leer las comisiones devengadas: " + e2.message);
  const conDevengo = new Set(((dev as { membresia_id: number }[]) ?? []).map((r) => r.membresia_id));
  const libres = candidatas.filter((id) => !conDevengo.has(id));
  return { libres, conDevengo: candidatas.length - libres.length };
}

/** Cuántas membresías ya vendidas podrían tomar el nuevo criterio (para preguntar antes de guardar). */
export async function contarMembresiasParaNuevoCriterio(
  planId: number,
  nuevo: number
): Promise<{ n?: number; conDevengo?: number; error?: string }> {
  if (!(await tienePermiso("planes", "editar"))) return { error: "Sin permiso." };
  try {
    const r = await membresiasSinDevengarConOtroCriterio(admin(), planId, nuevo);
    return { n: r.libres.length, conDevengo: r.conDevengo };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function actualizarPlan(
  id: number,
  d: DatosPlan,
  aplicarCriterioAMembresias = false
): Promise<Resultado> {
  if (!(await tienePermiso("planes", "editar"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const a = admin();
  // tipo_servicio no se reedita: se elige al crear (pestaña) y define qué
  // columnas manda el formulario. Cambiarlo a mitad de camino dejaría restos
  // de otro tipo configurados sin que nadie los vea.
  const { error } = await a
    .from("planes")
    .update({
      nombre: d.nombre.trim().toUpperCase(),
      curso_id: d.cursoIds[0] ?? null,
      acceso_modo: d.acceso_modo,
      ...camposLimite(d),
      precio: d.precio,
      criterio_liquidacion: d.criterio_liquidacion,
      tolerancia_faltas: d.tolerancia_faltas,
      acepta_prueba: d.acepta_prueba,
      // Las condiciones solo se guardan si el plan acepta prueba: si se apaga,
      // no quedan restos configurados que confundan después.
      prueba_cursos_max: d.acepta_prueba ? d.prueba_cursos_max : null,
      prueba_acredita: d.acepta_prueba ? d.prueba_acredita : true,
      prueba_plazo_dias: d.acepta_prueba ? d.prueba_plazo_dias : null,
      ...camposParticular(d),
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const errC = await guardarCursos(a, id, cursosParaGuardar(d));
  if (errC) return { error: errC };

  const errS = await guardarSalas(a, id, salasParaGuardar(d));
  if (errS) return { error: errS };

  // Editar el plan no mueve lo ya vendido (regla 12). Solo si la persona lo
  // pidió, las membresías sin nada devengado toman el criterio nuevo.
  if (aplicarCriterioAMembresias) {
    try {
      const { libres: ids } = await membresiasSinDevengarConOtroCriterio(a, id, d.criterio_liquidacion);
      if (ids.length) {
        const { error: errM } = await a
          .from("membresias")
          .update({ criterio_liquidacion: d.criterio_liquidacion })
          .in("id", ids);
        if (errM) return { error: "El plan se guardó, pero falló aplicar el criterio a las membresías: " + errM.message };
      }
    } catch (e) {
      return { error: "El plan se guardó, pero " + (e as Error).message };
    }
  }

  revalidatePath("/planes");
  return { ok: true };
}

/** Membresías (inscripciones) que usan el plan: con historial se desactiva. */
async function contarMembresias(a: ReturnType<typeof admin>, id: number): Promise<number> {
  const { count } = await a
    .from("membresias")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", id);
  return count ?? 0;
}

export async function eliminarODesactivarPlan(id: number): Promise<Resultado> {
  if (!(await tienePermiso("planes", "eliminar"))) return { error: "Sin permiso." };

  const a = admin();
  const membresias = await contarMembresias(a, id);
  if (membresias === 0) {
    // plan_cursos se borra en cascada.
    const { error } = await a.from("planes").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/planes");
    return { ok: true, accion: "eliminado" };
  }

  const { error } = await a
    .from("planes")
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/planes");
  return { ok: true, accion: "desactivado" };
}

export async function activarPlan(id: number): Promise<Resultado> {
  if (!(await tienePermiso("planes", "editar"))) return { error: "Sin permiso." };
  const { error } = await admin()
    .from("planes")
    .update({ activo: true, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/planes");
  return { ok: true };
}
