"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fechaLarga, gs } from "@/lib/inscripcion";
import {
  eliminarLiquidacionVacia,
  generarLiquidacion,
  registrarPagoLiquidacion,
  type FilaProfesor,
  type FilaLiquidacion,
  type CursoSinRegistrar,
} from "./acciones";

const fmt = (iso: string) => fechaLarga(new Date(iso + "T00:00:00"));

/**
 * Las clases sin registrar del profesor, **comprimidas**.
 *
 * Una línea cerrada con el total, y el detalle por curso al expandir. El
 * problema es del curso y de la fecha: no se nombran ni los planes ni los
 * alumnos, que multiplicaban la lista sin agregar nada (la misma clase puede
 * estar trabando cinco ventas). Javier, 2026-09-12.
 *
 * No desaparece cuando no hay nada: simplemente no se dibuja, porque acá la
 * ausencia sí es un resultado legítimo — no hay clases sin registrar.
 */
function SinRegistrar({ cursos, ventas }: { cursos: CursoSinRegistrar[]; ventas: number }) {
  const [abierto, setAbierto] = useState(false);
  if (cursos.length === 0) return null;
  const clases = cursos.reduce((t, c) => t + c.fechas.length, 0);
  return (
    <div className="mt-1.5 text-sm font-normal">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="text-left text-[var(--peligro-texto)] hover:underline"
      >
        <span aria-hidden className="inline-block w-3">
          {abierto ? "▾" : "▸"}
        </span>{" "}
        {cursos.length} {cursos.length === 1 ? "curso" : "cursos"} · {clases}{" "}
        {clases === 1 ? "clase" : "clases"} sin registrar
        <span className="text-[var(--texto-tenue)]">
          {" "}
          — {ventas} {ventas === 1 ? "venta multi-curso espera" : "ventas multi-curso esperan"}
        </span>
      </button>
      {abierto && (
        <div className="mt-1.5 pl-4 border-l-2 border-[var(--borde)]">
          <ul className="space-y-1">
            {cursos.map((c) => (
              <li key={c.cursoId}>
                <span className="font-medium">{c.curso}</span>{" "}
                <span className="text-[var(--texto-tenue)]">
                  ({c.fechas.length}): {c.fechas.map(fmt).join(", ")}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 text-[var(--texto-tenue)]">
            Cargá la asistencia —o marcá la clase como suspendida— en{" "}
            <Link href="/asistencia" className="underline">
              Asistencia
            </Link>
            .
          </div>
        </div>
      )}
    </div>
  );
}

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
  // El error del pago se muestra EN el panel: el aviso de arriba de la tabla
  // queda lejos de la fila y Javier no lo vio — parecia que el pago se habia
  // deshecho solo.
  const [errorPago, setErrorPago] = useState<string | null>(null);
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

  function borrarVacia(id: number) {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await eliminarLiquidacionVacia(id);
      if (r?.error) setError(r.error);
      else {
        setMsg("Liquidación vacía eliminada.");
        router.refresh();
      }
    });
  }

  function abrirPago(l: FilaLiquidacion) {
    setPagoDe(l.id);
    setMonto(String(Math.max(0, l.totalDevengado - l.totalPagado)));
    setMedio(null);
    setError(null);
    setErrorPago(null);
  }

  function confirmarPago(l: FilaLiquidacion) {
    setError(null);
    startTransition(async () => {
      const r = await registrarPagoLiquidacion({
        liquidacionId: l.id,
        monto: Number(monto.replace(/[^\d.]/g, "")) || 0,
        medio,
      });
      if (r?.error) setErrorPago(r.error);
      else {
        setMsg("Pago registrado.");
        setPagoDe(null);
        setErrorPago(null);
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
                <tr key={p.profesorId} className="border-t border-[var(--borde)] align-top">
                  <td className="py-3 px-4 font-medium">
                    {p.nombre}
                    {/* Regla 17: lo que espera son las ventas multi-curso con
                        clases sin registrar. El resto se liquida igual, así que
                        esto informa, no traba. Colapsado por default: la lista
                        abierta ocupaba trece líneas por profesor. */}
                    <SinRegistrar cursos={p.sinRegistrar} ventas={p.ventasEsperando} />
                  </td>
                  <td className="py-3 px-4 text-right">{p.pendienteCount}</td>
                  <td className="py-3 px-4 text-right font-bold">{gs(p.pendienteMonto)}</td>
                  <td className="py-3 px-4 text-right">
                    {puedeCrear && p.pendienteCount > 0 && (
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
                // Quedó sin comisiones y sin pagos: típicamente porque se
                // corrigió una clase del período y el devengo se revirtió.
                const vacia = l.totalDevengado === 0 && l.totalPagado === 0;
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
                      <SinRegistrar cursos={l.sinRegistrar} ventas={l.ventasEsperando} />
                      {vacia && !desactualizada && (
                        <span className="block text-sm font-normal text-[var(--texto-tenue)]">
                          Quedó sin comisiones: se corrigió una clase del período
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
                          {puedeCrear && vacia && (
                            <button
                              onClick={() => borrarVacia(l.id)}
                              disabled={pendiente}
                              className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] disabled:opacity-40"
                            >
                              Eliminar
                            </button>
                          )}
                          {puedeCrear && restante > 0 && (
                            <button
                              onClick={() => (pagoDe === l.id ? setPagoDe(null) : abrirPago(l))}
                              className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--exito)] text-[var(--exito)]"
                            >
                              {pagoDe === l.id ? "Cancelar" : "Pagar"}
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
                              {pendiente ? "Registrando…" : "Confirmar pago"}
                            </button>
                            {errorPago && (
                              <div
                                role="alert"
                                className="w-full text-sm text-[var(--peligro-texto)] text-right"
                              >
                                {errorPago}
                              </div>
                            )}
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
