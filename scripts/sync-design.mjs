#!/usr/bin/env node
/**
 * Sincroniza los handoffs de Claude Design hacia el repo, tomándolos de una
 * carpeta de paso (buzón) en el disco local — sin Google Drive y sin copiar
 * contenido a mano.
 *
 * Flujo pensado para correr Claude Code (o Node) LOCALMENTE en la máquina que
 * tiene el buzón:
 *   1) Claude Design exporta el handoff (zip o carpeta).
 *   2) El export cae en el buzón  DESIGN_INBOX.
 *   3) Este script lo lee, reemplaza  docs/design/handoff/  con su contenido
 *      (mirror verbatim), y deja un manifiesto de qué se sincronizó.
 *
 * Uso:
 *   node scripts/sync-design.mjs                 # sincroniza y muestra el diff
 *   node scripts/sync-design.mjs --commit        # además: git add + commit
 *   node scripts/sync-design.mjs --archive       # mueve el export consumido a _procesados/
 *
 * Config por entorno (opcional):
 *   DESIGN_INBOX        carpeta de paso (default: la de Javier en OneDrive local)
 *   DESIGN_HANDOFF_DIR  destino del mirror (default: docs/design/handoff)
 */
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INBOX =
  process.env.DESIGN_INBOX ||
  "C:\\Users\\Javier\\OneDrive\\Natalia\\tropicana-Claude.Design-Handoff";
const HANDOFF_DIR =
  process.env.DESIGN_HANDOFF_DIR || path.join(REPO, "docs", "design", "handoff");
const ARGS = new Set(process.argv.slice(2));

function log(...a) {
  console.log(...a);
}
function fail(msg) {
  console.error("✗ " + msg);
  process.exit(1);
}

/** ¿Este directorio contiene, en su raíz, archivos del handoff? */
function esRaizHandoff(dir) {
  const items = fs.readdirSync(dir);
  return items.some((n) => n === "README.md" || n.endsWith(".dc.html"));
}

/** Baja hasta la raíz real del handoff (si viene envuelto en una sola carpeta). */
function encontrarRaiz(dir, prof = 0) {
  if (prof > 5) return dir;
  if (esRaizHandoff(dir)) return dir;
  const subdirs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory());
  if (subdirs.length === 1) {
    return encontrarRaiz(path.join(dir, subdirs[0].name), prof + 1);
  }
  return dir;
}

function extraerZip(zipPath, destino) {
  fs.mkdirSync(destino, { recursive: true });
  if (process.platform === "win32") {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destino}' -Force`,
      ],
      { stdio: "inherit" }
    );
  } else {
    execFileSync("unzip", ["-o", "-q", zipPath, "-d", destino], {
      stdio: "inherit",
    });
  }
}

/** Lista relativa de archivos de un dir, con su hash, para diffear. */
function inventario(dir) {
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  const walk = (d, base) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      const rel = path.join(base, e.name).split(path.sep).join("/");
      if (e.isDirectory()) walk(abs, rel);
      else if (rel !== ".synced.json") {
        out.set(rel, crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex"));
      }
    }
  };
  walk(dir, "");
  return out;
}

function diff(antes, despues) {
  const agregados = [], cambiados = [], borrados = [];
  for (const [rel, h] of despues) {
    if (!antes.has(rel)) agregados.push(rel);
    else if (antes.get(rel) !== h) cambiados.push(rel);
  }
  for (const rel of antes.keys()) if (!despues.has(rel)) borrados.push(rel);
  return { agregados, cambiados, borrados };
}

// ── 1. Validaciones ────────────────────────────────────────────────────────
if (!fs.existsSync(INBOX)) {
  fail(
    `No existe el buzón:\n    ${INBOX}\n` +
      `Creá la carpeta o definí DESIGN_INBOX con su ruta.`
  );
}
// Guardarraíl: nunca borrar algo fuera de docs/design/.
const handoffAbs = path.resolve(HANDOFF_DIR);
if (!handoffAbs.replace(/\\/g, "/").includes("/docs/design/")) {
  fail(`DESIGN_HANDOFF_DIR sospechoso (debe estar bajo docs/design/): ${handoffAbs}`);
}

// ── 2. Elegir la fuente (zip más nuevo, o carpeta, o archivos sueltos) ───────
const entradas = fs
  .readdirSync(INBOX, { withFileTypes: true })
  .filter((e) => !e.name.startsWith("_")); // ignora _procesados/, etc.

