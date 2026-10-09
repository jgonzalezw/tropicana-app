"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import DisposicionListaFicha from "@/components/nuevo/DisposicionListaFicha";
import { Chip, FiltroChips } from "@/components/nuevo/Chip";
import {
  filtrarMembresias,
  type FilaMembresia,
  type FiltroEstadoMembresia,
  type TipoMembresia,
} from "@/lib/listaMembresias";
import { ETIQUETA_TIPO, TONO_CHIP, usoTexto } from "../presentacion";

const FILTRO_TIPO: Record<TipoMembresia, string> = {
  regular: "Regulares",
  prueba: "Pruebas",
  particular: "Particulares",
  alquiler: "Alquileres",
};
const ESTADOS: { valor: Exclude<FiltroEstadoMembresia, "todas">; etiqueta: string }[] = [
  { valor: "activas", etiqueta: "Activas" },
  { valor: "por_vencer", etiqueta: "Por vencer" },
  { valor: "con_deuda", etiqueta: "Con deuda" },
  { valor: "solicitudes", etiqueta: "Solicitudes" },
  { valor: "historicas", etiqueta: "Históricas" },
];
export default function ListaMembresias({
  filas,
  tiposVisibles,
  error,
  children,
}: {
  filas: FilaMembresia[];
  tiposVisibles: TipoMembresia[];
  error?: string;
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const { id } = useParams<{ id?: string }>();

  const tipoUrl = params.get("tipo") ?? "todas";
  const tipo = (tiposVisibles as string[]).includes(tipoUrl) ? (tipoUrl as TipoMembresia) : "todas";
  const estadoUrl = params.get("estado") ?? "activas";
  const estado = ESTADOS.some((e) => e.valor === estadoUrl) ? (estadoUrl as FiltroEstadoMembresia) : "activas";
  const [q, setQ] = useState(params.get("q") ?? "");

  // Los filtros y la búsqueda viven en la URL: se comparten y son lo que usarán las redirecciones de la fase 8.
  function enUrl(cambios: Record<string, string | null>) {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    // Historia nativa (sin navegar): la lista ya está cargada y un cambio de filtro no debe competir con un clic en una fila.
    window.history.replaceState(null, "", s ? `${window.location.pathname}?${s}` : window.location.pathname);
  }
  const visibles = useMemo(() => filtrarMembresias(filas, { tipo, estado, q }), [filas, tipo, estado, q]);
  const consulta = params.toString() ? `?${params.toString()}` : "";
  const abierta = id ? filas.find((f) => String(f.id) === id) : undefined;

  const encabezado = (
    <>
      <h1 className="text-lg font-semibold m-0">Membresías</h1>
      <input
        className="n-buscar"
        type="search"
        aria-label="Buscar"
        placeholder="Alumno, WhatsApp, profesor o plan"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          enUrl({ q: e.target.value.trim() || null });
        }}
      />
      {tiposVisibles.length > 1 && (
        <FiltroChips
          etiqueta="Tipo"
          opciones={[{ valor: "todas", etiqueta: "Todas" }, ...tiposVisibles.map((t) => ({ valor: t, etiqueta: FILTRO_TIPO[t] }))]}
          valor={tipo}
          onCambio={(v) => enUrl({ tipo: v === "todas" ? null : v })}
        />
      )}
      <FiltroChips
        etiqueta="Estado"
        opciones={ESTADOS}
        valor={estado}
        onCambio={(v) => enUrl({ estado: v === "activas" ? null : v })}
      />
      <p className="n-nota">Solo ves los tipos que tu rol puede ver.</p>
    </>
  );

  const lista = visibles.length ? (
    visibles.map((f) => (
      <Link
        key={f.id}
        href={`/membresias/${f.id}${consulta}`}
        className="n-fila"
        aria-current={String(f.id) === id ? "true" : undefined}
        data-testid="fila-membresia"
      >
        <div className="n-fila__arriba">
          <span className="n-fila__nombre">
            <span className="n-punto" data-tipo={f.tipo} title={ETIQUETA_TIPO[f.tipo]} />
            <span>{f.titularNombre || "Sin titular"}</span>
          </span>
          <span className="n-fila__uso">{usoTexto(f.uso)}</span>
        </div>
        <div className="n-fila__abajo">
          <span className="n-fila__plan">{f.planNombre}</span>
          <Chip tono={TONO_CHIP[f.chip.clave]} chico>
            {f.chip.texto}
          </Chip>
        </div>
      </Link>
    ))
  ) : null;

  return (
    <DisposicionListaFicha
      encabezado={encabezado}
      filas={error ? <div className="n-lista__vacio n-error" role="alert">{error}</div> : lista}
      vacio="Ninguna membresía coincide con los filtros."
      hrefLista={`/membresias${consulta}`}
      miga={abierta ? `Membresías › ${abierta.titularNombre} · ${abierta.planNombre}` : "Membresías"}
    >
      {children}
    </DisposicionListaFicha>
  );
}
