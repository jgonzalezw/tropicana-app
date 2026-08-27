"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Rol } from "@/lib/tipos";
import { crearUsuario } from "./acciones";

function generarPassword(): string {
  const chars =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) out += chars[arr[i] % chars.length];
  return out;
}

export default function FormularioNuevoUsuario({ roles }: { roles: Rol[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [exito, setExito] = useState<string | null>(null);

  // Rol por defecto: el primero que no sea Administrador, si existe.
  const rolDefecto =
    roles.find((r) => r.clave !== "administrador")?.id ?? roles[0]?.id;

  function enviar(formData: FormData) {
    setError(null);
    setExito(null);
    startTransition(async () => {
      const res = await crearUsuario(formData);
      if (res?.error) {
        setError(res.error);
      } else {
        const email = String(formData.get("email") ?? "");
        setExito(`Usuario ${email} creado. Compartile la contraseña de forma segura.`);
        setAbierto(false);
        setPassword("");
        router.refresh();
      }
    });
  }

  if (!abierto) {
    return (
      <div className="mb-6">
        {exito && (
          <div className="mb-4 p-4 rounded-[var(--radio)] border border-[var(--exito)] text-[var(--exito)] bg-[var(--exito)]/10">
            {exito}
          </div>
        )}
        <button
          onClick={() => {
            setAbierto(true);
            setExito(null);
          }}
          className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)]"
        >
          + Nuevo usuario
        </button>
      </div>
    );
  }

  return (
    <form
      action={enviar}
      className="mb-6 bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio)] p-6 space-y-4"
    >
      <h2 className="text-xl font-semibold">Nuevo usuario</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Nombre">
          <input name="nombre" className="entrada" autoFocus />
        </Campo>
        <Campo etiqueta="Apellido">
          <input name="apellido" className="entrada" />
        </Campo>
        <Campo etiqueta="WhatsApp">
          <input name="whatsapp" className="entrada" />
        </Campo>
        <Campo etiqueta="Rol">
          <select name="rol_id" defaultValue={rolDefecto} className="entrada">
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Correo (para ingresar)">
          <input
            name="email"
            type="email"
            required
            placeholder="correo@ejemplo.com"
            className="entrada"
          />
        </Campo>
        <Campo etiqueta="Contraseña (mínimo 8 caracteres)">
          <div className="flex gap-2">
            <input
              name="password"
              type={verPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="entrada"
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              className="shrink-0 px-3 rounded-[var(--radio)] border border-[var(--borde)] text-sm"
              title={verPassword ? "Ocultar" : "Ver"}
            >
              {verPassword ? "Ocultar" : "Ver"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPassword(generarPassword());
                setVerPassword(true);
              }}
              className="shrink-0 px-3 rounded-[var(--radio)] border border-[var(--borde)] text-sm"
            >
              Generar
            </button>
          </div>
        </Campo>
      </div>

      <p className="text-sm text-[var(--texto-tenue)]">
        La cuenta queda lista para ingresar de inmediato. Compartí la contraseña
        con la persona por un canal seguro (por ejemplo, WhatsApp).
      </p>

      {error && (
        <p className="text-[var(--peligro)] text-base" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pendiente}
          className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-60"
        >
          {pendiente ? "Creando…" : "Crear usuario"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError(null);
          }}
          className="px-5 py-2.5 text-base rounded-[var(--radio)] border border-[var(--borde)]"
        >
          Cancelar
        </button>
      </div>
    </form>
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
