/**
 * R20 · E2 — avisos de una CLASE DE CURSO que cambió (N19–N21), movidos tal cual
 * desde `src/lib/avisosClase.ts` y `asistencia/acciones.ts` (`reabrirSesion`).
 * Funciones puras: ni base de datos ni efectos. Los textos, el orden y los
 * respaldos de nombre se conservan carácter por carácter; las referencias
 * capturadas ANTES de moverlos (`__referencias__/clases.json`) lo prueban.
 *
 *  - N19 clase suspendida → alumno (o su tutor)
 *  - N20 clase suspendida → profesor titular (el cierre de sala C5 no lo emite)
 *  - N21 clase restablecida → alumno (o su tutor)
 *
 * Quién recibe cada aviso y cuándo NO corresponde (sin profesor, sin contacto,
 * sin alumnos afectados, la clase no estaba suspendida) lo deciden `armar…`.
 */
import { fechaLarga } from "../../inscripcion.ts";

/** Un aviso listo para mandar. `id` es solo la clave de React. */
export type AvisoAlumno = { id: string; nombre: string; whatsapp: string | null; mensaje: string };

export type ClaseSuspendida = {
  curso: string;
  fecha: string;
  finCicloNuevo: string | null;
  /** Ya dicho con su etiqueta del catálogo, nunca la clave cruda. */
  motivoTexto: string;
};

export type ContactoAviso = { nombre: string; nombrePila: string; whatsapp: string | null };

export function fmtLarga(iso: string): string {
  return fechaLarga(new Date(iso.slice(0, 10) + "T00:00:00"));
}

/** El aviso al alumno cuando una o más de sus clases quedaron suspendidas. */
export function mensajeSuspension(e: { nombrePila: string; clases: ClaseSuspendida[] }): string {
  const { clases } = e;
  const detalle = clases.map((cl) => `${cl.curso} del ${fmtLarga(cl.fecha)}`).join(clases.length > 1 ? ", " : "");
  const finCiclo = clases.find((cl) => cl.finCicloNuevo)?.finCicloNuevo;
  // El motivo que se lee es el de la primera clase: en el uso real se guarda
  // una excepción por vez, así que las clases de un mismo aviso comparten motivo.
  const partes = [
    `Hola ${e.nombrePila}! Te avisamos que tu clase de ${detalle} qued${
      clases.length > 1 ? "aron suspendidas" : "ó suspendida"
    } por ${clases[0].motivoTexto}.`,
  ];
  if (finCiclo) partes.push(`Tu ciclo se corrió: ahora vence el ${fmtLarga(finCiclo)}.`);
  partes.push("Cualquier duda, escribinos por acá. ¡Gracias!");
  return partes.join(" ");
}

/** El aviso al alumno cuando una clase suspendida se restableció. */
export function mensajeReapertura(e: {
  nombrePila: string;
  curso: string;
  fecha: string;
  finCiclo: string | null;
}): string {
  const partes = [
    `Hola ${e.nombrePila}! Te avisamos que tu clase de ${e.curso} del ${fmtLarga(e.fecha)} se restableció: se dicta con normalidad.`,
  ];
  if (e.finCiclo) partes.push(`Tu ciclo vuelve a vencer el ${fmtLarga(e.finCiclo)}.`);
  partes.push("Cualquier duda, escribinos por acá. ¡Gracias!");
  return partes.join(" ");
}

/** El aviso al profesor titular de una clase que se suspendió. */
export function mensajeSuspensionProfesor(e: {
  nombrePila: string;
  curso: string;
  fecha: string;
  motivoTexto: string;
}): string {
  return `Hola ${e.nombrePila}! Te avisamos que la clase de ${e.curso} del ${fmtLarga(e.fecha)} quedó suspendida por ${e.motivoTexto}. No hace falta que la dictes.`;
}

/** Avisos de suspensión para varios alumnos, ordenados por nombre (N19). */
export function armarAvisosSuspension(
  datos: Map<number, ContactoAviso>,
  porAlumno: Map<number, ClaseSuspendida[]>,
  redactar: typeof mensajeSuspension = mensajeSuspension
): AvisoAlumno[] {
  const avisos: AvisoAlumno[] = [];
  for (const [alumnoId, clases] of porAlumno) {
    const c = datos.get(alumnoId);
    const nombre = c?.nombre ?? `Alumno #${alumnoId}`;
    avisos.push({
      id: `curso-${alumnoId}`,
      nombre,
      whatsapp: c?.whatsapp ?? null,
      mensaje: redactar({ nombrePila: c?.nombrePila ?? nombre, clases }),
    });
  }
  return avisos.sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
}

/** El profesor leído de la base (`null` si no se encontró). */
export type ProfesorDeAviso = {
  id: number;
  contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null;
} | null;

/** El aviso al profesor titular (N20); `null` si no hay titular o no tiene contacto. */
export function armarAvisoProfesor(
  profesorId: number | null,
  p: ProfesorDeAviso,
  e: { curso: string; fecha: string; motivoTexto: string },
  redactar: typeof mensajeSuspensionProfesor = mensajeSuspensionProfesor
): AvisoAlumno | null {
  if (profesorId == null) return null;
  if (!p?.contacto) return null;
  const nombre = `${p.contacto.nombre ?? ""} ${p.contacto.apellido ?? ""}`.trim() || `Profesor #${p.id}`;
  return {
    id: `profesor-${p.id}`,
    nombre,
    whatsapp: p.contacto.whatsapp,
    mensaje: redactar({ nombrePila: p.contacto.nombre ?? nombre, ...e }),
  };
}

/** ¿Corresponde avisar que la clase se restableció? Solo si estaba suspendida y a alguien se le había corrido el ciclo. */
export function avisaReapertura(
  estabaSuspendida: boolean,
  r: { alumnosRestablecidos: { alumnoId: number; finCiclo: string | null }[] }
): boolean {
  return estabaSuspendida && r.alumnosRestablecidos.length > 0;
}

/** Avisos de «se restableció» (N21); vacío si no corresponde avisar. */
export function armarAvisosReapertura(
  estabaSuspendida: boolean,
  r: { alumnosRestablecidos: { alumnoId: number; finCiclo: string | null }[] },
  curso: { nombre: string } | null,
  datos: Map<number, ContactoAviso>,
  args: { fecha: string },
  redactar: typeof mensajeReapertura = mensajeReapertura
): AvisoAlumno[] {
  let avisos: AvisoAlumno[] = [];
  if (avisaReapertura(estabaSuspendida, r)) {
    const cursoNombre = curso?.nombre ?? "tu curso";
    avisos = r.alumnosRestablecidos
      .map((x): AvisoAlumno => {
        const c = datos.get(x.alumnoId);
        const nombre = c?.nombre ?? `Alumno #${x.alumnoId}`;
        return {
          id: `curso-${x.alumnoId}`,
          nombre,
          whatsapp: c?.whatsapp ?? null,
          mensaje: redactar({ nombrePila: c?.nombrePila ?? nombre, curso: cursoNombre, fecha: args.fecha, finCiclo: x.finCiclo }),
        };
      })
      .sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
  }
  return avisos;
}
