"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Alumno, DatosAlumno } from "@/lib/tipos";
import EntidadAlumno from "@/components/entidades/EntidadAlumno";
import Cobro, { type PayloadCobro } from "@/components/Cobro";
import Toggle from "@/components/Toggle";
import {
  DIAS_LARGOS,
  diaIso,
  fechaClaseN,
  fechaLarga,
  gs,
  isoFecha,
  proximasClases,
} from "@/lib/inscripcion";
import { etiquetaDias } from "@/components/entidades/EntidadCurso";
import { crearAlumnoDesdeInscripcion, inscribirYCobrar } from "./acciones";

type Canal = { valor: string; etiqueta: string };
export type CursoPlan = {
  id: number;
  nombre: string;
  dias_semana: number[];
  hora: string | null;
  /** Precio de la prueba por alumno. `null` = este curso no se puede probar. */
  precioPrueba: number | null;
};
export type PlanVenta = {
  id: number;
  nombre: string;
  cantidadClases: number | null;
  precio: number;
  ilimitado: boolean;
  cicloDias: number | null;
  /** Si el plan se ofrece como clase de prueba. */
  aceptaPrueba: boolean;
  /** En cuántos cursos distintos se puede probar. */
  pruebaCursosMax: number;
  cursos: CursoPlan[];
};

