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
