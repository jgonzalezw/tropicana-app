/**
 * Avisa, al arrancar `npm run dev`, si el proyecto vive dentro de una carpeta
 * que sincroniza sola (OneDrive, Dropbox, Google Drive).
 *
 * **Por qué existe.** Turbopack escribe la carpeta de build (`.next`) todo el
 * tiempo; un sincronizador la toca por debajo al mismo tiempo. El resultado es
 * un build a medias que se sirve igual: un cambio que no aparece, o una ruta
 * que existe y devuelve 404. Ya pasó tres veces en este proyecto, y las tres
 * se fue el tiempo revisando datos, RLS y componentes que estaban bien.
 *
 * **Por qué solo avisa y no lo arregla.** La salida natural sería mandar el
 * build afuera con `distDir`, pero la doc de Next lo prohíbe: *"distDir should
 * not leave your project directory"*. Así que no hay arreglo por configuración;
 * la única cura es mover el repo. Lo que sí se puede es que el riesgo se vea
 * cada vez, en lugar de aparecer disfrazado de bug tres semanas después.
 *
 * No falla el arranque a propósito: avisar es útil, bloquear el trabajo no.
 */

const SINCRONIZADORES = [
  ["onedrive", "OneDrive"],
  ["dropbox", "Dropbox"],
  ["google drive", "Google Drive"],
  ["googledrive", "Google Drive"],
  ["icloud", "iCloud Drive"],
];

const ruta = process.cwd();
const enc = ruta.toLowerCase();
const hallazgo = SINCRONIZADORES.find(([clave]) => enc.includes(clave));

if (hallazgo) {
  const [, nombre] = hallazgo;
  const linea = "─".repeat(72);
  console.warn(`\n\x1b[33m${linea}`);
  console.warn(`  ATENCION: el proyecto esta dentro de ${nombre}.`);
  console.warn(`  ${ruta}`);
  console.warn("");
  console.warn(`  ${nombre} sincroniza la carpeta .next mientras Turbopack la`);
  console.warn("  escribe. Eso da builds a medias que se sirven igual: un cambio");
  console.warn("  que no aparece, o una ruta que existe y devuelve 404.");
  console.warn("");
  console.warn("  Si algo no aparece, ANTES de revisar el codigo:");
  console.warn("      Remove-Item -Recurse -Force .next   (o: npm run dev:limpio)");
  console.warn("");
  console.warn("  Cura de raiz: mover el repo fuera de la carpeta sincronizada.");
  console.warn("  El respaldo lo da GitHub, no el sincronizador. (D2 en");
  console.warn("  docs/DECISIONES.md)");
  console.warn(`${linea}\x1b[0m\n`);
}
