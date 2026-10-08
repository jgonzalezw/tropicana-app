"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import type { DatosProfesor } from "@/lib/tipos";
import {
  diaAnterior,
  diaSiguiente,
  validarAsignacionNueva,
  validarDesasignacion,
  type DatosSustituto,
} from "@/lib/desasignacion";
import { cierreDeCuentas, type VistaCierre } from "@/app/(privado)/liquidaciones/acciones";
import { presenteDesdeExtra } from "@/lib/matrizMinimos";
import { leerEntradaRetiro } from "@/lib/liquidacion/lecturaRetiro";
import { abiertasDe, armarRetiro, type VistaRetiro } from "@/lib/liquidacion/retiro";
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

/**
 * `existenteId`: el contacto ya existe con otro rol (alumno, solo contacto) y se
 * le agrega el de profesor. Su identidad no se toca (regla 21): nombre, WhatsApp
 * y demás se editan aparte, con el permiso del módulo `contactos`.
 */
export async function crearProfesor(d: DatosProfesor, existenteId?: number | null): Promise<Resultado> {
  if (!(await tienePermiso("profesores", "crear"))) return { error: "Sin permiso." };
  const err = validar(d);
  if (err) return { error: err };

  if (existenteId) {
    const { data: ya } = await admin().from("profesores").select("id").eq("contacto_id", existenteId).maybeSingle();
    if (ya) return { error: "Ese contacto ya es profesor." };
    const { data: fila, error } = await admin()
      .from("profesores")
      .insert({
        contacto_id: existenteId,
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
    revalidatePath("/profesores");
    return { ok: true };
  }

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

  // Con cursos a cargo se da de baja por Retirar (D34): desactivar a mano dejaba
  // un titular inactivo (control 48). La base también lo rechaza (0065).
  const { count: abiertas } = await admin()
    .from("asignaciones")
    .select("id", { count: "exact", head: true })
    .eq("profesor_id", id)
    .is("hasta", null);
  if ((abiertas ?? 0) > 0)
    return { error: "Tiene cursos a cargo: se da de baja con «Retirar…», que cierra sus asignaciones y su cuenta." };

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
  pctReferido: number,
  desde: string
): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  if (!(pctIngresos >= 1 && pctIngresos <= 100))
    return { error: "El % sobre los ingresos tiene que estar entre 1 y 100." };
  if (!(pctReferido >= 0 && pctReferido <= 100))
    return { error: "El % por referido tiene que estar entre 0 y 100." };

  const a = admin();
  // Antes de cerrar la asignación vigente: un inactivo no puede quedar de titular (0065).
  const { data: prof, error: eProf } = await a.from("profesores").select("activo").eq("id", profesorId).maybeSingle();
  if (eProf) return { error: eProf.message };
  if (!prof) return { error: "El profesor no existe." };
  if (!prof.activo) return { error: "No se asigna un curso a un profesor inactivo." };

  const { data: previas, error: eP } = await a
    .from("asignaciones")
    .select("desde, hasta")
    .eq("curso_id", cursoId);
  if (eP) return { error: eP.message };
  const falta = validarAsignacionNueva({
    desde,
    asignaciones: (previas ?? []) as { desde: string; hasta: string | null }[],
  });
  if (falta) return { error: falta };

  // Cierra la asignación vigente del curso (si hay) el día anterior al inicio de
  // la nueva, para no violar el índice de un solo titular vigente por curso.
  const { error: errCierre } = await a
    .from("asignaciones")
    .update({ hasta: diaAnterior(desde) })
    .eq("curso_id", cursoId)
    .is("hasta", null);
  if (errCierre) return { error: errCierre.message };

  const { error } = await a.from("asignaciones").insert({
    curso_id: cursoId,
    profesor_id: profesorId,
    pct_ingresos: pctIngresos,
    pct_referido: pctReferido,
    desde,
  });
  if (error) {
    // Sin la nueva grabada no se deja el curso sin titular por el cierre.
    await a.from("asignaciones").update({ hasta: null })
      .eq("curso_id", cursoId).eq("hasta", diaAnterior(desde));
    return { error: error.message };
  }

  revalidatePath("/profesores");
  return { ok: true };
}

export type RevisionDesasignacion = {
  error?: string;
  /** Clases ya dictadas por el profesor DESPUÉS de la fecha: la fecha las deja afuera. */
  posteriores?: string[];
  /** La última clase que dictó en este curso (de contexto para elegir la fecha); null si ninguna. */
  ultimaClase?: string | null;
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

  const { data: ult, error: eU } = await a
    .from("sesiones")
    .select("fecha")
    .eq("curso_id", asig.curso_id)
    .eq("profesor_id", asig.profesor_id)
    .eq("estado", "dictada")
    .order("fecha", { ascending: false })
    .limit(1);
  if (eU) return { error: eU.message };

  return {
    posteriores: (ses ?? []).map((x) => x.fecha as string),
    ultimaClase: (ult?.[0]?.fecha as string | undefined) ?? null,
    pendientes,
  };
}

/** Vista previa del cierre de cuentas al desasignar (nada se escribe). */
export async function vistaCierreDesasignacion(id: number, fecha: string): Promise<VistaCierre> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  const { data: asig, error } = await admin()
    .from("asignaciones").select("profesor_id, curso_id").eq("id", id).maybeSingle();
  if (error) return { error: error.message };
  if (!asig) return { error: "No se encontró la asignación." };
  return cierreDeCuentas(asig.profesor_id as number, fecha, false, asig.curso_id as number);
}

