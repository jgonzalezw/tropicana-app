"use client";

import { Fragment, useState, useTransition } from "react";
import { validarAsignacionNueva, validarDesasignacion, type DatosSustituto } from "@/lib/desasignacion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profesor, Curso, Asignacion, DepsProfesor, DatosProfesor, Estilo, ListasContacto, MatrizMinimo } from "@/lib/tipos";
import { nombreCompleto, apellidoNombre, compararContactosPorApellido } from "@/lib/contactos";
import EntidadProfesor, { TagTipo } from "@/components/entidades/EntidadProfesor";
import EnlaceWhatsapp from "@/components/entidades/EnlaceWhatsapp";
import {
  crearProfesor,
  actualizarProfesor,
  eliminarODesactivarProfesor,
  activarProfesor,
  crearAsignacion,
  desasignar,
  revisarDesasignacion,
  vistaCierreDesasignacion,
  type RevisionDesasignacion,
} from "./acciones";
import type { VistaCierre } from "@/app/(privado)/liquidaciones/acciones";

type Cuenta = { id: string; etiqueta: string };

export default function ClienteProfesores({
  padron,
  cursos,
  asignaciones,
  cuentas,
  estilos,
  deps,
  matriz,
  listasContacto,
  puedeVerPrivados,
  puedeEditar,
  puedeLiquidar,
}: {
  padron: Profesor[];
  cursos: Curso[];
  asignaciones: Asignacion[];
  cuentas: Cuenta[];
  estilos: Estilo[];
  deps: Record<number, DepsProfesor>;
  matriz: MatrizMinimo[];
  listasContacto: ListasContacto;
  puedeVerPrivados: boolean;
  puedeEditar: boolean;
  puedeLiquidar: boolean;
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
          estilos={estilos}
          deps={deps}
          matriz={matriz}
          listasContacto={listasContacto}
          puedeVerPrivados={puedeVerPrivados}
          puedeEditar={puedeEditar}
          puedeRetirar={puedeEditar && puedeLiquidar}
          conAsignacionAbierta={asignaciones.filter((a) => a.hasta === null).map((a) => a.profesor_id)}
        />
      ) : (
        <TabAsignacion padron={padron} cursos={cursos} asignaciones={asignaciones} estilos={estilos} puedeLiquidar={puedeLiquidar} />
      )}
    </div>
  );
}

function etiquetaEstilo(clave: string, estilos: Estilo[]): string {
  return estilos.find((e) => e.clave === clave)?.nombre ?? clave;
}

