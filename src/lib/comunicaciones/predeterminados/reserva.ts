/**
 * R20 · E2 — contenido predeterminado heredado de los avisos de una RESERVA
 * (N07–N18): solicitada, confirmada, suspendida, restablecida, reprogramada y
 * cancelada a pedido (en plazo / fuera de plazo). Es el texto que arman hoy las
 * acciones de `particulares/acciones.ts`, expresado como plantilla.
 *
 * Reglas de la ficha:
 *  - Las variables llegan YA FORMATEADAS por el adaptador (`variablesReserva`),
 *    que usa los mismos formateadores que el generador original. La plantilla no
 *    formatea fechas ni horas.
 *  - Las ramas del generador (particular/alquiler, respaldos de plan y de nombre)
 *    las resuelve el adaptador; las plantillas no tienen condiciones. Las dos
 *    variantes de la cancelación (en plazo / fuera de plazo) son dos textos
 *    distintos, no un `si`.
 *  - Quién recibe el aviso (dA / dT / profesor) y CUÁNDO NO corresponde (sin
 *    contexto, sin destinatario, alquiler sin profesor, estados que no avisan)
 *    NO es parte del texto: lo decide el código (`avisosDeReserva`,
 *    `avisaCambioDeEstado`; R37).
 *  - Se reproducen las rarezas del original («Hola!» sin coma, «a ?» sin duración,
 *    «Tu alquiler … quedó suspendida», «Te quedan…» tras los dos puntos).
 *  - Obligatoria significa obligatoria EN ESA PLANTILLA: todas las variables que
 *    usa. Un motivo vacío, que el original imprimía como «()», acá detiene el mensaje.
 */
import { h, horario, textosDeReserva } from "../legado/reserva.ts";

export type EntradaReserva = {
  esAlquiler: boolean;
  planNombre: string | null | undefined;
  profesorNombre: string;
  alumnoNombre: string;
  contratadasMin: number;
  disponibleMin: number;
  fecha: string;
  hora: string;
  duracionMin: number;
  lugar: string;
  /** Solo reprogramada: la reserva anterior. */
  anterior?: { fecha: string; hora: string; duracionMin: number };
  /** Solo suspendida: el motivo ya compuesto (lista, C5 o bloqueo). */
  motivo?: string | null;
  /** Solo cancelada fuera de plazo. */
  plazoHoras?: number;
};
/** Nombre histórico de H2. */
export type EntradaReservaConfirmada = EntradaReserva;

export type VariableDePlantilla = {
  nombre: string;
  descripcion: string;
  fuente: string;
  tipo: "texto";
  formato: string;
  ejemplo: string;
  ausencia: string;
};

export type CasoPredeterminado = {
  clave: string;
  evento: string;
  variante: string;
  destinatario: string;
  finalidad: "servicio";
  plantilla: string;
  /** Las variables que usa la plantilla; todas son obligatorias en ella. */
  variables: readonly string[];
};

const ALUMNO = "alumno, tutor o titular (dA / dT)";
const PROFESOR = "profesor de la membresía (solo particular; el alquiler no tiene profesor)";

const caso = (
  clave: string,
  evento: string,
  variante: string,
  destinatario: string,
  plantilla: string,
  variables: readonly string[]
): CasoPredeterminado => ({ clave, evento, variante, destinatario, finalidad: "servicio", plantilla, variables });

const SALDO = ["saldo.disponible_horas", "saldo.paquete", "saldo.contratadas_horas"] as const;
const TE_QUEDAN = "Te quedan {{saldo.disponible_horas}} h de tu {{saldo.paquete}} de {{saldo.contratadas_horas}} h.";

