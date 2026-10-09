"use client";

import { createContext, useContext, useState } from "react";
import HojaFranjas from "./HojaFranjas";
import type { ReservaActual } from "@/lib/franjasReserva";
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
  /** «Reprogramar» de una fila: la misma hoja, con esa reserva como la actual (no depende de poder crear). */
  reprogramar: (reserva: ReservaActual) => void;
};

const NuevaReservaContexto = createContext<Contexto | null>(null);

export function useNuevaReserva(): Contexto | null {
  return useContext(NuevaReservaContexto);
}

export default function ProveedorNuevaReserva({ datos, children }: { datos: DatosReservas | null; children: React.ReactNode }) {
  const [abierta, setAbierta] = useState<{ fecha?: string; hora?: string; salaId?: number } | null>(null);
  const [reprogramando, setReprogramando] = useState<ReservaActual | null>(null);
  if (!datos) return <>{children}</>;

  const valor: Contexto = {
    motivo: datos.motivoSinAlta,
    abrir: (inicial) => setAbierta(inicial ?? {}),
    reprogramar: (reserva) => setReprogramando(reserva),
  };
  return (
    <NuevaReservaContexto.Provider value={valor}>
      {children}
      {abierta && datos.motivoSinAlta === null && (
        <HojaFranjas datos={datos} inicial={abierta} onCerrar={() => setAbierta(null)} />
      )}
      {reprogramando && datos.puedeEditar && (
        <HojaFranjas key={reprogramando.id} datos={datos} reprogramar={reprogramando} onCerrar={() => setReprogramando(null)} />
      )}
    </NuevaReservaContexto.Provider>
  );
}
