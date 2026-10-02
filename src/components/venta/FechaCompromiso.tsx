"use client";

import { isoFecha } from "@/lib/inscripcion";

/**
 * Hasta cuándo se compromete a pagar el saldo. Se muestra solo si el cobro
 * deja saldo; el tope lo fija el parámetro de días de compromiso. Era una
 * copia en cada flujo de venta; es una sola pieza.
 */
export default function FechaCompromiso({
  valor,
  diasCompromiso,
  onChange,
}: {
  /** "" = la fecha tope (el valor por omisión). */
  valor: string;
  diasCompromiso: number;
  onChange: (iso: string) => void;
}) {
  const hoy = new Date();
  const max = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + Math.max(1, diasCompromiso));
  return (
    <div className="pt-3 mt-3 border-t border-[var(--borde)]">
      <label className="text-sm text-[var(--texto-tenue)] block mb-1.5">Fecha de compromiso de pago del saldo</label>
      <input
        type="date"
        value={valor || isoFecha(max)}
        min={isoFecha(hoy)}
        max={isoFecha(max)}
        onChange={(e) => onChange(e.target.value)}
        className="entrada max-w-[200px]"
      />
    </div>
  );
}

/** La fecha efectiva (con el tope por omisión) para armar el payload del servidor. */
export function fechaCompromisoEfectiva(valor: string, diasCompromiso: number): string {
  if (valor) return valor;
  const hoy = new Date();
  return isoFecha(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + Math.max(1, diasCompromiso)));
}