export const CASOS_RESERVA: Record<string, CasoPredeterminado> = {
  "N07": caso("reserva.solicitada.alumno", "reserva.solicitada", "alumno", ALUMNO,
    "Hola! Estamos coordinando {{reserva.tu_clase}} para el {{reserva.cuando}}, en {{reserva.lugar}}. Te la confirmamos a la brevedad.",
    ["reserva.tu_clase", "reserva.cuando", "reserva.lugar"]),
  "N08": caso("reserva.solicitada.profesor", "reserva.solicitada", "profesor", PROFESOR,
    "Hola! Estamos coordinando una clase particular ({{reserva.plan}}) con {{alumno.nombre}} para el {{reserva.cuando}}, en {{reserva.lugar}}. ¿Te queda bien? Te confirmamos.",
    ["reserva.plan", "alumno.nombre", "reserva.cuando", "reserva.lugar"]),
  "N09": caso("reserva.confirmada.alumno", "reserva.confirmada", "alumno", ALUMNO,
    `Hola! Confirmamos {{reserva.tu_clase}}: {{reserva.cuando}}, en {{reserva.lugar}}. ${TE_QUEDAN} ¡Te esperamos!`,
    ["reserva.tu_clase", "reserva.cuando", "reserva.lugar", ...SALDO]),
  "N10": caso("reserva.confirmada.profesor", "reserva.confirmada", "profesor", PROFESOR,
    "Hola! Se te confirmó una clase particular ({{reserva.plan}}) con {{alumno.nombre}}: {{reserva.cuando}}, en {{reserva.lugar}}.",
    ["reserva.plan", "alumno.nombre", "reserva.cuando", "reserva.lugar"]),
  "N11": caso("reserva.suspendida.alumno", "reserva.suspendida", "alumno", ALUMNO,
    `Hola! {{reserva.tu_clase_corta|mayuscula_inicial}} del {{reserva.cuando}} quedó suspendida ({{reserva.motivo}}). Esa hora vuelve a tu {{saldo.paquete}}: ${TE_QUEDAN} Coordinamos una nueva fecha.`,
    ["reserva.tu_clase_corta", "reserva.cuando", "reserva.motivo", ...SALDO]),
  "N12": caso("reserva.suspendida.profesor", "reserva.suspendida", "profesor", PROFESOR,
    "Hola! La clase particular ({{reserva.plan}}) con {{alumno.nombre}} del {{reserva.cuando}}, en {{reserva.lugar}}, quedó suspendida ({{reserva.motivo}}).",
    ["reserva.plan", "alumno.nombre", "reserva.cuando", "reserva.lugar", "reserva.motivo"]),
  "N13": caso("reserva.restablecida.alumno", "reserva.restablecida", "alumno", ALUMNO,
    `Hola! Se restableció {{reserva.tu_clase}}: {{reserva.cuando}}, en {{reserva.lugar}}. ${TE_QUEDAN} ¡Te esperamos!`,
    ["reserva.tu_clase", "reserva.cuando", "reserva.lugar", ...SALDO]),
  "N14": caso("reserva.restablecida.profesor", "reserva.restablecida", "profesor", PROFESOR,
    "Hola! Se restableció una clase particular ({{reserva.plan}}) con {{alumno.nombre}}: {{reserva.cuando}}, en {{reserva.lugar}}.",
    ["reserva.plan", "alumno.nombre", "reserva.cuando", "reserva.lugar"]),
  "N15": caso("reserva.reprogramada.alumno", "reserva.reprogramada", "alumno", ALUMNO,
    `Hola! Reprogramamos {{reserva.tu_clase}}: pasa del {{reserva.antes}} al {{reserva.cuando}}, en {{reserva.lugar}}. ${TE_QUEDAN} ¡Te esperamos!`,
    ["reserva.tu_clase", "reserva.antes", "reserva.cuando", "reserva.lugar", ...SALDO]),
  "N16": caso("reserva.reprogramada.profesor", "reserva.reprogramada", "profesor", PROFESOR,
    "Hola! Se reprogramó la clase particular ({{reserva.plan}}) con {{alumno.nombre}}: pasa del {{reserva.antes}} al {{reserva.cuando}}, en {{reserva.lugar}}.",
    ["reserva.plan", "alumno.nombre", "reserva.antes", "reserva.cuando", "reserva.lugar"]),
  "N17.fuera_de_plazo": caso("reserva.cancelada_pedido.alumno.fuera_de_plazo", "reserva.cancelada_pedido", "alumno · fuera de plazo", ALUMNO,
    `Hola! Registramos la cancelación de {{reserva.tu_clase_corta}} del {{reserva.cuando}}. Como fue con menos de {{reserva.plazo_horas}} h de anticipación, esa hora se descuenta del {{saldo.paquete}}. ${TE_QUEDAN}`,
    ["reserva.tu_clase_corta", "reserva.cuando", "reserva.plazo_horas", ...SALDO]),
  "N17.en_plazo": caso("reserva.cancelada_pedido.alumno.en_plazo", "reserva.cancelada_pedido", "alumno · en plazo", ALUMNO,
    `Hola! Cancelamos {{reserva.tu_clase_corta}} del {{reserva.cuando}}, como pediste. Esa hora vuelve a tu {{saldo.paquete}}: ${TE_QUEDAN} Coordinamos una nueva fecha.`,
    ["reserva.tu_clase_corta", "reserva.cuando", ...SALDO]),
  "N18.fuera_de_plazo": caso("reserva.cancelada_pedido.profesor.fuera_de_plazo", "reserva.cancelada_pedido", "profesor · fuera de plazo", PROFESOR,
    "Hola! {{alumno.nombre}} canceló fuera de plazo la clase particular ({{reserva.plan}}) del {{reserva.cuando}}, en {{reserva.lugar}}. Ya no hace falta que vayas.",
    ["alumno.nombre", "reserva.plan", "reserva.cuando", "reserva.lugar"]),
  "N18.en_plazo": caso("reserva.cancelada_pedido.profesor.en_plazo", "reserva.cancelada_pedido", "profesor · en plazo", PROFESOR,
    "Hola! Se canceló a pedido del alumno la clase particular ({{reserva.plan}}) con {{alumno.nombre}} del {{reserva.cuando}}, en {{reserva.lugar}}.",
    ["reserva.plan", "alumno.nombre", "reserva.cuando", "reserva.lugar"]),
};

