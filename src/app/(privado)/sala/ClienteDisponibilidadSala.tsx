"use client";

/**
 * C2 — Disponibilidad + reserva mínima, para UNA sala.
 *
 * **Lista textual, sin grilla.** La grilla visual es C4 y pasa por Design; acá
 * alcanza con decir, para un día elegido, qué está ocupado y qué queda libre —
 * el 80% del beneficio con el 20% del costo (Javier, 2026-09-12).
 *
 * **Solo se puede reservar tipo bloqueo.** La venta de particulares/alquiler
 * (que crea reservas con dueño comercial) es C3 y todavía no existe: hoy la
 * única reserva posible en `reservas_sala` es un bloqueo sin venta (D7).
 *
 * **La fecha es una prop, no un estado propio** (2026-09-17): esta pantalla
 * muestra varias salas a la vez, cada una en su propia tarjeta, todas mirando
 * el mismo día — el selector de fecha vive una sola vez, en `ClientePanelSala`.
 */

import { useEffect, useState, useTransition } from "react";
import { describirTramos, describirVentanas } from "@/lib/sala";
import { etiquetaDuracion } from "@/lib/horarios";
import AvisoWhatsapp from "@/components/AvisoWhatsapp";
import GestionReserva from "@/components/GestionReserva";
import { obtenerReservaParaGestion, type DetalleGestionReserva } from "@/app/(privado)/particulares/acciones";
import {
  cancelarReservaSala,
  consultarDisponibilidad,
  crearBloqueoSala,
  type AvisoOperativo,
  type BloqueDisponibilidad,
  type DisponibilidadDia,
  type ReservaChocaBloqueo,
} from "./acciones";

function diaLargo(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-BO", { weekday: "long", day: "2-digit", month: "2-digit" });
}

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base";

const ETIQUETA_TIPO: Record<BloqueDisponibilidad["tipo"], string> = {
  curso: "Curso",
  particular: "Particular",
  alquiler: "Alquiler",
  bloqueo: "Bloqueo",
};

const CLASE_TAG: Record<BloqueDisponibilidad["tipo"], string> = {
  curso: "bg-[color-mix(in_srgb,var(--primario)_16%,transparent)] text-[var(--primario)]",
  particular: "bg-[color-mix(in_srgb,var(--exito)_16%,transparent)] text-[var(--exito)]",
  alquiler: "bg-[color-mix(in_srgb,var(--exito)_16%,transparent)] text-[var(--exito)]",
  bloqueo: "bg-[color-mix(in_srgb,var(--peligro)_14%,transparent)] text-[var(--peligro)]",
};

const vacia: DisponibilidadDia = {
  ventanas: [],
  excepcion: null,
  excepcionMotivoTexto: null,
  ocupados: [],
  tramosLibres: [],
  error: null,
};

