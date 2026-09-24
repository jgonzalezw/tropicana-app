"use client";

import { useState, useTransition } from "react";
import type {
  CampoMinimo,
  Catalogo,
  CatalogoValor,
  ContextoMinimo,
  Estilo,
  MatrizMinimo,
  NivelMinimo,
} from "@/lib/tipos";
import {
  CONTEXTOS_MINIMO,
  CAMPOS_MINIMO,
  ETIQUETA_CONTEXTO_MINIMO,
  ETIQUETA_CAMPO_MINIMO,
  ETIQUETA_NIVEL_MINIMO,
} from "@/lib/tipos";
import { celdaBloqueada, CAMPOS_SIN_ALMACENAMIENTO } from "@/lib/matrizMinimos";
import {
  agregarValor,
  actualizarValor,
  agregarEstilo,
  actualizarEstilo,
  fijarNivelMinimo,
} from "./acciones";

const SIN_ALMACENAMIENTO_MOTIVO =
  "Todavía no tiene dónde guardarse (C3-0a.3): cambiar esta celda no tendría efecto.";

const ESTILOS = "estilos" as const;
const MATRIZ = "matriz" as const;

export default function ClienteCatalogos({
  catalogos,
  valores,
  estilos,
  matriz,
}: {
  catalogos: Catalogo[];
  valores: CatalogoValor[];
  estilos: Estilo[];
  matriz: MatrizMinimo[];
}) {
  const [activo, setActivo] = useState<number | typeof ESTILOS | typeof MATRIZ>(catalogos[0]?.id ?? 0);
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
          <li>
            <button
              onClick={() => setActivo(MATRIZ)}
              className={`w-full text-left px-4 py-2.5 rounded-[var(--radio-control)] text-base transition-colors ${
                activo === MATRIZ
                  ? "bg-[var(--primario)] text-[var(--primario-texto)] font-semibold"
                  : "hover:bg-[var(--fondo-elevado)]"
              }`}
            >
              Matriz de mínimos
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

        {activo === MATRIZ && <SeccionMatrizMinimos matriz={matriz} />}
      </div>
    </div>
  );
}

function celdaClase(nivel: NivelMinimo, bloqueada = false) {
  const base = "w-8 h-8 rounded-[10px] border-2 text-sm font-bold transition-colors disabled:opacity-40";
  if (bloqueada) return `${base} border-[var(--borde)] text-[var(--texto-tenue)] cursor-not-allowed`;
  if (nivel === "O")
    return `${base} bg-[var(--primario)] border-[var(--primario)] text-[var(--primario-texto)]`;
  if (nivel === "V") return `${base} border-[var(--primario)] text-[var(--primario)]`;
  return `${base} border-[var(--borde)] text-[var(--texto-tenue)]`;
}

function Leyenda({ nivel }: { nivel: NivelMinimo }) {
  const colorClase =
    nivel === "O"
      ? "bg-[var(--primario)]"
      : nivel === "V"
        ? "border-2 border-[var(--primario)]"
        : "border-2 border-[var(--borde)]";
  return (
    <span className="flex items-center gap-1.5 text-[var(--texto-tenue)]">
      <span className={`w-4 h-4 rounded-[6px] ${colorClase}`} />
      {ETIQUETA_NIVEL_MINIMO[nivel]}
    </span>
  );
}

function SeccionMatrizMinimos({ matriz }: { matriz: MatrizMinimo[] }) {
  const inicial = new Map<string, NivelMinimo>();
  for (const m of matriz) inicial.set(`${m.contexto}:${m.campo}`, m.nivel);

  const [estado, setEstado] = useState(inicial);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ciclar(contexto: ContextoMinimo, campo: CampoMinimo) {
    if (celdaBloqueada(contexto, campo) || CAMPOS_SIN_ALMACENAMIENTO.includes(campo)) return;
    const clave = `${contexto}:${campo}`;
    const actualNivel = estado.get(clave) ?? "-";
    const siguiente: NivelMinimo =
      actualNivel === "O" ? "V" : actualNivel === "V" ? "-" : "O";
    setEstado((prev) => new Map(prev).set(clave, siguiente));
    setError(null);
    startTransition(async () => {
      const res = await fijarNivelMinimo(contexto, campo, siguiente);
      if (res?.error) {
        setError(res.error);
        setEstado((prev) => new Map(prev).set(clave, actualNivel));
      }
    });
  }

  return (
    <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6">
      <h2 className="text-xl">Matriz de mínimos</h2>
      <p className="text-[var(--texto-tenue)] mt-1 mb-4">
        Qué tan obligatorio es cada campo según el contexto en que se carga un contacto.
        Clic en una celda para pasar de Obligatorio a Visible a Oculto.
      </p>

      <div className="flex gap-4 mb-4 flex-wrap text-sm">
        <Leyenda nivel="O" />
        <Leyenda nivel="V" />
        <Leyenda nivel="-" />
      </div>

      <div className="overflow-x-auto">
        <table className="text-left border-collapse">
          <thead>
            <tr>
              <th className="py-2 px-3 sticky left-0 bg-[var(--fondo-panel)]" />
              {CONTEXTOS_MINIMO.map((c) => (
                <th
                  key={c}
                  className="py-2 px-2 text-xs font-medium text-[var(--texto-tenue)] text-center whitespace-nowrap"
                >
                  {ETIQUETA_CONTEXTO_MINIMO[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAMPOS_MINIMO.map((campo) => (
              <tr key={campo} className="border-t border-[var(--borde)]">
                <td className="py-2 px-3 text-sm font-medium sticky left-0 bg-[var(--fondo-panel)] whitespace-nowrap">
                  {ETIQUETA_CAMPO_MINIMO[campo]}
                </td>
                {CONTEXTOS_MINIMO.map((contexto) => {
                  const nivel = estado.get(`${contexto}:${campo}`) ?? "-";
                  const bloqueo = celdaBloqueada(contexto, campo);
                  const sinAlmacenamiento = CAMPOS_SIN_ALMACENAMIENTO.includes(campo);
                  const motivo = bloqueo?.motivo ?? (sinAlmacenamiento ? SIN_ALMACENAMIENTO_MOTIVO : null);
                  return (
                    <td key={contexto} className="py-2 px-2 text-center">
                      <button
                        onClick={() => ciclar(contexto, campo)}
                        disabled={pendiente || !!motivo}
                        aria-label={`${ETIQUETA_CAMPO_MINIMO[campo]} en ${ETIQUETA_CONTEXTO_MINIMO[contexto]}: ${ETIQUETA_NIVEL_MINIMO[nivel]}${motivo ? ` — ${motivo}` : ""}`}
                        title={motivo ?? ETIQUETA_NIVEL_MINIMO[nivel]}
                        className={celdaClase(nivel, !!motivo)}
                      >
                        {motivo ? "🔒" : nivel === "-" ? "–" : nivel}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-[var(--texto-tenue)] mt-3">
        🔒 = no editable: de una lógica del sistema, o todavía sin dónde guardarse (pasá el mouse para el motivo).
      </p>

      {error && (
        <p className="text-[var(--peligro)] text-base mt-4" role="alert">
          {error}
        </p>
      )}
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
