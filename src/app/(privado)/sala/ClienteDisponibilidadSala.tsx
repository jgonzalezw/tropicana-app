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
import {
  cancelarReservaSala,
  consultarDisponibilidad,
  crearBloqueoSala,
  type BloqueDisponibilidad,
  type DisponibilidadDia,
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
}: {
  salaId: number;
  salaNombre: string;
  fecha: string;
  motivos: { valor: string; etiqueta: string }[];
  opcionesDuracionMin: number[];
  puedeEditar: boolean;
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

  function abrirFormulario() {
    setAviso(null);
    setMostrarForm(true);
  }

  function confirmarBloqueo() {
    setAviso(null);
    startTransition(async () => {
      const r = await crearBloqueoSala(salaId, {
        fecha,
        hora,
        duracionMin,
        motivo,
        glosa: glosa.trim() || null,
        notas: notas.trim() || null,
      });
      if (r.error) setAviso({ ok: false, texto: r.error });
      else {
        // Éxito: se colapsa el formulario y se limpian sus campos — que
        // siga abierto "invitando a repetir" es justo lo que no puede volver
        // a pasar (Javier, 2026-09-17).
        setAviso({ ok: true, texto: r.mensaje ?? "Bloqueo registrado." });
        setMostrarForm(false);
        setGlosa("");
        setNotas("");
        recargar();
      }
    });
  }

  function pedirCancelacion(b: BloqueDisponibilidad) {
    setAviso(null);
    setPorCancelar(b);
  }

  function confirmarCancelacion() {
    if (!porCancelar || porCancelar.id == null) return;
    const id = porCancelar.id;
    setAviso(null);
    startTransition(async () => {
      const r = await cancelarReservaSala(id);
      setPorCancelar(null);
      if (r.error) setAviso({ ok: false, texto: r.error });
      else {
        setAviso({ ok: true, texto: r.mensaje ?? "Reserva cancelada." });
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
                return (
                  <div
                    key={b.id ?? `curso-${i}`}
                    className="flex items-start gap-3 py-2 border-t border-[var(--borde)] first:border-t-0"
                  >
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
                    {puedeEditar && b.id != null && b.tipo === "bloqueo" && (
                      <button
                        onClick={() => pedirCancelacion(b)}
                        className="text-sm text-[var(--texto-tenue)] hover:text-[var(--peligro)]"
                      >
                        Cancelar
                      </button>
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

        {porCancelar && (
          <div className="mt-3 border border-[var(--peligro)] bg-[color-mix(in_srgb,var(--peligro)_10%,transparent)] rounded-[var(--radio-panel)] p-4 space-y-3">
            <p className="text-base">
              ¿Cancelar <strong>{porCancelar.etiqueta}</strong> ({porCancelar.hora}, ese día)?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPorCancelar(null)} className={`${control} bg-transparent`}>
                Volver
              </button>
              <button
                onClick={confirmarCancelacion}
                disabled={pendiente}
                className="px-4 py-2 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--peligro)] text-white disabled:opacity-45"
              >
                {pendiente ? "Cancelando…" : "Sí, cancelar la reserva"}
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

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={confirmarBloqueo}
                  disabled={pendiente || !motivo}
                  className="px-4 py-2 text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-45"
                >
                  {pendiente ? "Guardando…" : "Bloquear sala"}
                </button>
                <button
                  onClick={() => {
                    setMostrarForm(false);
                    setAviso(null);
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
    </div>
  );
}
