"use client";

/**
 * Panel de gestión de UNA reserva de particular (H4, 2026-09-26).
 *
 * Extraído del bloque por-reserva que vivía inline en
 * `src/components/ReservasDeMembresia.tsx` (regla de proceso 4:
 * una pieza por entidad, montada igual en todos lados — acá la entidad es
 * "una reserva"). Se monta en dos lugares:
 *   - `/particulares/[id]`: una tarjeta por cada reserva de la membresía,
 *     con `onCambio` refrescando toda la página (sin cambio de comportamiento).
 *   - `/sala`: un único recuadro enfocado, que se abre al pedir "Gestionar"
 *     sobre una reserva puntual. Javier, 26/09: "el flujo normal debería ser
 *     ver solo el recuadro y opciones con los datos de la reserva específica
 *     y retornar naturalmente a la anterior pantalla" — por eso acá no se
 *     trae ni se muestra ninguna otra reserva de la membresía, y
 *     `mostrarLinkFicha` ofrece la ficha completa solo como un link aparte,
 *     para cuando de verdad hace falta ver todo.
 */

import Link from "next/link";
import { formatearHoras } from "@/lib/horarios";
import { ETIQUETA_ESTADO_RESERVA, type EstadoReserva } from "@/lib/reservas";
import AvisoDeReserva from "@/components/AvisoDeReserva";
import type { AccionPendiente } from "@/lib/accionPendiente";
import type { ReservaConHistorial } from "@/app/(privado)/particulares/acciones";
import {
  efectoDestino,
  etiquetaDestino,
  fechaHoraCompleta,
  fechaHoraCorta,
  useGestionReserva,
  type Resultado,
} from "./useGestionReserva";

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base w-full";
const botonPrimario =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] font-medium hover:opacity-90 disabled:opacity-40";
const botonTenue =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40";
const botonPeligro =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--peligro)] text-[var(--peligro)] hover:opacity-80 disabled:opacity-40";
const etiqueta = "text-sm text-[var(--texto-tenue)] block mb-1";

const COLOR_ESTADO: Record<EstadoReserva, string> = {
  solicitada: "text-[var(--advertencia)]",
  confirmada: "text-[var(--exito)]",
  reprogramada: "text-[var(--exito)]",
  reagendar: "text-[var(--texto-tenue)]",
  suspendida: "text-[var(--texto-tenue)]",
  ausente: "text-[var(--peligro)]",
  realizada: "text-[var(--exito)]",
};

function PanelResultado({ r }: { r: Resultado }) {
  return (
    <div className="mt-3 space-y-2">
      {r.error && (
        <p className="text-[var(--peligro)]" role="alert">
          {r.error}
        </p>
      )}
      {r.mensaje && <p className="text-[var(--exito)]">{r.mensaje}</p>}
      {r.avisoAlumno && <AvisoDeReserva aviso={r.avisoAlumno} />}
      {r.avisoProfesor && <AvisoDeReserva aviso={r.avisoProfesor} />}
    </div>
  );
}

