"use client";

/**
 * Una fila de la agenda de /sala (Hito B, S3). La pantalla pinta el slot
 * estándar (`SlotSala`) y no sabe de dónde vino: curso, particular, alquiler,
 * taller, bloqueo o lugar externo se ven con el mismo esqueleto.
 *
 *   [TIPO] HH:MM–HH:MM · título · [Estado]            [Gestionar]
 *   Titular: … · Profesor: … · Grupo (n)
 *
 * Accesibilidad (usuaria con baja visión): el estado va siempre con TEXTO +
 * ICONO + color, nunca solo color; "Solicitada" destaca con borde lateral ámbar.
 * El control se llama siempre "Gestionar"; es el botón primario solo si hay
 * algo pendiente en esa fila.
 */

import { accionPendiente, finDelSlot, type SlotSala, type TipoSlot, type TonoEstado } from "@/lib/slotSala";

export const ETIQUETA_TIPO_SLOT: Record<TipoSlot, string> = {
  curso: "Curso",
  particular: "Particular",
  alquiler: "Alquiler",
  taller: "Taller",
  bloqueo: "Bloqueo",
  externo: "Externo",
};

const CLASE_TIPO: Record<TipoSlot, string> = {
  curso: "bg-[color-mix(in_srgb,var(--primario)_16%,transparent)] text-[var(--primario)]",
  particular: "bg-[color-mix(in_srgb,var(--exito)_16%,transparent)] text-[var(--exito)]",
  alquiler: "bg-[color-mix(in_srgb,var(--exito)_16%,transparent)] text-[var(--exito)]",
  taller: "bg-[color-mix(in_srgb,var(--exito)_16%,transparent)] text-[var(--exito)]",
  externo: "bg-[color-mix(in_srgb,var(--exito)_16%,transparent)] text-[var(--exito)]",
  bloqueo: "bg-[color-mix(in_srgb,var(--peligro)_14%,transparent)] text-[var(--peligro)]",
};

const CLASE_ESTADO: Record<TonoEstado, string> = {
  neutro: "border-[var(--borde)] text-[var(--texto)]",
  ambar: "border-[var(--advertencia-texto)] bg-[var(--advertencia-fill)] text-[var(--advertencia-texto)]",
  exito: "border-[var(--exito)] text-[var(--exito)]",
  peligro: "border-[var(--peligro)] text-[var(--peligro)]",
  tenue: "border-[var(--borde)] text-[var(--texto-tenue)]",
};

function grupo(n: number | null): string | null {
  if (n == null || n < 2) return null;
  return n === 2 ? "Pareja (2)" : `Grupo (${n})`;
}

export default function SlotFila({
  slot,
  ahora,
  abierto,
  onGestionar,
  extra,
}: {
  slot: SlotSala;
  ahora: Date;
  /** Fue el último slot gestionado: se resalta al volver a la agenda. */
  abierto: boolean;
  onGestionar: () => void;
  /** Acción propia del tipo que no pasa por el panel (p. ej. quitar un bloqueo). */
  extra?: React.ReactNode;
}) {
  const pendiente = accionPendiente(slot, ahora);
  const linea2 = [
    slot.titular ? `Titular: ${slot.titular}` : null,
    slot.profesor ? `Profesor: ${slot.profesor}` : null,
    grupo(slot.personas),
  ].filter(Boolean);
  const solicitada = slot.estado.clave === "solicitada";

  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3 py-3 sm:py-2 ${abierto ? "bg-[color-mix(in_srgb,var(--primario)_10%,transparent)] rounded-[var(--radio-control)] px-2 -mx-2 " : ""}${solicitada ? "border-l-4 border-[var(--advertencia-texto)] pl-3" : ""} ${
        slot.atenuado ? "opacity-60" : ""
      }`}
    >
      <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 self-start ${CLASE_TIPO[slot.tipo]}`}>
        {ETIQUETA_TIPO_SLOT[slot.tipo]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-base flex items-center gap-x-2 gap-y-1 flex-wrap">
          <strong>
            {slot.hora}–{finDelSlot(slot.hora, slot.duracionMin)}
          </strong>
          <span className={slot.atenuado ? "line-through" : ""}>{slot.titulo}</span>
          <span
            className={`text-sm font-semibold px-2 py-0.5 rounded-full border ${CLASE_ESTADO[slot.estado.tono]}`}
          >
            <span aria-hidden="true">{slot.estado.icono} </span>
            {slot.estado.etiqueta}
          </span>
        </div>
        {linea2.length > 0 && <div className="text-sm text-[var(--texto-tenue)]">{linea2.join(" · ")}</div>}
        {(slot.sustituto || slot.lugar || slot.detalle || slot.notas) && (
          <div className="flex gap-2 flex-wrap mt-1">
            {slot.sustituto && <Chip>Relevo: {slot.sustituto}</Chip>}
            {slot.lugar && <Chip>📍 {slot.lugar}</Chip>}
            {slot.detalle && <Chip>{slot.detalle}</Chip>}
            {slot.notas && <Chip>📝 {slot.notas}</Chip>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 sm:shrink-0">
        {extra}
        {slot.gestionable &&
          (pendiente ? (
            <button
              onClick={onGestionar}
              className="w-full sm:w-auto min-h-11 sm:min-h-0 px-3 py-1.5 text-base sm:text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]"
              aria-label={`Gestionar: ${pendiente}`}
            >
              Gestionar · {pendiente}
            </button>
          ) : (
            <button onClick={onGestionar} className="w-full sm:w-auto min-h-11 sm:min-h-0 px-3 sm:px-0 text-base sm:text-sm text-[var(--primario)] border border-[var(--borde)] rounded-[var(--radio-control)] sm:border-0 hover:underline">
              Gestionar
            </button>
          ))}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--borde)] text-[var(--texto-tenue)]">
      {children}
    </span>
  );
}
