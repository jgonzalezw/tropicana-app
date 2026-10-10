/**
 * R20 · E2 — contenido predeterminado heredado de los avisos de una CLASE DE
 * CURSO (N19–N21): suspendida (alumno y profesor) y restablecida (alumno). Es el
 * texto que arma hoy `src/lib/avisosClase.ts`, expresado como plantilla.
 *
 * Reglas de la ficha:
 *  - Las variables llegan ya formateadas por el adaptador (fechas con `fmtLarga`).
 *  - Lo que depende de datos (una o varias clases, ciclo corrido o no) son
 *    condiciones y una lista que calcula el adaptador.
 *  - Quién recibe cada aviso y cuándo NO corresponde (sin profesor, sin contacto,
 *    sin alumnos afectados, la clase no estaba suspendida) lo decide el código
 *    (`armar…` en `legado/clase.ts`; R37). El cierre de sala (C5) no emite N20.
 *  - Se conservan las rarezas: el motivo de la primera clase vale para todas;
 *    un motivo vacío deja «por .» (heredado); sin nombre, «Hola Alumno #7!».
 */
import { fmtLarga, type ClaseSuspendida } from "../legado/clase.ts";
import type { Datos, Vocabulario } from "../plantillas.ts";

export type VariableClase = {
  nombre: string;
  descripcion: string;
  fuente: string;
  formato: string;
  ejemplo: string;
  ausencia: string;
  permiteVacia?: boolean;
};

export type CasoClase = {
  clave: string;
  evento: string;
  destinatario: string;
  finalidad: "servicio";
  plantilla: string;
  variables: readonly string[];
  condiciones: readonly string[];
  listas: readonly string[];
};

const ALUMNO = "alumno o su tutor (WhatsApp propio o, en un menor sin WhatsApp, el del tutor)";
const PROFESOR = "profesor titular del curso en esa fecha";

export const CASOS_CLASE: Record<string, CasoClase> = {
  N19: {
    clave: "clase.suspendida.alumno",
    evento: "clase.suspendida",
    destinatario: ALUMNO,
    finalidad: "servicio",
    plantilla:
      'Hola {{alumno.nombre_pila}}! Te avisamos que tu clase de {{#cada clase.detalle sep=", "}}{{.}}{{/cada}} {{#si clase.varias}}quedaron suspendidas{{#sino}}quedó suspendida{{/si}} por {{clase.motivo}}.{{#si clase.hay_ciclo}} Tu ciclo se corrió: ahora vence el {{clase.fin_ciclo}}.{{/si}} Cualquier duda, escribinos por acá. ¡Gracias!',
    variables: ["alumno.nombre_pila", "clase.motivo", "clase.fin_ciclo"],
    condiciones: ["clase.varias", "clase.hay_ciclo"],
    listas: ["clase.detalle"],
  },
  N20: {
    clave: "clase.suspendida.profesor",
    evento: "clase.suspendida",
    destinatario: PROFESOR,
    finalidad: "servicio",
    plantilla:
      "Hola {{profesor.nombre_pila}}! Te avisamos que la clase de {{clase.curso}} del {{clase.fecha}} quedó suspendida por {{clase.motivo}}. No hace falta que la dictes.",
    variables: ["profesor.nombre_pila", "clase.curso", "clase.fecha", "clase.motivo"],
    condiciones: [],
    listas: [],
  },
  N21: {
    clave: "clase.restablecida.alumno",
    evento: "clase.restablecida",
    destinatario: ALUMNO,
    finalidad: "servicio",
    plantilla:
      "Hola {{alumno.nombre_pila}}! Te avisamos que tu clase de {{clase.curso}} del {{clase.fecha}} se restableció: se dicta con normalidad.{{#si clase.hay_ciclo}} Tu ciclo vuelve a vencer el {{clase.fin_ciclo}}.{{/si}} Cualquier duda, escribinos por acá. ¡Gracias!",
    variables: ["alumno.nombre_pila", "clase.curso", "clase.fecha", "clase.fin_ciclo"],
    condiciones: ["clase.hay_ciclo"],
    listas: [],
  },
};

