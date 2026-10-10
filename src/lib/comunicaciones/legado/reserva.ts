/**
 * R20 · E2 — textos de los avisos de una reserva, movidos TAL CUAL desde
 * `particulares/acciones.ts` para poder probarlos sin base de datos.
 *
 * No cambia ningún texto: cada función conserva, carácter por carácter, lo que
 * armaba la acción (las rarezas incluidas: «a ?» sin duración, «Hola!» sin
 * apertura, etc.). La equivalencia se prueba contra las referencias capturadas
 * ANTES de mover el código (`__referencias__/`). Las mejoras editoriales llegan
 * después, como versiones publicadas del contenido, no editando esto.
 *
 * El contexto (a quién se avisa, qué lugar, qué saldo) lo sigue resolviendo
 * `contextoAviso` en el servidor: acá solo se compone el texto.
 */
import { formatearHoras, horaFin } from "../../horarios.ts";

export function fechaHoraCorta(fecha: string, hora: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${DIAS[d.getDay()]} ${dd}/${mm} ${hora.slice(0, 5)}`;
}

/** "vie 02/10 de 15:00 a 16:00" — el mismo formato que usa la inscripción. */
export function horario(fecha: string, hora: string, duracionMin: number): string {
  return `${fechaHoraCorta(fecha, hora).slice(0, -6)} de ${hora.slice(0, 5)} a ${horaFin(hora, duracionMin) ?? "?"}`;
}

/** Minutos → horas como las muestran los avisos: "7.5", "10". */
export const h = (min: number) => formatearHoras(min / 60);

/** Lo que `saldoTexto` necesita de un contexto de aviso. */
export type SaldoDeAviso = { paquete: string; disponibleMin: number; contratadasMin: number };

export const saldoTexto = (c: SaldoDeAviso) => `Te quedan ${h(c.disponibleMin)} h de tu ${c.paquete} de ${h(c.contratadasMin)} h.`;

/** Los fragmentos que todos los avisos de reserva comparten. */
export type TextosDeReserva = {
  planNombre: string;
  /** "tu clase particular (Plan) con Prof" / "tu alquiler de sala (Plan)". */
  tuClase: string;
  /** Lo mismo sin el profesor: para "del vie 02/10 …". */
  tuClaseCorta: string;
  /** "paquete" o "alquiler": cómo se llama lo que se va gastando. */
  paquete: string;
  alumnoNombre: string;
};

export function textosDeReserva(e: {
  esAlquiler: boolean;
  /** `membresias.plan.nombre`, tal como viene de la base (puede faltar). */
  planNombre: string | null | undefined;
  profesorNombre: string;
  /** El nombre ya compuesto, antes del respaldo «el alumno» / «el titular». */
  alumnoNombre: string;
}): TextosDeReserva {
  const { esAlquiler, profesorNombre, alumnoNombre } = e;
  const planNombre = e.planNombre ?? (esAlquiler ? "alquiler de sala" : "clases particulares");
  return {
    planNombre,
    tuClase: esAlquiler ? `tu alquiler de sala (${planNombre})` : `tu clase particular (${planNombre}) con ${profesorNombre}`,
    tuClaseCorta: esAlquiler ? `tu alquiler de sala (${planNombre})` : `tu clase particular (${planNombre})`,
    paquete: esAlquiler ? "alquiler" : "paquete",
    alumnoNombre: alumnoNombre || (esAlquiler ? "el titular" : "el alumno"),
  };
}

/** N09 · reserva confirmada, al alumno o titular. */
export function mensajeReservaConfirmadaAlumno(
  c: Pick<TextosDeReserva, "tuClase"> & SaldoDeAviso,
  cuando: string,
  lugar: string
): string {
  return `Hola! Confirmamos ${c.tuClase}: ${cuando}, en ${lugar}. ${saldoTexto(c)} ¡Te esperamos!`;
}

/** N10 · reserva confirmada, al profesor. */
export function mensajeReservaConfirmadaProfesor(
  c: Pick<TextosDeReserva, "planNombre" | "alumnoNombre">,
  cuando: string,
  lugar: string
): string {
  return `Hola! Se te confirmó una clase particular (${c.planNombre}) con ${c.alumnoNombre}: ${cuando}, en ${lugar}.`;
}

// ── Resto de los avisos de reserva (R20 · E2 · H3) ─────────────────────────────
// Movidos tal cual desde `particulares/acciones.ts`. Mismas reglas que arriba:
// ni un carácter distinto del original (las rarezas incluidas, p. ej. «Tu alquiler
// … quedó suspendida», o «Te quedan…» en mayúscula tras los dos puntos).

type AvisoPersona = { nombre: string; whatsapp: string | null; mensaje: string };

/** El contexto que arma `contextoAviso` en el servidor. */
export type ContextoDeAviso = Pick<TextosDeReserva, "tuClase" | "tuClaseCorta" | "paquete" | "alumnoNombre" | "planNombre"> &
  SaldoDeAviso & {
    destinatario: { nombre: string; whatsapp: string | null } | null;
    profesor: { nombre: string; whatsapp: string | null };
  };

/**
 * Cuándo corresponde un aviso: sin contexto no hay ninguno; al alumno o titular solo
 * si hay destinatario; al profesor solo si la membresía tiene uno (el alquiler no).
 */
export function avisosDeReserva(
  c: ContextoDeAviso | null,
  alumno: string,
  profesor: string
): { avisoAlumno?: AvisoPersona; avisoProfesor?: AvisoPersona } {
  if (!c) return {};
  return {
    avisoAlumno: c.destinatario ? { nombre: c.destinatario.nombre, whatsapp: c.destinatario.whatsapp, mensaje: alumno } : undefined,
    avisoProfesor: c.profesor.nombre ? { nombre: c.profesor.nombre, whatsapp: c.profesor.whatsapp, mensaje: profesor } : undefined,
  };
}

/** Un cambio de estado de una reserva solo avisa si le importa a alguien afuera del sistema. */
export function avisaCambioDeEstado(destino: string): boolean {
  return destino === "confirmada" || destino === "suspendida";
}

type ParaAlumno = Pick<ContextoDeAviso, "tuClase" | "tuClaseCorta" | "paquete" | "disponibleMin" | "contratadasMin">;
type ParaProfesor = Pick<ContextoDeAviso, "planNombre" | "alumnoNombre">;

const mayusculaInicial = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** N07 · reserva solicitada, al alumno o titular. */
export function mensajeReservaSolicitadaAlumno(c: Pick<ContextoDeAviso, "tuClase">, cuando: string, lugar: string): string {
  return `Hola! Estamos coordinando ${c.tuClase} para el ${cuando}, en ${lugar}. Te la confirmamos a la brevedad.`;
}
/** N08 · reserva solicitada, al profesor. */
export function mensajeReservaSolicitadaProfesor(c: ParaProfesor, cuando: string, lugar: string): string {
  return `Hola! Estamos coordinando una clase particular (${c.planNombre}) con ${c.alumnoNombre} para el ${cuando}, en ${lugar}. ¿Te queda bien? Te confirmamos.`;
}

/** N11 · reserva suspendida, al alumno o titular. `motivo` viene de la lista, de C5 o de un bloqueo. */
export function mensajeReservaSuspendidaAlumno(c: ParaAlumno, cuando: string, motivo: string | null): string {
  return `Hola! ${mayusculaInicial(c.tuClaseCorta)} del ${cuando} quedó suspendida (${motivo}). Esa hora vuelve a tu ${c.paquete}: ${saldoTexto(c)} Coordinamos una nueva fecha.`;
}
/** N12 · reserva suspendida, al profesor. */
export function mensajeReservaSuspendidaProfesor(c: ParaProfesor, cuando: string, lugar: string, motivo: string | null): string {
  return `Hola! La clase particular (${c.planNombre}) con ${c.alumnoNombre} del ${cuando}, en ${lugar}, quedó suspendida (${motivo}).`;
}

/** N13 · reserva restablecida, al alumno o titular. */
export function mensajeReservaRestablecidaAlumno(c: ParaAlumno, cuando: string, lugar: string): string {
  return `Hola! Se restableció ${c.tuClase}: ${cuando}, en ${lugar}. ${saldoTexto(c)} ¡Te esperamos!`;
}
/** N14 · reserva restablecida, al profesor. */
export function mensajeReservaRestablecidaProfesor(c: ParaProfesor, cuando: string, lugar: string): string {
  return `Hola! Se restableció una clase particular (${c.planNombre}) con ${c.alumnoNombre}: ${cuando}, en ${lugar}.`;
}

/** N15 · reserva reprogramada, al alumno o titular. */
export function mensajeReservaReprogramadaAlumno(c: ParaAlumno, antes: string, ahoraEs: string, lugar: string): string {
  return `Hola! Reprogramamos ${c.tuClase}: pasa del ${antes} al ${ahoraEs}, en ${lugar}. ${saldoTexto(c)} ¡Te esperamos!`;
}
/** N16 · reserva reprogramada, al profesor. */
export function mensajeReservaReprogramadaProfesor(c: ParaProfesor, antes: string, ahoraEs: string, lugar: string): string {
  return `Hola! Se reprogramó la clase particular (${c.planNombre}) con ${c.alumnoNombre}: pasa del ${antes} al ${ahoraEs}, en ${lugar}.`;
}

/** N17 · cancelada a pedido, FUERA de plazo, al alumno o titular. */
export function mensajeCanceladaFueraDePlazoAlumno(c: ParaAlumno, cuando: string, plazoHoras: number): string {
  return `Hola! Registramos la cancelación de ${c.tuClaseCorta} del ${cuando}. Como fue con menos de ${plazoHoras} h de anticipación, esa hora se descuenta del ${c.paquete}. ${saldoTexto(c)}`;
}
/** N18 · cancelada a pedido, FUERA de plazo, al profesor. */
export function mensajeCanceladaFueraDePlazoProfesor(c: ParaProfesor, cuando: string, lugar: string): string {
  return `Hola! ${c.alumnoNombre} canceló fuera de plazo la clase particular (${c.planNombre}) del ${cuando}, en ${lugar}. Ya no hace falta que vayas.`;
}
/** N17 · cancelada a pedido, EN plazo, al alumno o titular. */
export function mensajeCanceladaEnPlazoAlumno(c: ParaAlumno, cuando: string): string {
  return `Hola! Cancelamos ${c.tuClaseCorta} del ${cuando}, como pediste. Esa hora vuelve a tu ${c.paquete}: ${saldoTexto(c)} Coordinamos una nueva fecha.`;
}
/** N18 · cancelada a pedido, EN plazo, al profesor. */
export function mensajeCanceladaEnPlazoProfesor(c: ParaProfesor, cuando: string, lugar: string): string {
  return `Hola! Se canceló a pedido del alumno la clase particular (${c.planNombre}) con ${c.alumnoNombre} del ${cuando}, en ${lugar}.`;
}
