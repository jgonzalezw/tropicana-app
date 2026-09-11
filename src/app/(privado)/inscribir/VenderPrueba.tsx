"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Alumno, DatosAlumno } from "@/lib/tipos";
import EntidadAlumno from "@/components/entidades/EntidadAlumno";
import Cobro, { type PayloadCobro } from "@/components/Cobro";
import Toggle from "@/components/Toggle";
import { etiquetaDias } from "@/components/entidades/EntidadCurso";
import { diaIso, fechaLarga, gs, isoFecha, proximasClases } from "@/lib/inscripcion";
import { crearAlumnoDesdeInscripcion, venderPrueba } from "./acciones";
import type { PlanVenta } from "./ClienteInscribir";

type Canal = { valor: string; etiqueta: string };

/**
 * Vender una clase de prueba. Es una **membresía preliminar** del mismo plan
 * regular, no un plan aparte (regla 11 de `docs/REGLAS.md`).
 *
 * Tres decisiones del modelo que se ven en pantalla:
 *  - El monto NO es el precio del plan: es la suma del precio de prueba de los
 *    cursos elegidos, por la cantidad de personas.
 *  - Los cursos se eligen **al comprar** — por eso el monto se conoce acá.
 *  - El grupo es un titular identificado más N acompañantes sin nombre, con un
 *    solo monto: todos van a la misma clase.
 */
