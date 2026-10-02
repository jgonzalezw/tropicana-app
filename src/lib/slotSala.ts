/**
 * El slot estándar de /sala (Hito B, S3): una sola forma para todo lo que
 * aparece en la agenda del día, sea cual sea su origen (curso, particular,
 * alquiler, taller, bloqueo o agendamiento externo). La pantalla pinta esto y
 * nada más; cada origen solo sabe armar su slot.
 *
 * **Funciones puras, sin base de datos.** Quien llama (`consultarDisponibilidad`)
 * lee con relaciones anidadas y le entrega a estas funciones lo ya leído: nada
 * se consulta por fila. El ESTADO del slot es el de la reserva o la sesión,
 * nunca el de la membresía.
 *
 * Un tipo nuevo es una entrada más en `TipoSlot` y su armador: en H8 una
 * reserva de taller cuelga de un plan (`planId`), no de una membresía.
 */

import { aMinutos } from "./horarios.ts";

export type TipoSlot = "curso" | "particular" | "alquiler" | "taller" | "bloqueo" | "externo";

export type TonoEstado = "neutro" | "ambar" | "exito" | "peligro" | "tenue";

export type EstadoSlot = {
  clave: string;
  /** Texto que se muestra: el estado va siempre con texto + icono + color. */
  etiqueta: string;
  icono: string;
  tono: TonoEstado;
};

export type SesionSlot = { estado: string; profesorId: number | null; titularId: number | null };

export type SlotSala = {
  /** Estable dentro del día: `r-<reservaId>` o `c-<cursoId>`. */
  clave: string;
  tipo: TipoSlot;
  fecha: string;
  /** `HH:MM` */
  hora: string;
  duracionMin: number;
  titulo: string;
  estado: EstadoSlot;
  titular: string | null;
  profesor: string | null;
  /** Solo informativo (quién dictó una clase con relevo). */
  sustituto: string | null;
  cursoNombre: string | null;
  /** "Pareja/Grupo (n)" — personas esperadas, si se sabe. */
  personas: number | null;
  /** Dónde, si es un lugar externo. */
  lugar: string | null;
  notas: string | null;
  detalle: string | null;
  cursoId: number | null;
  reservaId: number | null;
  membresiaId: number | null;
  /** Un taller cuelga de un plan, no de una membresía (H8). */
  planId: number | null;
  /** Calculado en el servidor con el permiso y el alcance de ese tipo. */
  gestionable: boolean;
  /** Clase suspendida: se ve atenuada y no cuenta como ocupación. */
  atenuado: boolean;
};

/** Cuántas horas antes de su inicio una solicitud pasa a urgente. Constante con
 *  nombre y no parámetro: pasarlo a parámetro exige migración (ROADMAP). */
export const UMBRAL_URGENCIA_HORAS = 24;

const ESTADOS_RESERVA: Record<string, Omit<EstadoSlot, "clave">> = {
  solicitada: { etiqueta: "Solicitada", icono: "⏳", tono: "ambar" },
  confirmada: { etiqueta: "Confirmada", icono: "✔", tono: "exito" },
  reprogramada: { etiqueta: "Reprogramada", icono: "↻", tono: "exito" },
  ausente: { etiqueta: "Ausente", icono: "✖", tono: "peligro" },
  realizada: { etiqueta: "Realizada", icono: "✔", tono: "tenue" },
  reagendar: { etiqueta: "Reagendar", icono: "↺", tono: "tenue" },
  suspendida: { etiqueta: "Suspendida", icono: "⏸", tono: "tenue" },
};

export function estadoDeReserva(estado: string): EstadoSlot {
  const e = ESTADOS_RESERVA[estado];
  return e ? { clave: estado, ...e } : { clave: estado, etiqueta: estado, icono: "•", tono: "neutro" };
}

