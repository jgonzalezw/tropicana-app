"use client";

/**
 * Panel de gestión de UNA reserva de particular (H4, 2026-09-26).
 *
 * Extraído del bloque por-reserva que vivía inline en
 * `particulares/[id]/ClienteMembresiaParticular.tsx` (regla de proceso 4:
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

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatearHoras, opcionesDuracionReserva } from "@/lib/horarios";
import { ETIQUETA_ESTADO_RESERVA, validarTiempoReserva, type EstadoReserva } from "@/lib/reservas";
import AvisoWhatsapp from "@/components/AvisoWhatsapp";
import {
  cambiarEstadoReserva,
  reprogramarReserva,
  cancelarAPedido,
  type ReservaConHistorial,
} from "@/app/(privado)/particulares/acciones";

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

const ESTADOS_QUE_CONSUMEN: EstadoReserva[] = ["confirmada", "reprogramada", "ausente", "realizada"];

type Aviso = { nombre: string; whatsapp: string | null; mensaje: string };
type Resultado = { error?: string; mensaje?: string; avisoAlumno?: Aviso; avisoProfesor?: Aviso };

function fechaHoraCorta(fecha: string, hora: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${DIAS[d.getDay()]} ${dd}/${mm} ${hora.slice(0, 5)}`;
}

/** "26/09/2026 01:22", siempre en hora de Bolivia — ver la nota de
 *  `ClienteMembresiaParticular.tsx` sobre por qué hace falta `timeZone`
 *  explícito y 24 h para no romper la hidratación entre server y cliente. */
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

export default function GestionReserva({
  reserva,
  membresiaId,
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
}: {
  reserva: ReservaConHistorial;
  membresiaId: number;
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
  /** Link secundario "Ver ficha completa" — solo desde el panel enfocado de `/sala`. */
  mostrarLinkFicha?: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [accion, setAccion] = useState<EstadoReserva | null>(null);
  const [motivoSuspension, setMotivoSuspension] = useState("");

  const todasLasDuraciones = useMemo(() => opcionesDuracionReserva(minimoMin), [minimoMin]);

  const salasReprogramar = useMemo(
    () => [
      ...salasPropias.map((s) => ({ id: s.id, nombre: s.nombre })),
      ...(salaExternaDeLaMembresia
        ? [{ id: salaExternaDeLaMembresia.salaId, nombre: `${salaExternaDeLaMembresia.nombre} (externa)` }]
        : []),
    ],
    [salasPropias, salaExternaDeLaMembresia]
  );

  /** Duraciones posibles al reprogramar: múltiplos del mínimo que entren en
   *  lo que ya ocupa esta reserva más lo que queda del paquete. */
  function duracionesReprogramar(): number[] {
    const tope = reserva.duracion_min + (ESTADOS_QUE_CONSUMEN.includes(reserva.estado) ? disponibleMin : 0);
    return todasLasDuraciones.filter((d) => d <= tope);
  }

  const [rFecha, setRFecha] = useState("");
  const [rHora, setRHora] = useState("");
  const [rDuracion, setRDuracion] = useState(minimoMin);
  const [rSalaId, setRSalaId] = useState<number | null>(null);

  function abrirReprogramar() {
    setResultado(null);
    const opciones = duracionesReprogramar();
    setAccion("reprogramada");
    setRFecha(reserva.fecha);
    setRHora(reserva.hora.slice(0, 5));
    // Una reserva vieja puede durar algo que hoy no es válido (p. ej. media
    // hora cargada antes de la regla del mínimo): se propone la primera
    // duración válida que la cubra, nunca un valor que la lista no muestra.
    setRDuracion(
      opciones.includes(reserva.duracion_min) ? reserva.duracion_min : (opciones.find((d) => d >= reserva.duracion_min) ?? opciones[0] ?? minimoMin)
    );
    setRSalaId(salasReprogramar.some((s) => s.id === reserva.sala_id) ? reserva.sala_id : (salasReprogramar[0]?.id ?? null));
  }

  function transicionar(destino: EstadoReserva, opciones?: { motivo?: string }) {
    setResultado(null);
    startTransition(async () => {
      const r = destino === "reagendar" ? await cancelarAPedido(reserva.id) : await cambiarEstadoReserva(reserva.id, destino, opciones);
      setResultado(r);
      if (!r.error) {
        setAccion(null);
        setMotivoSuspension("");
        onCambio();
      }
    });
  }

  function confirmarReprogramar() {
    setResultado(null);
    startTransition(async () => {
      const r = await reprogramarReserva({ reservaId: reserva.id, fecha: rFecha, hora: rHora, duracionMin: rDuracion, salaId: rSalaId! });
      setResultado(r);
      if (!r.error) {
        setAccion(null);
        onCambio();
      }
    });
  }

  const opcionesDur = accion === "reprogramada" ? duracionesReprogramar() : [];
  const faltaReprogramar =
    accion === "reprogramada"
      ? !rFecha
        ? "Elegí la fecha."
        : opcionesDur.length === 0
          ? `No quedan horas en el paquete para llevar esta reserva al mínimo de ${formatearHoras(minimoMin / 60)} h.`
          : (validarTiempoReserva({ hora: rHora, duracionMin: rDuracion, incrementoMin, minimoMin }) ?? (rSalaId == null ? "Elegí la sala." : null))
      : null;

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
            <button className={botonPrimario} disabled={pendiente || !motivoSuspension} onClick={() => transicionar("suspendida", { motivo: motivoSuspension })}>
              Confirmar suspensión
            </button>
            <button className={botonTenue} onClick={() => setAccion(null)}>
              Volver
            </button>
          </div>
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
          <div className="mt-3 flex gap-2 flex-wrap items-center">
            <button className={botonPrimario} disabled={pendiente || !!faltaReprogramar} onClick={confirmarReprogramar}>
              Confirmar reprogramación
            </button>
            <button className={botonTenue} onClick={() => setAccion(null)}>
              Volver
            </button>
            {faltaReprogramar && <span className="text-sm text-[var(--texto-tenue)]">{faltaReprogramar}</span>}
          </div>
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
                if (destino === "suspendida") setAccion(destino);
                else if (destino === "reprogramada") abrirReprogramar();
                else transicionar(destino);
              }}
            >
              {ETIQUETA_DESTINO[destino]}
            </button>
          ))}
        </div>
      )}

      {resultado && <PanelResultado r={resultado} />}

      {mostrarLinkFicha && (
        <div className="mt-3">
          <Link href={`/particulares/${membresiaId}`} className="text-sm text-[var(--primario)] underline hover:no-underline">
            Ver ficha completa de la membresía →
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
