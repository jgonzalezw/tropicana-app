/**
 * Contactos (C3-0a.1) — normalización y helpers puros, compartidos entre el
 * cliente y las acciones del servidor. `alumnos`/`profesores` son extensiones
 * de rol que apuntan a `contactos.id` (`contacto_id`); acá vive todo lo que
 * no necesita la base para decidirse.
 */

import type { Contacto } from "./tipos.ts";
import { soloDigitos } from "./texto.ts";

/**
 * Normaliza un WhatsApp al formato internacional boliviano, igual criterio
 * que `public.normalizar_whatsapp()` en la migración 0048 — las dos
 * implementaciones tienen que dar el mismo resultado para el mismo texto,
 * porque la base es quien manda la unicidad (`contactos_whatsapp_uk`) y el
 * cliente es quien decide qué mostrarle a la persona antes de guardar.
 *
 * 8 dígitos → `+591` + eso. Ya con `591` adelante (11 dígitos) → se antepone
 * el `+`. Cualquier otro formato de puros dígitos se deja sin normalizar: no
 * es un número boliviano reconocible, y no se inventa uno (es el caso del
 * relleno automático de la 0048). Pero si la persona ya escribió el `+` a
 * mano —corrigiendo un número extranjero, como Manuel Aguilar (+34…)— ese
 * `+` es una decisión explícita y se respeta: no hay que "adivinar" el país,
 * hay que no descartar lo que ya eligieron.
 */
export function normalizarWhatsapp(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  const d = t.replace(/\D/g, "");
  if (d === "") return null;
  if (d.length === 8) return `+591${d}`;
  if (d.length === 11 && d.startsWith("591")) return `+${d}`;
  if (t.startsWith("+")) return `+${d}`;
  return d;
}

/** `true` si el texto ya está en formato internacional boliviano (+591...). */
export function whatsappEnFormato(texto: string | null | undefined): boolean {
  return !!texto && /^\+591\d{8}$/.test(texto);
}

/** Nombre para mostrar de un contacto, con el resabio explícito si falta. */
export function nombreCompleto(c: Pick<Contacto, "tipo" | "nombre" | "apellido" | "razon_social"> | null | undefined): string {
  if (!c) return "—";
  if (c.tipo === "organizacion") return c.razon_social?.trim() || "—";
  const partes = [c.nombre, c.apellido].filter((x) => x && x.trim());
  return partes.length ? partes.join(" ") : "—";
}

/** Apellido para ordenar/mostrar en listas (regla 15: siempre por apellido). */
export function apellidoDe(c: Pick<Contacto, "apellido" | "nombre"> | null | undefined): string {
  return c?.apellido?.trim() || c?.nombre?.trim() || "";
}

const REDES_PATRONES: Record<string, RegExp> = {
  instagram: /instagram\.com\/([A-Za-z0-9_.]+)/i,
  facebook: /facebook\.com\/([A-Za-z0-9_.]+)/i,
  tiktok: /tiktok\.com\/@([A-Za-z0-9_.]+)/i,
};

/**
 * Acepta una URL de perfil o un `@usuario` pegado a mano y devuelve el
 * usuario limpio (sin `@`, sin dominio). Si no matchea ningún patrón
 * conocido, devuelve el texto tal cual, recortado — la persona puede haber
 * pegado solo el usuario.
 */
export function normalizarRed(red: string, entrada: string): string {
  const t = entrada.trim();
  if (!t) return "";
  const patron = REDES_PATRONES[red];
  if (patron) {
    const m = t.match(patron);
    if (m) return m[1];
  }
  return t.replace(/^@/, "").replace(/\/$/, "");
}

/** Valida un número de documento contra el patrón de su tipo (null = sin formato fijo). */
export function validarDocumento(patron: string | null, numero: string): boolean {
  const n = numero.trim();
  if (!n) return false;
  if (!patron) return true;
  try {
    return new RegExp(patron).test(n);
  } catch {
    return true;
  }
}

export type NivelMinimo = "O" | "V" | "-";

/**
 * Validación compartida de identidad para un alumno: se identifica por su
 * propio WhatsApp, o por el del tutor si es menor (o un tutor ya elegido).
 * Es pura a propósito — vive acá, no en las acciones del servidor, porque
 * Next.js exige que todo lo exportado de un archivo "use server" sea
 * async, y esto no necesita serlo.
 */
export function validarIdentidadAlumno(d: {
  nombre: string;
  apellido: string;
  es_menor: boolean;
  whatsapp: string;
  tutorContactoId: number | null;
  tutorWhatsapp: string;
}): string | null {
  if (!d.nombre.trim() || !d.apellido.trim()) return "Nombre y apellido son obligatorios.";
  if (d.es_menor) {
    if (!d.tutorContactoId && soloDigitos(d.tutorWhatsapp).length < 6)
      return "El WhatsApp del tutor identifica al menor (6+ dígitos), o elegí un tutor ya cargado.";
  } else if (soloDigitos(d.whatsapp).length < 6) {
    return "El WhatsApp identifica al alumno (6+ dígitos).";
  }
  return null;
}

/** Compara dos personas por apellido (fallback nombre), igual que `compararPorApellido`. */
export function compararContactosPorApellido(
  a: Pick<Contacto, "nombre" | "apellido"> | null | undefined,
  b: Pick<Contacto, "nombre" | "apellido"> | null | undefined
): number {
  const a1 = apellidoDe(a);
  const b1 = apellidoDe(b);
  const porApellido = a1.localeCompare(b1, "es", { sensitivity: "base" });
  if (porApellido !== 0) return porApellido;
  return (a?.nombre ?? "").localeCompare(b?.nombre ?? "", "es", { sensitivity: "base" });
}
