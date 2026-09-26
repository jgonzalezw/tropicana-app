"use client";

/**
 * "Reservas de la membresía" (C3, hito H3).
 *
 * Cada reserva muestra los botones de sus transiciones permitidas
 * (`transicionesPermitidas`, calculado en el servidor con `TRANSICIONES` de
 * `@/lib/reservas` — un solo lugar decide qué se puede, acá solo se ofrece).
 *
 * El resultado de cada acción (error, confirmación y avisos de WhatsApp) se
 * muestra **dentro del recuadro donde se trabajó**, no arriba de la pantalla
 * (Javier, 26/09: lejos de la reserva no se ve).
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatearHoras, opcionesDuracionReserva } from "@/lib/horarios";
import { ETIQUETA_ESTADO_RESERVA, validarTiempoReserva, type EstadoReserva } from "@/lib/reservas";
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
const etiqueta = "text-sm text-[var(--texto-tenue)] block mb-1";

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
type Resultado = {
  /** El recuadro donde se muestra: una reserva, o el de "Nueva reserva". */
  donde: number | "nueva";
  error?: string;
  mensaje?: string;
  avisoAlumno?: Aviso;
  avisoProfesor?: Aviso;
};

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

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ESTADOS_QUE_CONSUMEN: EstadoReserva[] = ["confirmada", "reprogramada", "ausente", "realizada"];

