"use client";

/**
 * Disponibilidad de sala — pantalla operativa (2026-09-17).
 *
 * Muestra TODAS las salas activas a la vez, mirando la misma fecha: Javier
 * pidió explícitamente no tener que elegir una sala por vez para algo que se
 * mira todos los días — "ver las actividades y disponibilidad de las salas...
 * es totalmente cotidiano". El selector de fecha vive acá, una sola vez;
 * cada sala es una tarjeta independiente (`ClienteDisponibilidadSala`).
 */

import { useState } from "react";
import ClienteDisponibilidadSala from "./ClienteDisponibilidadSala";

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base";

export default function ClientePanelSala({
  salas,
  motivos,
  opcionesDuracionMin,
  puedeEditar,
}: {
  salas: { id: number; nombre: string }[];
  motivos: { valor: string; etiqueta: string }[];
  opcionesDuracionMin: number[];
  puedeEditar: boolean;
}) {
  const [fecha, setFecha] = useState(hoyISO());

  if (salas.length === 0) {
    return (
      <p className="text-base text-[var(--texto-tenue)]">
        Todavía no hay ninguna sala activa cargada. Se carga en Administración → Sala y horarios.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-base font-medium">Fecha</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={control} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {salas.map((s) => (
          <ClienteDisponibilidadSala
            key={s.id}
            salaId={s.id}
            salaNombre={s.nombre}
            fecha={fecha}
            motivos={motivos}
            opcionesDuracionMin={opcionesDuracionMin}
            puedeEditar={puedeEditar}
          />
        ))}
      </div>
    </div>
  );
}
