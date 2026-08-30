"use client";

import { useState, useTransition } from "react";
import type { PerfilConRol, Rol } from "@/lib/tipos";
import { actualizarUsuario } from "./acciones";

export default function FilaUsuario({
  perfil,
  roles,
}: {
  perfil: PerfilConRol;
  roles: Rol[];
}) {
  const [editando, setEditando] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nombreMostrado =
    [perfil.nombre, perfil.apellido].filter(Boolean).join(" ") || "—";

  function guardar(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await actualizarUsuario(formData);
      if (res?.error) {
        setError(res.error);
      } else {
        setEditando(false);
      }
    });
  }

  if (!editando) {
    return (
      <tr className="border-t border-[var(--borde)]">
        <td className="py-3 px-4">{nombreMostrado}</td>
        <td className="py-3 px-4 text-[var(--texto-tenue)]">
          {perfil.whatsapp || "—"}
        </td>
        <td className="py-3 px-4">{perfil.rol?.nombre}</td>
        <td className="py-3 px-4">
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              perfil.activo
                ? "bg-[var(--exito-fill)] text-[var(--exito-texto)]"
                : "bg-[var(--peligro-fill)] text-[var(--peligro-texto)]"
            }`}
          >
            {perfil.activo ? "Activo" : "Inactivo"}
          </span>
        </td>
        <td className="py-3 px-4 text-right">
          <button
            onClick={() => setEditando(true)}
            className="px-4 py-1.5 text-base rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] transition-colors"
          >
            Editar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-[var(--borde)] bg-[var(--fondo-elevado)]">
      <td colSpan={5} className="p-4">
        <form action={guardar} className="space-y-4">
          <input type="hidden" name="id" value={perfil.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo etiqueta="Nombre">
              <input
                name="nombre"
                defaultValue={perfil.nombre ?? ""}
                className="entrada"
              />
            </Campo>
            <Campo etiqueta="Apellido">
              <input
                name="apellido"
                defaultValue={perfil.apellido ?? ""}
                className="entrada"
              />
            </Campo>
            <Campo etiqueta="WhatsApp">
              <input
                name="whatsapp"
                defaultValue={perfil.whatsapp ?? ""}
                className="entrada"
              />
            </Campo>
            <Campo etiqueta="Rol">
              <select
                name="rol_id"
                defaultValue={perfil.rol_id}
                className="entrada"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <label className="flex items-center gap-3 text-base">
            <input
              type="checkbox"
              name="activo"
              defaultChecked={perfil.activo}
              className="w-5 h-5 accent-[var(--primario)]"
            />
            Cuenta activa
          </label>

          {error && (
            <p className="text-[var(--peligro)] text-base" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pendiente}
              className="px-5 py-2 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-60"
            >
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setError(null);
              }}
              className="px-5 py-2 text-base rounded-[var(--radio-control)] border border-[var(--borde)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-base font-medium mb-1.5">{etiqueta}</span>
      {children}
    </label>
  );
}
