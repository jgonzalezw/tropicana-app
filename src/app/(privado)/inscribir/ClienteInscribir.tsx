"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Alumno, Curso, DatosAlumno, TarifasCurso } from "@/lib/tipos";
import EntidadAlumno from "@/components/entidades/EntidadAlumno";
import Cobro, { type PayloadCobro } from "@/components/Cobro";
import {
  type Modalidad,
  DIAS_LARGOS,
  ETIQUETA_MODALIDAD,
  clasesModalidad,
  descuentoAdelanto,
  diasMedioMes,
  fechaLarga,
  gs,
  isoFecha,
  listaFechas,
  precioModalidad,
  proximasClases,
  totalMedioMes,
} from "@/lib/inscripcion";
import { etiquetaDias } from "@/components/entidades/EntidadCurso";
import { crearAlumnoDesdeInscripcion, inscribirYCobrar } from "./acciones";

type Canal = { valor: string; etiqueta: string };
const VACIA: TarifasCurso = { clase: null, semana: null, medio_mes: null };
const MODALIDADES: Modalidad[] = ["mensual", "clase", "semana", "medio_mes"];

export default function ClienteInscribir({
  alumnos,
  cursos,
  tarifas,
  tablaDescuento,
  factorMedio,
  medios,
  canales,
  cursosPorAlumno,
  deudaPorAlumno,
  mensualPorAlumno,
}: {
  alumnos: Alumno[];
  cursos: Curso[];
  tarifas: Record<number, TarifasCurso>;
  tablaDescuento: Record<number, number>;
  factorMedio: number;
  medios: string[];
  canales: Canal[];
  cursosPorAlumno: Record<number, string[]>;
  deudaPorAlumno: Record<number, number>;
  mensualPorAlumno: Record<number, number[]>;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [remountAlumno, setRemountAlumno] = useState(0);
  const [curso, setCurso] = useState<Curso | null>(null);
  const [modalidad, setModalidad] = useState<Modalidad>("mensual");
  const [medioDia, setMedioDia] = useState<number[] | null>(null);
  const [fechaIdx, setFechaIdx] = useState(0);
  const [mesesOpt, setMesesOpt] = useState<number | "libre">(1);
  const [mesesTexto, setMesesTexto] = useState("");
  const [cobro, setCobro] = useState<PayloadCobro | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hoy = useMemo(() => new Date(), []);
  const tarifaCurso = curso ? tarifas[curso.id] ?? VACIA : VACIA;

  const meses =
    modalidad !== "mensual"
      ? 1
      : mesesOpt === "libre"
      ? Math.max(1, parseInt(mesesTexto.replace(/\D/g, ""), 10) || 1)
      : mesesOpt;

  const precioUnit = curso
    ? precioModalidad(modalidad, curso.precio_mensual, tarifaCurso, 1)
    : 0;
  const subtotal = modalidad === "mensual" ? precioUnit * meses : precioUnit;
  const { pct, monto: descAdelanto } =
    modalidad === "mensual"
      ? descuentoAdelanto(subtotal, meses, tablaDescuento)
      : { pct: 0, monto: 0 };
  const total = Math.max(0, subtotal - descAdelanto);

  const diasFecha = curso
    ? modalidad === "medio_mes"
      ? diasMedioMes(curso.dias_semana, medioDia)
      : curso.dias_semana
    : [];
  const fechas = curso ? proximasClases(diasFecha, 3, hoy) : [];
  const fechaSel = fechas[Math.min(fechaIdx, Math.max(0, fechas.length - 1))] ?? null;

  const clasesPeriodo =
    curso && modalidad !== "mensual" && fechaSel
      ? clasesModalidad(curso.dias_semana, fechaSel, modalidad, factorMedio, medioDia)
      : [];

  const cuentaId = curso
    ? `${curso.id}·${modalidad}·${meses}·${fechaIdx}·${(medioDia ?? []).join("")}`
    : "";
  const mueve = cobro ? Math.max(0, cobro.total - cobro.saldo) : 0;

  // Ya tiene una inscripción mensual activa en este curso (no se puede repetir).
  const yaMensual =
    !!alumno &&
    !!curso &&
    modalidad === "mensual" &&
    (mensualPorAlumno[alumno.id] ?? []).includes(curso.id);

  function resetTodo() {
    setAlumno(null);
    setRemountAlumno((n) => n + 1);
    setCurso(null);
    setModalidad("mensual");
    setMedioDia(null);
    setFechaIdx(0);
    setMesesOpt(1);
    setMesesTexto("");
    setCobro(null);
    setError(null);
  }

  function elegirCurso(c: Curso) {
    setCurso(c);
    setModalidad("mensual");
    setMedioDia(null);
    setFechaIdx(0);
    setMesesOpt(1);
    setMesesTexto("");
    setCobro(null);
    setError(null);
  }

  function cambiarModalidad(m: Modalidad) {
    setModalidad(m);
    setMedioDia(null);
    setFechaIdx(0);
    setMesesOpt(1);
    setMesesTexto("");
    setError(null);
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
    if (!curso) return setError("Falta elegir el curso.");
    if (yaMensual)
      return setError("Este alumno ya tiene una inscripción mensual activa en este curso.");
    if (!fechaSel) return setError("No hay una fecha de inicio válida para este curso.");
    if (modalidad === "mensual" && mesesOpt === "libre" && meses < 2)
      return setError("Escribí cuántos meses paga (2 o más).");
    if (cobro && cobro.modo !== "sin" && mueve > 0 && !cobro.medio)
      return setError("Elegí el medio de pago.");
    if (cobro && cobro.ajuste > 0 && !cobro.ajusteMotivo.trim())
      return setError("El descuento necesita un motivo.");

    const c = cobro;
    startTransition(async () => {
      const res = await inscribirYCobrar({
        alumnoId: alumno.id,
        cursoId: curso.id,
        modalidad,
        fechaInicio: isoFecha(fechaSel),
        meses,
        diasElegidos: modalidad === "medio_mes" ? medioDia : null,
        cobro: {
          modo: c?.modo ?? "sin",
          monto: c?.monto ?? 0,
          medio: c?.medio ?? null,
          notaMedio: c?.notaMedio ?? "",
          ajuste: c?.ajuste ?? 0,
          ajusteMotivo: c?.ajusteMotivo ?? "",
          total: c?.total ?? total,
          saldo: c?.saldo ?? total,
        },
      });
      if (res.error) setError(res.error);
      else {
        resetTodo();
        setAviso(res.resumen ?? "Inscripción registrada.");
        router.refresh();
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const puedeConfirmar = !!alumno && !!curso && !!fechaSel && !pendiente && !yaMensual;

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto pb-28">
      <div className="mb-6">
        <h1 className="text-3xl">Inscribir y cobrar</h1>
        <p className="text-[var(--texto-tenue)] mt-2 text-lg">
          Alumno, curso y primera cuota en una sola pantalla.
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

      {/* Paso 2 — Curso e inicio */}
      <Paso n={2} titulo="Curso e inicio">
        {!alumno ? (
          <p className="text-[var(--texto-tenue)]">Elegí primero el alumno.</p>
        ) : !curso ? (
          <div className="space-y-2">
            {cursos.map((c) => (
              <button
                key={c.id}
                onClick={() => elegirCurso(c)}
                className="w-full flex items-center gap-3 text-left rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] border border-[var(--borde)] px-4 py-3 hover:border-[var(--primario)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold">{c.nombre}</div>
                  <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
                    {[c.linea, c.nivel].filter(Boolean).join(" · ")}
                    {c.dias_semana.length ? ` · ${etiquetaDias(c.dias_semana)}` : ""}
                    {c.hora ? ` · ${c.hora.slice(0, 5)}` : ""}
                  </div>
                </div>
                <div className="text-base font-bold shrink-0">{gs(c.precio_mensual)}</div>
              </button>
            ))}
            {cursos.length === 0 && (
              <p className="text-[var(--texto-tenue)]">
                No hay cursos activos. Cargá uno en Gestión → Cursos.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold">{curso.nombre}</div>
                <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
                  {etiquetaDias(curso.dias_semana)}
                  {curso.hora ? ` · ${curso.hora.slice(0, 5)}` : ""}
                </div>
              </div>
              <button
                onClick={() => setCurso(null)}
                className="text-[var(--primario)] text-base shrink-0"
              >
                Cambiar
              </button>
            </div>

            {/* Modalidad */}
            <div>
              <div className="text-sm text-[var(--texto-tenue)] mb-1.5">Modalidad</div>
              <div className="grid grid-cols-2 gap-2">
                {MODALIDADES.map((m) => (
                  <button
                    key={m}
                    onClick={() => cambiarModalidad(m)}
                    className={`px-4 py-2.5 text-sm rounded-[var(--radio-control)] border ${
                      modalidad === m
                        ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                        : "border-[var(--borde)] hover:border-[var(--primario)]"
                    }`}
                  >
                    {ETIQUETA_MODALIDAD[m]}
                  </button>
                ))}
              </div>
              <div className="flex items-baseline gap-2 mt-2.5">
                <span className="text-sm text-[var(--texto-tenue)]">{ETIQUETA_MODALIDAD[modalidad]}</span>
                <span className="ml-auto text-lg font-bold">{gs(precioUnit)}</span>
              </div>
              {yaMensual && (
                <div className="mt-2.5 rounded-[var(--radio-panel)] border border-[var(--primario)] bg-[var(--accent-100)] px-4 py-3 text-sm text-[var(--peligro-texto)]">
                  Este alumno ya tiene una inscripción mensual activa en{" "}
                  <span className="font-semibold">{curso.nombre}</span>. Para cobrarle otra cuota usá
                  el módulo de cobros (próximamente); acá no se duplica la inscripción.
                </div>
              )}
            </div>

            {/* Días de medio mes */}
            {modalidad === "medio_mes" && curso.dias_semana.length > 1 && (
              <div>
                <div className="text-sm text-[var(--texto-tenue)] mb-1.5">En qué días las toma</div>
                <div className="flex flex-wrap gap-2">
                  {curso.dias_semana.map((d) => {
                    const sel = diasMedioMes(curso.dias_semana, medioDia);
                    const activo = sel.includes(d);
                    const ultimo = activo && sel.length === 1;
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          if (ultimo) return;
                          const next = activo ? sel.filter((x) => x !== d) : [...sel, d].sort();
                          setMedioDia(next.length === curso.dias_semana.length ? null : next);
                          setFechaIdx(0);
                        }}
                        className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
                          activo
                            ? "bg-[var(--exito-fill)] text-[var(--exito-texto)] border-[var(--exito)] font-medium"
                            : "bg-[var(--fondo-panel)] text-[var(--texto-tenue)] border-[var(--borde)] hover:border-[var(--primario)]"
                        }`}
                      >
                        {activo ? "✓ " : ""}
                        {DIAS_LARGOS[d]}
                      </button>
                    );
                  })}
                </div>
                <div className="text-sm text-[var(--texto-tenue)] mt-1.5">{resumenMedio(curso, medioDia, factorMedio)}</div>
              </div>
            )}

            {/* Fecha de inicio */}
            <div>
              <div className="text-sm text-[var(--texto-tenue)] mb-1.5">
                {modalidad === "mensual" ? "Empieza a tomar clases" : "Desde qué clase arranca"}
              </div>
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
                  <span className="text-sm text-[var(--texto-tenue)]">Este curso no tiene días de clase cargados.</span>
                )}
              </div>
              <div className="text-sm text-[var(--texto-tenue)] mt-2">
                {modalidad === "mensual"
                  ? "La primera cuota se devenga desde esta fecha. Próximo vencimiento: un mes después."
                  : "Se cobra una sola vez, por el período elegido. No genera cuota mensual."}
              </div>
              {clasesPeriodo.length > 0 && (
                <div className="text-sm text-[var(--texto-tenue)] mt-1.5">
                  {clasesPeriodo.length === 1
                    ? `Incluye solo la clase de ${listaFechas(clasesPeriodo)}.`
                    : `Incluye las clases de ${listaFechas(clasesPeriodo)}.`}
                </div>
              )}
            </div>
          </div>
        )}
      </Paso>

      {/* Paso 3 — Cobro */}
      <Paso n={3} titulo="Cobro de la primera cuota">
        {!curso ? (
          <p className="text-[var(--texto-tenue)]">Elegí el curso para ver la cuota.</p>
        ) : (
          <div className="rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] p-4 space-y-3">
            {/* Meses adelantados (solo mensual) */}
            {modalidad === "mensual" && (
              <div>
                <div className="text-sm text-[var(--texto-tenue)] mb-1.5">Meses a pagar</div>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, "libre"].map((v) => {
                    const val = v as number | "libre";
                    const on = mesesOpt === val;
                    return (
                      <button
                        key={String(v)}
                        onClick={() => {
                          setMesesOpt(val);
                          if (val !== "libre") setMesesTexto("");
                          setError(null);
                        }}
                        className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
                          on
                            ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                            : "border-[var(--borde)] hover:border-[var(--primario)]"
                        }`}
                      >
                        {val === "libre" ? "Más" : val}
                      </button>
                    );
                  })}
                </div>
                {mesesOpt === "libre" && (
                  <input
                    value={mesesTexto}
                    onChange={(e) => {
                      setMesesTexto(e.target.value);
                      setError(null);
                    }}
                    inputMode="numeric"
                    placeholder="6"
                    className="entrada mt-2 max-w-[140px]"
                  />
                )}
              </div>
            )}

            {/* Desglose */}
            <div className="flex items-baseline gap-2">
              <span className="text-base text-[var(--texto-tenue)]">
                {modalidad !== "mensual"
                  ? `A cobrar · ${ETIQUETA_MODALIDAD[modalidad].toLowerCase()}`
                  : meses > 1
                  ? `${meses} meses × ${gs(curso.precio_mensual)}`
                  : "Cuota del mes"}
              </span>
              <span className="ml-auto titulo text-2xl">{gs(subtotal)}</span>
            </div>
            {descAdelanto > 0 && (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2 text-[var(--exito-texto)]">
                  <span className="text-sm">Descuento por pago adelantado ({pct}%)</span>
                  <span className="ml-auto text-base font-bold">− {gs(descAdelanto)}</span>
                </div>
                <div className="flex items-baseline gap-2 pt-2 border-t border-[var(--borde)]">
                  <span className="text-sm text-[var(--texto-tenue)]">Total a pagar</span>
                  <span className="ml-auto titulo text-2xl">{gs(total)}</span>
                </div>
              </div>
            )}

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
          </div>
        )}
      </Paso>

      {error && (
        <p className="text-[var(--peligro)] text-base mt-4" role="alert">
          {error}
        </p>
      )}

      {/* Barra de confirmación */}
      <div className="sticky bottom-0 -mx-6 sm:-mx-8 mt-6 px-6 sm:px-8 py-4 bg-[var(--fondo-panel)] border-t border-[var(--borde)]">
        <div className="flex items-baseline mb-2">
          <span className="text-sm text-[var(--texto-tenue)]">
            {!alumno ? "Sin alumno todavía" : !curso ? "Falta el curso" : "Cobra hoy"}
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

function esHoy(d: Date, hoy: Date): boolean {
  return (
    d.getFullYear() === hoy.getFullYear() &&
    d.getMonth() === hoy.getMonth() &&
    d.getDate() === hoy.getDate()
  );
}

function resumenMedio(curso: Curso, medioDia: number[] | null, factor: number): string {
  const total = totalMedioMes(curso.dias_semana, factor);
  const k = diasMedioMes(curso.dias_semana, medioDia).length;
  const sem = Math.ceil(total / Math.max(1, k));
  return `${total} clases · ${k === 1 ? "un día por semana" : `${k} días por semana`} · se completan en ${sem} ${
    sem === 1 ? "semana" : "semanas"
  }`;
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
