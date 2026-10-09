"use client";

/**
 * "Reservas de la membresía" (C3, hito H3; neutro por tipo desde el Hito B).
 *
 * Lo montan `/particulares/[id]` y `/alquileres/[id]`: el saldo, el lugar
 * externo, las reservas y "+ Nueva reserva" son los mismos; solo cambian los
 * rótulos (`detalle.tipo`). Cuando llegue el calendario de C4, abrir un slot
 * vacío para vender o reservar reusa `crearReserva` (que ya recibe membresía,
 * fecha, hora y sala y sirve a cualquier tipo), y gestionar uno ocupado reusa
 * `GestionReserva`.
 *
 * "+ Nueva reserva" y el lugar externo viven en `NuevaReserva` y
 * `LugarExterno` (`src/components/`), las mismas piezas que monta la ficha
 * `/membresias/[id]` (fase 2 de I-012): esta pantalla las compone sin cambio
 * de comportamiento.
 *
 * El bloque por-reserva (estado, transiciones, formularios de suspender y
 * reprogramar, avisos, historial) vive en `GestionReserva`
 * (`src/components/GestionReserva.tsx`, regla de proceso 4): esta pantalla lo
 * monta una vez por reserva, sin cambio de comportamiento respecto de antes
 * (H4, 2026-09-26) — la misma pieza se reutiliza como panel enfocado en
 * `/sala`.
 */

import { useRouter } from "next/navigation";
import { formatearHoras } from "@/lib/horarios";
import GestionReserva from "@/components/GestionReserva";
import LugarExterno from "@/components/LugarExterno";
import NuevaReserva from "@/components/NuevaReserva";
import type { MembresiaParticularDetalle } from "@/app/(privado)/particulares/acciones";

export default function ReservasDeMembresia({
  detalle,
  salas,
  tieneExterna,
  motivosSuspension,
  incrementoMin,
  minimoMin,
  puedeCrear,
  puedeEditar,
}: {
  detalle: MembresiaParticularDetalle;
  salas: { id: number; nombre: string; activa: boolean }[];
  tieneExterna: boolean;
  motivosSuspension: { valor: string; etiqueta: string }[];
  incrementoMin: number;
  minimoMin: number;
  puedeCrear: boolean;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const disponibleMin = detalle.saldo.disponibleMin;
  const externaDeLaMembresia = detalle.salasDeLaMembresia.find((s) => s.esExterna);

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radio-panel)] border border-[var(--borde)] p-4">
        <h2 className="font-medium mb-3">{detalle.tipo === "alquiler" ? "Saldo del alquiler" : "Saldo del paquete"}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
          <div>
            <div className="text-[var(--texto-tenue)]">Contratadas</div>
            <div className="text-2xl tabular-nums font-semibold">{formatearHoras(detalle.saldo.contratadasMin / 60)} h</div>
          </div>
          <div>
            <div className="text-[var(--texto-tenue)]">Disponible para pedir</div>
            <div className="text-2xl tabular-nums font-semibold">{formatearHoras(disponibleMin / 60)} h</div>
          </div>
          <div>
            <div className="text-[var(--texto-tenue)]">Solicitadas vigentes</div>
            <div className="text-2xl tabular-nums">{formatearHoras(detalle.saldo.solicitadasVigentesMin / 60)} h</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm pt-3 border-t border-[var(--borde)]">
          <div>
            <div className="text-[var(--texto-tenue)]">Reservadas</div>
            <div className="text-lg tabular-nums">{formatearHoras(detalle.saldo.reservadasMin / 60)} h</div>
          </div>
          <div>
            <div className="text-[var(--texto-tenue)]">Realizadas</div>
            <div className="text-lg tabular-nums">{formatearHoras(detalle.saldo.realizadasMin / 60)} h</div>
          </div>
          <div>
            <div className="text-[var(--texto-tenue)]">Consumidas</div>
            <div className="text-lg tabular-nums">{formatearHoras(detalle.saldo.consumidasMin / 60)} h</div>
          </div>
        </div>
      </section>

      {detalle.permiteSalaExterna && (
        <section className="rounded-[var(--radio-panel)] border border-[var(--borde)] p-4">
          <h2 className="font-medium mb-2">Lugar externo</h2>
          <LugarExterno membresiaId={detalle.id} nombre={externaDeLaMembresia?.nombre ?? null} puedeEditar={puedeEditar} />
        </section>
      )}

      <section className="rounded-[var(--radio-panel)] border border-[var(--borde)] divide-y divide-[var(--borde)]">
        <h2 className="font-medium p-4 pb-0">Reservas</h2>
        {detalle.reservas.length === 0 && <p className="p-4 text-[var(--texto-tenue)]">Todavía no hay ninguna reserva.</p>}
        {detalle.reservas.map((r) => (
          <div key={r.id} className="p-4">
            <GestionReserva
              reserva={r}
              membresiaId={detalle.id}
              tipo={detalle.tipo}
              disponibleMin={disponibleMin}
              fechaInicioMembresia={detalle.fechaInicio}
              fechaFinMembresia={detalle.fechaFin}
              salasPropias={salas}
              salaExternaDeLaMembresia={externaDeLaMembresia ? { salaId: externaDeLaMembresia.salaId, nombre: externaDeLaMembresia.nombre } : null}
              motivosSuspension={motivosSuspension}
              incrementoMin={incrementoMin}
              minimoMin={minimoMin}
              puedeEditar={puedeEditar}
              onCambio={() => router.refresh()}
            />
          </div>
        ))}
      </section>

      {puedeCrear && (
        <NuevaReserva
          membresiaId={detalle.id}
          tipo={detalle.tipo}
          fechaInicio={detalle.fechaInicio}
          fechaFin={detalle.fechaFin}
          contratadasMin={detalle.saldo.contratadasMin}
          disponibleMin={disponibleMin}
          salas={salas}
          tieneExterna={tieneExterna}
          nombreExterna={externaDeLaMembresia?.nombre ?? null}
          incrementoMin={incrementoMin}
          minimoMin={minimoMin}
        />
      )}
    </div>
  );
}
