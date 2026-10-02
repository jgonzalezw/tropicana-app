"use client";

/**
 * Panel "Gestionar" de /sala (Hito B, S4): UN componente para todos los tipos
 * de slot. Lateral derecho en escritorio, hoja inferior en celular.
 *
 *   cabecera (tipo, estado, fecha/hora, alcance) → datos → acciones →
 *   enlace a la ficha → historial (colapsado, dentro de `GestionReserva`)
 *
 * Reutiliza lo que ya existe, no reimplementa nada:
 *   - reservas (particular, alquiler, externo): `GestionReserva` y las acciones
 *     del Hito B de `particulares/acciones.ts`;
 *   - cursos: `suspenderClase` / `reabrirSesion` de `asistencia/acciones.ts` (la
 *     MISMA implementación que usa Tomar asistencia) y un enlace directo a esa
 *     pantalla con curso y fecha;
 *   - bloqueos: se quitan desde la fila (flujo de la tarjeta de sala). Editar un
 *     bloqueo no existe todavía (ROADMAP).
 *
 * Antes de confirmar cualquier acción se muestra su efecto.
 */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import GestionReserva from "@/components/GestionReserva";
import { obtenerReservaParaGestion, type DetalleGestionReserva } from "@/app/(privado)/particulares/acciones";
import {
  obtenerClaseParaGestion,
  suspenderClase,
  reabrirSesion,
  type ClaseParaGestion,
} from "@/app/(privado)/asistencia/acciones";
import { finDelSlot, type SlotSala } from "@/lib/slotSala";
import { ETIQUETA_TIPO_SLOT } from "./SlotFila";

const botonPrimario =
  "px-4 py-2 text-base rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] font-semibold hover:opacity-90 disabled:opacity-40 inline-block";
const botonTenue =
  "px-4 py-2 text-base rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40 inline-block";
const botonPeligro =
  "px-4 py-2 text-base rounded-[var(--radio-control)] border border-[var(--peligro)] text-[var(--peligro)] hover:opacity-80 disabled:opacity-40";

function fechaLarga(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-BO", { weekday: "long", day: "2-digit", month: "2-digit" });
}

