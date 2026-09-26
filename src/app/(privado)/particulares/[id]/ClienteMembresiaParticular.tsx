"use client";

/**
 * "Reservas de la membresía" (C3, hito H3).
 *
 * El bloque por-reserva (estado, transiciones, formularios de suspender y
 * reprogramar, avisos, historial) vive en `GestionReserva`
 * (`src/components/GestionReserva.tsx`, regla de proceso 4): esta pantalla lo
 * monta una vez por reserva, sin cambio de comportamiento respecto de antes
 * (H4, 2026-09-26) — la misma pieza se reutiliza como panel enfocado en
 * `/sala`.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatearHoras, opcionesDuracionReserva } from "@/lib/horarios";
import { validarTiempoReserva } from "@/lib/reservas";
import AvisoWhatsapp from "@/components/AvisoWhatsapp";
import GestionReserva from "@/components/GestionReserva";
import { crearReserva, type MembresiaParticularDetalle } from "../acciones";

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base w-full";
const botonPrimario =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] font-medium hover:opacity-90 disabled:opacity-40";
const botonTenue =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40";
const etiqueta = "text-sm text-[var(--texto-tenue)] block mb-1";

type Aviso = { nombre: string; whatsapp: string | null; mensaje: string };
type ResultadoNueva = { error?: string; mensaje?: string; avisoAlumno?: Aviso; avisoProfesor?: Aviso };

function PanelResultado({ r }: { r: ResultadoNueva }) {
  return (
    <div className="mt-3 space-y-2">
      {r.error && (
        <p className="text-[var(--peligro)]" role="alert">
          {r.error}
        </p>
      )}
      {r.mensaje && <p className="text-[var(--exito)]">{r.mensaje}</p>}
      {r.avisoAlumno && <AvisoWhatsapp nombre={r.avisoAlumno.nombre} whatsapp={r.avisoAlumno.whatsapp} mensaje={r.avisoAlumno.mensaje} />}
      {r.avisoProfesor && (
        <AvisoWhatsapp nombre={r.avisoProfesor.nombre} whatsapp={r.avisoProfesor.whatsapp} mensaje={r.avisoProfesor.mensaje} />
      )}
    </div>
  );
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ClienteMembresiaParticular({
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
  const [pendiente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<ResultadoNueva | null>(null);

  // Regla de tiempos de una reserva (26/09): duración en múltiplos del
  // mínimo; el intervalo estándar es para la hora de inicio.
  const todasLasDuraciones = useMemo(() => opcionesDuracionReserva(minimoMin), [minimoMin]);
  const disponibleMin = detalle.saldo.disponibleMin;
  const externaDeLaMembresia = detalle.salasDeLaMembresia.find((s) => s.esExterna);

  // ── Nueva reserva ────────────────────────────────────────────────────
  const duracionesNueva = todasLasDuraciones.filter((d) => d <= disponibleMin);
  const agotado = duracionesNueva.length === 0;
  const fechaInicial = [hoyISO(), detalle.fechaInicio].sort()[1] > detalle.fechaFin ? detalle.fechaFin : [hoyISO(), detalle.fechaInicio].sort()[1];
  const [nFecha, setNFecha] = useState(fechaInicial);
  const [nHora, setNHora] = useState("18:00");
  const [nDuracionElegida, setNDuracion] = useState(duracionesNueva[0] ?? minimoMin);
  // Si el saldo cambió después de una acción, la duración elegida puede ya
  // no entrar: se usa la primera que sí entra, sin dejar un valor invisible.
  const nDuracion = duracionesNueva.includes(nDuracionElegida) ? nDuracionElegida : (duracionesNueva[0] ?? minimoMin);
  const [nSalaTipo, setNSalaTipo] = useState<"propia" | "externa">("propia");
  const [nSalaId, setNSalaId] = useState<number | null>(salas[0]?.id ?? null);
  const [nNombreExterna, setNNombreExterna] = useState(externaDeLaMembresia?.nombre ?? "");

  const faltaNueva: string | null = !nFecha
    ? "Elegí la fecha."
    : (validarTiempoReserva({ hora: nHora, duracionMin: nDuracion, incrementoMin, minimoMin }) ??
      (nSalaTipo === "externa" ? (nNombreExterna.trim() ? null : "Escribí el nombre del lugar externo.") : nSalaId == null ? "Elegí la sala." : null));

  function crear(accion: "solicitar" | "confirmar") {
    setResultado(null);
    startTransition(async () => {
      const r = await crearReserva({
        membresiaId: detalle.id,
        fecha: nFecha,
        hora: nHora,
        duracionMin: nDuracion,
        sala: nSalaTipo === "externa" ? { tipo: "externa", nombreDescriptivo: nNombreExterna } : { tipo: "propia", salaId: nSalaId! },
        accion,
      });
      setResultado(r);
      if (!r.error) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radio-panel)] border border-[var(--borde)] p-4">
        <h2 className="font-medium mb-3">Saldo del paquete</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-[var(--texto-tenue)]">Contratadas</div>
            <div className="text-lg tabular-nums">{formatearHoras(detalle.saldo.contratadasMin / 60)} h</div>
          </div>
          <div>
            <div className="text-[var(--texto-tenue)]">Consumidas</div>
            <div className="text-lg tabular-nums">{formatearHoras(detalle.saldo.consumidasMin / 60)} h</div>
          </div>
          <div>
            <div className="text-[var(--texto-tenue)]">Solicitadas vigentes</div>
            <div className="text-lg tabular-nums">{formatearHoras(detalle.saldo.solicitadasVigentesMin / 60)} h</div>
          </div>
          <div>
            <div className="text-[var(--texto-tenue)]">Disponible para pedir</div>
            <div className="text-lg tabular-nums font-semibold">{formatearHoras(disponibleMin / 60)} h</div>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radio-panel)] border border-[var(--borde)] divide-y divide-[var(--borde)]">
        <h2 className="font-medium p-4 pb-0">Reservas</h2>
        {detalle.reservas.length === 0 && <p className="p-4 text-[var(--texto-tenue)]">Todavía no hay ninguna reserva.</p>}
        {detalle.reservas.map((r) => (
          <div key={r.id} className="p-4">
            <GestionReserva
              reserva={r}
              membresiaId={detalle.id}
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
        // Distinta a propósito de las tarjetas de reserva (Javier, 26/09): es
        // un formulario para agregar, no una reserva más de la lista.
        <section className="rounded-[var(--radio-panel)] border-2 border-dashed border-[var(--primario)] bg-[var(--fondo-panel)] p-4">
          <h2 className="font-medium mb-3 text-[var(--primario)]">+ Nueva reserva</h2>
          {agotado ? (
            <p className="text-[var(--texto-tenue)]">
              No quedan horas para reservar: {disponibleMin > 0 ? `quedan ${formatearHoras(disponibleMin / 60)} h, menos que` : "se usó todo"}{" "}
              {disponibleMin > 0 ? `el mínimo de ${formatearHoras(minimoMin / 60)} h por reserva` : `el paquete de ${formatearHoras(detalle.saldo.contratadasMin / 60)} h`}
              . Una Suspendida o una cancelación a tiempo devuelven horas; sumar horas nuevas es la extensión de membresía (todavía no construida).
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className={etiqueta}>Fecha</label>
                  <input
                    type="date"
                    className={control}
                    value={nFecha}
                    min={detalle.fechaInicio}
                    max={detalle.fechaFin}
                    onChange={(e) => setNFecha(e.target.value)}
                  />
                </div>
                <div>
                  <label className={etiqueta}>Hora de inicio</label>
                  <input type="time" className={control} value={nHora} onChange={(e) => setNHora(e.target.value)} />
                </div>
                <div>
                  <label className={etiqueta}>Duración</label>
                  <select className={control} value={nDuracion} onChange={(e) => setNDuracion(Number(e.target.value))}>
                    {duracionesNueva.map((d) => (
                      <option key={d} value={d}>
                        {formatearHoras(d / 60)} h
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={etiqueta}>Dónde</label>
                  <select className={control} value={nSalaTipo} onChange={(e) => setNSalaTipo(e.target.value as "propia" | "externa")}>
                    <option value="propia">Sala propia</option>
                    {tieneExterna && <option value="externa">Lugar externo</option>}
                  </select>
                </div>
                {nSalaTipo === "propia" ? (
                  <div>
                    <label className={etiqueta}>Sala</label>
                    <select className={control} value={nSalaId ?? ""} onChange={(e) => setNSalaId(Number(e.target.value))}>
                      {salas.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="col-span-2">
                    <label className={etiqueta}>Nombre del lugar</label>
                    <input
                      className={control}
                      placeholder="Salón X — Hotel Y"
                      value={nNombreExterna}
                      onChange={(e) => setNNombreExterna(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-2 flex-wrap items-center">
                <button className={botonPrimario} disabled={pendiente || !!faltaNueva} onClick={() => crear("confirmar")}>
                  Confirmar directo
                </button>
                <button className={botonTenue} disabled={pendiente || !!faltaNueva} onClick={() => crear("solicitar")}>
                  Solicitar
                </button>
                {faltaNueva && <span className="text-sm text-[var(--texto-tenue)]">{faltaNueva}</span>}
              </div>
            </>
          )}
          {resultado && <PanelResultado r={resultado} />}
        </section>
      )}
    </div>
  );
}
