"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Curso, FilaAsistencia, MarcaAsistencia } from "@/lib/tipos";
import { ETIQUETA_MODALIDAD, diaIso, fechaLarga, gs, isoFecha } from "@/lib/inscripcion";
import { cargarPadron, guardarAsistencia } from "./acciones";

type Estado = "presente" | "ausente";

export default function ClienteAsistencia({
  cursos,
  alumnosPorCurso,
  faltasToleradas,
  mostrarDeuda,
  minRetroIso,
}: {
  cursos: Curso[];
  alumnosPorCurso: Record<number, number>;
  faltasToleradas: number;
  mostrarDeuda: boolean;
  /** Fecha mínima (ISO) para carga: hoy − ventana en semanas (hoy si no hay permiso retro). */
  minRetroIso: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const hoyIso = isoFecha(new Date());

  // Fechas elegibles: desde la ventana permitida hasta HOY (nunca futuro),
  // solo días en los que se dicta al menos un curso. Más reciente primero.
  const fechasValidas = (() => {
    const out: { iso: string; label: string }[] = [];
    const start = parseISO(minRetroIso);
    const d = parseISO(hoyIso);
    while (d >= start) {
      if (cursos.some((c) => (c.dias_semana ?? []).includes(diaIso(d)))) {
        const iso = isoFecha(d);
        out.push({ iso, label: (iso === hoyIso ? "Hoy · " : "") + fechaLarga(d) });
      }
      d.setDate(d.getDate() - 1);
    }
    return out;
  })();

  // Solo los cursos que se dictan ese día (según sus días de la semana),
  // ordenados por hora de la clase (luego por nombre).
  const cursosEn = (f: string) =>
    cursos
      .filter((c) => (c.dias_semana ?? []).includes(diaIso(parseISO(f))))
      .sort(
        (a, b) =>
          (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99") ||
          a.nombre.localeCompare(b.nombre, "es")
      );

  const fechaInicial = fechasValidas[0]?.iso ?? hoyIso;
  const [fecha, setFecha] = useState(fechaInicial);
  const [cursoId, setCursoId] = useState<number | null>(cursosEn(fechaInicial)[0]?.id ?? null);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [filas, setFilas] = useState<FilaAsistencia[]>([]);
  const [marcas, setMarcas] = useState<Record<number, Estado>>({});
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cursosDelDia = cursosEn(fecha);
  const curso = cursosDelDia.find((c) => c.id === cursoId) ?? null;

  // Cambiar la fecha reajusta el curso elegido si ya no se dicta ese día.
  function cambiarFecha(nf: string) {
    const f = nf || hoyIso;
    setFecha(f);
    setAviso(null);
    const lista = cursosEn(f);
    setCursoId((prev) => (prev != null && lista.some((c) => c.id === prev) ? prev : lista[0]?.id ?? null));
  }

  const pedido = useRef(0);
  useEffect(() => {
    if (cursoId == null) return;
    const id = ++pedido.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    cargarPadron(cursoId, fecha)
      .then(({ filas: f, marcas: m }) => {
        if (id !== pedido.current) return;
        setFilas(f);
        setMarcas(m);
      })
      .finally(() => {
        if (id === pedido.current) setCargando(false);
      });
  }, [cursoId, fecha]);

  const total = filas.length;
  const presentes = filas.filter((f) => marcas[f.alumnoId] === "presente").length;
  const ausentes = filas.filter((f) => marcas[f.alumnoId] === "ausente").length;
  const marcados = presentes + ausentes;
  const sinMarcar = total - marcados;

  const fechaLinea = `${fecha === hoyIso ? "Hoy · " : ""}${fechaLarga(parseISO(fecha))}${
    curso?.hora ? ` · ${curso.hora.slice(0, 5)}` : ""
  }`;

  function toggle(alumnoId: number) {
    setAviso(null);
    setMarcas((prev) => ({
      ...prev,
      [alumnoId]: prev[alumnoId] === "presente" ? "ausente" : "presente",
    }));
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
        router.refresh();
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

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

      {/* Selector de clase (tarjeta + desplegable) */}
      <div className="relative mb-3">
        <button
          onClick={() => setSelectorAbierto((v) => !v)}
          disabled={cursosDelDia.length === 0}
          className="w-full flex items-center gap-3 text-left bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] px-5 py-4 disabled:opacity-50"
        >
          <span className="flex-1 min-w-0">
            <span className="block titulo text-2xl truncate">
              {curso ? curso.nombre : "No hay clases este día"}
            </span>
            <span className="block text-base text-[var(--texto-tenue)] mt-0.5">
              {curso
                ? `${fechaLinea} · ${alumnosPorCurso[curso.id] ?? 0} alumnos`
                : `${fecha === hoyIso ? "Hoy · " : ""}${fechaLarga(parseISO(fecha))} · ningún curso se dicta`}
            </span>
          </span>
          <span
            className={`shrink-0 text-[var(--primario)] text-xl transition-transform ${
              selectorAbierto ? "rotate-180" : ""
            }`}
          >
            ⌄
          </span>
        </button>

        {selectorAbierto && cursosDelDia.length > 0 && (
          <div className="absolute z-20 mt-2 w-full bg-[var(--fondo-elevado)] border border-[var(--borde)] rounded-[var(--radio-panel)] p-2 shadow-lg">
            {cursosDelDia.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCursoId(c.id);
                  setSelectorAbierto(false);
                  setAviso(null);
                }}
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

      {/* Fecha de la clase: solo hoy o clases pasadas dentro de la ventana.
          Selector propio (grande, alto contraste), pensado para baja visión;
          por construcción no ofrece fechas futuras. */}
      <label className="block mb-4 max-w-md">
        <span className="block text-base text-[var(--texto-tenue)] mb-1.5">Fecha de la clase</span>
        <select
          value={fecha}
          onChange={(e) => cambiarFecha(e.target.value)}
          className="entrada text-lg py-3"
        >
          {fechasValidas.map((f) => (
            <option key={f.iso} value={f.iso}>
              {f.label}
            </option>
          ))}
          {!fechasValidas.some((f) => f.iso === fecha) && (
            <option value={fecha}>{fechaLarga(parseISO(fecha))}</option>
          )}
        </select>
        {fechasValidas.length > 1 && (
          <span className="block text-sm text-[var(--texto-tenue)] mt-1.5">
            Hoy o una clase pasada (dentro de la ventana permitida). No se puede a futuro.
          </span>
        )}
      </label>

      {/* Contador + todos presentes */}
      {cursoId != null && (
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

      {/* Lista */}
      {cursoId == null ? (
        <p className="text-[var(--texto-tenue)]">
          {cursosDelDia.length === 0
            ? "No hay clases programadas para este día."
            : "Elegí un curso."}
        </p>
      ) : cargando ? (
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
              onToggle={() => toggle(f.alumnoId)}
            />
          ))}
        </div>
      )}
      {cursoId != null && total > 0 && (
        <p className="text-sm text-[var(--texto-tenue)] mt-3 px-1">
          Un toque marca presente. Otro toque lo pasa a ausente.
        </p>
      )}

      {error && (
        <p className="text-[var(--peligro)] text-base mt-4" role="alert">
          {error}
        </p>
      )}

      {/* Pie fijo */}
      {cursoId != null && total > 0 && (
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
            {pendiente ? "Guardando…" : "Guardar asistencia"}
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
  onToggle,
}: {
  fila: FilaAsistencia;
  estado: Estado | undefined;
  faltasToleradas: number;
  mostrarDeuda: boolean;
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

  // Sub-línea según estado.
  let sub: string;
  if (estado === "presente") sub = "Presente";
  else if (estado === "ausente") sub = "Ausente";
  else if (esParcial)
    sub = `${ETIQUETA_MODALIDAD[fila.modalidad]}${
      fila.restantes != null ? ` · quedan ${fila.restantes} ${fila.restantes === 1 ? "clase" : "clases"}` : ""
    }`;
  else sub = fila.faltasMes === 0 ? "Sin faltas este mes" : `${fila.faltasMes} ${fila.faltasMes === 1 ? "falta" : "faltas"} este mes`;

  // Pastilla de tolerancia (solo mensual, sin marcar).
  const pill =
    !estado && !esParcial
      ? restantesTol <= 0
        ? "Sin tolerancia"
        : restantesTol === 1
        ? "Última tolerada"
        : null
      : null;

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 text-left rounded-[var(--radio-panel)] border px-4 py-3 min-h-[72px] ${cls}`}
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
