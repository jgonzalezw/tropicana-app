"use client";

import { useState, useTransition } from "react";
import type { Catalogo, CatalogoValor, Estilo } from "@/lib/tipos";
import { agregarValor, actualizarValor, agregarEstilo, actualizarEstilo } from "./acciones";

const ESTILOS = "estilos" as const;

export default function ClienteCatalogos({
  catalogos,
  valores,
  estilos,
}: {
  catalogos: Catalogo[];
  valores: CatalogoValor[];
  estilos: Estilo[];
}) {
  const [activo, setActivo] = useState<number | typeof ESTILOS>(catalogos[0]?.id ?? 0);
  const catalogo = typeof activo === "number" ? catalogos.find((c) => c.id === activo) : undefined;
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
                className={`w-full text-left px-4 py-2.5 rounded-[var(--radio-control)] text-base transition-colors ${
                  activo === c.id
                    ? "bg-[var(--primario)] text-[var(--primario-texto)] font-semibold"
                    : "hover:bg-[var(--fondo-elevado)]"
                }`}
              >
                {c.nombre}
              </button>
            </li>
          ))}
          <li>
            <button
              onClick={() => setActivo(ESTILOS)}
              className={`w-full text-left px-4 py-2.5 rounded-[var(--radio-control)] text-base transition-colors ${
                activo === ESTILOS
                  ? "bg-[var(--primario)] text-[var(--primario-texto)] font-semibold"
                  : "hover:bg-[var(--fondo-elevado)]"
              }`}
            >
              Estilos
            </button>
          </li>
        </ul>
      </div>

      <div className="flex-1">
        {catalogo && (
          <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6">
            <h2 className="text-xl">{catalogo.nombre}</h2>
            {catalogo.descripcion && (
              <p className="text-[var(--texto-tenue)] mt-1 mb-4">
                {catalogo.descripcion}
              </p>
            )}

            <div className="divide-y divide-[var(--borde)]">
              {valoresCatalogo.map((v) => (
                // key incluye el catálogo activo: al cambiar de catálogo la fila
                // se re-monta y no arrastra texto ni error del catálogo anterior.
                <FilaValor key={`${activo}:${v.id}`} valor={v} />
              ))}
              {valoresCatalogo.length === 0 && (
                <p className="text-[var(--texto-tenue)] py-3">
                  Este catálogo no tiene valores todavía.
                </p>
              )}
            </div>

            {/* key por catálogo: limpia el texto tecleado y el mensaje de error
                al cambiar de catálogo (antes se quedaban pegados). */}
            <NuevoValor key={catalogo.id} catalogoId={catalogo.id} />
          </div>
        )}

        {activo === ESTILOS && (
          <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6">
            <h2 className="text-xl">Estilos</h2>
            <p className="text-[var(--texto-tenue)] mt-1 mb-4">
              Estilos o disciplinas de baile, se usa para clasificar cursos, especialidades del
              profesor y tarifas de clases particulares.
            </p>

            <div className="divide-y divide-[var(--borde)]">
              {estilos
                .slice()
                .sort((a, b) => a.orden - b.orden)
                .map((e) => (
                  <FilaEstilo key={e.clave} estilo={e} />
                ))}
              {estilos.length === 0 && (
                <p className="text-[var(--texto-tenue)] py-3">No hay estilos cargados todavía.</p>
              )}
            </div>

            <NuevoEstilo />
          </div>
        )}
      </div>
    </div>
  );
}

function FilaEstilo({ estilo }: { estilo: Estilo }) {
  const [nombre, setNombre] = useState(estilo.nombre);
  const [activo, setActivoEstilo] = useState(estilo.activo);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cambiado = nombre !== estilo.nombre || activo !== estilo.activo;

  function guardar(nuevoActivo = activo) {
    setError(null);
    startTransition(async () => {
      const res = await actualizarEstilo(estilo.clave, nombre, nuevoActivo);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="py-3 flex items-center gap-3">
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="entrada flex-1" />
      <button
        onClick={() => {
          const n = !activo;
          setActivoEstilo(n);
          guardar(n);
        }}
        className={`shrink-0 px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
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
          className="shrink-0 px-4 py-2 text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]"
        >
          Guardar
        </button>
      )}
      {error && <span className="text-[var(--peligro)] text-sm">{error}</span>}
    </div>
  );
}

function NuevoEstilo() {
  const [nombre, setNombre] = useState("");
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function agregar() {
    if (!nombre.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await agregarEstilo(nombre);
      if (res?.error) setError(res.error);
      else setNombre("");
    });
  }

  return (
    <div className="mt-5 pt-5 border-t border-[var(--borde)]">
      <div className="flex items-center gap-3">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()}
          placeholder="Nuevo estilo…"
          className="entrada flex-1"
        />
        <button
          onClick={agregar}
          disabled={pendiente || !nombre.trim()}
          className="shrink-0 px-5 py-2 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-40"
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
        className={`shrink-0 px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
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
          className="shrink-0 px-4 py-2 text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]"
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
          className="shrink-0 px-5 py-2 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-40"
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
