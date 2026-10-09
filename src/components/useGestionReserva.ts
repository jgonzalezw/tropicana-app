"use client";

/**
 * La lógica de gestionar UNA reserva (extraída de `GestionReserva`, I-012 fase 2):
 * qué acción está elegida, los formularios de reprogramar, suspender y cortesía,
 * sus validaciones y las llamadas al servidor. Sin presentación: la dibujan
 * `GestionReserva` (pantallas actuales y /sala) y `nuevo/FilaReserva` (ficha de
 * Membresías). Mismo comportamiento que antes de extraerla.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatearHoras, opcionesDuracionReserva } from "@/lib/horarios";
import { validarTiempoReserva, type EstadoReserva } from "@/lib/reservas";
import type { AccionPendiente } from "@/lib/accionPendiente";
import {
  cambiarEstadoReserva,
  reprogramarReserva,
  cancelarAPedido,
  marcarCortesiaReserva,
  type ReservaConHistorial,
} from "@/app/(privado)/particulares/acciones";

export const ETIQUETA_DESTINO: Record<EstadoReserva, string> = {
  solicitada: "Solicitar",
  confirmada: "Confirmar",
  reprogramada: "Reprogramar",
  reagendar: "Cancelar",
  suspendida: "Suspender",
  ausente: "Marcar Ausente",
  realizada: "Marcar Realizada",
};

/** Cómo se llama cada acción según desde dónde se la pide. Cancelar (lo inicia
 *  el cliente) y Suspender (lo inicia la escuela) se ven distintos a propósito. */
export function etiquetaDestino(destino: EstadoReserva, actual: EstadoReserva, tipo: "particular" | "alquiler"): string {
  if (destino === "suspendida") return actual === "solicitada" ? "Rechazar solicitud" : "Suspender (lo decide la escuela)";
  if (destino === "reagendar") return "Cancelar (lo pidió el cliente)";
  if (destino === "ausente" && tipo === "alquiler") return "No se presentó";
  return ETIQUETA_DESTINO[destino];
}

/** El nombre de la acción en el botón primario de la barra fija: dice qué se va a hacer. */
export function etiquetaPrimaria(destino: EstadoReserva, actual: EstadoReserva, tipo: "particular" | "alquiler"): string {
  switch (destino) {
    case "confirmada":
      return "Confirmar reserva";
    case "reprogramada":
      return "Reprogramar reserva";
    case "reagendar":
      return "Confirmar cancelación del cliente";
    case "suspendida":
      return actual === "solicitada" ? "Rechazar solicitud" : "Suspender reserva";
    case "ausente":
      return tipo === "alquiler" ? "Marcar: no se presentó" : "Marcar ausente";
    case "realizada":
      return "Marcar realizada";
    default:
      return "Confirmar";
  }
}

/** Qué pasa si se confirma — se muestra ANTES de confirmar (Hito B, S4). */
export function efectoDestino(destino: EstadoReserva, actual: EstadoReserva): string {
  switch (destino) {
    case "confirmada":
      return "Se confirma: descuenta la hora del saldo y mantiene la sala y el profesor ocupados.";
    case "reagendar":
      return "Lo pidió el cliente: la hora vuelve al saldo y se libera la sala y el profesor. Si es fuera de plazo, queda como Ausente y consume la hora.";
    case "suspendida":
      return actual === "solicitada"
        ? "Se rechaza la solicitud: se libera la sala y el profesor, sin tocar el saldo. Se arma un aviso para el cliente."
        : "Lo decide la escuela: la hora vuelve al saldo (no consume) y se libera la sala y el profesor. Se arman avisos.";
    case "ausente":
      return "El cliente no vino: la hora se consume del saldo.";
    case "realizada":
      return "La clase se dio: la hora se consume del saldo.";
    default:
      return "";
  }
}

const ESTADOS_QUE_CONSUMEN: EstadoReserva[] = ["confirmada", "reprogramada", "ausente", "realizada"];

