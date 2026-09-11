/**
 * Borra la carpeta de build antes de arrancar (`npm run dev:limpio`).
 *
 * Existe para que la recuperación sea **un comando** y no tres pasos que hay
 * que recordar en el peor momento. Es el remedio, no la cura: la cura es que
 * el repo no viva dentro de una carpeta que sincroniza sola (ver
 * `scripts/chequeo-entorno.mjs` y D2 en `docs/DECISIONES.md`).
 *
 * Multiplataforma a propósito: `Remove-Item` es de PowerShell y `rm -rf` no
 * existe en Windows. Una instrucción que solo funciona en una máquina se
 * vuelve a perder.
 */

import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const dir = resolve(process.cwd(), ".next");
try {
  await rm(dir, { recursive: true, force: true });
  console.log(`Build borrada: ${dir}`);
} catch (e) {
  console.error(`No se pudo borrar ${dir}: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