export default function PanelGestionar({
  slot,
  salasPropias,
  motivosSuspension,
  incrementoMin,
  minimoMin,
  onCerrar,
  onCambio,
}: {
  slot: SlotSala;
  salasPropias: { id: number; nombre: string }[];
  motivosSuspension: { valor: string; etiqueta: string }[];
  incrementoMin: number;
  minimoMin: number;
  onCerrar: () => void;
  /** Tras una acción exitosa: el padre recarga la agenda. */
  onCambio: () => void;
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  const alcance =
    slot.tipo === "curso" ? "Aplica solo a esta clase, fecha y hora" : "Aplica solo a esta reserva, fecha y hora";

  return (
    <>
      <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={onCerrar} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label={`Gestionar ${slot.titulo}`}
        className="fixed z-40 bg-[var(--fondo-panel)] border-[var(--borde)] overflow-y-auto p-5 space-y-4
          max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[85vh] max-md:rounded-t-[var(--radio-tarjeta)] max-md:border-t
          md:top-0 md:right-0 md:h-full md:w-[28rem] md:border-l"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2 py-1 rounded-full border border-[var(--borde)]">
                {ETIQUETA_TIPO_SLOT[slot.tipo]}
              </span>
              <span className="text-sm font-semibold">
                <span aria-hidden="true">{slot.estado.icono} </span>
                {slot.estado.etiqueta}
              </span>
            </div>
            <h2 className="text-xl font-semibold mt-2">{slot.titulo}</h2>
            <p className="text-base capitalize">
              {fechaLarga(slot.fecha)} · {slot.hora}–{finDelSlot(slot.hora, slot.duracionMin)}
            </p>
            <p className="text-sm text-[var(--texto-tenue)]">{alcance}</p>
          </div>
          <button onClick={onCerrar} className={botonTenue} aria-label="Cerrar el panel">
            Cerrar
          </button>
        </div>

        <dl className="text-base space-y-1">
          {slot.titular && <Dato rotulo="Titular" valor={slot.titular} />}
          {slot.profesor && <Dato rotulo="Profesor" valor={slot.profesor} />}
          {slot.sustituto && <Dato rotulo="Relevo (informativo)" valor={slot.sustituto} />}
          {slot.personas != null && slot.personas > 1 && <Dato rotulo="Personas" valor={String(slot.personas)} />}
          {slot.lugar && <Dato rotulo="Lugar" valor={slot.lugar} />}
          {slot.notas && <Dato rotulo="Notas" valor={slot.notas} />}
        </dl>

        {slot.tipo === "curso" ? (
          <AccionesCurso slot={slot} onCambio={onCambio} />
        ) : slot.reservaId != null && slot.tipo !== "bloqueo" ? (
          <AccionesReserva
            slot={slot}
            salasPropias={salasPropias}
            motivosSuspension={motivosSuspension}
            incrementoMin={incrementoMin}
            minimoMin={minimoMin}
            onCambio={onCambio}
          />
        ) : (
          <p className="text-sm text-[var(--texto-tenue)]">
            Un bloqueo se quita desde su fila con «Quitar bloqueo». Para cambiarlo, se quita y se crea otro.
          </p>
        )}
      </aside>
    </>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-[var(--texto-tenue)] shrink-0">{rotulo}:</dt>
      <dd>{valor}</dd>
    </div>
  );
}

// ── Reservas ─────────────────────────────────────────────────────────────────

function AccionesReserva({
  slot,
  salasPropias,
  motivosSuspension,
  incrementoMin,
  minimoMin,
  onCambio,
}: {
  slot: SlotSala;
  salasPropias: { id: number; nombre: string }[];
  motivosSuspension: { valor: string; etiqueta: string }[];
  incrementoMin: number;
  minimoMin: number;
  onCambio: () => void;
}) {
  const [detalle, setDetalle] = useState<DetalleGestionReserva | { error: string } | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerReservaParaGestion(slot.reservaId!).then((r) => {
      if (vigente) setDetalle(r);
    });
    return () => {
      vigente = false;
    };
  }, [slot.reservaId]);

  if (!detalle) return <p className="text-sm text-[var(--texto-tenue)]">Cargando…</p>;
  if ("error" in detalle)
    return (
      <p className="text-[var(--peligro)]" role="alert">
        {detalle.error}
      </p>
    );
  return (
    <div className="space-y-3">
      <GestionReserva
        reserva={detalle.reserva}
        membresiaId={detalle.membresiaId}
        tipo={detalle.tipo}
        disponibleMin={detalle.disponibleMin}
        fechaInicioMembresia={detalle.fechaInicioMembresia}
        fechaFinMembresia={detalle.fechaFinMembresia}
        salasPropias={salasPropias}
        salaExternaDeLaMembresia={(() => {
          const ext = detalle.salasDeLaMembresia.find((s) => s.esExterna);
          return ext ? { salaId: ext.salaId, nombre: ext.nombre } : null;
        })()}
        motivosSuspension={motivosSuspension}
        incrementoMin={incrementoMin}
        minimoMin={minimoMin}
        puedeEditar
        mostrarLinkFicha
        onCambio={onCambio}
      />
      {detalle.tipo === "alquiler" && (
        // El saldo del alquiler no viaja en este detalle: se ofrece el enlace a
        // Caja, que ya registra el cobro (ROADMAP: abrir directo la cuota con saldo).
        <Link href="/caja" className="text-sm text-[var(--primario)] underline hover:no-underline">
          Registrar cobro en Caja →
        </Link>
      )}
    </div>
  );
}

// ── Cursos ───────────────────────────────────────────────────────────────────

