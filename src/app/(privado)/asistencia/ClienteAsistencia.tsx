"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Curso, FilaAsistencia, MarcaAsistencia } from "@/lib/tipos";
import { ETIQUETA_MODALIDAD, diaIso, fechaLarga, gs, isoFecha } from "@/lib/inscripcion";
import { cargarPadron, guardarAsistencia, suspenderClase, reabrirSesion } from "./acciones";

type Estado = "presente" | "ausente";
type EstadoSesion = "completada" | "incompleta" | "suspendida";

export default function ClienteAsistencia({
  cursos,
  alumnosPorCurso,
  mostrarDeuda,
  minRetroIso,
  puedeEditar,
}: {
  cursos: Curso[];
  alumnosPorCurso: Record<number, number>;
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
  const [licencias, setLicencias] = useState<Record<number, boolean>>({});
  const [cargando, setCargando] = useState(false);
  const [errorPadron, setErrorPadron] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suspendida, setSuspendida] = useState(false);
  const [motivoSusp, setMotivoSusp] = useState<string | null>(null);
  const [completada, setCompletada] = useState(false);
  const [incompleta, setIncompleta] = useState(false);
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
        setLicencias(r.licencias);
        setSuspendida(r.suspendida);
        setMotivoSusp(r.motivoSuspension);
        setCompletada(r.completada);
        setIncompleta(r.incompleta);
        setEstadosPorFecha(r.estadosPorFecha);
        setErrorPadron(r.error);
        setEditando(false);
        setFormSusp(false);
        setMotivoInput("");
      })
      .catch((e: unknown) => {
        // Un padrón que no se pudo leer nunca puede verse como una clase sin
        // alumnos: se tomaría la asistencia sin nadie (regla de calidad 1).
        if (id !== pedido.current) return;
        setFilas([]);
        setErrorPadron(e instanceof Error ? e.message : "No se pudo cargar el padrón.");
      })
      .finally(() => {
        if (id === pedido.current) setCargando(false);
      });
  }, [cursoId, fecha, recarga]);

  // El conteo va por PERSONAS, no por filas: una prueba grupal es una sola
  // fila y una sola asistencia, pero son varios los que entran a la clase
  // (regla 11). Para el profesor, lo que importa es cuánta gente hay.
  const gente = (f: FilaAsistencia) => Math.max(1, f.personas);
  const total = filas.reduce((t, f) => t + gente(f), 0);
  const presentes = filas
    .filter((f) => marcas[f.alumnoId] === "presente")
    .reduce((t, f) => t + gente(f), 0);
  const ausentes = filas
    .filter((f) => marcas[f.alumnoId] === "ausente")
    .reduce((t, f) => t + gente(f), 0);
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
    setMarcas((prev) => {
      const siguiente = prev[alumnoId] === "presente" ? "ausente" : "presente";
      // Al volver a presente, la licencia deja de aplicar.
      if (siguiente === "presente") setLicencias((l) => ({ ...l, [alumnoId]: false }));
      return { ...prev, [alumnoId]: siguiente };
    });
  }
  function toggleLicencia(alumnoId: number) {
    if (!editable) return;
    setAviso(null);
    setLicencias((prev) => ({ ...prev, [alumnoId]: !prev[alumnoId] }));
  }
  function todosPresentes() {
    setAviso(null);
    setLicencias({});
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
      .map((f) => ({
        alumnoId: f.alumnoId,
        inscripcionId: insc.get(f.alumnoId) ?? null,
        estado: marcas[f.alumnoId],
        conLicencia: marcas[f.alumnoId] === "ausente" && !!licencias[f.alumnoId],
      }));
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
    : incompleta
    ? { t: "Asistencia incompleta", c: "bg-[var(--advertencia-fill)] text-[var(--advertencia-texto)]" }
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
            const pre =
              e === "completada" ? "✓ " : e === "suspendida" ? "⊘ " : e === "incompleta" ? "⚠ " : "";
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
          {(completada || incompleta) && !suspendida && (
            <span className="text-sm text-[var(--texto-tenue)]">
              {presentes} presentes · {ausentes} ausentes
            </span>
          )}
        </div>
      )}

      {/* Asistencia ya tomada a la que se le sumaron alumnos después (típico de
          una inscripción con fecha retroactiva): hay que completarla. */}
      {incompleta && !suspendida && !cargando && (
        <div className="mb-3 rounded-[var(--radio-panel)] border border-[var(--advertencia)] bg-[var(--advertencia-fill)] text-[var(--advertencia-texto)] p-4">
          <div className="font-semibold">Falta marcar a {sinMarcar} {sinMarcar === 1 ? "alumno" : "alumnos"}</div>
          <p className="text-sm mt-1 leading-relaxed opacity-90">
            Esta clase ya tenía la asistencia tomada, pero después se inscribió gente con fecha
            retroactiva. Marcá a los que faltan y volvé a guardar.
          </p>
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

      {errorPadron && (
        <div
          role="alert"
          className="mb-3 rounded-[var(--radio-panel)] border border-[var(--peligro)] bg-[var(--peligro-fill)] text-[var(--peligro-texto)] p-4"
        >
          <div className="font-semibold">No se pudo cargar el padrón</div>
          <p className="text-sm mt-1">
            Es un error al leer los datos, no que no haya alumnos. No tomes asistencia hasta
            resolverlo: {errorPadron}
          </p>
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
                  licencia={!!licencias[f.alumnoId]}
                  mostrarDeuda={mostrarDeuda}
                  readOnly={!editable}
                  onToggle={() => toggle(f.alumnoId)}
                  onToggleLicencia={() => toggleLicencia(f.alumnoId)}
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
            {pendiente ? "Guardando…" : completada || incompleta ? "Guardar cambios" : "Guardar asistencia"}
          </button>
        </div>
      )}
    </div>
  );
}

