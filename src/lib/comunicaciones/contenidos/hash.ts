/**
 * R20 · E4a — hash canónico de una versión de contenido. ÚNICO lugar donde se
 * calcula: la base lo guarda, no lo recalcula.
 *
 * Serialización (documentada en la propuesta E4, §1.4):
 *  1. objeto JSON con exactamente las claves `asunto`, `cuerpo` y `esquema`;
 *  2. claves ordenadas por unidad de código, en todos los niveles;
 *  3. el orden de las listas se conserva;
 *  4. `asunto` es `null` en WhatsApp;
 *  5. `cuerpo` y `asunto` exactos: sin recortar espacios ni normalizar saltos
 *     de línea ni caracteres (ni Unicode);
 *  6. sin espacios entre elementos; cadenas en JSON estándar;
 *  7. el esquema es `{condiciones, listas, variables}` y cada variable
 *     `{nombre, obligatoria, permiteVacia}`, los tres campos siempre presentes.
 * Resultado: SHA-256 del texto UTF-8, en hexadecimal minúsculas.
 */
import { createHash } from "node:crypto";

export type VariableEsquemaCanonica = { nombre: string; obligatoria: boolean; permiteVacia: boolean };
export type EsquemaCanonico = {
  condiciones: string[];
  listas: string[];
  variables: VariableEsquemaCanonica[];
};

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** JSON con las claves de cada objeto ordenadas y sin espacios. */
export function serializarCanonico(v: Json): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(serializarCanonico).join(",")}]`;
  const claves = Object.keys(v).sort();
  return `{${claves.map((k) => `${JSON.stringify(k)}:${serializarCanonico(v[k])}`).join(",")}}`;
}

export function hashContenido(c: { cuerpo: string; asunto: string | null; esquema: EsquemaCanonico }): string {
  const texto = serializarCanonico({ asunto: c.asunto, cuerpo: c.cuerpo, esquema: c.esquema as unknown as Json });
  return createHash("sha256").update(texto, "utf8").digest("hex");
}