export default function ClienteInscribir({
  alumnos,
  planes,
  diasCompromiso,
  medios,
  canales,
  cursosPorAlumno,
  deudaPorAlumno,
  planesActivosPorAlumno,
  bonoPorAlumnoPlan,
  suspendidas,
  creditoPruebaPorAlumnoPlan,
}: {
  alumnos: Alumno[];
  planes: PlanVenta[];
  diasCompromiso: number;
  medios: string[];
  canales: Canal[];
  cursosPorAlumno: Record<number, string[]>;
  deudaPorAlumno: Record<number, number>;
  planesActivosPorAlumno: Record<number, number[]>;
  bonoPorAlumnoPlan: Record<number, Record<number, number>>;
  /** Claves `cursoId|YYYY-MM-DD` de clases suspendidas: no son clase. */
  suspendidas: string[];
  /** Crédito de una clase de prueba sin convertir, por alumno y plan. */
  creditoPruebaPorAlumnoPlan: Record<number, Record<number, number>>;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [remountAlumno, setRemountAlumno] = useState(0);
  const [plan, setPlan] = useState<PlanVenta | null>(null);
  const [diasPorCurso, setDiasPorCurso] = useState<Record<number, number[]>>({});
  const [fechaIdx, setFechaIdx] = useState(0);
  const [retroActivo, setRetroActivo] = useState(false);
  const [fechaRetro, setFechaRetro] = useState<string>("");
  const [cobro, setCobro] = useState<PayloadCobro | null>(null);
  const [fechaCompromiso, setFechaCompromiso] = useState<string>("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hoy = useMemo(() => new Date(), []);
  const maxCompromiso = useMemo(() => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    d.setDate(d.getDate() + Math.max(1, diasCompromiso));
    return d;
  }, [hoy, diasCompromiso]);

  const ilimitado = plan?.ilimitado ?? false;
  const N = ilimitado ? null : plan?.cantidadClases ?? null;
  const precioPlan = plan?.precio ?? 0;
  // Bono de tolerancia pendiente del alumno para este plan (solo planes con N).
  const bono = !ilimitado && alumno && plan ? bonoPorAlumnoPlan[alumno.id]?.[plan.id] ?? 0 : 0;
  // Crédito de la clase de prueba de este mismo plan (regla 11). Se muestra
  // acá, antes de cobrar, pero el servidor lo vuelve a calcular al vender: la
  // pantalla propone, el servidor decide.
  const creditoPrueba =
    alumno && plan ? Math.min(creditoPruebaPorAlumnoPlan[alumno.id]?.[plan.id] ?? 0, plan.precio) : 0;
  /** Lo que queda por cobrar después de acreditarle la prueba. */
  const total = Math.max(0, precioPlan - creditoPrueba);
  const Nefectivo = N != null ? N + bono : null;

  // Lista con repetición: una entrada por (curso, día) elegido.
  const diasConteo = useMemo(() => {
    if (!plan) return [];
    const out: number[] = [];
    for (const c of plan.cursos) for (const d of diasPorCurso[c.id] ?? []) out.push(d);
    return out;
  }, [plan, diasPorCurso]);

  const unionDias = useMemo(() => Array.from(new Set(diasConteo)).sort(), [diasConteo]);
  const susp = useMemo(() => new Set(suspendidas), [suspendidas]);
  /** ¿Ese día hay clase de alguno de los cursos elegidos, y no está suspendida? */
  const hayClaseReal = useCallback(
    (d: Date) => {
      const dia = diaIso(d);
      const iso = isoFecha(d);
      return Object.entries(diasPorCurso).some(
        ([cid, dias]) => dias.includes(dia) && !susp.has(`${cid}|${iso}`)
      );
    },
    [diasPorCurso, susp]
  );

  // Fechas de inicio ofrecidas. Hacia adelante, las próximas 3 clases; hacia
  // atrás (inscripción retroactiva), las últimas 6 que YA se dictaron. Antes
  // acá había un campo de fecha libre: dejaba elegir un día en que el curso no
  // se dicta, o una clase suspendida, y la membresía arrancaba en un día que
  // no existe.
  const fechas = useMemo(() => {
    if (!plan) return [] as Date[];
    if (!retroActivo) return proximasClases(unionDias, 12, hoy).filter(hayClaseReal).slice(0, 3);
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    desde.setDate(desde.getDate() - 60);
    return proximasClases(unionDias, 40, desde)
      .filter((d) => isoFecha(d) <= isoFecha(hoy) && hayClaseReal(d))
      .slice(-6)
      .reverse();
  }, [plan, unionDias, hoy, retroActivo, hayClaseReal]);
  const fechaProxima = fechas[Math.min(fechaIdx, Math.max(0, fechas.length - 1))] ?? null;
  const fechaRetroDate = useMemo(
    () => (retroActivo ? parseFechaLocal(fechaRetro) : null),
    [retroActivo, fechaRetro]
  );
  void fechaRetroDate;
  const fechaSel = fechaProxima;
  const fechaFin = !fechaSel
    ? null
    : ilimitado
    ? plan?.cicloDias
      ? sumarDias(fechaSel, plan.cicloDias)
      : null
    : Nefectivo
    ? fechaClaseN(diasConteo, fechaSel, Nefectivo)
    : null;

  const mueve = cobro ? Math.max(0, cobro.total - cobro.saldo) : 0;
  const saldoActual = cobro ? cobro.saldo : total;
  const pideCompromiso = total > 0 && saldoActual > 0;
  const fechaCompromisoEfectiva = fechaCompromiso || isoFecha(maxCompromiso);

  const yaTiene = !!alumno && !!plan && (planesActivosPorAlumno[alumno.id] ?? []).includes(plan.id);
  const cuentaId = plan
    ? `${plan.id}·${fechaIdx}·${plan.cursos.map((c) => (diasPorCurso[c.id] ?? []).join("")).join("-")}`
    : "";

  function resetTodo() {
    setAlumno(null);
    setRemountAlumno((n) => n + 1);
    setPlan(null);
    setDiasPorCurso({});
    setFechaIdx(0);
    setRetroActivo(false);
    setFechaRetro("");
    setCobro(null);
    setFechaCompromiso("");
    setError(null);
  }
  function elegirPlan(p: PlanVenta) {
    setPlan(p);
    // Por defecto, todos los días de cada curso.
    const init: Record<number, number[]> = {};
    for (const c of p.cursos) init[c.id] = [...c.dias_semana];
    setDiasPorCurso(init);
    setFechaIdx(0);
    setRetroActivo(false);
    setFechaRetro("");
    setCobro(null);
    setFechaCompromiso("");
    setError(null);
  }
  function toggleDia(cursoId: number, dia: number) {
    setDiasPorCurso((prev) => {
      const actual = prev[cursoId] ?? [];
      const next = actual.includes(dia) ? actual.filter((d) => d !== dia) : [...actual, dia].sort();
      return { ...prev, [cursoId]: next };
    });
    setFechaIdx(0);
  }

  async function guardarAlumnoNuevo(datos: DatosAlumno) {
    const res = await crearAlumnoDesdeInscripcion(datos);
    if (res.alumno) {
      setAlumno(res.alumno);
      setError(null);
    }
    return { error: res.error };
  }

  function confirmar() {
    setError(null);
    if (!alumno) return setError("Falta elegir o cargar el alumno.");
    if (!plan) return setError("Falta elegir el plan.");
    if (yaTiene) return setError("Este alumno ya tiene una membresía activa de este plan.");
    if (ilimitado) {
      if (!plan.cicloDias) return setError("El plan ilimitado no tiene duración de ciclo. Cargala en Planes.");
    } else if (!N || N <= 0) {
      return setError("El plan no tiene una cantidad de clases (N) cargada. Cargala en Planes.");
    }
    if (diasConteo.length === 0) return setError("Elegí al menos un día de clase.");
    if (!fechaSel) return setError("No hay una fecha de inicio válida.");
    if (cobro && cobro.modo !== "sin" && mueve > 0 && !cobro.medio) return setError("Elegí el medio de pago.");
    if (cobro && cobro.ajuste > 0 && !cobro.ajusteMotivo.trim()) return setError("El descuento necesita un motivo.");
    if (pideCompromiso && !fechaCompromisoEfectiva) return setError("Cargá la fecha de compromiso de pago.");

    const c = cobro;
    const diasPorCursoOut = plan.cursos
      .map((cu) => ({ cursoId: cu.id, dias: diasPorCurso[cu.id] ?? [] }))
      .filter((x) => x.dias.length > 0);

    startTransition(async () => {
      const res = await inscribirYCobrar({
        alumnoId: alumno.id,
        planId: plan.id,
        fechaInicio: isoFecha(fechaSel),
        diasPorCurso: diasPorCursoOut,
        cobro: {
          modo: c?.modo ?? "sin",
          monto: c?.monto ?? 0,
          medio: c?.medio ?? null,
          notaMedio: c?.notaMedio ?? "",
          ajuste: c?.ajuste ?? 0,
          ajusteMotivo: c?.ajusteMotivo ?? "",
          total: c?.total ?? total,
          saldo: c?.saldo ?? total,
          fechaCompromiso: pideCompromiso ? fechaCompromisoEfectiva : null,
        },
      });
      if (res.error) setError(res.error);
      else {
        resetTodo();
        setAviso(res.resumen ?? "Membresía registrada.");
        router.refresh();
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const limiteOk = ilimitado ? !!plan?.cicloDias : !!N;
  const puedeConfirmar =
    !!alumno && !!plan && !!fechaSel && limiteOk && diasConteo.length > 0 && !pendiente && !yaTiene;

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto pb-28">
      <div className="mb-6">
        <h1 className="text-3xl">Inscribir y cobrar</h1>
        <p className="text-[var(--texto-tenue)] mt-2 text-lg">
          Alumno, plan y primer cobro en una sola pantalla.
        </p>
      </div>

      {aviso && (
        <div className="mb-4 flex items-start gap-3 rounded-[var(--radio-panel)] bg-[var(--exito-fill)] text-[var(--exito-texto)] p-4">
          <span className="text-lg leading-none mt-0.5">✓</span>
          <div className="flex-1 text-base leading-relaxed">{aviso}</div>
          <button onClick={() => setAviso(null)} className="text-sm shrink-0 underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Paso 1 — Alumno */}
      <Paso n={1} titulo="Alumno">
        {alumno ? (
          <div className="rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold">
                  {alumno.apellido}, {alumno.nombre}
                </div>
                <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
                  {alumno.es_menor
                    ? `menor · tutor ${alumno.tutor_whatsapp || "—"}`
                    : alumno.whatsapp || "sin WhatsApp"}
                </div>
              </div>
              <button
                onClick={() => {
                  setAlumno(null);
                  setRemountAlumno((n) => n + 1);
                }}
                className="text-[var(--primario)] text-base shrink-0"
              >
                Cambiar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Mini etiqueta="Deuda anterior" valor={gs(deudaPorAlumno[alumno.id] ?? 0)} />
              <Mini
                etiqueta="Ya inscripto en"
                valor={
                  (cursosPorAlumno[alumno.id] ?? []).length
                    ? cursosPorAlumno[alumno.id].join(" · ")
                    : "Ningún curso todavía"
                }
              />
            </div>
          </div>
        ) : (
          <EntidadAlumno
            key={remountAlumno}
            padron={alumnos}
            canales={canales}
            abrirAlElegir={false}
            onSelect={(a) => {
              setAlumno(a);
              setError(null);
            }}
            onGuardar={guardarAlumnoNuevo}
          />
        )}
      </Paso>

      {/* Paso 2 — Plan */}
      <Paso n={2} titulo="Plan y días">
        {!alumno ? (
          <p className="text-[var(--texto-tenue)]">Elegí primero el alumno.</p>
        ) : !plan ? (
          <div className="space-y-2">
            {planes.map((p) => (
              <button
                key={p.id}
                onClick={() => elegirPlan(p)}
                className="w-full flex items-center gap-3 text-left rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] border border-[var(--borde)] px-4 py-3 hover:border-[var(--primario)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold">{p.nombre}</div>
                  <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
                    {p.cursos.map((c) => c.nombre).join(" · ")}
                    {p.ilimitado ? " · ilimitado" : p.cantidadClases ? ` · ${p.cantidadClases} clases` : ""}
                  </div>
                </div>
                <div className="text-base font-bold shrink-0">{gs(p.precio)}</div>
              </button>
            ))}
            {planes.length === 0 && (
              <p className="text-[var(--texto-tenue)]">
                No hay planes activos. Cargá uno en Gestión → Planes.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold">{plan.nombre}</div>
                <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
                  {ilimitado ? "Ilimitado · " : N ? `${N} clases · ` : ""}
                  {gs(plan.precio)}
                </div>
              </div>
              <button onClick={() => setPlan(null)} className="text-[var(--primario)] text-base shrink-0">
                Cambiar
              </button>
            </div>

            {yaTiene && (
              <div className="rounded-[var(--radio-panel)] border border-[var(--primario)] bg-[var(--accent-100)] px-4 py-3 text-sm text-[var(--peligro-texto)]">
                Este alumno ya tiene una membresía activa de este plan. La renovación se hará desde su
                membresía (próximamente); acá no se duplica.
              </div>
            )}

            {/* Días por curso */}
            {plan.cursos.map((c) => (
              <div key={c.id}>
                <div className="text-sm text-[var(--texto-tenue)] mb-1.5">
                  {c.nombre}
                  {c.hora ? ` · ${c.hora.slice(0, 5)}` : ""} — qué días toma
                </div>
                {c.dias_semana.length === 0 ? (
                  <div className="text-sm text-[var(--peligro-texto)]">
                    Este curso no tiene días cargados (revisá el curso).
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {c.dias_semana.map((d) => {
                      const on = (diasPorCurso[c.id] ?? []).includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() => toggleDia(c.id, d)}
                          className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
                            on
                              ? "bg-[var(--exito-fill)] text-[var(--exito-texto)] border-[var(--exito)] font-medium"
                              : "bg-[var(--fondo-panel)] text-[var(--texto-tenue)] border-[var(--borde)] hover:border-[var(--primario)]"
                          }`}
                        >
                          {on ? "✓ " : ""}
                          {DIAS_LARGOS[d]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Resumen del calendario */}
            <div className="text-sm text-[var(--texto-tenue)]">
              {diasConteo.length > 0
                ? `${diasConteo.length} ${diasConteo.length === 1 ? "clase" : "clases"} por semana · ${etiquetaDias(unionDias)}`
                : "Elegí al menos un día."}
            </div>

            {/* Fecha de inicio */}
            <div>
              <div className="text-sm text-[var(--texto-tenue)] mb-1.5">Empieza a tomar clases</div>
              {(
                <div className="flex flex-wrap gap-2">
                  {fechas.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => setFechaIdx(i)}
                      className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
                        fechaIdx === i
                          ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                          : "border-[var(--borde)] hover:border-[var(--primario)]"
                      }`}
                    >
                      {i === 0 && esHoy(f, hoy) ? "hoy " : ""}
                      {fechaLarga(f)}
                    </button>
                  ))}
                  {fechas.length === 0 && (
                    <span className="text-sm text-[var(--texto-tenue)]">
                      {retroActivo
                        ? "No hay clases dictadas en los últimos dos meses para esos días."
                        : "Elegí días para ver fechas de inicio."}
                    </span>
                  )}
                </div>
              )}
              {retroActivo && (
                <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
                  Clases que ya se dictaron. Se usa para reconstruir un ciclo cuyo registro se
                  omitió en su momento.
                </p>
              )}

              <div className="mt-3">
                <Toggle
                  checked={retroActivo}
                  onChange={(v) => {
                    setRetroActivo(v);
                    setError(null);
                  }}
                  label="Fecha retroactiva"
                  descripcion="Para registrar una inscripción pasada que se omitió, con su fecha real."
                />
              </div>

              {creditoPrueba > 0 && (
                <div className="mt-3 rounded-[var(--radio-panel)] border border-[var(--exito)] bg-[var(--exito-fill)] text-[var(--exito-texto)] px-4 py-2.5 text-sm">
                  Se le acredita su <strong>clase de prueba</strong>: {gs(creditoPrueba)} menos sobre{" "}
                  {gs(precioPlan)}. A cobrar <strong>{gs(total)}</strong>.
                </div>
              )}

              {bono > 0 && (
                <div className="mt-3 rounded-[var(--radio-panel)] border border-[var(--exito)] bg-[var(--exito-fill)] text-[var(--exito-texto)] px-4 py-2.5 text-sm">
                  Se aplicará bono de tolerancia: <strong>+{bono} {bono === 1 ? "clase" : "clases"}</strong> por
                  falta{bono === 1 ? "" : "s"} con licencia del ciclo anterior. El nuevo ciclo es de{" "}
                  <strong>{Nefectivo} clases</strong> (incluye la clase de tolerancia).
                </div>
              )}

              <div className="text-sm text-[var(--texto-tenue)] mt-2">
                {retroActivo && !fechaSel
                  ? "Elegí la fecha real de inicio."
                  : ilimitado
                  ? `Membresía ilimitada.${fechaFin ? ` Termina el ${fechaLarga(fechaFin)}.` : ""}`
                  : Nefectivo
                  ? `Membresía de ${Nefectivo} clases${bono > 0 ? ` (${N} + ${bono} bono)` : ""}.${
                      fechaFin ? ` Termina aprox. el ${fechaLarga(fechaFin)}.` : ""
                    }`
                  : "El plan no tiene N de clases cargado."}
              </div>
            </div>
          </div>
        )}
      </Paso>

      {/* Paso 3 — Cobro */}
      <Paso n={3} titulo="Cobro del ciclo">
        {!plan ? (
          <p className="text-[var(--texto-tenue)]">Elegí el plan para ver el cobro.</p>
        ) : (
          <div className="rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] p-4 space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-base text-[var(--texto-tenue)]">
                {plan.nombre}
                {ilimitado ? " · ilimitado" : N ? ` · ${N} clases` : ""}
              </span>
              <span className="ml-auto titulo text-2xl">{gs(total)}</span>
            </div>

            <Cobro
              referencia={total}
              referenciaLabel="A cobrar"
              politica="descuento"
              direccion="cobro"
              medios={medios}
              cuentaId={cuentaId}
              onChange={(p) => {
                setCobro(p);
                setError(null);
              }}
            />

            {pideCompromiso && (
              <div className="pt-2 border-t border-[var(--borde)]">
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
                <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
                  Queda saldo pendiente. Debe pagarse a más tardar esta fecha (máx. {diasCompromiso} días
                  desde hoy).
                </p>
              </div>
            )}
          </div>
        )}
      </Paso>

      {error && (
        <p className="text-[var(--peligro)] text-base mt-4" role="alert">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-6 sm:-mx-8 mt-6 px-6 sm:px-8 py-4 bg-[var(--fondo-panel)] border-t border-[var(--borde)]">
        <div className="flex items-baseline mb-2">
          <span className="text-sm text-[var(--texto-tenue)]">
            {!alumno ? "Sin alumno todavía" : !plan ? "Falta el plan" : "Cobra hoy"}
          </span>
          <span className="ml-auto titulo text-2xl">{gs(mueve)}</span>
        </div>
        <button
          onClick={confirmar}
          disabled={!puedeConfirmar}
          className="w-full px-5 py-3 text-lg font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
        >
          {pendiente ? "Guardando…" : "Confirmar inscripción"}
        </button>
      </div>
    </div>
  );
}

function sumarDias(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** Parsea YYYY-MM-DD como fecha local (sin corrimiento de zona horaria). */
function parseFechaLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function esHoy(d: Date, hoy: Date): boolean {
  return (
    d.getFullYear() === hoy.getFullYear() &&
    d.getMonth() === hoy.getMonth() &&
    d.getDate() === hoy.getDate()
  );
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-5 mb-3">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-full bg-[var(--primario)] text-[var(--primario-texto)] grid place-items-center titulo text-sm shrink-0">
          {n}
        </div>
        <div className="titulo text-lg">{titulo}</div>
      </div>
      {children}
    </div>
  );
}

function Mini({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-[var(--radio-chico)] bg-[var(--fondo-panel)] border border-[var(--borde)] px-3 py-2">
      <div className="text-xs text-[var(--texto-tenue)]">{etiqueta}</div>
      <div className="text-sm font-semibold mt-0.5 leading-tight">{valor}</div>
    </div>
  );
}
