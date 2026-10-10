/**
 * R20 · E4a — validación única de las acciones editoriales (calidad 9): la
 * usan la acción del servidor y, cuando exista, la pantalla para deshabilitar
 * el botón. La base valida igual (las funciones y los triggers de la 0071).
 */
const HASH = /^[0-9a-f]{64}$/;
const lleno = (s: string | null | undefined) => (s ?? "").trim() !== "";

export type EntradaCambioEstado = { versionId: number; hashVisto?: string; etiqueta?: string; motivo?: string };

export function validarAprobacion(e: EntradaCambioEstado): string | null {
  if (!Number.isInteger(e.versionId) || e.versionId <= 0) return "Falta la versión.";
  if (!HASH.test(e.hashVisto ?? "")) return "Falta el hash de la versión que se revisó.";
  return null;
}

export function validarPublicacion(e: EntradaCambioEstado): string | null {
  return validarAprobacion(e) ?? (lleno(e.etiqueta) ? null : "Publicar exige una etiqueta.");
}

export function validarRetiro(e: EntradaCambioEstado): string | null {
  if (!Number.isInteger(e.versionId) || e.versionId <= 0) return "Falta la versión.";
  return lleno(e.motivo) ? null : "Retirar exige un motivo.";
}

export type EntradaLiberacion = {
  uso: string;
  variante: string;
  canal: string;
  versionId: number | null;
  modo: "legado" | "modulo";
  motivo: string;
  hashAprobado: string | null;
  aprobacionRef: string;
};

/**
 * Liberar es siempre explícito: una asignación, una versión, un motivo y la
 * referencia de la aprobación de Javier. Nunca en bloque ni automático.
 */
export function validarLiberacion(e: EntradaLiberacion): string | null {
  if (!lleno(e.uso) || !lleno(e.variante) || !lleno(e.canal)) return "Falta la asignación (uso, variante y canal).";
  if (e.modo !== "legado" && e.modo !== "modulo") return "Modo desconocido.";
  if (!lleno(e.motivo)) return "Falta el motivo.";
  if (!lleno(e.aprobacionRef)) return "Falta la referencia de la aprobación.";
  if (e.versionId === null) return e.modo === "modulo" ? "El modo módulo exige una versión." : null;
  if (!Number.isInteger(e.versionId) || e.versionId <= 0) return "Versión inválida.";
  if (!HASH.test(e.hashAprobado ?? "")) return "Falta el hash aprobado de la versión.";
  return null;
}
