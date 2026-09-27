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

import { useEffect, useState, useTransition } from "react";
import GestionReserva from "@/components/GestionReserva";
import { obtenerReservaParaGestion, type DetalleGestionReserva } from "@/app/(privado)/particulares/acciones";
import { consultarAgendamientosExternos, type AgendamientoExterno } from "./acciones";

const ETIQUETA_TIPO: Record<AgendamientoExterno["tipo"], string> = {
  particular: "Particular",
  alquiler: "Alquiler",
};

function finDe(hora: string, duracionMin: number): string {
  const finMin = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5)) + duracionMin;
  return `${String(Math.floor(finMin / 60) % 24).padStart(2, "0")}:${String(finMin % 60).padStart(2, "0")}`;
}

export default function AgendamientosExternos({
  fecha,
  salasPropias,
  motivosSuspension,
  incrementoMin,
  minimoMin,
}: {
  fecha: string;
  /** Para `GestionReserva`, si se reprograma a una sala propia. */
  salasPropias: { id: number; nombre: string }[];
  motivosSuspension: { valor: string; etiqueta: string }[];
  incrementoMin: number;
  minimoMin: number;
}) {
  const [reservas, setReservas] = useState<AgendamientoExterno[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, startCarga] = useTransition();

  const [enfoqueId, setEnfoqueId] = useState<number | null>(null);
  const [detalleGestion, setDetalleGestion] = useState<DetalleGestionReserva | { error: string } | null>(null);
  const [pendienteGestion, startGestion] = useTransition();

  function recargar() {
    startCarga(async () => {
      const r = await consultarAgendamientosExternos(fecha);
      setReservas(r.reservas);
      setError(r.error);
    });
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  // Cambiar de fecha cierra el panel de gestión: la reserva enfocada puede ya
  // no estar en la lista nueva (mismo patrón que `ClienteDisponibilidadSala`).
  const [fechaAnterior, setFechaAnterior] = useState(fecha);
  if (fecha !== fechaAnterior) {
    setFechaAnterior(fecha);
    setEnfoqueId(null);
    setDetalleGestion(null);
  }

  function abrirGestion(reservaId: number) {
    setEnfoqueId(reservaId);
    setDetalleGestion(null);
    startGestion(async () => {
      const r = await obtenerReservaParaGestion(reservaId);
      setDetalleGestion(r);
    });
  }

  function cerrarGestion() {
    setEnfoqueId(null);
    setDetalleGestion(null);
  }

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
                <div className="flex items-start gap-3 py-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full shrink-0 bg-[color-mix(in_srgb,var(--exito)_16%,transparent)] text-[var(--exito)]">
                    {ETIQUETA_TIPO[r.tipo]}
                  </span>
                  <div className="flex-1">
                    <div className="text-base">
                      <strong>
                        {r.hora.slice(0, 5)}–{finDe(r.hora, r.duracionMin)}
                      </strong>{" "}
                      {r.alumnoNombre ?? "Clase particular"}
                      {r.profesorNombre ? ` · ${r.profesorNombre}` : ""}
                    </div>
                    <div className="text-sm text-[var(--texto-tenue)]">📍 {r.lugar}</div>
                  </div>
                  {r.gestionable && (
                    <button
                      onClick={() => (enfoqueId === r.id ? cerrarGestion() : abrirGestion(r.id))}
                      className="text-sm text-[var(--primario)] hover:underline shrink-0"
                    >
                      {enfoqueId === r.id ? "Cerrar" : "Gestionar"}
                    </button>
                  )}
                </div>
                {enfoqueId === r.id && (
                  <div className="mb-3 ml-1 pl-3 border-l-2 border-[var(--primario)]">
                    {pendienteGestion && !detalleGestion ? (
                      <p className="text-sm text-[var(--texto-tenue)]">Cargando…</p>
                    ) : detalleGestion && "error" in detalleGestion ? (
                      <p className="text-[var(--peligro)]" role="alert">
                        {detalleGestion.error}
                      </p>
                    ) : detalleGestion ? (
                      <GestionReserva
                        reserva={detalleGestion.reserva}
                        membresiaId={detalleGestion.membresiaId}
                        disponibleMin={detalleGestion.disponibleMin}
                        fechaInicioMembresia={detalleGestion.fechaInicioMembresia}
                        fechaFinMembresia={detalleGestion.fechaFinMembresia}
                        salasPropias={salasPropias}
                        salaExternaDeLaMembresia={(() => {
                          const ext = detalleGestion.salasDeLaMembresia.find((s) => s.esExterna);
                          return ext ? { salaId: ext.salaId, nombre: ext.nombre } : null;
                        })()}
                        motivosSuspension={motivosSuspension}
                        incrementoMin={incrementoMin}
                        minimoMin={minimoMin}
                        puedeEditar
                        mostrarLinkFicha
                        onCambio={() => {
                          cerrarGestion();
                          recargar();
                        }}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
