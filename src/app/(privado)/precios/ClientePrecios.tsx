"use client";

/**
 * Precios y paquetes — cinco bloques, una pantalla (N29 del handoff de diseño).
 *
 * **Por qué es una sola pantalla y no cinco destinos.** El bloque D resuelve su
 * costo de sala contra el bloque E, y A y C son dos tablas por curso que se
 * comparan de al lado. Cinco destinos convertían una sesión de edición en cinco
 * navegaciones y escondían la dependencia.
 *
 * **Las celdas son inputs siempre visibles, sin modo edición** (N30): el
 * gerente edita una columna entera de una pasada.
 *
 * **Una celda vacía se marca, no se esconde** (N31): vacío significa "no
 * cargado", que **no** es cero. En el bloque A decide si el curso cobra el
 * mensual completo; en el E, si la sala se puede liquidar.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Curso } from "@/lib/tipos";
import { rangoHorario } from "@/lib/horarios";
import {
  costoDeSala,
  tamanoPorPersonas,
  ETIQUETA_CATEGORIA,
  type CategoriaSala,
  type ClaveTamano,
  type TamanoSala,
} from "@/lib/sala";
import { guardarPrecios } from "./acciones";

type TarifasPorCurso = Record<number, Record<string, number | null>>;
type Descuento = { meses: number; porcentaje: number };
type Paquete = {
  id: number | null;
  nombre: string;
  estilo: string;
  horas: number;
  precio: number;
  activo: boolean;
};
type FilaHoras = { id: number | null; horas: number; orden: number };
type CeldaSala = { categoria: string; tamano: string; horas: number; precio: number | null };

const CATEGORIAS: CategoriaSala[] = [
  "alumno",
  "profesor_tropicana",
  "profesor_externo",
  "tercero",
];

/** La consecuencia de cada categoría, escrita al lado (N38: no es decoración). */
const NOTA_CATEGORIA: Record<CategoriaSala, string> = {
  alumno: "Lo que paga un alumno que alquila la sala por su cuenta.",
  profesor_tropicana:
    "Con esta tarifa entra un profesor Activo. Es la que se le descuenta de su liquidación cuando dicta una clase particular, y es más barata que la del externo para el mismo tamaño y paquete.",
  profesor_externo:
    "Un profesor Externo paga más que un Activo por el mismo tamaño y paquete. Solo alquila la sala: no es titular de ningún curso.",
  tercero: "Alguien de afuera de la escuela. No entra al padrón: queda como nombre en el movimiento de caja.",
};

/** Solo dígitos; vacío queda vacío (que no es cero). */
function soloNum(v: string): string {
  return v.replace(/[^0-9]/g, "");
}
/** Admite decimales para las horas (media hora es un valor legítimo). */
function soloHoras(v: string): string {
  return v.replace(/[^0-9.,]/g, "").replace(",", ".");
}
const aNum = (v: string): number | null => (v.trim() === "" ? null : Number(v));

