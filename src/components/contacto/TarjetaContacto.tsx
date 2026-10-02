"use client";

import EnlaceWhatsapp from "@/components/entidades/EnlaceWhatsapp";
import IconoRed from "@/components/entidades/IconoRed";
import { urlPerfilRed } from "@/lib/contactos";
import { ETIQUETA_ROL_CONTACTO } from "@/lib/contactoVenta";
import type { RedSocial } from "@/lib/tipos";
import type { DetalleContactoVenta } from "@/app/(privado)/contactos/accionesVenta";

/**
 * El titular elegido, en solo lectura: quién es, qué rol tiene hoy, cómo
 * contactarlo. De acá se pasa a editar sus datos o a cambiar de contacto —
 * el mismo gesto en todas las ventas. Si pidió no ser contactado, se dice y
 * el WhatsApp no se ofrece (regla de calidad 5: se explica, no desaparece).
 */
export default function TarjetaContacto({
  detalle,
  redesDisponibles,
  rolQueAdquiere = null,
  onCambiar,
  onEditar,
}: {
  detalle: DetalleContactoVenta;
  redesDisponibles: RedSocial[];
  /** Si la venta le va a agregar el rol alumno y todavía no lo tiene, se avisa. */
  rolQueAdquiere?: "alumno" | null;
  onCambiar: () => void;
  onEditar: () => void;
}) {
  const { resumen, redes, consentimiento, personaContacto } = detalle;
  const agregaRol = rolQueAdquiere === "alumno" && resumen.rol !== "alumno" && resumen.rol !== "alumno_profesor";

  return (
    <div className="p-4 rounded-[var(--radio-panel)] border border-[var(--borde)] space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-lg">{resumen.nombre}</div>
          <div className="text-sm text-[var(--texto-tenue)]">
            {resumen.tipo === "organizacion" ? "Organización" : "Persona"} · {ETIQUETA_ROL_CONTACTO[resumen.rol]}
          </div>
        </div>
        <div className="flex gap-2">
          {detalle.puedeEditar && (
            <button type="button" onClick={onEditar} className="px-3 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)]">
              Editar datos
            </button>
          )}
          <button type="button" onClick={onCambiar} className="px-3 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)]">
            Cambiar
          </button>
        </div>
      </div>

      <div className="text-base">
        <EnlaceWhatsapp numero={resumen.noContactar ? null : resumen.whatsapp} vacio={resumen.noContactar ? "no contactar" : "sin WhatsApp"} />
      </div>

      {redes.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          {redes.map((r) => {
            const url = urlPerfilRed(redesDisponibles.find((x) => x.clave === r.red)?.patron_url ?? null, r.red, r.usuario);
            const contenido = (
              <span className="inline-flex items-center gap-1">
                <IconoRed red={r.red} nombre={r.red} /> {r.usuario}
              </span>
            );
            return url ? (
              <a key={`${r.red}-${r.usuario}`} href={url} target="_blank" rel="noopener noreferrer" className="underline">
                {contenido}
              </a>
            ) : (
              <span key={`${r.red}-${r.usuario}`}>{contenido}</span>
            );
          })}
        </div>
      )}

      {personaContacto && (
        <div className="text-sm">
          Atiende: {personaContacto.nombre}
          {personaContacto.whatsapp && (
            <>
              {" · "}
              <EnlaceWhatsapp numero={personaContacto.noContactar ? null : personaContacto.whatsapp} vacio="sin WhatsApp" />
            </>
          )}
        </div>
      )}

      <div className="text-sm text-[var(--texto-tenue)]">
        {consentimiento?.otorgado ? "Consentimiento de contacto otorgado." : "Sin consentimiento de contacto registrado."}
      </div>

      {resumen.noContactar && (
        <p className="p-3 rounded-[var(--radio-control)] bg-[var(--accent-100)] text-sm" role="note">
          Pidió no ser contactado: la venta se registra, pero no se le manda ningún aviso.
        </p>
      )}
      {agregaRol && (
        <p className="p-3 rounded-[var(--radio-control)] bg-[var(--accent-100)] text-sm" role="note">
          Hoy es {ETIQUETA_ROL_CONTACTO[resumen.rol].toLowerCase()}: al vender se le agrega el rol de alumno, con los mismos datos.
        </p>
      )}
    </div>
  );
}