export type Aviso = { nombre: string; whatsapp: string | null; mensaje: string };
export type Resultado = { error?: string; mensaje?: string; avisoAlumno?: Aviso; avisoProfesor?: Aviso };

export function fechaHoraCorta(fecha: string, hora: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${DIAS[d.getDay()]} ${dd}/${mm} ${hora.slice(0, 5)}`;
}

/** "26/09/2026 01:22", siempre en hora de Bolivia — ver la nota de
 *  `ReservasDeMembresia.tsx` sobre por qué hace falta `timeZone`
 *  explícito y 24 h para no romper la hidratación entre server y cliente. */
const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
export function fechaHoraCompleta(iso: string): string {
  return FORMATO_FECHA_HORA.format(new Date(iso)).replace(",", "");
}

export function useGestionReserva({
  reserva,
  tipo = "particular",
  disponibleMin,
  salasPropias,
  salaExternaDeLaMembresia,
  incrementoMin,
  minimoMin,
  onCambio,
  onAccion,
}: {
  reserva: ReservaConHistorial;
  tipo?: "particular" | "alquiler";
  disponibleMin: number;
  salasPropias: { id: number; nombre: string }[];
  salaExternaDeLaMembresia?: { salaId: number; nombre: string } | null;
  incrementoMin: number;
  minimoMin: number;
  onCambio: () => void;
  onAccion?: (a: AccionPendiente | null) => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [accion, setAccion] = useState<EstadoReserva | null>(null);
  const [motivoSuspension, setMotivoSuspension] = useState("");
  const [abrirCortesia, setAbrirCortesia] = useState(false);
  const [motivoCortesia, setMotivoCortesia] = useState("");

  const todasLasDuraciones = useMemo(() => opcionesDuracionReserva(minimoMin), [minimoMin]);

  const salasReprogramar = useMemo(
    () => [
      ...salasPropias.map((s) => ({ id: s.id, nombre: s.nombre })),
      ...(salaExternaDeLaMembresia
        ? [{ id: salaExternaDeLaMembresia.salaId, nombre: `${salaExternaDeLaMembresia.nombre} (externa)` }]
        : []),
    ],
    [salasPropias, salaExternaDeLaMembresia]
  );

  /** Duraciones posibles al reprogramar: múltiplos del mínimo que entren en
   *  lo que ya ocupa esta reserva más lo que queda del paquete. */
  function duracionesReprogramar(): number[] {
    const tope = reserva.duracion_min + (ESTADOS_QUE_CONSUMEN.includes(reserva.estado) ? disponibleMin : 0);
    return todasLasDuraciones.filter((d) => d <= tope);
  }

  const [rFecha, setRFecha] = useState("");
  const [rHora, setRHora] = useState("");
  const [rDuracion, setRDuracion] = useState(minimoMin);
  const [rSalaId, setRSalaId] = useState<number | null>(null);

  function abrirReprogramar() {
    setResultado(null);
    const opciones = duracionesReprogramar();
    setAccion("reprogramada");
    setRFecha(reserva.fecha);
    setRHora(reserva.hora.slice(0, 5));
    // Una reserva vieja puede durar algo que hoy no es válido (p. ej. media
    // hora cargada antes de la regla del mínimo): se propone la primera
    // duración válida que la cubra, nunca un valor que la lista no muestra.
    setRDuracion(
      opciones.includes(reserva.duracion_min) ? reserva.duracion_min : (opciones.find((d) => d >= reserva.duracion_min) ?? opciones[0] ?? minimoMin)
    );
    setRSalaId(salasReprogramar.some((s) => s.id === reserva.sala_id) ? reserva.sala_id : (salasReprogramar[0]?.id ?? null));
  }

  function transicionar(destino: EstadoReserva, opciones?: { motivo?: string }) {
    setResultado(null);
    startTransition(async () => {
      const r = destino === "reagendar" ? await cancelarAPedido(reserva.id) : await cambiarEstadoReserva(reserva.id, destino, opciones);
      setResultado(r);
      if (!r.error) {
        setAccion(null);
        setMotivoSuspension("");
        onCambio();
      }
    });
  }

  /** Cortesía (H5): marcar con glosa obligatoria, o desmarcar sin pedirla. */
  function guardarCortesia(motivo: string | null) {
    setResultado(null);
    startTransition(async () => {
      const r = await marcarCortesiaReserva(reserva.id, motivo);
      setResultado(r);
      if (!r.error) {
        setAbrirCortesia(false);
        setMotivoCortesia("");
        onCambio();
      }
    });
  }

  function confirmarReprogramar() {
    setResultado(null);
    startTransition(async () => {
      const r = await reprogramarReserva({ reservaId: reserva.id, fecha: rFecha, hora: rHora, duracionMin: rDuracion, salaId: rSalaId! });
      setResultado(r);
      if (!r.error) {
        setAccion(null);
        onCambio();
      }
    });
  }

  const opcionesDur = accion === "reprogramada" ? duracionesReprogramar() : [];
  const faltaReprogramar =
    accion === "reprogramada"
      ? !rFecha
        ? "Elegí la fecha."
        : opcionesDur.length === 0
          ? `No quedan horas en el paquete para llevar esta reserva al mínimo de ${formatearHoras(minimoMin / 60)} h.`
          : (validarTiempoReserva({ hora: rHora, duracionMin: rDuracion, incrementoMin, minimoMin }) ?? (rSalaId == null ? "Elegí la sala." : null))
      : null;

  // ── Modo barra fija ────────────────────────────────────────────────────────
  const enBarra = !!onAccion;
  const etiquetaBarra = accion ? etiquetaPrimaria(accion, reserva.estado, tipo) : abrirCortesia ? "Guardar cortesía" : null;
  const faltaBarra = accion
    ? accion === "suspendida"
      ? motivoSuspension
        ? null
        : "Elegí el motivo de la suspensión."
      : accion === "reprogramada"
        ? faltaReprogramar
        : null
    : abrirCortesia && !motivoCortesia.trim()
      ? "Escribí el motivo de la cortesía."
      : null;
  const peligroBarra = accion === "reagendar" || accion === "suspendida";
  // La barra llama siempre a la última versión de estas funciones, sin que
  // cada tecla vuelva a publicar la acción.
  const ultima = useRef({ confirmar: () => {}, cancelar: () => {} });
  useEffect(() => {
    ultima.current = {
      confirmar: () => {
        if (accion === "reprogramada") confirmarReprogramar();
        else if (accion === "suspendida") transicionar("suspendida", { motivo: motivoSuspension });
        else if (accion) transicionar(accion);
        else guardarCortesia(motivoCortesia);
      },
      cancelar: () => {
        if (accion) setAccion(null);
        else {
          setAbrirCortesia(false);
          setMotivoCortesia("");
        }
      },
    };
  });
  useEffect(() => {
    if (!onAccion) return;
    onAccion(
      etiquetaBarra
        ? {
            etiqueta: etiquetaBarra,
            peligro: peligroBarra,
            puede: !faltaBarra,
            falta: faltaBarra,
            ejecutando: pendiente,
            confirmar: () => ultima.current.confirmar(),
            cancelar: () => ultima.current.cancelar(),
          }
        : null
    );
  }, [onAccion, etiquetaBarra, peligroBarra, faltaBarra, pendiente]);
  // Al desmontar (volver a la agenda) no queda ninguna acción colgada en la barra.
  useEffect(() => () => onAccion?.(null), [onAccion]);

  return {
    pendiente,
    resultado,
    accion,
    setAccion,
    motivoSuspension,
    setMotivoSuspension,
    abrirCortesia,
    setAbrirCortesia,
    motivoCortesia,
    setMotivoCortesia,
    rFecha,
    setRFecha,
    rHora,
    setRHora,
    rDuracion,
    setRDuracion,
    rSalaId,
    setRSalaId,
    opcionesDur,
    salasReprogramar,
    faltaReprogramar,
    enBarra,
    abrirReprogramar,
    transicionar,
    guardarCortesia,
    confirmarReprogramar,
    setResultado,
  };
}
