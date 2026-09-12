"use client";

/**
 * El horario base de la sala: patrón semanal + excepciones por fecha.
 *
 * **Las dos piezas se muestran separadas porque son distintas.** El patrón es
 * una regla que se repite; una excepción es una fecha concreta. Mezclarlas en
 * una sola grilla haría que cargar un feriado se parezca a cambiar el horario
 * de todos los viernes, que es justamente lo que no son.
 *
 * **Un día sin franjas se muestra como "cerrado", no vacío.** Vacío se lee como
 * "falta cargar"; acá la ausencia es una decisión y tiene que verse como tal.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { describirVentanas } from "@/lib/sala";
import { guardarHorarioSala, type ExcepcionEdit } from "./acciones";

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

export default function ClienteSalaHorario({
  sala,
  patron,
  excepciones,
  motivos,
}: {
  sala: { id: number; nombre: string };
  patron: { id: number; dia_semana: number; desde: string; hasta: string }[];
  excepciones: {
    id: number;
    fecha: string;
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
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patronInicial: FilaPatron[] = patron.map((p) => ({
    dia_semana: p.dia_semana,
    desde: hhmm(p.desde),
    hasta: hhmm(p.hasta),
  }));
  const excInicial: ExcepcionEdit[] = excepciones.map((e) => ({
    id: e.id,
    fecha: e.fecha.slice(0, 10),
    cerrado: e.cerrado,
    desde: hhmm(e.desde),
    hasta: hhmm(e.hasta),
    motivo: e.motivo,
    glosa: e.glosa,
  }));

  const [filas, setFilas] = useState<FilaPatron[]>(patronInicial);
  const [exc, setExc] = useState<ExcepcionEdit[]>(excInicial);
  const [excBorradas, setExcBorradas] = useState<number[]>([]);

  const sucio =
    JSON.stringify({ filas, exc, excBorradas }) !==
    JSON.stringify({ filas: patronInicial, exc: excInicial, excBorradas: [] });

  const sinHorario = filas.length === 0 && exc.length === 0;

  function descartar() {
    setFilas(patronInicial);
    setExc(excInicial);
    setExcBorradas([]);
    setMsg(null);
    setError(null);
  }

  function guardar() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await guardarHorarioSala(sala.id, filas, exc, excBorradas);
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
      {/* Regla de calidad 5: una capacidad que no está disponible se explica.
          Sin horario la sala no se reserva, y hay que decirlo acá y no
          descubrirlo al intentar vender. */}
      {sinHorario && (
        <div className="border border-[var(--primario)] bg-[color-mix(in_srgb,var(--primario)_12%,transparent)] rounded-[var(--radio-tarjeta)] p-5">
          <div className="font-semibold text-base">Todavía no cargaste el horario de la sala.</div>
          <p className="text-base mt-1 max-w-[70ch]">
            Hasta que lo cargues, <strong>la sala no se puede reservar</strong> y no se
            pueden vender horas: el sistema no tiene forma de saber cuándo está abierta.
            Cargá abajo los días y horas en que abre.
          </p>
        </div>
      )}

      {/* ── Patrón semanal ─────────────────────────────────────────── */}
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6">
        <h2 className="text-xl font-semibold">Horario semanal</h2>
        <p className="text-sm text-[var(--texto-tenue)] mt-1 mb-4 max-w-[70ch]">
          La regla que se repite todas las semanas. Un día puede tener más de una franja
          —abre, corta al mediodía y reabre—. <strong>Un día sin franjas está cerrado.</strong>
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
                    {describirVentanas(franjas.map((f) => ({ desde: f.desde, hasta: f.hasta })))}
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
                              p.map((x, j) => (j === i ? { ...x, desde: e.target.value } : x))
                            )
                          }
                          className="px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base"
                        />
                        <span className="text-[var(--texto-tenue)]">a</span>
                        <input
                          type="time"
                          value={f.hasta}
                          onChange={(e) =>
                            setFilas((p) =>
                              p.map((x, j) => (j === i ? { ...x, hasta: e.target.value } : x))
                            )
                          }
                          className="px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base"
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
                    className="px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
                  >
                    {franjas.length ? "+ Otra franja" : "+ Abrir este día"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Excepciones por fecha ──────────────────────────────────── */}
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 overflow-x-auto">
        <h2 className="text-xl font-semibold">Excepciones por fecha</h2>
        <p className="text-sm text-[var(--texto-tenue)] mt-1 mb-4 max-w-[70ch]">
          Días concretos que no siguen el horario semanal: un feriado que cierra, o un día
          que abre distinto. Una excepción <strong>reemplaza</strong> al horario semanal ese
          día. Un feriado se carga acá, no como un bloqueo de la agenda.
        </p>

        {exc.length === 0 ? (
          <p className="text-base text-[var(--texto-tenue)] mb-4">
            Sin excepciones cargadas: todos los días siguen el horario semanal.
          </p>
        ) : (
          <table className="w-full text-left mb-4">
            <thead>
              <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Ese día</th>
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
                          p.map((x, j) => (j === i ? { ...x, fecha: ev.target.value } : x))
                        )
                      }
                      className="px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base"
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
                                  desde: ev.target.value === "cerrado" ? null : x.desde || "09:00",
                                  hasta: ev.target.value === "cerrado" ? null : x.hasta || "14:00",
                                }
                              : x
                          )
                        )
                      }
                      className="px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base"
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
                              p.map((x, j) => (j === i ? { ...x, desde: ev.target.value } : x))
                            )
                          }
                          className="px-2 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base"
                        />
                        <span className="text-[var(--texto-tenue)]">a</span>
                        <input
                          type="time"
                          value={e.hasta ?? ""}
                          onChange={(ev) =>
                            setExc((p) =>
                              p.map((x, j) => (j === i ? { ...x, hasta: ev.target.value } : x))
                            )
                          }
                          className="px-2 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base"
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
                          p.map((x, j) => (j === i ? { ...x, motivo: ev.target.value || null } : x))
                        )
                      }
                      className="px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base"
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
                      className="w-44 px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base"
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
          onClick={() =>
            setExc((p) => [
              ...p,
              {
                id: null,
                fecha: new Date().toISOString().slice(0, 10),
                cerrado: true,
                desde: null,
                hasta: null,
                motivo: "feriado",
                glosa: null,
              },
            ])
          }
          className="px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
        >
          + Agregar excepción
        </button>
      </div>

      {/* Barra de acción fija, igual que en Precios y paquetes. */}
      <div className="fixed left-0 right-0 bottom-0 bg-[var(--fondo-panel)] border-t border-[var(--borde)] px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4 flex-wrap">
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
            {pendiente ? "Guardando…" : "Guardar horario"}
          </button>
        </div>
      </div>
    </div>
  );
}
