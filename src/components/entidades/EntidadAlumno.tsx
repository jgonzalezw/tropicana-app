"use client";

import { useState, useTransition } from "react";
import type { Alumno, DatosAlumno } from "@/lib/tipos";
import { soloDigitos, compararPorApellido } from "@/lib/texto";

type Canal = { valor: string; etiqueta: string };

/**
 * Componente de entidad compartido para Alumno — buscar / alta / edición / baja.
 * Incluye: duplicado por WhatsApp, bloque de tutor si es menor, clave compuesta
 * de menor (WhatsApp del tutor + nombre) y tutor que puede ser un alumno
 * existente (vincular en vez de duplicar). Datos por prop, avisa por callbacks.
 */
export default function EntidadAlumno({
  padron,
  canales,
  permitirBaja = false,
  abrirAlElegir = true,
  valor = null,
  depsDe,
  onGuardar,
  onBaja,
  onSelect,
  onCancelar,
}: {
  padron: Alumno[];
  canales: Canal[];
  permitirBaja?: boolean;
  abrirAlElegir?: boolean;
  valor?: Alumno | null;
  depsDe?: (id: number) => number | undefined;
  onGuardar?: (datos: DatosAlumno, id: number | null) => Promise<{ error?: string }>;
  onBaja?: (id: number) => Promise<{ error?: string; accion?: string }>;
  onSelect?: (a: Alumno) => void;
  onCancelar?: () => void;
}) {
  const [ficha, setFicha] = useState<Alumno | "nuevo" | null>(valor);
  const [q, setQ] = useState("");

  const resultados = padron
    .filter((a) => {
      const s = q.trim().toLowerCase();
      if (s.length < 2) return false;
      const nom = `${a.nombre} ${a.apellido}`.toLowerCase();
      const d = soloDigitos(q);
      return (
        nom.includes(s) ||
        (d.length >= 3 &&
          (soloDigitos(a.whatsapp).includes(d) || soloDigitos(a.tutor_whatsapp).includes(d)))
      );
    })
    .sort(compararPorApellido)
    .slice(0, 5);

  if (ficha) {
    return (
      <FichaAlumno
        inicial={ficha === "nuevo" ? null : ficha}
        padron={padron}
        canales={canales}
        permitirBaja={permitirBaja}
        deps={ficha !== "nuevo" && depsDe ? depsDe(ficha.id) : undefined}
        onAbrir={(a) => setFicha(a)}
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
        <span className="block text-base font-medium mb-1.5">Buscar por nombre o WhatsApp</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ej. Martínez · 7105" className="entrada" />
      </label>

      {q.trim().length >= 2 &&
        (resultados.length === 0 ? (
          <p className="text-[var(--texto-tenue)]">Nadie con ese dato. Cargalo como alumno nuevo.</p>
        ) : (
          resultados.map((a) => (
            <button
              key={a.id}
              onClick={() => (abrirAlElegir ? setFicha(a) : onSelect?.(a))}
              className="w-full text-left bg-[var(--fondo-elevado)] border border-[var(--borde)] rounded-[var(--radio-panel)] px-4 py-3 hover:border-[var(--primario)]"
            >
              <div className="font-medium">
                {a.apellido}, {a.nombre}
              </div>
              <div className="text-sm text-[var(--texto-tenue)]">
                {a.es_menor
                  ? `menor · tutor ${a.tutor_whatsapp || "—"}`
                  : a.whatsapp || "sin WhatsApp"}
              </div>
            </button>
          ))
        ))}

      <button
        onClick={() => setFicha("nuevo")}
        className="w-full px-5 py-3 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--fondo-elevado)] border border-[var(--borde)] hover:border-[var(--primario)]"
      >
        + Alumno nuevo
      </button>
    </div>
  );
}

function FichaAlumno({
  inicial,
  padron,
  canales,
  permitirBaja,
  deps,
  onAbrir,
  onGuardar,
  onBaja,
  onCerrar,
}: {
  inicial: Alumno | null;
  padron: Alumno[];
  canales: Canal[];
  permitirBaja: boolean;
  deps?: number;
  onAbrir: (a: Alumno) => void;
  onGuardar?: (datos: DatosAlumno, id: number | null) => Promise<{ error?: string }>;
  onBaja?: (id: number) => Promise<{ error?: string; accion?: string }>;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [apellido, setApellido] = useState(inicial?.apellido ?? "");
  const [wa, setWa] = useState(inicial?.whatsapp ?? "");
  const [esMenor, setEsMenor] = useState(inicial?.es_menor ?? false);
  const [tutorNom, setTutorNom] = useState(inicial?.tutor_nombre ?? "");
  const [tutorWa, setTutorWa] = useState(inicial?.tutor_whatsapp ?? "");
  const [tutorLink, setTutorLink] = useState<number | null>(inicial?.tutor_alumno_id ?? null);
  const [canal, setCanal] = useState(inicial?.canal_captacion ?? "");
  const [descAdulto, setDescAdulto] = useState(false);
  const [descMenor, setDescMenor] = useState(false);
  const [descTutor, setDescTutor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const curId = inicial?.id ?? -1;
  const waDig = soloDigitos(wa);
  const tutWaDig = soloDigitos(tutorWa);

  // Duplicado por WhatsApp (adulto).
  const dupAdulto =
    !esMenor && !descAdulto && waDig.length >= 6
      ? padron.find((a) => !a.es_menor && a.id !== curId && soloDigitos(a.whatsapp) === waDig)
      : undefined;

  // Duplicado de menor por clave compuesta (tutor + nombre).
  const dupMenor =
    esMenor && !descMenor && tutWaDig.length >= 6 && nombre.trim()
      ? padron.find(
          (a) =>
            a.es_menor &&
            a.id !== curId &&
            soloDigitos(a.tutor_whatsapp) === tutWaDig &&
            (a.nombre ?? "").toLowerCase() === nombre.trim().toLowerCase()
        )
      : undefined;

  // El WhatsApp del tutor ya es de un alumno adulto → ofrecer vincular.
  const tutorEsAlumno =
    esMenor && !tutorLink && !descTutor && tutWaDig.length >= 6
      ? padron.find((a) => !a.es_menor && soloDigitos(a.whatsapp) === tutWaDig)
      : undefined;

  const identidadOk = esMenor ? tutWaDig.length >= 6 && !!nombre.trim() : waDig.length >= 6;
  const panelAbierto = !!dupAdulto || !!dupMenor || !!tutorEsAlumno;
  const puedeGuardar =
    !pendiente && !!nombre.trim() && !!apellido.trim() && identidadOk && !panelAbierto;

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await onGuardar?.(
        {
          nombre,
          apellido,
          whatsapp: wa,
          es_menor: esMenor,
          tutor_alumno_id: tutorLink,
          tutor_nombre: tutorNom,
          tutor_whatsapp: tutorWa,
          canal_captacion: canal || null,
        },
        inicial?.id ?? null
      );
      if (res?.error) setError(res.error);
      else onCerrar();
    });
  }
  function baja() {
    if (!inicial) return;
    startTransition(async () => {
      const res = await onBaja?.(inicial.id);
      if (res?.error) setError(res.error);
      else onCerrar();
    });
  }

  const tieneHistorial = (deps ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl">{inicial ? "Editar alumno" : "Alumno nuevo"}</h3>
        <button onClick={onCerrar} className="text-[var(--texto-tenue)] hover:text-[var(--texto)]">
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

      <Campo etiqueta={esMenor ? "WhatsApp (opcional si hay tutor)" : "WhatsApp · identifica al alumno"}>
        <input
          value={wa}
          onChange={(e) => {
            setWa(e.target.value);
            setDescAdulto(false);
          }}
          inputMode="tel"
          className="entrada"
        />
      </Campo>

      {dupAdulto && (
        <PanelDupe
          titulo="Ese WhatsApp ya está cargado"
          alumno={dupAdulto}
          onUsar={() => onAbrir(dupAdulto)}
          onOtra={() => setDescAdulto(true)}
        />
      )}

      {/* Tutor (menor) */}
      <button
        type="button"
        onClick={() => {
          const nuevo = !esMenor;
          setEsMenor(nuevo);
          if (!nuevo) {
            setTutorNom("");
            setTutorWa("");
            setTutorLink(null);
            setDescMenor(false);
            setDescTutor(false);
          }
        }}
        className="text-[var(--primario)] text-base"
      >
        {esMenor ? "Quitar tutor" : "Es menor: agregar tutor"}
      </button>

      {esMenor && (
        <div className="p-4 rounded-[var(--radio-panel)] border border-[var(--borde)] bg-[var(--fondo-elevado)] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo etiqueta="Tutor (nombre)">
              <input
                value={tutorNom}
                onChange={(e) => {
                  setTutorNom(e.target.value);
                  setTutorLink(null);
                  setDescTutor(false);
                }}
                className="entrada"
              />
            </Campo>
            <Campo etiqueta="WhatsApp tutor · identifica al menor">
              <input
                value={tutorWa}
                onChange={(e) => {
                  setTutorWa(e.target.value);
                  setTutorLink(null);
                  setDescTutor(false);
                  setDescMenor(false);
                }}
                inputMode="tel"
                className="entrada"
              />
            </Campo>
          </div>
          <p className="text-sm text-[var(--texto-tenue)]">
            Al menor lo identificamos por el WhatsApp del tutor y su nombre, así dos hermanos con el
            mismo tutor no se pisan.
          </p>

          {tutorLink && (
            <div className="p-3 rounded-[var(--radio-panel)] border border-[var(--exito)] bg-[var(--exito-fill)] text-[var(--exito-texto)] text-sm flex items-center justify-between gap-3">
              <span>
                Vinculado a {padron.find((a) => a.id === tutorLink)?.apellido},{" "}
                {padron.find((a) => a.id === tutorLink)?.nombre}, que ya está cargado como alumno.
              </span>
              <button
                type="button"
                onClick={() => setTutorLink(null)}
                className="underline shrink-0"
              >
                Desvincular
              </button>
            </div>
          )}

          {tutorEsAlumno && (
            <PanelDupe
              titulo="Ese WhatsApp ya es de un alumno"
              alumno={tutorEsAlumno}
              textoUsar="Vincular a esta persona"
              onUsar={() => {
                setTutorLink(tutorEsAlumno.id);
                setTutorNom(`${tutorEsAlumno.nombre} ${tutorEsAlumno.apellido}`);
                setTutorWa(tutorEsAlumno.whatsapp ?? tutorWa);
              }}
              onOtra={() => setDescTutor(true)}
            />
          )}

          {dupMenor && (
            <PanelDupe
              titulo="Ese menor ya está cargado"
              alumno={dupMenor}
              onUsar={() => onAbrir(dupMenor)}
              onOtra={() => setDescMenor(true)}
            />
          )}
        </div>
      )}

      <Campo etiqueta="Canal de captación (opcional)">
        <select value={canal} onChange={(e) => setCanal(e.target.value)} className="entrada">
          <option value="">— Sin definir —</option>
          {canales.map((c) => (
            <option key={c.valor} value={c.valor}>
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

      <button
        onClick={guardar}
        disabled={!puedeGuardar}
        className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
      >
        {pendiente ? "Guardando…" : "Guardar alumno"}
      </button>

      {permitirBaja && inicial && (
        <div
          className={`mt-2 p-4 rounded-[var(--radio-panel)] border ${
            tieneHistorial ? "border-[var(--primario)] bg-[var(--accent-100)]" : "border-[var(--borde)] bg-[var(--fondo-elevado)]"
          }`}
        >
          <div className="font-medium">{tieneHistorial ? "No se puede eliminar" : "Eliminar alumno"}</div>
          <p className="text-sm text-[var(--texto-tenue)] mt-1">
            {tieneHistorial
              ? "Tiene historial (inscripciones/pagos). Se desactiva y conserva lo registrado."
              : "Sin historial dependiente: se elimina de verdad."}
          </p>
          <button
            onClick={baja}
            disabled={pendiente}
            className={`mt-3 px-4 py-2 text-base rounded-[var(--radio-control)] border ${
              tieneHistorial ? "border-[var(--primario)] text-[var(--primario)]" : "border-[var(--peligro)] text-[var(--peligro)]"
            } disabled:opacity-40`}
          >
            {tieneHistorial ? "Desactivar" : "Eliminar"}
          </button>
        </div>
      )}
    </div>
  );
}

function PanelDupe({
  titulo,
  alumno,
  textoUsar = "Usar este alumno",
  onUsar,
  onOtra,
}: {
  titulo: string;
  alumno: Alumno;
  textoUsar?: string;
  onUsar: () => void;
  onOtra: () => void;
}) {
  return (
    <div className="p-4 rounded-[var(--radio-panel)] border border-[var(--primario)] bg-[var(--accent-100)]">
      <div className="font-semibold text-[var(--peligro-texto)]">{titulo}</div>
      <div className="mt-1">
        {alumno.apellido}, {alumno.nombre}
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={onUsar}
          className="px-4 py-2 text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]"
        >
          {textoUsar}
        </button>
        <button
          type="button"
          onClick={onOtra}
          className="px-4 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)]"
        >
          Es otra persona
        </button>
      </div>
    </div>
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
