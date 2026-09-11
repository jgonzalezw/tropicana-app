"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Alumno, DatosAlumno } from "@/lib/tipos";
import EntidadAlumno from "@/components/entidades/EntidadAlumno";
import Cobro, { type PayloadCobro } from "@/components/Cobro";
import Toggle from "@/components/Toggle";
import { etiquetaDias } from "@/components/entidades/EntidadCurso";
import { fechaLarga, gs, isoFecha } from "@/lib/inscripcion";
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
}: {
  alumnos: Alumno[];
  planes: PlanVenta[];
  diasCompromiso: number;
  medios: string[];
  canales: Canal[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [remountAlumno, setRemountAlumno] = useState(0);
  const [plan, setPlan] = useState<PlanVenta | null>(null);
  const [cursoIds, setCursoIds] = useState<number[]>([]);
  const [acompanantes, setAcompanantes] = useState("0");
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
  const fechaInicio = retroActivo && fechaRetro ? fechaRetro : isoFecha(hoy);

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
    setCobro(null);
    setError(null);
  }
  function toggleCurso(id: number) {
    setError(null);
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

            <div className="mt-4">
              <Toggle
                checked={retroActivo}
                onChange={(v) => {
                  setRetroActivo(v);
                  if (!v) setFechaRetro("");
                  setError(null);
                }}
                label="La prueba fue en una fecha pasada"
                descripcion="Para registrar una prueba que ya ocurrió. Apagado, se toma hoy."
              />
              {retroActivo && (
                <label className="block max-w-[220px] mt-2">
                  <span className="block text-base font-medium mb-1.5">¿Qué día fue?</span>
                  <input
                    type="date"
                    value={fechaRetro}
                    max={isoFecha(hoy)}
                    onChange={(e) => {
                      setFechaRetro(e.target.value);
                      setError(null);
                    }}
                    className="entrada"
                  />
                </label>
              )}
            </div>
          </section>

          {/* 3 · Cobro */}
          {plan && cursoIds.length > 0 && (
            <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
              <h2 className="titulo text-xl mb-1">Cobro</h2>
              <p className="text-sm text-[var(--texto-tenue)] mb-3">
                {gs(porPersona)} por persona × {personas}{" "}
                {personas === 1 ? "persona" : "personas"} = {gs(total)}. Empieza el{" "}
                {fechaLarga(new Date(fechaInicio + "T00:00:00"))}.
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
