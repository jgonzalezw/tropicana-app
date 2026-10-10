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

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type { AvisoAlumno, ClaseSuspendida, ContactoAviso } from "./comunicaciones/legado/clase.ts";
export {
  fmtLarga,
  mensajeSuspension,
  mensajeReapertura,
  mensajeSuspensionProfesor,
} from "./comunicaciones/legado/clase.ts";
import {
  armarAvisosSuspension,
  armarAvisoProfesor,
  type AvisoAlumno,
  type ClaseSuspendida,
  type ContactoAviso,
  type ProfesorDeAviso,
} from "./comunicaciones/legado/clase.ts";

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
  return armarAvisosSuspension(datos, porAlumno);
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
  return armarAvisoProfesor(profesorId, data as unknown as ProfesorDeAviso, e);
}
