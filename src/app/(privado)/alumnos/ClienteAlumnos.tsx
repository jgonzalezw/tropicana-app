"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Alumno, DatosAlumno } from "@/lib/tipos";
import { compararPorApellido } from "@/lib/texto";
import EntidadAlumno from "@/components/entidades/EntidadAlumno";
import { crearAlumno, actualizarAlumno, eliminarODesactivarAlumno, activarAlumno } from "./acciones";

type Canal = { valor: string; etiqueta: string };

export default function ClienteAlumnos({
  alumnos,
  canales,
  deps,
}: {
  alumnos: Alumno[];
  canales: Canal[];
  deps: Record<number, number>;
}) {
  const router = useRouter();
  const [editSel, setEditSel] = useState<Alumno | null>(null);
  const [remount, setRemount] = useState(0);
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const ordenado = [...alumnos].sort(compararPorApellido);
  const etiquetaCanal = (v: string | null) =>
    v ? canales.find((c) => c.valor === v)?.etiqueta ?? v : "—";

  async function onGuardar(datos: DatosAlumno, id: number | null) {
    const res = id ? await actualizarAlumno(id, datos) : await crearAlumno(datos);
    if (!res?.error) {
      setEditSel(null);
      setRemount((n) => n + 1);
      router.refresh();
    }
    return res ?? {};
  }
  async function onBaja(id: number) {
    const res = await eliminarODesactivarAlumno(id);
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
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 max-w-2xl">
        <div className="text-base font-medium mb-3">
          {editSel ? "Editar alumno" : "Buscar o cargar alumno"}
        </div>
        <EntidadAlumno
          key={remount}
          padron={alumnos}
          canales={canales}
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
              <th className="py-3 px-4 font-medium">Alumno</th>
              <th className="py-3 px-4 font-medium">Contacto</th>
              <th className="py-3 px-4 font-medium">Canal</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {ordenado.map((a) => {
              const historial = (deps[a.id] ?? 0) > 0;
              return (
                <tr key={a.id} className={`border-t border-[var(--borde)] ${a.activo ? "" : "opacity-50"}`}>
                  <td className="py-3 px-4">
                    <div className="font-medium">
                      {a.apellido}, {a.nombre}
                    </div>
                    {a.es_menor && (
                      <div className="text-xs text-[var(--texto-tenue)]">menor</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-[var(--texto-tenue)]">
                    {a.es_menor
                      ? `Tutor ${a.tutor_nombre || "—"} · ${a.tutor_whatsapp || "—"}`
                      : a.whatsapp || "—"}
                  </td>
                  <td className="py-3 px-4 text-[var(--texto-tenue)]">{etiquetaCanal(a.canal_captacion)}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditSel(a);
                          setRemount((n) => n + 1);
                        }}
                        className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
                      >
                        Editar
                      </button>
                      {a.activo ? (
                        <button
                          disabled={pendiente}
                          onClick={() =>
                            rowAccion(
                              () => eliminarODesactivarAlumno(a.id),
                              historial ? "Alumno desactivado." : "Alumno eliminado."
                            )
                          }
                          className="px-4 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--peligro)] text-[var(--peligro)] disabled:opacity-40"
                        >
                          {historial ? "Desactivar" : "Eliminar"}
                        </button>
                      ) : (
                        <button
                          disabled={pendiente}
                          onClick={() => rowAccion(() => activarAlumno(a.id), "Alumno activado.")}
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
                <td colSpan={4} className="py-4 px-4 text-[var(--texto-tenue)]">
                  Todavía no hay alumnos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
