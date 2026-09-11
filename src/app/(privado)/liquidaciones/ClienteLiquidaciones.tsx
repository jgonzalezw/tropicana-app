"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { gs } from "@/lib/inscripcion";
import { generarLiquidacion, registrarPagoLiquidacion, type FilaProfesor, type FilaLiquidacion } from "./acciones";

const ESTADO_LABEL: Record<string, string> = {
  abierta: "Abierta",
  cerrada: "Con pagos",
  pagada: "Pagada",
};

export default function ClienteLiquidaciones({
  profesores,
  liquidaciones,
  medios,
  puedeCrear,
}: {
  profesores: FilaProfesor[];
  liquidaciones: FilaLiquidacion[];
  medios: string[];
  puedeCrear: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estado del pago inline por liquidación.
  const [pagoDe, setPagoDe] = useState<number | null>(null);
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState<string | null>(null);

  function generar(profesorId: number) {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await generarLiquidacion(profesorId);
      if (r?.error) setError(r.error);
      else {
        setMsg("Liquidación generada.");
        router.refresh();
      }
    });
  }

  function abrirPago(l: FilaLiquidacion) {
    setPagoDe(l.id);
    setMonto(String(Math.max(0, l.totalDevengado - l.totalPagado)));
    setMedio(null);
    setError(null);
  }

  function confirmarPago(l: FilaLiquidacion) {
    setError(null);
    startTransition(async () => {
      const r = await registrarPagoLiquidacion({
        liquidacionId: l.id,
        monto: Number(monto.replace(/[^\d.]/g, "")) || 0,
        medio,
      });
      if (r?.error) setError(r.error);
      else {
        setMsg("Pago registrado.");
        setPagoDe(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-8">
      {msg && <p className="text-[var(--exito)] text-base">{msg}</p>}
      {error && <p className="text-[var(--peligro)] text-base" role="alert">{error}</p>}

      {/* Devengado pendiente por profesor */}
      <section>
        <h2 className="text-lg titulo mb-3">Por liquidar</h2>
        <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
                <th className="py-3 px-4 font-medium">Profesor</th>
                <th className="py-3 px-4 font-medium text-right">Membresías</th>
                <th className="py-3 px-4 font-medium text-right">Devengado</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {profesores.map((p) => (
                <tr key={p.profesorId} className="border-t border-[var(--borde)]">
                  <td className="py-3 px-4 font-medium">{p.nombre}</td>
                  <td className="py-3 px-4 text-right">{p.pendienteCount}</td>
                  <td className="py-3 px-4 text-right font-bold">{gs(p.pendienteMonto)}</td>
                  <td className="py-3 px-4 text-right">
                    {puedeCrear && (
                      <button
                        disabled={pendiente}
                        onClick={() => generar(p.profesorId)}
                        className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-40"
                      >
                        Generar liquidación
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {profesores.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 px-4 text-[var(--texto-tenue)]">
                    No hay comisiones pendientes de liquidar (membresías cobradas + completadas).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Liquidaciones */}
      <section>
        <h2 className="text-lg titulo mb-3">Liquidaciones</h2>
        <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
                <th className="py-3 px-4 font-medium">Profesor</th>
                <th className="py-3 px-4 font-medium">Período</th>
                <th className="py-3 px-4 font-medium">Estado</th>
                <th className="py-3 px-4 font-medium text-right">Devengado</th>
                <th className="py-3 px-4 font-medium text-right">Pagado</th>
                <th className="py-3 px-4 font-medium text-right">Neto</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {liquidaciones.map((l) => {
                const restante = Math.max(0, l.totalDevengado - l.totalPagado);
                // Quedaron comisiones fuera de esta liquidación: o nunca
                // entraron, o se dieron de baja porque alguien corrigió una
                // clase del período (regla de negocio 16). Hay que regenerarla,
                // y tiene que verse — si no, se paga de menos sin que nadie lo note.
                const desactualizada = l.pendienteCount > 0;
                return (
                  <tr
                    key={l.id}
                    className={`border-t border-[var(--borde)] align-top ${
                      desactualizada ? "bg-[var(--aviso-fill,var(--fondo-elevado))]" : ""
                    }`}
                  >
                    <td className="py-3 px-4 font-medium">
                      {l.profesor}
                      {desactualizada && (
                        <span className="block text-sm font-normal text-[var(--peligro-texto)]">
                          Cambió: quedan {gs(l.pendienteMonto)} sin incluir
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[var(--texto-tenue)]">
                      {l.periodo} · {l.periodicidad}
                    </td>
                    <td className="py-3 px-4">{ESTADO_LABEL[l.estado] ?? l.estado}</td>
                    <td className="py-3 px-4 text-right">{gs(l.totalDevengado)}</td>
                    <td className="py-3 px-4 text-right">{gs(l.totalPagado)}</td>
                    <td className="py-3 px-4 text-right font-bold">{gs(restante)}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                          <Link
                            href={`/liquidaciones/${l.id}`}
                            className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
                          >
                            Comprobante
                          </Link>
                          {puedeCrear && desactualizada && (
                            <button
                              onClick={() => generar(l.profesorId)}
                              disabled={pendiente}
                              className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--peligro)] text-[var(--peligro-texto)] font-semibold disabled:opacity-40"
                            >
                              Regenerar
                            </button>
                          )}
                          {puedeCrear && restante > 0 && (
                            <button
                              onClick={() => (pagoDe === l.id ? setPagoDe(null) : abrirPago(l))}
                              className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--exito)] text-[var(--exito)]"
                            >
                              Pagar
                            </button>
                          )}
                        </div>
                        {pagoDe === l.id && (
                          <div className="flex flex-wrap items-center gap-2 justify-end">
                            <input
                              value={monto}
                              onChange={(e) => setMonto(e.target.value)}
                              inputMode="decimal"
                              className="entrada max-w-[110px]"
                              placeholder="Monto"
                            />
                            <select
                              value={medio ?? ""}
                              onChange={(e) => setMedio(e.target.value || null)}
                              className="entrada max-w-[150px]"
                            >
                              <option value="">Medio…</option>
                              {medios.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                            <button
                              disabled={pendiente}
                              onClick={() => confirmarPago(l)}
                              className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-40"
                            >
                              Confirmar pago
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {liquidaciones.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 px-4 text-[var(--texto-tenue)]">
                    Todavía no hay liquidaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
