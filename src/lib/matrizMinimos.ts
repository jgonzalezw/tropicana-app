/**
 * Matriz de mínimos (C3-0a.3) — lógica pura, compartida entre el cliente
 * (qué campo mostrar y marcar obligatorio) y las acciones del servidor (qué
 * rechazar si falta). El editor vive en administracion/catalogos; acá vive
 * lo que consume esa configuración.
 */

import type { CampoMinimo, ContextoMinimo, DatosContactoExtra, MatrizMinimo, NivelMinimo } from "./tipos.ts";
import { CAMPOS_MINIMO, CONTEXTOS_MINIMO } from "./tipos.ts";

/** Niveles por campo para un contexto, con `-` (oculto) para lo que no está en la fila. */
export function nivelesDe(
  matriz: MatrizMinimo[],
  contexto: ContextoMinimo
): Record<CampoMinimo, NivelMinimo> {
  const niveles = {} as Record<CampoMinimo, NivelMinimo>;
  for (const campo of CAMPOS_MINIMO) niveles[campo] = "-";
  for (const fila of matriz) if (fila.contexto === contexto) niveles[fila.campo] = fila.nivel;
  return niveles;
}

/**
 * Qué contexto aplica al formulario de alumno, según lo que ya elige la
 * pantalla: si está marcado "es menor" manda `alumno_menor` — incluso desde
 * la clase de prueba (Javier, 2026-09-24: "las reglas de alumno menor", no
 * las de `prueba`, para no vender una prueba a un menor sin tutor). Si no es
 * menor, `prueba` o `alumno_adulto` según desde dónde se abrió el formulario.
 */
export function contextoAlumno(args: { esMenor: boolean; enPrueba: boolean }): ContextoMinimo {
  if (args.esMenor) return "alumno_menor";
  return args.enPrueba ? "prueba" : "alumno_adulto";
}

/**
 * Campos obligatorios (`O`) que no están completos. `presente` lo arma quien
 * llama (el formulario o la acción): esta función no sabe qué forma tiene un
 * WhatsApp o una red social, solo compara nivel contra presencia.
 */
export function faltantes(
  niveles: Record<CampoMinimo, NivelMinimo>,
  presente: Partial<Record<CampoMinimo, boolean>>
): CampoMinimo[] {
  return CAMPOS_MINIMO.filter((campo) => niveles[campo] === "O" && !presente[campo]);
}

/**
 * Los campos "extra" (`CamposContacto`) traducidos a presencia para
 * `faltantes()`. Comparten esta forma las 5 acciones que crean/editan un
 * alumno o un profesor — nombre/apellido/whatsapp/tutor/es_menor/
 * tipo_profesor se arman aparte en cada acción, porque son propios de cada
 * formulario.
 */
export function presenteDesdeExtra(extra: DatosContactoExtra): Partial<Record<CampoMinimo, boolean>> {
  return {
    red_social: extra.redes.length > 0,
    email: !!extra.email?.trim(),
    sexo: !!extra.sexo,
    documento: !!extra.documento?.numero.trim(),
    nacimiento: !!extra.fecha_nacimiento,
    consentimiento: extra.consentimiento?.otorgado === true,
  };
}

export type CeldaBloqueada = {
  contexto: ContextoMinimo;
  campo: CampoMinimo;
  nivel: NivelMinimo;
  motivo: string;
};

/**
 * Celdas de las que depende la lógica del sistema, no solo la pantalla: la
 * base exige nombre/razón social por `tipo`, y el WhatsApp (o el tutor, si
 * es menor) es lo que identifica al alumno y detecta duplicados — tocar
 * estas celdas desde el editor rompería esos mecanismos, no solo ocultaría
 * un campo. Coincide exactamente con lo que sembró la 0048: bloquear no
 * cambia ningún valor, solo impide que cambie.
 */
export const CELDAS_BLOQUEADAS: CeldaBloqueada[] = [
  ...CONTEXTOS_MINIMO.filter((c) => c !== "tercero_org").map(
    (contexto): CeldaBloqueada => ({
      contexto,
      campo: "nombre",
      nivel: "O",
      motivo: "La base exige nombre para todo contacto que no sea una organización.",
    })
  ),
  {
    contexto: "tercero_org",
    campo: "nombre",
    nivel: "-",
    motivo: "Una organización se identifica por razón social, no por nombre de persona.",
  },
  {
    contexto: "tercero_org",
    campo: "razon_social",
    nivel: "O",
    motivo: "La base exige razón social para una organización.",
  },
  {
    contexto: "alumno_adulto",
    campo: "whatsapp",
    nivel: "O",
    motivo: "Identifica al alumno adulto y detecta duplicados.",
  },
  {
    contexto: "prueba",
    campo: "whatsapp",
    nivel: "O",
    motivo: "Identifica al titular de la prueba y detecta duplicados (mismo formulario que alumno adulto).",
  },
  {
    contexto: "alumno_menor",
    campo: "whatsapp",
    nivel: "-",
    motivo: "Un menor no guarda WhatsApp propio: se identifica por el del tutor.",
  },
  {
    contexto: "alumno_menor",
    campo: "tutor",
    nivel: "O",
    motivo: "Identifica al menor (junto con su nombre) y detecta duplicados.",
  },
  {
    contexto: "alumno_adulto",
    campo: "es_menor",
    nivel: "O",
    motivo: "Es lo que define este contexto: siempre se decide.",
  },
  {
    contexto: "alumno_menor",
    campo: "es_menor",
    nivel: "O",
    motivo: "Es lo que define este contexto: siempre se decide.",
  },
  {
    contexto: "profesor",
    campo: "tipo_profesor",
    nivel: "O",
    motivo: "Fija la tarifa de sala del profesor: siempre se define.",
  },
];

const MAPA_BLOQUEADAS = new Map<string, CeldaBloqueada>(
  CELDAS_BLOQUEADAS.map((c) => [`${c.contexto}:${c.campo}`, c])
);

export function celdaBloqueada(contexto: ContextoMinimo, campo: CampoMinimo): CeldaBloqueada | undefined {
  return MAPA_BLOQUEADAS.get(`${contexto}:${campo}`);
}

/**
 * Interés y facturación: la 0048 los sembró en la matriz, pero ninguna tabla
 * los guarda todavía (medido el 2026-09-24, C3-0a.3). No editables desde el
 * editor hasta que exista dónde guardarlos — regla de calidad 5: se explica,
 * no desaparece.
 */
export const CAMPOS_SIN_ALMACENAMIENTO: CampoMinimo[] = ["interes", "facturacion"];
