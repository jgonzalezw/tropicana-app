"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MovimientoCaja from "@/components/MovimientoCaja";
import { etiquetaMotivo, type EntradaMovimiento, type LineaPendiente } from "@/lib/caja";
import { gs } from "@/lib/inscripcion";
import { registrarMovimiento } from "./acciones";

type Movimiento = {
  id: number;
  tipo: string;
  motivo: string | null;
  monto: number;
  descuento: number;
  medio: string | null;
  glosa: string | null;
  fecha: string;
  /** A quién le corresponde: alumno o profesor del pago. */
  sujeto: string | null;
  /** Qué lo originó: el plan o curso de la membresía, si vino de una. */
  detalle: string | null;
};

export default function ClienteCaja({
  lineas,
  motivosIngreso,
  motivosEgreso,
  medios,
  diasCompromiso,
  puedeRegistrar,
  saldo,
  movimientos,
}: {
  lineas: LineaPendiente[];
  motivosIngreso: string[];
  motivosEgreso: string[];
  medios: string[];
  diasCompromiso: number;
  puedeRegistrar: boolean;
  saldo: { efectivo: number; banco: number };
  movimientos: Movimiento[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const porCobrar = lineas.reduce((t, l) => t + l.saldo, 0);
  const total = saldo.efectivo + saldo.banco;

  async function guardar(m: EntradaMovimiento) {
    const res = await registrarMovimiento(m);
    if (res.ok) router.refresh();
    return res;
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto pb-20">
      <div className="mb-5">
        <h1 className="text-3xl">Caja</h1>
        <p className="text-base text-[var(--texto-tenue)] mt-1">
          Todo se calcula desde los cobros y pagos del sistema.
        </p>
      </div>

      {/* Saldo + acceso al movimiento */}
      <div className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-6 mb-4 flex flex-wrap items-end gap-6">
        <div className="flex-1 min-w-[220px]">
          <div className="text-sm uppercase tracking-wider text-[var(--primario)] font-semibold">
            Saldo en caja
          </div>
          <div className="titulo text-5xl mt-1 tabular-nums">{gs(total)}</div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="whitespace-nowrap px-3 py-1.5 text-sm rounded-[var(--radio-control)] bg-[var(--fondo-elevado)]">
              Efectivo {gs(saldo.efectivo)}
            </span>
            <span className="whitespace-nowrap px-3 py-1.5 text-sm rounded-[var(--radio-control)] bg-[var(--fondo-elevado)]">
              QR / banco {gs(saldo.banco)}
            </span>
          </div>
        </div>
        {puedeRegistrar && !abierto && (
          <button
            onClick={() => setAbierto(true)}
            className="px-5 py-3.5 text-lg font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)]"
          >
            + Registrar movimiento
          </button>
        )}
      </div>

      {abierto && (
        <div className="mb-4">
          <MovimientoCaja
            motivosIngreso={motivosIngreso}
            motivosEgreso={motivosEgreso}
            lineas={lineas}
            medios={medios}
            diasCompromiso={diasCompromiso}
            onGuardar={guardar}
            onCancelar={() => setAbierto(false)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Por cobrar */}
        <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <h2 className="titulo text-xl">Por cobrar</h2>
            <span className="titulo text-xl tabular-nums text-[var(--peligro)]">{gs(porCobrar)}</span>
          </div>
          <p className="text-sm text-[var(--texto-tenue)] mb-3">
            Cada cobro que registrás descuenta de estas deudas.
          </p>
          {lineas.length === 0 ? (
            <p className="text-base text-[var(--texto-tenue)]">No hay deudas abiertas.</p>
          ) : (
            <ul className="divide-y divide-[var(--borde)]">
              {lineas.map((l) => (
                <li key={l.clave} className="py-2.5 flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-base font-medium truncate">{l.sujeto}</span>
                    <span className="block text-sm text-[var(--texto-tenue)] truncate">{l.detalle}</span>
                  </span>
                  <span className="shrink-0 text-base tabular-nums text-[var(--peligro)]">{gs(l.saldo)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Últimos movimientos */}
        <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
          <h2 className="titulo text-xl mb-3">Últimos movimientos</h2>
          {movimientos.length === 0 ? (
            <p className="text-base text-[var(--texto-tenue)]">Todavía no hay movimientos.</p>
          ) : (
            <ul className="divide-y divide-[var(--borde)]">
              {movimientos.map((m) => {
                const entra = m.tipo === "cobro";
                return (
                  <li key={m.id} className="py-2.5 flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-base font-medium truncate">
                        {m.sujeto ?? etiquetaMotivo(m.motivo ?? "otro")}
                      </span>
                      <span className="block text-sm text-[var(--texto-tenue)] truncate">
                        {[
                          m.sujeto ? etiquetaMotivo(m.motivo ?? "otro") : null,
                          m.detalle,
                          m.glosa,
                          m.medio,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {" · "}
                        {new Date(m.fecha).toLocaleDateString("es-BO")}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-base tabular-nums ${
                        entra ? "text-[var(--exito)]" : "text-[var(--peligro)]"
                      }`}
                    >
                      {entra ? "+" : "−"} {gs(m.monto)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
