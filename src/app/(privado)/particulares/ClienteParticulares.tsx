"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatearHoras } from "@/lib/horarios";
import { coincideBusqueda } from "@/lib/contactos";
import type { FilaParticular } from "./acciones";

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base w-full";

/** "25/09/2026" */
function fecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function coincide(q: string, m: FilaParticular): boolean {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return true;
  // Mismo criterio que el buscador de Alumnos (nombre o WhatsApp, también el
  // del tutor de un menor), más lo propio de una membresía particular.
  const partes = m.alumnoNombre.split(" ");
  if (
    coincideBusqueda(q, {
      contacto: { tipo: "persona", nombre: partes[0] ?? "", apellido: partes.slice(1).join(" "), razon_social: null, whatsapp: m.alumnoWhatsapp },
      tutorWhatsapp: m.tutorWhatsapp,
    })
  )
    return true;
  return [m.profesorNombre, m.estilo, m.planNombre].some((t) => t.toLowerCase().includes(s));
}

export default function ClienteParticulares({ items }: { items: FilaParticular[] }) {
  const [q, setQ] = useState("");
  const visibles = useMemo(() => items.filter((m) => coincide(q, m)), [items, q]);

  if (items.length === 0)
    return (
      <p className="text-[var(--texto-tenue)] text-lg">
        No hay membresías de particulares activas todavía. Se venden desde Inscribir y cobrar → Clase particular.
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-4">
        <label className="text-base font-medium block mb-2" htmlFor="buscar-membresia">
          Buscar membresía
        </label>
        <input
          id="buscar-membresia"
          className={control}
          placeholder="Alumno, WhatsApp, profesor, estilo o plan"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {visibles.length === 0 ? (
        <p className="text-[var(--texto-tenue)]">Ninguna membresía activa coincide con “{q.trim()}”.</p>
      ) : (
        <div className="rounded-[var(--radio-panel)] border border-[var(--borde)] divide-y divide-[var(--borde)]">
          {visibles.map((m) => (
            <Link
              key={m.id}
              href={`/particulares/${m.id}`}
              className="flex items-start justify-between gap-4 p-4 hover:bg-[var(--fondo-elevado)] flex-wrap"
            >
              <div className="min-w-0">
                <div className="font-medium text-lg">{m.alumnoNombre || `Membresía #${m.id}`}</div>
                <div className="text-sm">
                  {m.estilo} · {m.profesorNombre || "—"} · vigente {fecha(m.fechaInicio)} a {fecha(m.fechaFin)}
                </div>
                <div className="text-xs text-[var(--texto-tenue)]">{m.planNombre}</div>
                {m.solicitadasVigentes > 0 && (
                  <div className="text-sm font-medium text-[var(--exito)] mt-1">
                    {m.solicitadasVigentes === 1 ? "Reserva solicitada" : `${m.solicitadasVigentes} reservas solicitadas`}{" "}
                    — pendiente de confirmar
                  </div>
                )}
              </div>
              <div className="text-right shrink-0 tabular-nums">
                <span className="font-semibold">{formatearHoras(m.disponibleMin / 60)} h</span> de{" "}
                {formatearHoras(m.contratadasMin / 60)} h disponibles
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
