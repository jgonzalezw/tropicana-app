// R20 · E4a — genera la migracion que importa a la base los predeterminados de
// src/lib/comunicaciones/predeterminados como versiones en BORRADOR.
//  - La primera vez: todo (contenidos, asignaciones y versiones) -> 0072.
//  - Despues: SOLO lo que cambio (versiones nuevas en borrador; contenidos o
//    asignaciones nuevos si los hay). Nunca toca una migracion aplicada.
// Uso: node scripts/generar-importacion-predeterminados.mjs [--fecha=AAAAMMDD] [--verificar]
//   --verificar: no escribe; sale con codigo 1 si hay algo por importar.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();
const DIR = join(RAIZ, "supabase", "migrations");
const { construirCatalogo } = await import("../src/lib/comunicaciones/contenidos/catalogo.ts");
const { importadoDe, calcularDelta, hayDelta, renderizarDelta } = await import("../src/lib/comunicaciones/contenidos/importacion.ts");

const archivos = readdirSync(DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const migraciones = archivos.map((f) => readFileSync(join(DIR, f), "utf8"));
const delta = calcularDelta(construirCatalogo(), importadoDe(migraciones));

if (!hayDelta(delta)) {
  console.log("Nada que importar: la base (segun las migraciones del repo) ya refleja los predeterminados.");
  process.exit(0);
}
const resumen = `${delta.contenidos.length} contenido(s), ${delta.usos.length} asignacion(es), ${delta.versiones.length} version(es) nueva(s)`;
if (process.argv.includes("--verificar")) {
  console.error(`DERIVA: hay por importar ${resumen}. Correr: node scripts/generar-importacion-predeterminados.mjs`);
  process.exit(1);
}

const inicial = !archivos.some((f) => /_comunicaciones_predeterminados_/.test(f));
const ultimo = Math.max(...archivos.map((f) => Number(f.slice(0, 4))));
const fecha = (process.argv.find((a) => a.startsWith("--fecha=")) ?? "").slice(8) || new Date().toISOString().slice(0, 10).replaceAll("-", "");
const nombre = `${String(ultimo + 1).padStart(4, "0")}_comunicaciones_predeterminados_${inicial ? "inicial" : fecha}.sql`;
const encabezado = `-- =====================================================================
-- TROPICANA - ${nombre.slice(0, 4)}: importacion de los predeterminados de comunicaciones (R20 E4a)
-- GENERADA por scripts/generar-importacion-predeterminados.mjs desde
-- src/lib/comunicaciones/predeterminados. NO SE EDITA A MANO NI SE VUELVE A
-- MODIFICAR una vez aplicada: si cambia un predeterminado, se genera otra.
-- Importa ${resumen}.
-- Todo entra en estado 'borrador', origen 'predeterminado', y las asignaciones
-- quedan en modo 'legado' y sin version: NO aprueba, NO publica, NO libera.
-- Idempotente (on conflict do nothing). Los textos van exactos, sin normalizar.
-- =====================================================================
`;
writeFileSync(join(DIR, nombre), renderizarDelta(delta, encabezado), "utf8");
console.log(`Escrito supabase/migrations/${nombre}: ${resumen}.`);
