#!/usr/bin/env node
// Prueba automática de la guardia de producción.
// Uso (desde la raíz del repo):  node .claude/hooks/guardia-produccion.test.mjs
//
// Verifica DOS cosas, porque las dos tienen que estar bien para que la guardia funcione:
//   A. Que el `matcher` de .claude/settings.json realmente invoque el hook para cualquier
//      conector MCP (con el nombre que tenga: mcp__Supabase__*, mcp__claude_ai_Supabase__*, otro).
//      Un matcher que no calza hace que el hook NO corra y la guardia quede apagada en silencio.
//   B. Que el hook decida bien: producción pide aprobación; dev y lecturas pasan.
//
// Corrélo después de tocar .claude/ o cuando cambie el nombre de un conector. Sale con código 1 si algo falla.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "..", "..");
const hook = join(aqui, "guardia-produccion.mjs");
const settings = JSON.parse(readFileSync(join(raiz, ".claude", "settings.json"), "utf8"));

// El id de producción se lee del propio hook: una sola fuente de verdad.
const fuente = readFileSync(hook, "utf8");
const PROD = (fuente.match(/PROYECTO_PRODUCCION\s*=\s*"([a-z0-9]+)"/) ?? [])[1];
if (!PROD) { console.error("No encontré PROYECTO_PRODUCCION en el hook."); process.exit(1); }
const DEV = "devdevdevdevdevdevde";

let fallas = 0;
const ok = (cond, titulo, detalle = "") => {
  console.log(`${cond ? "  ok  " : " FALLA"}  ${titulo}${!cond && detalle ? `  → ${detalle}` : ""}`);
  if (!cond) fallas++;
};

// ---------- A. El matcher invoca al hook ----------
console.log("\nA. El matcher de settings.json invoca al hook");
const entrada = settings?.hooks?.PreToolUse?.find((h) => h.hooks?.some((x) => /guardia-produccion/.test(x.command ?? "")));
ok(!!entrada, "settings.json registra guardia-produccion.mjs en PreToolUse");
const matcher = entrada?.matcher ?? "";
const calza = (nombre) => new RegExp(`^(?:${matcher})$`).test(nombre);
for (const n of [
  "mcp__Supabase__apply_migration",
  "mcp__claude_ai_Supabase__apply_migration",
  "mcp__claude_ai_Supabase__execute_sql",
  "mcp__cualquier_otro_conector__apply_migration",
  "Bash", "PowerShell", "Edit", "Write",
]) ok(calza(n), `el matcher cubre ${n}`);

// ---------- B. El hook decide bien ----------
console.log("\nB. El hook decide bien");
function correr(entradaCruda) {
  const r = spawnSync(process.execPath, [hook], { input: entradaCruda, encoding: "utf8", cwd: raiz });
  const salida = (r.stdout ?? "").trim();
  if (!salida) return "pasa";
  try { return JSON.parse(salida).hookSpecificOutput.permissionDecision; } catch { return `ilegible:${salida}`; }
}
const mcp = (herramienta, proyecto) =>
  JSON.stringify({ tool_name: herramienta, tool_input: { project_id: proyecto, query: "select 1" } });
const bash = (comando) => JSON.stringify({ tool_name: "Bash", tool_input: { command: comando } });

for (const conector of ["mcp__Supabase__", "mcp__claude_ai_Supabase__"]) {
  ok(correr(mcp(`${conector}apply_migration`, PROD)) === "ask", `${conector}apply_migration en PRODUCCIÓN pide aprobación`);
  ok(correr(mcp(`${conector}execute_sql`, PROD)) === "ask", `${conector}execute_sql en PRODUCCIÓN pide aprobación`);
  ok(correr(mcp(`${conector}list_tables`, PROD)) === "pasa", `${conector}list_tables en producción (lectura) pasa`);
  ok(correr(mcp(`${conector}apply_migration`, DEV)) === "pasa", `${conector}apply_migration en DEV pasa sin molestar`);
}
ok(correr(bash("git push origin main")) === "ask", "git push a main pide aprobación");
ok(correr(bash("git push origin h7-alquiler")) === "pasa", "git push a otra rama pasa");
ok(correr(bash('git commit -m "recordar hacer push a main"')) === "pasa", "un commit que menciona 'push' no se confunde");
ok(correr(JSON.stringify({ tool_name: "Edit", tool_input: { file_path: ".claude/settings.json" } })) === "ask", "editar .claude/ pide aprobación");
ok(correr("esto no es json") === "ask", "entrada ilegible: falla cerrado (pide aprobación)");

// ---------- C. Dev no queda interrumpido ----------
console.log("\nC. Permisos de dev");
const permitidas = settings?.permissions?.allow ?? [];
for (const n of ["mcp__claude_ai_Supabase__apply_migration", "mcp__claude_ai_Supabase__execute_sql", "mcp__Supabase__apply_migration"]) {
  ok(permitidas.includes(n), `${n} está en la lista de permitidas (dev sin ventana; producción lo frena el hook)`);
}

console.log(fallas ? `\n${fallas} FALLA(S): la guardia NO está bien. No hagas el pase hasta corregirlo.\n` : "\nTodo OK: la guardia de producción está activa para ambos conectores.\n");
process.exit(fallas ? 1 : 0);
