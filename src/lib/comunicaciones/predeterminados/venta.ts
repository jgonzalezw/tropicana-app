/**
 * R20 · E2 — contenido predeterminado heredado de los avisos de una VENTA
 * (N01–N06): inscripción, recibo de pago, clase de prueba, paquete particular
 * (alumno y profesor) y alquiler de sala (a su titular o a quien lo atiende).
 * Es el texto que arman hoy `lib/venta/mensajeInscripcion.ts` y las acciones de
 * `inscribir/`, expresado como plantilla.
 *
 * Reglas de la ficha:
 *  - Las variables llegan ya formateadas por el adaptador: importes con `gs`,
 *    fechas ya dichas, horario de cada curso con `lineaCurso`, plurales ya
 *    resueltos («1 vez», «2 clases»). La plantilla no formatea.
 *  - Las ramas del texto (menor, ilimitado, bono, pago, saldo, agenda fija o
 *    flexible, resto por coordinar) son condiciones y listas del motor.
 *  - Quién recibe el aviso (`destinatarioAviso`, `destinatarioDeTitular`) y
 *    cuándo NO corresponde (el recibo solo si se cobró algo: `avisaRecibo`) lo
 *    decide el código (R37). El alquiler tiene dos textos según a quién va.
 *  - Se conservan las rarezas: «Hola!» sin coma; «(Plan, 1 persona):.» sin
 *    clases con fecha; «Cursos:» sin cursos; los dos textos de «resto»; la
 *    duración sin formatear en las horas del paquete.
 *  - Los nombres, el plan, el lugar y la agenda permiten vacío: el original los
 *    imprimía así («con  en»). Una validación mejor es un cambio posterior.
 */
import { lineaCurso, type DatosConfirmacion, type DatosRecibo } from "../../venta/mensajeInscripcion.ts";
import { clasesDePrueba, gentePrueba, type mensajePrueba } from "../legado/venta.ts";
import { marcadoresDe, type Datos, type Vocabulario } from "../plantillas.ts";

export type VariableVenta = {
  nombre: string;
  descripcion: string;
  fuente: string;
  formato: string;
  ejemplo: string;
  ausencia: string;
  permiteVacia?: boolean;
};

export type CasoVenta = {
  clave: string;
  evento: string;
  destinatario: string;
  finalidad: "servicio";
  plantilla: string;
};

const TITULAR = "titular o su tutor (dT)";
const ALUMNO = "alumno o su tutor (dA)";
const PROFESOR = "profesor de la membresía";
const TITULAR_ALQUILER = "titular del alquiler, o la persona que atiende a la organización";

const caso = (clave: string, evento: string, destinatario: string, plantilla: string): CasoVenta => ({
  clave,
  evento,
  destinatario,
  finalidad: "servicio",
  plantilla,
});

const PAGO =
  "Precio: {{venta.precio}}.{{#si venta.hay_credito}} Crédito de tu clase de prueba: {{venta.credito}}.{{/si}}" +
  "{{#si venta.hay_cobrado}} Pagado: {{venta.cobrado}}{{#si venta.hay_medio}} ({{venta.medio}}){{/si}}.{{#sino}} Todavía sin pago.{{/si}}" +
  "{{#si venta.hay_saldo}} Saldo: {{venta.saldo}}{{#si venta.hay_compromiso}} hasta el {{venta.compromiso}}{{/si}}.{{#sino}} Cuota saldada.{{/si}}";

const ASISTENCIA =
  "{{#si venta.hay_tolerancia}}Si faltás hasta {{venta.tolerancia}} por ciclo avisando con licencia, " +
  "la clase se repone con un bono de ese mismo curso, que vale en tu próxima inscripción que lo incluya; " +
  "una falta sin aviso se pierde y anula el bono de ese curso.{{#sino}}Las faltas no se reponen.{{/si}}";

