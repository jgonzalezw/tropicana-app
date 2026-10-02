"use client";

import { useState } from "react";
import AvisoWhatsapp from "@/components/AvisoWhatsapp";

export type AvisoVenta = { nombre: string; whatsapp: string | null; mensaje: string };

/**
 * La tarjeta que cierra toda venta (D9): qué se vendió, en una grilla de
 * datos específicos —plan, monto, cursos, fecha de la primera clase...—, con
 * los avisos de WhatsApp listos (regla de proceso 12) y Copiar como respaldo.
 * Lo que muestra viene de lo guardado, no de lo que había en la pantalla.
 */
export default function ConfirmacionVenta({
  titulo = "Venta registrada",
  datos,
  avisos = [],
  onNueva,
}: {
  titulo?: string;
  datos: { etiqueta: string; valor: string }[];
  avisos?: AvisoVenta[];
  onNueva: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const texto = `${titulo}\n${datos.map((d) => `${d.etiqueta}: ${d.valor}`).join("\n")}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="rounded-[var(--radio-panel)] bg-[var(--exito-fill)] text-[var(--exito-texto)] p-5 space-y-4" role="status">
      <h2 className="titulo text-xl">{titulo}</h2>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-base">
        {datos.map((d) => (
          <div key={d.etiqueta}>
            <dt className="text-sm opacity-80">{d.etiqueta}</dt>
            <dd className="font-medium">{d.valor}</dd>
          </div>
        ))}
      </dl>
      {avisos.length > 0 && (
        <div className="space-y-3">
          {avisos.map((a, i) => (
            <AvisoWhatsapp key={i} nombre={a.nombre} whatsapp={a.whatsapp} mensaje={a.mensaje} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copiar} className="px-4 py-2 text-sm rounded-[var(--radio-control)] border border-current">
          {copiado ? "Copiado" : "Copiar resumen"}
        </button>
        <button type="button" onClick={onNueva} className="px-4 py-2 text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]">
          Nueva venta
        </button>
      </div>
    </div>
  );
}
