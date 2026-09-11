"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AccesoModo, Curso, Plan, DatosPlan } from "@/lib/tipos";
import { gs } from "@/lib/inscripcion";
import { etiquetaDias } from "@/components/entidades/EntidadCurso";
import Toggle from "@/components/Toggle";
import {
  referenciaPorClases,
  referenciaPorPeriodo,
  type TarifasDeCurso,
} from "@/lib/precios";
import { crearPlan, actualizarPlan, eliminarODesactivarPlan, activarPlan } from "./acciones";

const VACIO: DatosPlan = {
  nombre: "",
  precio: 0,
  acceso_modo: "solo",
  clases_ilimitadas: false,
  cantidad_clases: null,
  ciclo_dias: null,
  criterio_liquidacion: 1,
  tolerancia_faltas: null,
  cursoIds: [],
  acepta_prueba: false,
  prueba_cursos_max: null,
  prueba_acredita: true,
  prueba_plazo_dias: null,
};

const ACCESO_LABEL: Record<AccesoModo, string> = {
  solo: "Solo las seleccionadas",
  todas: "Todas las clases",
  excepto: "Todas excepto las seleccionadas",
};

function numOrNull(s: string): number | null {
  const t = s.replace(/\D/g, "");
  return t === "" ? null : Math.trunc(Number(t));
}

