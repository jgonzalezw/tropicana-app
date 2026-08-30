"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { iniciarSesion } from "./acciones";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [bloqueada, setBloqueada] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setBloqueada(false);
    setCargando(true);

    const res = await iniciarSesion(email, password);

    if ("ok" in res) {
      router.push("/");
      router.refresh();
      return;
    }

    setCargando(false);

    if (res.estado === "bloqueada") {
      setBloqueada(true);
    } else if (res.estado === "error") {
      setError(res.mensaje);
    } else {
      setError("Correo o contraseña incorrectos.");
      if (res.avisar) {
        setAviso(
          "Ya van varios intentos. Si no recordás tu contraseña, pedile a la administración que te la reinicie."
        );
      }
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl">
            <span className="text-[var(--primario)]">Tropicana</span>
          </h1>
          <p className="text-[var(--texto-tenue)] mt-2 text-lg">
            Escuela de Bailes — Gestión
          </p>
        </div>

        <form
          onSubmit={enviar}
          className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-8 space-y-5"
        >
          <div>
            <label htmlFor="email" className="block text-base font-medium mb-2">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="entrada"
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-base font-medium mb-2"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="entrada"
              placeholder="••••••••"
            />
          </div>

          {bloqueada && (
            <div
              className="p-4 rounded-[var(--radio-panel)] border border-[var(--peligro)] bg-[var(--peligro-fill)] text-[var(--peligro-texto)]"
              role="alert"
            >
              <div className="font-semibold">Cuenta bloqueada</div>
              <div className="text-base mt-1">
                No podés ingresar por ahora. Pedile a la administración que
                desbloquee tu cuenta o te reinicie la contraseña.
              </div>
            </div>
          )}

          {error && (
            <p className="text-[var(--peligro)] text-base" role="alert">
              {error}
            </p>
          )}

          {aviso && (
            <p className="text-[var(--advertencia)] text-base" role="status">
              {aviso}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 text-lg font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-60 transition-colors"
          >
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
