"use client";

import { useState, useTransition } from "react";
import type { Curso, TarifasCurso, DatosCurso } from "@/lib/tipos";

export const DIAS: { n: number; label: string }[] = [
  { n: 1, label: "Lun" },
  { n: 2, label: "Mar" },
  { n: 3, label: "Mié" },
  { n: 4, label: "Jue" },
  { n: 5, label: "Vie" },
  { n: 6, label: "Sáb" },
  { n: 7, label: "Dom" },
];

export function etiquetaDias(dias: number[]): string {
  return DIAS.filter((d) => dias.includes(d.n))
    .map((d) => d.label)
    .join(" · ");
}

/**
 * Componente de entidad compartido para Curso — buscar / alta / edición / baja.
 * Mismo contrato que `Cobro` y `EntidadProfesor`: datos por prop, avisa por
 * callbacks; la pantalla aporta la superficie.
 */
export default function EntidadCurso({
  padron,
  tarifasDe,
  especialidades,
  permitirBaja = false,
  valor = null,
  depsDe,
  onGuardar,
  onBaja,
  onCancelar,
}: {
  padron: Curso[];
  tarifasDe?: (id: number) => TarifasCurso | undefined;
  especialidades: string[];
  permitirBaja?: boolean;
  valor?: Curso | null;
  depsDe?: (id: number) => number | undefined;
  onGuardar?: (datos: DatosCurso, id: number | null) => Promise<{ error?: string }>;
  onBaja?: (id: number, vigenteHasta: string | null) => Promise<{ error?: string; accion?: string }>;
  onCancelar?: () => void;
}) {
  const [ficha, setFicha] = useState<Curso | "nuevo" | null>(valor);
  const [q, setQ] = useState("");

  const resultados = padron
    .filter((c) => q.trim().length >= 2 && c.nombre.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 6);

  if (ficha) {
    return (
      <FichaCurso
        inicial={ficha === "nuevo" ? null : ficha}
        tarifasIniciales={ficha !== "nuevo" && tarifasDe ? tarifasDe(ficha.id) : undefined}
        especialidades={especialidades}
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
        <span className="block text-base font-medium mb-1.5">Buscar curso por nombre</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ej. Salsa" className="entrada" />
      </label>
      {q.trim().length >= 2 &&
        resultados.map((c) => (
          <button
            key={c.id}
            onClick={() => setFicha(c)}
            className="w-full text-left bg-[var(--fondo-elevado)] border border-[var(--borde)] rounded-[var(--radio-panel)] px-4 py-3 hover:border-[var(--primario)]"
          >
            <div className="font-medium">{c.nombre}</div>
            <div className="text-sm text-[var(--texto-tenue)]">
              {[c.linea, c.nivel].filter(Boolean).join(" · ")} · {etiquetaDias(c.dias_semana)}
            </div>
          </button>
        ))}
      <button
        onClick={() => setFicha("nuevo")}
        className="w-full px-5 py-3 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--fondo-elevado)] border border-[var(--borde)] hover:border-[var(--primario)]"
      >
        + Curso nuevo
      </button>
    </div>
  );
}

function FichaCurso({
  inicial,
  tarifasIniciales,
  especialidades,
  permitirBaja,
  deps,
  onGuardar,
  onBaja,
  onCerrar,
}: {
  inicial: Curso | null;
  tarifasIniciales?: TarifasCurso;
  especialidades: string[];
  permitirBaja: boolean;
  deps?: number;
  onGuardar?: (datos: DatosCurso, id: number | null) => Promise<{ error?: string }>;
  onBaja?: (id: number, vigenteHasta: string | null) => Promise<{ error?: string; accion?: string }>;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [linea, setLinea] = useState(inicial?.linea ?? "");
  const [nivel, setNivel] = useState(inicial?.nivel ?? "");
  const [dias, setDias] = useState<number[]>(inicial?.dias_semana ?? []);
  const [hora, setHora] = useState(inicial?.hora?.slice(0, 5) ?? "");
  const [precio, setPrecio] = useState(inicial ? String(inicial.precio_mensual) : "");
  const [desde, setDesde] = useState(inicial?.vigente_desde?.slice(0, 10) ?? hoyISO());
  const [hasta, setHasta] = useState(inicial?.vigente_hasta?.slice(0, 10) ?? "");
  // Fecha de la baja: se propone hoy, pero se confirma o se cambia a mano.
  const [bajaFecha, setBajaFecha] = useState(inicial?.vigente_hasta?.slice(0, 10) ?? hoyISO());
  const [tClase, setTClase] = useState(numOrEmpty(tarifasIniciales?.clase));
  const [tSemana, setTSemana] = useState(numOrEmpty(tarifasIniciales?.semana));
  const [tMedio, setTMedio] = useState(numOrEmpty(tarifasIniciales?.medio_mes));
  const [tPrueba, setTPrueba] = useState(numOrEmpty(tarifasIniciales?.prueba));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function toggleDia(n: number) {
    setDias((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort()));
  }
  const parse = (s: string) => {
    const t = s.trim();
    return t === "" ? null : Number(t.replace(",", "."));
  };

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await onGuardar?.(
        {
          nombre,
          linea,
          nivel,
          dias_semana: dias,
          hora: hora ? hora : null,
          precio_mensual: parse(precio) ?? 0,
          vigente_desde: desde,
          vigente_hasta: hasta ? hasta : null,
          tarifas: {
            clase: parse(tClase),
            semana: parse(tSemana),
            medio_mes: parse(tMedio),
            prueba: parse(tPrueba),
          },
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
      // La fecha de baja la pone la persona, nunca el sistema: de ella depende
      // cuántas clases pone el curso en el prorrateo (Javier, 2026-09-12).
      const res = await onBaja?.(inicial.id, tieneHistorial ? bajaFecha : null);
      if (res?.error) setError(res.error);
      else onCerrar();
    });
  }

  const tieneHistorial = (deps ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl">{inicial ? "Editar curso" : "Curso nuevo"}</h3>
        <button onClick={onCerrar} className="text-[var(--texto-tenue)] hover:text-[var(--texto)]">
          Cancelar
        </button>
      </div>

      <Campo etiqueta="Nombre del curso">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="entrada" autoFocus />
      </Campo>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Línea / estilo">
          <select value={linea} onChange={(e) => setLinea(e.target.value)} className="entrada">
            <option value="">— Sin definir —</option>
            {especialidades.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Nivel (opcional)">
          <input value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder="ej. Inicial" className="entrada" />
        </Campo>
      </div>

      <div>
        <span className="block text-base font-medium mb-1.5">Días de la semana</span>
        <div className="flex flex-wrap gap-2">
          {DIAS.map((d) => {
            const on = dias.includes(d.n);
            return (
              <button
                key={d.n}
                type="button"
                onClick={() => toggleDia(d.n)}
                className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
                  on
                    ? "bg-[var(--exito-fill)] text-[var(--exito-texto)] border-[var(--exito)]"
                    : "bg-[var(--fondo-elevado)] text-[var(--texto-tenue)] border-[var(--borde)] hover:border-[var(--primario)]"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Hora (opcional)">
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="entrada" />
        </Campo>
        <Campo etiqueta="Precio mensual (Bs.)">
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" className="entrada" />
        </Campo>
      </div>

      {/* Vigencia (0033). No es cosmética: el calendario del curso no genera
          clases fuera de estas fechas, así que de acá depende cuántas clases
          pone el curso en el prorrateo y qué asistencias se exigen. */}
      <div>
        <span className="block text-base font-medium mb-1.5">Vigencia del curso</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo etiqueta="Corre desde">
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="entrada" />
          </Campo>
          <Campo etiqueta="Fecha de baja (opcional)">
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="entrada" />
          </Campo>
        </div>
        <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
          Fuera de estas fechas el curso no genera clases: no se pide registrar asistencia, no cuenta
          para el reparto de comisiones y no se puede vender. Si aparece una clase retroactiva —hubo
          profesor, alumno y clase— lo que se corrige es la fecha de acá.
        </p>
      </div>

      <div>
        <span className="block text-base font-medium mb-1.5">
          Tarifas parciales (opcional — sin cargar, esa modalidad cae al mensual)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Campo etiqueta="Una clase (Bs.)">
            <input value={tClase} onChange={(e) => setTClase(e.target.value)} inputMode="decimal" placeholder="—" className="entrada" />
          </Campo>
          <Campo etiqueta="Una semana (Bs.)">
            <input value={tSemana} onChange={(e) => setTSemana(e.target.value)} inputMode="decimal" placeholder="—" className="entrada" />
          </Campo>
          <Campo etiqueta="Medio mes (Bs.)">
            <input value={tMedio} onChange={(e) => setTMedio(e.target.value)} inputMode="decimal" placeholder="—" className="entrada" />
          </Campo>
        </div>
      </div>

      {/* La prueba va aparte: no es otra forma de comprar el curso, es lo que
          cuesta venir a probarlo. Sin precio cargado no se puede vender una
          prueba de este curso — no cae al mensual como las de arriba. */}
      <div>
        <span className="block text-base font-medium mb-1.5">Clase de prueba</span>
        <div className="max-w-[220px]">
          <Campo etiqueta="Precio por alumno (Bs.)">
            <input
              value={tPrueba}
              onChange={(e) => setTPrueba(e.target.value)}
              inputMode="decimal"
              placeholder="—"
              className="entrada"
            />
          </Campo>
        </div>
        <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
          Lo que paga cada persona por venir a probar este curso. Sin precio cargado, este curso no
          se puede ofrecer como prueba — una prueba de Heels no vale lo que una de Zumba.
        </p>
      </div>

      {error && (
        <p className="text-[var(--peligro)] text-base" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={guardar}
        disabled={pendiente}
        className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
      >
        {pendiente ? "Guardando…" : "Guardar curso"}
      </button>

      {permitirBaja && inicial && (
        <div
          className={`mt-2 p-4 rounded-[var(--radio-panel)] border ${
            tieneHistorial ? "border-[var(--primario)] bg-[var(--accent-100)]" : "border-[var(--borde)] bg-[var(--fondo-elevado)]"
          }`}
        >
          <div className="font-medium">{tieneHistorial ? "Dar de baja el curso" : "Eliminar curso"}</div>
          <p className="text-sm text-[var(--texto-tenue)] mt-1">
            {tieneHistorial
              ? "Tiene historial (clases, asignaciones o membresías): no se elimina, se da de baja. Lo registrado se conserva."
              : "Sin historial dependiente: se elimina de verdad (con sus tarifas)."}
          </p>
          {/* La fecha de baja NO se asigna sola: de ella depende cuántas clases
              pone el curso en el prorrateo y qué asistencias se exigen. Se
              propone hoy y la persona la confirma o la cambia — puede ser
              anterior o posterior. (Javier, 2026-09-12.) */}
          {tieneHistorial && (
            <div className="mt-3 max-w-[260px]">
              <Campo etiqueta="Deja de dictarse el">
                <input
                  type="date"
                  value={bajaFecha}
                  onChange={(e) => setBajaFecha(e.target.value)}
                  className="entrada"
                />
              </Campo>
              <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
                {bajaFecha > hoyISO()
                  ? "Es una baja programada: el curso sigue activo y vendible hasta esa fecha."
                  : "Desde esa fecha el curso no genera clases, no se pide su asistencia y no se puede vender."}
              </p>
            </div>
          )}
          <button
            onClick={baja}
            disabled={pendiente || (tieneHistorial && !bajaFecha)}
            className={`mt-3 px-4 py-2 text-base rounded-[var(--radio-control)] border ${
              tieneHistorial ? "border-[var(--primario)] text-[var(--primario)]" : "border-[var(--peligro)] text-[var(--peligro)]"
            } disabled:opacity-40`}
          >
            {tieneHistorial ? "Dar de baja" : "Eliminar"}
          </button>
        </div>
      )}
    </div>
  );
}

function numOrEmpty(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-base font-medium mb-1.5">{etiqueta}</span>
      {children}
    </label>
  );
}
