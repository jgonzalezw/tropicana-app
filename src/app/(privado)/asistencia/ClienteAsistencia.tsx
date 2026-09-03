"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Curso, FilaAsistencia, MarcaAsistencia } from "@/lib/tipos";
import { ETIQUETA_MODALIDAD, diaIso, fechaLarga, gs, isoFecha } from "@/lib/inscripcion";
import { cargarPadron, guardarAsistencia, suspenderClase, reabrirSesion } from "./acciones";

type Estado = "presente" | "ausente";
type EstadoSesion = "completada" | "suspendida";

export default function ClienteAsistencia({
  cursos,
  alumnosPorCurso,
  faltasToleradas,
  mostrarDeuda,
  minRetroIso,
  puedeEditar,
}: {
  cursos: Curso[];
  alumnosPorCurso: Record<number, number>;
  faltasToleradas: number;
  mostrarDeuda: boolean;
  /** Fecha mínima (ISO) para carga: hoy − ventana (hoy si no hay permiso retro/edición). */
  minRetroIso: string;
  /** Puede cargar fechas pasadas y reabrir clases ya tomadas. */
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const hoyIso = isoFecha(new Date());

  // Fechas en que se dicta el curso elegido, dentro de la ventana, hoy→atrás.
  const fechasDelCurso = (cid: number | null) => {
    const c = cursos.find((x) => x.id === cid);
    const dias = c?.dias_semana ?? [];
    if (!dias.length) return [] as { iso: string; label: string }[];
    const out: { iso: string; label: string }[] = [];
    const start = parseISO(minRetroIso);
    const d = parseISO(hoyIso);
    while (d >= start) {
      if (dias.includes(diaIso(d))) {
        const iso = isoFecha(d);
        out.push({ iso, label: (iso === hoyIso ? "Hoy · " : "") + fechaLarga(d) });
      }
      d.setDate(d.getDate() - 1);
    }
    return out;
  };

  const cursoInicial = cursos[0]?.id ?? null;
  const [cursoId, setCursoId] = useState<number | null>(cursoInicial);
  const [fecha, setFecha] = useState(fechasDelCurso(cursoInicial)[0]?.iso ?? hoyIso);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [filas, setFilas] = useState<FilaAsistencia[]>([]);
  const [marcas, setMarcas] = useState<Record<number, Estado>>({});
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suspendida, setSuspendida] = useState(false);
  const [motivoSusp, setMotivoSusp] = useState<string | null>(null);
  const [completada, setCompletada] = useState(false);
  const [estadosPorFecha, setEstadosPorFecha] = useState<Record<string, EstadoSesion>>({});
  const [editando, setEditando] = useState(false);
  const [formSusp, setFormSusp] = useState(false);
  const [motivoInput, setMotivoInput] = useState("");
  const [recarga, setRecarga] = useState(0);

  const curso = cursos.find((c) => c.id === cursoId) ?? null;
  const fechas = fechasDelCurso(cursoId);

  const pedido = useRef(0);
  useEffect(() => {
    if (cursoId == null || !fecha) return;
    const id = ++pedido.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    cargarPadron(cursoId, fecha)
      .then((r) => {
        if (id !== pedido.current) return;
        setFilas(r.filas);
        setMarcas(r.marcas);
        setSuspendida(r.suspendida);
        setMotivoSusp(r.motivoSuspension);
        setCompletada(r.completada);
        setEstadosPorFecha(r.estadosPorFecha);
        setEditando(false);
        setFormSusp(false);
        setMotivoInput("");
      })
      .finally(() => {
        if (id === pedido.current) setCargando(false);
      });
  }, [cursoId, fecha, recarga]);

  const total = filas.length;
  const presentes = filas.filter((f) => marcas[f.alumnoId] === "presente").length;
  const ausentes = filas.filter((f) => marcas[f.alumnoId] === "ausente").length;
  const marcados = presentes + ausentes;
  const sinMarcar = total - marcados;

  // Editable = clase pendiente, o completada que el usuario decidió corregir.
  const editable = !suspendida && (!completada || editando);

  function cambiarCurso(id: number) {
    setCursoId(id);
    setSelectorAbierto(false);
    setAviso(null);
    setFecha(fechasDelCurso(id)[0]?.iso ?? hoyIso);
  }

  function toggle(alumnoId: number) {
    if (!editable) return;
    setAviso(null);
    setMarcas((prev) => ({ ...prev, [alumnoId]: prev[alumnoId] === "presente" ? "ausente" : "presente" }));
  }
  function todosPresentes() {
    setAviso(null);
    setMarcas(() => {
      const m: Record<number, Estado> = {};
      for (const f of filas) m[f.alumnoId] = "presente";
      return m;
    });
  }

  function guardar() {
    if (cursoId == null || marcados === 0) return;
    setError(null);
    const insc = new Map(filas.map((f) => [f.alumnoId, f.inscripcionId]));
    const payload: MarcaAsistencia[] = filas
      .filter((f) => marcas[f.alumnoId])
      .map((f) => ({ alumnoId: f.alumnoId, inscripcionId: insc.get(f.alumnoId) ?? null, estado: marcas[f.alumnoId] }));
    startTransition(async () => {
      const res = await guardarAsistencia({ cursoId, fecha, marcas: payload });
      if (res.error) setError(res.error);
      else {
        setAviso(res.resumen ?? "Asistencia guardada.");
        setRecarga((n) => n + 1);
        router.refresh();
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  function confirmarSuspension() {
    if (cursoId == null) return;
    setError(null);
    startTransition(async () => {
      const res = await suspenderClase({ cursoId, fecha, motivo: motivoInput });
      if (res.error) setError(res.error);
      else {
        setFormSusp(false);
        setAviso(res.resumen ?? "Clase suspendida.");
        setRecarga((n) => n + 1);
        router.refresh();
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  function reabrir() {
    if (cursoId == null) return;
    setError(null);
    startTransition(async () => {
      const res = await reabrirSesion({ cursoId, fecha });
      if (res.error) setError(res.error);
      else {
        setAviso("Clase reabierta. Podés tomar o corregir la asistencia.");
        setRecarga((n) => n + 1);
        router.refresh();
      }
    });
  }

  const chipEstado = suspendida
    ? { t: "Clase suspendida", c: "bg-[var(--peligro-fill)] text-[var(--peligro-texto)]" }
    : completada
    ? { t: "Asistencia tomada", c: "bg-[var(--exito-fill)] text-[var(--exito-texto)]" }
    : { t: "Sin tomar", c: "bg-[var(--fondo-elevado)] text-[var(--texto-tenue)]" };

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto pb-28">
      <div className="mb-4">
        <h1 className="text-3xl">Tomar asistencia</h1>
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

      {/* Selector de curso (todos los cursos activos) */}
      <div className="relative mb-3">
        <button
          onClick={() => setSelectorAbierto((v) => !v)}
          disabled={cursos.length === 0}
          className="w-full flex items-center gap-3 text-left bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] px-5 py-4 disabled:opacity-50"
        >
          <span className="flex-1 min-w-0">
            <span className="block titulo text-2xl truncate">{curso ? curso.nombre : "Sin cursos"}</span>
            <span className="block text-base text-[var(--texto-tenue)] mt-0.5">
              {curso
                ? `${curso.hora ? curso.hora.slice(0, 5) + " · " : ""}${alumnosPorCurso[curso.id] ?? 0} alumnos`
                : "No hay cursos activos"}
            </span>
          </span>
          <span className={`shrink-0 text-[var(--primario)] text-xl transition-transform ${selectorAbierto ? "rotate-180" : ""}`}>
            ⌄
          </span>
        </button>

        {selectorAbierto && cursos.length > 0 && (
          <div className="absolute z-20 mt-2 w-full bg-[var(--fondo-elevado)] border border-[var(--borde)] rounded-[var(--radio-panel)] p-2 shadow-lg max-h-80 overflow-auto">
            {cursos.map((c) => (
              <button
                key={c.id}
                onClick={() => cambiarCurso(c.id)}
                className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-[var(--radio-chico)] hover:bg-[var(--fondo-panel)]"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-semibold truncate">{c.nombre}</span>
                  <span className="block text-sm text-[var(--texto-tenue)]">
                    {c.hora ? `${c.hora.slice(0, 5)} · ` : ""}
                    {alumnosPorCurso[c.id] ?? 0} alumnos
                  </span>
                </span>
                {c.id === cursoId && <span className="text-[var(--primario)]">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fecha de la clase: solo días en que se dicta el curso (hoy o pasado,
          dentro de la ventana). Selector grande, alto contraste, sin futuro. */}
      <label className="block mb-3 max-w-md">
        <span className="block text-base text-[var(--texto-tenue)] mb-1.5">Fecha de la clase</span>
        <select
          value={fecha}
          onChange={(e) => {
            setFecha(e.target.value);
            setAviso(null);
          }}
          disabled={fechas.length === 0}
          className="entrada text-lg py-3"
        >
          {fechas.map((f) => {
            const e = estadosPorFecha[f.iso];
            const pre = e === "completada" ? "✓ " : e === "suspendida" ? "⊘ " : "";
            return (
              <option key={f.iso} value={f.iso}>
                {pre}
                {f.label}
              </option>
            );
          })}
          {fechas.length === 0 && <option value={fecha}>Sin días de clase</option>}
        </select>
      </label>

      {/* Estado de la clase elegida */}
      {cursoId != null && fechas.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-1">
          <span className={`px-3 py-1 text-sm rounded-[var(--radio-control)] ${chipEstado.c}`}>{chipEstado.t}</span>
          {completada && !suspendida && (
            <span className="text-sm text-[var(--texto-tenue)]">
              {presentes} presentes · {ausentes} ausentes
            </span>
          )}
        </div>
      )}

      {cursoId == null && (
        <p className="text-[var(--texto-tenue)]">Elegí un curso.</p>
      )}
      {cursoId != null && fechas.length === 0 && (
        <p className="text-[var(--texto-tenue)]">Este curso no tiene días de clase cargados.</p>
      )}

      {/* Clase suspendida */}
      {cursoId != null && fechas.length > 0 && suspendida && (
        <div className="rounded-[var(--radio-tarjeta)] border border-[var(--peligro)] bg-[var(--peligro-fill)] p-5 mb-3">
          <div className="text-lg font-semibold text-[var(--peligro-texto)]">Clase suspendida</div>
          <p className="text-sm text-[var(--peligro-texto)] opacity-90 mt-1 leading-relaxed">
            No computa asistencia. El fin de ciclo de los alumnos mensuales se corrió a la próxima clase;
            los paquetes por clase se difieren solos.
            {motivoSusp ? ` Motivo: ${motivoSusp}.` : ""}
          </p>
          {puedeEditar && (
            <button
              onClick={reabrir}
              disabled={pendiente}
              className="mt-3 px-4 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--peligro)] text-[var(--peligro-texto)] disabled:opacity-40"
            >
              {pendiente ? "Procesando…" : "Reabrir clase (se dictó)"}
            </button>
          )}
        </div>
      )}

      {/* Cuerpo de asistencia */}
      {cursoId != null && fechas.length > 0 && !suspendida && (
        <>
          {editable && (
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="text-[var(--texto-tenue)]">
                <span className="titulo text-xl text-[var(--texto)]">{marcados}</span> de {total} marcados
              </div>
              <button
                onClick={todosPresentes}
                disabled={total === 0}
                className="ml-auto px-4 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40"
              >
                Todos presentes
              </button>
            </div>
          )}

          {cargando ? (
            <p className="text-[var(--texto-tenue)]">Cargando lista…</p>
          ) : total === 0 ? (
            <p className="text-[var(--texto-tenue)]">Este curso no tiene alumnos con inscripción activa.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filas.map((f) => (
                <FilaRow
                  key={f.alumnoId}
                  fila={f}
                  estado={marcas[f.alumnoId]}
                  faltasToleradas={faltasToleradas}
                  mostrarDeuda={mostrarDeuda}
                  readOnly={!editable}
                  onToggle={() => toggle(f.alumnoId)}
                />
              ))}
            </div>
          )}

          {/* Completada en solo-lectura: botón para corregir/completar */}
          {completada && !editando && !cargando && (
            <div className="mt-4">
              {puedeEditar ? (
                <button onClick={() => setEditando(true)} className="text-[var(--primario)] text-base">
                  Corregir o completar esta asistencia
                </button>
              ) : (
                <p className="text-sm text-[var(--texto-tenue)]">
                  Asistencia ya registrada (solo lectura). Pedí a un usuario autorizado que la reabra para corregir.
                </p>
              )}
            </div>
          )}

          {editable && total > 0 && (
            <p className="text-sm text-[var(--texto-tenue)] mt-3 px-1">
              Un toque marca presente. Otro toque lo pasa a ausente.
            </p>
          )}

          {/* Marcar clase suspendida (en modo editable) */}
          {editable && !cargando &&
            (!formSusp ? (
              <button
                onClick={() => {
                  setFormSusp(true);
                  setMotivoInput("");
                }}
                className="mt-4 text-[var(--primario)] text-sm"
              >
                Marcar esta clase como suspendida
              </button>
            ) : (
              <div className="mt-4 p-4 rounded-[var(--radio-panel)] border border-[var(--borde)] bg-[var(--fondo-elevado)] space-y-2">
                <div className="text-base font-medium">Suspender esta clase</div>
                <p className="text-sm text-[var(--texto-tenue)] leading-relaxed">
                  No se computa asistencia y se corre el fin de ciclo de todos los alumnos mensuales del curso
                  (no gasta su tolerancia). Los paquetes por clase se difieren solos.
                </p>
                <input
                  value={motivoInput}
                  onChange={(e) => setMotivoInput(e.target.value)}
                  placeholder="Motivo (opcional): feriado, profe ausente…"
                  className="entrada"
                />
                <div className="flex gap-2">
                  <button
                    onClick={confirmarSuspension}
                    disabled={pendiente}
                    className="px-4 py-2 text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--peligro)] text-[var(--fondo-panel)] disabled:opacity-40"
                  >
                    {pendiente ? "Suspendiendo…" : "Confirmar suspensión"}
                  </button>
                  <button onClick={() => setFormSusp(false)} className="px-4 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)]">
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
        </>
      )}

      {error && (
        <p className="text-[var(--peligro)] text-base mt-4" role="alert">
          {error}
        </p>
      )}

      {/* Pie fijo: guardar (solo en modo editable) */}
      {cursoId != null && fechas.length > 0 && editable && total > 0 && (
        <div className="sticky bottom-0 -mx-6 sm:-mx-8 mt-6 px-6 sm:px-8 py-4 bg-[var(--fondo-panel)] border-t border-[var(--borde)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[var(--exito)]" /> {presentes} presentes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[var(--peligro)]" /> {ausentes} ausentes
            </span>
            <span className="ml-auto text-[var(--texto-tenue)]">
              {sinMarcar === 0 ? "Lista completa" : `${sinMarcar} sin marcar`}
            </span>
          </div>
          <button
            onClick={guardar}
            disabled={marcados === 0 || pendiente}
            className="w-full px-5 py-3 text-lg font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
          >
            {pendiente ? "Guardando…" : completada ? "Guardar cambios" : "Guardar asistencia"}
          </button>
        </div>
      )}
    </div>
  );
}

function FilaRow({
  fila,
  estado,
  faltasToleradas,
  mostrarDeuda,
  readOnly,
  onToggle,
}: {
  fila: FilaAsistencia;
  estado: Estado | undefined;
  faltasToleradas: number;
  mostrarDeuda: boolean;
  readOnly: boolean;
  onToggle: () => void;
}) {
  const cls =
    estado === "presente"
      ? "bg-[var(--exito-fill)] border-[var(--exito)] text-[var(--exito-texto)]"
      : estado === "ausente"
      ? "bg-[var(--peligro-fill)] border-[var(--peligro)] text-[var(--peligro-texto)]"
      : "bg-[var(--fondo-elevado)] border-[var(--borde)]";

  const restantesTol = faltasToleradas - fila.faltasMes;
  const esParcial = fila.modalidad !== "mensual";

  let sub: string;
  if (estado === "presente") sub = "Presente";
  else if (estado === "ausente") sub = "Ausente";
  else if (esParcial)
    sub = `${ETIQUETA_MODALIDAD[fila.modalidad]}${
      fila.restantes != null ? ` · quedan ${fila.restantes} ${fila.restantes === 1 ? "clase" : "clases"}` : ""
    }`;
  else sub = fila.faltasMes === 0 ? "Sin faltas este mes" : `${fila.faltasMes} ${fila.faltasMes === 1 ? "falta" : "faltas"} este mes`;

  const pill =
    !estado && !esParcial ? (restantesTol <= 0 ? "Sin tolerancia" : restantesTol === 1 ? "Última tolerada" : null) : null;

  return (
    <button
      onClick={onToggle}
      disabled={readOnly}
      className={`w-full flex items-center gap-3 text-left rounded-[var(--radio-panel)] border px-4 py-3 min-h-[72px] ${cls} ${
        readOnly ? "cursor-default" : ""
      }`}
    >
      <span
        className={`shrink-0 w-9 h-9 rounded-full grid place-items-center text-base font-bold ${
          estado === "presente"
            ? "bg-[var(--exito)] text-[var(--fondo-panel)]"
            : estado === "ausente"
            ? "bg-[var(--peligro)] text-[var(--fondo-panel)]"
            : "border-2 border-[var(--texto-tenue)]"
        }`}
      >
        {estado === "presente" ? "✓" : estado === "ausente" ? "✕" : ""}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-lg font-semibold truncate">
          {fila.apellido}, {fila.nombre}
        </span>
        <span className="block text-sm opacity-80">{sub}</span>
      </span>
      {!estado && (pill || (mostrarDeuda && fila.deuda > 0)) && (
        <span className="shrink-0 flex flex-col items-end gap-1">
          {pill && (
            <span className="whitespace-nowrap px-2.5 py-1 text-xs rounded-[var(--radio-control)] bg-[var(--peligro-fill)] text-[var(--peligro-texto)]">
              {pill}
            </span>
          )}
          {mostrarDeuda && fila.deuda > 0 && (
            <span className="whitespace-nowrap text-sm text-[var(--peligro)]">Debe {gs(fila.deuda)}</span>
          )}
        </span>
      )}
    </button>
  );
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
