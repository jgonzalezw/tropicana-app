"use client";

import { useState, useTransition } from "react";
import type { PerfilConRol, Rol } from "@/lib/tipos";
import { estadoAcceso } from "@/lib/acceso";
import CampoContrasena from "@/components/CampoContrasena";
import {
  actualizarUsuario,
  resetearContrasena,
  desbloquearUsuario,
  bloquearUsuario,
} from "./acciones";

const TONO_CHIP: Record<string, string> = {
  exito: "bg-[var(--exito-fill)] text-[var(--exito-texto)]",
  peligro: "bg-[var(--peligro-fill)] text-[var(--peligro-texto)]",
  neutral: "bg-[var(--fondo-elevado)] text-[var(--texto-tenue)]",
};

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
  const estado = estadoAcceso(perfil);

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
        <td className="py-3 px-4">
          <div>{nombreMostrado}</div>
          {perfil.email && (
            <div className="text-sm text-[var(--texto-tenue)]">
              {perfil.email}
            </div>
          )}
        </td>
        <td className="py-3 px-4 text-[var(--texto-tenue)]">
          {perfil.whatsapp || "—"}
        </td>
        <td className="py-3 px-4">{perfil.rol?.nombre}</td>
        <td className="py-3 px-4">
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${TONO_CHIP[estado.tono]}`}
          >
            {estado.etiqueta}
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
            Cuenta activa (dar de baja / reactivar la persona)
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

        <SeccionAcceso perfil={perfil} estadoEtiqueta={estado.etiqueta} />
      </td>
    </tr>
  );
}

function SeccionAcceso({
  perfil,
  estadoEtiqueta,
}: {
  perfil: PerfilConRol;
  estadoEtiqueta: string;
}) {
  const [pwNueva, setPwNueva] = useState("");
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function correr(fn: () => Promise<{ error?: string; ok?: boolean }>, exito: string) {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else setMsg(exito);
    });
  }

  return (
    <div className="mt-5 pt-4 border-t border-[var(--borde)] space-y-4">
      <div>
        <div className="text-base font-medium">Acceso y contraseña</div>
        <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
          Estado: {estadoEtiqueta}
          {perfil.intentos_fallidos > 0 &&
            ` · ${perfil.intentos_fallidos} intento(s) fallido(s) de login`}
        </div>
      </div>

      {/* Acción 1 — reiniciar / cambiar contraseña */}
      <div className="space-y-2">
        <span className="block text-base font-medium">
          Contraseña nueva (mínimo 8 caracteres)
        </span>
        <CampoContrasena
          value={pwNueva}
          onChange={setPwNueva}
          placeholder="Asignar una contraseña nueva"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pendiente || pwNueva.length < 8}
            onClick={() =>
              correr(
                () => resetearContrasena(perfil.id, pwNueva).then((r) => {
                  if (!r?.error) setPwNueva("");
                  return r;
                }),
                "Contraseña actualizada. Queda activa y la cuenta quedó desbloqueada."
              )
            }
            className="px-4 py-2 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-40"
          >
            Guardar contraseña nueva
          </button>
          <span className="text-sm text-[var(--texto-tenue)]">
            Camino para “olvidé mi contraseña”: queda activa de inmediato y
            desbloquea la cuenta.
          </span>
        </div>
      </div>

      {/* Acciones 2 y 3 — desbloquear / bloquear */}
      <div className="flex flex-wrap gap-2">
        {perfil.bloqueado ? (
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              correr(
                () => desbloquearUsuario(perfil.id),
                "Cuenta desbloqueada. Puede entrar con su contraseña actual."
              )
            }
            className="px-4 py-2 text-base rounded-[var(--radio-control)] border border-[var(--exito)] text-[var(--exito)] disabled:opacity-40"
          >
            Desbloquear (mantener contraseña)
          </button>
        ) : (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => {
              if (
                confirm(
                  "¿Bloquear esta cuenta? No podrá iniciar sesión ni con la contraseña correcta hasta que la desbloquees."
                )
              )
                correr(() => bloquearUsuario(perfil.id), "Cuenta bloqueada.");
            }}
            className="px-4 py-2 text-base rounded-[var(--radio-control)] border border-[var(--peligro)] text-[var(--peligro)] disabled:opacity-40"
          >
            Bloquear cuenta
          </button>
        )}
      </div>

      {msg && <p className="text-[var(--exito)] text-base">{msg}</p>}
      {error && (
        <p className="text-[var(--peligro)] text-base" role="alert">
          {error}
        </p>
      )}
    </div>
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
