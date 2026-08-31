"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Curso, TarifasCurso, DatosCurso } from "@/lib/tipos";
import EntidadCurso, { etiquetaDias } from "@/components/entidades/EntidadCurso";
import { crearCurso, actualizarCurso, eliminarODesactivarCurso, activarCurso } from "./acciones";

export default function ClienteCursos({
  cursos,
  tarifas,
  deps,
  especialidades,
}: {
  cursos: Curso[];
  tarifas: Record<number, TarifasCurso>;
  deps: Record<number, number>;
  especialidades: string[];
}) {
  const router = useRouter();
  const [editSel, setEditSel] = useState<Curso | null>(null);
  const [remount, setRemount] = useState(0);
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const ordenado = [...cursos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  async function onGuardar(datos: DatosCurso, id: number | null) {
    const res = id ? await actualizarCurso(id, datos) : await crearCurso(datos);
    if (!res?.error) {
      setEditSel(null);
      setRemount((n) => n + 1);
      router.refresh();
    }
    return res ?? {};
  }
  async function onBaja(id: number) {
    const res = await eliminarODesactivarCurso(id);
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

  const tarifaTxt = (t?: TarifasCurso) => {
    if (!t) return "—";
    const partes = [
      t.clase != null ? `clase ${t.clase}` : null,
      t.semana != null ? `semana ${t.semana}` : null,
      t.medio_mes != null ? `½ mes ${t.medio_mes}` : null,
    ].filter(Boolean);
    return partes.length ? partes.join(" · ") : "—";
  };

  return (
    <div className="space-y-6">
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 max-w-2xl">
        <div className="text-base font-medium mb-3">
          {editSel ? "Editar curso" : "Buscar o cargar curso"}
        </div>
        <EntidadCurso
          key={remount}
          padron={cursos}
          tarifasDe={(id) => tarifas[id]}
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
              <th className="py-3 px-4 font-medium">Curso</th>
              <th className="py-3 px-4 font-medium">Días</th>
              <th className="py-3 px-4 font-medium text-right">Mensual</th>
              <th className="py-3 px-4 font-medium">Tarifas parciales</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {ordenado.map((c) => {
              const historial = (deps[c.id] ?? 0) > 0;
              return (
                <tr key={c.id} className={`border-t border-[var(--borde)] ${c.activo ? "" : "opacity-50"}`}>
                  <td className="py-3 px-4">
                    <div className="font-medium">{c.nombre}</div>
                    <div className="text-sm text-[var(--texto-tenue)]">
                      {[c.linea, c.nivel].filter(Boolean).join(" · ") || "—"}
                      {c.hora ? ` · ${c.hora.slice(0, 5)}` : ""}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[var(--texto-tenue)]">{etiquetaDias(c.dias_semana) || "—"}</td>
                  <td className="py-3 px-4 text-right">Bs. {c.precio_mensual}</td>
                  <td className="py-3 px-4 text-sm text-[var(--texto-tenue)]">{tarifaTxt(tarifas[c.id])}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditSel(c);
                          setRemount((n) => n + 1);
                        }}
                        className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
                      >
                        Editar
                      </button>
                      {c.activo ? (
                        <button
                          disabled={pendiente}
                          onClick={() =>
                            rowAccion(
                              () => eliminarODesactivarCurso(c.id),
                              historial ? "Curso desactivado." : "Curso eliminado."
                            )
                          }
                          className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--peligro)] text-[var(--peligro)] disabled:opacity-40"
                        >
                          {historial ? "Desactivar" : "Eliminar"}
                        </button>
                      ) : (
                        <button
                          disabled={pendiente}
                          onClick={() => rowAccion(() => activarCurso(c.id), "Curso activado.")}
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
                  Todavía no hay cursos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