const CLASES =
  "{{#si venta.ilimitado}}clases ilimitadas durante {{venta.ciclo_dias}} días{{#sino}}{{venta.clases_plan}}" +
  "{{#si venta.hay_bono}} (incluye {{venta.bono}} de bono{{#si venta.hay_bono_cursos}} de " +
  '{{#cada venta.bono_cursos sep=" y "}}{{.}}{{/cada}}{{/si}}){{/si}}{{/si}}';

const INTRO_ALUMNO =
  "{{#si venta.es_fija}}{{#si venta.una_sesion}}Tu clase reservada es{{#sino}}Tus clases reservadas son{{/si}}{{#sino}}Tu primera clase reservada es{{/si}}";
const INTRO_PROFESOR =
  "{{#si venta.es_fija}}{{#si venta.una_sesion}}La clase es{{#sino}}Las clases son{{/si}}{{#sino}}La primera clase es{{/si}}";
const RESTO_COORDINA = "{{#si venta.hay_resto}} El resto se coordina después.{{/si}}";
const RESTO_ALQUILER = "{{#si venta.hay_resto}} El resto de las horas se coordina después.{{/si}}";

export const CASOS_VENTA: Record<string, CasoVenta> = {
  N01: caso(
    "venta.inscripcion.alumno",
    "venta.inscripcion",
    TITULAR,
    "Hola! Confirmamos {{#si venta.es_menor}}la inscripción de {{alumno.nombre}}{{#sino}}tu inscripción{{/si}} en {{venta.plan}}.\n\n" +
      "{{#si venta.varios_cursos}}Cursos:{{#sino}}Curso:{{/si}}{{#cada venta.cursos}}\n• {{.}}{{/cada}}\n\n" +
      `Incluye: ${CLASES}.\n` +
      "Empieza el {{venta.inicio}}{{#si venta.hay_fin}} y el ciclo termina aprox. el {{venta.fin}}{{/si}}.\n" +
      `${ASISTENCIA}\n\n${PAGO}\n\n¡Te esperamos!`
  ),
  N02: caso(
    "venta.recibo.alumno",
    "venta.recibo",
    TITULAR,
    "Recibo de pago — {{recibo.fecha}}\n" +
      "Recibimos de {{alumno.nombre}}: {{recibo.monto}}{{#si recibo.hay_medio}} ({{recibo.medio}}){{/si}}.\n" +
      "Concepto: {{venta.plan}}.\n" +
      "{{#si recibo.hay_saldo}}Saldo pendiente: {{recibo.saldo}}{{#si recibo.hay_compromiso}} hasta el {{recibo.compromiso}}{{/si}}.{{#sino}}Cuota saldada. ¡Gracias!{{/si}}"
  ),
  N03: caso(
    "venta.prueba.alumno",
    "venta.prueba",
    TITULAR,
    "Hola! Confirmamos {{#si venta.es_menor}}la clase de prueba de {{alumno.nombre}}{{#sino}}tu clase de prueba{{/si}} ({{venta.plan}}, {{venta.gente}}):" +
      '{{#si venta.hay_clases}} {{#cada venta.clases sep=" y "}}{{.}}{{/cada}}{{/si}}. ¡Te esperamos!'
  ),
  N04: caso(
    "venta.particular.alumno",
    "venta.particular",
    ALUMNO,
    "Hola! Confirmamos tu paquete de {{venta.horas}} h de clases particulares ({{venta.plan}}) con {{profesor.nombre}} en {{venta.lugar}}. " +
      `${INTRO_ALUMNO}: {{venta.agenda}}.${RESTO_COORDINA} ¡Te esperamos!`
  ),
  N05: caso(
    "venta.particular.profesor",
    "venta.particular",
    PROFESOR,
    "Hola! Se te agendó una clase particular ({{venta.plan}}) con {{alumno.nombre}} en {{venta.lugar}}. " +
      `${INTRO_PROFESOR}: {{venta.agenda}}.${RESTO_COORDINA}`
  ),
  "N06.titular": caso(
    "venta.alquiler.titular",
    "venta.alquiler",
    TITULAR_ALQUILER + " · a su propio titular",
    "Hola! Confirmamos tu alquiler de sala ({{venta.plan}}): {{venta.horas}} h en {{venta.lugar}}. Reservado: {{venta.agenda}}." +
      `${RESTO_ALQUILER} ¡Te esperamos!`
  ),
  "N06.contacto": caso(
    "venta.alquiler.contacto",
    "venta.alquiler",
    TITULAR_ALQUILER + " · a la persona de contacto",
    "Hola! Confirmamos el alquiler de sala ({{venta.plan}}) de {{alquiler.titular}}: {{venta.horas}} h en {{venta.lugar}}. Reservado: {{venta.agenda}}." +
      `${RESTO_ALQUILER} ¡Los esperamos!`
  ),
};

