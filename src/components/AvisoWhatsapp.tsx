"use client";

/**
 * Una confirmación lista para mandar, con su botón de WhatsApp.
 *
 * **Mientras no exista el módulo de notificaciones multicanal, toda
 * confirmación a un alumno o un profesor tiene que poder salir con un clic**
 * (Javier, 25/09): un botón que abre WhatsApp con el mensaje ya escrito,
 * dirigido al número del contacto — no solo copiar y pegar a mano. Es la
 * misma pieza que ya usaba el aviso de excepciones de sala (C2); el resto de
 * las pantallas la va montar igual (regla de proceso 4 — una pieza por
 * entidad, no una por pantalla).
 *
 * Sin WhatsApp en formato internacional no desaparece el botón: se explica
 * por qué falta y dónde se corrige (regla de calidad 5).
 */

import { useState } from "react";
import { urlChatWhatsapp } from "@/lib/contactos";

const botonPrimario =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] font-medium hover:opacity-90";
const botonTenue =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]";

export default function AvisoWhatsapp({
  /** A quién va dirigido: "Natalia Salek" o "Natalia Salek (tutor de Juan)". */
  nombre,
  whatsapp,
  mensaje,
  className,
}: {
  nombre: string;
  whatsapp: string | null | undefined;
  mensaje: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const url = urlChatWhatsapp(whatsapp, mensaje);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // El portapapeles puede fallar sin HTTPS o sin permiso; el mensaje
      // sigue visible en la tarjeta para seleccionarlo a mano.
    }
  }

  return (
    <div
      className={`rounded-[var(--radio-panel)] border border-[var(--borde)] p-3 flex items-start gap-3 flex-wrap ${className ?? ""}`}
    >
      <div className="flex-1 min-w-[16rem]">
        <div className="font-medium">{nombre}</div>
        <p className="text-sm mt-1 whitespace-pre-wrap">{mensaje}</p>
        {!url && (
          <p className="text-xs text-[var(--texto-tenue)] mt-1">
            Sin WhatsApp en formato internacional (+591…): no se puede armar el link. Se corrige en la ficha del
            contacto.
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className={botonPrimario}>
            Enviar por WhatsApp
          </a>
        ) : (
          <span className={`${botonPrimario} opacity-40 pointer-events-none`} aria-disabled="true">
            Enviar por WhatsApp
          </span>
        )}
        <button onClick={copiar} className={botonTenue}>
          {copiado ? "Copiado ✓" : "Copiar mensaje"}
        </button>
      </div>
    </div>
  );
}
