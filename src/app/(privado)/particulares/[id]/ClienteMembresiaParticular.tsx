"use client";

/**
 * "Reservas de la membresía" (C3, hito H3).
 *
 * Cada reserva muestra los botones de sus transiciones permitidas
 * (`transicionesPermitidas`, calculado en el servidor con `TRANSICIONES` de
 * `@/lib/reservas` — un solo lugar decide qué se puede, acá solo se ofrece).
 * Suspender pide motivo del catálogo; reprogramar pide fecha/hora/sala nueva;
 * el resto de las transiciones son un solo clic.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatearHoras, opcionesDuracion, aMinutos } from "@/lib/horarios";
import { ETIQUETA_ESTADO_RESERVA, type EstadoReserva } from "@/lib/reservas";
import AvisoWhatsapp from "@/components/AvisoWhatsapp";
import {
  crearReserva,
  cambiarEstadoReserva,
  reprogramarReserva,
  cancelarAPedido,
  type ReservaConHistorial,
  type MembresiaParticularDetalle,
} from "../acciones";

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base w-full";
const botonPrimario =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] font-medium hover:opacity-90 disabled:opacity-40";
const botonTenue =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40";
const botonPeligro =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--peligro)] text-[var(--peligro)] hover:opacity-80 disabled:opacity-40";

const ETIQUETA_DESTINO: Record<EstadoReserva, string> = {
  solicitada: "Solicitar",
  confirmada: "Confirmar",
  reprogramada: "Reprogramar",
  reagendar: "Cancelar",
  suspendida: "Suspender",
  ausente: "Marcar Ausente",
  realizada: "Marcar Realizada",
};

const COLOR_ESTADO: Record<EstadoReserva, string> = {
  solicitada: "text-[var(--advertencia)]",
  confirmada: "text-[var(--exito)]",
  reprogramada: "text-[var(--exito)]",
  reagendar: "text-[var(--texto-tenue)]",
  suspendida: "text-[var(--texto-tenue)]",
  ausente: "text-[var(--peligro)]",
  realizada: "text-[var(--exito)]",
};

type Aviso = { nombre: string; whatsapp: string | null; mensaje: string };

function fechaHoraCorta(fecha: string, hora: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${DIAS[d.getDay()]} ${dd}/${mm} ${hora.slice(0, 5)}`;
}

/** "26/09/2026 01:22", siempre en hora de Bolivia. Dos motivos para no usar
 *  `Date.prototype.getHours()`/`toLocaleString()` a secas: (1) sin
 *  `timeZone` explícito, cada uno usa el huso del runtime — el servidor
 *  (Vercel, UTC) y el navegador de Javier (America/La_Paz) darían HORAS
 *  distintas para el mismo instante, no solo un formato distinto; (2) el
 *  formato de 12 h agrega "a. m./p. m." con un espacio que el ICU de Node y
 *  el del navegador arman con caracteres distintos — mismo texto visible,
 *  hidratación rota igual. Con `timeZone` fijo y 24 h ninguno de los dos
 *  pasa. */
