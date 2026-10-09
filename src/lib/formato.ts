/**
 * Presentación de textos. Solo se muestra distinto: nunca cambia datos.
 */

/** Siglas que `nombreVisible` deja como están. Lista editable. */
export const SIGLAS_NOMBRE_VISIBLE: readonly string[] = ["QR", "SRL", "SA", "UMSA"];

/**
 * Nombre de plan (o curso) para mostrar. Solo actúa si el texto está entero en
 * mayúsculas (no tiene ninguna minúscula); un nombre con minúsculas se deja
 * intacto, así que corregirlo a mano en Planes alcanza para que se respete.
 *
 * Si actúa, pasa a mayúscula inicial («FLEX 6H PARTICULARES SALSA» → «Flex 6H
 * particulares salsa») y conserva tal cual las palabras con números («6H»,
 * «C1») y las siglas de `SIGLAS_NOMBRE_VISIBLE`. La mayúscula inicial va en la
 * primera palabra que se convierte, no en un número que abre el texto.
 *
 * No cubre nombres propios dentro del plan (un estilo, un lugar): «WEDING DANCE
 * ESCENCIA» queda «Weding dance escencia».
 */
export function nombreVisible(texto: string | null | undefined): string {
  if (!texto) return "";
  if (/\p{Ll}/u.test(texto)) return texto;
  let primera = true;
  return texto
    .split(/(\s+)/)
    .map((trozo) => {
      if (!trozo.trim()) return trozo;
      if (/\d/.test(trozo)) return trozo;
      const sinSignos = trozo.replace(/[^\p{L}\p{N}]/gu, "");
      if (SIGLAS_NOMBRE_VISIBLE.includes(sinSignos)) return trozo;
      const minusculas = trozo.toLocaleLowerCase("es");
      if (!primera) return minusculas;
      const i = minusculas.search(/\p{L}/u);
      if (i < 0) return minusculas;
      primera = false;
      return minusculas.slice(0, i) + minusculas.charAt(i).toLocaleUpperCase("es") + minusculas.slice(i + 1);
    })
    .join("");
}
