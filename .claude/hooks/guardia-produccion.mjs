#!/usr/bin/env node
// Guardia de producción — hook PreToolUse de Claude Code.
//
// Regla de proceso 1 (docs/REGLAS.md): el pase a producción requiere el OK
// explícito de Javier, cada vez. Este hook hace que esa regla sea un control
// técnico y no solo una instrucción: frena y pide aprobación cuando una
// acción llega a producción o toca las propias reglas de permisos. Todo lo
// demás (dev, lecturas, código) pasa sin preguntar.
//
// Pide aprobación ("ask") cuando:
//   1. Una herramienta de Supabase apunta al proyecto de producción y no es
//      de solo lectura (list_* / get_* / search_*).
//   2. Un comando de shell hace `git push` hacia `main` (publica en Vercel).
//   3. Se edita un archivo de `.claude/` (settings, hooks): así ninguna sesión
//      afloja este control sin que Javier lo vea.
//
// Ante cualquier error al leer la entrada, pide aprobación (falla cerrado).
// Salida sin nada = sigue el flujo normal de permisos.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PROYECTO_PRODUCCION = "pnvhpbxjbdmbktpwebtx";
const PREFIJOS_SOLO_LECTURA = ["list_", "get_", "search_"];

function pedirAprobacion(motivo) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: `Guardia de producción: ${motivo}`,
      },
    })
  );
  process.exit(0);
}

function ramaActual() {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// Divide un tramo de shell en tokens, respetando comillas simples/dobles
// (aproximado; alcanza para reconocer un `git push`, no es un parser de
// shell completo).
function tokens(tramo) {
  const salida = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(tramo))) salida.push(m[1] ?? m[2] ?? m[3]);
  return salida;
}

// Flags globales de git que toman un valor en el token siguiente (a
// diferencia de `-c clave=valor`, que va en un solo token).
const FLAGS_GLOBALES_CON_VALOR = new Set(["-C", "--git-dir", "--work-tree", "--namespace", "--exec-path"]);

// ¿Este `git push` publica en main? Explícito (`main`, `HEAD:main`,
// `refs/heads/main`) o implícito (sin refspec, parado en main). Encuentra
// "push" como el subcomando real de `git` (saltando flags globales, con o
// sin su valor), no cualquier aparición de la palabra "push" en el comando
// — `git commit -m "recuerda hacer push"` no es un push.
function pushAMain(comando) {
  const tramos = comando.split(/&&|\|\||;|\n/);
  for (const tramo of tramos) {
    const toks = tokens(tramo);
    const inicioGit = toks.indexOf("git");
    if (inicioGit === -1) continue;

    let i = inicioGit + 1;
    let esPush = false;
    while (i < toks.length) {
      const t = toks[i];
      if (t.startsWith("-")) {
        i += FLAGS_GLOBALES_CON_VALOR.has(t) && !t.includes("=") ? 2 : 1;
        continue;
      }
      esPush = t === "push";
      i += 1;
      break;
    }
    if (!esPush) continue;

    const refspecs = toks.slice(i).filter((a) => a && !a.startsWith("-"));
    if (refspecs.some((r) => /(^|:)(refs\/heads\/)?main$/.test(r))) return true;
    if (refspecs.length === 0 && ramaActual() === "main") return true;
  }
  return false;
}

let entrada;
try {
  entrada = JSON.parse(readFileSync(0, "utf8"));
} catch {
  pedirAprobacion("no se pudo leer qué acción se va a ejecutar; se pide confirmación por las dudas.");
}

const herramienta = String(entrada.tool_name ?? "");
const datos = entrada.tool_input ?? {};

// 1. Supabase contra producción
if (herramienta.startsWith("mcp__") && JSON.stringify(datos).includes(PROYECTO_PRODUCCION)) {
  const accion = herramienta.split("__").pop() ?? "";
  if (!PREFIJOS_SOLO_LECTURA.some((p) => accion.startsWith(p))) {
    pedirAprobacion(`"${accion}" contra la base de PRODUCCIÓN (${PROYECTO_PRODUCCION}).`);
  }
}

// 2. git push a main
if (herramienta === "Bash" || herramienta === "PowerShell") {
  const comando = String(datos.command ?? "");
  if (pushAMain(comando)) {
    pedirAprobacion("git push a main publica en producción (Vercel).");
  }
  // Tocar la configuración de permisos desde la shell también se pregunta.
  if (/\.claude[\\/](settings|hooks)/.test(comando) && !/^\s*(cat|ls|git (diff|log|show|status))\b/.test(comando)) {
    pedirAprobacion("el comando menciona la configuración de permisos de Claude (.claude/settings o .claude/hooks).");
  }
}

// 3. Editar archivos de .claude/
if (["Edit", "Write", "NotebookEdit", "MultiEdit"].includes(herramienta)) {
  const ruta = String(datos.file_path ?? datos.notebook_path ?? "").replace(/\\/g, "/");
  // Solo el .claude/ del proyecto (no el ~/.claude/ personal de Claude Code).
  const proyecto = String(process.env.CLAUDE_PROJECT_DIR ?? entrada.cwd ?? process.cwd())
    .replace(/\\/g, "/")
    .replace(/\/$/, "");
  const esDelProyecto =
    ruta.startsWith(".claude/") || ruta.toLowerCase().startsWith(`${proyecto}/.claude/`.toLowerCase());
  if (esDelProyecto) {
    pedirAprobacion(`se va a modificar ${ruta}, parte de la configuración de permisos de Claude.`);
  }
}

process.exit(0);
