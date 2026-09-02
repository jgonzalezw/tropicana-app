"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AlumnoSesion, Curso, MarcaAsistencia } from "@/lib/tipos";
import { compararPorApellido } from "@/lib/texto";
import { isoFecha, ETIQUETA_MODALIDAD, type Modalidad } from "@/lib/inscripcion";
import { cargarSesion, guardarAsistencia } from "./acciones";

type Estado = "presente" | "ausente";
type Fila = AlumnoSesion;

export default function ClienteAsistencia({
  cursos,
  rosterPorCurso,
}: {
  cursos: Curso[];
  rosterPorCurso: Record<number, AlumnoSesion[]>;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const hoyIso = useMemo(() => isoFecha(new Date()), []);

  const [cursoId, setCursoId] = useState<number | null>(cursos[0]?.id ?? null);
  const [fecha, setFecha] = useState(hoyIso);
  const [marcas, setMarcas] = useState<Record<number, Estado>>({});
  const [extras, setExtras] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = useMemo(
    () => (cursoId != null ? rosterPorCurso[cursoId] ?? [] : []),
    [cursoId, rosterPorCurso]
  );

  // Cargar marcas ya guardadas al cambiar de curso/fecha (permite re-editar).
  const pedido = useRef(0);
  useEffect(() => {
    if (cursoId == null) return;
    const idPedido = ++pedido.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    cargarSesion(cursoId, fecha)
      .then(({ marcas: guardadas }) => {
        if (idPedido !== pedido.current) return; // llegó una respuesta vieja
        const m: Record<number, Estado> = {};
        for (const g of guardadas) m[g.alumnoId] = g.estado;
        setMarcas(m);
        // Marcas de alumnos que ya no están en el padrón base (parcial ya
        // consumido) se agregan como extra para poder verlas/editarlas.
        const idsBase = new Set(base.map((f) => f.alumnoId));
        setExtras(
          guardadas
            .filter((g) => !idsBase.has(g.alumnoId))
            .map((g) => ({
              inscripcionId: g.inscripcionId,
              alumnoId: g.alumnoId,
              apellido: g.apellido,
              nombre: g.nombre,
              modalidad: "mensual" as Modalidad,
              restantes: null,
            }))
        );
      })
      .finally(() => {
        if (idPedido === pedido.current) setCargando(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursoId, fecha]);

  const filas = useMemo(() => [...base, ...extras].sort(compararPorApellido), [base, extras]);

  const total = filas.length;
  const presentes = filas.filter((f) => marcas[f.alumnoId] === "presente").length;
  const ausentes = filas.filter((f) => marcas[f.alumnoId] === "ausente").length;
  const marcados = presentes + ausentes;
  const sinMarcar = total - marcados;

  function toggle(alumnoId: number) {
    setAviso(null);
    setMarcas((prev) => {
      const actual = prev[alumnoId];
      const siguiente: Estado = actual === "presente" ? "ausente" : "presente";
      return { ...prev, [alumnoId]: siguiente };
    });
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
    const inscPorAlumno = new Map(filas.map((f) => [f.alumnoId, f.inscripcionId]));
    const payload: MarcaAsistencia[] = filas
      .filter((f) => marcas[f.alumnoId])
      .map((f) => ({
        alumnoId: f.alumnoId,
        inscripcionId: inscPorAlumno.get(f.alumnoId) ?? null,
        estado: marcas[f.alumnoId],
      }));
    startTransition(async () => {
      const res = await guardarAsistencia({ cursoId, fecha, marcas: payload });
      if (res.error) setError(res.error);
      else {
        setAviso(res.resumen ?? "Asistencia guardada.");
        router.refresh(); // recalcula clases restantes de los parciales
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto pb-28">
      <div className="mb-5">
        <h1 className="text-3xl">Tomar asistencia</h1>
        <p className="text-[var(--texto-tenue)] mt-2 text-lg">
          Marcá presente o ausente y guardá. Un toque marca presente; otro lo pasa a ausente.
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

      {/* Selector de curso y fecha */}
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-4 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <label className="block">
            <span className="block text-sm text-[var(--texto-tenue)] mb-1.5">Curso</span>
            <select
              value={cursoId ?? ""}
              onChange={(e) => setCursoId(e.target.value ? Number(e.target.value) : null)}
              className="entrada"
            >
              {cursos.length === 0 && <option value="">No hay cursos activos</option>}
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm text-[var(--texto-tenue)] mb-1.5">Fecha</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="entrada"
            />
          </label>
        </div>
      </div>

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
        <p className="text-[var(--texto-tenue)]">Elegí un curso.</p>
      ) : cargando ? (
        <p className="text-[var(--texto-tenue)]">Cargando lista…</p>
      ) : total === 0 ? (
        <p className="text-[var(--texto-tenue)]">
          Este curso no tiene alumnos con inscripción activa.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filas.map((f) => {
            const estado = marcas[f.alumnoId];
            const cls =
              estado === "presente"
                ? "bg-[var(--exito-fill)] border-[var(--exito)] text-[var(--exito-texto)]"
                : estado === "ausente"
                ? "bg-[var(--peligro-fill)] border-[var(--peligro)] text-[var(--peligro-texto)]"
                : "bg-[var(--fondo-elevado)] border-[var(--borde)]";
            return (
              <button
                key={f.alumnoId}
                onClick={() => toggle(f.alumnoId)}
                className={`w-full flex items-center gap-3 text-left rounded-[var(--radio-panel)] border px-4 py-3 min-h-[68px] ${cls}`}
              >
                <span
                  className={`shrink-0 w-8 h-8 rounded-full grid place-items-center text-sm font-bold ${
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
                  <span className="block font-semibold">
                    {f.apellido}, {f.nombre}
                  </span>
                  <span className="block text-sm opacity-80">
                    {estado === "presente"
                      ? "Presente"
                      : estado === "ausente"
                      ? "Ausente"
                      : etiquetaFila(f)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
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

function etiquetaFila(f: Fila): string {
  if (f.modalidad === "mensual") return "Mensual";
  const nombre = ETIQUETA_MODALIDAD[f.modalidad];
  if (f.restantes == null) return nombre;
  return `${nombre} · quedan ${f.restantes} ${f.restantes === 1 ? "clase" : "clases"}`;
}
