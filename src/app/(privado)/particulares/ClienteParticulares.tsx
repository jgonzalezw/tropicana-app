"use client";

import Link from "next/link";
import { formatearHoras } from "@/lib/horarios";

export type FilaParticular = {
  id: number;
  alumnoNombre: string;
  planNombre: string;
  profesorNombre: string;
  fechaFin: string;
  disponibleMin: number;
  solicitadasPorVencer: number;
};

export default function ClienteParticulares({ items }: { items: FilaParticular[] }) {
  if (items.length === 0)
    return (
      <p className="text-[var(--texto-tenue)] text-lg">
        No hay membresías de particulares activas todavía. Se venden desde Inscribir y cobrar → Clase particular.
      </p>
    );

  return (
    <div className="rounded-[var(--radio-panel)] border border-[var(--borde)] divide-y divide-[var(--borde)]">
      {items.map((m) => (
        <Link
          key={m.id}
          href={`/particulares/${m.id}`}
          className="flex items-center justify-between gap-4 p-4 hover:bg-[var(--fondo-elevado)] flex-wrap"
        >
          <div>
            <div className="font-medium">{m.alumnoNombre || `Membresía #${m.id}`}</div>
            <div className="text-sm text-[var(--texto-tenue)]">
              {m.planNombre} · con {m.profesorNombre || "—"} · vence {m.fechaFin}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="tabular-nums">{formatearHoras(m.disponibleMin / 60)} h disponibles</div>
            {m.solicitadasPorVencer > 0 && (
              <div className="text-sm text-[var(--advertencia)]">
                {m.solicitadasPorVencer} {m.solicitadasPorVencer === 1 ? "Solicitada" : "Solicitadas"} por vencer
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