// ── Tab Listado ───────────────────────────────────────────────────────
function TabListado({
  padron,
  cuentas,
  estilos,
  deps,
  matriz,
  listasContacto,
  puedeVerPrivados,
  puedeEditar,
  puedeRetirar,
  conAsignacionAbierta,
}: {
  padron: Profesor[];
  cuentas: Cuenta[];
  estilos: Estilo[];
  deps: Record<number, DepsProfesor>;
  matriz: MatrizMinimo[];
  listasContacto: ListasContacto;
  puedeVerPrivados: boolean;
  puedeEditar: boolean;
  puedeRetirar: boolean;
  conAsignacionAbierta: number[];
}) {
  const router = useRouter();
  const [editSel, setEditSel] = useState<Profesor | null>(null);
  const [remount, setRemount] = useState(0);
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const ordenado = [...padron].sort((a, b) => compararContactosPorApellido(a.contacto, b.contacto));

  async function onGuardar(datos: DatosProfesor, id: number | null, existenteId?: number | null) {
    const res = id ? await actualizarProfesor(id, datos) : await crearProfesor(datos, existenteId);
    if (!res?.error) {
      setEditSel(null);
      setRemount((n) => n + 1);
      router.refresh();
    }
    return res ?? {};
  }
  async function onActivar(id: number) {
    const res = await activarProfesor(id);
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
          {editSel ? "Profesor" : "Buscar o cargar profesor"}
        </div>
        <EntidadProfesor
          key={remount}
          padron={padron}
          cuentas={cuentas}
          estilos={estilos}
          matriz={matriz}
          listasContacto={listasContacto}
          puedeVerPrivados={puedeVerPrivados}
          permitirBaja
          hrefRetirar={(p) =>
            puedeRetirar && (p.activo || conAsignacionAbierta.includes(p.id)) ? `/profesores/retirar/${p.id}` : null
          }
          valor={editSel}
          modoInicial={puedeEditar ? "editar" : "ver"}
          puedeEditar={puedeEditar}
          depsDe={(id) => deps[id]}
          onGuardar={onGuardar}
          onBaja={onBaja}
          onActivar={onActivar}
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
                    <div className="font-medium">{apellidoNombre(p.contacto)}</div>
                    <div className="text-sm text-[var(--texto-tenue)]">
                      <EnlaceWhatsapp numero={p.contacto.whatsapp} vacio="—" />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[var(--texto-tenue)]">
                    {(p.estilos ?? []).map((c) => etiquetaEstilo(c, estilos)).join(", ") || "—"}
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
                        {puedeEditar ? "Editar" : "Ver"}
                      </button>
                      {puedeRetirar && (p.activo || conAsignacionAbierta.includes(p.id)) && (
                        <Link
                          href={`/profesores/retirar/${p.id}`}
                          className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--primario)] text-[var(--primario)]"
                        >
                          Retirar…
                        </Link>
                      )}
                      {p.activo && conAsignacionAbierta.includes(p.id) ? null : p.activo ? (
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
                    {historial && p.activo && !conAsignacionAbierta.includes(p.id) && (
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
  estilos,
  puedeLiquidar,
}: {
  padron: Profesor[];
  cursos: Curso[];
  asignaciones: Asignacion[];
  estilos: Estilo[];
  puedeLiquidar: boolean;
}) {
  const router = useRouter();
  const [cursoId, setCursoId] = useState<number | null>(null);
  const [profId, setProfId] = useState<number | null>(null);
  const [pctIng, setPctIng] = useState("");
  const [pctRef, setPctRef] = useState("");
  const [asigDesde, setAsigDesde] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const nombreProf = (id: number) => {
    const p = padron.find((x) => x.id === id);
    return p ? nombreCompleto(p.contacto) : "—";
  };
  const nombreCurso = (id: number) => cursos.find((c) => c.id === id)?.nombre ?? "—";
  const vigenteDe = (cId: number) => asignaciones.find((a) => a.curso_id === cId && a.hasta === null);

  const estiloCurso = cursoId ? cursos.find((c) => c.id === cursoId)?.estilo ?? null : null;
  const elegibles = padron
    .filter(
      (p) =>
        p.activo &&
        p.tipo === "activo" &&
        (!estiloCurso || (p.estilos ?? []).length === 0 || (p.estilos ?? []).includes(estiloCurso))
    )
    .sort((a, b) => compararContactosPorApellido(a.contacto, b.contacto));

  const num = (s: string) => Number(s.replace(/\D/g, "").slice(0, 3));

  function confirmar() {
    if (!cursoId || !profId) return;
    setError(null);
    startTransition(async () => {
      const res = await crearAsignacion(cursoId, profId, num(pctIng), num(pctRef), asigDesde);
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

  const faltaAsig = cursoId
    ? validarAsignacionNueva({
        desde: asigDesde,
        asignaciones: asignaciones.filter((x) => x.curso_id === cursoId),
      })
    : null;
  const puedeAsignar = !!cursoId && !!profId && !faltaAsig && num(pctIng) >= 1 && num(pctIng) <= 100;

  // Desasignar: fecha, revisión y sustituto opcional (una asignación a la vez).
  const [desLiquidar, setDesLiquidar] = useState(false);
  const [desCierre, setDesCierre] = useState<VistaCierre | null>(null);
  const [desId, setDesId] = useState<number | null>(null);
  const [desFecha, setDesFecha] = useState("");
  const [desRevision, setDesRevision] = useState<(RevisionDesasignacion & { fecha: string }) | null>(null);
  const [desConSust, setDesConSust] = useState(false);
  const [desSustId, setDesSustId] = useState<number | null>(null);
  const [desPctIng, setDesPctIng] = useState("");
  const [desPctRef, setDesPctRef] = useState("");
  const [desEntiendo, setDesEntiendo] = useState(false);
  const [desError, setDesError] = useState<string | null>(null);

  function abrirDesasignar(a: Asignacion) {
    setDesId(a.id);
    setDesFecha(new Date().toISOString().slice(0, 10));
    setDesRevision(null);
    setDesConSust(false);
    setDesSustId(null);
    setDesPctIng(String(a.pct_ingresos));
    setDesPctRef(String(a.pct_referido));
    setDesEntiendo(false);
    setDesLiquidar(false);
    setDesCierre(null);
    setDesError(null);
  }

  function alternarLiquidar(a: Asignacion, v: boolean) {
    setDesLiquidar(v);
    setDesCierre(null);
    if (!v) return;
    startTransition(async () => {
      setDesCierre(await vistaCierreDesasignacion(a.id, desFecha));
    });
  }

  function revisarFecha(a: Asignacion) {
    setDesError(null);
    setDesEntiendo(false);
    setDesLiquidar(false);
    setDesCierre(null);
    startTransition(async () => {
      const r = await revisarDesasignacion(a.id, desFecha);
      if (r.error) {
        setDesRevision(null);
        setDesError(r.error);
      } else setDesRevision({ ...r, fecha: desFecha });
    });
  }

  const sustitutoDes: DatosSustituto | null = desConSust
    ? { profesorId: desSustId, pctIngresos: num(desPctIng), pctReferido: num(desPctRef) }
    : null;

  function confirmarDesasignar(a: Asignacion) {
    setDesError(null);
    startTransition(async () => {
      const r = await desasignar(a.id, desFecha, sustitutoDes, desLiquidar);
      if (r.error) setDesError(r.error);
      else {
        setDesId(null);
        router.refresh();
      }
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
                {apellidoNombre(p.contacto)}
                <span className="text-sm text-[var(--texto-tenue)]">
                  {" "}
                  · {(p.estilos ?? []).map((c) => etiquetaEstilo(c, estilos)).join(", ") || "sin especialidad"}
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

          <label className="block max-w-xs">
            <span className="block text-base font-medium mb-1.5">Fecha de inicio</span>
            <input type="date" value={asigDesde} onChange={(e) => setAsigDesde(e.target.value)} className="entrada" />
            <span className="block text-sm text-[var(--texto-tenue)] mt-1">
              Desde cuándo está a cargo del curso (hoy por defecto). La asignación vigente, si hay, termina el día anterior; las clases de antes siguen siendo de quien las dictó.
            </span>
          </label>
          {faltaAsig && (
            <p className="text-[var(--peligro)] text-base" role="alert">{faltaAsig}</p>
          )}

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
            disabled={pendiente || !puedeAsignar}
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
              <Fragment key={a.id}>
              <tr className="border-t border-[var(--borde)]">
                <td className="py-3 px-4">{nombreCurso(a.curso_id)}</td>
                <td className="py-3 px-4">{nombreProf(a.profesor_id)}</td>
                <td className="py-3 px-4 text-right">{a.pct_ingresos}%</td>
                <td className="py-3 px-4 text-right">{a.pct_referido}%</td>
                <td className="py-3 px-4 text-[var(--texto-tenue)]">{a.desde}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    disabled={pendiente}
                    onClick={() => abrirDesasignar(a)}
                    className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40"
                  >
                    Desasignar
                  </button>
                </td>
              </tr>
              {desId === a.id && (() => {
                const falta = validarDesasignacion({
                  desde: a.desde, hasta: a.hasta, profesorId: a.profesor_id, fecha: desFecha, sustituto: sustitutoDes,
                });
                const revisada = desRevision?.fecha === desFecha;
                const hayPosteriores = (desRevision?.posteriores?.length ?? 0) > 0;
                const puede = !falta && revisada && (!hayPosteriores || desEntiendo);
                const sustElegibles = padron
                  .filter((p) => p.activo && p.tipo === "activo" && p.id !== a.profesor_id)
                  .sort((x, y) => compararContactosPorApellido(x.contacto, y.contacto));
                return (
                  <tr className="border-t border-[var(--borde)] bg-[var(--fondo-elevado)]">
                    <td colSpan={6} className="p-4 space-y-4">
                      <div className="font-medium">
                        Desasignar a {nombreProf(a.profesor_id)} de {nombreCurso(a.curso_id)}
                      </div>
                      <label className="block max-w-xs">
                        <span className="block text-base font-medium mb-1.5">Último día a su cargo</span>
                        <input
                          type="date"
                          value={desFecha}
                          min={a.desde}
                          onChange={(e) => { setDesFecha(e.target.value); setDesEntiendo(false); }}
                          className="entrada"
                        />
                        <span className="block text-sm text-[var(--texto-tenue)] mt-1">
                          Las clases hasta ese día (inclusive) siguen siendo suyas y se le liquidan. Desde el día siguiente el curso queda sin titular o con el sustituto que elijas.
                        </span>
                      </label>
                      <button
                        type="button"
                        disabled={pendiente || !desFecha}
                        onClick={() => revisarFecha(a)}
                        className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40"
                      >
                        {pendiente ? "Revisando…" : "Revisar fecha"}
                      </button>

                      {revisada && desRevision && (
                        <div className="space-y-2">
                          <p className="text-sm">
                            {desRevision.ultimaClase
                              ? `Última clase que dictó en este curso: ${desRevision.ultimaClase}.`
                              : "Todavía no dictó ninguna clase en este curso."}
                          </p>
                          {hayPosteriores ? (
                            <div className="p-3 rounded-[var(--radio-panel)] border border-[var(--peligro)] bg-[var(--peligro-fill)] text-[var(--peligro-texto)] text-sm">
                              ⚠ {nombreProf(a.profesor_id)} ya dictó {desRevision.posteriores!.length} clase(s) después de esa fecha ({desRevision.posteriores!.slice(0, 6).join(", ")}
                              {desRevision.posteriores!.length > 6 ? "…" : ""}). Esas clases quedan registradas a su nombre y se le siguen liquidando, aunque la asignación termine antes.
                              <label className="flex items-center gap-2 mt-2">
                                <input type="checkbox" checked={desEntiendo} onChange={(e) => setDesEntiendo(e.target.checked)} />
                                Entiendo, usar esta fecha igual
                              </label>
                            </div>
                          ) : (
                            <p className="text-sm text-[var(--exito)]">✓ No hay clases dictadas por este profesor después de esa fecha.</p>
                          )}
                          {(desRevision.pendientes?.length ?? 0) > 0 && (
                            <div className="p-3 rounded-[var(--radio-panel)] border border-[var(--borde)] text-sm">
                              <div className="font-medium mb-1">
                                {desRevision.pendientes!.length} membresía(s) activa(s) de este curso que todavía no terminan su ciclo. Entre paréntesis, a cuántas clases asistió cada alumno (su contador de asistencia, no las clases que dio el profesor):
                              </div>
                              <ul className="list-disc pl-5">
                                {desRevision.pendientes!.map((m) => (
                                  <li key={m.id}>{m.alumno} — asistió a {m.hechas} de {m.plan} clases</li>
                                ))}
                              </ul>
                              <p className="text-[var(--texto-tenue)] mt-1">
                                Sin alguien que dicte las que faltan no se completan, y la comisión de las ya dictadas no se devenga hasta entonces. Con un sustituto, él completa las que faltan; el profesor que se va cobra solo las que dictó.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {revisada && (
                        <div className="space-y-2 p-3 rounded-[var(--radio-panel)] border border-[var(--borde)]">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={desLiquidar} disabled={!puedeLiquidar || pendiente} onChange={(e) => alternarLiquidar(a, e.target.checked)} />
                            Liquidar y dejar a pagar el avance ahora (cierre de cuentas)
                          </label>
                          {!puedeLiquidar && (
                            <p className="text-sm text-[var(--texto-tenue)]">Tu rol no tiene permiso para crear liquidaciones; pedile a quien lo tenga que lo haga.</p>
                          )}
                          {desLiquidar && desCierre?.error && (
                            <p className="text-[var(--peligro)] text-sm" role="alert">{desCierre.error}</p>
                          )}
                          {desLiquidar && desCierre?.lineas && (
                            <div className="text-sm space-y-1">
                              {desCierre.lineas.length === 0 ? (
                                <p className="text-[var(--texto-tenue)]">No hay avance que liquidar a esa fecha (nada cobrado o sin clases dictadas).</p>
                              ) : (
                                <>
                                  <ul className="list-disc pl-5">
                                    {desCierre.lineas.map((l) => (
                                      <li key={`${l.membresiaId}-${l.curso}`}>{l.alumno} — {l.curso}: {l.clases} de {l.clasesDelCurso} clases del ciclo ya transcurridas al corte, sobre Bs {l.base} cobrado → <b>Bs {l.monto}</b></li>
                                    ))}
                                  </ul>
                                  <p className="font-medium">Total a dejar por pagar: Bs {desCierre.total}</p>
                                </>
                              )}
                              {(desCierre.sinRegistrar?.length ?? 0) > 0 && (
                                <p className="text-[var(--peligro-texto)]">Quedan afuera por clases sin registrar (regla 17): {desCierre.sinRegistrar!.map((x) => x.alumno).join(", ")}.</p>
                              )}
                              <p className="text-[var(--texto-tenue)]">Las clases se cuentan por calendario (las del ciclo hasta el corte, sin las suspendidas), vaya o no el alumno: el profesor cobra por las clases que dictó, no por la asistencia de cada alumno. Es un pago a cuenta: lo que se cobre después o al completarse cada membresía se compensa en la liquidación final. El pago se hace en Caja → Por pagar.</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={desConSust} onChange={(e) => setDesConSust(e.target.checked)} />
                          Definir un sustituto desde el día siguiente
                        </label>
                        {desConSust ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
                            <select
                              value={desSustId ?? ""}
                              onChange={(e) => setDesSustId(e.target.value ? Number(e.target.value) : null)}
                              className="entrada"
                            >
                              <option value="">Elegí el profesor…</option>
                              {sustElegibles.map((p) => (
                                <option key={p.id} value={p.id}>{apellidoNombre(p.contacto)}</option>
                              ))}
                            </select>
                            <input value={desPctIng} onChange={(e) => setDesPctIng(e.target.value)} inputMode="numeric" placeholder="% ingresos" className="entrada" />
                            <input value={desPctRef} onChange={(e) => setDesPctRef(e.target.value)} inputMode="numeric" placeholder="% referido" className="entrada" />
                          </div>
                        ) : (
                          <p className="text-sm text-[var(--texto-tenue)]">
                            Sin sustituto el curso queda sin titular: al tomar asistencia habrá que registrar quién dictó la clase, o suspenderla.
                          </p>
                        )}
                      </div>

                      {(desError || (revisada && falta)) && (
                        <p className="text-[var(--peligro)] text-base" role="alert">{desError ?? falta}</p>
                      )}
                      {!revisada && !falta && (
                        <p className="text-sm text-[var(--texto-tenue)]">Revisá la fecha antes de confirmar.</p>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pendiente || !puede}
                          onClick={() => confirmarDesasignar(a)}
                          className="px-5 py-2 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
                        >
                          {pendiente ? "Guardando…" : "Confirmar desasignación"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDesId(null)}
                          className="px-4 py-2 text-base rounded-[var(--radio-control)] border border-[var(--borde)]"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })()}
              </Fragment>
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
