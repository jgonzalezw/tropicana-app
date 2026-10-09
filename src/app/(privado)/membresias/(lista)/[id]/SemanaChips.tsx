"use client";

import { sumarDiasISO } from "@/lib/calendarioCiclo";
import { fechaTexto } from "@/lib/fichaMembresia";
import type { DiaSemana } from "@/lib/franjasReserva";

/** «8 oct» de una fecha ISO (sin el día de la semana). */
const diaMes = (iso: string) => fechaTexto(iso).split(" ").slice(1, 3).join(" ");
const dow = (iso: string) => fechaTexto(iso).split(" ")[0];

/**
 * La fecha de la hoja «Nueva reserva»: una semana por vez, en 7 chips (día,
 * número y marca «Cerrada», «Reducido» o «Fuera vig.»), ‹ › para cambiar de
 * semana y «Otra fecha» con el calendario. Todo dentro de la vigencia de la
 * membresía: no se puede ir antes del primer día pedible ni después del
 * vencimiento. Las marcas salen de `armarDatosFranjas`.
 */
export default function SemanaChips({
  semanaDesde,
  fecha,
  hoy,
  desde,
  hasta,
  dias,
  onFecha,
  onSemana,
  onAviso,
}: {
  /** Primer día de la semana que se muestra. */
  semanaDesde: string;
  fecha: string;
  hoy: string;
  /** Primer día pedible (hoy o el inicio de la vigencia) y vencimiento. */
  desde: string;
  hasta: string;
  /** Las marcas de la semana (si ya llegaron). */
  dias: DiaSemana[] | null;
  onFecha: (iso: string) => void;
  onSemana: (desdeISO: string) => void;
  onAviso: (texto: string) => void;
}) {
  const fechas = Array.from({ length: 7 }, (_, i) => sumarDiasISO(semanaDesde, i));
  const hayAnterior = semanaDesde > desde;
  const haySiguiente = sumarDiasISO(semanaDesde, 7) <= hasta;
  const marcas = dias && dias[0]?.fecha === semanaDesde ? dias : null;

  return (
    <div className="n-grupo">
      <div className="n-grupo__cab">
        <span className="n-grupo__titulo">
          Fecha{" "}
          <small>
            · {diaMes(fechas[0])} – {diaMes(fechas[6])} · vence {diaMes(hasta)}
          </small>
        </span>
        <button
          type="button"
          className="n-icono-boton"
          aria-label="Semana anterior"
          aria-disabled={!hayAnterior}
          onClick={() => hayAnterior && onSemana(sumarDiasISO(semanaDesde, -7) < desde ? desde : sumarDiasISO(semanaDesde, -7))}
        >
          ‹
        </button>
        <button
          type="button"
          className="n-icono-boton"
          aria-label="Semana siguiente"
          aria-disabled={!haySiguiente}
          onClick={() => (haySiguiente ? onSemana(sumarDiasISO(semanaDesde, 7)) : onAviso(`La membresía vence el ${diaMes(hasta)}`))}
        >
          ›
        </button>
        <label className="n-otra-fecha" title="Elegir otra fecha">
          Otra fecha
          <input
            type="date"
            aria-label="Otra fecha"
            min={desde}
            max={hasta}
            value={fecha}
            onChange={(e) => {
              if (!e.target.value) return;
              if (e.target.value < desde || e.target.value > hasta) return onAviso("Fuera de la vigencia");
              onFecha(e.target.value);
            }}
          />
        </label>
      </div>
      <div className="n-semana" role="group" aria-label="Fecha">
        {fechas.map((f, i) => {
          const fuera = f > hasta || f < desde;
          const marca = fuera ? "Fuera vig." : (marcas?.[i].marca ?? "");
          const motivo = marcas?.[i].motivo ?? "";
          return (
            <button
              key={f}
              type="button"
              className="n-dia"
              aria-pressed={f === fecha}
              data-fuera={fuera}
              title={fuera ? "Fuera de la vigencia de la membresía" : motivo}
              onClick={() => (fuera ? onAviso("Fuera de la vigencia") : onFecha(f))}
            >
              <span className="n-dia__dow">{f === hoy ? "Hoy" : dow(f)}</span>
              <span className="n-dia__n">{Number(f.slice(8, 10))}</span>
              <span className="n-dia__marca">{marca}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
