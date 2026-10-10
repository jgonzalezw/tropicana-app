/**
 * R20 · E2 — avisos de una VENTA que armaban en línea las acciones de
 * `inscribir/` (N03–N06), movidos tal cual a funciones puras. N01 y N02 ya eran
 * puras y siguen en `src/lib/venta/mensajeInscripcion.ts` (no se mueven).
 * Los textos, el orden y las rarezas se conservan carácter por carácter; las
 * referencias capturadas ANTES de moverlos (`__referencias__/ventas.json`) lo
 * prueban.
 *
 *  - N03 clase de prueba → titular o su tutor
 *  - N04 paquete particular → alumno o su tutor
 *  - N05 paquete particular → profesor
 *  - N06 alquiler de sala → titular o la persona que atiende a la organización
 *
 * Quién recibe cada aviso (`destinatarioAviso`, `destinatarioDeTitular`) y cuándo
 * NO corresponde (N02 solo si se cobró algo: `avisaRecibo`) lo decide el código.
 */
import { fechaLarga } from "../../inscripcion.ts";

/** N02 solo se manda si se cobró algo. */
export const avisaRecibo = (porPlata: number): boolean => porPlata > 0;

// ── N03 · clase de prueba ───────────────────────────────────────────────────
export const gentePrueba = (personas: number): string => (personas === 1 ? "1 persona" : `${personas} personas`);

/** Las clases de la prueba, por fecha: «Salsa el vie 9 oct». Las que no tienen fecha no se listan. */
export function clasesDePrueba(
  guardadas: { curso_id: number; fecha: string | null }[],
  nombreCurso: Map<number, string>
): string[] {
  return guardadas
    .filter((g) => g.fecha)
    .sort((x, y) => (x.fecha! < y.fecha! ? -1 : 1))
    .map((g) => `${nombreCurso.get(g.curso_id) ?? "curso"} el ${fechaLarga(new Date(g.fecha! + "T00:00:00"))}`);
}

export function mensajePrueba(d: {
  esMenor: boolean;
  quien: string;
  planNombre: string;
  personas: number;
  guardadas: { curso_id: number; fecha: string | null }[];
  nombreCurso: Map<number, string>;
}): string {
  const gente = gentePrueba(d.personas);
  const clases = clasesDePrueba(d.guardadas, d.nombreCurso);
  const sujetoP = d.esMenor ? `la clase de prueba de ${d.quien.trim()}` : "tu clase de prueba";
  return `Hola! Confirmamos ${sujetoP} (${d.planNombre}, ${gente}):${clases.length ? ` ${clases.join(" y ")}` : ""}. ¡Te esperamos!`;
}

// ── N04 / N05 · paquete particular ──────────────────────────────────────────
/** «El resto se coordina después» solo si de verdad queda algo del paquete sin agendar. */
export const restoCoordina = (leftoverMin?: number): string => (!!leftoverMin ? " El resto se coordina después." : "");

/** Cómo se presenta la agenda: en fija es toda; en flexible, solo la primera clase. */
export function introsDeAgenda(esFija: boolean, nSesiones: number): { introAlumno: string; introProfesor: string } {
  const introAlumno = esFija
    ? nSesiones === 1
      ? "Tu clase reservada es"
      : "Tus clases reservadas son"
    : "Tu primera clase reservada es";
  const introProfesor = esFija ? (nSesiones === 1 ? "La clase es" : "Las clases son") : "La primera clase es";
  return { introAlumno, introProfesor };
}

export function mensajesParticular(d: {
  horasContratadas: number;
  // `| undefined`: el generador original los imprimía tal cual aunque faltaran.
  planNombre: string | undefined;
  nombreProfesor: string | undefined;
  dondeTexto: string | undefined;
  esFija: boolean;
  nSesiones: number;
  agendaTexto: string;
  leftoverMin?: number;
  alumnoNombre: string;
}): { alumno: string; profesor: string } {
  const { introAlumno, introProfesor } = introsDeAgenda(d.esFija, d.nSesiones);
  const resto = restoCoordina(d.leftoverMin);
  return {
    alumno: `Hola! Confirmamos tu paquete de ${d.horasContratadas} h de clases particulares (${d.planNombre}) con ${d.nombreProfesor} en ${d.dondeTexto}. ${introAlumno}: ${d.agendaTexto}.${resto} ¡Te esperamos!`,
    profesor: `Hola! Se te agendó una clase particular (${d.planNombre}) con ${d.alumnoNombre || "un alumno"} en ${d.dondeTexto}. ${introProfesor}: ${d.agendaTexto}.${resto}`,
  };
}

// ── N06 · alquiler de sala ──────────────────────────────────────────────────
export const restoAlquiler = (leftoverMin?: number): string => (leftoverMin ? " El resto de las horas se coordina después." : "");

export function mensajeAlquiler(d: {
  planNombre: string | undefined;
  horas: number;
  dondeTexto: string | undefined;
  agendaTexto: string;
  leftoverMin?: number;
  contactoNombre: string;
  destinoNombre: string;
}): string {
  const resto = restoAlquiler(d.leftoverMin);
  return d.destinoNombre === d.contactoNombre
    ? `Hola! Confirmamos tu alquiler de sala (${d.planNombre}): ${d.horas} h en ${d.dondeTexto}. Reservado: ${d.agendaTexto}.${resto} ¡Te esperamos!`
    : `Hola! Confirmamos el alquiler de sala (${d.planNombre}) de ${d.contactoNombre}: ${d.horas} h en ${d.dondeTexto}. Reservado: ${d.agendaTexto}.${resto} ¡Los esperamos!`;
}
