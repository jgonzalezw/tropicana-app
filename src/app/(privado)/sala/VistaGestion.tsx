"use client";

/**
 * Vista de trabajo de /sala: gestionar UN slot sin salir de la pantalla
 * (decisión de Javier, 2026-10-02: "la gestión no saca de /sala"). Reemplaza al
 * panel lateral: ocupa la zona principal en lugar de la agenda, y una barra
 * fija al pie —igual que Precios o la venta— lleva **Volver · Cancelar · acción**.
 *
 *   cabecera (tipo, estado, fecha/hora, alcance) → datos → acciones
 *   (con su efecto visible) → resultado y avisos → barra fija
 *
 * Un solo esqueleto para todo tipo de slot; solo cambia el cuerpo:
 *   - reservas (particular, alquiler, externo): `GestionReserva` y las acciones
 *     de `particulares/acciones.ts`, en modo barra (`onAccion`);
 *   - cursos: `suspenderClase` / `reabrirSesion` de `asistencia/acciones.ts` (la
 *     MISMA implementación que usa Tomar asistencia).
 *
 * Una acción = un paso con efecto visible: elegir → ver el efecto → confirmar
 * (botón primario, con el nombre de la acción) o cancelar → resultado en esta
 * misma vista, con el detalle recargado.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import GestionReserva from "@/components/GestionReserva";
import AvisosAfectados from "@/components/AvisosAfectados";
import { obtenerReservaParaGestion, type DetalleGestionReserva } from "@/app/(privado)/particulares/acciones";
import {
  contextoAsistenciaCurso,
  obtenerClaseParaGestion,
  suspenderClase,
  reabrirSesion,
  type ClaseParaGestion,
} from "@/app/(privado)/asistencia/acciones";
import type { AccionPendiente } from "@/lib/accionPendiente";
import type { AvisoAlumno } from "@/lib/avisosClase";
import { finDelSlot, type SlotSala } from "@/lib/slotSala";
import { ETIQUETA_TIPO_SLOT } from "./SlotFila";

// La asistencia embebida es el MISMO ClienteAsistencia de /asistencia, cargado
// solo cuando se abre "Tomar asistencia" (la agenda no lo paga).
const ClienteAsistencia = dynamic(() => import("@/app/(privado)/asistencia/ClienteAsistencia"), {
  loading: () => <p className="text-base text-[var(--texto-tenue)]">Cargando asistencia…</p>,
});

const botonTenue =
  "px-4 py-2 text-base rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40 inline-block";
const botonPeligro =
  "px-4 py-2 text-base rounded-[var(--radio-control)] border border-[var(--peligro)] text-[var(--peligro)] hover:opacity-80 disabled:opacity-40 inline-block";
const enlace = "text-base text-[var(--primario)] underline hover:no-underline";

function fechaLarga(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-BO", { weekday: "long", day: "2-digit", month: "2-digit" });
}

export default function VistaGestion({
  slot,
  salasPropias,
  motivosSuspension,
  incrementoMin,
  minimoMin,
  onVolver,
  onCambio,
}: {
  slot: SlotSala;
  salasPropias: { id: number; nombre: string }[];
  motivosSuspension: { valor: string; etiqueta: string }[];
  incrementoMin: number;
  minimoMin: number;
  /** Volver a la agenda (el padre decide cómo: Atrás del historial o reemplazo). */
  onVolver: () => void;
  /** Tras una acción exitosa: el padre recarga la agenda que queda detrás. */
  onCambio: () => void;
}) {
  const [accion, setAccion] = useState<AccionPendiente | null>(null);
  // Hay un trabajo a medias (p. ej. asistencia sin guardar): Volver avisa.
  const [sinGuardar, setSinGuardar] = useState(false);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [recarga, setRecarga] = useState(0);

  // Modo enfoque: mientras esta vista está abierta el shell se atenúa (ver
  // globals.css) para que la barra de acciones sea lo único que pide atención.
  useEffect(() => {
    document.documentElement.dataset.modoEnfoque = "1";
    return () => {
      delete document.documentElement.dataset.modoEnfoque;
    };
  }, []);

  // Al volver el foco desde una pestaña que esta vista abrió (ficha, curso,
  // cobro), el detalle se recarga: pudo cambiar allá.
  const abrioExterno = useRef(false);
  const marcarExterno = useCallback(() => {
    abrioExterno.current = true;
  }, []);
  useEffect(() => {
    function alVolver() {
      if (!abrioExterno.current || document.visibilityState !== "visible") return;
      abrioExterno.current = false;
      setRecarga((n) => n + 1);
    }
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, []);

  function volver() {
    if (sinGuardar && !confirmandoSalida) {
      setConfirmandoSalida(true);
      return;
    }
    onVolver();
  }

  const alcance =
    slot.tipo === "curso" ? "Aplica solo a esta clase, fecha y hora" : "Aplica solo a esta reserva, fecha y hora";

  return (
    <div className="space-y-5">
      <button type="button" onClick={volver} className={enlace}>
        ← Volver a la agenda
      </button>

      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold px-2.5 py-1 rounded-full border border-[var(--borde)]">
            {ETIQUETA_TIPO_SLOT[slot.tipo]}
          </span>
          <span className="text-base font-semibold">
            <span aria-hidden="true">{slot.estado.icono} </span>
            {slot.estado.etiqueta}
          </span>
        </div>
        <h2 className="text-2xl font-semibold">{slot.titulo}</h2>
        <p className="text-lg capitalize">
          {fechaLarga(slot.fecha)} · {slot.hora}–{finDelSlot(slot.hora, slot.duracionMin)}
        </p>
        <p className="text-base text-[var(--texto-tenue)]">{alcance}</p>
      </header>

      <dl className="text-base space-y-1">
        {slot.titular && <Dato rotulo="Titular" valor={slot.titular} />}
        {slot.profesor && <Dato rotulo="Profesor" valor={slot.profesor} />}
        {slot.sustituto && <Dato rotulo="Relevo (informativo)" valor={slot.sustituto} />}
        {slot.personas != null && slot.personas > 1 && <Dato rotulo="Personas" valor={String(slot.personas)} />}
        {slot.lugar && <Dato rotulo="Lugar" valor={slot.lugar} />}
        {slot.notas && <Dato rotulo="Notas" valor={slot.notas} />}
      </dl>

      {slot.tipo === "curso" ? (
        <AccionesCurso
          slot={slot}
          recarga={recarga}
          onAccion={setAccion}
          onSinGuardar={setSinGuardar}
          onCambio={onCambio}
          onAbrirExterno={marcarExterno}
        />
      ) : slot.reservaId != null && slot.tipo !== "bloqueo" ? (
        <AccionesReserva
          slot={slot}
          recarga={recarga}
          salasPropias={salasPropias}
          motivosSuspension={motivosSuspension}
          incrementoMin={incrementoMin}
          minimoMin={minimoMin}
          onAccion={setAccion}
          onCambio={onCambio}
          onAbrirExterno={marcarExterno}
        />
      ) : (
        <p className="text-base text-[var(--texto-tenue)]">
          Un bloqueo se quita desde su fila con «Quitar bloqueo». Para cambiarlo, se quita y se crea otro.
        </p>
      )}

      <BarraGestion
        accion={accion}
        confirmandoSalida={confirmandoSalida}
        onVolver={volver}
        onSeguir={() => setConfirmandoSalida(false)}
        onSalir={onVolver}
      />
    </div>
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

// ── Barra fija ───────────────────────────────────────────────────────────────

/**
 * Cuánto tapa el teclado del celular: la barra sube con él para no esconder el
 * campo que se está escribiendo. Sin teclado (o sin `visualViewport`) vale 0.
 */
function useAlturaTeclado(): number {
  const [px, setPx] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function medir() {
      setPx(Math.max(0, Math.round(window.innerHeight - vv!.height - vv!.offsetTop)));
    }
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, []);
  return px;
}

function BarraGestion({
  accion,
  confirmandoSalida,
  onVolver,
  onSeguir,
  onSalir,
}: {
  accion: AccionPendiente | null;
  confirmandoSalida: boolean;
  onVolver: () => void;
  onSeguir: () => void;
  onSalir: () => void;
}) {
  const teclado = useAlturaTeclado();
  return (
    // Anclada al contenedor de contenido (sticky), no a la ventana: acompaña el
    // ancho de la pantalla y se apoya sobre la barra inferior del shell, sea la
    // que sea (`--shell-barra-inferior`, hoy 0). Sin medidas escritas a mano.
    <div
      className="sticky -mx-6 sm:-mx-8 mt-6 bg-[var(--fondo-panel)] border-t border-[var(--borde)] pt-3 z-10"
      style={{
        bottom: `calc(var(--shell-barra-inferior) + ${teclado}px)`,
        paddingBottom: teclado > 0 ? "0.75rem" : "calc(0.75rem + env(safe-area-inset-bottom))",
      }}
    >
      <div>
        <div className="px-6 sm:px-8 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[12rem] text-base" aria-live="polite">
            {confirmandoSalida ? (
              <span className="text-[var(--advertencia-texto)]" role="alert">
                Hay asistencia sin guardar. Si salís ahora se pierde.
              </span>
            ) : accion?.falta ? (
              <span className="text-[var(--texto-tenue)]">{accion.falta}</span>
            ) : accion ? (
              <span className="text-[var(--texto-tenue)]">Revisá el efecto y confirmá.</span>
            ) : (
              <span className="text-[var(--texto-tenue)]">Elegí una acción.</span>
            )}
          </div>
          {confirmandoSalida ? (
            <>
              <button type="button" onClick={onSeguir} className={botonTenue}>
                Seguir acá
              </button>
              <button type="button" onClick={onSalir} className={botonPeligro}>
                Salir sin guardar
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onVolver} className={botonTenue}>
                ← Volver
              </button>
              {accion && (
                <button type="button" onClick={accion.cancelar} disabled={accion.ejecutando} className={botonTenue}>
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={accion?.confirmar}
                disabled={!accion || !accion.puede || accion.ejecutando}
                className={`px-5 py-3 text-lg font-semibold rounded-[var(--radio-control)] text-[var(--primario-texto)] disabled:opacity-40 ${
                  accion?.peligro ? "bg-[var(--peligro)] hover:opacity-90" : "bg-[var(--primario)] hover:bg-[var(--primario-hover)]"
                }`}
              >
                {accion?.ejecutando ? "Guardando…" : (accion?.etiqueta ?? "Elegí una acción")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reservas ─────────────────────────────────────────────────────────────────

function AccionesReserva({
  slot,
  recarga,
  salasPropias,
  motivosSuspension,
  incrementoMin,
  minimoMin,
  onAccion,
  onCambio,
  onAbrirExterno,
}: {
  slot: SlotSala;
  recarga: number;
  salasPropias: { id: number; nombre: string }[];
  motivosSuspension: { valor: string; etiqueta: string }[];
  incrementoMin: number;
  minimoMin: number;
  onAccion: (a: AccionPendiente | null) => void;
  onCambio: () => void;
  onAbrirExterno: () => void;
}) {
  const [detalle, setDetalle] = useState<DetalleGestionReserva | { error: string } | null>(null);
  // Tras una acción el detalle se pide de nuevo: no queda con datos viejos.
  const [propia, setPropia] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerReservaParaGestion(slot.reservaId!).then((r) => {
      if (vigente) setDetalle(r);
    });
    return () => {
      vigente = false;
    };
  }, [slot.reservaId, recarga, propia]);

  if (!detalle) return <p className="text-base text-[var(--texto-tenue)]">Cargando…</p>;
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
        onAccion={onAccion}
        onAbrirExterno={onAbrirExterno}
        onCambio={() => {
          setPropia((n) => n + 1);
          onCambio();
        }}
      />
      {detalle.tipo === "alquiler" && (
        // El saldo del alquiler no viaja en este detalle: se ofrece el enlace a
        // Caja, que ya registra el cobro (ROADMAP: abrir directo la cuota con saldo).
        <Link href="/caja" target="_blank" rel="noopener noreferrer" onClick={onAbrirExterno} className={enlace}>
          Registrar cobro en Caja ↗
        </Link>
      )}
    </div>
  );
}

// ── Cursos ───────────────────────────────────────────────────────────────────

function AccionesCurso({
  slot,
  recarga,
  onAccion,
  onSinGuardar,
  onCambio,
  onAbrirExterno,
}: {
  slot: SlotSala;
  recarga: number;
  onAccion: (a: AccionPendiente | null) => void;
  /** Para la asistencia embebida (paso 4): avisa que hay marcas sin guardar y Volver pide confirmación. */
  onSinGuardar: (hay: boolean) => void;
  onCambio: () => void;
  onAbrirExterno: () => void;
}) {
  const [clase, setClase] = useState<ClaseParaGestion | { error: string } | null>(null);
  const [propia, setPropia] = useState(0);
  const [paso, setPaso] = useState<"suspender" | "reabrir" | null>(null);
  // Tomar/ver asistencia se resuelve en esta misma vista (ClienteAsistencia embebido).
  const [verAsistencia, setVerAsistencia] = useState(false);
  const cerrarAsistencia = useCallback(() => setVerAsistencia(false), []);
  const alCambiarAsistencia = useCallback(() => {
    setPropia((n) => n + 1);
    onCambio();
  }, [onCambio]);
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [avisos, setAvisos] = useState<AvisoAlumno[]>([]);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    let vigente = true;
    obtenerClaseParaGestion(slot.cursoId!, slot.fecha).then((r) => {
      if (vigente) setClase(r);
    });
    return () => {
      vigente = false;
    };
  }, [slot.cursoId, slot.fecha, recarga, propia]);

  const ejecutar = useRef<() => void>(() => {});
  useEffect(() => {
    ejecutar.current = () => {
      if (!paso) return;
      setResultado(null);
      setAvisos([]);
      startTransition(async () => {
        const r: { ok?: true; resumen?: string; avisos?: AvisoAlumno[]; error?: string } =
          paso === "suspender"
            ? await suspenderClase({ cursoId: slot.cursoId!, fecha: slot.fecha, motivo })
            : await reabrirSesion({ cursoId: slot.cursoId!, fecha: slot.fecha });
        if (r.error) {
          setResultado({ ok: false, texto: r.error });
          return;
        }
        setPaso(null);
        setMotivo("");
        setResultado({ ok: true, texto: r.resumen ?? "Clase reabierta." });
        setAvisos(r.avisos ?? []);
        setPropia((n) => n + 1);
        onCambio();
      });
    };
  });

  // La acción elegida, para la barra fija. Suspender es opcional en su motivo.
  useEffect(() => {
    onAccion(
      paso
        ? {
            etiqueta: paso === "suspender" ? "Suspender esta clase" : "Reabrir esta clase",
            peligro: paso === "suspender",
            puede: true,
            falta: null,
            ejecutando: pendiente,
            confirmar: () => ejecutar.current(),
            cancelar: () => setPaso(null),
          }
        : null
    );
  }, [paso, pendiente, onAccion]);
  useEffect(() => () => onAccion(null), [onAccion]);

  if (!clase) return <p className="text-base text-[var(--texto-tenue)]">Cargando…</p>;
  if ("error" in clase)
    return (
      <p className="text-[var(--peligro)]" role="alert">
        {clase.error}
      </p>
    );

  if (verAsistencia)
    return (
      <AsistenciaEmbebida
        slot={slot}
        onAccion={onAccion}
        onSinGuardar={onSinGuardar}
        alTerminar={cerrarAsistencia}
        alCambiar={alCambiarAsistencia}
      />
    );

  const plu = (n: number) => `${n} ${n === 1 ? "alumno mensual" : "alumnos mensuales"}`;

  return (
    <div className="space-y-4">
      {clase.suspendida && (
        <p className="text-base">
          Suspendida{clase.motivoSuspension ? `: ${clase.motivoSuspension}` : ""}. La sala está liberada.
        </p>
      )}
      {!clase.puedeOperar && clase.motivoNoOperar && (
        <p className="text-base text-[var(--texto-tenue)]">{clase.motivoNoOperar}</p>
      )}

      {paso === "suspender" && (
        <div className="space-y-2">
          <p className="text-base text-[var(--texto-tenue)]">
            Lo decide la escuela: no se computa asistencia y se corre el fin de ciclo de {plu(clase.alumnosMensuales)}.
            Los paquetes por clase se difieren solos. La sala queda libre. Se arman avisos para los alumnos y el profesor.
          </p>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional): feriado, profe ausente…"
            className="entrada"
          />
        </div>
      )}

      {paso === "reabrir" && (
        <p className="text-base text-[var(--texto-tenue)]">
          La clase vuelve a ocupar su horario y se restituye el fin de ciclo de los alumnos que se había corrido. Se arman
          avisos para ellos.
        </p>
      )}

      {!paso && (
        <div className="flex gap-2 flex-wrap items-center">
          {clase.puedeOperar && !clase.suspendida && (
            <button type="button" className={botonTenue} onClick={() => setVerAsistencia(true)}>
              Tomar asistencia
            </button>
          )}
          {clase.puedeOperar && !clase.suspendida && (
            <button type="button" className={botonPeligro} onClick={() => setPaso("suspender")}>
              Suspender esta clase
            </button>
          )}
          {clase.suspendida && (
            <button
              type="button"
              className={botonTenue}
              disabled={!clase.puedeOperar || clase.noSePuedeReabrir != null}
              onClick={() => setPaso("reabrir")}
            >
              Reabrir esta clase
            </button>
          )}
          {clase.tomada && (
            <button type="button" className={botonTenue} onClick={() => setVerAsistencia(true)}>
              Ver asistencia
            </button>
          )}
        </div>
      )}
      {clase.suspendida && clase.noSePuedeReabrir && !paso && (
        <p className="text-base text-[var(--peligro)]">{clase.noSePuedeReabrir}</p>
      )}

      {resultado && (
        <p className={resultado.ok ? "text-[var(--exito)]" : "text-[var(--peligro)]"} role={resultado.ok ? undefined : "alert"}>
          {resultado.texto}
        </p>
      )}
      <AvisosAfectados avisos={avisos} onCerrar={() => setAvisos([])} />

      <Link href="/cursos" target="_blank" rel="noopener noreferrer" onClick={onAbrirExterno} className={enlace}>
        Ver curso ↗
      </Link>
    </div>
  );
}

/**
 * La asistencia de ESTA clase dentro de la vista de trabajo: pide el contexto
 * del curso al abrir (el servidor aplica el mismo alcance que /asistencia) y
 * monta `ClienteAsistencia` en modo embebido, con el curso y la fecha fijos.
 */
function AsistenciaEmbebida({
  slot,
  onAccion,
  onSinGuardar,
  alTerminar,
  alCambiar,
}: {
  slot: SlotSala;
  onAccion: (a: AccionPendiente | null) => void;
  onSinGuardar: (hay: boolean) => void;
  alTerminar: () => void;
  alCambiar: () => void;
}) {
  type Contexto = Exclude<Awaited<ReturnType<typeof contextoAsistenciaCurso>>, { error: string }>;
  const [ctx, setCtx] = useState<Contexto | { error: string } | null>(null);

  useEffect(() => {
    let vigente = true;
    contextoAsistenciaCurso(slot.cursoId!).then((r) => {
      if (vigente) setCtx(r);
    });
    return () => {
      vigente = false;
    };
  }, [slot.cursoId]);

  // Lo sin guardar también se cuenta acá: volver a las acciones lo descartaría.
  const [hayMarcas, setHayMarcas] = useState(false);
  const [confirmandoVolver, setConfirmandoVolver] = useState(false);
  const alSinGuardar = useCallback(
    (hay: boolean) => {
      setHayMarcas(hay);
      onSinGuardar(hay);
    },
    [onSinGuardar]
  );
  const embebido = useMemo(
    () => ({ onAccion, onSinGuardar: alSinGuardar, alTerminar, alCambiar }),
    [onAccion, alSinGuardar, alTerminar, alCambiar]
  );

  return (
    <div className="space-y-4">
      {confirmandoVolver ? (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <span className="text-base">Hay asistencia sin guardar. Si volvés ahora se pierde.</span>
          <button type="button" className={botonTenue} onClick={() => setConfirmandoVolver(false)}>
            Seguir acá
          </button>
          <button type="button" className={botonPeligro} onClick={alTerminar}>
            Salir sin guardar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => (hayMarcas ? setConfirmandoVolver(true) : alTerminar())} className={enlace}>
          ← Volver a las acciones de la clase
        </button>
      )}
      {!ctx ? (
        <p className="text-base text-[var(--texto-tenue)]">Cargando…</p>
      ) : "error" in ctx ? (
        <p className="text-[var(--peligro)]" role="alert">
          {ctx.error}
        </p>
      ) : (
        <ClienteAsistencia
          cursos={ctx.cursos}
          alumnosPorCurso={ctx.alumnosPorCurso}
          mostrarDeuda={ctx.mostrarDeuda}
          minRetroIso={ctx.minRetroIso}
          puedeEditar={ctx.puedeEditar}
          cursoInicialId={slot.cursoId}
          fechaInicial={slot.fecha}
          embebido={embebido}
        />
      )}
    </div>
  );
}
