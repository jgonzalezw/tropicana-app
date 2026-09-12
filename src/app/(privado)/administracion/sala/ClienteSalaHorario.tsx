"use client";

/**
 * Salas y horarios: el alta de salas, el patrón semanal y las excepciones.
 *
 * **Las piezas se muestran separadas porque son distintas.** El patrón es una
 * regla que se repite; una excepción es un período concreto. Mezclarlas haría
 * que cargar un feriado se parezca a cambiar el horario de todos los viernes,
 * que es justamente lo que no son.
 *
 * **Un día sin franjas se muestra como "cerrado", no vacío.** Vacío se lee como
 * "falta cargar"; acá la ausencia es una decisión y tiene que verse como tal.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { describirVentanas } from "@/lib/sala";
import {
  guardarHorarioSala,
  guardarSalas,
  type ExcepcionEdit,
  type SalaEdit,
} from "./acciones";

type FilaPatron = { dia_semana: number; desde: string; hasta: string };

const DIAS: { n: number; label: string }[] = [
  { n: 1, label: "Lunes" },
  { n: 2, label: "Martes" },
  { n: 3, label: "Miércoles" },
  { n: 4, label: "Jueves" },
  { n: 5, label: "Viernes" },
  { n: 6, label: "Sábado" },
  { n: 7, label: "Domingo" },
];

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");
const dia10 = (d: string) => d.slice(0, 10);

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base";
const botonTenue =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]";

export default function ClienteSalaHorario({
  salas,
  patron,
  excepciones,
  motivos,
}: {
  salas: { id: number; nombre: string; orden: number; activa: boolean }[];
  patron: { id: number; sala_id: number; dia_semana: number; desde: string; hasta: string }[];
  excepciones: {
    id: number;
    sala_id: number;
    fecha: string;
    hasta_fecha: string;
    cerrado: boolean;
    desde: string | null;
    hasta: string | null;
    motivo: string | null;
    glosa: string | null;
  }[];
  motivos: { valor: string; etiqueta: string }[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  // ── Salas ──────────────────────────────────────────────────────────
  const salasIniciales: SalaEdit[] = salas.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    orden: s.orden,
    activa: s.activa,
  }));
  const [salasEd, setSalasEd] = useState<SalaEdit[]>(salasIniciales);
  const [msgSalas, setMsgSalas] = useState<string | null>(null);
  const [errSalas, setErrSalas] = useState<string | null>(null);
  const salasSucio = JSON.stringify(salasEd) !== JSON.stringify(salasIniciales);

  // ── Horario de la sala elegida ─────────────────────────────────────
  const [salaId, setSalaId] = useState<number>(salas[0]?.id ?? 0);
  const salaActual = salas.find((s) => s.id === salaId) ?? null;

  const patronInicial: FilaPatron[] = patron
    .filter((p) => p.sala_id === salaId)
    .map((p) => ({ dia_semana: p.dia_semana, desde: hhmm(p.desde), hasta: hhmm(p.hasta) }));
  const excInicial: ExcepcionEdit[] = excepciones
    .filter((e) => e.sala_id === salaId)
    .map((e) => ({
      id: e.id,
      fecha: dia10(e.fecha),
      hasta_fecha: dia10(e.hasta_fecha),
      cerrado: e.cerrado,
      desde: hhmm(e.desde),
      hasta: hhmm(e.hasta),
      motivo: e.motivo,
      glosa: e.glosa,
    }));

  const [filas, setFilas] = useState<FilaPatron[]>(patronInicial);
  const [exc, setExc] = useState<ExcepcionEdit[]>(excInicial);
  const [excBorradas, setExcBorradas] = useState<number[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sucio =
    JSON.stringify({ filas, exc, excBorradas }) !==
    JSON.stringify({ filas: patronInicial, exc: excInicial, excBorradas: [] });

  const sinHorario = filas.length === 0 && exc.length === 0;

  /** Cambiar de sala descarta lo no guardado: son horarios distintos y mezclarlos
   *  guardaría el de una sala sobre la otra. */
  function cambiarSala(id: number) {
    if (sucio && !confirm("Hay cambios sin guardar en esta sala. ¿Los descartás?")) return;
    const p = patron
      .filter((x) => x.sala_id === id)
      .map((x) => ({ dia_semana: x.dia_semana, desde: hhmm(x.desde), hasta: hhmm(x.hasta) }));
    const e = excepciones
      .filter((x) => x.sala_id === id)
      .map((x) => ({
        id: x.id,
        fecha: dia10(x.fecha),
        hasta_fecha: dia10(x.hasta_fecha),
        cerrado: x.cerrado,
        desde: hhmm(x.desde),
        hasta: hhmm(x.hasta),
        motivo: x.motivo,
        glosa: x.glosa,
      }));
    setSalaId(id);
    setFilas(p);
    setExc(e);
    setExcBorradas([]);
    setMsg(null);
    setError(null);
  }

  function guardarLasSalas() {
    setMsgSalas(null);
    setErrSalas(null);
    startTransition(async () => {
      const r = await guardarSalas(salasEd);
      if (r.error) setErrSalas(r.error);
      else {
        setMsgSalas("Salas guardadas.");
        router.refresh();
      }
    });
  }

  function guardar() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await guardarHorarioSala(salaId, filas, exc, excBorradas);
      if (r.error) setError(r.error);
      else {
        setMsg("Horario guardado. Desde ahora, fuera de él la sala no se puede reservar.");
        setExcBorradas([]);
        router.refresh();
      }
    });
  }

  const delDia = (n: number) => filas.filter((f) => f.dia_semana === n);

  return (
    <div className="space-y-6 pb-28">
      {/* ── Salas ───────────────────────────────────────────────────── */}
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6">
        <h2 className="text-xl font-semibold">Salas</h2>
        <p className="text-sm text-[var(--texto-tenue)] mt-1 mb-4 max-w-[70ch]">
          El <strong>orden importa</strong>: la primera es la que se ofrece al vender, y la
          siguiente entra cuando esa está ocupada. Cada sala tiene su propio horario.
        </p>

        <div className="space-y-2">
          {salasEd.map((s, i) => (
            <div key={s.id ?? `nueva-${i}`} className="flex items-center gap-3 flex-wrap">
              <input
                type="number"
                value={s.orden}
                min={1}
                onChange={(e) =>
                  setSalasEd((p) =>
                    p.map((x, j) => (j === i ? { ...x, orden: Number(e.target.value) } : x))
                  )
                }
                className={`${control} w-20`}
                aria-label="Orden"
              />
              <input
                value={s.nombre}
                placeholder="Nombre de la sala"
                onChange={(e) =>
                  setSalasEd((p) =>
                    p.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x))
                  )
                }
                className={`${control} flex-1 min-w-[14rem]`}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.activa}
                  onChange={(e) =>
                    setSalasEd((p) =>
                      p.map((x, j) => (j === i ? { ...x, activa: e.target.checked } : x))
                    )
                  }
                />
                Activa
              </label>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <button
            onClick={() =>
              setSalasEd((p) => [
                ...p,
                {
                  id: null,
                  nombre: "",
                  orden: Math.max(0, ...p.map((x) => x.orden)) + 1,
                  activa: true,
                },
              ])
            }
            className={botonTenue}
          >
            + Agregar sala
          </button>
          <button
            onClick={guardarLasSalas}
            disabled={!salasSucio || pendiente}
            className="px-4 py-2 text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-45"
          >
            Guardar salas
          </button>
          {errSalas && <span className="text-sm text-[var(--peligro)]">{errSalas}</span>}
          {msgSalas && <span className="text-sm text-[var(--exito)]">{msgSalas}</span>}
        </div>

        {salasSucio && (
          <p className="text-sm text-[var(--texto-tenue)] mt-2">
            Guardá las salas antes de cargarles el horario: una sala nueva todavía no existe
            para el resto del sistema.
          </p>
        )}
      </div>

      {/* D20: el selector aparece recién con la segunda sala. Con una sola,
          elegir entre una opción es ruido. */}
      {salas.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-base font-medium">Horario de:</span>
          {salas.map((s) => (
            <button
              key={s.id}
              onClick={() => cambiarSala(s.id)}
              className={`px-4 py-2 text-base rounded-[var(--radio-control)] border ${
                s.id === salaId
                  ? "border-[var(--primario)] bg-[color-mix(in_srgb,var(--primario)_14%,transparent)] font-semibold"
                  : "border-[var(--borde)]"
              }`}
            >
              {s.nombre}
              {!s.activa && " (inactiva)"}
            </button>
          ))}
        </div>
      )}

      {!salaActual ? (
        <p className="text-base text-[var(--texto-tenue)]">
          Cargá una sala arriba para poder definirle el horario.
        </p>
      ) : (
        <>
          {/* Regla de calidad 5: una capacidad que no está disponible se explica. */}
          {sinHorario && (
            <div className="border border-[var(--primario)] bg-[color-mix(in_srgb,var(--primario)_12%,transparent)] rounded-[var(--radio-tarjeta)] p-5">
              <div className="font-semibold text-base">
                {salaActual.nombre} todavía no tiene horario cargado.
              </div>
              <p className="text-base mt-1 max-w-[70ch]">
                Hasta que lo cargues, <strong>esta sala no se puede reservar</strong> y no se
                pueden vender horas en ella: el sistema no tiene forma de saber cuándo está
                abierta.
              </p>
            </div>
          )}

          {/* ── Patrón semanal ───────────────────────────────────────── */}
          <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6">
            <h2 className="text-xl font-semibold">Horario semanal · {salaActual.nombre}</h2>
            <p className="text-sm text-[var(--texto-tenue)] mt-1 mb-4 max-w-[70ch]">
              La regla que se repite todas las semanas. Un día puede tener más de una franja
              —abre, corta al mediodía y reabre—.{" "}
              <strong>Un día sin franjas está cerrado.</strong>
            </p>

            <div className="space-y-2">
              {DIAS.map(({ n, label }) => {
                const franjas = delDia(n);
                return (
                  <div
                    key={n}
                    className="flex flex-wrap items-start gap-3 py-3 border-t border-[var(--borde)]"
                  >
                    <div className="w-28 shrink-0">
                      <div className="font-medium">{label}</div>
                      <div className="text-sm text-[var(--texto-tenue)]">
                        {describirVentanas(
                          franjas.map((f) => ({ desde: f.desde, hasta: f.hasta }))
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-[18rem] space-y-2">
                      {franjas.map((f) => {
                        const i = filas.indexOf(f);
                        return (
                          <div key={i} className="flex items-center gap-2 flex-wrap">
                            <input
                              type="time"
                              value={f.desde}
                              onChange={(e) =>
                                setFilas((p) =>
                                  p.map((x, j) =>
                                    j === i ? { ...x, desde: e.target.value } : x
                                  )
                                )
                              }
                              className={control}
                            />
                            <span className="text-[var(--texto-tenue)]">a</span>
                            <input
                              type="time"
                              value={f.hasta}
                              onChange={(e) =>
                                setFilas((p) =>
                                  p.map((x, j) =>
                                    j === i ? { ...x, hasta: e.target.value } : x
                                  )
                                )
                              }
                              className={control}
                            />
                            <button
                              onClick={() => setFilas((p) => p.filter((_, j) => j !== i))}
                              className="text-sm text-[var(--texto-tenue)] hover:text-[var(--peligro)]"
                            >
                              Quitar
                            </button>
                          </div>
                        );
                      })}

                      <button
                        onClick={() =>
                          setFilas((p) => [
                            ...p,
                            { dia_semana: n, desde: "08:00", hasta: "22:00" },
                          ])
                        }
                        className={botonTenue}
                      >
                        {franjas.length ? "+ Otra franja" : "+ Abrir este día"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Excepciones por período ──────────────────────────────── */}
          <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 overflow-x-auto">
            <h2 className="text-xl font-semibold">Excepciones · {salaActual.nombre}</h2>
            <p className="text-sm text-[var(--texto-tenue)] mt-1 mb-4 max-w-[70ch]">
              Períodos que no siguen el horario semanal: un feriado, un receso de varios días,
              o un día que abre distinto. Una excepción <strong>reemplaza</strong> al horario
              semanal en esas fechas. Para un solo día, poné la misma fecha en las dos puntas.
            </p>

            {exc.length === 0 ? (
              <p className="text-base text-[var(--texto-tenue)] mb-4">
                Sin excepciones: todos los días siguen el horario semanal.
              </p>
            ) : (
              <table className="w-full text-left mb-4">
                <thead>
                  <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
                    <th className="py-2 pr-4 font-medium">Desde</th>
                    <th className="py-2 pr-4 font-medium">Hasta</th>
                    <th className="py-2 pr-4 font-medium">Esos días</th>
                    <th className="py-2 pr-4 font-medium">Horario</th>
                    <th className="py-2 pr-4 font-medium">Motivo</th>
                    <th className="py-2 pr-4 font-medium">Detalle</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {exc.map((e, i) => (
                    <tr key={e.id ?? `nueva-${i}`} className="border-t border-[var(--borde)]">
                      <td className="py-2 pr-4">
                        <input
                          type="date"
                          value={e.fecha}
                          onChange={(ev) =>
                            setExc((p) =>
                              p.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      fecha: ev.target.value,
                                      // Un período que terminaba antes de empezar no
                                      // significa nada: se arrastra la punta.
                                      hasta_fecha:
                                        x.hasta_fecha && x.hasta_fecha >= ev.target.value
                                          ? x.hasta_fecha
                                          : ev.target.value,
                                    }
                                  : x
                              )
                            )
                          }
                          className={control}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="date"
                          value={e.hasta_fecha}
                          min={e.fecha}
                          onChange={(ev) =>
                            setExc((p) =>
                              p.map((x, j) =>
                                j === i ? { ...x, hasta_fecha: ev.target.value } : x
                              )
                            )
                          }
                          className={control}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={e.cerrado ? "cerrado" : "abre"}
                          onChange={(ev) =>
                            setExc((p) =>
                              p.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      cerrado: ev.target.value === "cerrado",
                                      desde:
                                        ev.target.value === "cerrado" ? null : x.desde || "09:00",
                                      hasta:
                                        ev.target.value === "cerrado" ? null : x.hasta || "14:00",
                                    }
                                  : x
                              )
                            )
                          }
                          className={control}
                        >
                          <option value="cerrado">No abre</option>
                          <option value="abre">Abre distinto</option>
                        </select>
                      </td>
                      <td className="py-2 pr-4">
                        {e.cerrado ? (
                          <span className="text-[var(--texto-tenue)]">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={e.desde ?? ""}
                              onChange={(ev) =>
                                setExc((p) =>
                                  p.map((x, j) =>
                                    j === i ? { ...x, desde: ev.target.value } : x
                                  )
                                )
                              }
                              className={control}
                            />
                            <span className="text-[var(--texto-tenue)]">a</span>
                            <input
                              type="time"
                              value={e.hasta ?? ""}
                              onChange={(ev) =>
                                setExc((p) =>
                                  p.map((x, j) =>
                                    j === i ? { ...x, hasta: ev.target.value } : x
                                  )
                                )
                              }
                              className={control}
                            />
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {/* Regla de calidad 6: se elige de una lista, no se escribe. */}
                        <select
                          value={e.motivo ?? ""}
                          onChange={(ev) =>
                            setExc((p) =>
                              p.map((x, j) =>
                                j === i ? { ...x, motivo: ev.target.value || null } : x
                              )
                            )
                          }
                          className={control}
                        >
                          <option value="">Sin clasificar</option>
                          {motivos.map((m) => (
                            <option key={m.valor} value={m.valor}>
                              {m.etiqueta}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          value={e.glosa ?? ""}
                          placeholder="ej. Navidad"
                          onChange={(ev) =>
                            setExc((p) =>
                              p.map((x, j) => (j === i ? { ...x, glosa: ev.target.value } : x))
                            )
                          }
                          className={`${control} w-40`}
                        />
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => {
                            if (e.id) setExcBorradas((b) => [...b, e.id!]);
                            setExc((p) => p.filter((_, j) => j !== i));
                          }}
                          className="text-sm text-[var(--texto-tenue)] hover:text-[var(--peligro)]"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <button
              onClick={() => {
                const hoy = new Date().toISOString().slice(0, 10);
                setExc((p) => [
                  ...p,
                  {
                    id: null,
                    fecha: hoy,
                    hasta_fecha: hoy,
                    cerrado: true,
                    desde: null,
                    hasta: null,
                    motivo: "feriado",
                    glosa: null,
                  },
                ]);
              }}
              className={botonTenue}
            >
              + Agregar excepción
            </button>
          </div>
        </>
      )}

      {/* Barra de acción fija, igual que en Precios y paquetes. */}
      {salaActual && (
        <div className="fixed left-0 right-0 bottom-0 bg-[var(--fondo-panel)] border-t border-[var(--borde)] px-6 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[16rem] text-base">
              {error ? (
                <span className="text-[var(--peligro)]">{error}</span>
              ) : msg ? (
                <span className="text-[var(--exito)]">{msg}</span>
              ) : (
                <span className="text-[var(--texto-tenue)]">
                  {sucio
                    ? `Cambios sin guardar en ${salaActual.nombre}.`
                    : "Sin cambios pendientes."}
                </span>
              )}
            </div>
            <button
              onClick={() => cambiarSala(salaId)}
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
              {pendiente ? "Guardando…" : "Guardar horario"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