const v = (
  nombre: string,
  descripcion: string,
  fuente: string,
  formato: string,
  ejemplo: string,
  ausencia: string,
  permiteVacia?: boolean
): VariableVenta => ({ nombre, descripcion, fuente, formato, ejemplo, ausencia, ...(permiteVacia ? { permiteVacia } : {}) });

const HEREDADO = "Vacío se imprime así (heredado; una validación mejor es un cambio posterior).";

export const ESQUEMA_VENTA: VariableVenta[] = [
  v("alumno.nombre", "Nombre de quien se inscribe, o del alumno de la clase particular.", "contactos del alumno", "nombre y apellido", "Ana Pérez",
    "En N05, sin nombre se dice «un alumno».", true),
  v("profesor.nombre", "Nombre del profesor de la membresía.", "contactos del profesor", "nombre y apellido, ya recortado", "Mario Rojas", HEREDADO, true),
  v("alquiler.titular", "Nombre del titular del alquiler.", "contactos del titular", "nombre de la persona u organización", "Colegio Sol", HEREDADO, true),
  v("venta.plan", "Nombre del plan vendido.", "planes.nombre", "tal cual", "Plan Doble", HEREDADO, true),
  v("venta.lugar", "Dónde se dicta o se alquila.", "sala externa o «Tropicana»", "tal cual", "Tropicana", HEREDADO, true),
  v("venta.agenda", "Fechas y horas reservadas.", "formatearAgenda(sesiones)", "«vie 02/10 15:00, vie 09/10 15:00»", "vie 02/10 15:00", HEREDADO, true),
  v("venta.horas", "Horas del paquete o del alquiler.", "tarifas del plan", "número sin formatear: «10», «1.5»", "10", "Siempre hay un número."),
  v("venta.gente", "Cuántas personas asisten a la prueba.", "pruebas.acompanantes", "«1 persona» o «N personas»", "1 persona", "Siempre hay un número."),
  v("venta.clases", "Clases de la prueba, con su fecha.", "membresia_cursos: curso y fecha", "«Salsa el vie 9 oct», ordenadas por fecha", "Salsa el vie 9 oct",
    "Sin clases con fecha, la frase queda «():.» (heredado)."),
  v("venta.cursos", "Cursos de la inscripción con sus días y horario.", "cursos y días elegidos", "«Salsa: lunes y miércoles, 19:00 → 20:30»", "Salsa: lunes y miércoles",
    "Sin cursos queda solo el rótulo (heredado)."),
  v("venta.inicio", "Fecha de inicio.", "fecha de la venta", "«lun 5 oct»", "lun 5 oct", "Siempre existe."),
  v("venta.fin", "Fin aproximado del ciclo.", "membresias.fecha_fin", "«vie 6 nov»", "vie 6 nov", "Si no se calcula, la frase no aparece."),
  v("venta.clases_plan", "Clases del plan.", "planes: clases", "«12 clases» / «1 clase»", "12 clases", "Con plan ilimitado no se usa."),
  v("venta.bono", "Clases de bono incluidas.", "bonos aplicados", "«2 clases» / «1 clase»", "2 clases", "Sin bono no se usa."),
  v("venta.bono_cursos", "Cursos de los que es el bono.", "bonos por curso (D35)", "«Salsa» o, con varios, «Salsa (2)»", "Salsa", "Sin cursos, el texto no los nombra."),
  v("venta.ciclo_dias", "Días del ciclo de un plan ilimitado.", "planes: ciclo", "número, o «?» si falta", "30", "Sin ciclo se imprime «?» (heredado)."),
  v("venta.tolerancia", "Faltas con licencia que se reponen por ciclo.", "tolerancia del plan", "«1 vez» / «2 veces»", "1 vez", "Con 0 se usa «Las faltas no se reponen.»"),
  v("venta.precio", "Precio del plan.", "referencia de precio", "«Bs. 1.200,00»", "Bs. 1.200,00", "Siempre existe."),
  v("venta.credito", "Crédito por la clase de prueba.", "pagos de la prueba", "importe", "Bs. 150,00", "Sin crédito no aparece."),
  v("venta.cobrado", "Importe cobrado en la venta.", "pagos", "importe", "Bs. 1.200,00", "Sin cobro, «Todavía sin pago.»"),
  v("venta.medio", "Medio de pago.", "formas de pago", "tal cual", "Efectivo", "Sin medio no aparece."),
  v("venta.saldo", "Saldo pendiente.", "cuota", "importe", "Bs. 600,00", "Sin saldo, «Cuota saldada.»"),
  v("venta.compromiso", "Hasta cuándo se compromete el saldo.", "fecha de compromiso", "«vie 16 oct»", "vie 16 oct", "Sin fecha no aparece."),
  v("recibo.fecha", "Fecha del recibo.", "hoy", "«lun 5 oct»", "lun 5 oct", "Siempre existe."),
  v("recibo.monto", "Importe recibido.", "cobro", "importe", "Bs. 1.200,00", "Siempre existe."),
  v("recibo.medio", "Medio del cobro.", "formas de pago", "tal cual", "Efectivo", "Sin medio no aparece."),
  v("recibo.saldo", "Saldo que queda.", "cuota", "importe", "Bs. 600,00", "Sin saldo, «Cuota saldada. ¡Gracias!»"),
  v("recibo.compromiso", "Hasta cuándo se compromete el saldo.", "fecha de compromiso", "«vie 16 oct»", "vie 16 oct", "Sin fecha no aparece."),
];

