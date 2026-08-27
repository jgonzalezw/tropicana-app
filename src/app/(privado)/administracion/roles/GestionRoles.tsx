"use client";

import { useState, useTransition } from "react";
import type { Rol } from "@/lib/tipos";
import { crearRol, actualizarRol, eliminarRol } from "./acciones";

export default function GestionRoles({
  roles,
  conteos,
}: {
  roles: Rol[];
  conteos: Record<number, number>;
}) {
  const [creando, setCreando] = useState(false);

  return (
    <section className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio)] p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Roles</h2>
        {!creando && (
          <button
            onClick={() => setCreando(true)}
            className="px-4 py-2 text-base font-semibold rounded-[var(--radio)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)]"
          >
            + Nuevo rol
          </button>
        )}
      </div>

      {creando && <FormularioNuevoRol onListo={() => setCreando(false)} />}

      <div className="divide-y divide-[var(--borde)]">
        {roles.map((rol) => (
          <FilaRol
            key={rol.id}
            rol={rol}
            usuarios={conteos[rol.id] ?? 0}
          />
        ))}
      </div>
    </section>
  );
}

function FormularioNuevoRol({ onListo }: { onListo: () => void }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function crear() {
    if (!nombre.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await crearRol(nombre, descripcion);
      if (res?.error) setError(res.error);
      else {
        setNombre("");
        setDescripcion("");
        onListo();
      }
    });
  }

  return (
    <div className="bg-[var(--fondo-elevado)] border border-[var(--borde)] rounded-[var(--radio)] p-4 mb-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-base font-medium mb-1.5">
            Nombre del rol
          </span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Gerente"
            autoFocus
            className="entrada"
          />
        </label>
        <label className="block">
          <span className="block text-base font-medium mb-1.5">
            Descripción (opcional)
          </span>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Qué hace este rol"
            className="entrada"
          />
        </label>
      </div>
      {error && (
        <p className="text-[var(--peligro)] text-base" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={crear}
          disabled={pendiente || !nombre.trim()}
          className="px-4 py-2 text-base font-semibold rounded-[var(--radio)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-40"
        >
          {pendiente ? "Creando…" : "Crear rol"}
        </button>
        <button
          onClick={onListo}
          className="px-4 py-2 text-base rounded-[var(--radio)] border border-[var(--borde)]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function FilaRol({ rol, usuarios }: { rol: Rol; usuarios: number }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(rol.nombre);
  const [descripcion, setDescripcion] = useState(rol.descripcion ?? "");
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await actualizarRol(rol.id, nombre, descripcion);
      if (res?.error) setError(res.error);
      else setEditando(false);
    });
  }

  function eliminar() {
    if (
      !confirm(
        `¿Eliminar el rol "${rol.nombre}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await eliminarRol(rol.id);
      if (res?.error) setError(res.error);
    });
  }

  if (editando) {
    return (
      <div className="py-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="entrada"
          />
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción"
            className="entrada"
          />
        </div>
        {error && (
          <p className="text-[var(--peligro)] text-base" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={guardar}
            disabled={pendiente}
            className="px-4 py-2 text-base font-semibold rounded-[var(--radio)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-40"
          >
            Guardar
          </button>
          <button
            onClick={() => {
              setEditando(false);
              setNombre(rol.nombre);
              setDescripcion(rol.descripcion ?? "");
              setError(null);
            }}
            className="px-4 py-2 text-base rounded-[var(--radio)] border border-[var(--borde)]"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium">{rol.nombre}</span>
          {rol.es_sistema && (
            <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded-full border border-[var(--borde)] text-[var(--texto-tenue)]">
              Sistema
            </span>
          )}
        </div>
        {rol.descripcion && (
          <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
            {rol.descripcion}
          </div>
        )}
        <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
          {usuarios} usuario(s)
        </div>
        {error && (
          <p className="text-[var(--peligro)] text-sm mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => setEditando(true)}
          className="px-3 py-1.5 text-base rounded-[var(--radio)] border border-[var(--borde)] hover:border-[var(--primario)]"
        >
          Editar
        </button>
        {!rol.es_sistema && (
          <button
            onClick={eliminar}
            disabled={pendiente}
            className="px-3 py-1.5 text-base rounded-[var(--radio)] border border-[var(--borde)] text-[var(--peligro)] hover:border-[var(--peligro)] disabled:opacity-40"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