const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function fechaHoraCompleta(iso: string): string {
  return FORMATO_FECHA_HORA.format(new Date(iso)).replace(",", "");
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
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [avisoAlumno, setAvisoAlumno] = useState<Aviso | null>(null);
  const [avisoProfesor, setAvisoProfesor] = useState<Aviso | null>(null);
  const [reservaEnAccion, setReservaEnAccion] = useState<{ id: number; destino: EstadoReserva } | null>(null);
  const [motivoSuspension, setMotivoSuspension] = useState("");

  const duraciones = useMemo(() => opcionesDuracion(incrementoMin, minimoMin), [incrementoMin, minimoMin]);

  // ── Nueva reserva ────────────────────────────────────────────────────
  const [nFecha, setNFecha] = useState(detalle.fechaInicio);
  const [nHora, setNHora] = useState("18:00");
  const [nDuracion, setNDuracion] = useState(duraciones[0] ?? 60);
  const [nSalaTipo, setNSalaTipo] = useState<"propia" | "externa">("propia");
  const [nSalaId, setNSalaId] = useState<number | null>(salas[0]?.id ?? null);
  const [nNombreExterna, setNNombreExterna] = useState("");

  const nuevaValida =
    aMinutos(nHora) != null &&
    duraciones.includes(nDuracion) &&
    (nSalaTipo === "externa" ? nNombreExterna.trim().length > 0 : nSalaId != null);

  function limpiarAvisos() {
    setError(null);
    setMensaje(null);
    setAvisoAlumno(null);
    setAvisoProfesor(null);
  }

  function aplicarResultado(r: { ok?: true; mensaje?: string; error?: string; avisoAlumno?: Aviso; avisoProfesor?: Aviso }) {
    if (r.error) {
      setError(r.error);
      return;
    }
    setMensaje(r.mensaje ?? null);
    setAvisoAlumno(r.avisoAlumno ?? null);
    setAvisoProfesor(r.avisoProfesor ?? null);
    router.refresh();
  }

  function crear(accion: "solicitar" | "confirmar") {
    limpiarAvisos();
    startTransition(async () => {
      const r = await crearReserva({
        membresiaId: detalle.id,
        fecha: nFecha,
        hora: nHora,
        duracionMin: nDuracion,
        sala: nSalaTipo === "externa" ? { tipo: "externa", nombreDescriptivo: nNombreExterna } : { tipo: "propia", salaId: nSalaId! },
        accion,
      });
      aplicarResultado(r);
    });
  }

  function transicionar(id: number, destino: EstadoReserva, opciones?: { motivo?: string }) {
    limpiarAvisos();
    startTransition(async () => {
      const r =
        destino === "reagendar"
          ? await cancelarAPedido(id)
          : await cambiarEstadoReserva(id, destino, opciones);
      setReservaEnAccion(null);
      setMotivoSuspension("");
      aplicarResultado(r);
    });
  }

  // ── Reprogramar ──────────────────────────────────────────────────────
  const [rFecha, setRFecha] = useState("");
  const [rHora, setRHora] = useState("");
  const [rDuracion, setRDuracion] = useState(duraciones[0] ?? 60);
  const [rSalaId, setRSalaId] = useState<number | null>(salas[0]?.id ?? null);

  function abrirReprogramar(r: ReservaConHistorial) {
    setReservaEnAccion({ id: r.id, destino: "reprogramada" });
    setRFecha(r.fecha);
    setRHora(r.hora.slice(0, 5));
    setRDuracion(r.duracion_min);
    setRSalaId(r.sala_id);
  }

  function confirmarReprogramar(id: number) {
    limpiarAvisos();
    startTransition(async () => {
      const r = await reprogramarReserva({ reservaId: id, fecha: rFecha, hora: rHora, duracionMin: rDuracion, salaId: rSalaId! });
      setReservaEnAccion(null);
      aplicarResultado(r);
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-[var(--peligro)]" role="alert">
          {error}
        </p>
      )}
      {mensaje && <p className="text-[var(--exito)]">{mensaje}</p>}
      {avisoAlumno && <AvisoWhatsapp nombre={avisoAlumno.nombre} whatsapp={avisoAlumno.whatsapp} mensaje={avisoAlumno.mensaje} />}
      {avisoProfesor && <AvisoWhatsapp nombre={avisoProfesor.nombre} whatsapp={avisoProfesor.whatsapp} mensaje={avisoProfesor.mensaje} />}

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
            <div className="text-lg tabular-nums font-semibold">{formatearHoras(detalle.saldo.disponibleMin / 60)} h</div>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radio-panel)] border border-[var(--borde)] divide-y divide-[var(--borde)]">
        <h2 className="font-medium p-4 pb-0">Reservas</h2>
        {detalle.reservas.length === 0 && (
          <p className="p-4 text-[var(--texto-tenue)]">Todavía no hay ninguna reserva.</p>
        )}
        {detalle.reservas.map((r) => (
          <div key={r.id} className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="tabular-nums">{fechaHoraCorta(r.fecha, r.hora)}</span>{" "}
                <span className="text-[var(--texto-tenue)]">
                  ({formatearHoras(r.duracion_min / 60)} h · {r.salaNombre})
                </span>
              </div>
              <span className={`text-sm font-medium ${COLOR_ESTADO[r.estado]}`}>
                {ETIQUETA_ESTADO_RESERVA[r.estado]}
                {r.estado === "solicitada" && r.solicitada_hasta && !r.ocupaAhora && " (vencida, se liberó)"}
                {r.estado === "solicitada" && r.solicitada_hasta && r.ocupaAhora && (
                  <span className="font-normal text-[var(--texto-tenue)]">
                    {" "}
                    · vence {fechaHoraCorta(r.solicitada_hasta.slice(0, 10), r.solicitada_hasta.slice(11, 16))}
                  </span>
                )}
              </span>
            </div>

            {puedeEditar && reservaEnAccion?.id === r.id && reservaEnAccion.destino === "suspendida" && (
              <div className="mt-3 flex items-end gap-2 flex-wrap">
                <div className="min-w-[16rem]">
                  <label className="text-sm text-[var(--texto-tenue)]">Motivo</label>
                  <select className={control} value={motivoSuspension} onChange={(e) => setMotivoSuspension(e.target.value)}>
                    <option value="">Elegí un motivo…</option>
                    {motivosSuspension.map((m) => (
                      <option key={m.valor} value={m.valor}>
                        {m.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className={botonPrimario}
                  disabled={pendiente || !motivoSuspension}
                  onClick={() => transicionar(r.id, "suspendida", { motivo: motivoSuspension })}
                >
                  Confirmar suspensión
                </button>
                <button className={botonTenue} onClick={() => setReservaEnAccion(null)}>
                  Cancelar
                </button>
              </div>
            )}

            {puedeEditar && reservaEnAccion?.id === r.id && reservaEnAccion.destino === "reprogramada" && (
              <div className="mt-3 flex items-end gap-2 flex-wrap">
                <div>
                  <label className="text-sm text-[var(--texto-tenue)]">Fecha</label>
                  <input type="date" className={control} value={rFecha} onChange={(e) => setRFecha(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-[var(--texto-tenue)]">Hora</label>
                  <input type="time" className={control} value={rHora} onChange={(e) => setRHora(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-[var(--texto-tenue)]">Duración</label>
                  <select className={control} value={rDuracion} onChange={(e) => setRDuracion(Number(e.target.value))}>
                    {duraciones.map((d) => (
                      <option key={d} value={d}>
                        {formatearHoras(d / 60)} h
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-[var(--texto-tenue)]">Sala</label>
                  <select className={control} value={rSalaId ?? ""} onChange={(e) => setRSalaId(Number(e.target.value))}>
                    {salas.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className={botonPrimario}
                  disabled={pendiente || !rFecha || aMinutos(rHora) == null}
                  onClick={() => confirmarReprogramar(r.id)}
                >
                  Confirmar
                </button>
                <button className={botonTenue} onClick={() => setReservaEnAccion(null)}>
                  Cancelar
                </button>
              </div>
            )}

            {puedeEditar && !(reservaEnAccion?.id === r.id) && r.transicionesPermitidas.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {r.transicionesPermitidas.map((destino) => (
                  <button
                    key={destino}
                    disabled={pendiente}
                    className={destino === "reagendar" ? botonPeligro : botonTenue}
                    onClick={() => {
                      if (destino === "suspendida") setReservaEnAccion({ id: r.id, destino });
                      else if (destino === "reprogramada") abrirReprogramar(r);
                      else transicionar(r.id, destino);
                    }}
                  >
                    {ETIQUETA_DESTINO[destino]}
                  </button>
                ))}
              </div>
            )}

            {r.historial.length > 0 && (
              <details className="mt-2">
                <summary className="text-sm text-[var(--texto-tenue)] cursor-pointer">Historial ({r.historial.length})</summary>
                <ul className="mt-1 text-sm text-[var(--texto-tenue)] space-y-1">
                  {r.historial.map((h, i) => (
                    <li key={i}>
                      {fechaHoraCompleta(h.creado_en)} — {ETIQUETA_ESTADO_RESERVA[h.estado_nuevo as EstadoReserva] ?? h.estado_nuevo}{" "}
                      ({fechaHoraCorta(h.fecha_nueva, h.hora_nueva)}){h.motivo ? ` · ${h.motivo}` : ""}
                      {h.fuera_de_plazo ? " · fuera de plazo" : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </section>

      {puedeCrear && (
        <section className="rounded-[var(--radio-panel)] border border-[var(--borde)] p-4">
          <h2 className="font-medium mb-3">Nueva reserva</h2>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-sm text-[var(--texto-tenue)]">Fecha</label>
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
              <label className="text-sm text-[var(--texto-tenue)]">Hora</label>
              <input type="time" className={control} value={nHora} onChange={(e) => setNHora(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-[var(--texto-tenue)]">Duración</label>
              <select className={control} value={nDuracion} onChange={(e) => setNDuracion(Number(e.target.value))}>
                {duraciones.map((d) => (
                  <option key={d} value={d}>
                    {formatearHoras(d / 60)} h
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-[var(--texto-tenue)]">Sala</label>
              <select
                className={control}
                value={nSalaTipo}
                onChange={(e) => setNSalaTipo(e.target.value as "propia" | "externa")}
              >
                <option value="propia">Propia</option>
                {tieneExterna && <option value="externa">Externa</option>}
              </select>
            </div>
            {nSalaTipo === "propia" ? (
              <div>
                <label className="text-sm text-[var(--texto-tenue)]">Cuál</label>
                <select className={control} value={nSalaId ?? ""} onChange={(e) => setNSalaId(Number(e.target.value))}>
                  {salas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="min-w-[16rem]">
                <label className="text-sm text-[var(--texto-tenue)]">Nombre del lugar</label>
                <input
                  className={control}
                  placeholder="Salón X — Hotel Y"
                  value={nNombreExterna}
                  onChange={(e) => setNNombreExterna(e.target.value)}
                />
              </div>
            )}
            <button className={botonTenue} disabled={pendiente || !nuevaValida} onClick={() => crear("solicitar")}>
              Solicitar
            </button>
            <button className={botonPrimario} disabled={pendiente || !nuevaValida} onClick={() => crear("confirmar")}>
              Confirmar directo
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
