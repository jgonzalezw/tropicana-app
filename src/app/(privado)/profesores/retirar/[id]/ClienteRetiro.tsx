"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gs } from "@/lib/inscripcion";
import type { DatosSustituto } from "@/lib/desasignacion";
import type { VistaRetiro } from "@/lib/liquidacion/retiro";
import { construirHTMLRetiro } from "@/lib/liquidacion/imprimirRetiro";
import { fechaCorta } from "@/lib/liquidacion/formatoPre";
import { leyendaCriterios, siglaCriterio } from "@/lib/liquidacion/criterios";
import {
  avanceEnDosLineas, cantidad, montoOGuion, textoBonoAplicado, textoBonoGenerado, textoCiclo, textoYaLiquidado,
} from "@/lib/liquidacion/formatoRetiro";
import { retirarProfesor, vistaRetiro } from "../../acciones";

export type CursoRetiro = { asignacionId: number; cursoId: number; curso: string; desde: string };
export type OpcionSustituto = { id: number; nombre: string };

const BOTON_SECUNDARIO =
  "inline-flex items-center justify-center min-h-[44px] px-5 text-base font-semibold rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]";
const BOTON_PRIMARIO =
  "inline-flex items-center justify-center min-h-[44px] px-5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-50 disabled:cursor-not-allowed";
const CAMPO =
  "min-h-[44px] px-3 text-base rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)]";

type Eleccion = { profesorId: number | null; pct: string };

const TH = "py-2 pr-2 font-medium";
const THR = `${TH} text-right`;
const TD = "py-2 pr-2";
const TDR = `${TD} text-right tabular-nums whitespace-nowrap`;

/** Las siglas que aparecen en una tabla, explicadas debajo. */
function Leyenda({ criterios }: { criterios: (number | null)[] }) {
  const t = leyendaCriterios(criterios);
  return t ? <p className="mt-2 text-sm text-[var(--texto-tenue)]">{t}</p> : null;
}

/** Esconde solo la liquidación del que se retira; el resto sirve al profesor nuevo. */
function InterruptorLiquidacion({ valor, onChange }: { valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-3 min-h-[44px] cursor-pointer text-base">
      <input
        type="checkbox"
        checked={valor}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5"
      />
      <span>
        <span className="font-semibold">Incluir la liquidación del profesor que se retira</span>
        <span className="block text-sm text-[var(--texto-tenue)]">
          Apagado, se ve e imprime solo lo que necesita el profesor nuevo.
        </span>
      </span>
    </label>
  );
}