/** Un bloqueo no tiene máquina de estados: está o no está. */
export const ESTADO_BLOQUEO: EstadoSlot = { clave: "bloqueo", etiqueta: "Bloqueado", icono: "⛔", tono: "peligro" };

export function estadoDeCurso(e: { suspendida: boolean; sesion: SesionSlot | null }): EstadoSlot {
  if (e.suspendida) return { clave: "suspendida", etiqueta: "Suspendida · sala liberada", icono: "⏸", tono: "tenue" };
  const s = e.sesion;
  if (!s) return { clave: "programada", etiqueta: "Programada", icono: "🗓", tono: "neutro" };
  if (s.profesorId != null && s.titularId != null && s.profesorId !== s.titularId)
    return { clave: "con_relevo", etiqueta: "Con relevo", icono: "⇄", tono: "ambar" };
  return { clave: "tomada", etiqueta: "Asistencia tomada", icono: "✔", tono: "exito" };
}

export function finDelSlot(hora: string, duracionMin: number): string {
  const m = (aMinutos(hora) ?? 0) + duracionMin;
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function aFecha(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora.slice(0, 5)}:00`);
}

/** Un slot que, por su estado, espera una respuesta de la escuela. */
export function porResponder(s: SlotSala): boolean {
  return s.estado.clave === "solicitada";
}

/** Urgente: una solicitud que empieza en menos de `UMBRAL_URGENCIA_HORAS`. */
export function esUrgente(s: SlotSala, ahora: Date): boolean {
  if (!porResponder(s)) return false;
  const horas = (aFecha(s.fecha, s.hora).getTime() - ahora.getTime()) / 3_600_000;
  return horas < UMBRAL_URGENCIA_HORAS;
}

/**
 * Por cerrar: su hora de FIN ya pasó y nadie dijo cómo terminó. Un curso sigue
 * "Programada" (sin asistencia tomada); una particular o un alquiler siguen
 * Confirmada/Reprogramada (sin Realizada/Ausente). Un slot suspendido, un
 * bloqueo o un externo ya resuelto no cuentan.
 */
export function porCerrar(s: SlotSala, ahora: Date): boolean {
  if (aFecha(s.fecha, finDelSlot(s.hora, s.duracionMin)).getTime() > ahora.getTime()) return false;
  if (s.tipo === "curso") return s.estado.clave === "programada";
  if (s.tipo === "bloqueo") return false;
  return ["confirmada", "reprogramada"].includes(s.estado.clave);
}

export type ResumenAgenda = {
  solicitudes: number;
  urgentes: number;
  porCerrar: number;
};

export function resumirAgenda(slots: SlotSala[], ahora: Date): ResumenAgenda {
  let solicitudes = 0;
  let urgentes = 0;
  let cerrar = 0;
  for (const s of slots) {
    if (porResponder(s)) {
      solicitudes++;
      if (esUrgente(s, ahora)) urgentes++;
    } else if (porCerrar(s, ahora)) cerrar++;
  }
  return { solicitudes, urgentes, porCerrar: cerrar };
}

/** El botón primario de la fila existe solo si hay algo pendiente. */
export function accionPendiente(s: SlotSala, ahora: Date): string | null {
  if (!s.gestionable) return null;
  if (porResponder(s)) return "Responder";
  if (porCerrar(s, ahora)) return s.tipo === "curso" ? "Tomar asistencia" : "Cerrar";
  return null;
}

export type FiltroAgenda = "todo" | "solicitudes" | "por_cerrar";

export function filtrarSlots(slots: SlotSala[], filtro: FiltroAgenda, ahora: Date): SlotSala[] {
  if (filtro === "solicitudes") return slots.filter(porResponder);
  if (filtro === "por_cerrar") return slots.filter((s) => !porResponder(s) && porCerrar(s, ahora));
  return slots;
}

// ── Armadores (uno por origen) ──────────────────────────────────────────────

export type ContactoSlot = {
  tipo?: string | null;
  nombre: string | null;
  apellido: string | null;
  razon_social?: string | null;
} | null;

export function nombreTitular(c: ContactoSlot | undefined): string | null {
  if (!c) return null;
  if (c.tipo === "organizacion") return c.razon_social?.trim() || null;
  return `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim() || null;
}

