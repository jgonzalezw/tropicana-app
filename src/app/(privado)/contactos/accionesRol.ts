"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import { normalizarWhatsapp, nombreCompleto } from "@/lib/contactos";
import { rolDe, type RolContacto } from "@/lib/contactoVenta";

/**
 * Alta de un rol sobre un contacto que ya existe (E4 de "Ventas y contactos con
 * el mismo comportamiento"): un contacto puede ser alumno, profesor, los dos o
 * ninguno, y su identidad vive una sola vez (regla 21). Por eso cargar un
 * alumno o un profesor cuyo WhatsApp ya es de otro contacto no se rechaza: se
 * ofrece usarlo y agregarle el rol que le falta.
 */

export type ContactoExistente = {
  contactoId: number;
  nombre: string;
  whatsapp: string | null;
  rol: RolContacto;
};

/**
 * El contacto con ese WhatsApp **que todavía no tiene el rol pedido**. Si ya lo
 * tiene, devuelve `null`: ese caso es un duplicado del propio rol y lo avisa la
 * pantalla con su padrón (no hay nada que agregar).
 */
export async function contactoSinRol(
  rol: "alumno" | "profesor",
  whatsapp: string
): Promise<{ existente: ContactoExistente | null; error?: string }> {
  const modulo = rol === "alumno" ? "alumnos" : "profesores";
  if (!(await tienePermiso(modulo, "crear")) && !(await tienePermiso(modulo, "editar")))
    return { existente: null };
  const wa = normalizarWhatsapp(whatsapp);
  if (!wa) return { existente: null };

  const a = createAdminClient();
  if (!a) return { existente: null, error: "Falta configurar la clave service_role en el servidor." };
  const { data, error } = await a
    .from("contactos")
    .select("id, nombre, apellido, razon_social, whatsapp, tipo, alumnos(id), profesores(id)")
    .eq("whatsapp", wa)
    .is("anonimizado_en", null)
    .limit(1);
  if (error) return { existente: null, error: `No se pudo revisar el WhatsApp: ${error.message}` };
  const c = (data ?? [])[0] as
    | {
        id: number;
        nombre: string | null;
        apellido: string | null;
        razon_social: string | null;
        whatsapp: string | null;
        tipo: string;
        alumnos: { id: number }[] | { id: number } | null;
        profesores: { id: number }[] | { id: number } | null;
      }
    | undefined;
  if (!c || c.tipo !== "persona") return { existente: null };
  // Con `contacto_id` UNIQUE, PostgREST devuelve un objeto y no un arreglo.
  const hay = (x: { id: number }[] | { id: number } | null) => (Array.isArray(x) ? x.length > 0 : !!x);
  const esAlumno = hay(c.alumnos);
  const esProfesor = hay(c.profesores);
  if ((rol === "alumno" && esAlumno) || (rol === "profesor" && esProfesor)) return { existente: null };
  return {
    existente: {
      contactoId: c.id,
      nombre: nombreCompleto({ tipo: "persona", nombre: c.nombre, apellido: c.apellido, razon_social: c.razon_social }),
      whatsapp: c.whatsapp,
      rol: rolDe(esAlumno, esProfesor),
    },
  };
}