const zips = entradas
  .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".zip"))
  .map((e) => ({ name: e.name, mtime: fs.statSync(path.join(INBOX, e.name)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

let fuenteDir, origenDesc, tmpDir, fuenteEnBuzon;

if (zips.length) {
  const zip = path.join(INBOX, zips[0].name);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "design-sync-"));
  log(`• Export detectado (zip): ${zips[0].name}`);
  extraerZip(zip, tmpDir);
  fuenteDir = encontrarRaiz(tmpDir);
  origenDesc = zips[0].name;
  fuenteEnBuzon = zip;
} else {
  const subdirs = entradas
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, mtime: fs.statSync(path.join(INBOX, e.name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  const carpeta = subdirs.find((s) => {
    try {
      return esRaizHandoff(encontrarRaiz(path.join(INBOX, s.name)));
    } catch {
      return false;
    }
  });
  if (carpeta) {
    fuenteEnBuzon = path.join(INBOX, carpeta.name);
    fuenteDir = encontrarRaiz(fuenteEnBuzon);
    origenDesc = carpeta.name + "/";
    log(`• Export detectado (carpeta): ${carpeta.name}/`);
  } else if (esRaizHandoff(INBOX)) {
    fuenteDir = INBOX;
    origenDesc = "(archivos sueltos en el buzón)";
    log("• Export detectado: archivos sueltos en el buzón");
  } else {
    fail(
      "No encontré ningún handoff en el buzón (ni .zip, ni carpeta con README.md/*.dc.html)."
    );
  }
}

// ── 3. Reemplazar el mirror  docs/design/handoff/ ───────────────────────────
const antes = inventario(handoffAbs);
fs.rmSync(handoffAbs, { recursive: true, force: true });
fs.mkdirSync(handoffAbs, { recursive: true });
fs.cpSync(fuenteDir, handoffAbs, { recursive: true });

// ── 4. Manifiesto ───────────────────────────────────────────────────────────
const despues = inventario(handoffAbs);
const d = diff(antes, despues);
const manifiesto = {
  sincronizado_en: new Date().toISOString(),
  origen: origenDesc,
  buzon: INBOX,
  archivos: [...despues.keys()].sort(),
  cambios: { agregados: d.agregados.length, cambiados: d.cambiados.length, borrados: d.borrados.length },
};
fs.writeFileSync(
  path.join(handoffAbs, ".synced.json"),
  JSON.stringify(manifiesto, null, 2) + "\n"
);

// ── 5. Resumen ──────────────────────────────────────────────────────────────
log(`\n✓ Mirror actualizado: ${path.relative(REPO, handoffAbs)}`);
log(`  ${despues.size} archivos · +${d.agregados.length} nuevos · ~${d.cambiados.length} cambiados · -${d.borrados.length} borrados`);
for (const r of d.agregados) log("   + " + r);
for (const r of d.cambiados) log("   ~ " + r);
for (const r of d.borrados) log("   - " + r);
if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });

// ── 6. Archivar el export consumido (opcional) ──────────────────────────────
if (ARGS.has("--archive") && fuenteEnBuzon) {
  const destino = path.join(INBOX, "_procesados", new Date().toISOString().slice(0, 10));
  fs.mkdirSync(destino, { recursive: true });
  fs.renameSync(fuenteEnBuzon, path.join(destino, path.basename(fuenteEnBuzon)));
  log(`\n• Export archivado en _procesados/`);
}

// ── 7. Commit (opcional) ────────────────────────────────────────────────────
const sinCambios = !d.agregados.length && !d.cambiados.length && !d.borrados.length;
if (ARGS.has("--commit")) {
  if (sinCambios) {
    log("\n• Sin cambios: no hay nada que commitear.");
  } else {
    execFileSync("git", ["add", "docs/design/handoff"], { cwd: REPO, stdio: "inherit" });
    const msg = `chore(design): sync handoff desde buzon (${origenDesc})\n\n+${d.agregados.length} nuevos, ~${d.cambiados.length} cambiados, -${d.borrados.length} borrados.`;
    execFileSync("git", ["commit", "-m", msg], { cwd: REPO, stdio: "inherit" });
    log("\n✓ Commit hecho. Revisá y push cuando quieras (o corré con tu flujo habitual).");
  }
} else if (!sinCambios) {
  log("\n→ Revisá el diff y commiteá:  git add docs/design/handoff && git commit");
}