function FilaRow({
  fila,
  estado,
  licencia,
  mostrarDeuda,
  readOnly,
  onToggle,
  onToggleLicencia,
}: {
  fila: FilaAsistencia;
  estado: Estado | undefined;
  licencia: boolean;
  mostrarDeuda: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onToggleLicencia: () => void;
}) {
  const cls =
    estado === "presente"
      ? "bg-[var(--exito-fill)] border-[var(--exito)] text-[var(--exito-texto)]"
      : estado === "ausente"
      ? "bg-[var(--peligro-fill)] border-[var(--peligro)] text-[var(--peligro-texto)]"
      : "bg-[var(--fondo-elevado)] border-[var(--borde)]";

  const tol = fila.toleranciaRestante; // null = no aplica (sin plan de N clases).
  const sinTolerancia = tol != null && tol <= 0;
  const esParcial = fila.modalidad !== "mensual";

  // Info persistente (progreso, faltas del ciclo, o clases restantes de un
  // paquete parcial): se muestra siempre, sin importar el estado marcado, para
  // no perderla al pasar por presente → ausente → presente.
  const meta = fila.esPrueba
    ? // Una prueba es una sola clase: no tiene progreso de ciclo ni faltas que
      // contar. Lo que sí importa en el padrón es cuánta gente trae.
      fila.personas > 1
      ? `Clase de prueba · ${fila.personas} personas`
      : "Clase de prueba"
    : esParcial
    ? `${ETIQUETA_MODALIDAD[fila.modalidad]}${
        fila.restantes != null ? ` · quedan ${fila.restantes} ${fila.restantes === 1 ? "clase" : "clases"}` : ""
      }`
    : [
        fila.progreso ? `${fila.progreso.hechas}/${fila.progreso.total} clases` : null,
        fila.faltasCiclo === 0 ? "Sin faltas en el ciclo" : `${fila.faltasCiclo} ${fila.faltasCiclo === 1 ? "falta" : "faltas"} en el ciclo`,
      ]
        .filter(Boolean)
        .join(" · ");

  let sub: string;
  if (estado === "presente") sub = `Presente · ${meta}`;
  else if (estado === "ausente")
    // La licencia solo aplica donde hay tolerancia (planes con N). Un dato viejo
    // marcado con_licencia en un plan sin tolerancia (p.ej. ilimitado) no debe
    // leerse como "genera bono": ese plan nunca bonifica.
    sub = `Ausente${licencia && tol != null ? " · con licencia (bono)" : ""} · ${meta}`;
  else sub = meta;

  const pill = fila.esPrueba
    ? "Prueba"
    : !estado && tol != null
      ? tol <= 0
        ? fila.faltaSinLicenciaEnCiclo
          ? "Sin bono"
          : "Sin tolerancia"
        : tol === 1
        ? "Última tolerada"
        : null
      : null;

  return (
    <div className={`rounded-[var(--radio-panel)] border ${cls}`}>
      <button
        onClick={onToggle}
        disabled={readOnly}
        className={`w-full flex items-center gap-3 text-left px-4 py-3 min-h-[72px] ${readOnly ? "cursor-default" : ""}`}
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
        {(pill || (mostrarDeuda && fila.deuda > 0)) && (
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

      {/* Falta justificada: activa la tolerancia (bono). Solo si el plan tiene
          tolerancia disponible. Ya guardada (solo lectura): texto fijo, sin
          checkbox — para corregirla hay que reabrir la sesión primero. */}
      {estado === "ausente" && tol != null && (
        <div className="px-4 pb-3 -mt-1">
          {readOnly ? (
            <span
              className={`inline-block text-sm px-3 py-1.5 rounded-[var(--radio-control)] ${
                licencia
                  ? "bg-[var(--exito-fill)] text-[var(--exito-texto)]"
                  : "bg-[var(--fondo-elevado)] text-[var(--texto-tenue)]"
              }`}
            >
              {licencia ? "Con licencia (justificada · genera bono)" : "Sin licencia"}
            </span>
          ) : sinTolerancia && !licencia ? (
            <span className="inline-block text-sm px-3 py-1.5 rounded-[var(--radio-control)] bg-[var(--peligro-fill)] text-[var(--peligro-texto)]">
              {fila.faltaSinLicenciaEnCiclo
                ? "Sin bono: ya tiene una falta sin licencia en el ciclo"
                : "Sin tolerancia"}
            </span>
          ) : (
            <button
              onClick={onToggleLicencia}
              aria-pressed={licencia}
              className={`flex items-center gap-2 text-sm rounded-[var(--radio-control)] px-3 py-1.5 border ${
                licencia
                  ? "bg-[var(--exito)] text-[var(--fondo-panel)] border-[var(--exito)]"
                  : "bg-[var(--fondo-panel)] border-[var(--borde)]"
              }`}
            >
              <span
                className={`inline-grid place-items-center w-4 h-4 rounded border text-[10px] ${
                  licencia ? "bg-[var(--fondo-panel)] text-[var(--exito)] border-[var(--fondo-panel)]" : "border-[var(--texto-tenue)]"
                }`}
              >
                {licencia ? "✓" : ""}
              </span>
              Con licencia (justificada · genera bono)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