export default function ClienteDisponibilidadSala({
  salaId,
  salaNombre,
  fecha,
  motivos,
  opcionesDuracionMin,
  puedeEditar,
  salasPropias,
  motivosSuspension,
  incrementoMin,
  minimoMin,
}: {
  salaId: number;
  salaNombre: string;
  fecha: string;
  motivos: { valor: string; etiqueta: string }[];
  opcionesDuracionMin: number[];
  puedeEditar: boolean;
  /** H4 — para el panel de gestión de una reserva (`GestionReserva`): todas
   *  las salas propias (no solo esta tarjeta, por si se reprograma a otra) y
   *  los mismos motivos/tiempos que usa `/particulares/[id]`. */
  salasPropias: { id: number; nombre: string }[];
  motivosSuspension: { valor: string; etiqueta: string }[];
  incrementoMin: number;
  minimoMin: number;
}) {
  const [datos, setDatos] = useState<DisponibilidadDia>(vacia);
  const [cargando, startCarga] = useTransition();
  const [pendiente, startTransition] = useTransition();

  const [mostrarForm, setMostrarForm] = useState(false);
  const [hora, setHora] = useState("09:00");
  const [duracionMin, setDuracionMin] = useState(opcionesDuracionMin[0] ?? 60);
  const [motivo, setMotivo] = useState(motivos[0]?.valor ?? "");
  const [glosa, setGlosa] = useState("");
  const [notas, setNotas] = useState("");

  const [porCancelar, setPorCancelar] = useState<BloqueDisponibilidad | null>(null);
  // H4: la sala choca solo con reservas de particular/alquiler — se puede
  // resolver suspendiéndolas, con confirmación explícita primero.
  const [porConfirmarBloqueo, setPorConfirmarBloqueo] = useState<ReservaChocaBloqueo[] | null>(null);
  // H4 (R22 simétrico): este bloqueo ya había suspendido algo — se pregunta
  // si se revierte al cancelarlo.
  const [porConfirmarCancelacion, setPorConfirmarCancelacion] = useState<{
    ligadas: { reservaId: number; etiqueta: string; fecha: string; hora: string }[];
  } | null>(null);
  const [avisosOperativos, setAvisosOperativos] = useState<AvisoOperativo[] | null>(null);

  // H4: panel de gestión de UNA reserva puntual, enfocado — reemplaza el
  // salto directo a la ficha completa de la membresía (Javier, 26/09).
  const [enfoqueId, setEnfoqueId] = useState<number | null>(null);
  const [detalleGestion, setDetalleGestion] = useState<DetalleGestionReserva | { error: string } | null>(null);
  const [pendienteGestion, startGestion] = useTransition();

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

  // **Un solo aviso para toda la tarjeta**, no uno por acción. Antes había
  // `errForm/msgForm` (bloquear) y `errCancelar/msgCancelar` (cancelar) por
  // separado, y ninguno se limpiaba cuando arrancaba la OTRA acción: el
  // mensaje de una cancelación vieja seguía viéndose al grabar un bloqueo
  // nuevo. Es el mismo bug que "Guardar horario" en C1 (2026-09-16) — un
  // estado de resultado que sobrevive a la acción que lo originó invita a
  // desconfiar de lo que la pantalla dice. Se limpia en TODO punto de entrada
  // de una acción nueva (abrir el form, confirmar bloqueo, pedir cancelar,
  // confirmar cancelación) y vive fuera de `mostrarForm` para que el mensaje
  // de éxito se siga viendo aunque el formulario se colapse.
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  function recargar() {
    startCarga(async () => {
      const r = await consultarDisponibilidad(salaId, fecha);
      setDatos(r);
    });
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaId, fecha]);

  // Cambiar de sala o de fecha cierra el panel de gestión: la reserva
  // enfocada puede ya no estar en la lista nueva. Ajustado durante el render
  // (no en el efecto de arriba, que ya dispara `recargar`) — mismo patrón que
  // `BarraLateral` usa para resetear estado cuando cambia el pathname.
  const claveDia = `${salaId}|${fecha}`;
  const [claveDiaAnterior, setClaveDiaAnterior] = useState(claveDia);
  if (claveDia !== claveDiaAnterior) {
    setClaveDiaAnterior(claveDia);
    setEnfoqueId(null);
    setDetalleGestion(null);
  }

  function abrirFormulario() {
    setAviso(null);
    setPorConfirmarBloqueo(null);
    setMostrarForm(true);
  }

  function confirmarBloqueo(confirmarSuspension = false) {
    setAviso(null);
    startTransition(async () => {
      const r = await crearBloqueoSala(
        salaId,
        { fecha, hora, duracionMin, motivo, glosa: glosa.trim() || null, notas: notas.trim() || null },
        confirmarSuspension
      );
      if ("requiereConfirmacion" in r) {
        setPorConfirmarBloqueo(r.reservasAfectadas);
        return;
      }
      setPorConfirmarBloqueo(null);
      if (r.error) setAviso({ ok: false, texto: r.error });
      else {
        // Éxito: se colapsa el formulario y se limpian sus campos — que
        // siga abierto "invitando a repetir" es justo lo que no puede volver
        // a pasar (Javier, 2026-09-17).
        setAviso({ ok: true, texto: r.mensaje ?? "Bloqueo registrado." });
        setAvisosOperativos(r.avisos?.length ? r.avisos : null);
        setMostrarForm(false);
        setGlosa("");
        setNotas("");
        recargar();
      }
    });
  }

  function pedirCancelacion(b: BloqueDisponibilidad) {
    setAviso(null);
    setPorConfirmarCancelacion(null);
    setPorCancelar(b);
  }

  function confirmarCancelacion(decision?: "revertir" | "sin_revertir") {
    if (!porCancelar || porCancelar.id == null) return;
    const id = porCancelar.id;
    setAviso(null);
    startTransition(async () => {
      const r = await cancelarReservaSala(id, decision);
      if ("requiereConfirmacion" in r) {
        setPorConfirmarCancelacion({ ligadas: r.ligadas });
        return;
      }
      setPorCancelar(null);
      setPorConfirmarCancelacion(null);
      if (r.error) setAviso({ ok: false, texto: r.error });
      else {
        setAviso({ ok: true, texto: r.mensaje ?? "Reserva cancelada." });
        setAvisosOperativos(r.avisos?.length ? r.avisos : null);
        recargar();
      }
    });
  }

  const cerrado = !datos.error && datos.ventanas.length === 0;
  // Al cambiar de fecha/sala, `datos` sigue teniendo lo del día ANTERIOR
  // mientras se pide lo nuevo — mostrarlo sin avisar hace parecer que la
  // pantalla ya cambió cuando en realidad está desactualizada (Javier,
  // 26/09: "se actualizan las fechas y después de segundos recién los
  // detalles"). Se atenúa y se avisa; recién el primer load (datos === vacia)
  // usa el texto "Cargando…" de más abajo, porque ahí no hay nada que atenuar.
  const actualizando = cargando && datos !== vacia;

  return (
    <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold">{salaNombre}</h2>
        <div className="flex items-center gap-2">
          {actualizando && <span className="text-xs text-[var(--texto-tenue)]">Actualizando…</span>}
          <div className="font-medium text-[var(--texto-tenue)] capitalize">{diaLargo(fecha)}</div>
        </div>
      </div>

      <div className={`mt-3 ${actualizando ? "opacity-50 transition-opacity" : ""}`}>
        {datos.error ? (
          <p className="text-base text-[var(--peligro)] mt-2">{datos.error}</p>
        ) : cargando && datos === vacia ? (
          <p className="text-base text-[var(--texto-tenue)] mt-2">Cargando…</p>
        ) : cerrado ? (
          <div className="mt-2 border border-[var(--primario)] bg-[color-mix(in_srgb,var(--primario)_12%,transparent)] rounded-[var(--radio-panel)] p-4">
            <p className="text-base">
              La sala no abre este día
              {datos.excepcionMotivoTexto ? <> ({datos.excepcionMotivoTexto})</> : null}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {datos.ocupados.length === 0 ? (
              <p className="text-base text-[var(--texto-tenue)]">Sin nada ocupado todavía.</p>
            ) : (
              datos.ocupados.map((b, i) => {
                const ini = b.hora;
                const finMin = Number(ini.slice(0, 2)) * 60 + Number(ini.slice(3, 5)) + b.duracionMin;
                const fin = `${String(Math.floor(finMin / 60) % 24).padStart(2, "0")}:${String(finMin % 60).padStart(2, "0")}`;
                const id = b.id;
                return (
                  <div key={b.id ?? `curso-${i}`} className="border-t border-[var(--borde)] first:border-t-0">
                    <div className="flex items-start gap-3 py-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${CLASE_TAG[b.tipo]}`}>
                        {ETIQUETA_TIPO[b.tipo]}
                      </span>
                      <div className="flex-1">
                        <div className="text-base">
                          <strong>
                            {ini}–{fin}
                          </strong>{" "}
                          {b.etiqueta}
                        </div>
                        {b.detalle && <div className="text-sm text-[var(--texto-tenue)]">{b.detalle}</div>}
                        {b.notas && (
                          <div className="text-sm text-[var(--texto-tenue)] mt-0.5">📝 {b.notas}</div>
                        )}
                      </div>
                      {/* H4: reemplaza el link directo a la ficha completa — la
                          intención acá es actuar sobre ESTA reserva, no ver
                          todas las de la membresía (Javier, 26/09). */}
                      {b.gestionable && id != null && (
                        <button
                          onClick={() => (enfoqueId === id ? cerrarGestion() : abrirGestion(id))}
                          className="text-sm text-[var(--primario)] hover:underline shrink-0"
                        >
                          {enfoqueId === id ? "Cerrar" : "Gestionar"}
                        </button>
                      )}
                      {puedeEditar && b.id != null && b.tipo === "bloqueo" && (
                        <button
                          onClick={() => pedirCancelacion(b)}
                          className="text-sm text-[var(--texto-tenue)] hover:text-[var(--peligro)]"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                    {enfoqueId === b.id && (
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
                );
              })
            )}

            <p className="text-base pt-2 border-t border-[var(--borde)] mt-2">
              <strong>Libre:</strong> {describirTramos(datos.tramosLibres)}
            </p>
            <p className="text-sm text-[var(--texto-tenue)]">Abre {describirVentanas(datos.ventanas)}.</p>
          </div>
        )}

        {porCancelar && !porConfirmarCancelacion && (
          <div className="mt-3 border border-[var(--peligro)] bg-[color-mix(in_srgb,var(--peligro)_10%,transparent)] rounded-[var(--radio-panel)] p-4 space-y-3">
            <p className="text-base">
              ¿Cancelar <strong>{porCancelar.etiqueta}</strong> ({porCancelar.hora}, ese día)?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPorCancelar(null)} className={`${control} bg-transparent`}>
                Volver
              </button>
              <button
                onClick={() => confirmarCancelacion()}
                disabled={pendiente}
                className="px-4 py-2 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--peligro)] text-white disabled:opacity-45"
              >
                {pendiente ? "Cancelando…" : "Sí, cancelar la reserva"}
              </button>
            </div>
          </div>
        )}
        {/* H4 (R22 simétrico): este bloqueo ya había suspendido reservas. */}
        {porCancelar && porConfirmarCancelacion && (
          <div className="mt-3 border border-[var(--peligro)] bg-[color-mix(in_srgb,var(--peligro)_10%,transparent)] rounded-[var(--radio-panel)] p-4 space-y-3">
            <p className="text-base font-semibold">
              Este bloqueo ya había suspendido{" "}
              {porConfirmarCancelacion.ligadas.length === 1 ? "1 clase particular" : `${porConfirmarCancelacion.ligadas.length} clases particulares`}.
            </p>
            <ul className="text-base space-y-1">
              {porConfirmarCancelacion.ligadas.map((l) => (
                <li key={l.reservaId}>
                  {l.etiqueta} · {l.fecha} {l.hora.slice(0, 5)}
                </li>
              ))}
            </ul>
            <p className="text-sm text-[var(--texto-tenue)]">
              ¿Se restablecen (si la sala y el profesor siguen libres), o solo se cancela el bloqueo y quedan
              suspendidas?
            </p>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => setPorConfirmarCancelacion(null)} className={`${control} bg-transparent`}>
                Volver
              </button>
              <button
                onClick={() => confirmarCancelacion("sin_revertir")}
                disabled={pendiente}
                className={`${control}`}
              >
                Cancelar sin revertir
              </button>
              <button
                onClick={() => confirmarCancelacion("revertir")}
                disabled={pendiente}
                className="px-4 py-2 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-45"
              >
                Revertir y cancelar
              </button>
            </div>
          </div>
        )}
        {aviso && (
          <p className={`text-sm mt-2 ${aviso.ok ? "text-[var(--exito)]" : "text-[var(--peligro)]"}`}>
            {aviso.texto}
          </p>
        )}
      </div>

      {/* D7: bloquear la sala sin venta detrás. Es la única reserva posible hoy — la
          venta de particulares/alquiler (C3) todavía no existe. */}
      {puedeEditar && (
        <div className="mt-4 pt-4 border-t border-[var(--borde)]">
          {!mostrarForm ? (
            <button onClick={abrirFormulario} className={`${control}`}>
              + Bloquear esta sala
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-sm text-[var(--texto-tenue)] mb-1">Hora</label>
                  <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={control} />
                </div>
                <div>
                  <label className="block text-sm text-[var(--texto-tenue)] mb-1">Duración</label>
                  <select
                    value={duracionMin}
                    onChange={(e) => setDuracionMin(Number(e.target.value))}
                    className={control}
                  >
                    {opcionesDuracionMin.map((m) => (
                      <option key={m} value={m}>
                        {etiquetaDuracion(m)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[14rem]">
                  {/* Regla de calidad 6: se elige de una lista, no se escribe. */}
                  <label className="block text-sm text-[var(--texto-tenue)] mb-1">Motivo</label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className={`${control} w-full`}
                  >
                    {motivos.length === 0 && <option value="">Sin motivos cargados</option>}
                    {motivos.map((m) => (
                      <option key={m.valor} value={m.valor}>
                        {m.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[14rem]">
                  <label className="block text-sm text-[var(--texto-tenue)] mb-1">
                    Glosa <span className="font-normal">(opcional — aclaración o responsable)</span>
                  </label>
                  <input
                    value={glosa}
                    onChange={(e) => setGlosa(e.target.value)}
                    placeholder="ej. A cargo de Natalia"
                    className={`${control} w-full`}
                  />
                </div>
                <div className="flex-1 min-w-[14rem]">
                  <label className="block text-sm text-[var(--texto-tenue)] mb-1">
                    Notas <span className="font-normal">(opcional — para quien opera la sala)</span>
                  </label>
                  <input
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="ej. Dejar las luces prendidas"
                    className={`${control} w-full`}
                  />
                </div>
              </div>

              {/* H4: choca solo con reservas de particular/alquiler — se puede
                  resolver suspendiéndolas primero, con confirmación explícita. */}
              {porConfirmarBloqueo && (
                <div className="border border-[var(--primario)] bg-[color-mix(in_srgb,var(--primario)_12%,transparent)] rounded-[var(--radio-panel)] p-4 space-y-3">
                  <p className="text-base font-semibold">
                    Esa franja choca con{" "}
                    {porConfirmarBloqueo.length === 1 ? "1 clase particular" : `${porConfirmarBloqueo.length} clases particulares`}{" "}
                    ya confirmadas.
                  </p>
                  <ul className="text-base space-y-1">
                    {porConfirmarBloqueo.map((r) => (
                      <li key={r.reservaId}>
                        {r.etiqueta} · {r.hora.slice(0, 5)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-[var(--texto-tenue)]">
                    Al confirmar, esas reservas quedan Suspendidas (la hora vuelve al paquete) y se crea el
                    bloqueo. Vas a poder copiar un aviso para cada una.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setPorConfirmarBloqueo(null)} className={`${control} bg-transparent`}>
                      Volver
                    </button>
                    <button
                      onClick={() => confirmarBloqueo(true)}
                      disabled={pendiente}
                      className="px-4 py-2 text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-45"
                    >
                      Confirmar y suspender esas clases
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => confirmarBloqueo()}
                  disabled={pendiente || !motivo}
                  className="px-4 py-2 text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-45"
                >
                  {pendiente ? "Guardando…" : "Bloquear sala"}
                </button>
                <button
                  onClick={() => {
                    setMostrarForm(false);
                    setAviso(null);
                    setPorConfirmarBloqueo(null);
                  }}
                  className="text-sm text-[var(--texto-tenue)]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Avisos listos para copiar por WhatsApp: alumno y profesor de cada
          reserva que se suspendió u ofreció revertir en esta tarjeta. */}
      {avisosOperativos && (
        <div className="mt-4 pt-4 border-t border-[var(--borde)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--texto-tenue)]">Avisos</span>
            <button onClick={() => setAvisosOperativos(null)} className="text-sm text-[var(--texto-tenue)]">
              Cerrar
            </button>
          </div>
          {avisosOperativos.map((a) => (
            <AvisoWhatsapp key={a.id} nombre={a.nombre} whatsapp={a.whatsapp} mensaje={a.mensaje} />
          ))}
        </div>
      )}
    </div>
  );
}
