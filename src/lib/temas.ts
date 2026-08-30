import { createClient } from "@/lib/supabase/server";

/**
 * Un tema es un juego de valores de estilo (tokens) sobre UNA MISMA
 * estructura de pantalla. Lo único que cambia entre temas son estos
 * valores: colores, tipografía, radios, tamaños, foco, sombras.
 *
 * El catálogo es AMPLIABLE por datos: los temas viven en la tabla
 * `public.temas` (una fila por tema, con su mapa de tokens en JSON).
 * Sumar una variante = insertar una fila; no hace falta tocar código.
 *
 * Los temas de abajo son el fallback "de fábrica": se usan si la tabla
 * `temas` todavía no existe (migración 0003 sin aplicar) o está vacía,
 * para que la app siga funcionando y sea testeable de una.
 */
export type Tema = {
  clave: string;
  nombre: string;
  descripcion: string | null;
  es_sistema: boolean;
  orden: number;
  /** Mapa de custom properties: { "--fondo": "#1c1815", ... } */
  tokens: Record<string, string>;
};

export const TEMA_DEFECTO = "tropicana";

/**
 * Tema por defecto: refleja los valores de :root en globals.css.
 * Es la fuente canónica del "Tropicana estándar" y la semilla de la
 * tabla `temas`.
 */
const TOKENS_TROPICANA: Record<string, string> = {
  "--fondo": "#1c1815",
  "--fondo-panel": "#272220",
  "--fondo-elevado": "#302a25",
  "--borde": "rgba(244, 235, 221, 0.16)",
  "--texto": "#f4ebdd",
  "--texto-tenue": "#c8bbaa",
  "--primario": "#e08b4f",
  "--primario-hover": "#f6a06b",
  "--primario-activo": "#b2622d",
  "--primario-texto": "#1c1815",
  "--exito": "#a8bb88",
  "--exito-fill": "#3a4726",
  "--exito-texto": "#dcebc4",
  "--peligro": "#ffc0a0",
  "--peligro-fill": "#6b3714",
  "--peligro-texto": "#ffd3b5",
  "--advertencia": "#f6a06b",
  "--radio-tarjeta": "28px",
  "--radio-panel": "20px",
  "--radio-control": "999px",
  "--radio-chico": "18px",
  "--fuente-base": "17px",
  "--foco-grosor": "2px",
  "--borde-grosor": "1px",
  "--sombra": "none",
};

/**
 * Tema de alta accesibilidad (baja visión). Mismo espíritu de marca,
 * ajustado para legibilidad: mayor contraste texto/fondo, tipografía
 * más grande, y foco/bordes más marcados. Sólo declara los tokens que
 * cambia respecto de :root; el resto se hereda del tema base.
 *
 * NOTA: estos valores NO vienen del handoff (el README define un solo
 * tema). Son una propuesta pensada para baja visión; ajustables editando
 * la fila de la tabla `temas` sin tocar código.
 */
const TOKENS_ALTO_CONTRASTE: Record<string, string> = {
  "--fondo": "#141110",
  "--fondo-panel": "#221d1a",
  "--fondo-elevado": "#2c2621",
  "--borde": "rgba(253, 246, 234, 0.42)",
  "--texto": "#fdf7ec",
  "--texto-tenue": "#e6dccb",
  "--primario": "#ef9a5b",
  "--primario-hover": "#ffb27d",
  "--primario-activo": "#c56a30",
  "--primario-texto": "#141110",
  "--exito": "#b9cc98",
  "--exito-fill": "#46552f",
  "--exito-texto": "#e7f2ce",
  "--peligro": "#ffccb0",
  "--peligro-fill": "#85431a",
  "--peligro-texto": "#ffe0cc",
  "--fuente-base": "20px",
  "--foco-grosor": "4px",
  "--borde-grosor": "2px",
};

export const TEMAS_BUILTIN: Tema[] = [
  {
    clave: "tropicana",
    nombre: "Tropicana estándar",
    descripcion: "Tema oscuro de marca, cálido y redondeado.",
    es_sistema: true,
    orden: 1,
    tokens: TOKENS_TROPICANA,
  },
  {
    clave: "tropicana_alto_contraste",
    nombre: "Tropicana alta accesibilidad",
    descripcion:
      "Variante para baja visión: más contraste, fuentes más grandes y foco/bordes marcados.",
    es_sistema: true,
    orden: 2,
    tokens: TOKENS_ALTO_CONTRASTE,
  },
];

/** Sólo permitimos nombres de custom property y valores seguros, para que
 *  un valor cargado por datos no pueda romper la hoja de estilos. */
const RE_CLAVE = /^--[a-z0-9-]+$/i;
function valorSeguro(v: string): boolean {
  return typeof v === "string" && !/[<>{};@]/.test(v);
}

/** Serializa el mapa de tokens de un tema a un bloque CSS con la
 *  especificidad de [data-theme], para inyectar en el <head>. */
export function bloqueCssTema(tema: Tema): string {
  const decls = Object.entries(tema.tokens)
    .filter(([k, v]) => RE_CLAVE.test(k) && valorSeguro(v))
    .map(([k, v]) => `${k}:${v.trim()};`)
    .join("");
  return `[data-theme="${tema.clave}"]{${decls}}`;
}

/** Catálogo de temas disponibles. Lee de la tabla `temas`; si no existe
 *  o está vacía, cae a los temas de fábrica. */
export async function obtenerTemas(): Promise<Tema[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("temas")
      .select("clave, nombre, descripcion, es_sistema, orden, tokens")
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (error || !data || data.length === 0) return TEMAS_BUILTIN;

    return data.map((t) => ({
      clave: t.clave as string,
      nombre: t.nombre as string,
      descripcion: (t.descripcion as string) ?? null,
      es_sistema: Boolean(t.es_sistema),
      orden: Number(t.orden ?? 0),
      tokens: (t.tokens as Record<string, string>) ?? {},
    }));
  } catch {
    return TEMAS_BUILTIN;
  }
}

/** Devuelve el tema activo (el elegido por `clave`, o el por defecto). */
export function resolverTema(temas: Tema[], clave: string | null | undefined): Tema {
  return (
    temas.find((t) => t.clave === clave) ??
    temas.find((t) => t.clave === TEMA_DEFECTO) ??
    temas[0] ??
    TEMAS_BUILTIN[0]
  );
}