/**
 * Cierra la asignación en `fecha` (último día a cargo) y, si corresponde, deja un
 * sustituto desde el día siguiente. Lo ya dictado y devengado no se toca: la
 * comisión es de quien dictó (regla 10) y se lee del historial de asignaciones.
 */
export async function desasignar(
  id: number,
  fecha: string,
  sustituto: DatosSustituto | null,
  liquidarAvance = false
): Promise<{ ok?: true; error?: string; cierre?: VistaCierre }> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  if (liquidarAvance && !(await tienePermiso("liquidaciones", "crear")))
    return { error: "Liquidar el avance requiere el permiso de crear liquidaciones." };
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

  // Cierre de cuentas (regla 8, excepción): el avance ganado hasta la fecha
  // queda devengado como pago a cuenta. Va después de cerrar la asignación para
  // que el motor ya vea quién dictó cada clase; si falla, se deshace todo.
  let cierre: VistaCierre | undefined;
  if (liquidarAvance) {
    cierre = await cierreDeCuentas(asig.profesor_id as number, fecha, true, asig.curso_id as number);
    if (cierre.error) {
      if (sustituto)
        await a.from("asignaciones").delete()
          .eq("curso_id", asig.curso_id).eq("profesor_id", sustituto.profesorId as number).eq("desde", diaSiguiente(fecha));
      await a.from("asignaciones").update({ hasta: null }).eq("id", id);
      return { error: cierre.error };
    }
  }

  revalidatePath("/profesores");
  revalidatePath("/asistencia");
  return { ok: true, cierre };
}

export async function eliminarAsignacion(id: number): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("profesores", "eliminar"))) return { error: "Sin permiso." };
  // Sin comisiones devengadas todavía (esa tabla llega en 0007): se elimina.
  const { error } = await admin().from("asignaciones").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/profesores");
  return { ok: true };
}

// ── Retiro del profesor (I-005, D34) ─────────────────────────────────────

/** La simulación del retiro: calcula todo y **no escribe nada**. */
export async function vistaRetiro(
  profesorId: number,
  corte: string,
  sustitutos: Record<number, DatosSustituto | null>
): Promise<{ error?: string; vista?: VistaRetiro; profesor?: string }> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  if (!(await tienePermiso("liquidaciones", "crear")))
    return { error: "Retirar a un profesor liquida su cierre: requiere el permiso de crear liquidaciones." };
  const l = await leerEntradaRetiro(profesorId, corte, sustitutos);
  if (!l.ok) return { error: l.error };
  return { vista: armarRetiro(l.entrada), profesor: l.entrada.profesor };
}

