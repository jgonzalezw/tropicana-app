"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import type { DatosProfesor } from "@/lib/tipos";
import { diaSiguiente, validarDesasignacion, type DatosSustituto } from "@/lib/desasignacion";
import { presenteDesdeExtra } from "@/lib/matrizMinimos";
import {
  crearOReusarContactoPersona,
  actualizarContactoPersona,
  guardarDatosExtra,
  validarContraMatriz,
} from "@/app/(privado)/contactos/acciones";

type Resultado = { ok?: true; error?: string; accion?: "eliminada" | "desactivada" };

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

function mapearError(e: { code?: string; message?: string }): string {
  if (e.code === "23505") {
    if (e.message?.includes("usuario_id"))
      return "Esa cuenta ya está vinculada a otro profesor.";
    return "Ese WhatsApp ya es de otro contacto.";
  }
  return e.message ?? "No se pudo guardar.";
}

/**
 * Identidad y estructura del profesor — hardcodeado, no en la matriz (igual
 * criterio que `validarIdentidadAlumno`): el WhatsApp lo identifica, y
 * estilos/tipo son propios del rol, no campos de contacto. Nombre y
 * apellido SÍ pasan por la matriz (`validarContraMatriz`, más abajo).
 */
function validar(d: DatosProfesor): string | null {
  if (!d.whatsapp.trim()) return "El WhatsApp identifica al profesor: cargalo.";
  if (d.estilos.length === 0) return "Elegí al menos un estilo.";
  if (d.tipo !== "activo" && d.tipo !== "externo") return "Tipo inválido.";
  return null;
}

async function guardarEstilos(profesorId: number, estilos: string[]): Promise<{ error?: string }> {
  const a = admin();
  const { error: errDel } = await a.from("profesor_estilos").delete().eq("profesor_id", profesorId);
  if (errDel) return { error: errDel.message };
  if (estilos.length === 0) return {};
  const { error } = await a
    .from("profesor_estilos")
    .insert(estilos.map((estilo) => ({ profesor_id: profesorId, estilo })));
  if (error) return { error: error.message };
  return {};
}

