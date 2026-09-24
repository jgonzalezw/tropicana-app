"use server";

/**
 * Contactos (C3-0a.1) — el punto único donde se crea o reusa una persona.
 * `alumnos`/`profesores` son extensiones de rol: sus acciones de alta
 * (`crearAlumno`, `crearProfesor`, `crearAlumnoDesdeInscripcion`) llaman a
 * `crearOReusarContactoPersona` antes de insertar su propia fila, en vez de
 * escribir nombre/apellido/whatsapp por su cuenta. Así la validación y la
 * normalización del WhatsApp quedan en un solo lugar (antes estaba
 * duplicada entre `alumnos/acciones.ts` e `inscribir/acciones.ts`).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarWhatsapp } from "@/lib/contactos";
import type { Contacto } from "@/lib/tipos";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

function mapearErrorContacto(e: { code?: string; message?: string }): string {
  if (e.code === "23505") return "Ese WhatsApp ya es de otro contacto.";
  return e.message ?? "No se pudo guardar el contacto.";
}

type ResultadoContacto = { contacto?: Contacto; error?: string };

/**
 * Crea un contacto tipo persona, o reusa uno existente si su WhatsApp
 * normalizado ya está cargado (regla de negocio: un contacto, un WhatsApp).
 * `reusarSiExiste=false` fuerza a crear uno nuevo aunque el número ya
 * exista — el `insert` entonces falla con el 23505 de siempre y el
 * llamador decide (es el caso de "es otra persona" en la ficha).
 */
export async function crearOReusarContactoPersona(datos: {
  nombre: string;
  apellido?: string | null;
  whatsapp?: string | null;
  canal_captacion?: string | null;
  reusarSiExiste?: boolean;
}): Promise<ResultadoContacto> {
  const wa = normalizarWhatsapp(datos.whatsapp);

  if (datos.reusarSiExiste !== false && wa) {
    const { data: existente } = await admin().from("contactos").select("*").eq("whatsapp", wa).maybeSingle();
    if (existente) return { contacto: existente as Contacto };
  }

  const { data, error } = await admin()
    .from("contactos")
    .insert({
      tipo: "persona",
      nombre: datos.nombre.trim(),
      apellido: datos.apellido?.trim() || null,
      whatsapp: wa,
      canal_captacion: datos.canal_captacion ?? null,
    })
    .select("*")
    .single();
  if (error) return { error: mapearErrorContacto(error) };
  return { contacto: data as Contacto };
}

export async function actualizarContactoPersona(
  id: number,
  datos: { nombre: string; apellido?: string | null; whatsapp?: string | null; canal_captacion?: string | null }
): Promise<{ error?: string }> {
  const wa = normalizarWhatsapp(datos.whatsapp);
  const { error } = await admin()
    .from("contactos")
    .update({
      nombre: datos.nombre.trim(),
      apellido: datos.apellido?.trim() || null,
      whatsapp: wa,
      canal_captacion: datos.canal_captacion ?? null,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: mapearErrorContacto(error) };
  return {};
}

/**
 * Resuelve el tutor de un menor a partir de lo que cargó la ficha: si ya
 * eligió un contacto existente (`tutorContactoId`), lo reusa tal cual; si
 * no, busca por WhatsApp normalizado y si tampoco existe crea uno nuevo.
 * Nunca "adivina" fusionando por nombre — eso quedó para el relleno de la
 * 0048, que sí tenía casos medidos para justificarlo.
 */
export async function resolverTutor(datos: {
  tutorContactoId: number | null;
  tutorNombre: string;
  tutorWhatsapp: string;
}): Promise<ResultadoContacto> {
  if (datos.tutorContactoId) {
    const { data, error } = await admin().from("contactos").select("*").eq("id", datos.tutorContactoId).maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "El contacto elegido como tutor ya no existe." };
    return { contacto: data as Contacto };
  }
  return crearOReusarContactoPersona({
    nombre: datos.tutorNombre.trim() || "Tutor sin nombre",
    whatsapp: datos.tutorWhatsapp,
  });
}

export async function vincularTutor(tutorContactoId: number, hijoContactoId: number): Promise<{ error?: string }> {
  const { error } = await admin()
    .from("contacto_relaciones")
    .upsert(
      { desde_id: tutorContactoId, hacia_id: hijoContactoId, tipo: "tutor_de" },
      { onConflict: "desde_id,hacia_id,tipo", ignoreDuplicates: true }
    );
  if (error) return { error: error.message };
  return {};
}