function AccionesCurso({ slot, onCambio }: { slot: SlotSala; onCambio: () => void }) {
  const [clase, setClase] = useState<ClaseParaGestion | { error: string } | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [paso, setPaso] = useState<"suspender" | "reabrir" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    let vigente = true;
    obtenerClaseParaGestion(slot.cursoId!, slot.fecha).then((r) => {
      if (vigente) setClase(r);
    });
    return () => {
      vigente = false;
    };
  }, [slot.cursoId, slot.fecha, recarga]);

  if (!clase) return <p className="text-sm text-[var(--texto-tenue)]">Cargando…</p>;
  if ("error" in clase)
    return (
      <p className="text-[var(--peligro)]" role="alert">
        {clase.error}
      </p>
    );

  const hrefAsistencia = `/asistencia?curso=${slot.cursoId}&fecha=${slot.fecha}`;
  const plu = (n: number) => `${n} ${n === 1 ? "alumno mensual" : "alumnos mensuales"}`;

  function ejecutar(accion: "suspender" | "reabrir") {
    setResultado(null);
    startTransition(async () => {
      const r: { ok?: true; resumen?: string; error?: string } =
        accion === "suspender"
          ? await suspenderClase({ cursoId: slot.cursoId!, fecha: slot.fecha, motivo })
          : await reabrirSesion({ cursoId: slot.cursoId!, fecha: slot.fecha });
      if (r.error) {
        setResultado({ ok: false, texto: r.error });
        return;
      }
      setPaso(null);
      setMotivo("");
      setResultado({ ok: true, texto: r.resumen ?? "Clase reabierta." });
      setRecarga((n) => n + 1);
      onCambio();
    });
  }

  return (
    <div className="space-y-3">
      {clase.suspendida && (
        <p className="text-base">
          Suspendida{clase.motivoSuspension ? `: ${clase.motivoSuspension}` : ""}. La sala está liberada.
        </p>
      )}
      {!clase.puedeOperar && clase.motivoNoOperar && (
        <p className="text-sm text-[var(--texto-tenue)]">{clase.motivoNoOperar}</p>
      )}

      {paso === "suspender" && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--texto-tenue)]">
            Lo decide la escuela: no se computa asistencia y se corre el fin de ciclo de {plu(clase.alumnosMensuales)}.
            Los paquetes por clase se difieren solos. La sala queda libre.
          </p>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional): feriado, profe ausente…"
            className="entrada"
          />
          <div className="flex gap-2 flex-wrap">
            <button className={botonPeligro} disabled={pendiente} onClick={() => ejecutar("suspender")}>
              {pendiente ? "Suspendiendo…" : "Confirmar suspensión"}
            </button>
            <button className={botonTenue} onClick={() => setPaso(null)}>
              Volver
            </button>
          </div>
        </div>
      )}

      {paso === "reabrir" && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--texto-tenue)]">
            La clase vuelve a ocupar su horario y se restituye el fin de ciclo de los alumnos que se había corrido.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button className={botonPrimario} disabled={pendiente} onClick={() => ejecutar("reabrir")}>
              {pendiente ? "Reabriendo…" : "Confirmar reapertura"}
            </button>
            <button className={botonTenue} onClick={() => setPaso(null)}>
              Volver
            </button>
          </div>
        </div>
      )}

      {!paso && (
        <div className="flex gap-2 flex-wrap items-center">
          {clase.puedeOperar && !clase.suspendida && (
            <Link href={hrefAsistencia} className={botonPrimario}>
              Tomar asistencia
            </Link>
          )}
          {clase.puedeOperar && !clase.suspendida && (
            <button className={botonTenue} onClick={() => setPaso("suspender")}>
              Suspender esta clase
            </button>
          )}
          {clase.suspendida && (
            <button
              className={botonTenue}
              disabled={!clase.puedeOperar || clase.noSePuedeReabrir != null}
              onClick={() => setPaso("reabrir")}
            >
              Reabrir
            </button>
          )}
          {clase.tomada && (
            <Link href={hrefAsistencia} className={botonTenue}>
              Ver asistencia
            </Link>
          )}
        </div>
      )}
      {clase.suspendida && clase.noSePuedeReabrir && !paso && (
        <p className="text-sm text-[var(--peligro)]">{clase.noSePuedeReabrir}</p>
      )}

      {resultado && (
        <p className={resultado.ok ? "text-[var(--exito)]" : "text-[var(--peligro)]"} role={resultado.ok ? undefined : "alert"}>
          {resultado.texto}
        </p>
      )}

      <Link href="/cursos" className="text-sm text-[var(--primario)] underline hover:no-underline">
        Ver curso →
      </Link>
    </div>
  );
}
