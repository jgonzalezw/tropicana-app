// R20 · E2 — inventario de avisos de WhatsApp. Falla (código 1) si:
//  - aparece un consumidor de `AvisoWhatsapp` que no está en el inventario, o falta uno;
//  - falta alguna de las 16 operaciones de entrada;
//  - algún caso N01–N21 no tiene referencias capturadas, plantilla o variantes.
// Uso: node scripts/inventario-avisos.mjs      (npm run inventario:avisos)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = process.cwd();
const rel = (p) => relative(RAIZ, p).split(sep).join("/");
function archivos(dir, salida = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, salida);
    else if (/\.(ts|tsx)$/.test(n)) salida.push(p);
  }
  return salida;
}
const FUENTES = archivos(join(RAIZ, "src"));
const texto = new Map(FUENTES.map((p) => [rel(p), readFileSync(p, "utf8")]));
const errores = [];

// ── Consumidores de AvisoWhatsapp (8 productivos + el muestrario) ──
const CONSUMIDORES = [
  "src/app/(privado)/administracion/sala/ClienteSalaHorario.tsx",
  "src/app/(privado)/membresias/(lista)/[id]/AvisosFicha.tsx",
  "src/app/(privado)/sala/ClienteDisponibilidadSala.tsx",
  "src/components/AvisosAfectados.tsx",
  "src/components/GestionReserva.tsx",
  "src/components/NuevaReserva.tsx",
  "src/components/nuevo/FilaReserva.tsx",
  "src/components/venta/ConfirmacionVenta.tsx",
  "src/components/nuevo/TarjetaConfirmacion.tsx", // muestrario
];
const usan = [...texto].filter(([ruta, t]) => ruta !== "src/components/AvisoWhatsapp.tsx" && /\bAvisoWhatsapp\b/.test(t)).map(([r]) => r);
for (const r of usan) if (!CONSUMIDORES.includes(r)) errores.push(`Consumidor de AvisoWhatsapp fuera del inventario: ${r}`);
for (const r of CONSUMIDORES) if (!usan.includes(r)) errores.push(`Consumidor del inventario que ya no usa AvisoWhatsapp: ${r}`);

// ── Operaciones de entrada (13 con generador propio + 3 que reutilizan uno) ──
const OPERACIONES = [
  "inscribirYCobrar", "venderPrueba", "venderParticular", "venderAlquiler",
  "crearReserva", "cambiarEstadoReserva", "suspenderReservaOperativa", "revertirSuspension",
  "reprogramarReserva", "moverReserva", "cancelarAPedido", "suspenderClase", "reabrirSesion",
  "guardarHorarioSala", "crearBloqueoSala", "cancelarReservaSala",
];
const donde = {};
for (const op of OPERACIONES) {
  const re = new RegExp(`export\\s+async\\s+function\\s+${op}\\b`);
  const en = [...texto].filter(([, t]) => re.test(t)).map(([r]) => r);
  if (en.length !== 1) errores.push(`Operación ${op}: ${en.length} definiciones (se esperaba 1)`);
  else donde[op] = en[0];
}

// ── Casos N01–N21: referencias, plantilla y variantes ──
const REF = "src/lib/comunicaciones/__referencias__";
const leerRef = (n) => JSON.parse(readFileSync(join(RAIZ, REF, n), "utf8"));
const refs = { "N09-N10.json": leerRef("N09-N10.json"), "reservas.json": leerRef("reservas.json"), "clases.json": leerRef("clases.json"), "ventas.json": leerRef("ventas.json") };
const claves = (n) => Object.keys(refs[n]).filter((k) => !k.startsWith("__"));
const CASOS = {
  N01: ["ventas.json", "N01."], N02: ["ventas.json", "N02."], N03: ["ventas.json", "N03."],
  N04: ["ventas.json", "N04-N05."], N05: ["ventas.json", "N04-N05."], N06: ["ventas.json", "N06."],
  N07: ["reservas.json", "solicitada."], N08: ["reservas.json", "solicitada."],
  N09: ["N09-N10.json", ""], N10: ["N09-N10.json", ""],
  N11: ["reservas.json", "suspendida_"], N12: ["reservas.json", "suspendida_"],
  N13: ["reservas.json", "restablecida."], N14: ["reservas.json", "restablecida."],
  N15: ["reservas.json", "reprogramada."], N16: ["reservas.json", "reprogramada."],
  N17: ["reservas.json", "cancelada_"], N18: ["reservas.json", "cancelada_"],
  N19: ["clases.json", "N19."], N20: ["clases.json", "N20."], N21: ["clases.json", "N21."],
};
const resumen = [];
for (const [n, [archivo, prefijo]] of Object.entries(CASOS)) {
  const k = claves(archivo).filter((c) => c.startsWith(prefijo)).length;
  if (!k) errores.push(`${n}: sin variantes de referencia en ${archivo}`);
  resumen.push(`${n}\t${k}\t${archivo}`);
}
const PLANTILLAS = {
  "src/lib/comunicaciones/predeterminados/reserva.ts": ["N07", "N08", "N09", "N10", "N11", "N12", "N13", "N14", "N15", "N16", "N17", "N18"],
  "src/lib/comunicaciones/predeterminados/clase.ts": ["N19", "N20", "N21"],
  "src/lib/comunicaciones/predeterminados/venta.ts": ["N01", "N02", "N03", "N04", "N05", "N06"],
};
for (const [archivo, ns] of Object.entries(PLANTILLAS)) {
  const t = texto.get(archivo);
  if (!t) { errores.push(`Falta ${archivo}`); continue; }
  for (const n of ns) if (!new RegExp(`["']?${n}(\\.[a-z_]+)?["']?\\s*:`).test(t)) errores.push(`${n}: sin plantilla en ${archivo}`);
}

console.log(`Consumidores de AvisoWhatsapp: ${usan.length} (inventario: ${CONSUMIDORES.length})`);
console.log(`Operaciones de entrada halladas: ${Object.keys(donde).length} de ${OPERACIONES.length}`);
console.log("Caso\tvariantes\treferencias");
for (const l of resumen) console.log(l);
if (errores.length) {
  console.error("\nINVENTARIO INCOMPLETO:\n- " + errores.join("\n- "));
  process.exit(1);
}
console.log("\nInventario completo: 9 consumidores, 16 operaciones, 21 casos con referencias y plantilla.");
