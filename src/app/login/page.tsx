"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError("Correo o contraseña incorrectos.");
      setCargando(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-[var(--primario)]">Tropicana</span>
          </h1>
          <p className="text-[var(--texto-tenue)] mt-2 text-lg">
            Escuela de Bailes — Gestión
          </p>
        </div>

        <form
          onSubmit={iniciarSesion}
          className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio)] p-8 space-y-5"
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
              className="w-full px-4 py-3 text-lg rounded-[var(--radio)] bg-[var(--fondo-elevado)] border border-[var(--borde)] text-[var(--texto)] focus:border-[var(--primario)] outline-none"
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
              className="w-full px-4 py-3 text-lg rounded-[var(--radio)] bg-[var(--fondo-elevado)] border border-[var(--borde)] text-[var(--texto)] focus:border-[var(--primario)] outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-[var(--peligro)] text-base" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 text-lg font-semibold rounded-[var(--radio)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-60 transition-colors"
          >
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