export async function crearProfesor(d: DatosProfesor): Promise<Resultado> {
  if (!(await tienePermiso("profesores", "crear"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const errMatriz = await validarContraMatriz("profesor", {
    nombre: !!d.nombre.trim(),
    apellido: !!d.apellido.trim(),
    ...presenteDesdeExtra(d),
  });
  if (errMatriz) return { error: errMatriz };

  const { contacto, error: errContacto } = await crearOReusarContactoPersona({
    nombre: d.nombre,
    apellido: d.apellido,
    whatsapp: d.whatsapp,
    email: d.email,
    sexo: d.sexo,
    reusarSiExiste: false,
  });
  if (errContacto || !contacto) return { error: errContacto ?? "No se pudo crear el contacto." };

  const { data: fila, error } = await admin()
    .from("profesores")
    .insert({
      contacto_id: contacto.id,
      tipo: d.tipo,
      tarifa_reemplazo: d.tarifa_reemplazo,
      fee_hora: d.fee_hora,
      usuario_id: d.usuario_id,
    })
    .select("id")
    .single();
  if (error || !fila) return { error: error ? mapearError(error) : "No se pudo crear el profesor." };

  const errEst = await guardarEstilos(fila.id, d.estilos);
  if (errEst.error) return { error: errEst.error };

  const errExtra = await guardarDatosExtra(contacto.id, d);
  if (errExtra.error) return { error: errExtra.error };

  revalidatePath("/profesores");
  return { ok: true };
}

export async function actualizarProfesor(
  id: number,
  d: DatosProfesor
): Promise<Resultado> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  const errMatriz = await validarContraMatriz("profesor", {
    nombre: !!d.nombre.trim(),
    apellido: !!d.apellido.trim(),
    ...presenteDesdeExtra(d),
  });
  if (errMatriz) return { error: errMatriz };

  const { data: fila, error: errFila } = await admin().from("profesores").select("contacto_id").eq("id", id).single();
  if (errFila || !fila) return { error: errFila?.message ?? "Profesor no encontrado." };

  const errContacto = await actualizarContactoPersona(fila.contacto_id, {
    nombre: d.nombre,
    apellido: d.apellido,
    whatsapp: d.whatsapp,
    email: d.email,
    sexo: d.sexo,
  });
  if (errContacto.error) return { error: mapearError({ message: errContacto.error }) };

  const errExtra = await guardarDatosExtra(fila.contacto_id, d);
  if (errExtra.error) return { error: errExtra.error };

  const { error } = await admin()
    .from("profesores")
    .update({
      tipo: d.tipo,
      tarifa_reemplazo: d.tarifa_reemplazo,
      fee_hora: d.fee_hora,
      usuario_id: d.usuario_id,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: mapearError(error) };

  const errEst = await guardarEstilos(id, d.estilos);
  if (errEst.error) return { error: errEst.error };

  revalidatePath("/profesores");
  return { ok: true };
}

/** Cuenta las dependencias de un profesor (decide eliminar vs. desactivar).
 *  Por ahora solo existen asignaciones; comisiones/liquidaciones/sala llegan
 *  en 0007 y se suman acá cuando existan. */
async function contarDependencias(id: number): Promise<number> {
  const { count } = await admin()
    .from("asignaciones")
    .select("id", { count: "exact", head: true })
    .eq("profesor_id", id);
  return count ?? 0;
}

export async function eliminarODesactivarProfesor(id: number): Promise<Resultado> {
  if (!(await tienePermiso("profesores", "eliminar"))) return { error: "Sin permiso." };

  const deps = await contarDependencias(id);
  if (deps === 0) {
    const { error } = await admin().from("profesores").delete().eq("id", id);
    if (error) return { error: mapearError(error) };
    revalidatePath("/profesores");
    return { ok: true, accion: "eliminada" };
  }

  const { error } = await admin()
    .from("profesores")
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: mapearError(error) };
  revalidatePath("/profesores");
  return { ok: true, accion: "desactivada" };
}

export async function activarProfesor(id: number): Promise<Resultado> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  const { error } = await admin()
    .from("profesores")
    .update({ activo: true, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: mapearError(error) };
  revalidatePath("/profesores");
  return { ok: true };
}

// ── Asignaciones profesor×curso ───────────────────────────────────────

export async function crearAsignacion(
  cursoId: number,
  profesorId: number,
  pctIngresos: number,
  pctReferido: number
): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  if (!(pctIngresos >= 1 && pctIngresos <= 100))
    return { error: "El % sobre los ingresos tiene que estar entre 1 y 100." };
  if (!(pctReferido >= 0 && pctReferido <= 100))
    return { error: "El % por referido tiene que estar entre 0 y 100." };

  const a = admin();
  // Cierra la asignación vigente del curso (si hay) antes de insertar la nueva,
  // para no violar el índice de un solo titular vigente por curso.
  const hoy = new Date().toISOString().slice(0, 10);
  const { error: errCierre } = await a
    .from("asignaciones")
    .update({ hasta: hoy })
    .eq("curso_id", cursoId)
    .is("hasta", null);
  if (errCierre) return { error: errCierre.message };

  const { error } = await a.from("asignaciones").insert({
    curso_id: cursoId,
    profesor_id: profesorId,
    pct_ingresos: pctIngresos,
    pct_referido: pctReferido,
  });
  if (error) return { error: error.message };

  revalidatePath("/profesores");
  return { ok: true };
}

export type RevisionDesasignacion = {
  error?: string;
  /** Clases ya dictadas por el profesor DESPUÉS de la fecha: la fecha las deja afuera. */
  posteriores?: string[];
  /** Membresías activas del curso con clases todavía sin dar. */
  pendientes?: { id: number; alumno: string; hechas: number; plan: number }[];
};

/** Mira, sin escribir nada, qué toca la fecha de desasignación (clases y membresías). */
export async function revisarDesasignacion(id: number, fecha: string): Promise<RevisionDesasignacion> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  const a = admin();
  const { data: asig, error: eA } = await a
    .from("asignaciones")
    .select("id, curso_id, profesor_id, desde, hasta")
    .eq("id", id)
    .maybeSingle();
  if (eA) return { error: eA.message };
  if (!asig) return { error: "No se encontró la asignación." };
  const falta = validarDesasignacion({
    desde: asig.desde, hasta: asig.hasta, profesorId: asig.profesor_id, fecha, sustituto: null,
  });
  if (falta) return { error: falta };

  const { data: ses, error: eS } = await a
    .from("sesiones")
    .select("fecha")
    .eq("curso_id", asig.curso_id)
    .eq("profesor_id", asig.profesor_id)
    .eq("estado", "dictada")
    .gt("fecha", fecha)
    .order("fecha");
  if (eS) return { error: eS.message };

  const { data: mcs, error: eM } = await a
    .from("membresia_cursos")
    .select(
      "membresia:membresias(id, estado, es_prueba, clases_plan, clases_hechas, alumno:alumnos(contacto:contactos(nombre, apellido)))"
    )
    .eq("curso_id", asig.curso_id);
  if (eM) return { error: eM.message };

  type Fila = {
    membresia: {
      id: number; estado: string; es_prueba: boolean; clases_plan: number | null; clases_hechas: number;
      alumno: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
    } | null;
  };
  const pendientes = ((mcs ?? []) as unknown as Fila[])
    .map((r) => r.membresia)
    .filter((m): m is NonNullable<Fila["membresia"]> =>
      !!m && m.estado === "activa" && !m.es_prueba && m.clases_plan != null && m.clases_hechas < m.clases_plan)
    .map((m) => ({
      id: m.id,
      alumno: [m.alumno?.contacto?.apellido, m.alumno?.contacto?.nombre].filter(Boolean).join(", ") || "—",
      hechas: m.clases_hechas,
      plan: m.clases_plan as number,
    }));

  return { posteriores: (ses ?? []).map((x) => x.fecha as string), pendientes };
}

