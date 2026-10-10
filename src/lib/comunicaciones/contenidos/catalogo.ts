/**
 * R20 · E4a — catálogo de contenidos y de asignaciones (uso, variante, canal).
 * UNA sola definición, mantenida junto al inventario de avisos: la migración de
 * importación, la prueba de deriva y el inventario salen de acá. Nadie copia
 * textos ni usos a mano.
 *
 * 21 casos (N01–N21), 24 plantillas de WhatsApp, 24 asignaciones. El email está
 * modelado en la base pero no tiene plantillas hasta 8c.
 */
import { CASOS_CLASE, ESQUEMA_CLASE } from "../predeterminados/clase.ts";
import { CASOS_RESERVA, ESQUEMA_RESERVA } from "../predeterminados/reserva.ts";
import { CASOS_VENTA, ESQUEMA_VENTA } from "../predeterminados/venta.ts";
import { marcadoresDe } from "../plantillas.ts";
import { hashContenido, type EsquemaCanonico } from "./hash.ts";

export type Canal = "whatsapp" | "email";

/** Una fila de la correspondencia explícita plantilla → asignación. */
export type Correspondencia = {
  caso: string;
  /** La clave de la plantilla en `CASOS_*` de predeterminados. */
  plantilla: string;
  /** El punto de la operación, sin la variante. */
  uso: string;
  variante: string;
};

/** Las 24 asignaciones, una por plantilla. Cada una se libera por separado. */
export const CORRESPONDENCIAS: readonly Correspondencia[] = [
  { caso: "N01", plantilla: "N01", uso: "venta.inscripcion.alumno", variante: "unica" },
  { caso: "N02", plantilla: "N02", uso: "venta.recibo.alumno", variante: "unica" },
  { caso: "N03", plantilla: "N03", uso: "venta.prueba.alumno", variante: "unica" },
  { caso: "N04", plantilla: "N04", uso: "venta.particular.alumno", variante: "unica" },
  { caso: "N05", plantilla: "N05", uso: "venta.particular.profesor", variante: "unica" },
  { caso: "N06", plantilla: "N06.titular", uso: "venta.alquiler", variante: "titular" },
  { caso: "N06", plantilla: "N06.contacto", uso: "venta.alquiler", variante: "contacto" },
  { caso: "N07", plantilla: "N07", uso: "reserva.solicitada.alumno", variante: "unica" },
  { caso: "N08", plantilla: "N08", uso: "reserva.solicitada.profesor", variante: "unica" },
  { caso: "N09", plantilla: "N09", uso: "reserva.confirmada.alumno", variante: "unica" },
  { caso: "N10", plantilla: "N10", uso: "reserva.confirmada.profesor", variante: "unica" },
  { caso: "N11", plantilla: "N11", uso: "reserva.suspendida.alumno", variante: "unica" },
  { caso: "N12", plantilla: "N12", uso: "reserva.suspendida.profesor", variante: "unica" },
  { caso: "N13", plantilla: "N13", uso: "reserva.restablecida.alumno", variante: "unica" },
  { caso: "N14", plantilla: "N14", uso: "reserva.restablecida.profesor", variante: "unica" },
  { caso: "N15", plantilla: "N15", uso: "reserva.reprogramada.alumno", variante: "unica" },
  { caso: "N16", plantilla: "N16", uso: "reserva.reprogramada.profesor", variante: "unica" },
  { caso: "N17", plantilla: "N17.fuera_de_plazo", uso: "reserva.cancelada_pedido.alumno", variante: "fuera_de_plazo" },
  { caso: "N17", plantilla: "N17.en_plazo", uso: "reserva.cancelada_pedido.alumno", variante: "en_plazo" },
  { caso: "N18", plantilla: "N18.fuera_de_plazo", uso: "reserva.cancelada_pedido.profesor", variante: "fuera_de_plazo" },
  { caso: "N18", plantilla: "N18.en_plazo", uso: "reserva.cancelada_pedido.profesor", variante: "en_plazo" },
  { caso: "N19", plantilla: "N19", uso: "clase.suspendida.alumno", variante: "unica" },
  { caso: "N20", plantilla: "N20", uso: "clase.suspendida.profesor", variante: "unica" },
  { caso: "N21", plantilla: "N21", uso: "clase.restablecida.alumno", variante: "unica" },
];

type Fuente = { clave: string; evento: string; destinatario: string; plantilla: string };
type VariableDeEsquema = { nombre: string; permiteVacia?: boolean };

/** Todas las plantillas del código, por su clave (`N06.titular`, `N09`…). */
export const FUENTES: Record<string, { caso: Fuente; esquema: readonly VariableDeEsquema[] }> = {};
for (const [k, c] of Object.entries(CASOS_VENTA)) FUENTES[k] = { caso: c, esquema: ESQUEMA_VENTA };
for (const [k, c] of Object.entries(CASOS_RESERVA)) FUENTES[k] = { caso: c, esquema: ESQUEMA_RESERVA };
for (const [k, c] of Object.entries(CASOS_CLASE)) FUENTES[k] = { caso: c, esquema: ESQUEMA_CLASE };

export type ContenidoCatalogo = {
  /** `<caso>.<variante>.<canal>` */
  clave: string;
  caso: string;
  variante: string;
  canal: Canal;
  tipo: "aviso";
  finalidad: "servicio";
  nombre: string;
  descripcion: string;
  uso: string;
  cuerpo: string;
  asunto: string | null;
  esquema: EsquemaCanonico;
  hash: string;
};

export const claveContenido = (caso: string, variante: string, canal: Canal) => `${caso}.${variante}.${canal}`;

/** El esquema que viaja con la versión: lo que la plantilla usa, en el orden en que lo usa. */
export function esquemaDe(plantilla: string, esquema: readonly VariableDeEsquema[]): EsquemaCanonico {
  const m = marcadoresDe(plantilla);
  return {
    condiciones: m.condiciones,
    listas: m.listas,
    variables: m.variables.map((nombre) => ({
      nombre,
      obligatoria: true,
      permiteVacia: esquema.find((x) => x.nombre === nombre)?.permiteVacia === true,
    })),
  };
}

export function construirCatalogo(): ContenidoCatalogo[] {
  return CORRESPONDENCIAS.map((c) => {
    const f = FUENTES[c.plantilla];
    if (!f) throw new Error(`La correspondencia ${c.caso}/${c.plantilla} no tiene plantilla en predeterminados`);
    const cuerpo = f.caso.plantilla;
    const esquema = esquemaDe(cuerpo, f.esquema);
    return {
      clave: claveContenido(c.caso, c.variante, "whatsapp"),
      caso: c.caso,
      variante: c.variante,
      canal: "whatsapp",
      tipo: "aviso",
      finalidad: "servicio",
      nombre: `${c.caso} · ${f.caso.evento}${c.variante === "unica" ? "" : ` · ${c.variante}`}`,
      descripcion: f.caso.destinatario,
      uso: c.uso,
      cuerpo,
      asunto: null,
      esquema,
      hash: hashContenido({ cuerpo, asunto: null, esquema }),
    };
  });
}
