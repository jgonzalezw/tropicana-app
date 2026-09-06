"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Curso, Plan, DatosPlan } from "@/lib/tipos";
import { gs } from "@/lib/inscripcion";
import { crearPlan, actualizarPlan, eliminarODesactivarPlan, activarPlan } from "./acciones";

const VACIO: DatosPlan = {
  nombre: "",
  precio: 0,
  cantidad_clases: null,
  criterio_liquidacion: 1,
  tolerancia_faltas: null,
  cursoIds: [],
};

export default function ClientePlanes({
  planes,
  cursos,
  deps,
}: {
  planes: Plan[];
  cursos: Curso[];
  deps: Record<number, number>;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<DatosPlan>(VACIO);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nombreCurso = useMemo(
    () => new Map(cursos.map((c) => [c.id, c.nombre])),
    [cursos]
  );
  const ordenado = [...planes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  function nuevo() {
    setEditId(null);
    setForm(VACIO);
    setError(null);
  }
  function editar(p: Plan) {
    setEditId(p.id);
    setForm({
      nombre: p.nombre,
      precio: Number(p.precio),
      cantidad_clases: p.cantidad_clases,
      criterio_liquidacion: p.criterio_liquidacion,
      tolerancia_faltas: p.tolerancia_faltas,
      cursoIds: p.cursoIds ?? (p.curso_id != null ? [p.curso_id] : []),
    });
    setError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function toggleCurso(id: number) {
    setForm((f) => ({
      ...f,
      cursoIds: f.cursoIds.includes(id) ? f.cursoIds.filter((x) => x !== id) : [...f.cursoIds, id],
    }));
  }

  function guardar() {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = editId ? await actualizarPlan(editId, form) : await crearPlan(form);
      if (res?.error) setError(res.error);
      else {
        setMsg(editId ? "Plan actualizado." : "Plan creado.");
        nuevo();
        router.refresh();
      }
    });
  }
  function rowAccion(fn: () => Promise<{ error?: string }>, exito: string) {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r?.error) setError(r.error);
      else {
        setMsg(exito);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-medium">{editId ? "Editar plan" : "Nuevo plan"}</div>
          {editId && (
            <button onClick={nuevo} className="text-sm text-[var(--primario)]">
              + Nuevo
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-[var(--texto-tenue)] block mb-1">Nombre del plan</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Plan Regular - Salsa"
              className="entrada w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-[var(--texto-tenue)] block mb-1">Clases (N)</label>
              <input
                value={form.cantidad_clases ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cantidad_clases: e.target.value.trim() === "" ? null : Math.trunc(Number(e.target.value.replace(/\D/g, ""))) || null,
                  })
                }
                inputMode="numeric"
                placeholder="12"
                className="entrada w-full"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--texto-tenue)] block mb-1">Precio (Bs.)</label>
              <input
                value={form.precio || ""}
                onChange={(e) => setForm({ ...form, precio: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
                inputMode="decimal"
                placeholder="200"
                className="entrada w-full"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--texto-tenue)] block mb-1">Tolerancia faltas</label>
              <input
                value={form.tolerancia_faltas ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tolerancia_faltas: e.target.value.trim() === "" ? null : Math.trunc(Number(e.target.value.replace(/\D/g, ""))) || 0,
                  })
                }
                inputMode="numeric"
                placeholder="(sistema)"
                className="entrada w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-[var(--texto-tenue)] block mb-1.5">
              Cursos incluidos {form.cursoIds.length > 1 ? "(combo)" : ""}
            </label>
            <div className="flex flex-wrap gap-2">
              {cursos.map((c) => {
                const on = form.cursoIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCurso(c.id)}
                    className={`px-3 py-2 text-sm rounded-[var(--radio-control)] border ${
                      on
                        ? "bg-[var(--exito-fill)] text-[var(--exito-texto)] border-[var(--exito)] font-medium"
                        : "bg-[var(--fondo-panel)] text-[var(--texto-tenue)] border-[var(--borde)] hover:border-[var(--primario)]"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {c.nombre}
                  </button>
                );
              })}
              {cursos.length === 0 && (
                <span className="text-sm text-[var(--texto-tenue)]">
                  No hay cursos activos. Cargá cursos primero en Gestión → Cursos.
                </span>
              )}
            </div>
          </div>

          <div className="max-w-[220px]">
            <label className="text-sm text-[var(--texto-tenue)] block mb-1">Criterio de liquidación</label>
            <select
              value={form.criterio_liquidacion}
              onChange={(e) => setForm({ ...form, criterio_liquidacion: Number(e.target.value) })}
              className="entrada w-full"
            >
              <option value={1}>1 — cobrado + completado</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>

          {error && <p className="text-[var(--peligro)] text-sm" role="alert">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={pendiente}
              className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
            >
              {pendiente ? "Guardando…" : editId ? "Guardar cambios" : "Crear plan"}
            </button>
            {editId && (
              <button onClick={nuevo} className="px-5 py-2.5 text-base rounded-[var(--radio-control)] border border-[var(--borde)]">
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      {msg && <p className="text-[var(--exito)] text-base">{msg}</p>}

      {/* Tabla */}
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
              <th className="py-3 px-4 font-medium">Plan</th>
              <th className="py-3 px-4 font-medium">Cursos</th>
              <th className="py-3 px-4 font-medium text-right">Clases</th>
              <th className="py-3 px-4 font-medium text-right">Precio</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {ordenado.map((p) => {
              const historial = (deps[p.id] ?? 0) > 0;
              const nombres = (p.cursoIds ?? []).map((id) => nombreCurso.get(id) ?? `#${id}`).join(" · ");
              return (
                <tr key={p.id} className={`border-t border-[var(--borde)] ${p.activo ? "" : "opacity-50"}`}>
                  <td className="py-3 px-4">
                    <div className="font-medium">{p.nombre}</div>
                    <div className="text-sm text-[var(--texto-tenue)]">criterio {p.criterio_liquidacion}</div>
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--texto-tenue)]">{nombres || "—"}</td>
                  <td className="py-3 px-4 text-right">{p.cantidad_clases ?? "—"}</td>
                  <td className="py-3 px-4 text-right">{gs(Number(p.precio))}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => editar(p)}
                        className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
                      >
                        Editar
                      </button>
                      {p.activo ? (
                        <button
                          disabled={pendiente}
                          onClick={() =>
                            rowAccion(
                              () => eliminarODesactivarPlan(p.id),
                              historial ? "Plan desactivado." : "Plan eliminado."
                            )
                          }
                          className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--peligro)] text-[var(--peligro)] disabled:opacity-40"
                        >
                          {historial ? "Desactivar" : "Eliminar"}
                        </button>
                      ) : (
                        <button
                          disabled={pendiente}
                          onClick={() => rowAccion(() => activarPlan(p.id), "Plan activado.")}
                          className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--exito)] text-[var(--exito)] disabled:opacity-40"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {ordenado.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 px-4 text-[var(--texto-tenue)]">
                  Todavía no hay planes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
