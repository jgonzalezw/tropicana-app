"use client";

import { useState, useTransition } from "react";
import type { Parametro } from "@/lib/tipos";
import { guardarParametro } from "./acciones";

export default function FilaParametro({ parametro }: { parametro: Parametro }) {
  const [valor, setValor] = useState(parametro.valor);
  const [pendiente, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiado = valor !== parametro.valor;

  function guardar() {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const res = await guardarParametro(parametro.clave, valor);
      if (res?.error) {
        setError(res.error);
      } else {
        setGuardado(true);
        setTimeout(() => setGuardado(false), 2000);
      }
    });
  }

  return (
    <div className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 border-t border-[var(--borde)] first:border-t-0">
      <div className="sm:w-1/2">
        <div className="text-base font-medium">{parametro.nombre}</div>
        {parametro.descripcion && (
          <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
            {parametro.descripcion}
          </div>
        )}
      </div>
      <div className="sm:w-1/2 flex items-center gap-2">
        {parametro.tipo === "booleano" ? (
          <select
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="entrada"
          >
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        ) : (
          <input
            type={parametro.tipo === "numero" ? "number" : "text"}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="entrada"
          />
        )}
        <button
          onClick={guardar}
          disabled={!cambiado || pendiente}
          className="shrink-0 px-4 py-2 text-base font-semibold rounded-[var(--radio)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pendiente ? "…" : guardado ? "✓" : "Guardar"}
        </button>
      </div>
      {error && (
        <p className="text-[var(--peligro)] text-sm w-full" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
