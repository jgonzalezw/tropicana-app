import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Regla de calidad 8: toda pantalla arranca en el mismo borde, armada con
// `<Pagina>`. Costó dos veces el mismo día (Inscribir y Cuenta del alumno,
// 2026-09-24): cada pantalla tenía su propio contenedor y algunas se
// centraban solas.

const RAIZ = join(import.meta.dirname, "..");
const CARPETAS = [join(RAIZ, "app", "(privado)"), join(RAIZ, "components")];
const PAGINA = join(RAIZ, "components", "Pagina.tsx");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return p.endsWith(".tsx") ? [p] : [];
  });
}

function hallazgos(patron: RegExp): string[] {
  const out: string[] = [];
  for (const f of CARPETAS.flatMap(archivos)) {
    if (f === PAGINA) continue;
    readFileSync(f, "utf8")
      .split("\n")
      .forEach((l, i) => {
        if (patron.test(l)) out.push(`${relative(RAIZ, f)}:${i + 1}  ${l.trim()}`);
      });
  }
  return out;
}

test("ninguna pantalla ni componente se centra con mx-auto", () => {
  assert.deepEqual(hallazgos(/\bmx-auto\b/), []);
});

test("ninguna pantalla arma su propio contenedor: se usa <Pagina>", () => {
  // Un div cuyo className ARRANCA con el padding de pantalla y trae un ancho máximo.
  assert.deepEqual(hallazgos(/className="p-\d+(\s+sm:p-\d+)?\s+max-w-/), []);
});