/**
 * Cierra la asignación en `fecha` (último día a cargo) y, si corresponde, deja un
 * sustituto desde el día siguiente. Lo ya dictado y devengado no se toca: la
 * comisión es de quien dictó (regla 10) y se lee del historial de asignaciones.
 */
export async function desasignar(
  id: number,
  fecha: string,
  sustituto: DatosSustituto | null
): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  const a = admin();
  const { data: asig, error: eA } = await a
    .from("asignaciones")
    .select("id, curso_id, profesor_id, desde, hasta")
    .eq("id", id)
    .maybeSingle();
  if (eA) return { error: eA.message };
  if (!asig) return { error: "No se encontró la asignación." };
  const falta = validarDesasignacion({
    desde: asig.desde, hasta: asig.hasta, profesorId: asig.profesor_id, fecha, sustituto,
  });
  if (falta) return { error: falta };

  if (sustituto) {
    const { data: prof, error: eP } = await a
      .from("profesores")
      .select("id, activo, tipo")
      .eq("id", sustituto.profesorId as number)
      .maybeSingle();
    if (eP) return { error: eP.message };
    if (!prof || !prof.activo || prof.tipo !== "activo")
      return { error: "El sustituto tiene que ser un profesor Activo." };
  }

  const { error: eC } = await a.from("asignaciones").update({ hasta: fecha }).eq("id", id).is("hasta", null);
  if (eC) return { error: eC.message };

  if (sustituto) {
    const { error: eI } = await a.from("asignaciones").insert({
      curso_id: asig.curso_id,
      profesor_id: sustituto.profesorId,
      pct_ingresos: sustituto.pctIngresos,
      pct_referido: sustituto.pctReferido,
      desde: diaSiguiente(fecha),
    });
    if (eI) {
      // Sin sustituto grabado no se deja el cierre a medias: se reabre la asignación.
      await a.from("asignaciones").update({ hasta: null }).eq("id", id);
      return { error: eI.message };
    }
  }

  revalidatePath("/profesores");
  revalidatePath("/asistencia");
  return { ok: true };
}

export async function eliminarAsignacion(id: number): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("profesores", "eliminar"))) return { error: "Sin permiso." };
  // Sin comisiones devengadas todavía (esa tabla llega en 0007): se elimina.
  const { error } = await admin().from("asignaciones").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/profesores");
  return { ok: true };
}