export default function GestionReserva({
  reserva,
  membresiaId,
  tipo = "particular",
  disponibleMin,
  fechaInicioMembresia,
  fechaFinMembresia,
  salasPropias,
  salaExternaDeLaMembresia,
  motivosSuspension,
  incrementoMin,
  minimoMin,
  puedeEditar,
  onCambio,
  mostrarLinkFicha,
  onAccion,
}: {
  reserva: ReservaConHistorial;
  membresiaId: number;
  /** Decide a qué ficha lleva el link: `/particulares/[id]` o `/alquileres/[id]`. */
  tipo?: "particular" | "alquiler";
  /** Saldo actual del paquete — gobierna cuánto se puede alargar al reprogramar. */
  disponibleMin: number;
  fechaInicioMembresia: string;
  fechaFinMembresia: string;
  salasPropias: { id: number; nombre: string }[];
  salaExternaDeLaMembresia?: { salaId: number; nombre: string } | null;
  motivosSuspension: { valor: string; etiqueta: string }[];
  incrementoMin: number;
  minimoMin: number;
  puedeEditar: boolean;
  /** Qué hacer tras una acción exitosa: refrescar la ficha completa, o cerrar
   *  el panel enfocado y recargar la disponibilidad — decide quien lo monta. */
  onCambio: () => void;
  /** Link secundario "Ver ficha completa" — solo desde el panel enfocado de `/sala`.
   *  Navega en la misma pestaña: Atrás vuelve a la vista de trabajo. */
  mostrarLinkFicha?: boolean;
  /** Modo barra fija (vista de trabajo de `/sala`): la pieza deja de dibujar sus
   *  propios botones de confirmar/volver y le cuenta a la barra cuál es la acción
   *  elegida. Sin esto (ficha de la membresía) se comporta como siempre. */
  onAccion?: (a: AccionPendiente | null) => void;
}) {
  const {
    pendiente,
    resultado,
    accion,
    setAccion,
    motivoSuspension,
    setMotivoSuspension,
    abrirCortesia,
    setAbrirCortesia,
    motivoCortesia,
    setMotivoCortesia,
    rFecha,
    setRFecha,
    rHora,
    setRHora,
    rDuracion,
    setRDuracion,
    rSalaId,
    setRSalaId,
    opcionesDur,
    salasReprogramar,
    faltaReprogramar,
    enBarra,
    abrirReprogramar,
    transicionar,
    guardarCortesia,
    confirmarReprogramar,
    setResultado,
  } = useGestionReserva({ reserva, tipo, disponibleMin, salasPropias, salaExternaDeLaMembresia, incrementoMin, minimoMin, onCambio, onAccion });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="tabular-nums">{fechaHoraCorta(reserva.fecha, reserva.hora)}</span>{" "}
          <span className="text-[var(--texto-tenue)]">
            ({formatearHoras(reserva.duracion_min / 60)} h · {reserva.salaNombre})
          </span>
        </div>
        <span className={`text-sm font-medium ${COLOR_ESTADO[reserva.estado]}`}>
          {ETIQUETA_ESTADO_RESERVA[reserva.estado]}
          {reserva.estado === "solicitada" && reserva.solicitada_hasta && !reserva.ocupaAhora && " (vencida, se liberó)"}
          {reserva.estado === "solicitada" && reserva.solicitada_hasta && reserva.ocupaAhora && (
            <span className="font-normal text-[var(--texto-tenue)]"> · vence {fechaHoraCompleta(reserva.solicitada_hasta)}</span>
          )}
        </span>
      </div>

      {puedeEditar && accion === "suspendida" && (
        <div className="mt-3">
          <p className="text-sm text-[var(--texto-tenue)] mb-2">{efectoDestino("suspendida", reserva.estado)}</p>
          <div className="max-w-sm">
            <label className={etiqueta}>Motivo de la suspensión</label>
            <select className={control} value={motivoSuspension} onChange={(e) => setMotivoSuspension(e.target.value)}>
              <option value="">Elegí un motivo…</option>
              {motivosSuspension.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.etiqueta}
                </option>
              ))}
            </select>
          </div>
          {!enBarra && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <button className={botonPrimario} disabled={pendiente || !motivoSuspension} onClick={() => transicionar("suspendida", { motivo: motivoSuspension })}>
                {reserva.estado === "solicitada" ? "Confirmar rechazo" : "Confirmar suspensión"}
              </button>
              <button className={botonTenue} onClick={() => setAccion(null)}>
                Volver
              </button>
            </div>
          )}
        </div>
      )}

      {puedeEditar && accion === "reprogramada" && (
        <div className="mt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={etiqueta}>Fecha</label>
              <input
                type="date"
                className={control}
                value={rFecha}
                min={fechaInicioMembresia}
                max={fechaFinMembresia}
                onChange={(e) => setRFecha(e.target.value)}
              />
            </div>
            <div>
              <label className={etiqueta}>Hora de inicio</label>
              <input type="time" className={control} value={rHora} onChange={(e) => setRHora(e.target.value)} />
            </div>
            <div>
              <label className={etiqueta}>Duración</label>
              <select className={control} value={rDuracion} onChange={(e) => setRDuracion(Number(e.target.value))}>
                {opcionesDur.map((d) => (
                  <option key={d} value={d}>
                    {formatearHoras(d / 60)} h
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={etiqueta}>Sala</label>
              <select className={control} value={rSalaId ?? ""} onChange={(e) => setRSalaId(Number(e.target.value))}>
                {salasReprogramar.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!enBarra && (
            <div className="mt-3 flex gap-2 flex-wrap items-center">
              <button className={botonPrimario} disabled={pendiente || !!faltaReprogramar} onClick={confirmarReprogramar}>
                Confirmar reprogramación
              </button>
              <button className={botonTenue} onClick={() => setAccion(null)}>
                Volver
              </button>
              {faltaReprogramar && <span className="text-sm text-[var(--texto-tenue)]">{faltaReprogramar}</span>}
            </div>
          )}
        </div>
      )}

      {puedeEditar && accion && accion !== "suspendida" && accion !== "reprogramada" && (
        <div className="mt-3">
          <p className="text-sm text-[var(--texto-tenue)] mb-2">{efectoDestino(accion, reserva.estado)}</p>
          {!enBarra && (
            <div className="flex gap-2 flex-wrap">
              <button
                className={accion === "reagendar" ? botonPeligro : botonPrimario}
                disabled={pendiente}
                onClick={() => transicionar(accion)}
              >
                Confirmar: {etiquetaDestino(accion, reserva.estado, tipo)}
              </button>
              <button className={botonTenue} onClick={() => setAccion(null)}>
                Volver
              </button>
            </div>
          )}
        </div>
      )}

      {puedeEditar && !accion && reserva.transicionesPermitidas.length > 0 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {reserva.transicionesPermitidas.map((destino) => (
            <button
              key={destino}
              disabled={pendiente}
              className={destino === "reagendar" ? botonPeligro : botonTenue}
              onClick={() => {
                setResultado(null);
                if (destino === "reprogramada") abrirReprogramar();
                else setAccion(destino);
              }}
            >
              {etiquetaDestino(destino, reserva.estado, tipo)}
            </button>
          ))}
        </div>
      )}

      {reserva.esCortesia && (
        <p className="mt-2 text-sm text-[var(--texto-tenue)]">
          <span className="font-medium text-[var(--texto)]">Cortesía</span> — no devenga ni descuenta horas.
          {reserva.cortesiaMotivo ? ` Motivo: ${reserva.cortesiaMotivo}` : ""}
        </p>
      )}

      {puedeEditar && !accion && (reserva.permiteCortesia || reserva.esCortesia) && (
        <div className="mt-3">
          {reserva.esCortesia ? (
            <button disabled={pendiente} className={botonTenue} onClick={() => guardarCortesia(null)}>
              Quitar cortesía
            </button>
          ) : !abrirCortesia ? (
            <button disabled={pendiente} className={botonTenue} onClick={() => setAbrirCortesia(true)}>
              Marcar como cortesía
            </button>
          ) : (
            <div>
              <label className={etiqueta}>Motivo de la cortesía (quién la otorga, por qué)</label>
              <input className={control} value={motivoCortesia} onChange={(e) => setMotivoCortesia(e.target.value)} />
              {!enBarra && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  <button
                    disabled={pendiente || !motivoCortesia.trim()}
                    className={botonPrimario}
                    onClick={() => guardarCortesia(motivoCortesia)}
                  >
                    Guardar cortesía
                  </button>
                  <button disabled={pendiente} className={botonTenue} onClick={() => { setAbrirCortesia(false); setMotivoCortesia(""); }}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {resultado && <PanelResultado r={resultado} />}

      {mostrarLinkFicha && (
        <div className="mt-3">
          <Link
            href={`/${tipo === "alquiler" ? "alquileres" : "particulares"}/${membresiaId}`}
            className="text-sm text-[var(--primario)] underline hover:no-underline"
          >
            Ver ficha completa de la membresía
          </Link>
        </div>
      )}

      {reserva.historial.length > 0 && (
        <details className="mt-2">
          <summary className="text-sm text-[var(--texto-tenue)] cursor-pointer">Historial ({reserva.historial.length})</summary>
          <ul className="mt-1 text-sm text-[var(--texto-tenue)] space-y-1">
            {reserva.historial.map((h, i) => (
              <li key={i}>
                {fechaHoraCompleta(h.creado_en)} — {ETIQUETA_ESTADO_RESERVA[h.estado_nuevo as EstadoReserva] ?? h.estado_nuevo} ({fechaHoraCorta(h.fecha_nueva, h.hora_nueva)})
                {h.motivo ? ` · ${h.motivo}` : ""}
                {h.fuera_de_plazo ? " · fuera de plazo" : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
