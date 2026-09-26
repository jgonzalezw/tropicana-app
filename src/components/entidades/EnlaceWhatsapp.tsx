"use client";

import { urlChatWhatsapp, urlAppWhatsapp } from "@/lib/contactos";
import { abrirWhatsapp } from "@/lib/whatsappCliente";
import IconoRed from "./IconoRed";

/**
 * Muestra un número de WhatsApp; si está en formato internacional, es un
 * link que abre el chat en `wa.me` en una pestaña nueva. Si no se puede
 * armar el link (número crudo, sin formato — control 23), muestra el mismo
 * texto de siempre, sin link — nunca esconde el dato (regla de calidad 5).
 */
export default function EnlaceWhatsapp({
  numero,
  texto,
  vacio = "sin WhatsApp",
  conIcono = true,
  className,
}: {
  numero: string | null | undefined;
  /** Mensaje pre-escrito del chat (p. ej. el aviso de una clase suspendida). */
  texto?: string;
  vacio?: string;
  conIcono?: boolean;
  className?: string;
}) {
  if (!numero) return <span className={className}>{vacio}</span>;
  const url = urlChatWhatsapp(numero, texto);
  const urlApp = urlAppWhatsapp(numero, texto);
  const contenido = (
    <span className="inline-flex items-center gap-1">
      {conIcono && <IconoRed red="whatsapp" nombre="WhatsApp" />}
      {numero}
    </span>
  );
  if (!url) return <span className={className}>{contenido}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`hover:text-[var(--primario)] hover:underline ${className ?? ""}`}
      title="Abrir chat de WhatsApp"
      onClick={(e) => {
        e.preventDefault();
        abrirWhatsapp(urlApp, url);
      }}
    >
      {contenido}
    </a>
  );
}
