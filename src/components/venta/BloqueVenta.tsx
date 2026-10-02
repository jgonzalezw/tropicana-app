"use client";

import type { ReactNode } from "react";

/**
 * Un paso de una venta: número, título y, según dónde esté la persona, tres
 * caras —bloqueado (dice qué falta antes), activo (el contenido) o completo
 * (un resumen con "Cambiar", que reinicia lo que viene después). Es el mismo
 * esqueleto en inscripción, prueba, particular y alquiler.
 */
export type EstadoBloque = "bloqueado" | "activo" | "completo";

export default function BloqueVenta({
  numero,
  titulo,
  estado,
  bloqueo,
  resumen,
  onCambiar,
  children,
}: {
  numero: number;
  titulo: string;
  estado: EstadoBloque;
  /** Qué falta antes de poder abrir este paso (solo se ve si está bloqueado). */
  bloqueo?: string;
  /** Lo elegido, en una línea o tarjeta (solo se ve si está completo). */
  resumen?: ReactNode;
  onCambiar?: () => void;
  children?: ReactNode;
}) {
  const marca =
    estado === "completo"
      ? "bg-[var(--primario)] text-[var(--primario-texto)]"
      : estado === "activo"
        ? "border border-[var(--primario)] text-[var(--primario)]"
        : "border border-[var(--borde)] text-[var(--texto-tenue)]";

  return (
    <section
      className={`rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-3 sm:p-5 ${
        estado === "bloqueado" ? "opacity-60" : ""
      }`}
      aria-label={`${numero}. ${titulo}`}
    >
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold shrink-0 ${marca}`}>
          {estado === "completo" ? "✓" : numero}
        </span>
        <h2 className="titulo text-xl flex-1">{titulo}</h2>
        {estado === "completo" && onCambiar && (
          <button type="button" onClick={onCambiar} className="text-[var(--primario)] text-base shrink-0">
            Cambiar
          </button>
        )}
      </div>
      {estado === "bloqueado" && bloqueo && <p className="text-sm text-[var(--texto-tenue)] mt-2 ml-10">{bloqueo}</p>}
      {estado === "completo" && resumen && <div className="mt-3 ml-0 sm:ml-10">{resumen}</div>}
      {estado === "activo" && <div className="mt-4">{children}</div>}
    </section>
  );
}
