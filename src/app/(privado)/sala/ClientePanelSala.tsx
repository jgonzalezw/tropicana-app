"use client";

/**
 * Disponibilidad de sala — pantalla operativa (2026-09-17).
 *
 * Muestra TODAS las salas activas a la vez, mirando la misma fecha: Javier
 * pidió explícitamente no tener que elegir una sala por vez para algo que se
 * mira todos los días — "ver las actividades y disponibilidad de las salas...
 * es totalmente cotidiano". El selector de fecha vive acá, una sola vez;
 * cada sala es una tarjeta independiente (`ClienteDisponibilidadSala`).
 */

import { useEffect, useState, useTransition } from "react";
import ClienteDisponibilidadSala from "./ClienteDisponibilidadSala";
import AgendamientosExternos from "./AgendamientosExternos";
import { consultarAgendaDia } from "./acciones";
import { resumirAgenda, type FiltroAgenda, type SlotSala } from "@/lib/slotSala";
import PanelGestionar from "./PanelGestionar";

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base";

export default function ClientePanelSala({
  salas,
  motivos,
  motivosSuspension,
  opcionesDuracionMin,
  incrementoMin,
  minimoMin,
  puedeEditar,
}: {
  salas: { id: number; nombre: string }[];
  motivos: { valor: string; etiqueta: string }[];
  /** H4: para el panel de gestión de una reserva (`GestionReserva`). */
  motivosSuspension: { valor: string; etiqueta: string }[];
  opcionesDuracionMin: number[];
  incrementoMin: number;
  minimoMin: number;
  puedeEditar: boolean;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const [agenda, setAgenda] = useState<Awaited<ReturnType<typeof consultarAgendaDia>> | null>(null);
  const [cargando, startCarga] = useTransition();
  // Cuándo se leyó la agenda: "por cerrar" se mide contra ese momento.
  const [ahora, setAhora] = useState(() => new Date());
  const [filtro, setFiltro] = useState<FiltroAgenda>("todo");
  // El slot con el panel Gestionar abierto: uno solo para toda la pantalla.
  const [enfoque, setEnfoque] = useState<SlotSala | null>(null);
  const salaIds = salas.map((s) => s.id);
  const claveSalas = salaIds.join(",");

  // Una sola lectura para todas las tarjetas y la lista externa.
  function recargar() {
    startCarga(async () => {
      const a = await consultarAgendaDia(salaIds, fecha);
      setAgenda(a);
      setAhora(new Date());
    });
  }

  // Cambiar de fecha cierra el panel: el slot enfocado puede no estar en el día nuevo.
  const [fechaVista, setFechaVista] = useState(fecha);
  if (fecha !== fechaVista) {
    setFechaVista(fecha);
    setEnfoque(null);
  }

  function alternarEnfoque(sl: SlotSala) {
    setEnfoque((actual) => (actual?.clave === sl.clave ? null : sl));
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, claveSalas]);

  const todos = agenda
    ? [...Object.values(agenda.salas).flatMap((d) => d.slots), ...agenda.externos.reservas.map((r) => r.slot)]
    : [];
  const resumen = resumirAgenda(todos, ahora);

  if (salas.length === 0) {
    return (
      <p className="text-base text-[var(--texto-tenue)]">
        Todavía no hay ninguna sala activa cargada. Se carga en Administración → Sala y horarios.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-base font-medium">Fecha</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={control} />
      </div>

      {agenda && (
        <div className="flex items-center gap-3 flex-wrap" role="group" aria-label="Pendientes de la agenda">
          <BotonResumen
            activo={filtro === "solicitudes"}
            vacio={resumen.solicitudes === 0}
            onClick={() => setFiltro(filtro === "solicitudes" ? "todo" : "solicitudes")}
          >
            ⏳ {resumen.solicitudes} {resumen.solicitudes === 1 ? "solicitud por responder" : "solicitudes por responder"}
            {resumen.urgentes > 0 && ` (${resumen.urgentes} urgente${resumen.urgentes === 1 ? "" : "s"})`}
          </BotonResumen>
          <BotonResumen
            activo={filtro === "por_cerrar"}
            vacio={resumen.porCerrar === 0}
            onClick={() => setFiltro(filtro === "por_cerrar" ? "todo" : "por_cerrar")}
          >
            ✔ {resumen.porCerrar} {resumen.porCerrar === 1 ? "clase por cerrar" : "clases por cerrar"}
          </BotonResumen>
          {filtro !== "todo" && (
            <button onClick={() => setFiltro("todo")} className="text-sm text-[var(--primario)] hover:underline">
              Ver todo
            </button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {salas.map((s) => (
          <ClienteDisponibilidadSala
            key={s.id}
            salaId={s.id}
            salaNombre={s.nombre}
            fecha={fecha}
            datos={agenda?.salas[s.id] ?? null}
            cargando={cargando}
            onRecargar={recargar}
            motivos={motivos}
            opcionesDuracionMin={opcionesDuracionMin}
            puedeEditar={puedeEditar}
            ahora={ahora}
            filtro={filtro}
            enfocadoClave={enfoque?.clave ?? null}
            onGestionar={alternarEnfoque}
          />
        ))}
      </div>

      {/* Aparte de las salas propias, no una más en el selector (Javier,
          2026-09-27): una reserva en un lugar externo no tiene horario propio
          ni se bloquea. */}
      <AgendamientosExternos
        datos={agenda?.externos ?? null}
        cargando={cargando}
        ahora={ahora}
        filtro={filtro}
        enfocadoClave={enfoque?.clave ?? null}
        onGestionar={alternarEnfoque}
      />

      {enfoque && (
        <PanelGestionar
          key={enfoque.clave}
          slot={enfoque}
          salasPropias={salas}
          motivosSuspension={motivosSuspension}
          incrementoMin={incrementoMin}
          minimoMin={minimoMin}
          onCerrar={() => setEnfoque(null)}
          onCambio={() => {
            // El panel queda abierto con su propio resultado; la agenda se recarga detrás.
            recargar();
          }}
        />
      )}
    </div>
  );
}

function BotonResumen({
  activo,
  vacio,
  onClick,
  children,
}: {
  activo: boolean;
  vacio: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`px-4 py-2 text-base font-semibold rounded-full border ${
        activo
          ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)]"
          : vacio
            ? "border-[var(--borde)] text-[var(--texto-tenue)]"
            : "border-[var(--advertencia-texto)] bg-[var(--advertencia-fill)] text-[var(--advertencia-texto)]"
      }`}
    >
      {children}
    </button>
  );
}