export default function VenderPrueba({
  alumnos,
  planes,
  diasCompromiso,
  medios,
  canales,
  suspendidas,
}: {
  alumnos: Alumno[];
  planes: PlanVenta[];
  diasCompromiso: number;
  medios: string[];
  canales: Canal[];
  suspendidas: string[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [remountAlumno, setRemountAlumno] = useState(0);
  const [plan, setPlan] = useState<PlanVenta | null>(null);
  const [cursoIds, setCursoIds] = useState<number[]>([]);
  const [acompanantes, setAcompanantes] = useState("0");
  const [fechaIdx, setFechaIdx] = useState(0);
  const [retroActivo, setRetroActivo] = useState(false);
  const [fechaRetro, setFechaRetro] = useState("");
  const [cobro, setCobro] = useState<PayloadCobro | null>(null);
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hoy = useMemo(() => new Date(), []);
  const maxCompromiso = useMemo(() => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    d.setDate(d.getDate() + Math.max(1, diasCompromiso));
    return d;
  }, [hoy, diasCompromiso]);

  // Solo los planes que se ofrecen a prueba y tienen algún curso con precio.
  const planesPrueba = useMemo(
    () => planes.filter((p) => p.aceptaPrueba && p.cursos.some((c) => (c.precioPrueba ?? 0) > 0)),
    [planes]
  );

  const cursosProbables = plan?.cursos.filter((c) => (c.precioPrueba ?? 0) > 0) ?? [];
  const tope = plan?.pruebaCursosMax ?? 1;
  const personas = 1 + Math.max(0, Math.trunc(Number(acompanantes) || 0));
  const porPersona = cursoIds.reduce(
    (t, id) => t + (cursosProbables.find((c) => c.id === id)?.precioPrueba ?? 0),
    0
  );
  const total = porPersona * personas;

  const susp = useMemo(() => new Set(suspendidas), [suspendidas]);

  // ¿Qué día viene a probar? La fecha de la venta NO es la fecha de la clase:
  // se vende un viernes una prueba de un curso que es lunes y miércoles. Mismo
  // selector que la inscripción: las próximas clases de los cursos elegidos,
  // salteando las suspendidas — igual criterio que el motor (regla 4), para
  // que la pantalla no diga una fecha y la base guarde otra.
  const elegidos = useMemo(
    () => cursoIds.map((id) => cursosProbables.find((c) => c.id === id)).filter((c) => !!c),
    // cursosProbables se deriva de `plan`, que ya está en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cursoIds, plan]
  );
  const fechas = useMemo(() => {
    if (!elegidos.length) return [] as Date[];
    const dias = [...new Set(elegidos.flatMap((c) => c.dias_semana ?? []))];
    // Una fecha sirve si algún curso elegido dicta ese día y no está suspendida.
    return proximasClases(dias, 12, hoy)
      .filter((d) =>
        elegidos.some(
          (c) => (c.dias_semana ?? []).includes(diaIso(d)) && !susp.has(`${c.id}|${isoFecha(d)}`)
        )
      )
      .slice(0, 3);
  }, [elegidos, hoy, susp]);

  const fechaElegida = fechas[Math.min(fechaIdx, Math.max(0, fechas.length - 1))] ?? hoy;
  const fechaInicio = retroActivo && fechaRetro ? fechaRetro : isoFecha(fechaElegida);

  // Qué clase le toca a cada curso desde esa fecha (con varios cursos, cada
  // uno cae en su propio día).
  const cuandoAsiste = useMemo(() => {
    const desde = new Date(fechaInicio + "T00:00:00");
    return elegidos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      hora: c.hora,
      fecha:
        proximasClases(c.dias_semana ?? [], 20, desde).find(
          (d) => !susp.has(`${c.id}|${isoFecha(d)}`)
        ) ?? null,
    }));
  }, [elegidos, fechaInicio, susp]);

  async function guardarAlumnoNuevo(datos: DatosAlumno) {
    const res = await crearAlumnoDesdeInscripcion(datos);
    if (res.alumno) {
      setAlumno(res.alumno);
      setError(null);
    }
    return { error: res.error };
  }

  function elegirPlan(p: PlanVenta) {
    setPlan(p);
    setCursoIds([]);
    setFechaIdx(0);
    setCobro(null);
    setError(null);
  }
  function toggleCurso(id: number) {
    setError(null);
    setFechaIdx(0);
    setCursoIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= tope) return prev; // el tope lo pone el plan
      return [...prev, id];
    });
  }

  const faltaSaldo = cobro ? cobro.saldo > 0 : false;
  const fechaCompromisoEfectiva = fechaCompromiso || isoFecha(maxCompromiso);

  function confirmar() {
    setError(null);
    setAviso(null);
    if (!alumno) return setError("Elegí el alumno titular.");
    if (!plan) return setError("Elegí el plan que va a probar.");
    if (!cursoIds.length) return setError("Elegí al menos un curso para probar.");
    if (retroActivo && !fechaRetro) return setError("Cargá la fecha de la prueba.");
    if (cobro && !cobro.valido)
      return setError("Revisá el monto, el medio de pago o el motivo del descuento.");

    startTransition(async () => {
      const res = await venderPrueba({
        alumnoId: alumno.id,
        planId: plan.id,
        cursoIds,
        acompanantes: personas - 1,
        fechaInicio,
        cobro: {
          modo: cobro?.modo ?? "sin",
          monto: cobro ? cobro.total - cobro.saldo : 0,
          medio: cobro?.medio ?? null,
          notaMedio: cobro?.notaMedio ?? "",
          ajuste: cobro?.ajuste ?? 0,
          ajusteMotivo: cobro?.ajusteMotivo ?? "",
          total,
          saldo: cobro?.saldo ?? total,
          fechaCompromiso: faltaSaldo ? fechaCompromisoEfectiva : null,
        },
      });
      if (res.error) return setError(res.error);
      setAviso(res.resumen ?? "Clase de prueba registrada.");
      setAlumno(null);
      setRemountAlumno((n) => n + 1);
      setPlan(null);
      setCursoIds([]);
      setAcompanantes("0");
      setFechaIdx(0);
      setCobro(null);
      setRetroActivo(false);
      setFechaRetro("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {aviso && (
        <div className="rounded-[var(--radio-panel)] bg-[var(--exito-fill)] text-[var(--exito-texto)] p-4 text-base">
          {aviso}
        </div>
      )}

      {planesPrueba.length === 0 ? (
        <div className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-6">
          <p className="text-base">Todavía no hay ningún plan que se pueda probar.</p>
          <p className="text-sm text-[var(--texto-tenue)] mt-1">
            Hacen falta dos cosas: encender <strong>&quot;Se puede probar antes de comprar&quot;</strong> en
            el plan, y cargar el <strong>precio de la clase de prueba</strong> en la ficha de sus
            cursos.
          </p>
        </div>
      ) : (
        <>
          {/* 1 · Quién viene */}
          <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
            <h2 className="titulo text-xl mb-3">¿Quién viene a probar?</h2>
            <EntidadAlumno
              key={remountAlumno}
              padron={alumnos}
              canales={canales}
              abrirAlElegir={false}
              onSelect={(al) => {
                setAlumno(al);
                setError(null);
              }}
              onGuardar={guardarAlumnoNuevo}
            />
            {alumno && (
              <div className="mt-3 rounded-[var(--radio-panel)] border border-[var(--borde)] p-3">
                <div className="text-lg font-semibold">
                  {alumno.apellido}, {alumno.nombre}
                </div>
                <label className="block mt-3 max-w-[260px]">
                  <span className="block text-base font-medium mb-1.5">
                    ¿Cuántos vienen con él o ella?
                  </span>
                  <input
                    value={acompanantes}
                    onChange={(e) => setAcompanantes(e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    className="entrada"
                  />
                  <span className="block text-sm text-[var(--texto-tenue)] mt-1.5">
                    Acompañantes sin nombre: solo cuentan para el monto y para el conteo de la
                    clase. Son {personas} {personas === 1 ? "persona" : "personas"} en total.
                  </span>
                </label>
              </div>
            )}
          </section>

          {/* 2 · Qué va a probar */}
          <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
            <h2 className="titulo text-xl mb-3">¿Qué va a probar?</h2>
            <div className="space-y-2">
              {planesPrueba.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => elegirPlan(p)}
                  className={`w-full text-left px-4 py-3 rounded-[var(--radio-control)] border ${
                    plan?.id === p.id
                      ? "border-[var(--primario)] bg-[var(--fondo-elevado)]"
                      : "border-[var(--borde)] hover:border-[var(--primario)]"
                  }`}
                >
                  <div className="text-base font-medium">{p.nombre}</div>
                  <div className="text-sm text-[var(--texto-tenue)]">
                    Prueba {p.pruebaCursosMax === 1 ? "1 curso" : `hasta ${p.pruebaCursosMax} cursos`}{" "}
                    de {p.cursos.length}, una clase en cada uno.
                  </div>
                </button>
              ))}
            </div>

            {plan && (
              <div className="mt-4">
                <span className="block text-base font-medium mb-1.5">
                  Cursos a probar ({cursoIds.length} de {tope})
                </span>
                <div className="space-y-2">
                  {cursosProbables.map((c) => {
                    const elegido = cursoIds.includes(c.id);
                    const bloqueado = !elegido && cursoIds.length >= tope;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={bloqueado}
                        onClick={() => toggleCurso(c.id)}
                        className={`w-full text-left px-4 py-2.5 rounded-[var(--radio-control)] border flex items-baseline justify-between gap-3 ${
                          elegido
                            ? "border-[var(--primario)] bg-[var(--fondo-elevado)]"
                            : "border-[var(--borde)] hover:border-[var(--primario)]"
                        } disabled:opacity-40`}
                      >
                        <span className="min-w-0">
                          <span className="block text-base">{c.nombre}</span>
                          <span className="block text-sm text-[var(--texto-tenue)]">
                            {etiquetaDias(c.dias_semana)}
                            {c.hora ? ` · ${c.hora.slice(0, 5)}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">{gs(c.precioPrueba ?? 0)}</span>
                      </button>
                    );
                  })}
                </div>
                {plan.cursos.length > cursosProbables.length && (
                  <p className="text-sm text-[var(--texto-tenue)] mt-2">
                    {plan.cursos.length - cursosProbables.length} curso(s) del plan no aparecen: les
                    falta el precio de prueba en su ficha.
                  </p>
                )}
              </div>
            )}

            {cursoIds.length > 0 && (
              <div className="mt-4">
                <div className="text-sm text-[var(--texto-tenue)] mb-1.5">
                  {retroActivo ? "Vino a probar el" : "Viene a probar el"}
                </div>
                {retroActivo ? (
                  <div>
                    <input
                      type="date"
                      value={fechaRetro}
                      max={isoFecha(hoy)}
                      onChange={(e) => {
                        setFechaRetro(e.target.value);
                        setError(null);
                      }}
                      className="entrada max-w-[200px]"
                    />
                    <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
                      Fecha real en que vino a la clase de prueba.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {fechas.map((f, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setFechaIdx(i)}
                        className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
                          fechaIdx === i
                            ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                            : "border-[var(--borde)] hover:border-[var(--primario)]"
                        }`}
                      >
                        {i === 0 && isoFecha(f) === isoFecha(hoy) ? "hoy " : ""}
                        {fechaLarga(f)}
                      </button>
                    ))}
                    {fechas.length === 0 && (
                      <span className="text-sm text-[var(--texto-tenue)]">
                        Ese curso no tiene próximas clases en los próximos días.
                      </span>
                    )}
                  </div>
                )}

                {/* A qué clase va exactamente: con varios cursos, cada uno cae
                    en su propio día, así que no alcanza con la fecha de inicio. */}
                <ul className="mt-3 space-y-1">
                  {cuandoAsiste.map((c) => (
                    <li key={c.id} className="text-base">
                      <span className="font-medium">{c.nombre}</span>:{" "}
                      {c.fecha ? (
                        <>
                          {fechaLarga(c.fecha)}
                          {c.hora ? ` · ${c.hora.slice(0, 5)}` : ""}
                        </>
                      ) : (
                        <span className="text-[var(--peligro)]">
                          sin clase disponible desde esa fecha
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-3">
                  <Toggle
                    checked={retroActivo}
                    onChange={(v) => {
                      setRetroActivo(v);
                      if (!v) setFechaRetro("");
                      setError(null);
                    }}
                    label="La prueba fue en una fecha pasada"
                    descripcion="Para registrar una prueba que ya ocurrió y no se cargó en su momento."
                  />
                </div>
              </div>
            )}
          </section>

          {/* 3 · Cobro */}
          {plan && cursoIds.length > 0 && (
            <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
              <h2 className="titulo text-xl mb-1">Cobro</h2>
              <p className="text-sm text-[var(--texto-tenue)] mb-3">
                {gs(porPersona)} por persona × {personas}{" "}
                {personas === 1 ? "persona" : "personas"} = {gs(total)}. Asiste{" "}
                {cuandoAsiste
                  .map((c) => `${c.nombre} el ${c.fecha ? fechaLarga(c.fecha) : "—"}`)
                  .join(" · ")}
                .
              </p>
              <Cobro
                sujeto={alumno ? `${alumno.apellido}, ${alumno.nombre}` : undefined}
                detalle={`Clase de prueba · ${plan.nombre}`}
                referencia={total}
                referenciaLabel="Precio de la prueba"
                politica="descuento"
                direccion="cobro"
                medios={medios}
                permitirSinCobro={false}
                cuentaId={`prueba:${plan.id}:${cursoIds.join("-")}:${personas}`}
                onChange={setCobro}
              />
              {faltaSaldo && (
                <div className="pt-3 mt-3 border-t border-[var(--borde)]">
                  <label className="text-sm text-[var(--texto-tenue)] block mb-1.5">
                    Fecha de compromiso de pago del saldo
                  </label>
                  <input
                    type="date"
                    value={fechaCompromisoEfectiva}
                    min={isoFecha(hoy)}
                    max={isoFecha(maxCompromiso)}
                    onChange={(e) => {
                      setFechaCompromiso(e.target.value);
                      setError(null);
                    }}
                    className="entrada max-w-[200px]"
                  />
                </div>
              )}
            </section>
          )}

          {error && (
            <p className="text-[var(--peligro)] text-base" role="alert">
              {error}
            </p>
          )}

          <button
            onClick={confirmar}
            disabled={pendiente}
            className="w-full px-5 py-3 text-lg font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
          >
            {pendiente ? "Guardando…" : `Registrar prueba · ${gs(total)}`}
          </button>
        </>
      )}
    </div>
  );
}
