"use server";

/**
 * R20 · E4a — acciones editoriales de contenidos. SIN USO desde la operación y
 * sin pantalla (E6): conectar es E5, y ejecutarlas sobre contenido oficial
 * requiere la aprobación explícita de Javier, versión por versión y asignación
 * por asignación.
 *
 * Solo el Administrador (D-E4a-1). La escritura va por las funciones de la 0071
 * con la SESIÓN de quien llama (no con service_role): las funciones verifican
 * `es_admin()` adentro, así que la base decide aunque esta acción falle.
 */
import { createClient } from "@/lib/supabase/server";
import { esAdministrador } from "@/lib/sesion";
import {
  validarAprobacion,
  validarLiberacion,
  validarPublicacion,
  validarRetiro,
  type EntradaLiberacion,
} from "./validacion";

type Resultado = { ok: true } | { error: string };

async function llamar(fn: string, args: Record<string, unknown>): Promise<Resultado> {
  if (!(await esAdministrador())) return { error: "Solo el Administrador puede hacer esto." };
  const sb = await createClient();
  const { error } = await sb.rpc(fn, args);
  return error ? { error: error.message } : { ok: true };
}

export async function enviarARevision(versionId: number): Promise<Resultado> {
  return llamar("cambiar_estado_version", { p_version_id: versionId, p_a_estado: "en_revision" });
}

export async function volverABorrador(versionId: number): Promise<Resultado> {
  return llamar("cambiar_estado_version", { p_version_id: versionId, p_a_estado: "borrador" });
}

/** Declara que el texto es correcto. No cambia nada visible. */
export async function aprobarVersion(versionId: number, hashVisto: string): Promise<Resultado> {
  const e = validarAprobacion({ versionId, hashVisto });
  if (e) return { error: e };
  return llamar("cambiar_estado_version", { p_version_id: versionId, p_a_estado: "aprobado", p_hash_visto: hashVisto });
}

/** Fija la versión como oficial e inmutable. NO activa ningún uso. */
export async function publicarVersion(versionId: number, hashVisto: string, etiqueta: string, urlOficial?: string): Promise<Resultado> {
  const e = validarPublicacion({ versionId, hashVisto, etiqueta });
  if (e) return { error: e };
  return llamar("cambiar_estado_version", {
    p_version_id: versionId,
    p_a_estado: "publicado",
    p_hash_visto: hashVisto,
    p_etiqueta: etiqueta,
    p_url_oficial: urlOficial ?? null,
  });
}

export async function retirarVersion(versionId: number, motivo: string): Promise<Resultado> {
  const e = validarRetiro({ versionId, motivo });
  if (e) return { error: e };
  return llamar("cambiar_estado_version", { p_version_id: versionId, p_a_estado: "retirado", p_motivo: motivo });
}

/** Asigna una versión publicada a UNA asignación (uso, variante, canal), o vuelve a legado. Con su historial. */
export async function liberarContenido(e: EntradaLiberacion): Promise<Resultado> {
  const error = validarLiberacion(e);
  if (error) return { error };
  return llamar("liberar_contenido", {
    p_uso: e.uso,
    p_variante: e.variante,
    p_canal: e.canal,
    p_version_id: e.versionId,
    p_modo: e.modo,
    p_motivo: e.motivo,
    p_hash_aprobado: e.hashAprobado,
    p_aprobacion_ref: e.aprobacionRef,
  });
}
