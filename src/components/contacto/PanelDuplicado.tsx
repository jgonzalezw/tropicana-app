"use client";

import { ETIQUETA_ROL_CONTACTO, tituloDuplicado, type ContactoResumen } from "@/lib/contactoVenta";

/**
 * "Ese WhatsApp / documento ya está cargado": ofrece usar el contacto que ya
 * existe —cualquiera sea su rol— en lugar de rechazar con un error. Un
 * documento repetido nunca ofrece "es otro contacto": la base no admite dos
 * contactos con el mismo documento.
 */
export default function PanelDuplicado({
  por,
  contacto,
  textoUsar = "Usar este contacto",
  onUsar,
  onOtro,
}: {
  por: "whatsapp" | "documento";
  contacto: ContactoResumen;
  textoUsar?: string;
  onUsar: () => void;
  /** Solo se ofrece cuando el choque fue por WhatsApp (puede ser un número compartido). */
  onOtro?: () => void;
}) {
  return (
    <div className="p-4 rounded-[var(--radio-panel)] border border-[var(--primario)] bg-[var(--accent-100)]">
      <div className="font-semibold text-[var(--peligro-texto)]">{tituloDuplicado(por)}</div>
      <div className="mt-1">
        {contacto.nombre}{" "}
        <span className="text-sm text-[var(--texto-tenue)]">· {ETIQUETA_ROL_CONTACTO[contacto.rol]}</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={onUsar}
          className="px-4 py-2 text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]"
        >
          {textoUsar}
        </button>
        {por === "whatsapp" && onOtro && (
          <button
            type="button"
            onClick={onOtro}
            className="px-4 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)]"
          >
            Es otro contacto
          </button>
        )}
      </div>
    </div>
  );
}
