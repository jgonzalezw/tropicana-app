"use client";

import { useEffect, useMemo, useState } from "react";
import { etiquetaDuracion, formatearHoras, horaAlineada, opcionesDuracionReserva } from "@/lib/horarios";
import { faltaAgenda, opcionesHora, type AgendaValor } from "@/lib/venta/agenda";

export type SalaAgenda = { id: number; nombre: string };
export type SesionRevisada = { fecha: string; hora: string; duracionMin: number; ok: boolean; motivo?: string };
export type ResultadoRevision = {
  error?: string;
  sesiones?: SesionRevisada[];
  horas?: number;
  leftoverMin?: number;
  todasOk?: boolean;
};

const DIAS = [
  { n: 1, label: "Lun" },
  { n: 2, label: "Mar" },
  { n: 3, label: "Mié" },
  { n: 4, label: "Jue" },
  { n: 5, label: "Vie" },
  { n: 6, label: "Sáb" },
  { n: 7, label: "Dom" },
];
const DIAS_ABREV = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const control = "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base w-full";

function diaCorto(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00`);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  return `${DIAS_ABREV[dow]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Sala, fechas y horario de una venta con reservas (particular y alquiler),
 * con la **misma** revisión de disponibilidad: se valida sola al cambiar
 * cualquier dato —sin botón— y muestra cada reserva como libre o en choque, con
 * su motivo. El que arma la entrada y consulta al servidor es el host
 * (`revisar`): acá solo vive lo que se ve igual en todos los flujos.
 */
export default function AgendaReservas({
  valor,
  onChange,
  onEstado,
  salasPropias,
  permiteExterna,
  esFija,
  horasPaquete,
  incrementoMin,
  minimoMin,
  revisar,
  firmaExtra = "",
}: {
  valor: AgendaValor;
  onChange: (v: AgendaValor) => void;
  /** `listo` = la agenda quedó revisada y toda está libre. Se llama al terminar cada revisión y al cambiar algo (listo=false). */
  onEstado: (e: { listo: boolean; resultado: ResultadoRevision | null }) => void;
  salasPropias: SalaAgenda[];
  permiteExterna: boolean;
  esFija: boolean;
  horasPaquete: number;
  incrementoMin: number;
  minimoMin: number;
  /** Consulta al servidor la disponibilidad con lo que el host sabe (plan, profesor, personas). */
  revisar: (v: AgendaValor) => Promise<ResultadoRevision>;
  /** Lo que el host agrega a la firma (profesor, personas...) para volver a revisar cuando cambia. */
  firmaExtra?: string;
}) {
  const duraciones = useMemo(() => opcionesDuracionReserva(minimoMin), [minimoMin]);
  const horas = useMemo(() => opcionesHora(incrementoMin), [incrementoMin]);
  const [revision, setRevision] = useState<{ firma: string; res: ResultadoRevision } | null>(null);

  const falta = faltaAgenda(valor, esFija, !!valor.hora && horaAlineada(valor.hora, incrementoMin));
  const firma = JSON.stringify({ valor, esFija, firmaExtra });
  const vigente = revision?.firma === firma ? revision.res : null;
  const revisando = !falta && !vigente;

  function cambiar(parcial: Partial<AgendaValor>) {
    onChange({ ...valor, ...parcial });
    onEstado({ listo: false, resultado: null });
  }

  // Revisión automática, con una pausa corta: no consulta por cada tecla.
  useEffect(() => {
    if (falta) return;
    let vigenteLocal = true;
    const t = setTimeout(async () => {
      const res = await revisar(valor);
      if (!vigenteLocal) return;
      setRevision({ firma, res });
      onEstado({ listo: !res.error && !!res.todasOk, resultado: res });
    }, 400);
    return () => {
      vigenteLocal = false;
      clearTimeout(t);
    };
    // `revisar`/`onEstado` cambian de identidad en cada render del host: la firma ya cubre lo que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, falta]);

  return (
    <div className="space-y-4">
      <div>
        <span className="block text-base font-medium mb-1.5">Sala</span>
        {permiteExterna && (
          <div className="flex gap-2 mb-2">
            {(["propia", "externa"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => cambiar({ salaTipo: t, salaId: null })}
                className={`px-3 py-1.5 text-sm rounded-[var(--radio-control)] border ${
                  valor.salaTipo === t ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)]" : "border-[var(--borde)]"
                }`}
              >
                {t === "propia" ? "En Tropicana" : "Ubicación externa"}
              </button>
            ))}
          </div>
        )}
        {valor.salaTipo === "propia" ? (
          salasPropias.length === 0 ? (
            <p className="text-sm text-[var(--peligro)]">Este plan no tiene ninguna sala propia permitida.</p>
          ) : (
            <select value={valor.salaId ?? ""} onChange={(e) => cambiar({ salaId: Number(e.target.value) || null })} className={control}>
              <option value="">Elegí…</option>
              {salasPropias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          )
        ) : (
          <input
            value={valor.nombreExterna}
            onChange={(e) => cambiar({ nombreExterna: e.target.value })}
            placeholder='Ej. "Salón Conquistador — Hotel Los Tajibos" (no se valida su ocupación)'
            className={control}
          />
        )}
      </div>

      <p className="text-sm text-[var(--texto-tenue)]">
        {esFija
          ? `Se reservan todas las franjas que cubran las ${formatearHoras(horasPaquete)} h, en los días elegidos, desde la fecha de inicio.`
          : "Se reserva la primera franja. El resto se coordina después."}
      </p>

      <div className="flex gap-3 flex-wrap items-end">
        <label className="block">
          <span className="block text-sm text-[var(--texto-tenue)] mb-1">Fecha de inicio</span>
          <input type="date" value={valor.fechaInicio} onChange={(e) => cambiar({ fechaInicio: e.target.value })} className={`${control} w-auto`} />
        </label>
        <label className="block">
          <span className="block text-sm text-[var(--texto-tenue)] mb-1">Hora</span>
          <select value={valor.hora} onChange={(e) => cambiar({ hora: e.target.value })} className={`${control} w-auto`}>
            {!horas.includes(valor.hora) && <option value={valor.hora}>{valor.hora}</option>}
            {horas.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm text-[var(--texto-tenue)] mb-1">Duración</span>
          <select value={valor.duracionMin} onChange={(e) => cambiar({ duracionMin: Number(e.target.value) })} className={`${control} w-auto`}>
            {duraciones.map((d) => (
              <option key={d} value={d}>
                {etiquetaDuracion(d)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {esFija && (
        <div>
          <span className="block text-sm text-[var(--texto-tenue)] mb-1">Días de la semana</span>
          <div className="flex gap-1.5 flex-wrap">
            {DIAS.map((d) => (
              <button
                key={d.n}
                type="button"
                aria-pressed={valor.diasSemana.includes(d.n)}
                onClick={() =>
                  cambiar({
                    diasSemana: valor.diasSemana.includes(d.n) ? valor.diasSemana.filter((x) => x !== d.n) : [...valor.diasSemana, d.n].sort(),
                  })
                }
                className={`px-3 py-1.5 text-sm rounded-[var(--radio-control)] border ${
                  valor.diasSemana.includes(d.n) ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)]" : "border-[var(--borde)]"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-[var(--borde)] space-y-2" aria-live="polite">
        {falta && <p className="text-sm text-[var(--texto-tenue)]">Para revisar la disponibilidad falta {falta}.</p>}
        {revisando && <p className="text-sm text-[var(--texto-tenue)]">Revisando la disponibilidad…</p>}
        {vigente?.error && (
          <p className="text-sm text-[var(--peligro)]" role="alert">
            {vigente.error}
          </p>
        )}
        {vigente?.sesiones && (
          <>
            <p className="text-sm font-medium">
              {vigente.sesiones.length === 1 ? "1 reserva" : `${vigente.sesiones.length} reservas`}
              {vigente.horas ? ` para ${formatearHoras(vigente.horas)} h` : ""}:
            </p>
            <ul className="space-y-1">
              {vigente.sesiones.map((s, i) => (
                <li key={i} className={`text-sm flex items-start gap-2 ${s.ok ? "" : "text-[var(--peligro)]"}`}>
                  <span className="shrink-0">{s.ok ? "✓ Libre" : "✗ Choque"}</span>
                  <span>
                    {diaCorto(s.fecha)} {s.hora.slice(0, 5)} ({etiquetaDuracion(s.duracionMin)}){!s.ok && s.motivo ? ` — ${s.motivo}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {!!vigente.leftoverMin && (
              <p className="text-sm text-[var(--texto-tenue)]">
                Quedan {formatearHoras(vigente.leftoverMin / 60)} h del paquete sin agendar en esta venta. Se coordinan después.
              </p>
            )}
            {vigente.todasOk ? (
              <p className="text-sm text-[var(--exito-texto)]">Toda la agenda está disponible.</p>
            ) : (
              <p className="text-sm text-[var(--peligro)]">
                Hay franjas que chocan con la sala o el horario. Cambiá el día, la hora o la sala — en{" "}
                <a href="/sala" className="underline">
                  Disponibilidad de sala
                </a>{" "}
                se ve qué la ocupa.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
