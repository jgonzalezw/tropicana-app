"use client";

import { useState, useTransition } from "react";
import type { Profesor, DepsProfesor, TipoProfesor, DatosProfesor } from "@/lib/tipos";
import { soloDigitos, compararPorApellido } from "@/lib/texto";

type Cuenta = { id: string; etiqueta: string };

/**
 * Componente de entidad compartido para Profesor — buscar / alta / edición /
 * baja en un solo lugar, montado idéntico donde el profesor participe. No tiene
 * los datos: el padrón entra por prop y avisa hacia afuera por callbacks.
 * Mismo contrato que `Cobro`.
 */
export default function EntidadProfesor({
  padron,
  cuentas,
  especialidades,
  permitirBaja = false,
  abrirAlElegir = true,
  valor = null,
  depsDe,
  onGuardar,
  onBaja,
  onSelect,
  onCancelar,
}: {
  padron: Profesor[];
  cuentas: Cuenta[];
  especialidades: string[];
  permitirBaja?: boolean;
  abrirAlElegir?: boolean;
  valor?: Profesor | null;
  depsDe?: (id: number) => DepsProfesor | undefined;
  onGuardar?: (datos: DatosProfesor, id: number | null) => Promise<{ error?: string }>;
  onBaja?: (id: number) => Promise<{ error?: string; accion?: string }>;
  onSelect?: (prof: Profesor) => void;
  onCancelar?: () => void;
}) {
  const [ficha, setFicha] = useState<Profesor | "nuevo" | null>(valor);
  const [q, setQ] = useState("");

  const resultados = padron
    .filter((p) => {
      const s = q.trim().toLowerCase();
      if (s.length < 2) return false;
      const nom = `${p.nombre} ${p.apellido}`.toLowerCase();
      return nom.includes(s) || soloDigitos(p.whatsapp).includes(soloDigitos(q));
    })
    .sort(compararPorApellido)
    .slice(0, 5);

  if (ficha) {
    return (
      <FichaProfesor
        inicial={ficha === "nuevo" ? null : ficha}
        cuentas={cuentas}
        especialidades={especialidades}
        padron={padron}
        permitirBaja={permitirBaja}
        deps={ficha !== "nuevo" && depsDe ? depsDe(ficha.id) : undefined}
        onGuardar={onGuardar}
        onBaja={onBaja}
        onCerrar={() => {
          setFicha(null);
          onCancelar?.();
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-base font-medium mb-1.5">
          Buscar por nombre o WhatsApp
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ej. Nuñez · 7011"
          className="entrada"
        />
      </label>

      {q.trim().length >= 2 && (
        <div className="space-y-2">
          {resultados.length === 0 && (
            <p className="text-[var(--texto-tenue)]">Ningún profesor con ese dato.</p>
          )}
          {resultados.map((p) => (
            <button
              key={p.id}
              onClick={() => (abrirAlElegir ? setFicha(p) : onSelect?.(p))}
              className="w-full text-left bg-[var(--fondo-elevado)] border border-[var(--borde)] rounded-[var(--radio-panel)] px-4 py-3 hover:border-[var(--primario)] transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {p.apellido}, {p.nombre}
                  </div>
                  <div className="text-sm text-[var(--texto-tenue)]">
                    {p.whatsapp || "sin WhatsApp"} ·{" "}
                    {p.especialidades.join(", ") || "sin especialidad"}
                  </div>
                </div>
                <TagTipo tipo={p.tipo} />
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setFicha("nuevo")}
        className="w-full px-5 py-3 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--fondo-elevado)] border border-[var(--borde)] hover:border-[var(--primario)]"
      >
        + Profesor nuevo
      </button>
    </div>
  );
}

function FichaProfesor({
  inicial,
  cuentas,
  especialidades,
  padron,
  permitirBaja,
  deps,
  onGuardar,
  onBaja,
  onCerrar,
}: {
  inicial: Profesor | null;
  cuentas: Cuenta[];
  especialidades: string[];
  padron: Profesor[];
  permitirBaja: boolean;
  deps?: DepsProfesor;
  onGuardar?: (datos: DatosProfesor, id: number | null) => Promise<{ error?: string }>;
  onBaja?: (id: number) => Promise<{ error?: string; accion?: string }>;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [apellido, setApellido] = useState(inicial?.apellido ?? "");
  const [whatsapp, setWhatsapp] = useState(inicial?.whatsapp ?? "");
  const [tipo, setTipo] = useState<TipoProfesor>(inicial?.tipo ?? "activo");
  const [esp, setEsp] = useState<Set<string>>(new Set(inicial?.especialidades ?? []));
  const [usuarioId, setUsuarioId] = useState<string | null>(inicial?.usuario_id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  // Aviso suave de WhatsApp duplicado (además del control duro en el servidor).
  const dupe = padron.find(
    (p) =>
      p.id !== inicial?.id &&
      soloDigitos(p.whatsapp) &&
      soloDigitos(p.whatsapp) === soloDigitos(whatsapp)
  );

  function toggleEsp(e: string) {
    setEsp((prev) => {
      const n = new Set(prev);
      if (n.has(e)) n.delete(e);
      else n.add(e);
      return n;
    });
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await onGuardar?.(
        {
          nombre,
          apellido,
          whatsapp,
          tipo,
          especialidades: [...esp],
          usuario_id: usuarioId,
        },
        inicial?.id ?? null
      );
      if (res?.error) setError(res.error);
      else onCerrar();
    });
  }

  function baja() {
    if (!inicial) return;
    setError(null);
    startTransition(async () => {
      const res = await onBaja?.(inicial.id);
      if (res?.error) setError(res.error);
      else onCerrar();
    });
  }

  const tieneHistorial =
    deps && deps.asignaciones + deps.comisiones + deps.liquidaciones + deps.sala > 0;
  const dependencias: string[] = [];
  if (deps) {
    if (deps.asignaciones) dependencias.push("asignaciones a curso");
    if (deps.comisiones) dependencias.push("comisiones devengadas");
    if (deps.liquidaciones) dependencias.push("liquidaciones");
    if (deps.sala) dependencias.push("paquetes de sala");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl">{inicial ? "Editar profesor" : "Profesor nuevo"}</h3>
        <button
          onClick={onCerrar}
          className="text-[var(--texto-tenue)] hover:text-[var(--texto)] text-base"
        >
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="entrada" autoFocus />
        </Campo>
        <Campo etiqueta="Apellido">
          <input value={apellido} onChange={(e) => setApellido(e.target.value)} className="entrada" />
        </Campo>
      </div>

      <Campo etiqueta="WhatsApp">
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          inputMode="tel"
          className="entrada"
        />
      </Campo>
      {dupe && (
        <div className="p-3 rounded-[var(--radio-panel)] border border-[var(--primario)] bg-[var(--accent-100)] text-[var(--peligro-texto)] text-sm">
          Ese WhatsApp ya es de un profesor: {dupe.apellido}, {dupe.nombre} ({dupe.tipo}).
        </div>
      )}

      <div>
        <span className="block text-base font-medium mb-1.5">Especialidades</span>
        <div className="flex flex-wrap gap-2">
          {especialidades.map((e) => {
            const on = esp.has(e);
            return (
              <button
                key={e}
                type="button"
                onClick={() => toggleEsp(e)}
                className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border transition-colors ${
                  on
                    ? "bg-[var(--exito-fill)] text-[var(--exito-texto)] border-[var(--exito)]"
                    : "bg-[var(--fondo-elevado)] text-[var(--texto-tenue)] border-[var(--borde)] hover:border-[var(--primario)]"
                }`}
              >
                {on ? "✓ " : ""}
                {e}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
          {esp.size ? `Dicta ${[...esp].join(", ")}.` : "Al menos una: filtra los cursos que se le pueden asignar."}
        </p>
      </div>

      <div>
        <span className="block text-base font-medium mb-1.5">Tipo</span>
        <div className="flex gap-2">
          {(["activo", "externo"] as TipoProfesor[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex-1 px-4 py-2.5 text-base rounded-[var(--radio-control)] border capitalize ${
                tipo === t
                  ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                  : "border-[var(--borde)] hover:border-[var(--primario)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
          {tipo === "activo"
            ? "Activo: paga la tarifa de sala más baja (Profesor Activo)."
            : "Externo: paga la tarifa de sala de Profesor Externo (más alta). Solo alquila la sala; no puede ser titular de curso."}
        </p>
      </div>

      <Campo etiqueta="Cuenta de acceso (opcional)">
        <select
          value={usuarioId ?? ""}
          onChange={(e) => setUsuarioId(e.target.value || null)}
          className="entrada"
        >
          <option value="">Sin cuenta</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      {error && (
        <p className="text-[var(--peligro)] text-base" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={guardar}
          disabled={pendiente || !!dupe}
          className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
        >
          {pendiente ? "Guardando…" : "Guardar profesor"}
        </button>
      </div>

      {/* Baja: eliminar de verdad si no hay historial; si hay, desactivar. */}
      {permitirBaja && inicial && (
        <div
          className={`mt-2 p-4 rounded-[var(--radio-panel)] border ${
            tieneHistorial
              ? "border-[var(--primario)] bg-[var(--accent-100)]"
              : "border-[var(--borde)] bg-[var(--fondo-elevado)]"
          }`}
        >
          <div className="font-medium">
            {tieneHistorial ? "No se puede eliminar" : "Eliminar profesor"}
          </div>
          <p className="text-sm text-[var(--texto-tenue)] mt-1">
            {tieneHistorial
              ? `Tiene historial dependiente (${dependencias.join(" · ")}). Desactivarlo lo saca de las asignaciones nuevas y conserva todo lo ya registrado.`
              : "Sin historial dependiente: se elimina de verdad, no queda registro."}
          </p>
          <button
            onClick={baja}
            disabled={pendiente}
            className={`mt-3 px-4 py-2 text-base rounded-[var(--radio-control)] border ${
              tieneHistorial
                ? "border-[var(--primario)] text-[var(--primario)]"
                : "border-[var(--peligro)] text-[var(--peligro)]"
            } disabled:opacity-40`}
          >
            {tieneHistorial ? "Desactivar" : "Eliminar"}
          </button>
        </div>
      )}
    </div>
  );
}

export function TagTipo({ tipo }: { tipo: TipoProfesor }) {
  return (
    <span
      className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium capitalize ${
        tipo === "activo"
          ? "bg-[var(--exito-fill)] text-[var(--exito-texto)]"
          : "bg-[var(--fondo-elevado)] text-[var(--texto-tenue)]"
      }`}
    >
      {tipo}
    </span>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-base font-medium mb-1.5">{etiqueta}</span>
      {children}
    </label>
  );
}