export default function ClientePlanes({
  planes,
  cursos,
  deps,
  toleranciaAcademia,
  plazoAcademia,
  tarifas,
  factorMedioMes,
}: {
  planes: Plan[];
  cursos: Curso[];
  /** Parámetro `tolerancia_faltas`: lo que aplica si el plan no define lo suyo. */
  toleranciaAcademia: number;
  /** Parámetro `prueba_plazo_dias`: el plazo por defecto para convertir. */
  plazoAcademia: number;
  /** Tarifas parciales por curso, para estimar el valor de una clase. */
  tarifas: Record<number, TarifasDeCurso>;
  /** Parámetro `medio_mes_factor`: cuántas semanas entran en "medio mes". */
  factorMedioMes: number;
  deps: Record<number, number>;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<DatosPlan>(VACIO);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nombreCurso = useMemo(() => new Map(cursos.map((c) => [c.id, c.nombre])), [cursos]);
  const cursoById = useMemo(() => new Map(cursos.map((c) => [c.id, c])), [cursos]);
  const cursoConDias = (id: number) => {
    const c = cursoById.get(id);
    if (!c) return `#${id}`;
    const d = etiquetaDias(c.dias_semana);
    return d ? `${c.nombre} (${d})` : c.nombre;
  };
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
      acceso_modo: p.acceso_modo,
      clases_ilimitadas: p.clases_ilimitadas,
      cantidad_clases: p.cantidad_clases,
      ciclo_dias: p.ciclo_dias,
      criterio_liquidacion: p.criterio_liquidacion,
      tolerancia_faltas: p.tolerancia_faltas,
      cursoIds: p.cursoIds ?? (p.curso_id != null ? [p.curso_id] : []),
      acepta_prueba: p.acepta_prueba,
      prueba_cursos_max: p.prueba_cursos_max,
      prueba_acredita: p.prueba_acredita,
      prueba_plazo_dias: p.prueba_plazo_dias,
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

  const muestraCursos = form.acceso_modo !== "todas";

  /**
   * A qué cursos da acceso el plan, según cómo se definió el acceso. No es lo
   * mismo que los tildados: con "todas excepto", los tildados son los que
   * quedan afuera.
   */
  const cursosDelPlan = useMemo(() => {
    if (form.acceso_modo === "todas") return cursos;
    if (form.acceso_modo === "excepto") return cursos.filter((c) => !form.cursoIds.includes(c.id));
    return cursos.filter((c) => form.cursoIds.includes(c.id));
  }, [cursos, form.acceso_modo, form.cursoIds]);

  /**
   * Valor de referencia: lo que costaría comprar por separado lo que el plan
   * ofrece junto. Sugiere, no impone. Con N clases se estima el valor de una
   * clase desde el tramo de tarifa que corresponde a esa cantidad; con un
   * ilimitado se escala el mensual a la duración del ciclo.
   */
  const referencia = useMemo(() => {
    if (!cursosDelPlan.length) return null;
    if (form.clases_ilimitadas)
      return form.ciclo_dias && form.ciclo_dias > 0
        ? referenciaPorPeriodo(cursosDelPlan, form.ciclo_dias)
        : null;
    return form.cantidad_clases && form.cantidad_clases > 0
      ? referenciaPorClases(cursosDelPlan, tarifas, form.cantidad_clases, factorMedioMes)
      : null;
  }, [
    cursosDelPlan,
    form.clases_ilimitadas,
    form.ciclo_dias,
    form.cantidad_clases,
    tarifas,
    factorMedioMes,
  ]);
  const difPrecio = referencia && form.precio > 0 ? form.precio - referencia.total : 0;

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

          {/* Límite de clases */}
          <Toggle
            checked={form.clases_ilimitadas}
            onChange={(v) => setForm({ ...form, clases_ilimitadas: v })}
            label="Clases ilimitadas"
            descripcion="Sin tope de clases: el alumno toma libremente durante el ciclo."
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {form.clases_ilimitadas ? (
              <div>
                <label className="text-sm text-[var(--texto-tenue)] block mb-1">Duración del ciclo (días)</label>
                <input
                  value={form.ciclo_dias ?? ""}
                  onChange={(e) => setForm({ ...form, ciclo_dias: numOrNull(e.target.value) })}
                  inputMode="numeric"
                  placeholder="30"
                  className="entrada w-full"
                />
              </div>
            ) : (
              <div>
                <label className="text-sm text-[var(--texto-tenue)] block mb-1">Clases (N)</label>
                <input
                  value={form.cantidad_clases ?? ""}
                  onChange={(e) => setForm({ ...form, cantidad_clases: numOrNull(e.target.value) })}
                  inputMode="numeric"
                  placeholder="12"
                  className="entrada w-full"
                />
              </div>
            )}
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
          </div>

          {/* Referencia de precio: lo mismo, comprado por separado. */}
          {referencia && referencia.total > 0 && (
            <div className="rounded-[var(--radio-panel)] border border-[var(--borde)] bg-[var(--fondo-elevado)] p-3">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="text-base">
                  Comprado por separado:{" "}
                  <span className="tabular-nums font-semibold">{gs(referencia.total)}</span>
                </span>
                {Math.round(form.precio) !== Math.round(referencia.total) && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, precio: Math.round(referencia.total) })}
                    className="text-sm text-[var(--primario)]"
                  >
                    Usar este precio
                  </button>
                )}
              </div>
              <ul className="text-sm text-[var(--texto-tenue)] mt-1 space-y-0.5">
                {referencia.lineas.map((l) => (
                  <li key={l.curso.id}>
                    {form.clases_ilimitadas ? (
                      <>
                        {l.curso.nombre}: {gs(l.valorClase)} el mes × {form.ciclo_dias} días ={" "}
                        {gs(l.subtotal)}
                      </>
                    ) : (
                      <>
                        {l.curso.nombre}: {gs(l.valorClase)} por clase (tarifa de {l.tramo}) ×{" "}
                        {form.cantidad_clases} = {gs(l.subtotal)}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {!form.clases_ilimitadas && referencia.lineas.length > 1 && (
                <p className="text-sm text-[var(--texto-tenue)] mt-1">
                  Con varios cursos no se sabe cómo va a repartir sus {form.cantidad_clases} clases,
                  así que se promedia el valor por clase.
                </p>
              )}
              {referencia.sinTarifa.length > 0 && (
                <p className="text-sm text-[var(--peligro)] mt-1">
                  Sin tarifa cargada: {referencia.sinTarifa.map((c) => c.nombre).join(", ")}. No
                  entran en la referencia.
                </p>
              )}
              {form.precio > 0 && Math.abs(difPrecio) >= 1 && (
                <p className="text-sm mt-1 text-[var(--primario-hover)]">
                  {difPrecio < 0
                    ? `El alumno ahorra ${gs(-difPrecio)} comprando el plan.`
                    : `El plan sale ${gs(difPrecio)} más que comprarlo por separado.`}
                </p>
              )}
            </div>
          )}

          {/* Clase de prueba: el plan decide si se ofrece y con qué condiciones. */}
          <div className="space-y-2">
            <Toggle
              checked={form.acepta_prueba}
              onChange={(v) =>
                setForm({
                  ...form,
                  acepta_prueba: v,
                  prueba_cursos_max: v ? (form.prueba_cursos_max ?? 1) : null,
                  prueba_plazo_dias: v ? (form.prueba_plazo_dias ?? plazoAcademia) : null,
                })
              }
              label="Se puede probar antes de comprar"
              descripcion="El prospecto toma una clase de prueba de este plan, la paga al precio de prueba del curso, y después decide."
            />
            {form.acepta_prueba && (
              <div className="space-y-3 pl-2 border-l-2 border-[var(--borde)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-[var(--texto-tenue)] block mb-1">
                      ¿Cuántos cursos puede probar?
                    </label>
                    <input
                      value={form.prueba_cursos_max ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, prueba_cursos_max: numOrNull(e.target.value) })
                      }
                      inputMode="numeric"
                      placeholder="1"
                      className="entrada w-full"
                    />
                    <p className="text-sm text-[var(--texto-tenue)] mt-1">
                      Una clase en cada uno.
                      {cursosDelPlan.length > 1
                        ? ` El plan da acceso a ${cursosDelPlan.length}.`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--texto-tenue)] block mb-1">
                      Días para decidir
                    </label>
                    <input
                      value={form.prueba_plazo_dias ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, prueba_plazo_dias: numOrNull(e.target.value) })
                      }
                      inputMode="numeric"
                      placeholder={String(plazoAcademia)}
                      className="entrada w-full"
                    />
                    <p className="text-sm text-[var(--texto-tenue)] mt-1">
                      Vacío usa la política de la academia: {plazoAcademia} días.
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={form.prueba_acredita}
                  onChange={(v) => setForm({ ...form, prueba_acredita: v })}
                  label="Lo pagado por la prueba se le acredita al inscribirse"
                  descripcion="Dentro del plazo, el fee de la prueba baja lo que tiene que pagar. Pasado el plazo, se pierde."
                />
              </div>
            )}
          </div>

          {/* Tolerancia: por defecto manda la política de la academia. */}
          <div className="space-y-2">
            <Toggle
              checked={form.tolerancia_faltas != null}
              onChange={(v) =>
                setForm({ ...form, tolerancia_faltas: v ? toleranciaAcademia : null })
              }
              label="Tolerancia de faltas propia de este plan"
              descripcion={`Apagado, usa la política de la academia: ${toleranciaAcademia} ${
                toleranciaAcademia === 1 ? "falta tolerada" : "faltas toleradas"
              } por ciclo.`}
            />
            {form.tolerancia_faltas != null && (
              <div className="max-w-[220px]">
                <label className="text-sm text-[var(--texto-tenue)] block mb-1">
                  Faltas toleradas en este plan
                </label>
                <input
                  value={form.tolerancia_faltas ?? ""}
                  onChange={(e) => setForm({ ...form, tolerancia_faltas: numOrNull(e.target.value) })}
                  inputMode="numeric"
                  className="entrada w-full"
                />
              </div>
            )}
          </div>

          {/* Criterio de acceso a cursos */}
          <div className="max-w-[320px]">
            <label className="text-sm text-[var(--texto-tenue)] block mb-1">¿A qué clases accede el plan?</label>
            <select
              value={form.acceso_modo}
              onChange={(e) => setForm({ ...form, acceso_modo: e.target.value as AccesoModo })}
              className="entrada w-full"
            >
              <option value="solo">{ACCESO_LABEL.solo}</option>
              <option value="todas">{ACCESO_LABEL.todas}</option>
              <option value="excepto">{ACCESO_LABEL.excepto}</option>
            </select>
          </div>

          {muestraCursos && (
            <div>
              <label className="text-sm text-[var(--texto-tenue)] block mb-1.5">
                {form.acceso_modo === "excepto" ? "Cursos excluidos" : "Cursos incluidos"}
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
          )}

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
              const nombres = (p.cursoIds ?? []).map((id) => cursoConDias(id)).join(" · ");
              const soloNombres = (p.cursoIds ?? []).map((id) => nombreCurso.get(id) ?? `#${id}`).join(" · ");
              const cursosTxt =
                p.acceso_modo === "todas"
                  ? "Todos los cursos"
                  : p.acceso_modo === "excepto"
                  ? `Todos excepto: ${soloNombres || "—"}`
                  : nombres || "—";
              const clasesTxt = p.clases_ilimitadas
                ? `Ilimitado${p.ciclo_dias ? ` · ${p.ciclo_dias}d` : ""}`
                : p.cantidad_clases ?? "—";
              return (
                <tr key={p.id} className={`border-t border-[var(--borde)] ${p.activo ? "" : "opacity-50"}`}>
                  <td className="py-3 px-4">
                    <div className="font-medium">{p.nombre}</div>
                    <div className="text-sm text-[var(--texto-tenue)]">criterio {p.criterio_liquidacion}</div>
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--texto-tenue)]">{cursosTxt}</td>
                  <td className="py-3 px-4 text-right">{clasesTxt}</td>
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