function PanelResultado({ r }: { r: Resultado }) {
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
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [reservaEnAccion, setReservaEnAccion] = useState<{ id: number; destino: EstadoReserva } | null>(null);
  const [motivoSuspension, setMotivoSuspension] = useState("");

  // Regla de tiempos de una reserva (26/09): duración en múltiplos del
  // mínimo; el intervalo estándar es para la hora de inicio.
  const todasLasDuraciones = useMemo(() => opcionesDuracionReserva(minimoMin), [minimoMin]);
  const disponibleMin = detalle.saldo.disponibleMin;

  function aplicar(donde: Resultado["donde"], r: { ok?: true; mensaje?: string; error?: string; avisoAlumno?: Aviso; avisoProfesor?: Aviso }) {
    setResultado({ donde, ...r });
    if (!r.error) router.refresh();
  }

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
  const externaDeLaMembresia = detalle.salasDeLaMembresia.find((s) => s.esExterna);
  const [nNombreExterna, setNNombreExterna] = useState(externaDeLaMembresia?.nombre ?? "");

  const faltaNueva: string | null = !nFecha
    ? "Elegí la fecha."
    : validarTiempoReserva({ hora: nHora, duracionMin: nDuracion, incrementoMin, minimoMin }) ??
      (nSalaTipo === "externa"
        ? nNombreExterna.trim()
          ? null
          : "Escribí el nombre del lugar externo."
        : nSalaId == null
          ? "Elegí la sala."
          : null);

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
      aplicar("nueva", r);
    });
  }

  function transicionar(id: number, destino: EstadoReserva, opciones?: { motivo?: string }) {
    setResultado(null);
    startTransition(async () => {
      const r = destino === "reagendar" ? await cancelarAPedido(id) : await cambiarEstadoReserva(id, destino, opciones);
      if (!r.error) {
        setReservaEnAccion(null);
        setMotivoSuspension("");
      }
      aplicar(id, r);
    });
  }

  // ── Reprogramar ──────────────────────────────────────────────────────
  const [rFecha, setRFecha] = useState("");
  const [rHora, setRHora] = useState("");
  const [rDuracion, setRDuracion] = useState(minimoMin);
  const [rSalaId, setRSalaId] = useState<number | null>(null);

  /** Duraciones posibles al reprogramar: múltiplos del mínimo que entren en
   *  lo que ya ocupa esta reserva más lo que queda del paquete. */
  function duracionesReprogramar(r: ReservaConHistorial): number[] {
    const tope = r.duracion_min + (ESTADOS_QUE_CONSUMEN.includes(r.estado) ? disponibleMin : 0);
    return todasLasDuraciones.filter((d) => d <= tope);
  }

  /** Salas para reprogramar: las propias, más la externa que ya usa la
   *  membresía (con su nombre) — si no, una reserva afuera se vería como si
   *  estuviera en la primera sala propia de la lista. */
  const salasReprogramar = [
    ...salas.map((s) => ({ id: s.id, nombre: s.nombre })),
    ...detalle.salasDeLaMembresia.filter((s) => s.esExterna).map((s) => ({ id: s.salaId, nombre: `${s.nombre} (externa)` })),
  ];

  function abrirReprogramar(r: ReservaConHistorial) {
    setResultado(null);
    const opciones = duracionesReprogramar(r);
    setReservaEnAccion({ id: r.id, destino: "reprogramada" });
    setRFecha(r.fecha);
    setRHora(r.hora.slice(0, 5));
    // Una reserva vieja puede durar algo que hoy no es válido (p. ej. media
    // hora cargada antes de la regla del mínimo): se propone la primera
    // duración válida que la cubra, nunca un valor que la lista no muestra.
    setRDuracion(opciones.includes(r.duracion_min) ? r.duracion_min : (opciones.find((d) => d >= r.duracion_min) ?? opciones[0] ?? minimoMin));
    setRSalaId(salasReprogramar.some((s) => s.id === r.sala_id) ? r.sala_id : (salasReprogramar[0]?.id ?? null));
  }

  function confirmarReprogramar(id: number) {
    setResultado(null);
    startTransition(async () => {
      const r = await reprogramarReserva({ reservaId: id, fecha: rFecha, hora: rHora, duracionMin: rDuracion, salaId: rSalaId! });
      if (!r.error) setReservaEnAccion(null);
      aplicar(id, r);
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
        {detalle.reservas.map((r) => {
          const enAccion = reservaEnAccion?.id === r.id ? reservaEnAccion.destino : null;
          const opcionesDur = enAccion === "reprogramada" ? duracionesReprogramar(r) : [];
          const faltaReprogramar =
            enAccion === "reprogramada"
              ? !rFecha
                ? "Elegí la fecha."
                : opcionesDur.length === 0
                  ? `No quedan horas en el paquete para llevar esta reserva al mínimo de ${formatearHoras(minimoMin / 60)} h.`
                  : validarTiempoReserva({ hora: rHora, duracionMin: rDuracion, incrementoMin, minimoMin }) ??
                    (rSalaId == null ? "Elegí la sala." : null)
              : null;
          return (
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
                      · vence {fechaHoraCompleta(r.solicitada_hasta)}
                    </span>
                  )}
                </span>
              </div>

              {puedeEditar && enAccion === "suspendida" && (
                <div className="mt-3">
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
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      className={botonPrimario}
                      disabled={pendiente || !motivoSuspension}
                      onClick={() => transicionar(r.id, "suspendida", { motivo: motivoSuspension })}
                    >
                      Confirmar suspensión
                    </button>
                    <button className={botonTenue} onClick={() => setReservaEnAccion(null)}>
                      Volver
                    </button>
                  </div>
                </div>
              )}

              {puedeEditar && enAccion === "reprogramada" && (
                <div className="mt-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className={etiqueta}>Fecha</label>
                      <input
                        type="date"
                        className={control}
                        value={rFecha}
                        min={detalle.fechaInicio}
                        max={detalle.fechaFin}
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
                  <div className="mt-3 flex gap-2 flex-wrap items-center">
                    <button className={botonPrimario} disabled={pendiente || !!faltaReprogramar} onClick={() => confirmarReprogramar(r.id)}>
                      Confirmar reprogramación
                    </button>
                    <button className={botonTenue} onClick={() => setReservaEnAccion(null)}>
                      Volver
                    </button>
                    {faltaReprogramar && <span className="text-sm text-[var(--texto-tenue)]">{faltaReprogramar}</span>}
                  </div>
                </div>
              )}

              {puedeEditar && !enAccion && r.transicionesPermitidas.length > 0 && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {r.transicionesPermitidas.map((destino) => (
                    <button
                      key={destino}
                      disabled={pendiente}
                      className={destino === "reagendar" ? botonPeligro : botonTenue}
                      onClick={() => {
                        setResultado(null);
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

              {resultado?.donde === r.id && <PanelResultado r={resultado} />}

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
          );
        })}
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
          {resultado?.donde === "nueva" && <PanelResultado r={resultado} />}
        </section>
      )}
    </div>
  );
}
