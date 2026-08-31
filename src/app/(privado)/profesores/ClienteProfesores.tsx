"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profesor, Curso, Asignacion, DepsProfesor, DatosProfesor } from "@/lib/tipos";
import { compararPorApellido } from "@/lib/texto";
import EntidadProfesor, { TagTipo } from "@/components/entidades/EntidadProfesor";
import {
  crearProfesor,
  actualizarProfesor,
  eliminarODesactivarProfesor,
  activarProfesor,
  crearAsignacion,
  cerrarAsignacion,
} from "./acciones";

type Cuenta = { id: string; etiqueta: string };

export default function ClienteProfesores({
  padron,
  cursos,
  asignaciones,
  cuentas,
  especialidades,
  deps,
}: {
  padron: Profesor[];
  cursos: Curso[];
  asignaciones: Asignacion[];
  cuentas: Cuenta[];
  especialidades: string[];
  deps: Record<number, DepsProfesor>;
}) {
  const [tab, setTab] = useState<"listado" | "asignacion">("listado");

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(["listado", "asignacion"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-base rounded-[var(--radio-control)] border ${
              tab === t
                ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                : "border-[var(--borde)] hover:border-[var(--primario)]"
            }`}
          >
            {t === "listado" ? "Listado" : "Asignación a curso"}
          </button>
        ))}
      </div>

      {tab === "listado" ? (
        <TabListado
          padron={padron}
          cuentas={cuentas}
          especialidades={especialidades}
          deps={deps}
        />
      ) : (
        <TabAsignacion padron={padron} cursos={cursos} asignaciones={asignaciones} />
      )}
    </div>
  );
}

// ── Tab Listado ───────────────────────────────────────────────────────
function TabListado({
  padron,
  cuentas,
  especialidades,
  deps,
}: {
  padron: Profesor[];
  cuentas: Cuenta[];
  especialidades: string[];
  deps: Record<number, DepsProfesor>;
}) {
  const router = useRouter();
  const [editSel, setEditSel] = useState<Profesor | null>(null);
  const [remount, setRemount] = useState(0);
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const ordenado = [...padron].sort(compararPorApellido);

  async function onGuardar(datos: DatosProfesor, id: number | null) {
    const res = id ? await actualizarProfesor(id, datos) : await crearProfesor(datos);
    if (!res?.error) {
      setEditSel(null);
      setRemount((n) => n + 1);
      router.refresh();
    }
    return res ?? {};
  }
  async function onBaja(id: number) {
    const res = await eliminarODesactivarProfesor(id);
    if (!res?.error) {
      setEditSel(null);
      setRemount((n) => n + 1);
      router.refresh();
    }
    return res ?? {};
  }

  function rowAccion(fn: () => Promise<{ error?: string }>, exito: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (r?.error) setMsg(r.error);
      else {
        setMsg(exito);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 max-w-xl">
        <div className="text-base font-medium mb-3">
          {editSel ? "Editar profesor" : "Buscar o cargar profesor"}
        </div>
        <EntidadProfesor
          key={remount}
          padron={padron}
          cuentas={cuentas}
          especialidades={especialidades}
          permitirBaja
          valor={editSel}
          depsDe={(id) => deps[id]}
          onGuardar={onGuardar}
          onBaja={onBaja}
          onCancelar={() => setEditSel(null)}
        />
      </div>

      {msg && <p className="text-[var(--exito)] text-base">{msg}</p>}

      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
              <th className="py-3 px-4 font-medium">Profesor</th>
              <th className="py-3 px-4 font-medium">Especialidades</th>
              <th className="py-3 px-4 font-medium">Tipo</th>
              <th className="py-3 px-4 font-medium">Cuenta</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {ordenado.map((p) => {
              const d = deps[p.id];
              const historial =
                d && d.asignaciones + d.comisiones + d.liquidaciones + d.sala > 0;
              return (
                <tr
                  key={p.id}
                  className={`border-t border-[var(--borde)] ${p.activo ? "" : "opacity-50"}`}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium">
                      {p.apellido}, {p.nombre}
                    </div>
                    <div className="text-sm text-[var(--texto-tenue)]">{p.whatsapp || "—"}</div>
                  </td>
                  <td className="py-3 px-4 text-[var(--texto-tenue)]">
                    {p.especialidades.join(", ") || "—"}
                  </td>
                  <td className="py-3 px-4">
                    <TagTipo tipo={p.tipo} />
                  </td>
                  <td className="py-3 px-4 text-[var(--texto-tenue)]">
                    {p.usuario_id ? "Con cuenta" : "Sin cuenta"}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditSel(p);
                          setRemount((n) => n + 1);
                        }}
                        className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
                      >
                        Editar
                      </button>
                      {p.activo ? (
                        <button
                          disabled={pendiente}
                          onClick={() =>
                            rowAccion(
                              () => eliminarODesactivarProfesor(p.id),
                              historial ? "Profesor desactivado." : "Profesor eliminado."
                            )
                          }
                          className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--peligro)] text-[var(--peligro)] disabled:opacity-40"
                        >
                          {historial ? "Desactivar" : "Eliminar"}
                        </button>
                      ) : (
                        <button
                          disabled={pendiente}
                          onClick={() => rowAccion(() => activarProfesor(p.id), "Profesor activado.")}
                          className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--exito)] text-[var(--exito)] disabled:opacity-40"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                    {historial && p.activo && (
                      <div className="text-xs text-[var(--texto-tenue)] mt-1 text-right">
                        Tiene historial: se desactiva, no se elimina.
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {ordenado.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 px-4 text-[var(--texto-tenue)]">
                  Todavía no hay profesores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab Asignación ────────────────────────────────────────────────────
function TabAsignacion({
  padron,
  cursos,
  asignaciones,
}: {
  padron: Profesor[];
  cursos: Curso[];
  asignaciones: Asignacion[];
}) {
  const router = useRouter();
  const [cursoId, setCursoId] = useState<number | null>(null);
  const [profId, setProfId] = useState<number | null>(null);
  const [pctIng, setPctIng] = useState("");
  const [pctRef, setPctRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const nombreProf = (id: number) => {
    const p = padron.find((x) => x.id === id);
    return p ? `${p.apellido}, ${p.nombre}` : "—";
  };
  const nombreCurso = (id: number) => cursos.find((c) => c.id === id)?.nombre ?? "—";
  const vigenteDe = (cId: number) => asignaciones.find((a) => a.curso_id === cId && a.hasta === null);

  const estiloCurso = cursoId ? cursos.find((c) => c.id === cursoId)?.linea ?? null : null;
  const elegibles = padron
    .filter(
      (p) =>
        p.activo &&
        p.tipo === "activo" &&
        (!estiloCurso ||
          p.especialidades.length === 0 ||
          p.especialidades.includes(estiloCurso))
    )
    .sort(compararPorApellido);

  const num = (s: string) => Number(s.replace(/\D/g, "").slice(0, 3));

  function confirmar() {
    if (!cursoId || !profId) return;
    setError(null);
    startTransition(async () => {
      const res = await crearAsignacion(cursoId, profId, num(pctIng), num(pctRef));
      if (res?.error) setError(res.error);
      else {
        setCursoId(null);
        setProfId(null);
        setPctIng("");
        setPctRef("");
        router.refresh();
      }
    });
  }

  function cerrar(id: number) {
    startTransition(async () => {
      await cerrarAsignacion(id);
      router.refresh();
    });
  }

  const vigentes = asignaciones
    .filter((a) => a.hasta === null)
    .sort((a, b) => nombreCurso(a.curso_id).localeCompare(nombreCurso(b.curso_id), "es"));

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 1 · Curso */}
      <section className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6">
        <h3 className="text-xl mb-3">1 · Curso</h3>
        <div className="space-y-2">
          {cursos.length === 0 && (
            <p className="text-[var(--texto-tenue)]">
              No hay cursos cargados todavía. (La pantalla de Cursos es el próximo hito.)
            </p>
          )}
          {cursos.map((c) => {
            const v = vigenteDe(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setCursoId(c.id)}
                className={`w-full text-left px-4 py-3 rounded-[var(--radio-panel)] border transition-colors ${
                  cursoId === c.id
                    ? "bg-[var(--exito-fill)] border-[var(--exito)]"
                    : "bg-[var(--fondo-elevado)] border-[var(--borde)] hover:border-[var(--primario)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{c.nombre}</span>
                  <span className="text-sm text-[var(--texto-tenue)]">
                    {v ? `Titular: ${nombreProf(v.profesor_id)}` : "Sin titular"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2 · Titular */}
      {cursoId && (
        <section className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6">
          <h3 className="text-xl mb-1">2 · Profesor titular</h3>
          <p className="text-sm text-[var(--texto-tenue)] mb-3">
            Solo profesores Activos. Un externo no puede ser titular — solo alquila la sala.
          </p>
          <div className="space-y-2">
            {elegibles.map((p) => (
              <button
                key={p.id}
                onClick={() => setProfId(p.id)}
                className={`w-full text-left px-4 py-3 rounded-[var(--radio-panel)] border ${
                  profId === p.id
                    ? "bg-[var(--exito-fill)] border-[var(--exito)]"
                    : "bg-[var(--fondo-elevado)] border-[var(--borde)] hover:border-[var(--primario)]"
                }`}
              >
                {p.apellido}, {p.nombre}
                <span className="text-sm text-[var(--texto-tenue)]">
                  {" "}
                  · {p.especialidades.join(", ") || "sin especialidad"}
                </span>
              </button>
            ))}
            {elegibles.length === 0 && (
              <p className="text-[var(--texto-tenue)]">No hay profesores Activos cargados.</p>
            )}
          </div>
        </section>
      )}

      {/* 3 · Comisiones */}
      {cursoId && profId && (
        <section className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 space-y-4">
          <h3 className="text-xl">3 · Comisiones de esta asignación</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-base font-medium mb-1.5">% sobre los ingresos del curso</span>
              <input
                value={pctIng}
                onChange={(e) => setPctIng(e.target.value)}
                inputMode="numeric"
                placeholder="0–100"
                className="entrada"
              />
            </label>
            <label className="block">
              <span className="block text-base font-medium mb-1.5">% por alumno referido</span>
              <input
                value={pctRef}
                onChange={(e) => setPctRef(e.target.value)}
                inputMode="numeric"
                placeholder="0–100"
                className="entrada"
              />
            </label>
          </div>

          <div className="p-4 rounded-[var(--radio-panel)] border border-[var(--primario)] bg-[var(--accent-100)]">
            <div className="font-semibold text-[var(--peligro-texto)]">
              🔒 Al confirmar, estos dos porcentajes quedan fijos para esta asignación.
            </div>
            <p className="text-sm text-[var(--texto-tenue)] mt-1">
              Toda liquidación futura de este curso usa el valor congelado hoy. Para cobrar otro
              porcentaje hay que cerrar esta asignación y crear una nueva; lo ya devengado no cambia.
            </p>
          </div>

          {vigenteDe(cursoId) && (
            <div className="p-3 rounded-[var(--radio-panel)] border border-[var(--peligro)] bg-[var(--peligro-fill)] text-[var(--peligro-texto)] text-sm">
              Este curso ya tiene titular: {nombreProf(vigenteDe(cursoId)!.profesor_id)} (
              {vigenteDe(cursoId)!.pct_ingresos}% + {vigenteDe(cursoId)!.pct_referido}% referido, desde{" "}
              {vigenteDe(cursoId)!.desde}). Confirmar cierra esa asignación; lo ya devengado no se recalcula.
            </div>
          )}

          {error && (
            <p className="text-[var(--peligro)] text-base" role="alert">
              {error}
            </p>
          )}

          <button
            onClick={confirmar}
            disabled={pendiente}
            className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
          >
            {pendiente ? "Confirmando…" : "Confirmar asignación"}
          </button>
        </section>
      )}

      {/* Asignaciones vigentes */}
      <section className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] overflow-x-auto">
        <div className="p-4 text-base font-medium">Asignaciones vigentes</div>
        <table className="w-full text-left">
          <thead>
            <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
              <th className="py-3 px-4 font-medium">Curso</th>
              <th className="py-3 px-4 font-medium">Titular</th>
              <th className="py-3 px-4 font-medium text-right">% ingresos</th>
              <th className="py-3 px-4 font-medium text-right">% referido</th>
              <th className="py-3 px-4 font-medium">Fijado</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {vigentes.map((a) => (
              <tr key={a.id} className="border-t border-[var(--borde)]">
                <td className="py-3 px-4">{nombreCurso(a.curso_id)}</td>
                <td className="py-3 px-4">{nombreProf(a.profesor_id)}</td>
                <td className="py-3 px-4 text-right">{a.pct_ingresos}%</td>
                <td className="py-3 px-4 text-right">{a.pct_referido}%</td>
                <td className="py-3 px-4 text-[var(--texto-tenue)]">{a.desde}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    disabled={pendiente}
                    onClick={() => cerrar(a.id)}
                    className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40"
                  >
                    Cerrar
                  </button>
                </td>
              </tr>
            ))}
            {vigentes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 px-4 text-[var(--texto-tenue)]">
                  Sin asignaciones vigentes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
