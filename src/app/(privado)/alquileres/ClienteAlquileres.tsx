"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatearHoras } from "@/lib/horarios";
import { gs } from "@/lib/inscripcion";
import { ETIQUETA_ESTADO_RESERVA, type EstadoReserva } from "@/lib/reservas";
import type { FilaAlquiler } from "./acciones";

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base w-full";

function fecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function ClienteAlquileres({ items }: { items: FilaAlquiler[] }) {
  const [q, setQ] = useState("");
  const visibles = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return items;
    return items.filter((m) => [m.titular, m.planNombre, m.titularWhatsapp ?? ""].some((t) => t.toLowerCase().includes(s)));
  }, [items, q]);

  if (items.length === 0)
    return (
      <p className="text-[var(--texto-tenue)] text-lg">
        No hay alquileres vendidos todavía. Se venden desde Inscribir y cobrar → Alquiler de sala.
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-4">
        <label className="text-base font-medium block mb-2" htmlFor="buscar-alquiler">
          Buscar alquiler
        </label>
        <input id="buscar-alquiler" className={control} placeholder="Titular, WhatsApp o plan" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {visibles.length === 0 ? (
        <p className="text-[var(--texto-tenue)]">Ningún alquiler coincide con “{q.trim()}”.</p>
      ) : (
        <div className="rounded-[var(--radio-panel)] border border-[var(--borde)] divide-y divide-[var(--borde)]">
          {visibles.map((m) => (
            <details key={m.id} className="p-4">
              <summary className="cursor-pointer flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium text-lg">{m.titular}</div>
                  <div className="text-sm">
                    {m.planNombre} · vigente {fecha(m.fechaInicio)} a {fecha(m.fechaFin)}
                  </div>
                  <div className="text-xs text-[var(--texto-tenue)]">
                    {m.saldoCobro > 0 ? `Saldo por cobrar ${gs(m.saldoCobro)}` : "Cobrado"} · {gs(m.precio)}
                  </div>
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  <span className="font-semibold">{formatearHoras(m.disponibleMin / 60)} h</span> de {formatearHoras(m.contratadasMin / 60)} h
                  disponibles
                </div>
              </summary>
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  Categoría: <span className="font-medium">{m.categoria}</span>
                  {m.personas ? ` · ${m.personas} ${m.personas === 1 ? "persona" : "personas"}` : ""}
                  {m.categoriaCambiada ? " · cambiada a mano" : ""}
                </p>
                {m.categoriaMotivo && <p className="text-[var(--texto-tenue)]">{m.categoriaMotivo}</p>}
                {m.categoriaGlosa && <p className="text-[var(--texto-tenue)]">Glosa del cambio: {m.categoriaGlosa}</p>}
                {m.ruta && <p className="text-[var(--texto-tenue)]">Precio: {m.ruta}</p>}
                <Link href={`/alquileres/${m.id}`} className="inline-block text-[var(--primario)] underline hover:no-underline">
                  Gestionar reservas →
                </Link>
                <ul className="space-y-1 pt-1">
                  {m.reservas.map((r) => (
                    <li key={r.id} className="flex justify-between gap-3">
                      <span>
                        {fecha(r.fecha)} {r.hora.slice(0, 5)} · {formatearHoras(r.duracionMin / 60)} h · {r.salaNombre}
                      </span>
                      <span className="text-[var(--texto-tenue)]">{ETIQUETA_ESTADO_RESERVA[r.estado as EstadoReserva] ?? r.estado}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
