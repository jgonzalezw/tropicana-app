/**
 * Los textos de WhatsApp de una inscripción a un plan regular (I-001): la
 * confirmación para el alumno y el recibo del cobro. Son puras: reciben los
 * datos ya guardados y devuelven el texto, para poder probarlas sin base.
 */

import { rangoHorario } from "../horarios.ts";
import { rotuloDiasMembresia } from "../inscripcion.ts";

export type CursoMensaje = {
  nombre: string;
  /** Días elegidos para este curso (1=lun … 7=dom). */
  dias: number[];
  hora: string | null;
  duracionMin: number | null;
};

export type DatosConfirmacion = {
  /** Quién se inscribe: el texto cambia si lo recibe un tutor. */
  alumno: string;
  esMenor: boolean;
  plan: string;
  cursos: CursoMensaje[];
  /** null = ilimitado. */
  clasesPlan: number | null;
  bono: number;
  cicloDias: number | null;
  inicio: string;
  fin: string | null;
  /** Faltas con licencia que se reponen por ciclo (0 = sin tolerancia). */
  tolerancia: number;
  precio: number;
  credito: number;
  cobrado: number;
  medio: string | null;
  saldo: number;
  /** Fecha ya formateada hasta la que se compromete el saldo. */
  compromiso: string | null;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function lineaCurso(c: CursoMensaje): string {
  const dias = rotuloDiasMembresia(c.dias);
  const horario = rangoHorario(c.hora, c.duracionMin);
  const cuando = [dias, horario].filter(Boolean).join(", ");
  return cuando ? `${c.nombre}: ${cuando}` : c.nombre;
}

export function textoClases(d: Pick<DatosConfirmacion, "clasesPlan" | "bono" | "cicloDias">): string {
  if (d.clasesPlan == null) return `clases ilimitadas durante ${d.cicloDias ?? "?"} días`;
  const base = plural(d.clasesPlan, "clase", "clases");
  return d.bono > 0 ? `${base} (incluye ${plural(d.bono, "clase", "clases")} de bono)` : base;
}

/** Cómo se cuenta la asistencia, en palabras para el alumno (regla 6). */
export function textoAsistencia(tolerancia: number): string {
  if (tolerancia <= 0) return "Las faltas no se reponen.";
  return (
    `Si faltás hasta ${plural(tolerancia, "vez", "veces")} por ciclo avisando con licencia, ` +
    `la clase se repone con un bono para tu próxima inscripción; ` +
    `una falta sin aviso se pierde y anula ese bono.`
  );
}

export function textoPago(d: Pick<DatosConfirmacion, "precio" | "credito" | "cobrado" | "medio" | "saldo" | "compromiso">, gs: (n: number) => string): string {
  const partes = [`Precio: ${gs(d.precio)}.`];
  if (d.credito > 0) partes.push(`Crédito de tu clase de prueba: ${gs(d.credito)}.`);
  partes.push(d.cobrado > 0 ? `Pagado: ${gs(d.cobrado)}${d.medio ? ` (${d.medio})` : ""}.` : "Todavía sin pago.");
  if (d.saldo > 0) partes.push(`Saldo: ${gs(d.saldo)}${d.compromiso ? ` hasta el ${d.compromiso}` : ""}.`);
  else partes.push("Cuota saldada.");
  return partes.join(" ");
}

export function mensajeConfirmacionInscripcion(d: DatosConfirmacion, gs: (n: number) => string): string {
  const sujeto = d.esMenor ? `la inscripción de ${d.alumno}` : "tu inscripción";
  const lineas = [
    `Hola! Confirmamos ${sujeto} en ${d.plan}.`,
    "",
    d.cursos.length === 1 ? "Curso:" : "Cursos:",
    ...d.cursos.map((c) => `• ${lineaCurso(c)}`),
    "",
    `Incluye: ${textoClases(d)}.`,
    `Empieza el ${d.inicio}${d.fin ? ` y el ciclo termina aprox. el ${d.fin}` : ""}.`,
    textoAsistencia(d.tolerancia),
    "",
    textoPago(d, gs),
    "",
    "¡Te esperamos!",
  ];
  return lineas.join("\n");
}

export type DatosRecibo = {
  alumno: string;
  plan: string;
  fecha: string;
  monto: number;
  medio: string | null;
  saldo: number;
  compromiso: string | null;
};

export function mensajeReciboPago(d: DatosRecibo, gs: (n: number) => string): string {
  return [
    `Recibo de pago — ${d.fecha}`,
    `Recibimos de ${d.alumno}: ${gs(d.monto)}${d.medio ? ` (${d.medio})` : ""}.`,
    `Concepto: ${d.plan}.`,
    d.saldo > 0 ? `Saldo pendiente: ${gs(d.saldo)}${d.compromiso ? ` hasta el ${d.compromiso}` : ""}.` : "Cuota saldada. ¡Gracias!",
  ].join("\n");
}
