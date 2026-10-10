/**
 * R20 · E4a — qué contenido corresponde a una asignación (uso, variante, canal).
 * SIN USO desde la operación: conectar es E5 y no está autorizado. Mientras no
 * haya liberación devuelve `{modo:'legado'}` y la operación sigue con el código.
 *
 * Un fallo no se disfraza de ausencia (calidad 1): una asignación inexistente,
 * un modo `modulo` sin versión, una versión que no está publicada o cuyo texto
 * no reproduce su hash NO caen en «legado»: lanzan.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirUno } from "../../datos.ts";
import { hashContenido, type EsquemaCanonico } from "./hash.ts";

export type Modo = "legado" | "modulo";

export type FilaUso = { id: number; modo: Modo; contenido_id: number; version_id: number | null };
export type FilaVersion = {
  id: number;
  contenido_id: number;
  estado: string;
  cuerpo: string;
  asunto: string | null;
  esquema: EsquemaCanonico;
  hash: string;
};

export type Resolucion = { modo: "legado" } | { modo: "modulo"; versionId: number; cuerpo: string; asunto: string | null; hash: string };

/** Pura: decide con lo leído. Cualquier inconsistencia lanza. */
export function decidirResolucion(clave: string, uso: FilaUso | null, version: FilaVersion | null): Resolucion {
  if (!uso) throw new Error(`No existe la asignación de contenido ${clave}: falta importarla (migración 0072).`);
  if (uso.modo === "legado") return { modo: "legado" };
  if (uso.version_id === null) throw new Error(`La asignación ${clave} está en modo módulo sin versión liberada.`);
  if (!version || version.id !== uso.version_id) throw new Error(`La versión ${uso.version_id} de ${clave} no se pudo leer.`);
  if (version.contenido_id !== uso.contenido_id) throw new Error(`La versión ${version.id} no es del contenido de ${clave}.`);
  if (version.estado !== "publicado") throw new Error(`La versión ${version.id} de ${clave} está ${version.estado}, no publicada.`);
  if (hashContenido({ cuerpo: version.cuerpo, asunto: version.asunto, esquema: version.esquema }) !== version.hash)
    throw new Error(`El texto de la versión ${version.id} de ${clave} no reproduce su hash.`);
  return { modo: "modulo", versionId: version.id, cuerpo: version.cuerpo, asunto: version.asunto, hash: version.hash };
}

export async function resolverContenido(sb: SupabaseClient, uso: string, variante: string, canal: string): Promise<Resolucion> {
  const clave = `${uso}/${variante}/${canal}`;
  const fila = exigirUno(
    await sb.from("contenido_usos").select("id, modo, contenido_id, version_id").eq("uso", uso).eq("variante", variante).eq("canal", canal).maybeSingle(),
    `la asignación de contenido ${clave}`
  ) as FilaUso | null;
  if (!fila || fila.modo === "legado" || fila.version_id === null) return decidirResolucion(clave, fila, null);
  const version = exigirUno(
    await sb.from("contenido_versiones").select("id, contenido_id, estado, cuerpo, asunto, esquema, hash").eq("id", fila.version_id).maybeSingle(),
    `la versión ${fila.version_id} de ${clave}`
  ) as FilaVersion | null;
  return decidirResolucion(clave, fila, version);
}
