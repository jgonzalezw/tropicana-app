"use client";

import { createContext, useContext, useState } from "react";
import NuevaReserva from "@/components/NuevaReserva";
import type { DatosReservas } from "./PestanasFicha";

/**
 * Quién puede abrir «Nueva reserva» en la ficha (el botón de la pestaña
 * Reservas y el menú ⋯) y la hoja lateral donde se completa: un solo estado
 * compartido, para que las dos entradas abran la misma hoja. `null` fuera de
 * una membresía por horas (no tiene reservas).
 */
type Contexto = {
  /** `null` si se puede; si no, el motivo para mostrar (calidad 5). */
  motivo: string | null;
  abrir: (inicial?: { fecha?: string; hora?: string; salaId?: number }) => void;
};

const NuevaReservaContexto = createContext<Contexto | null>(null);

export function useNuevaReserva(): Contexto | null {
  return useContext(NuevaReservaContexto);
}

export default function ProveedorNuevaReserva({ datos, children }: { datos: DatosReservas | null; children: React.ReactNode }) {
  const [abierta, setAbierta] = useState<{ fecha?: string; hora?: string; salaId?: number } | null>(null);
  if (!datos) return <>{children}</>;

  const valor: Contexto = { motivo: datos.motivoSinAlta, abrir: (inicial) => setAbierta(inicial ?? {}) };
  return (
    <NuevaReservaContexto.Provider value={valor}>
      {children}
      {abierta && datos.motivoSinAlta === null && (
        <NuevaReserva
          marco="hoja"
          membresiaId={datos.membresiaId}
          tipo={datos.tipo}
          fechaInicio={datos.fechaInicio}
          fechaFin={datos.fechaFin}
          contratadasMin={datos.contratadasMin}
          disponibleMin={datos.disponibleMin}
          salas={datos.salasPropias}
          tieneExterna={datos.ofrecerExterna}
          nombreExterna={datos.salaExterna?.nombre ?? null}
          incrementoMin={datos.incrementoMin}
          minimoMin={datos.minimoMin}
          inicial={abierta}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </NuevaReservaContexto.Provider>
  );
}