/** Lo que cada plantilla usa, leído de la propia plantilla. */
export function vocabularioVenta(clave: keyof typeof CASOS_VENTA): Vocabulario {
  const m = marcadoresDe(CASOS_VENTA[clave].plantilla);
  return {
    variables: m.variables.map((nombre) => ({
      nombre,
      obligatoria: true,
      permiteVacia: ESQUEMA_VENTA.find((x) => x.nombre === nombre)?.permiteVacia,
    })),
    condiciones: m.condiciones,
    listas: m.listas,
  };
}

type Gs = (n: number) => string;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** N01. Reproduce `textoClases`, `textoAsistencia` y `textoPago` como datos. */
export function variablesInscripcion(d: DatosConfirmacion, gs: Gs): Datos {
  return {
    "venta.es_menor": d.esMenor,
    "alumno.nombre": d.alumno,
    "venta.plan": d.plan,
    "venta.varios_cursos": d.cursos.length !== 1,
    "venta.cursos": d.cursos.map((c) => lineaCurso(c)),
    "venta.ilimitado": d.clasesPlan == null,
    "venta.ciclo_dias": String(d.cicloDias ?? "?"),
    "venta.clases_plan": d.clasesPlan == null ? "" : plural(d.clasesPlan, "clase", "clases"),
    "venta.hay_bono": d.bono > 0,
    "venta.bono": plural(d.bono, "clase", "clases"),
    "venta.hay_bono_cursos": !!d.bonoCursos?.length,
    "venta.bono_cursos": (d.bonoCursos ?? []).map((b) => `${b.curso}${d.bonoCursos!.length > 1 ? ` (${b.clases})` : ""}`),
    "venta.inicio": d.inicio,
    "venta.hay_fin": !!d.fin,
    "venta.fin": d.fin ?? "",
    "venta.hay_tolerancia": d.tolerancia > 0,
    "venta.tolerancia": plural(d.tolerancia, "vez", "veces"),
    "venta.precio": gs(d.precio),
    "venta.hay_credito": d.credito > 0,
    "venta.credito": gs(d.credito),
    "venta.hay_cobrado": d.cobrado > 0,
    "venta.cobrado": gs(d.cobrado),
    "venta.hay_medio": !!d.medio,
    "venta.medio": d.medio ?? "",
    "venta.hay_saldo": d.saldo > 0,
    "venta.saldo": gs(d.saldo),
    "venta.hay_compromiso": !!d.compromiso,
    "venta.compromiso": d.compromiso ?? "",
  };
}

