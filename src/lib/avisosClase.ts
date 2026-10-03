/**
 * Los avisos de una clase de curso que cambió (suspendida o restablecida), en
 * una sola pieza (regla de proceso 4). La usan el cierre de sala
 * (`administracion/sala/acciones.ts`), la suspensión y la reapertura manuales
 * (`asistencia/acciones.ts`, desde /sala o Tomar asistencia).
 *
 * Los mensajes son **funciones puras** (probadas en `avisosClase.test.ts`);
 * `contactosDeAlumnos` es la única que lee la base. A un menor sin WhatsApp
 * propio el aviso le llega a su tutor (regla de proceso 12).
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { fechaLarga } from "./inscripcion.ts";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Un aviso listo para mandar. `id` es solo la clave de React (una reserva de
 *  particular suma su alumno Y su profesor, cada uno con su propio aviso). */
export type AvisoAlumno = { id: string; nombre: string; whatsapp: string | null; mensaje: string };

export type ClaseSuspendida = {
  curso: string;
  fecha: string;
  finCicloNuevo: string | null;
  /** Ya dicho con su etiqueta del catálogo, nunca la clave cruda. */
  motivoTexto: string;
};

export function fmtLarga(iso: string): string {
  return fechaLarga(new Date(iso.slice(0, 10) + "T00:00:00"));
}

/** El aviso al alumno cuando una o más de sus clases quedaron suspendidas. */
export function mensajeSuspension(e: { nombrePila: string; clases: ClaseSuspendida[] }): string {
  const { clases } = e;
  const detalle = clases.map((cl) => `${cl.curso} del ${fmtLarga(cl.fecha)}`).join(clases.length > 1 ? ", " : "");
  const finCiclo = clases.find((cl) => cl.finCicloNuevo)?.finCicloNuevo;
  // El motivo que se lee es el de la primera clase: en el uso real se guarda
  // una excepción por vez, así que las clases de un mismo aviso comparten motivo.
  const partes = [
    `Hola ${e.nombrePila}! Te avisamos que tu clase de ${detalle} qued${
      clases.length > 1 ? "aron suspendidas" : "ó suspendida"
    } por ${clases[0].motivoTexto}.`,
  ];
  if (finCiclo) partes.push(`Tu ciclo se corrió: ahora vence el ${fmtLarga(finCiclo)}.`);
  partes.push("Cualquier duda, escribinos por acá. ¡Gracias!");
  return partes.join(" ");
}

/** El aviso al alumno cuando una clase suspendida se restableció. */
export function mensajeReapertura(e: {
  nombrePila: string;
  curso: string;
  fecha: string;
  finCiclo: string | null;
}): string {
  const partes = [
    `Hola ${e.nombrePila}! Te avisamos que tu clase de ${e.curso} del ${fmtLarga(e.fecha)} se restableció: se dicta con normalidad.`,
  ];
  if (e.finCiclo) partes.push(`Tu ciclo vuelve a vencer el ${fmtLarga(e.finCiclo)}.`);
  partes.push("Cualquier duda, escribinos por acá. ¡Gracias!");
  return partes.join(" ");
}

/** El aviso al profesor titular de una clase que se suspendió. */
export function mensajeSuspensionProfesor(e: {
  nombrePila: string;
  curso: string;
  fecha: string;
  motivoTexto: string;
}): string {
  return `Hola ${e.nombrePila}! Te avisamos que la clase de ${e.curso} del ${fmtLarga(e.fecha)} quedó suspendida por ${e.motivoTexto}. No hace falta que la dictes.`;
}

export type ContactoAviso = { nombre: string; nombrePila: string; whatsapp: string | null };

/**
 * Nombre y WhatsApp de cada alumno, listo para avisar. Un menor sin WhatsApp
 * propio usa el de su tutor (`contacto_relaciones` tipo `tutor_de`), si lo tiene.
 */
export async function contactosDeAlumnos(a: Admin, alumnoIds: number[]): Promise<Map<number, ContactoAviso>> {
  const salida = new Map<number, ContactoAviso>();
  if (!alumnoIds.length) return salida;
  const { data, error } = await a
    .from("alumnos")
    .select("id, contacto_id, es_menor, contacto:contactos(nombre, apellido, whatsapp)")
    .in("id", alumnoIds);
  if (error) throw new Error(`No se pudieron leer los contactos para el aviso: ${error.message}`);
  type Fila = {
    id: number;
    contacto_id: number;
    es_menor: boolean;
    contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null;
  };
  const filas = (data as unknown as Fila[]) ?? [];

  const idsMenoresSinWa = filas.filter((x) => x.es_menor && !x.contacto?.whatsapp).map((x) => x.contacto_id);
  const waTutor = new Map<number, string>();
  if (idsMenoresSinWa.length) {
    const { data: rels } = await a
      .from("contacto_relaciones")
      .select("hacia_id, tutor:contactos!contacto_relaciones_desde_id_fkey(whatsapp)")
      .eq("tipo", "tutor_de")
      .in("hacia_id", idsMenoresSinWa);
    for (const r of (rels as unknown as { hacia_id: number; tutor: { whatsapp: string | null } | null }[]) ?? [])
      if (r.tutor?.whatsapp) waTutor.set(r.hacia_id, r.tutor.whatsapp);
  }

  for (const f of filas) {
    const nombre = f.contacto ? `${f.contacto.nombre ?? ""} ${f.contacto.apellido ?? ""}`.trim() : `Alumno #${f.id}`;
    salida.set(f.id, {
      nombre,
      nombrePila: f.contacto?.nombre ?? nombre,
      whatsapp: f.contacto?.whatsapp ?? waTutor.get(f.contacto_id) ?? null,
    });
  }
  return salida;
}

/** Avisos de suspensión para varios alumnos, ordenados por nombre. */
export async function avisosSuspensionAlumnos(
  a: Admin,
  porAlumno: Map<number, ClaseSuspendida[]>
): Promise<AvisoAlumno[]> {
  const datos = await contactosDeAlumnos(a, [...porAlumno.keys()]);
  const avisos: AvisoAlumno[] = [];
  for (const [alumnoId, clases] of porAlumno) {
    const c = datos.get(alumnoId);
    const nombre = c?.nombre ?? `Alumno #${alumnoId}`;
    avisos.push({
      id: `curso-${alumnoId}`,
      nombre,
      whatsapp: c?.whatsapp ?? null,
      mensaje: mensajeSuspension({ nombrePila: c?.nombrePila ?? nombre, clases }),
    });
  }
  return avisos.sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
}

/** El aviso al profesor titular (si tiene WhatsApp cargado, el botón queda habilitado). */
export async function avisoProfesorTitular(
  a: Admin,
  profesorId: number | null,
  e: { curso: string; fecha: string; motivoTexto: string }
): Promise<AvisoAlumno | null> {
  if (profesorId == null) return null;
  const { data } = await a
    .from("profesores")
    .select("id, contacto:contactos(nombre, apellido, whatsapp)")
    .eq("id", profesorId)
    .maybeSingle();
  const p = data as unknown as {
    id: number;
    contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null;
  } | null;
  if (!p?.contacto) return null;
  const nombre = `${p.contacto.nombre ?? ""} ${p.contacto.apellido ?? ""}`.trim() || `Profesor #${p.id}`;
  return {
    id: `profesor-${p.id}`,
    nombre,
    whatsapp: p.contacto.whatsapp,
    mensaje: mensajeSuspensionProfesor({ nombrePila: p.contacto.nombre ?? nombre, ...e }),
  };
}
