/**
 * El alta y la elección de un contacto en una venta — lógica pura, compartida
 * entre la pantalla (qué falta, qué rol tiene) y el servidor (qué rechazar).
 * Una sola función decide, nunca dos copias que puedan desalinearse (regla de
 * calidad 9).
 *
 * "Ventas y contactos con el mismo comportamiento" (Javier, 2026-10-01): el
 * titular de un curso, una particular o un alquiler se busca, se crea y se
 * muestra igual; la organización existe solo donde el flujo la permite.
 */

import type { CampoMinimo, ContextoMinimo, DatosContactoExtra, NivelMinimo, TipoContacto } from "./tipos.ts";
import { ETIQUETA_CAMPO_MINIMO } from "./tipos.ts";
import { presenteDesdeExtra } from "./matrizMinimos.ts";
import { soloDigitos } from "./texto.ts";

/** Qué es hoy un contacto en la academia (un contacto puede ser alumno, profesor, los dos o ninguno). */
export type RolContacto = "alumno" | "profesor" | "alumno_profesor" | "contacto";

export const ETIQUETA_ROL_CONTACTO: Record<RolContacto, string> = {
  alumno: "Alumno",
  profesor: "Profesor",
  alumno_profesor: "Alumno y profesor",
  contacto: "Solo contacto",
};

export function rolDe(esAlumno: boolean, esProfesor: boolean): RolContacto {
  if (esAlumno && esProfesor) return "alumno_profesor";
  if (esAlumno) return "alumno";
  if (esProfesor) return "profesor";
  return "contacto";
}

/** Un contacto tal como lo muestra el buscador y la tarjeta del titular. */
export type ContactoResumen = {
  id: number;
  tipo: TipoContacto;
  nombre: string;
  whatsapp: string | null;
  rol: RolContacto;
  noContactar: boolean;
};

/** El contexto de la matriz de mínimos de un tercero (alquiler, servicio especial). */
export function contextoTercero(tipo: TipoContacto): ContextoMinimo {
  return tipo === "organizacion" ? "tercero_org" : "tercero_persona";
}

/** Lo que el formulario de alta arma antes de guardar. */
export type FormAltaContacto = {
  tipo: TipoContacto;
  nombre: string;
  apellido: string;
  razonSocial: string;
  whatsapp: string;
  extra: DatosContactoExtra;
};

/**
 * Los campos del alta que la matriz marca obligatorios y todavía no están,
 * en el orden en que la pantalla los pide. Nombre (persona) o razón social
 * (organización) y WhatsApp se exigen según la matriz; las celdas que la
 * base o la identidad vuelven obligatorias están bloqueadas en el editor.
 */
export function faltantesAlta(
  f: FormAltaContacto,
  niveles: Record<CampoMinimo, NivelMinimo>
): CampoMinimo[] {
  const presente: Partial<Record<CampoMinimo, boolean>> = {
    nombre: !!f.nombre.trim(),
    apellido: !!f.apellido.trim(),
    razon_social: !!f.razonSocial.trim(),
    whatsapp: soloDigitos(f.whatsapp).length >= 6,
    ...presenteDesdeExtra(f.extra),
  };
  const orden: CampoMinimo[] =
    f.tipo === "organizacion"
      ? ["razon_social", "whatsapp", "documento", "red_social", "email", "consentimiento"]
      : ["nombre", "apellido", "whatsapp", "documento", "red_social", "email", "sexo", "nacimiento", "consentimiento"];
  return orden.filter((c) => niveles[c] === "O" && !presente[c]);
}

const NOMBRE_EN_FALTA: Record<string, string> = {
  nombre: "el nombre",
  apellido: "el apellido",
  razon_social: "la razón social",
  whatsapp: "el WhatsApp",
  documento: "el documento",
  red_social: "una red social",
  email: "el email",
  sexo: "el sexo",
  nacimiento: "la fecha de nacimiento",
  consentimiento: "el consentimiento de contacto",
};

/** "Falta el nombre, el WhatsApp y el NIT." — o `null` si el alta está completa. */
export function textoFaltaAlta(falt: CampoMinimo[], f: Pick<FormAltaContacto, "tipo">): string | null {
  if (falt.length === 0) return null;
  const nombres = falt.map((c) =>
    c === "documento" && f.tipo === "organizacion" ? "el NIT" : (NOMBRE_EN_FALTA[c] ?? ETIQUETA_CAMPO_MINIMO[c].toLowerCase())
  );
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  return `Falta ${lista}.`;
}

/**
 * El título de un duplicado según lo que chocó. Un documento repetido nunca
 * ofrece "es otro contacto": la base no admite dos contactos con el mismo
 * documento.
 */
export function tituloDuplicado(por: "whatsapp" | "documento"): string {
  return por === "whatsapp" ? "Ese WhatsApp ya está cargado" : "Ese documento ya es de otro contacto";
}