const v = (
  nombre: string,
  descripcion: string,
  fuente: string,
  formato: string,
  ejemplo: string,
  ausencia: string,
  permiteVacia?: boolean
): VariableClase => ({ nombre, descripcion, fuente, formato, ejemplo, ausencia, ...(permiteVacia ? { permiteVacia } : {}) });

export const ESQUEMA_CLASE: VariableClase[] = [
  v("alumno.nombre_pila", "Nombre de pila del alumno.", "contactos.nombre del alumno", "tal cual está en el contacto", "Ana",
    "Si el contacto no se resuelve, «Alumno #id» (comportamiento heredado)."),
  v("profesor.nombre_pila", "Nombre de pila del profesor titular.", "contactos.nombre del profesor", "tal cual está en el contacto", "Mario",
    "Sin nombre, se usa «nombre apellido» y, si falta todo, «Profesor #id»."),
  v("clase.curso", "Nombre del curso.", "cursos.nombre", "tal cual", "Salsa", "En la reapertura, si no se encuentra el curso, «tu curso»."),
  v("clase.fecha", "Fecha de la clase.", "fecha de la sesión", "día, número y mes abreviados: «lun 5 oct»", "lun 5 oct", "No aplica."),
  v("clase.motivo", "Por qué se suspendió.", "catálogo de motivos, glosa del cierre de sala (C5) o texto manual",
    "texto ya dicho con su etiqueta; sin motivo manual, «una decisión de la escuela»; en C5, «un cierre de sala»", "un feriado",
    "Vacío deja «por .» (heredado; una validación mejor es un cambio posterior).", true),
  v("clase.fin_ciclo", "Fin de ciclo del alumno, si cambió.", "membresías: fin de ciclo nuevo o restablecido", "«mar 10 nov»", "mar 10 nov",
    "Solo existe si el ciclo se corrió (N19) o volvió (N21)."),
];

export const vocabularioClase = (clave: keyof typeof CASOS_CLASE): Vocabulario => {
  const c = CASOS_CLASE[clave];
  return {
    variables: ESQUEMA_CLASE.filter((x) => c.variables.includes(x.nombre)).map((x) => ({
      nombre: x.nombre,
      obligatoria: true,
      permiteVacia: x.permiteVacia,
    })),
    condiciones: [...c.condiciones],
    listas: [...c.listas],
  };
};

/** Variables de N19, como las armaba `mensajeSuspension`. */
export function variablesSuspension(e: { nombrePila: string; clases: ClaseSuspendida[] }): Datos {
  const finCiclo = e.clases.find((cl) => cl.finCicloNuevo)?.finCicloNuevo;
  return {
    "alumno.nombre_pila": e.nombrePila,
    "clase.detalle": e.clases.map((cl) => `${cl.curso} del ${fmtLarga(cl.fecha)}`),
    "clase.varias": e.clases.length > 1,
    "clase.motivo": e.clases[0].motivoTexto,
    "clase.hay_ciclo": Boolean(finCiclo),
    ...(finCiclo ? { "clase.fin_ciclo": fmtLarga(finCiclo) } : {}),
  };
}

/** Variables de N20. */
export function variablesSuspensionProfesor(e: { nombrePila: string; curso: string; fecha: string; motivoTexto: string }): Datos {
  return {
    "profesor.nombre_pila": e.nombrePila,
    "clase.curso": e.curso,
    "clase.fecha": fmtLarga(e.fecha),
    "clase.motivo": e.motivoTexto,
  };
}

/** Variables de N21. */
export function variablesReapertura(e: { nombrePila: string; curso: string; fecha: string; finCiclo: string | null }): Datos {
  return {
    "alumno.nombre_pila": e.nombrePila,
    "clase.curso": e.curso,
    "clase.fecha": fmtLarga(e.fecha),
    "clase.hay_ciclo": Boolean(e.finCiclo),
    ...(e.finCiclo ? { "clase.fin_ciclo": fmtLarga(e.finCiclo) } : {}),
  };
}