const SLOT_BASE = {
  sustituto: null,
  cursoNombre: null,
  personas: null,
  lugar: null,
  notas: null,
  detalle: null,
  cursoId: null,
  reservaId: null,
  membresiaId: null,
  planId: null,
  gestionable: false,
  atenuado: false,
  titular: null,
  profesor: null,
} as const;

export function slotDeCurso(e: {
  cursoId: number;
  fecha: string;
  hora: string;
  duracionMin: number;
  cursoNombre: string;
  titularNombre: string | null;
  suspendida: boolean;
  sesion: SesionSlot | null;
  /** Quién dictó, si fue alguien distinto del titular. */
  sustitutoNombre: string | null;
  gestionable: boolean;
}): SlotSala {
  return {
    ...SLOT_BASE,
    clave: `c-${e.cursoId}`,
    tipo: "curso",
    fecha: e.fecha,
    hora: e.hora.slice(0, 5),
    duracionMin: e.duracionMin,
    titulo: e.cursoNombre,
    cursoNombre: e.cursoNombre,
    estado: estadoDeCurso({ suspendida: e.suspendida, sesion: e.sesion }),
    profesor: e.titularNombre,
    sustituto: e.suspendida ? null : e.sustitutoNombre,
    cursoId: e.cursoId,
    gestionable: e.gestionable,
    atenuado: e.suspendida,
  };
}

export function slotDeReserva(e: {
  reservaId: number;
  tipo: "particular" | "alquiler" | "taller" | "bloqueo";
  fecha: string;
  hora: string;
  duracionMin: number;
  estado: string;
  /** Texto principal ya resuelto (estilo, motivo del bloqueo...). */
  titulo: string;
  titular: string | null;
  profesor: string | null;
  /** Personas del grupo (1 = individual). */
  personas: number | null;
  notas: string | null;
  detalle: string | null;
  membresiaId: number | null;
  planId?: number | null;
  gestionable: boolean;
}): SlotSala {
  return {
    ...SLOT_BASE,
    clave: `r-${e.reservaId}`,
    tipo: e.tipo,
    fecha: e.fecha,
    hora: e.hora.slice(0, 5),
    duracionMin: e.duracionMin,
    titulo: e.titulo,
    estado: e.tipo === "bloqueo" ? ESTADO_BLOQUEO : estadoDeReserva(e.estado),
    titular: e.titular,
    profesor: e.profesor,
    personas: e.personas,
    notas: e.notas,
    detalle: e.detalle,
    reservaId: e.reservaId,
    membresiaId: e.membresiaId,
    planId: e.planId ?? null,
    gestionable: e.gestionable,
  };
}

export function slotExterno(e: {
  reservaId: number;
  tipo: "particular" | "alquiler";
  fecha: string;
  hora: string;
  duracionMin: number;
  estado: string;
  lugar: string;
  titular: string | null;
  profesor: string | null;
  personas: number | null;
  membresiaId: number | null;
  gestionable: boolean;
}): SlotSala {
  return {
    ...SLOT_BASE,
    clave: `r-${e.reservaId}`,
    tipo: "externo",
    fecha: e.fecha,
    hora: e.hora.slice(0, 5),
    duracionMin: e.duracionMin,
    titulo: e.lugar,
    estado: estadoDeReserva(e.estado),
    titular: e.titular,
    profesor: e.profesor,
    personas: e.personas,
    lugar: e.lugar,
    detalle: e.tipo === "alquiler" ? "Alquiler" : "Clase particular",
    reservaId: e.reservaId,
    membresiaId: e.membresiaId,
    gestionable: e.gestionable,
  };
}