/** Compatibilidad con H2. */
export const CASOS_RESERVA_CONFIRMADA = { alumno: CASOS_RESERVA["N09"], profesor: CASOS_RESERVA["N10"] } as const;

const v = (
  nombre: string,
  descripcion: string,
  fuente: string,
  formato: string,
  ejemplo: string,
  ausencia: string
): VariableDePlantilla => ({ nombre, descripcion, fuente, tipo: "texto", formato, ejemplo, ausencia });

export const ESQUEMA_RESERVA: VariableDePlantilla[] = [
  v("reserva.tu_clase", "Qué se confirma, con el profesor si es una clase particular.", "membresía: tipo (alquiler o particular), plan y profesor",
    "«tu clase particular (Plan) con Profesor» o «tu alquiler de sala (Plan)»", "tu clase particular (Paquete 10 h) con Mario Rojas",
    "El plan faltante se reemplaza por «clases particulares» o «alquiler de sala»."),
  v("reserva.tu_clase_corta", "Lo mismo, sin el profesor.", "membresía: tipo y plan",
    "«tu clase particular (Plan)» o «tu alquiler de sala (Plan)»", "tu clase particular (Paquete 10 h)",
    "El plan faltante se reemplaza por «clases particulares» o «alquiler de sala»."),
  v("reserva.plan", "Nombre del plan de la membresía.", "planes.nombre", "texto tal cual", "Paquete 10 h",
    "«clases particulares» (particular) o «alquiler de sala» (alquiler)."),
  v("reserva.cuando", "Día y horario de la reserva.", "reservas_sala: fecha, hora, duración",
    "«vie 02/10 de 15:00 a 16:00»; sin duración, «a ?»", "vie 02/10 de 15:00 a 16:00", "Sin duración, termina en «?» (comportamiento heredado)."),
  v("reserva.antes", "Día y horario anteriores, en una reprogramación.", "reservas_sala: fecha, hora, duración de la reserva que se mueve",
    "igual que «reserva.cuando»", "jue 01/10 de 18:00 a 19:30", "Solo existe al reprogramar."),
  v("reserva.lugar", "Dónde es la reserva.", "membresia_salas.nombre_descriptivo (lugar externo) o salas.nombre",
    "nombre del lugar externo, «Tropicana (Sala)» o «Tropicana»", "Tropicana (Sala 1)", "«Tropicana»."),
  v("reserva.motivo", "Por qué se suspendió.", "catálogo de motivos, cierre de sala (C5) o bloqueo",
    "texto compuesto por la acción: «etiqueta», «etiqueta (glosa)» o «etiqueta — glosa»", "feriado nacional",
    "Si faltara, el mensaje no se genera."),
  v("reserva.plazo_horas", "Horas de anticipación del plazo de cancelación.", "parametros.reserva_cancelacion_plazo_horas",
    "número entero", "8", "Si faltara el parámetro, la acción usa 8."),
  v("alumno.nombre", "Nombre del alumno (o del titular, en un alquiler).", "contactos del alumno o del titular", "nombre y apellido", "Ana Pérez",
    "«el alumno» (particular) o «el titular» (alquiler)."),
  v("saldo.disponible_horas", "Horas que le quedan en el paquete o alquiler.", "saldoMembresia().disponibleMin",
    "horas sin ceros sobrantes: «7.5», «10», «0.25»", "7.5", "No aplica: siempre hay un número."),
  v("saldo.contratadas_horas", "Horas contratadas en total.", "saldoMembresia().contratadasMin", "horas sin ceros sobrantes", "10",
    "No aplica: siempre hay un número."),
  v("saldo.paquete", "Cómo se llama lo que se va gastando.", "membresía: tipo", "«paquete» o «alquiler»", "paquete", "No aplica."),
];
/** Nombre histórico de H2. */
export const ESQUEMA_RESERVA_CONFIRMADA = ESQUEMA_RESERVA;

/** Todo lo que las plantillas necesitan, ya formateado como el generador original. */
export function variablesReserva(e: EntradaReserva): Record<string, string> {
  const t = textosDeReserva(e);
  const out: Record<string, string> = {
    "reserva.tu_clase": t.tuClase,
    "reserva.tu_clase_corta": t.tuClaseCorta,
    "reserva.plan": t.planNombre,
    "reserva.cuando": horario(e.fecha, e.hora, e.duracionMin),
    "reserva.lugar": e.lugar,
    "alumno.nombre": t.alumnoNombre,
    "saldo.disponible_horas": h(e.disponibleMin),
    "saldo.contratadas_horas": h(e.contratadasMin),
    "saldo.paquete": t.paquete,
  };
  if (e.anterior) out["reserva.antes"] = horario(e.anterior.fecha, e.anterior.hora, e.anterior.duracionMin);
  if (e.motivo !== undefined) out["reserva.motivo"] = String(e.motivo);
  if (e.plazoHoras !== undefined) out["reserva.plazo_horas"] = String(e.plazoHoras);
  return out;
}
/** Nombre histórico de H2. */
export const variablesReservaConfirmada = variablesReserva;