/**
 * Confirma el retiro. Vuelve a calcular en el servidor (no confía en la vista)
 * y lo aplica todo junto en la función `retirar_profesor` (0063): si algo
 * falla, no queda nada escrito.
 */
export async function retirarProfesor(
  profesorId: number,
  corte: string,
  sustitutos: Record<number, DatosSustituto | null>
): Promise<{ ok?: true; error?: string; liquidacionId?: number | null; vista?: VistaRetiro; confirmadoEn?: string }> {
  if (!(await tienePermiso("profesores", "editar"))) return { error: "Sin permiso." };
  if (!(await tienePermiso("liquidaciones", "crear")))
    return { error: "Retirar a un profesor liquida su cierre: requiere el permiso de crear liquidaciones." };
  const l = await leerEntradaRetiro(profesorId, corte, sustitutos);
  if (!l.ok) return { error: l.error };
  const e = l.entrada;
  const vista = armarRetiro(e);
  if (!vista.puedeConfirmar) return { error: vista.trabas[0]?.texto ?? "El retiro tiene trabas." };

  const [, mes, dia] = corte.split("-");
  const rotulo = `Cierre de cuentas · corte ${dia}/${mes}`;
  const lineas = [
    ...e.regular.pendientes.map((p) => ({
      membresia_id: p.membresiaId, curso_id: p.cursoId, plan_id: null, criterio: p.criterio,
      base: p.base, monto: p.monto, reparto: p.reparto.length > 1 ? p.reparto : null, detalle_particular: null,
      origen:
        `${rotulo} (${p.curso} / ${p.alumno}): ${p.pct}% de ${p.base} (${p.clases} de ${p.clasesDelCurso} clases al corte). ` +
        `Pago a cuenta de la liquidación final: lo ya devengado se resta de lo que corresponda al completarse.`,
      descripcion: `${rotulo} · ${p.alumno} — ${p.curso} (${p.clases}/${p.clasesDelCurso} clases · ${p.pct}% de ${p.base})`,
    })),
    ...e.particulares.pendientes.map((p) => ({
      membresia_id: p.membresiaId, curso_id: null, plan_id: p.planId, criterio: p.criterio,
      base: p.base, monto: p.monto, reparto: null, detalle_particular: p.detalle,
      origen:
        `${rotulo} (particular / ${p.alumno}): ${p.detalle.horasDadas} de ${p.detalle.horasContratadas} h al corte. ` +
        `Pago a cuenta de la liquidación final: lo ya devengado se resta de lo que corresponda al completarse.`,
      descripcion: `${rotulo} · ${p.alumno} — clase particular (${p.detalle.horasDadas}/${p.detalle.horasContratadas} h)`,
    })),
  ];
  const asignaciones = abiertasDe(e.asignaciones).map((a) => {
    const s = sustitutos[a.id];
    return {
      id: a.id,
      curso_id: a.cursoId,
      sustituto: s?.profesorId
        ? { profesor_id: s.profesorId, pct_ingresos: s.pctIngresos, pct_referido: s.pctReferido }
        : null,
    };
  });

  const { data, error } = await admin().rpc("retirar_profesor", {
    p: { profesor_id: profesorId, corte, asignaciones, lineas },
  });
  if (error) return { error: error.message };

  revalidatePath("/profesores");
  revalidatePath("/liquidaciones");
  revalidatePath("/caja");
  revalidatePath("/asistencia");
  // La vista devuelta es la que calculó el servidor al escribir: los datos finales
  // del informe de liquidación por finalización.
  return {
    ok: true,
    liquidacionId: (data as { liquidacion_id: number | null } | null)?.liquidacion_id ?? null,
    vista,
    confirmadoEn: new Date().toISOString(),
  };
}
