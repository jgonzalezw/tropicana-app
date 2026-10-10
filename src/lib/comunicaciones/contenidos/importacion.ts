/**
 * R20 · E4a — importación de los predeterminados a la base, como migraciones
 * GENERADAS y CONGELADAS. Puro: sin archivos ni base. Lo usan el script
 * `scripts/generar-importacion-predeterminados.mjs` y la prueba de deriva.
 *
 * Cada elemento generado lleva una marca legible que dice qué ya se importó:
 *   -- @contenido <clave>
 *   -- @uso <uso> <variante> <canal> <clave>
 *   -- @version <clave> <numero> <hash>
 * El estado «ya importado» es el conjunto de marcas de las migraciones del
 * repo, en orden. Una migración aplicada nunca se modifica: si cambia un
 * predeterminado, se genera otra que solo agrega lo nuevo (versiones en
 * borrador, y contenidos o asignaciones nuevos si los hay).
 */
import { serializarCanonico, hashContenido, type EsquemaCanonico } from "./hash.ts";
import type { ContenidoCatalogo } from "./catalogo.ts";

export type Importado = {
  contenidos: Set<string>;
  /** `uso|variante|canal` */
  usos: Set<string>;
  /** Por clave: la última versión importada. */
  versiones: Map<string, { numero: number; hash: string }>;
};

export type VersionEnSql = { clave: string; numero: number; hash: string; cuerpo: string; esquema: string };

const RE_VERSION =
  /-- @version (\S+) (\d+) ([0-9a-f]{64})\r?\n[\s\S]*?\$cuerpo\$([\s\S]*?)\$cuerpo\$[\s\S]*?\$esquema\$([\s\S]*?)\$esquema\$/g;

/** Las versiones que una migración generada incrusta (clave, número, hash declarado, cuerpo y esquema). */
export function versionesEnSql(sql: string): VersionEnSql[] {
  return [...sql.matchAll(RE_VERSION)].map((m) => ({
    clave: m[1],
    numero: Number(m[2]),
    hash: m[3],
    cuerpo: m[4],
    esquema: m[5],
  }));
}

/** Lo ya importado, leyendo las marcas de las migraciones en el orden dado. */
export function importadoDe(migraciones: readonly string[]): Importado {
  const out: Importado = { contenidos: new Set(), usos: new Set(), versiones: new Map() };
  for (const sql of migraciones) {
    for (const m of sql.matchAll(/^-- @contenido (\S+)\s*$/gm)) out.contenidos.add(m[1]);
    for (const m of sql.matchAll(/^-- @uso (\S+) (\S+) (\S+) \S+\s*$/gm)) out.usos.add(`${m[1]}|${m[2]}|${m[3]}`);
    for (const v of versionesEnSql(sql)) {
      const previa = out.versiones.get(v.clave);
      if (!previa || v.numero > previa.numero) out.versiones.set(v.clave, { numero: v.numero, hash: v.hash });
    }
  }
  return out;
}

export type Delta = {
  contenidos: ContenidoCatalogo[];
  usos: ContenidoCatalogo[];
  versiones: (ContenidoCatalogo & { numero: number })[];
};

/** Qué falta importar para que la base refleje el catálogo del código. */
export function calcularDelta(catalogo: readonly ContenidoCatalogo[], ya: Importado): Delta {
  return {
    contenidos: catalogo.filter((c) => !ya.contenidos.has(c.clave)),
    usos: catalogo.filter((c) => !ya.usos.has(`${c.uso}|${c.variante}|${c.canal}`)),
    versiones: catalogo
      .filter((c) => ya.versiones.get(c.clave)?.hash !== c.hash)
      .map((c) => ({ ...c, numero: (ya.versiones.get(c.clave)?.numero ?? 0) + 1 })),
  };
}

export const hayDelta = (d: Delta) => d.contenidos.length + d.usos.length + d.versiones.length > 0;

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

function citar(etiqueta: string, texto: string): string {
  const marca = `$${etiqueta}$`;
  if (texto.includes(marca)) throw new Error(`El texto contiene ${marca}`);
  if (texto.endsWith("$")) throw new Error("El texto termina en $: ambiguo con el cierre del literal");
  return `${marca}${texto}${marca}`;
}

/** El SQL (solo la parte generada) de un delta. Idempotente: `on conflict do nothing`. */
export function renderizarDelta(d: Delta, encabezado: string): string {
  const partes: string[] = [encabezado.trimEnd(), ""];
  for (const c of d.contenidos) {
    partes.push(
      `-- @contenido ${c.clave}`,
      "insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre, descripcion)",
      `values (${[c.clave, c.caso, c.variante, c.canal, c.tipo, c.finalidad, c.nombre, c.descripcion].map(q).join(", ")})`,
      "on conflict (clave) do nothing;",
      ""
    );
  }
  for (const c of d.usos) {
    partes.push(
      `-- @uso ${c.uso} ${c.variante} ${c.canal} ${c.clave}`,
      "insert into public.contenido_usos (uso, variante, canal, contenido_id)",
      `select ${q(c.uso)}, ${q(c.variante)}, ${q(c.canal)}, c.id from public.contenidos c where c.clave = ${q(c.clave)}`,
      "on conflict (uso, variante, canal) do nothing;",
      ""
    );
  }
  for (const v of d.versiones) {
    partes.push(
      `-- @version ${v.clave} ${v.numero} ${v.hash}`,
      "insert into public.contenido_versiones (contenido_id, numero, cuerpo, asunto, esquema, hash, origen, estado)",
      `select c.id, ${v.numero}, ${citar("cuerpo", v.cuerpo)}, ${v.asunto === null ? "null" : q(v.asunto)},`,
      `       ${citar("esquema", serializarCanonico(v.esquema as never))}::jsonb, ${q(v.hash)}, 'predeterminado', 'borrador'`,
      `  from public.contenidos c where c.clave = ${q(v.clave)}`,
      "on conflict (contenido_id, hash) do nothing;",
      ""
    );
  }
  return partes.join("\n");
}

/** ¿El texto incrustado en una migración reproduce el hash que declara? (detecta una edición a mano). */
export function hashDeVersionEnSql(v: VersionEnSql): string {
  return hashContenido({ cuerpo: v.cuerpo, asunto: null, esquema: JSON.parse(v.esquema) as EsquemaCanonico });
}
