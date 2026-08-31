/** Convierte un texto libre en una clave interna: minúsculas, sin acentos, con guiones bajos. */
export function generarClave(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Deja sólo los dígitos de un WhatsApp (para búsqueda e identidad). */
export function soloDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}

/**
 * Comparador para ordenar personas **alfabéticamente por apellido** (luego
 * nombre), en español. Regla transversal: toda lista de personas usada para
 * localizar a alguien se ordena así, en cualquier entidad del sistema.
 */
export function compararPorApellido(
  a: { nombre?: string | null; apellido?: string | null },
  b: { nombre?: string | null; apellido?: string | null }
): number {
  const porApellido = (a.apellido ?? "").localeCompare(b.apellido ?? "", "es", {
    sensitivity: "base",
  });
  if (porApellido !== 0) return porApellido;
  return (a.nombre ?? "").localeCompare(b.nombre ?? "", "es", {
    sensitivity: "base",
  });
}
