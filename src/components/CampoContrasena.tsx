"use client";

import { useState } from "react";

/** Genera una contraseña legible (sin caracteres ambiguos), en el cliente. */
export function generarContrasena(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) out += chars[arr[i] % chars.length];
  return out;
}

/**
 * Campo de contraseña con botones "Ver" y "Generar". Controlado por el
 * padre (value/onChange). Reutilizado en el alta de usuario y en el
 * reinicio de contraseña.
 */
export default function CampoContrasena({
  value,
  onChange,
  name,
  id,
  required,
  autoFocus,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  name?: string;
  id?: string;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [ver, setVer] = useState(false);

  return (
    <div className="flex gap-2">
      <input
        id={id}
        name={name}
        type={ver ? "text" : "password"}
        required={required}
        minLength={8}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="entrada"
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        className="shrink-0 px-4 rounded-[var(--radio-control)] border border-[var(--borde)] text-sm"
        title={ver ? "Ocultar" : "Ver"}
      >
        {ver ? "Ocultar" : "Ver"}
      </button>
      <button
        type="button"
        onClick={() => {
          onChange(generarContrasena());
          setVer(true);
        }}
        className="shrink-0 px-4 rounded-[var(--radio-control)] border border-[var(--borde)] text-sm"
      >
        Generar
      </button>
    </div>
  );
}
