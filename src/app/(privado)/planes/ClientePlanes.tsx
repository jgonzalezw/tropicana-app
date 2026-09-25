"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  AccesoModo,
  Curso,
  Plan,
  DatosPlan,
  TipoServicioPlan,
  Estilo,
  ReservaModalidad,
  FormaPagoProfesor,
  ExtensionModo,
} from "@/lib/tipos";
import { gs } from "@/lib/inscripcion";
import { etiquetaDias } from "@/components/entidades/EntidadCurso";
import { vigenciaDiasEfectiva } from "@/lib/planesParticular";
import Toggle from "@/components/Toggle";
import {
  referenciaPorClases,
  referenciaPorPeriodo,
  type TarifasDeCurso,
} from "@/lib/precios";
import { crearPlan, actualizarPlan, eliminarODesactivarPlan, activarPlan } from "./acciones";

type Sala = { id: number; nombre: string };

const VACIO_COMUN = {
  nombre: "",
  precio: 0,
  acceso_modo: "solo" as AccesoModo,
  clases_ilimitadas: false,
  cantidad_clases: null,
  ciclo_dias: null,
  criterio_liquidacion: 1,
  tolerancia_faltas: null,
  cursoIds: [] as number[],
  acepta_prueba: false,
  prueba_cursos_max: null,
  prueba_acredita: true,
  prueba_plazo_dias: null,
  estilo: null,
  vigencia_dias: null,
  reserva_modalidad: null,
  salas_modo: "todas" as const,
  salaIds: [] as number[],
  forma_pago_profesor: null,
  pago_pct_margen: null,
  pago_descuenta_sala: false,
  pago_monto_fijo: null,
  extension_modo: "lista" as const,
  extension_recargo_pct: null,
  registra_acompanantes: false,
};

function vacioPara(tipo: TipoServicioPlan): DatosPlan {
  return { ...VACIO_COMUN, tipo_servicio: tipo };
}

const ACCESO_LABEL: Record<AccesoModo, string> = {
  solo: "Solo las seleccionadas",
  todas: "Todas las clases",
  excepto: "Todas excepto las seleccionadas",
};

const CRITERIO_LABEL: Record<number, string> = {
  1: "1 — Al completar la membresía, período vencido",
  2: "2 — Proporcional al avance, período vencido",
  3: "3 — Al completar la membresía, inmediato",
  4: "4 — Taller: al completar, sobre lo cobrado",
  5: "5 — Taller: monto fijo al completar",
};

const PESTANAS: { tipo: TipoServicioPlan; etiqueta: string; construido: boolean }[] = [
  { tipo: "curso_regular", etiqueta: "Cursos regulares", construido: true },
  { tipo: "particular", etiqueta: "Clases particulares", construido: true },
  { tipo: "alquiler", etiqueta: "Alquiler de salas", construido: false },
  { tipo: "taller", etiqueta: "Talleres", construido: false },
];

function numOrNull(s: string): number | null {
  const t = s.replace(/\D/g, "");
  return t === "" ? null : Math.trunc(Number(t));
}
function decOrNull(s: string): number | null {
  const t = s.replace(/[^\d.]/g, "");
  return t === "" ? null : Number(t);
}

