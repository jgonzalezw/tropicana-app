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

/**
 * "Apellido, Nombre" — para las listas que ya ordenan por apellido (regla
 * de negocio 15): mostrar nombre primero rompe la lectura del agrupamiento
 * alfabético (Javier, 2026-09-24: "se ve el nombre primero, no se
 * distingue"). `nombreCompleto` sigue siendo "Nombre Apellido" para el
 * resto de la app (recibos, fichas, texto corrido).
 */
export function apellidoNombre(c: Pick<Contacto, "tipo" | "nombre" | "apellido" | "razon_social"> | null | undefined): string {
  if (!c) return "—";
  if (c.tipo === "organizacion") return c.razon_social?.trim() || "—";
  const apellido = c.apellido?.trim();
  const nombre = c.nombre?.trim();
  if (apellido && nombre) return `${apellido}, ${nombre}`;
  return apellido || nombre || "—";
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

type Documento = { tipo_documento: string; numero: string; complemento: string | null; expedido: string | null };

/**
 * Un documento sin número es "sin documento" (`null`), nunca un objeto vacío:
 * uno vacío viajaba con `tipo_documento = ""` y la base lo rechazaba por la
 * clave foránea (caso Nadine Salek, producción 2026-09-24). Un tipo que no
 * está en el catálogo se rechaza acá con un mensaje claro.
 */
export function documentoNormalizado(
  doc: Documento | null | undefined,
  tiposValidos: string[]
): { documento: Documento | null; error?: undefined } | { documento?: undefined; error: string } {
  if (!doc || !doc.numero.trim()) return { documento: null };
  if (!tiposValidos.includes(doc.tipo_documento)) return { error: "Elegí el tipo de documento." };
  return {
    documento: {
      tipo_documento: doc.tipo_documento,
      numero: doc.numero.trim(),
      complemento: doc.complemento?.trim() || null,
      expedido: doc.expedido?.trim() || null,
    },
  };
}

/** Documento comparable: sin espacios ni guiones, en mayúsculas (un pasaporte lleva letras). */
export function documentoComparable(texto: string | null | undefined): string {
  return (texto ?? "").replace(/[\s-]/g, "").toUpperCase();
}

/**
 * El filtro de "Buscar" de Alumnos y Profesores, en un solo lugar. Los
 * criterios de siempre quedan intactos —nombre, WhatsApp propio y WhatsApp
 * del tutor, desde 3 dígitos—; el documento es uno más que se SUMA, no
 * reemplaza nada (Javier, 2026-09-24). Un contacto sin documento se
 * encuentra exactamente igual que antes.
 */
export function coincideBusqueda(
  q: string,
  c: {
    contacto: Pick<Contacto, "tipo" | "nombre" | "apellido" | "razon_social" | "whatsapp">;
    tutorWhatsapp?: string | null;
    documento?: string | null;
  }
): boolean {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return false;
  if (nombreCompleto(c.contacto).toLowerCase().includes(s)) return true;
  const d = soloDigitos(q);
  if (d.length >= 3 && (soloDigitos(c.contacto.whatsapp).includes(d) || soloDigitos(c.tutorWhatsapp).includes(d)))
    return true;
  const qDoc = documentoComparable(q);
  return qDoc.length >= 3 && documentoComparable(c.documento).includes(qDoc);
}

/**
 * Arma la URL del perfil de una red social a partir de la plantilla del
 * catálogo (`redes_sociales.patron_url`, `{usuario}` es el marcador) y lo
 * que la persona haya escrito — que puede ser una URL completa pegada a
 * mano, así que se limpia con `normalizarRed` antes de armar el link.
 * `null` si no hay plantilla, no hay usuario, o la plantilla no es https
 * (una plantilla mal cargada no debe poder mandar a otro esquema).
 */
export function urlPerfilRed(patron: string | null, red: string, usuario: string): string | null {
  if (!patron || !patron.startsWith("https://")) return null;
  // La red "whatsapp" (distinta del WhatsApp propio del contacto) usa
  // wa.me, que solo entiende dígitos.
  const limpio = red === "whatsapp" ? soloDigitos(usuario) : normalizarRed(red, usuario);
  if (!limpio) return null;
  return patron.replace("{usuario}", encodeURIComponent(limpio));
}

/**
 * El link para abrir un chat de WhatsApp (`wa.me`). Solo si el número está
 * en formato internacional reconocido (`+591...` u otro `+<país>`): un
 * número crudo de los que marca el control 23 (9 u 11 dígitos sin `+`) no
 * alcanza para armar el link sin inventarle el país (regla de calidad 1).
 */
export function urlChatWhatsapp(numero: string | null | undefined, texto?: string): string | null {
  const n = (numero ?? "").trim();
  if (!n.startsWith("+")) return null;
  const digitos = soloDigitos(n);
  if (digitos.length < 8) return null;
  const query = texto?.trim() ? `?text=${encodeURIComponent(texto.trim())}` : "";
  return `https://wa.me/${digitos}${query}`;
}

/** Edad en años cumplidos a hoy, a partir de una fecha ISO (YYYY-MM-DD). */
export function edadDesde(fechaISO: string): number {
  const nacimiento = new Date(`${fechaISO}T00:00:00`);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const antesDelCumple =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (antesDelCumple) edad--;
  return edad;
}

/**
 * La fecha de nacimiento tiene que ser consistente con "es menor" (C3-0a.3,
 * Javier 2026-09-24): si la edad calculada da menos de 18, el formulario
 * tiene que estar en el camino de menor —con tutor—, no alcanza con cargar
 * el dato y dejarlo contradicho. También descarta una fecha futura.
 */
export function validarFechaNacimiento(fecha: string | null, esMenor: boolean): string | null {
  if (!fecha) return null;
  const nacimiento = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return "La fecha de nacimiento no es válida.";
  if (nacimiento.getTime() > Date.now()) return "La fecha de nacimiento no puede ser futura.";
  if (edadDesde(fecha) < 18 && !esMenor)
    return 'Esa fecha de nacimiento corresponde a un menor de edad: marcá "Es menor" y cargá el tutor.';
  return null;
}

/**
 * Validación de IDENTIDAD para un alumno: se identifica por su propio
 * WhatsApp, o por el del tutor si es menor (o un tutor ya elegido) — es lo
 * que detecta duplicados, y por eso queda hardcodeada, no en la matriz de
 * mínimos (C3-0a.3): cambiar esa celda no puede apagar la detección.
 * Nombre/apellido y el resto de los campos SÍ pasan por la matriz —
 * ver `faltantes()` en `matrizMinimos.ts`, que valida el resto.
 * Es pura a propósito — vive acá, no en las acciones del servidor, porque
 * Next.js exige que todo lo exportado de un archivo "use server" sea
 * async, y esto no necesita serlo.
 */
export function validarIdentidadAlumno(d: {
  es_menor: boolean;
  whatsapp: string;
  tutorContactoId: number | null;
  tutorWhatsapp: string;
}): string | null {
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