export default function ClienteRetiro({
  profesorId,
  profesor,
  activo,
  hoyISO,
  cursos,
  sustitutos,
}: {
  profesorId: number;
  profesor: string;
  activo: boolean;
  hoyISO: string;
  cursos: CursoRetiro[];
  sustitutos: OpcionSustituto[];
}) {
  const router = useRouter();
  const [corte, setCorte] = useState(hoyISO);
  const [elecciones, setElecciones] = useState<Record<number, Eleccion>>({});
  const [vista, setVista] = useState<VistaRetiro | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [confirmando, startConfirmar] = useTransition();
  const [hecho, setHecho] = useState<{
    liquidacionId: number | null;
    total: number;
    vista: VistaRetiro;
    confirmadoEn: string;
  } | null>(null);
  const [incluirLiquidacion, setIncluirLiquidacion] = useState(true);
  const pedido = useRef(0);

  // Modo enfoque: mientras se revisa un retiro el shell se atenúa (globals.css).
  useEffect(() => {
    document.documentElement.dataset.modoEnfoque = "1";
    return () => {
      delete document.documentElement.dataset.modoEnfoque;
    };
  }, []);

  const datosSustitutos = useMemo(() => {
    const out: Record<number, DatosSustituto | null> = {};
    for (const c of cursos) {
      const e = elecciones[c.asignacionId];
      out[c.asignacionId] = e?.profesorId
        ? { profesorId: e.profesorId, pctIngresos: Number(e.pct) || 0, pctReferido: 0 }
        : null;
    }
    return out;
  }, [cursos, elecciones]);

  // La simulación se recalcula sola cada vez que cambia algo. Solo lee.
  useEffect(() => {
    if (hecho) return;
    const mio = ++pedido.current;
    const t = setTimeout(async () => {
      setCalculando(true);
      const r = await vistaRetiro(profesorId, corte, datosSustitutos);
      if (mio !== pedido.current) return; // llegó una respuesta más nueva
      setCalculando(false);
      if (r.error) {
        setError(r.error);
        setVista(null);
      } else {
        setError(null);
        setVista(r.vista ?? null);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [profesorId, corte, datosSustitutos, hecho]);

  /** Imprime el informe en papel blanco, en una ventana aparte (no la pantalla). */
  function imprimir() {
    const v = hecho?.vista ?? vista;
    if (!v) return;
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    const generadoEn = new Date().toISOString();
    win.document.write(
      construirHTMLRetiro(
        v,
        hecho
          ? {
              profesor, corte, generadoEn, incluirLiquidacion,
              confirmado: { liquidacionId: hecho.liquidacionId, confirmadoEn: hecho.confirmadoEn },
            }
          : { profesor, corte, generadoEn, incluirLiquidacion }
      )
    );
    win.document.close();
    win.focus();
    win.onload = () => win.print();
    setTimeout(() => {
      try {
        win.print();
      } catch {
        /* noop */
      }
    }, 300);
  }

  function confirmar() {
    if (!vista?.puedeConfirmar) return;
    startConfirmar(async () => {
      const r = await retirarProfesor(profesorId, corte, datosSustitutos);
      if (r.error) {
        setError(r.error);
        return;
      }
      setError(null);
      const final = r.vista ?? vista;
      setHecho({
        liquidacionId: r.liquidacionId ?? null,
        total: final.totales.aPagar,
        vista: final,
        confirmadoEn: r.confirmadoEn ?? new Date().toISOString(),
      });
      router.refresh();
    });
  }

  const avisosVisibles = vista ? (incluirLiquidacion ? [...vista.avisos, ...vista.avisosLiquidacion] : vista.avisos) : [];

  if (hecho)
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-[28px] sm:text-[38px]">Retiro confirmado</h1>
        <div className="px-5 py-4 rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] text-base">
          <p className="font-bold">{profesor} quedó inactivo y sus cursos fueron cerrados el {corte}.</p>
          <p className="mt-2">
            Su cierre de cuentas quedó devengado. Total a pagarle: <b>{gs(hecho.total)}</b>. El pago se hace en Caja →
            Por pagar.
          </p>
        </div>
        <InterruptorLiquidacion valor={incluirLiquidacion} onChange={setIncluirLiquidacion} />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={imprimir} className={BOTON_PRIMARIO}>
            {incluirLiquidacion ? "Imprimir liquidación por finalización" : "Imprimir membresías para el profesor nuevo"}
          </button>
          <Link href="/caja" className={BOTON_SECUNDARIO}>
            Ir a Caja
          </Link>
          <Link href="/liquidaciones" className={BOTON_SECUNDARIO}>
            Ver liquidaciones
          </Link>
          <Link href="/profesores" className={BOTON_SECUNDARIO}>
            Volver a Profesores
          </Link>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/profesores" className={BOTON_SECUNDARIO}>
          ← Volver a Profesores
        </Link>
        <button type="button" onClick={imprimir} disabled={!vista} className={BOTON_SECUNDARIO}>
          Imprimir
        </button>
      </div>

      <div>
        <div className="text-sm text-[var(--texto-tenue)]">Profesores</div>
        <h1 className="text-[28px] sm:text-[38px] mt-1">Retirar a {profesor}</h1>
        <p className="mt-4 px-5 py-3 rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] text-base font-bold">
          Simulación — no se guardó nada. Si salís sin confirmar, no cambia ninguna asignación ni se devenga nada.
        </p>
        {!activo && (
          <p className="mt-3 text-base text-[var(--texto-tenue)]">
            Ya está inactivo, pero quedó con cursos asignados: acá se cierran y se liquida su avance.
          </p>
        )}
      </div>

      <InterruptorLiquidacion valor={incluirLiquidacion} onChange={setIncluirLiquidacion} />

      <section className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 max-w-xs">
          <span className="text-base font-semibold">Fecha efectiva del retiro (último día a cargo)</span>
          <input type="date" value={corte} onChange={(e) => setCorte(e.target.value)} className={CAMPO} />
        </label>

        {cursos.length === 0 ? (
          <p className="text-base text-[var(--texto-tenue)]">No tiene asignaciones abiertas.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-base font-semibold">Cursos y sustitutos</div>
            {cursos.map((c) => {
              const e = elecciones[c.asignacionId] ?? { profesorId: null, pct: "" };
              return (
                <div key={c.asignacionId} className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[12rem] font-medium">{c.curso}</div>
                  <select
                    aria-label={`Sustituto de ${c.curso}`}
                    value={e.profesorId ?? ""}
                    onChange={(ev) =>
                      setElecciones((s) => ({
                        ...s,
                        [c.asignacionId]: { ...e, profesorId: ev.target.value ? Number(ev.target.value) : null },
                      }))
                    }
                    className={CAMPO}
                  >
                    <option value="">— sin titular —</option>
                    {sustitutos.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                  {e.profesorId && (
                    <label className="flex items-center gap-2">
                      <span className="text-base">% de ingresos</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={e.pct}
                        onChange={(ev) =>
                          setElecciones((s) => ({ ...s, [c.asignacionId]: { ...e, pct: ev.target.value } }))
                        }
                        className={`${CAMPO} w-24`}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {error && (
        <div role="alert" className="px-5 py-3 rounded-[var(--radio-panel)] bg-[var(--peligro-fill)] text-[var(--peligro-texto)] text-base font-semibold">
          {error}
        </div>
      )}
      {calculando && !vista && <p className="text-base text-[var(--texto-tenue)]">Calculando la simulación…</p>}

      {vista && (
        <div className={`flex flex-col gap-7 ${calculando ? "opacity-60" : ""}`} aria-busy={calculando}>
          <section>
            <h2 className="text-xl font-bold mb-2">Qué pasará al confirmar</h2>
            <ul className="list-disc pl-6 text-base flex flex-col gap-1">
              {vista.acciones
                .filter((a) => incluirLiquidacion || a.clave !== "cierre")
                .map((a) => (
                  <li key={a.clave}>{a.texto}</li>
                ))}
            </ul>
          </section>

          {vista.trabas.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-2">Hay que resolver antes de confirmar</h2>
              <ul className="flex flex-col gap-2">
                {vista.trabas.map((t) => (
                  <li
                    key={t.clave}
                    className="px-4 py-3 rounded-[var(--radio-panel)] bg-[var(--peligro-fill)] text-[var(--peligro-texto)] text-base flex flex-wrap items-center justify-between gap-3"
                  >
                    <span>✖ {t.texto}</span>
                    {t.href && (
                      <Link href={t.href} className={BOTON_SECUNDARIO}>
                        {t.accion ?? "Resolver"}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {incluirLiquidacion && (
          <section>
            <h2 className="text-xl font-bold mb-2">Liquidación final</h2>
            <h3 className="text-base font-semibold mt-3">Cursos regulares</h3>
            {vista.regulares.length === 0 ? (
              <p className="text-base text-[var(--texto-tenue)]">Nada que devengar por cursos regulares.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="text-center text-xs text-[var(--texto-tenue)]">
                      <th />
                      <th colSpan={4} className="font-medium">Cuenta del alumno</th>
                      <th colSpan={7} className="font-medium">Liquidación</th>
                    </tr>
                    <tr className="text-left text-sm text-[var(--texto-tenue)]">
                      <th className={TH}>Alumno</th>
                      <th className={THR}>Precio</th>
                      <th className={THR}>Desc.</th>
                      <th className={THR}>Pagado</th>
                      <th className={THR}>Saldo</th>
                      <th className={TH}>Clases</th>
                      <th className={TH}>Bono</th>
                      <th className={THR}>Base</th>
                      <th className={THR}>%</th>
                      <th className={THR}>A la fecha</th>
                      <th className={THR}>Ya liquidado</th>
                      <th className="py-2 font-medium text-right">Este cierre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vista.regulares.map((l) => (
                      <tr key={`${l.membresiaId}-${l.curso}`} className="border-t border-[var(--borde)] align-top">
                        <td className={TD}>
                          {l.alumno}
                          <div className="text-[11px] text-[var(--texto-tenue)] whitespace-nowrap">
                            {l.curso} · {siglaCriterio(l.criterio)} · {textoCiclo(l.inicio, l.fin)}
                          </div>
                        </td>
                        <td className={TDR}>{gs(l.cuenta.precio)}</td>
                        <td className={TDR}>{montoOGuion(l.cuenta.descuento)}</td>
                        <td className={TDR}>{gs(l.cuenta.pagado)}</td>
                        <td className={TDR}>{montoOGuion(l.cuenta.saldo)}</td>
                        <td className={`${TD} tabular-nums`}>
                          {l.soloLiquidado ? "—" : `${l.clases}/${l.clasesDelCurso}`}
                        </td>
                        <td className={`${TD} tabular-nums`}>{textoBonoAplicado(l.bonoAplicado)}</td>
                        <td className={TDR}>{gs(l.base)}</td>
                        <td className={TDR}>{l.pct}%</td>
                        <td className={TDR}>{gs(l.aLaFecha)}</td>
                        <td className={TDR}>{textoYaLiquidado(l)}</td>
                        <td className="py-2 text-right tabular-nums whitespace-nowrap font-semibold">{montoOGuion(l.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Leyenda criterios={vista.regulares.map((l) => l.criterio)} />
              </div>
            )}

            <h3 className="text-base font-semibold mt-5">Clases particulares</h3>
            {vista.particulares.length === 0 ? (
              <p className="text-base text-[var(--texto-tenue)]">Nada que devengar por clases particulares.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="text-center text-xs text-[var(--texto-tenue)]">
                      <th />
                      <th colSpan={4} className="font-medium">Cuenta del alumno</th>
                      <th colSpan={5} className="font-medium">Liquidación</th>
                    </tr>
                    <tr className="text-left text-sm text-[var(--texto-tenue)]">
                      <th className={TH}>Alumno</th>
                      <th className={THR}>Precio</th>
                      <th className={THR}>Desc.</th>
                      <th className={THR}>Pagado</th>
                      <th className={THR}>Saldo</th>
                      <th className={TH}>Horas</th>
                      <th className={TH}>Forma de pago</th>
                      <th className={THR}>A la fecha</th>
                      <th className={THR}>Ya liquidado</th>
                      <th className="py-2 font-medium text-right">Este cierre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vista.particulares.map((l) => (
                      <tr key={l.membresiaId} className="border-t border-[var(--borde)] align-top">
                        <td className={TD}>
                          {l.alumno}
                          <div className="text-[11px] text-[var(--texto-tenue)] whitespace-nowrap">
                            Clase particular · {siglaCriterio(l.criterio)} · {textoCiclo(l.inicio, l.fin)}
                          </div>
                        </td>
                        <td className={TDR}>{gs(l.cuenta.precio)}</td>
                        <td className={TDR}>{montoOGuion(l.cuenta.descuento)}</td>
                        <td className={TDR}>{gs(l.cuenta.pagado)}</td>
                        <td className={TDR}>{montoOGuion(l.cuenta.saldo)}</td>
                        <td className={`${TD} tabular-nums whitespace-nowrap`}>
                          {cantidad(l.horasDadas)} de {cantidad(l.horasContratadas)} h
                        </td>
                        <td className={TD}>{l.forma.replace("_", " ")}</td>
                        <td className={TDR}>{gs(l.aLaFecha)}</td>
                        <td className={TDR}>{textoYaLiquidado(l)}</td>
                        <td className="py-2 text-right tabular-nums whitespace-nowrap font-semibold">{montoOGuion(l.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Leyenda criterios={vista.particulares.map((l) => l.criterio)} />
              </div>
            )}

            <dl className="mt-5 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 max-w-md text-base">
              <dt>Cierre de cuentas (regulares)</dt>
              <dd className="text-right tabular-nums">{gs(vista.totales.regulares)}</dd>
              <dt>Cierre de cuentas (particulares)</dt>
              <dd className="text-right tabular-nums">{gs(vista.totales.particulares)}</dd>
              <dt className="font-semibold">Cierre que se devenga ahora</dt>
              <dd className="text-right tabular-nums font-semibold">{gs(vista.totales.cierre)}</dd>
              <dt>
                Saldo previo sin pagar
                {vista.totales.saldoDesglose.liquidaciones.length > 0 && (
                  <span className="text-sm text-[var(--texto-tenue)]"> · N° {vista.totales.saldoDesglose.liquidaciones.join(", ")}</span>
                )}
              </dt>
              <dd className="text-right tabular-nums">{gs(vista.totales.saldoPrevio)}</dd>
              <dt className="text-lg font-bold border-t border-[var(--borde)] pt-2">Total a pagarle</dt>
              <dd className="text-lg font-bold text-right tabular-nums border-t border-[var(--borde)] pt-2">
                {gs(vista.totales.aPagar)}
              </dd>
            </dl>
          </section>
          )}

          <section>
            <h2 className="text-xl font-bold mb-1">Membresías activas que quedan inconclusas · {vista.inconclusas.length}</h2>
            <p className="text-base text-[var(--texto-tenue)] mb-2">
              Una línea por membresía. Siguen con el sustituto o sin titular, según lo elegido.
            </p>
            {vista.inconclusas.length === 0 ? (
              <p className="text-base">No quedan membresías sin terminar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="text-center text-xs text-[var(--texto-tenue)]">
                      <th colSpan={4} />
                      <th colSpan={2} className="font-medium">Bono</th>
                      <th colSpan={4} className="font-medium">Cuenta del alumno</th>
                    </tr>
                    <tr className="text-left text-sm text-[var(--texto-tenue)]">
                      <th className={TH}>Alumno</th>
                      <th className={TH}>Cursos / plan</th>
                      <th className={TH}>Ciclo</th>
                      <th className={TH}>Avance</th>
                      <th className={TH}>Aplicado</th>
                      <th className={TH}>Para renovar</th>
                      <th className={THR}>Precio</th>
                      <th className={THR}>Desc.</th>
                      <th className={THR}>Pagado</th>
                      <th className="py-2 font-medium text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vista.inconclusas.map((m) => (
                      <tr key={`${m.tipo}-${m.membresiaId}`} className="border-t border-[var(--borde)] align-top">
                        <td className={TD}>{m.alumno}</td>
                        <td className={TD}>
                          {m.detalle}
                          <div className="text-sm text-[var(--texto-tenue)]">
                            {m.plan !== m.detalle ? `${m.plan} · ` : ""}
                            {siglaCriterio(m.criterio)}
                          </div>
                        </td>
                        <td className={`${TD} tabular-nums whitespace-nowrap`}>
                          {fechaCorta(m.inicio)}
                          <div>{fechaCorta(m.fin)}</div>
                        </td>
                        <td className={`${TD} tabular-nums`}>
                          {avanceEnDosLineas(m).principal}
                          <div className="text-sm text-[var(--texto-tenue)]">{avanceEnDosLineas(m).resto}</div>
                        </td>
                        <td className={`${TD} tabular-nums`}>{textoBonoAplicado(m.bonoAplicado)}</td>
                        <td className={`${TD} tabular-nums`}>{textoBonoGenerado(m)}</td>
                        <td className={TDR}>{gs(m.cuenta.precio)}</td>
                        <td className={TDR}>{montoOGuion(m.cuenta.descuento)}</td>
                        <td className={TDR}>{gs(m.cuenta.pagado)}</td>
                        <td className="py-2 text-right tabular-nums whitespace-nowrap">
                          {montoOGuion(m.cuenta.saldo)}
                          {m.cuenta.saldo > 0 && <div className="text-sm text-[var(--texto-tenue)]">con saldo</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Leyenda criterios={vista.inconclusas.map((m) => m.criterio)} />
              </div>
            )}
          </section>

          {avisosVisibles.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-2">A tener en cuenta</h2>
              <ul className="list-disc pl-6 text-base text-[var(--texto-tenue)] flex flex-col gap-1">
                {avisosVisibles.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 flex-wrap">
        {!vista?.puedeConfirmar && vista && (
          <span className="text-base text-[var(--texto-tenue)]">Resolvé las trabas para poder confirmar.</span>
        )}
        <button
          type="button"
          onClick={confirmar}
          disabled={!vista?.puedeConfirmar || calculando || confirmando}
          className={BOTON_PRIMARIO}
        >
          {confirmando ? "Retirando…" : "Confirmar retiro"}
        </button>
      </div>
    </div>
  );
}
