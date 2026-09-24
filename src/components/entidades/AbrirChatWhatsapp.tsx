import { normalizarWhatsapp, urlChatWhatsapp } from "@/lib/contactos";
import IconoRed from "./IconoRed";

/**
 * Link "Abrir chat ↗" bajo un campo de WhatsApp, mientras se está cargando
 * o editando — aparece en cuanto el número tipeado ya es válido (formato
 * internacional). Pieza reutilizable (regla de proceso 4): la misma en la
 * ficha de alumno (adulto y tutor) y de profesor.
 */
export default function AbrirChatWhatsapp({ numero }: { numero: string }) {
  const url = urlChatWhatsapp(normalizarWhatsapp(numero));
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 inline-flex items-center gap-1 text-sm text-[var(--primario)] hover:underline"
    >
      <IconoRed red="whatsapp" nombre="WhatsApp" className="w-3.5 h-3.5" />
      Abrir chat ↗
    </a>
  );
}
