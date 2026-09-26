"use client";

import { normalizarWhatsapp, urlChatWhatsapp, urlAppWhatsapp } from "@/lib/contactos";
import { abrirWhatsapp } from "@/lib/whatsappCliente";
import IconoRed from "./IconoRed";

/**
 * Link "Abrir chat ↗" bajo un campo de WhatsApp, mientras se está cargando
 * o editando — aparece en cuanto el número tipeado ya es válido (formato
 * internacional). Pieza reutilizable (regla de proceso 4): la misma en la
 * ficha de alumno (adulto y tutor) y de profesor.
 */
export default function AbrirChatWhatsapp({ numero }: { numero: string }) {
  const numeroNormalizado = normalizarWhatsapp(numero);
  const url = urlChatWhatsapp(numeroNormalizado);
  const urlApp = urlAppWhatsapp(numeroNormalizado);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 inline-flex items-center gap-1 text-sm text-[var(--primario)] hover:underline"
      onClick={(e) => {
        e.preventDefault();
        abrirWhatsapp(urlApp, url);
      }}
    >
      <IconoRed red="whatsapp" nombre="WhatsApp" className="w-3.5 h-3.5" />
      Abrir chat ↗
    </a>
  );
}
