import type { Perfil } from "@/lib/tipos";

/**
 * Estado de acceso computado de una cuenta, con PRECEDENCIA fija para que
 * nunca se muestren combinaciones contradictorias entre `activo` (baja de
 * la persona) y `bloqueado` (bloqueo de acceso).
 *
 * Regla única de acceso:  puede iniciar sesión ⇔ activo && !bloqueado.
 * Precedencia de etiqueta: Inactiva → Bloqueada → Activa.
 */
export type ClaveAcceso =
  | "inactiva"
  | "bloqueada_manual"
  | "bloqueada_auto"
  | "activa";

export type EstadoAcceso = {
  clave: ClaveAcceso;
  etiqueta: string;
  /** ¿Puede iniciar sesión con estas condiciones? */
  puede: boolean;
  /** Tono para el chip: éxito | peligro | neutral. */
  tono: "exito" | "peligro" | "neutral";
};

type CamposAcceso = Pick<
  Perfil,
  "activo" | "bloqueado" | "motivo_bloqueo"
>;

export function estadoAcceso(p: CamposAcceso): EstadoAcceso {
  if (!p.activo) {
    return { clave: "inactiva", etiqueta: "Inactiva", puede: false, tono: "neutral" };
  }
  if (p.bloqueado) {
    return p.motivo_bloqueo === "manual"
      ? { clave: "bloqueada_manual", etiqueta: "Bloqueada", puede: false, tono: "peligro" }
      : { clave: "bloqueada_auto", etiqueta: "Bloqueada (intentos)", puede: false, tono: "peligro" };
  }
  return { clave: "activa", etiqueta: "Activa", puede: true, tono: "exito" };
}

/** ¿La cuenta puede iniciar sesión? (regla única, reutilizable en servidor). */
export function puedeIniciarSesion(p: CamposAcceso): boolean {
  return p.activo && !p.bloqueado;
}
