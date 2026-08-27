"use client";

import { useState, useTransition } from "react";
import type { Catalogo, CatalogoValor } from "@/lib/tipos";
import { agregarValor, actualizarValor } from "./acciones";

export default function ClienteCatalogos({
  catalogos,
  valores,
}: {
  catalogos: Catalogo[];
  valores: CatalogoValor[];
}) {
  const [activo, setActivo] = useState<number>(catalogos[0]?.id ?? 0);
  const catalogo = catalogos.find((c) => c.id === activo);
  const valoresCatalogo = valores
    .filter((v) => v.catalogo_id === activo)
    .sort((a, b) => a.orden - b.orden);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="md:w-64 shrink-0">
        <ul className="space-y-1">
          {catalogos.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActivo(c.id)}
                className={`w-full text-left px-3 py-2 rounded-[var(--radio)] text-base transition-colors ${
                  activo === c.id
                    ? "bg-[var(--primario)] text-[var(--primario-texto)] font-semibold"
                    : "hover:bg-[var(--fondo-elevado)]"
                }`}
              >
                {c.nombre}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1">
        {catalogo && (
          <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio)] p-6">
            <h2 className="text-xl font-semibold">{catalogo.nombre}</h2>
            {catalogo.descripcion && (
              <p className="text-[var(--texto-tenue)] mt-1 mb-4">
                {catalogo.descripcion}
              </p>
            )}

            <div className="divide-y divide-[var(--borde)]">
              {valoresCatalogo.map((v) => (
                <FilaValor key={v.id} valor={v} />
              ))}
              {valoresCatalogo.length === 0 && (
                <p className="text-[var(--texto-tenue)] py-3">
                  Este catálogo no tiene valores todavía.
                </p>
              )}
            </div>

            <NuevoValor catalogoId={catalogo.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function FilaValor({ valor }: { valor: CatalogoValor }) {
  const [etiqueta, setEtiqueta] = useState(valor.etiqueta);
  const [activo, setActivoValor] = useState(valor.activo);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cambiado = etiqueta !== valor.etiqueta || activo !== valor.activo;

  function guardar(nuevoActivo = activo) {
    setError(null);
    startTransition(async () => {
      const res = await actualizarValor(valor.id, etiqueta, nuevoActivo);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="py-3 flex items-center gap-3">
      <input
        value={etiqueta}
        onChange={(e) => setEtiqueta(e.target.value)}
        className="entrada flex-1"
      />
      <button
        onClick={() => {
          const n = !activo;
          setActivoValor(n);
          guardar(n);
        }}
        className={`shrink-0 px-3 py-2 text-sm rounded-[var(--radio)] border ${
          activo
            ? "border-[var(--exito)] text-[var(--exito)]"
            : "border-[var(--borde)] text-[var(--texto-tenue)]"
        }`}
      >
        {activo ? "Activo" : "Inactivo"}
      </button>
      {cambiado && (
        <button
          onClick={() => guardar()}
          disabled={pendiente}
          className="shrink-0 px-3 py-2 text-sm font-semibold rounded-[var(--radio)] bg-[var(--primario)] text-[var(--primario-texto)]"
        >
          Guardar
        </button>
      )}
      {error && <span className="text-[var(--peligro)] text-sm">{error}</span>}
    </div>
  );
}

function NuevoValor({ catalogoId }: { catalogoId: number }) {
  const [etiqueta, setEtiqueta] = useState("");
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function agregar() {
    if (!etiqueta.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await agregarValor(catalogoId, etiqueta);
      if (res?.error) setError(res.error);
      else setEtiqueta("");
    });
  }

  return (
    <div className="mt-5 pt-5 border-t border-[var(--borde)]">
      <div className="flex items-center gap-3">
        <input
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          placeholder="Nuevo valor…"
          className="entrada flex-1"
        />
        <button
          onClick={agregar}
          disabled={pendiente || !etiqueta.trim()}
          className="shrink-0 px-4 py-2 text-base font-semibold rounded-[var(--radio)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-40"
        >
          Agregar
        </button>
      </div>
      {error && (
        <p className="text-[var(--peligro)] text-sm mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