export default function ClientePlanes({
  planes,
  cursos,
  estilos,
  salas,
  deps,
  toleranciaAcademia,
  plazoAcademia,
  tarifas,
  factorMedioMes,
  vigenciaMesesAcademia,
}: {
  planes: Plan[];
  cursos: Curso[];
  estilos: Estilo[];
  salas: Sala[];
  /** Parámetro `tolerancia_faltas`: lo que aplica si el plan no define lo suyo. */
  toleranciaAcademia: number;
  /** Parámetro `prueba_plazo_dias`: el plazo por defecto para convertir. */
  plazoAcademia: number;
  /** Tarifas parciales por curso, para estimar el valor de una clase. */
  tarifas: Record<number, TarifasDeCurso>;
  /** Parámetro `medio_mes_factor`: cuántas semanas entran en "medio mes". */
  factorMedioMes: number;
  /** Parámetro `vencimiento_paquete_meses`: vigencia default de un paquete de particulares. */
  vigenciaMesesAcademia: number;
  deps: Record<number, number>;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [tab, setTab] = useState<TipoServicioPlan>("curso_regular");
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<DatosPlan>(vacioPara("curso_regular"));
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nombreCurso = useMemo(() => new Map(cursos.map((c) => [c.id, c.nombre])), [cursos]);
  const cursoById = useMemo(() => new Map(cursos.map((c) => [c.id, c])), [cursos]);
  const nombreEstilo = useMemo(() => new Map(estilos.map((e) => [e.clave, e.nombre])), [estilos]);
  const cursoConDias = (id: number) => {
    const c = cursoById.get(id);
    if (!c) return `#${id}`;
    const d = etiquetaDias(c.dias_semana);
    return d ? `${c.nombre} (${d})` : c.nombre;
  };

  const planesDeTab = useMemo(
    () => planes.filter((p) => p.tipo_servicio === tab).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [planes, tab]
  );

  function cambiarTab(t: TipoServicioPlan) {
    setTab(t);
    setEditId(null);
    setForm(vacioPara(t));
    setError(null);
    setMsg(null);
  }

  function nuevo() {
    setEditId(null);
    setForm(vacioPara(tab));
    setError(null);
  }

  function editar(p: Plan) {
    setTab(p.tipo_servicio);
    setEditId(p.id);
    setForm({
      nombre: p.nombre,
      tipo_servicio: p.tipo_servicio,
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
      estilo: p.estilo,
      vigencia_dias: p.vigencia_dias,
      reserva_modalidad: p.reserva_modalidad,
      salas_modo: p.salas_modo,
      salaIds: p.salaIds ?? [],
      forma_pago_profesor: p.forma_pago_profesor,
      pago_pct_margen: p.pago_pct_margen,
      pago_descuenta_sala: p.pago_descuenta_sala,
      pago_monto_fijo: p.pago_monto_fijo,
      extension_modo: p.extension_modo,
      extension_recargo_pct: p.extension_recargo_pct,
      registra_acompanantes: p.registra_acompanantes,
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
  function toggleSala(id: number) {
    setForm((f) => ({
      ...f,
      salaIds: f.salaIds.includes(id) ? f.salaIds.filter((x) => x !== id) : [...f.salaIds, id],
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

  const vigenciaDefaultDias = vigenciaDiasEfectiva(null, vigenciaMesesAcademia);

  return (
    <div className="space-y-6">
      {/* Pestañas por tipo de servicio (regla de negocio 22). */}
      <div className="flex flex-wrap gap-2 border-b border-[var(--borde)] pb-3">
        {PESTANAS.map((p) => (
          <button
            key={p.tipo}
            onClick={() => cambiarTab(p.tipo)}
            className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border transition-colors ${
              tab === p.tipo
                ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                : "border-[var(--borde)] hover:border-[var(--primario)]"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {!PESTANAS.find((p) => p.tipo === tab)?.construido ? (
        <div className="rounded-[var(--radio-panel)] border border-[var(--borde)] bg-[var(--fondo-elevado)] p-4 max-w-2xl">
          <p className="text-base">
            {tab === "alquiler"
              ? "Los planes de alquiler de sala se construyen en el hito H7 del plan de C3."
              : "Los planes de taller se construyen en el hito H8 del plan de C3 (pasa por Design antes: no hay mockup de dónde partir)."}
          </p>
          <p className="text-sm text-[var(--texto-tenue)] mt-1">
            No es que falte cargar algo: esta pestaña todavía no tiene formulario propio.
          </p>
        </div>
      ) : (
        <>
          {/* Formulario */}
          <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-medium">
                {editId ? "Editar plan" : tab === "particular" ? "Nuevo plan de particulares" : "Nuevo plan"}
              </div>
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
                  placeholder={tab === "particular" ? "Ej: Pack 5 horas — Salsa" : "Ej: Plan Regular - Salsa"}
                  className="entrada w-full"
                />
              </div>

              {tab === "curso_regular" ? (
                <FormularioCursoRegular
                  form={form}
                  setForm={setForm}
                  cursos={cursos}
                  toleranciaAcademia={toleranciaAcademia}
                  plazoAcademia={plazoAcademia}
                  referencia={referencia}
                  difPrecio={difPrecio}
                  cursosDelPlan={cursosDelPlan}
                  muestraCursos={muestraCursos}
                  toggleCurso={toggleCurso}
                />
              ) : (
                <FormularioParticular
                  form={form}
                  setForm={setForm}
                  estilos={estilos}
                  salas={salas}
                  toggleSala={toggleSala}
                  vigenciaDefaultDias={vigenciaDefaultDias}
                />
              )}

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
                  {tab === "curso_regular" ? (
                    <>
                      <th className="py-3 px-4 font-medium">Cursos</th>
                      <th className="py-3 px-4 font-medium text-right">Clases</th>
                      <th className="py-3 px-4 font-medium text-right">Precio</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3 px-4 font-medium">Estilo</th>
                      <th className="py-3 px-4 font-medium">Modalidad</th>
                      <th className="py-3 px-4 font-medium">Pago al profesor</th>
                    </>
                  )}
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {planesDeTab.map((p) => {
                  const historial = (deps[p.id] ?? 0) > 0;
                  return (
                    <tr key={p.id} className={`border-t border-[var(--borde)] ${p.activo ? "" : "opacity-50"}`}>
                      <td className="py-3 px-4">
                        <div className="font-medium">{p.nombre}</div>
                        <div className="text-sm text-[var(--texto-tenue)]">criterio {p.criterio_liquidacion}</div>
                      </td>
                      {tab === "curso_regular" ? (
                        <FilaCursoRegular p={p} nombreCurso={nombreCurso} cursoConDias={cursoConDias} />
                      ) : (
                        <FilaParticular p={p} nombreEstilo={nombreEstilo} />
                      )}
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
                {planesDeTab.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 px-4 text-[var(--texto-tenue)]">
                      Todavía no hay planes en esta pestaña.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FilaCursoRegular({
  p,
  nombreCurso,
  cursoConDias,
}: {
  p: Plan;
  nombreCurso: Map<number, string>;
  cursoConDias: (id: number) => string;
}) {
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
    <>
      <td className="py-3 px-4 text-sm text-[var(--texto-tenue)]">{cursosTxt}</td>
      <td className="py-3 px-4 text-right">{clasesTxt}</td>
      <td className="py-3 px-4 text-right">{gs(Number(p.precio))}</td>
    </>
  );
}

const MODALIDAD_LABEL: Record<ReservaModalidad, string> = { fija: "Agenda fija", flexible: "Reserva flexible" };
const PAGO_LABEL: Record<FormaPagoProfesor, string> = {
  fee_hora: "Fee por hora",
  pct_margen: "% sobre el margen",
  monto_fijo: "Monto fijo",
};

function FilaParticular({ p, nombreEstilo }: { p: Plan; nombreEstilo: Map<string, string> }) {
  return (
    <>
      <td className="py-3 px-4 text-sm text-[var(--texto-tenue)]">
        {p.estilo ? nombreEstilo.get(p.estilo) ?? p.estilo : "—"}
      </td>
      <td className="py-3 px-4 text-sm text-[var(--texto-tenue)]">
        {p.reserva_modalidad ? MODALIDAD_LABEL[p.reserva_modalidad] : "—"}
      </td>
      <td className="py-3 px-4 text-sm text-[var(--texto-tenue)]">
        {p.forma_pago_profesor ? PAGO_LABEL[p.forma_pago_profesor] : "—"}
      </td>
    </>
  );
}

function FormularioCursoRegular({
  form,
  setForm,
  cursos,
  toleranciaAcademia,
  plazoAcademia,
  referencia,
  difPrecio,
  cursosDelPlan,
  muestraCursos,
  toggleCurso,
}: {
  form: DatosPlan;
  setForm: (f: DatosPlan) => void;
  cursos: Curso[];
  toleranciaAcademia: number;
  plazoAcademia: number;
  referencia: ReturnType<typeof referenciaPorClases> | ReturnType<typeof referenciaPorPeriodo> | null;
  difPrecio: number;
  cursosDelPlan: Curso[];
  muestraCursos: boolean;
  toggleCurso: (id: number) => void;
}) {
  return (
    <>
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
          <option value={1}>{CRITERIO_LABEL[1]}</option>
          <option value={2}>{CRITERIO_LABEL[2]}</option>
          <option value={3}>{CRITERIO_LABEL[3]}</option>
        </select>
      </div>
    </>
  );
}

function FormularioParticular({
  form,
  setForm,
  estilos,
  salas,
  toggleSala,
  vigenciaDefaultDias,
}: {
  form: DatosPlan;
  setForm: (f: DatosPlan) => void;
  estilos: Estilo[];
  salas: Sala[];
  toggleSala: (id: number) => void;
  vigenciaDefaultDias: number;
}) {
  return (
    <>
      {/* Estilo: de acá sale qué tramos de tarifas_particular se ofrecen al vender. */}
      <div className="max-w-[320px]">
        <label className="text-sm text-[var(--texto-tenue)] block mb-1">Estilo</label>
        <select
          value={form.estilo ?? ""}
          onChange={(e) => setForm({ ...form, estilo: e.target.value || null })}
          className="entrada w-full"
        >
          <option value="">— Elegir —</option>
          {estilos.map((e) => (
            <option key={e.clave} value={e.clave}>
              {e.nombre}
            </option>
          ))}
        </select>
        <p className="text-sm text-[var(--texto-tenue)] mt-1">
          Los tramos de horas y precio se cargan en Precios y paquetes; al vender, se eligen entre
          los que tengan este estilo.
        </p>
      </div>

      {/* Vigencia del paquete. */}
      <div className="max-w-[260px]">
        <label className="text-sm text-[var(--texto-tenue)] block mb-1">Vigencia del paquete (días)</label>
        <input
          value={form.vigencia_dias ?? ""}
          onChange={(e) => setForm({ ...form, vigencia_dias: numOrNull(e.target.value) })}
          inputMode="numeric"
          placeholder={String(vigenciaDefaultDias)}
          className="entrada w-full"
        />
        <p className="text-sm text-[var(--texto-tenue)] mt-1">
          Vacío usa la política de la academia: {vigenciaDefaultDias} días. Lo no usado al vencer
          se pierde.
        </p>
      </div>

      {/* Modalidad de reserva (definiciones-v2, 7.5). */}
      <div>
        <span className="block text-sm text-[var(--texto-tenue)] mb-1.5">Modalidad de reserva</span>
        <div className="flex gap-2">
          {(["fija", "flexible"] as ReservaModalidad[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setForm({ ...form, reserva_modalidad: m })}
              className={`flex-1 px-4 py-2.5 text-sm rounded-[var(--radio-control)] border ${
                form.reserva_modalidad === m
                  ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                  : "border-[var(--borde)] hover:border-[var(--primario)]"
              }`}
            >
              {MODALIDAD_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="text-sm text-[var(--texto-tenue)] mt-1">
          {form.reserva_modalidad === "fija"
            ? "Días, horarios y periodicidad se fijan desde el inicio; las sesiones quedan programadas hasta completar el paquete."
            : "Cada sesión se reserva según disponibilidad, hasta consumir el paquete o hasta que venza."}
        </p>
      </div>

      {/* Salas permitidas. */}
      <div className="space-y-2">
        <Toggle
          checked={form.salas_modo === "solo"}
          onChange={(v) => setForm({ ...form, salas_modo: v ? "solo" : "todas" })}
          label="Restringir a ciertas salas"
          descripcion="Apagado: puede usar cualquier sala activa."
        />
        {form.salas_modo === "solo" && (
          <div className="flex flex-wrap gap-2">
            {salas.map((s) => {
              const on = form.salaIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSala(s.id)}
                  className={`px-3 py-2 text-sm rounded-[var(--radio-control)] border ${
                    on
                      ? "bg-[var(--exito-fill)] text-[var(--exito-texto)] border-[var(--exito)] font-medium"
                      : "bg-[var(--fondo-panel)] text-[var(--texto-tenue)] border-[var(--borde)] hover:border-[var(--primario)]"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {s.nombre}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Forma de pago al profesor (definiciones-v2, sección 3). */}
      <div className="space-y-2">
        <label className="text-sm text-[var(--texto-tenue)] block mb-1">Forma de pago al profesor</label>
        <select
          value={form.forma_pago_profesor ?? ""}
          onChange={(e) =>
            setForm({ ...form, forma_pago_profesor: (e.target.value || null) as FormaPagoProfesor | null })
          }
          className="entrada w-full max-w-[320px]"
        >
          <option value="">— Elegir —</option>
          <option value="fee_hora">{PAGO_LABEL.fee_hora}</option>
          <option value="pct_margen">{PAGO_LABEL.pct_margen}</option>
          <option value="monto_fijo">{PAGO_LABEL.monto_fijo}</option>
        </select>

        {form.forma_pago_profesor === "fee_hora" && (
          <p className="text-sm text-[var(--texto-tenue)] pl-2 border-l-2 border-[var(--borde)]">
            El monto por hora vive en la ficha de cada profesor (Profesores y cursos), no acá.
          </p>
        )}
        {form.forma_pago_profesor === "pct_margen" && (
          <div className="space-y-2 pl-2 border-l-2 border-[var(--borde)]">
            <div className="max-w-[180px]">
              <label className="text-sm text-[var(--texto-tenue)] block mb-1">% sobre el margen</label>
              <input
                value={form.pago_pct_margen ?? ""}
                onChange={(e) => setForm({ ...form, pago_pct_margen: decOrNull(e.target.value) })}
                inputMode="decimal"
                placeholder="50"
                className="entrada w-full"
              />
            </div>
            <Toggle
              checked={form.pago_descuenta_sala}
              onChange={(v) => setForm({ ...form, pago_descuenta_sala: v })}
              label="Descuenta el costo de sala del margen"
              descripcion="Margen = precio neto de descuentos, menos el costo de sala de las horas vendidas (si se activa)."
            />
          </div>
        )}
        {form.forma_pago_profesor === "monto_fijo" && (
          <div className="max-w-[220px] pl-2 border-l-2 border-[var(--borde)]">
            <label className="text-sm text-[var(--texto-tenue)] block mb-1">Monto fijo por membresía (Bs.)</label>
            <input
              value={form.pago_monto_fijo ?? ""}
              onChange={(e) => setForm({ ...form, pago_monto_fijo: decOrNull(e.target.value) })}
              inputMode="decimal"
              placeholder="150"
              className="entrada w-full"
            />
          </div>
        )}
      </div>

      {/* Criterio de liquidación: 1, 2 o 3 (4 y 5 son solo de taller). */}
      <div className="max-w-[360px]">
        <label className="text-sm text-[var(--texto-tenue)] block mb-1">Criterio de liquidación</label>
        <select
          value={form.criterio_liquidacion}
          onChange={(e) => setForm({ ...form, criterio_liquidacion: Number(e.target.value) })}
          className="entrada w-full"
        >
          <option value={1}>{CRITERIO_LABEL[1]}</option>
          <option value={2}>{CRITERIO_LABEL[2]}</option>
          <option value={3}>{CRITERIO_LABEL[3]}</option>
        </select>
      </div>

      {/* Reglas de extensión (definiciones-v2, 7.3). */}
      <div className="space-y-2">
        <label className="text-sm text-[var(--texto-tenue)] block mb-1">
          Extender una membresía ya vendida
        </label>
        <select
          value={form.extension_modo}
          onChange={(e) => setForm({ ...form, extension_modo: e.target.value as ExtensionModo })}
          className="entrada w-full max-w-[280px]"
        >
          <option value="lista">Cobrar a precio de lista</option>
          <option value="recargo">Cobrar con recargo</option>
        </select>
        {form.extension_modo === "recargo" && (
          <div className="max-w-[180px] pl-2 border-l-2 border-[var(--borde)]">
            <label className="text-sm text-[var(--texto-tenue)] block mb-1">% de recargo</label>
            <input
              value={form.extension_recargo_pct ?? ""}
              onChange={(e) => setForm({ ...form, extension_recargo_pct: decOrNull(e.target.value) })}
              inputMode="decimal"
              placeholder="10"
              className="entrada w-full"
            />
          </div>
        )}
      </div>

      {/* Política de asistentes de un grupo (definiciones-v2, 7.4). */}
      <Toggle
        checked={form.registra_acompanantes}
        onChange={(v) => setForm({ ...form, registra_acompanantes: v })}
        label="Registrar cada acompañante"
        descripcion="Si el plan admite grupo, decide si los demás asistentes se registran uno a uno o no. No se toma asistencia individual ni afecta la liquidación del profesor."
      />
    </>
  );
}
