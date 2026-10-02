"use client";

/**
 * "Agendamientos externos de hoy" — sección aparte, debajo de las salas
 * propias (Javier, 2026-09-27, al aprobar el PR de sala externa por plan):
 * una reserva particular o de alquiler en un lugar externo (el salón de una
 * boda, por ejemplo) ocupaba al profesor ese día sin aparecer en ningún
 * lado de `/sala` — la pantalla solo armaba una tarjeta por sala PROPIA.
 *
 * No es una sala más en el selector: no tiene horario propio que abrir/cerrar
 * ni se puede bloquear (la sala externa genérica no se valida, regla de
 * negocio 23) — es una lista plana de lo que ocupa a alguien fuera de
 * Tropicana ese día, con el mismo panel de gestión que ya usa cada tarjeta
 * de sala propia.
 */

import { type AgendamientoExterno } from "./acciones";
import { filtrarSlots, type FiltroAgenda, type SlotSala } from "@/lib/slotSala";
import SlotFila from "./SlotFila";

export default function AgendamientosExternos({
  datos,
  cargando,
  ahora,
  filtro,
  enfocadoClave,
  onGestionar,
}: {
  /** Lo carga `ClientePanelSala` junto con las salas; `null` = primera lectura pendiente. */
  datos: { reservas: AgendamientoExterno[]; error: string | null } | null;
  cargando: boolean;
  ahora: Date;
  filtro: FiltroAgenda;
  enfocadoClave: string | null;
  onGestionar: (slot: SlotSala) => void;
}) {
  const reservas = (datos?.reservas ?? []).filter((r) => filtrarSlots([r.slot], filtro, ahora).length > 0);
  const error = datos?.error ?? null;

  return (
    <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6">
      <h2 className="text-xl font-semibold">Agendamientos externos de hoy</h2>
      <p className="text-sm text-[var(--texto-tenue)] mt-1">
        Particulares y alquileres en un lugar fuera de Tropicana. No tienen horario propio ni se bloquean: la
        sala externa no se valida.
      </p>

      <div className="mt-3">
        {error ? (
          <p className="text-base text-[var(--peligro)]">{error}</p>
        ) : cargando && reservas.length === 0 ? (
          <p className="text-base text-[var(--texto-tenue)]">Cargando…</p>
        ) : reservas.length === 0 ? (
          <p className="text-base text-[var(--texto-tenue)]">Sin agendamientos externos este día.</p>
        ) : (
          <div className="space-y-2">
            {reservas.map((r) => (
              <div key={r.id} className="border-t border-[var(--borde)] first:border-t-0">
                <SlotFila
                  slot={r.slot}
                  ahora={ahora}
                  abierto={enfocadoClave === r.slot.clave}
                  onGestionar={() => onGestionar(r.slot)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
