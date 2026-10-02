"use client";

import AvisoWhatsapp from "@/components/AvisoWhatsapp";
import type { AvisoAlumno } from "@/lib/avisosClase";

/**
 * Los avisos de WhatsApp de una clase que cambió (suspendida o restablecida):
 * uno por persona, con un clic para abrir el chat y "Copiar" de respaldo
 * (regla de proceso 12). La misma pieza en Tomar asistencia y en la vista de
 * gestión de /sala.
 */
export default function AvisosAfectados({
  avisos,
  titulo = "Avisos para las personas afectadas",
  onCerrar,
}: {
  avisos: AvisoAlumno[];
  titulo?: string;
  onCerrar?: () => void;
}) {
  if (!avisos.length) return null;
  return (
    <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {onCerrar && (
          <button onClick={onCerrar} className="text-sm text-[var(--texto-tenue)] shrink-0">
            Cerrar
          </button>
        )}
      </div>
      <div className="space-y-2">
        {avisos.map((a) => (
          <AvisoWhatsapp key={a.id} nombre={a.nombre} whatsapp={a.whatsapp} mensaje={a.mensaje} />
        ))}
      </div>
    </div>
  );
}
