"use client";

import AvisoWhatsapp from "@/components/AvisoWhatsapp";
import AvisoRegistrado from "@/components/AvisoRegistrado";
import type { RegistroAviso } from "@/lib/comunicaciones/avisos/tipos";

/**
 * El aviso de una acción de reserva. Si salió del módulo de comunicaciones
 * (`registro`), es `AvisoRegistrado` (S05); si no, `AvisoWhatsapp` exactamente
 * como siempre. Una sola decisión para todas las pantallas que lo muestran.
 */
export type AvisoDeReservaDatos = { nombre: string; whatsapp: string | null; mensaje: string; registro?: RegistroAviso };

export default function AvisoDeReserva({ aviso, className }: { aviso: AvisoDeReservaDatos; className?: string }) {
  if (aviso.registro) return <AvisoRegistrado aviso={{ ...aviso, registro: aviso.registro }} />;
  return <AvisoWhatsapp nombre={aviso.nombre} whatsapp={aviso.whatsapp} mensaje={aviso.mensaje} className={className} />;
}