/** N02. */
export function variablesRecibo(d: DatosRecibo, gs: Gs): Datos {
  return {
    "recibo.fecha": d.fecha,
    "alumno.nombre": d.alumno,
    "recibo.monto": gs(d.monto),
    "recibo.hay_medio": !!d.medio,
    "recibo.medio": d.medio ?? "",
    "venta.plan": d.plan,
    "recibo.hay_saldo": d.saldo > 0,
    "recibo.saldo": gs(d.saldo),
    "recibo.hay_compromiso": !!d.compromiso,
    "recibo.compromiso": d.compromiso ?? "",
  };
}

/** N03, con los mismos datos que `mensajePrueba`. */
export function variablesPrueba(d: Parameters<typeof mensajePrueba>[0]): Datos {
  const clases = clasesDePrueba(d.guardadas, d.nombreCurso);
  return {
    "venta.es_menor": d.esMenor,
    "alumno.nombre": d.quien.trim(),
    "venta.plan": d.planNombre,
    "venta.gente": gentePrueba(d.personas),
    "venta.hay_clases": clases.length > 0,
    "venta.clases": clases,
  };
}

/** N04 / N05. */
export function variablesParticular(d: {
  horasContratadas: number;
  planNombre: string | undefined;
  nombreProfesor: string | undefined;
  dondeTexto: string | undefined;
  esFija: boolean;
  nSesiones: number;
  agendaTexto: string;
  leftoverMin?: number;
  alumnoNombre: string;
}): Datos {
  return {
    "venta.horas": String(d.horasContratadas),
    "venta.plan": String(d.planNombre),
    "profesor.nombre": String(d.nombreProfesor),
    "alumno.nombre": d.alumnoNombre || "un alumno",
    "venta.lugar": String(d.dondeTexto),
    "venta.es_fija": d.esFija,
    "venta.una_sesion": d.nSesiones === 1,
    "venta.agenda": d.agendaTexto,
    "venta.hay_resto": !!d.leftoverMin,
  };
}

/** N06 (los dos textos). */
export function variablesAlquiler(d: {
  planNombre: string | undefined;
  horas: number;
  dondeTexto: string | undefined;
  agendaTexto: string;
  leftoverMin?: number;
  contactoNombre: string;
  destinoNombre: string;
}): Datos {
  return {
    "venta.plan": String(d.planNombre),
    "alquiler.titular": d.contactoNombre,
    "venta.horas": String(d.horas),
    "venta.lugar": String(d.dondeTexto),
    "venta.agenda": d.agendaTexto,
    "venta.hay_resto": !!d.leftoverMin,
  };
}

/** Qué texto del alquiler corresponde: el propio titular o la persona de contacto. */
export const claveAlquiler = (d: { contactoNombre: string; destinoNombre: string }): "N06.titular" | "N06.contacto" =>
  d.destinoNombre === d.contactoNombre ? "N06.titular" : "N06.contacto";