export default function ClientePrecios({
  cursos,
  tarifas,
  descuentos,
  paquetes,
  usoPorPaquete,
  tamanos,
  horasPaquete,
  usoPorHoras,
  precios,
  especialidades,
}: {
  cursos: Curso[];
  tarifas: TarifasPorCurso;
  descuentos: Descuento[];
  paquetes: { id: number; nombre: string; estilo: string; horas: number; precio: number; activo: boolean }[];
  usoPorPaquete: Record<number, number>;
  tamanos: { clave: string; etiqueta: string; max_personas: number; orden: number }[];
  horasPaquete: { id: number; horas: number; orden: number }[];
  usoPorHoras: Record<number, number>;
  precios: CeldaSala[];
  especialidades: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"a" | "b" | "c" | "d" | "e">("a");
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El estado arranca como copia de lo que vino del servidor; "Descartar" es
  // volver a montar desde ahí.
  const [gen, setGen] = useState(0);
  const inicial = useMemo(
    () => ({
      tarifas: JSON.parse(JSON.stringify(tarifas)) as TarifasPorCurso,
      descuentos: descuentos.map((d) => ({ ...d })),
      paquetes: paquetes.map((p) => ({ ...p })) as Paquete[],
      tamanos: tamanos.map((t) => ({ ...t })),
      horas: horasPaquete.map((h) => ({ ...h })) as FilaHoras[],
      precios: precios.map((p) => ({ ...p })),
    }),
    // `gen` fuerza el reinicio al descartar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gen, tarifas, descuentos, paquetes, tamanos, horasPaquete, precios]
  );

  const [tarifasEd, setTarifasEd] = useState<TarifasPorCurso>(inicial.tarifas);
  const [descEd, setDescEd] = useState<Descuento[]>(inicial.descuentos);
  const [paqEd, setPaqEd] = useState<Paquete[]>(inicial.paquetes);
  const [paqBorrados, setPaqBorrados] = useState<number[]>([]);
  const [tamEd, setTamEd] = useState(inicial.tamanos);
  const [horasEd, setHorasEd] = useState<FilaHoras[]>(inicial.horas);
  const [horasBorradas, setHorasBorradas] = useState<number[]>([]);
  const [preciosEd, setPreciosEd] = useState<CeldaSala[]>(inicial.precios);
  const [cat, setCat] = useState<CategoriaSala>("alumno");

  const sucio =
    JSON.stringify({
      t: tarifasEd,
      d: descEd,
      p: paqEd,
      pb: paqBorrados,
      tm: tamEd,
      h: horasEd,
      hb: horasBorradas,
      pr: preciosEd,
    }) !==
    JSON.stringify({
      t: inicial.tarifas,
      d: inicial.descuentos,
      p: inicial.paquetes,
      pb: [],
      tm: inicial.tamanos,
      h: inicial.horas,
      hb: [],
      pr: inicial.precios,
    });

  function descartar() {
    setTarifasEd(JSON.parse(JSON.stringify(tarifas)));
    setDescEd(descuentos.map((d) => ({ ...d })));
    setPaqEd(paquetes.map((p) => ({ ...p })));
    setPaqBorrados([]);
    setTamEd(tamanos.map((t) => ({ ...t })));
    setHorasEd(horasPaquete.map((h) => ({ ...h })));
    setHorasBorradas([]);
    setPreciosEd(precios.map((p) => ({ ...p })));
    setGen((n) => n + 1);
    setMsg(null);
    setError(null);
  }

  function guardar() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await guardarPrecios({
        cursos: cursos.map((c) => ({
          cursoId: c.id,
          clase: tarifasEd[c.id]?.clase ?? null,
          semana: tarifasEd[c.id]?.semana ?? null,
          medio_mes: tarifasEd[c.id]?.medio_mes ?? null,
          prueba: tarifasEd[c.id]?.prueba ?? null,
        })),
        descuentos: descEd,
        paquetes: paqEd,
        paquetesEliminados: paqBorrados,
        sala: {
          tamanos: tamEd.map((t) => ({ clave: t.clave, max_personas: t.max_personas })),
          horas: horasEd.map((h) => ({ id: h.id, horas: h.horas })),
          precios: preciosEd,
        },
        horasEliminadas: horasBorradas,
      });
      if (r.error) setError(r.error);
      else {
        setMsg(
          "Guardado. Los precios nuevos rigen desde ahora; lo ya vendido conserva el precio de su venta."
        );
        setPaqBorrados([]);
        setHorasBorradas([]);
        router.refresh();
      }
    });
  }

  const setTarifa = (cursoId: number, modalidad: string, v: string) =>
    setTarifasEd((prev) => ({
      ...prev,
      [cursoId]: { ...(prev[cursoId] ?? {}), [modalidad]: aNum(soloNum(v)) },
    }));

  const precioDe = (categoria: string, tamano: string, horas: number) =>
    preciosEd.find(
      (p) => p.categoria === categoria && p.tamano === tamano && Number(p.horas) === Number(horas)
    )?.precio ?? null;

  const setPrecio = (categoria: string, tamano: string, horas: number, v: string) => {
    const precio = aNum(soloNum(v));
    setPreciosEd((prev) => {
      const i = prev.findIndex(
        (p) => p.categoria === categoria && p.tamano === tamano && Number(p.horas) === Number(horas)
      );
      if (i === -1) return [...prev, { categoria, tamano, horas, precio }];
      const copia = [...prev];
      copia[i] = { ...copia[i], precio };
      return copia;
    });
  };

  const tamanosSala: TamanoSala[] = tamEd.map((t) => ({
    clave: t.clave as ClaveTamano,
    etiqueta: t.etiqueta,
    max_personas: t.max_personas,
    orden: t.orden,
  }));

  const cursosOrd = [...cursos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="pb-28">
      {/* Pestañas: el bloque activo, no cinco destinos del menú (N29). */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
            ["a", "Inscripción parcial"],
            ["b", "Meses adelantados"],
            ["c", "Clase de prueba"],
            ["d", "Clases particulares"],
            ["e", "Alquiler de sala"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-base rounded-[var(--radio-control)] border ${
              tab === k
                ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                : "border-[var(--borde)] hover:border-[var(--primario)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "a" && (
        <Bloque
          titulo="Inscripción parcial por curso"
          bajada="Cada modalidad tiene su propia tarifa: no es un porcentaje de la cuota mensual. Un curso sin tarifa para una modalidad cobra el mensual completo — por eso una celda vacía se marca en vez de esconderse."
        >
          <TablaCursos
            cursos={cursosOrd}
            columnas={[
              ["clase", "Una clase"],
              ["semana", "Una semana"],
              ["medio_mes", "Medio mes"],
            ]}
            tarifas={tarifasEd}
            onChange={setTarifa}
          />
        </Bloque>
      )}

      {tab === "b" && (
        <Bloque
          titulo="Descuento por meses adelantados"
          bajada="Se cruza por cantidad exacta de meses y no se interpola: 4 meses con una tabla de 2, 3 y 6 no lleva descuento."
        >
          <div className="max-w-md">
            <table className="w-full text-left">
              <thead>
                <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
                  <th className="py-2 pr-4 font-medium">Meses</th>
                  <th className="py-2 pr-4 font-medium text-right">%Descuento</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {descEd.map((d, i) => (
                  <tr key={i} className="border-t border-[var(--borde)]">
                    <td className="py-2 pr-4">
                      <Celda
                        valor={String(d.meses)}
                        onChange={(v) =>
                          setDescEd((p) =>
                            p.map((x, j) => (j === i ? { ...x, meses: Number(soloNum(v) || 0) } : x))
                          )
                        }
                      />
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Celda
                        valor={String(d.porcentaje)}
                        onChange={(v) =>
                          setDescEd((p) =>
                            p.map((x, j) =>
                              j === i ? { ...x, porcentaje: Number(soloNum(v) || 0) } : x
                            )
                          )
                        }
                      />
                    </td>
                    <td className="py-2">
                      <button
                        className="text-sm text-[var(--texto-tenue)] hover:text-[var(--peligro)]"
                        onClick={() => setDescEd((p) => p.filter((_, j) => j !== i))}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="mt-3 px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
              onClick={() => setDescEd((p) => [...p, { meses: 2, porcentaje: 5 }])}
            >
              + Agregar tramo
            </button>
          </div>
        </Bloque>
      )}

      {tab === "c" && (
        <Bloque
          titulo="Clase de prueba por curso"
          bajada="El precio es por alumno, y es explícitamente por curso: una prueba de Heels no vale lo que una de Zumba. Sin precio cargado, la prueba de ese curso no se puede vender."
        >
          <TablaCursos
            cursos={cursosOrd}
            columnas={[["prueba", "Precio por alumno"]]}
            tarifas={tarifasEd}
            onChange={setTarifa}
          />
        </Bloque>
      )}

      {tab === "d" && (
        <Bloque
          titulo="Paquetes de clases particulares"
          bajada="El precio es del paquete, no por persona: las mismas horas cuestan lo mismo las tome un alumno o una pareja. El costo de sala no se carga acá — se busca en Alquiler de sala."
        >
          <table className="w-full text-left">
            <thead>
              <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
                <th className="py-2 pr-4 font-medium">Paquete</th>
                <th className="py-2 pr-4 font-medium">Estilo</th>
                <th className="py-2 pr-4 font-medium text-right">Horas</th>
                <th className="py-2 pr-4 font-medium text-right">Precio al alumno</th>
                <th className="py-2 pr-4 font-medium">Uso</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {paqEd.map((p, i) => {
                const uso = p.id ? usoPorPaquete[p.id] ?? 0 : 0;
                return (
                  <tr
                    key={p.id ?? `nuevo-${i}`}
                    className={`border-t border-[var(--borde)] ${p.activo ? "" : "opacity-50"}`}
                  >
                    <td className="py-2 pr-4">
                      <Celda
                        ancho="w-44"
                        valor={p.nombre}
                        crudo
                        onChange={(v) =>
                          setPaqEd((x) => x.map((q, j) => (j === i ? { ...q, nombre: v } : q)))
                        }
                      />
                    </td>
                    <td className="py-2 pr-4">
                      {/* Regla de calidad 6: un valor con alternativas se elige,
                          nunca se escribe a mano. */}
                      <select
                        className="px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base"
                        value={p.estilo}
                        onChange={(e) =>
                          setPaqEd((x) =>
                            x.map((q, j) => (j === i ? { ...q, estilo: e.target.value } : q))
                          )
                        }
                      >
                        <option value="">Elegí el estilo</option>
                        {especialidades.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Celda
                        valor={String(p.horas ?? "")}
                        onChange={(v) =>
                          setPaqEd((x) =>
                            x.map((q, j) =>
                              j === i ? { ...q, horas: Number(soloHoras(v) || 0) } : q
                            )
                          )
                        }
                      />
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Celda
                        valor={p.precio == null ? "" : String(p.precio)}
                        onChange={(v) =>
                          setPaqEd((x) =>
                            x.map((q, j) =>
                              j === i ? { ...q, precio: Number(soloNum(v) || 0) } : q
                            )
                          )
                        }
                      />
                    </td>
                    <td className="py-2 pr-4 text-sm text-[var(--texto-tenue)]">
                      {uso === 0 ? "Sin uso" : `${uso} ${uso === 1 ? "venta" : "ventas"}`}
                    </td>
                    <td className="py-2">
                      <button
                        className="text-sm text-[var(--texto-tenue)] hover:text-[var(--peligro)]"
                        onClick={() => {
                          if (p.id && uso > 0) {
                            setPaqEd((x) =>
                              x.map((q, j) => (j === i ? { ...q, activo: !q.activo } : q))
                            );
                          } else {
                            if (p.id) setPaqBorrados((b) => [...b, p.id!]);
                            setPaqEd((x) => x.filter((_, j) => j !== i));
                          }
                        }}
                      >
                        {p.id && uso > 0 ? (p.activo ? "Desactivar" : "Activar") : "Eliminar"}
                      </button>
                      {/* El motivo va al lado del botón, siempre visible: nunca
                          un tooltip ni un aviso después de un clic fallido (N32). */}
                      {p.id && uso > 0 && (
                        <div className="text-xs text-[var(--texto-tenue)] max-w-[22ch] mt-1">
                          {p.activo
                            ? "No se puede eliminar: ya se vendió a este precio."
                            : "Inactivo: no se ofrece en ventas nuevas."}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            className="mt-3 px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
            onClick={() =>
              setPaqEd((p) => [
                ...p,
                { id: null, nombre: "", estilo: "", horas: 1, precio: 0, activo: true },
              ])
            }
          >
            + Agregar paquete
          </button>
        </Bloque>
      )}

      {tab === "e" && (
        <BloqueSala
          cat={cat}
          setCat={setCat}
          tamEd={tamEd}
          setTamEd={setTamEd}
          horasEd={horasEd}
          setHorasEd={setHorasEd}
          setHorasBorradas={setHorasBorradas}
          usoPorHoras={usoPorHoras}
          precioDe={precioDe}
          setPrecio={setPrecio}
          tamanosSala={tamanosSala}
          preciosEd={preciosEd}
          paquetes={paqEd}
        />
      )}

      {/* Barra de acción fija: el estado de los cambios y las dos salidas. */}
      <div className="fixed left-0 right-0 bottom-0 bg-[var(--fondo-panel)] border-t border-[var(--borde)] px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[16rem] text-base">
            {error ? (
              <span className="text-[var(--peligro)]">{error}</span>
            ) : msg ? (
              <span className="text-[var(--exito)]">{msg}</span>
            ) : (
              <span className="text-[var(--texto-tenue)]">
                {sucio ? "Hay cambios sin guardar." : "Sin cambios pendientes."}
              </span>
            )}
          </div>
          <button
            onClick={descartar}
            disabled={!sucio || pendiente}
            className="px-4 py-2 text-base rounded-[var(--radio-control)] border border-[var(--borde)] disabled:opacity-45"
          >
            Descartar
          </button>
          <button
            onClick={guardar}
            disabled={!sucio || pendiente}
            className="px-5 py-2 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-45"
          >
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────

function Bloque({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 overflow-x-auto">
      <h2 className="text-xl font-semibold">{titulo}</h2>
      <p className="text-sm text-[var(--texto-tenue)] mt-1 mb-4 max-w-[72ch]">{bajada}</p>
      {children}
    </div>
  );
}

/**
 * Una celda editable. `vacio` la marca como **no cargada**, que no es cero —
 * es la diferencia que decide si una modalidad cae al mensual (N31).
 */
function Celda({
  valor,
  onChange,
  crudo,
  ancho = "w-24",
}: {
  valor: string;
  onChange: (v: string) => void;
  crudo?: boolean;
  ancho?: string;
}) {
  const vacio = !crudo && valor.trim() === "";
  return (
    <input
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={crudo ? "" : "—"}
      inputMode={crudo ? undefined : "numeric"}
      className={`${ancho} px-3 py-2 rounded-[var(--radio-control)] border text-base bg-[var(--fondo)] ${
        crudo ? "" : "text-right"
      } ${
        vacio
          ? "border-[var(--primario)] bg-[color-mix(in_srgb,var(--primario)_12%,transparent)]"
          : "border-[var(--borde)]"
      }`}
    />
  );
}

function TablaCursos({
  cursos,
  columnas,
  tarifas,
  onChange,
}: {
  cursos: Curso[];
  columnas: [string, string][];
  tarifas: TarifasPorCurso;
  onChange: (cursoId: number, modalidad: string, v: string) => void;
}) {
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
          <th className="py-2 pr-4 font-medium min-w-[14rem]">Curso</th>
          <th className="py-2 pr-4 font-medium text-right">Mensual</th>
          {columnas.map(([k, label]) => (
            <th key={k} className="py-2 pr-4 font-medium text-right">
              {label}
            </th>
          ))}
          <th className="py-2 pr-4 font-medium">Estado</th>
        </tr>
      </thead>
      <tbody>
        {cursos.map((c) => {
          const t = tarifas[c.id] ?? {};
          const falta = columnas.some(([k]) => t[k] == null);
          return (
            <tr key={c.id} className="border-t border-[var(--borde)]">
              <td className="py-2 pr-4">
                <div className="font-medium">{c.nombre}</div>
                <div className="text-sm text-[var(--texto-tenue)]">
                  {[c.linea, c.nivel].filter(Boolean).join(" · ") || "—"}
                  {rangoHorario(c.hora, c.duracion_min) ? ` · ${rangoHorario(c.hora, c.duracion_min)}` : ""}
                </div>
              </td>
              <td className="py-2 pr-4 text-right text-[var(--texto-tenue)]">{c.precio_mensual}</td>
              {columnas.map(([k]) => (
                <td key={k} className="py-2 pr-4 text-right">
                  <Celda
                    valor={t[k] == null ? "" : String(t[k])}
                    onChange={(v) => onChange(c.id, k, v)}
                  />
                </td>
              ))}
              <td className="py-2 pr-4 text-sm">
                {falta ? (
                  <span className="text-[var(--primario)]">
                    {columnas.length === 1 ? "Sin precio: no se vende" : "Cae al mensual"}
                  </span>
                ) : (
                  <span className="text-[var(--texto-tenue)]">Completa</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BloqueSala({
  cat,
  setCat,
  tamEd,
  setTamEd,
  horasEd,
  setHorasEd,
  setHorasBorradas,
  usoPorHoras,
  precioDe,
  setPrecio,
  tamanosSala,
  preciosEd,
  paquetes,
}: {
  cat: CategoriaSala;
  setCat: (c: CategoriaSala) => void;
  tamEd: { clave: string; etiqueta: string; max_personas: number; orden: number }[];
  setTamEd: React.Dispatch<
    React.SetStateAction<{ clave: string; etiqueta: string; max_personas: number; orden: number }[]>
  >;
  horasEd: FilaHoras[];
  setHorasEd: React.Dispatch<React.SetStateAction<FilaHoras[]>>;
  setHorasBorradas: React.Dispatch<React.SetStateAction<number[]>>;
  usoPorHoras: Record<number, number>;
  precioDe: (categoria: string, tamano: string, horas: number) => number | null;
  setPrecio: (categoria: string, tamano: string, horas: number, v: string) => void;
  tamanosSala: TamanoSala[];
  preciosEd: CeldaSala[];
  paquetes: Paquete[];
}) {
  // E.3 — el simulador: qué celda usa una particular y cuánto se descuenta.
  const [simPaquete, setSimPaquete] = useState(0);
  const [simCat, setSimCat] = useState<CategoriaSala>("profesor_tropicana");
  const [simAlumnos, setSimAlumnos] = useState(2);

  const paquete = paquetes[simPaquete];
  const tamanoSim = tamanoPorPersonas(tamanosSala, simAlumnos);
  const resultado =
    paquete && tamanoSim
      ? costoDeSala(
          preciosEd.map((p) => ({
            // Esta pantalla edita la tarifa general, la que vale para todas las
            // salas (0037): por eso `sala_id: null`.
            sala_id: null,
            categoria: p.categoria as CategoriaSala,
            tamano: p.tamano as ClaveTamano,
            horas: p.horas,
            precio: p.precio,
          })),
          simCat,
          tamanoSim,
          paquete.horas
        )
      : null;

  return (
    <div className="space-y-4">
      {/* E.0 — la tabla es fuente única, y por eso no se duplica en el bloque D. */}
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-5">
        <p className="text-base max-w-[72ch]">
          Esta tabla se consulta desde los dos lados: un tercero que alquila la sala
          directamente, y una clase particular que se vende. En el segundo caso el sistema
          no pregunta el costo de sala — lo busca acá por <strong>categoría × tamaño ×
          horas</strong> y lo descuenta en la liquidación mensual del profesor. Cambiar un
          precio acá cambia los dos.
        </p>
      </div>

      <Bloque
        titulo="Tarifas de alquiler de sala"
        bajada="Los máximos de personas son datos, no constantes: subir el máximo del grupo cambia el encabezado de la columna. Una celda vacía es «sin tarifa» y no se puede liquidar — nunca se toma como cero."
      >
        {/* E.1 — los tamaños y su máximo de personas. */}
        <div className="flex flex-wrap gap-3 mb-5">
          {tamEd.map((t, i) => (
            <div
              key={t.clave}
              className="border border-[var(--borde)] rounded-[var(--radio-control)] p-3 min-w-[11rem]"
            >
              <div className="font-medium">{t.etiqueta}</div>
              <label className="text-sm text-[var(--texto-tenue)] flex items-center gap-2 mt-1">
                Hasta
                <Celda
                  ancho="w-16"
                  valor={String(t.max_personas)}
                  onChange={(v) =>
                    setTamEd((p) =>
                      p.map((x, j) =>
                        j === i ? { ...x, max_personas: Number(soloNum(v) || 0) } : x
                      )
                    )
                  }
                />
                personas
              </label>
            </div>
          ))}
        </div>

        {/* E.2 — un segmentado de categoría más una grilla horas × tamaño. Tres
            dimensiones en una grilla no se leen; dos con un conmutador, sí. */}
        <div className="flex flex-wrap gap-2 mb-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-4 py-2 text-base rounded-[var(--radio-control)] border ${
                cat === c
                  ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                  : "border-[var(--borde)] hover:border-[var(--primario)]"
              }`}
            >
              {ETIQUETA_CATEGORIA[c]}
            </button>
          ))}
        </div>
        <p className="text-sm text-[var(--texto-tenue)] mb-4 max-w-[72ch]">{NOTA_CATEGORIA[cat]}</p>

        <table className="w-full text-left">
          <thead>
            <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
              <th className="py-2 pr-4 font-medium">Paquete</th>
              {tamEd.map((t) => (
                <th key={t.clave} className="py-2 pr-4 font-medium text-right">
                  {t.etiqueta} · hasta {t.max_personas}
                </th>
              ))}
              <th className="py-2 pr-4 font-medium">Uso</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {horasEd.map((h, i) => {
              const uso = usoPorHoras[Number(h.horas)] ?? 0;
              return (
                <tr key={h.id ?? `nueva-${i}`} className="border-t border-[var(--borde)]">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <Celda
                        ancho="w-20"
                        valor={String(h.horas ?? "")}
                        onChange={(v) =>
                          setHorasEd((p) =>
                            p.map((x, j) =>
                              j === i ? { ...x, horas: Number(soloHoras(v) || 0) } : x
                            )
                          )
                        }
                      />
                      <span className="text-sm text-[var(--texto-tenue)]">
                        {Number(h.horas) === 1 ? "hora" : "horas"}
                      </span>
                    </div>
                  </td>
                  {tamEd.map((t) => {
                    const v = precioDe(cat, t.clave, Number(h.horas));
                    return (
                      <td key={t.clave} className="py-2 pr-4 text-right">
                        <Celda
                          valor={v == null ? "" : String(v)}
                          onChange={(nv) => setPrecio(cat, t.clave, Number(h.horas), nv)}
                        />
                      </td>
                    );
                  })}
                  <td className="py-2 pr-4 text-sm text-[var(--texto-tenue)]">
                    {uso === 0 ? "Sin uso" : `${uso} ${uso === 1 ? "alquiler" : "alquileres"}`}
                  </td>
                  <td className="py-2">
                    <button
                      disabled={uso > 0}
                      className="text-sm text-[var(--texto-tenue)] hover:text-[var(--peligro)] disabled:opacity-45"
                      onClick={() => {
                        if (h.id) setHorasBorradas((b) => [...b, h.id!]);
                        setHorasEd((p) => p.filter((_, j) => j !== i));
                      }}
                    >
                      Eliminar
                    </button>
                    {uso > 0 && (
                      <div className="text-xs text-[var(--texto-tenue)] max-w-[22ch] mt-1">
                        No se puede eliminar: ya se alquiló con este paquete de horas.
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button
          className="mt-3 px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
          onClick={() => setHorasEd((p) => [...p, { id: null, horas: 1, orden: 0 }])}
        >
          + Agregar paquete de horas
        </button>
      </Bloque>

      {/* E.3 — el simulador: demuestra la búsqueda en vez de pedir que se confíe. */}
      <Bloque
        titulo="Cómo lo resuelve una particular"
        bajada="Elegí un paquete vendible y cuánta gente lo toma: abajo aparece la celda exacta que usa el sistema y el monto que se le descuenta al profesor en su liquidación."
      >
        {paquetes.length === 0 ? (
          <p className="text-base text-[var(--texto-tenue)]">
            Todavía no hay paquetes de clases particulares cargados. Cargá uno en la pestaña
            <strong> Clases particulares</strong> y volvé acá: el simulador necesita un paquete
            para resolver la búsqueda.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <label className="text-sm text-[var(--texto-tenue)]">
                <div className="mb-1">Paquete</div>
                <select
                  className="px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base"
                  value={simPaquete}
                  onChange={(e) => setSimPaquete(Number(e.target.value))}
                >
                  {paquetes.map((p, i) => (
                    <option key={p.id ?? `n${i}`} value={i}>
                      {p.nombre || "(sin nombre)"} · {p.horas} h
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-[var(--texto-tenue)]">
                <div className="mb-1">Categoría del profesor</div>
                <select
                  className="px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base"
                  value={simCat}
                  onChange={(e) => setSimCat(e.target.value as CategoriaSala)}
                >
                  <option value="profesor_tropicana">Profesor Tropicana</option>
                  <option value="profesor_externo">Profesor Externo</option>
                </select>
              </label>
              <label className="text-sm text-[var(--texto-tenue)]">
                <div className="mb-1">Alumnos</div>
                <Celda
                  ancho="w-20"
                  valor={String(simAlumnos)}
                  onChange={(v) => setSimAlumnos(Number(soloNum(v) || 0))}
                />
              </label>
            </div>

            <div className="border border-[var(--borde)] rounded-[var(--radio-control)] p-4">
              {!tamanoSim ? (
                <p className="text-base text-[var(--primario)]">
                  {simAlumnos > 0
                    ? `Ningún tamaño llega a ${simAlumnos} personas. Subí el máximo del grupo arriba, o revisá la cantidad.`
                    : "Escribí cuántos alumnos toman el paquete."}
                </p>
              ) : (
                resultado && (
                  <>
                    <div className="text-sm text-[var(--texto-tenue)]">{resultado.ruta}</div>
                    {resultado.precio == null ? (
                      <>
                        <div className="text-2xl font-semibold text-[var(--primario)] mt-1">—</div>
                        <p className="text-sm text-[var(--texto-tenue)] mt-1 max-w-[60ch]">
                          {resultado.motivo}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-semibold mt-1">
                          Bs. {resultado.precio.toLocaleString("es-BO")}
                        </div>
                        <p className="text-sm text-[var(--texto-tenue)] mt-1 max-w-[60ch]">
                          El alumno paga Bs. {Number(paquete.precio).toLocaleString("es-BO")} por el
                          paquete ({simAlumnos} {simAlumnos === 1 ? "alumno" : "alumnos"}, mismo
                          precio). Al profesor se le descuentan Bs.{" "}
                          {resultado.precio.toLocaleString("es-BO")} de sala.
                        </p>
                      </>
                    )}
                  </>
                )
              )}
            </div>
          </div>
        )}
      </Bloque>
    </div>
  );
}
