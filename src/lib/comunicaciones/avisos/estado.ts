/**
 * R20 · E4b — lo que se deduce de un aviso y sus acciones (puro, sin base de datos).
 *
 *  - La clave idempotente: un aviso por evento exacto + destinatario + canal.
 *  - El estado visible: Preparado → Abierto / Copiado → Declarado. Abrir WhatsApp
 *    NUNCA se muestra como enviado. La declaración es del operador y no se borra:
 *    se rectifica con otra entrada, y el estado vuelve a la última acción operativa.
 */

export type TipoAccionAviso =
  | "abierto_whatsapp"
  | "copiado"
  | "reintento"
  | "respaldo_autorizado"
  | "respaldo_usado"
  | "declarado_enviado"
  | "declaracion_rectificada";

export type AccionAviso = {
  id: number;
  tipo: TipoAccionAviso;
  actor: string | null;
  actorId: string | null;
  creadoEn: string;
  motivo: string | null;
  rectificaId: number | null;
};

/** `<fuente_evento>:<id_evento>:<caso>:<variante>:<contacto_id>:<canal>` — igual que la arma la base. */
export function claveAviso(e: {
  fuenteEvento: string;
  idEvento: string | number;
  caso: string;
  variante: string;
  contactoId: number;
  canal: string;
}): string {
  return `${e.fuenteEvento}:${e.idEvento}:${e.caso}:${e.variante}:${e.contactoId}:${e.canal}`;
}

export type EstadoVisible = "preparado" | "abierto" | "copiado" | "declarado";

/** La declaración de envío vigente: la última `declarado_enviado` que nadie rectificó. */
export function declaracionVigente(acciones: AccionAviso[]): AccionAviso | null {
  const rectificadas = new Set(acciones.filter((a) => a.tipo === "declaracion_rectificada").map((a) => a.rectificaId));
  const vigentes = acciones.filter((a) => a.tipo === "declarado_enviado" && !rectificadas.has(a.id));
  return vigentes.length ? vigentes[vigentes.length - 1] : null;
}

export function estadoVisible(acciones: AccionAviso[]): EstadoVisible {
  if (declaracionVigente(acciones)) return "declarado";
  for (let i = acciones.length - 1; i >= 0; i--) {
    const t = acciones[i].tipo;
    if (t === "abierto_whatsapp") return "abierto";
    if (t === "copiado") return "copiado";
  }
  return "preparado";
}

export const ETIQUETA_ESTADO_VISIBLE: Record<EstadoVisible, string> = {
  preparado: "Preparado",
  abierto: "Abierto en WhatsApp",
  copiado: "Copiado",
  declarado: "Declarado enviado",
};

export const ETIQUETA_ACCION: Record<TipoAccionAviso, string> = {
  abierto_whatsapp: "Abierto en WhatsApp",
  copiado: "Copiado",
  reintento: "Reintento",
  respaldo_autorizado: "Respaldo autorizado",
  respaldo_usado: "Respaldo usado (texto anterior)",
  declarado_enviado: "Declarado enviado por el operador",
  declaracion_rectificada: "Declaración rectificada: no se envió",
};
