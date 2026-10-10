// R20 · E2 · H3 (grupo reservas) — captura de las referencias de N07–N08
// (solicitada), N11–N12 (suspendida), N13–N14 (restablecida), N15–N16
// (reprogramada) y N17–N18 (cancelada a pedido) desde el CÓDIGO ACTUAL.
//
// Igual que `capturar-referencias-n09-n10.mjs`: herramienta de una sola vez,
// válida SOLO contra el commit anterior a la extracción. Copia, sin tocarlas,
// las líneas de `particulares/acciones.ts` que arman cada texto y la función
// `avisos()` (que decide cuándo un aviso NO corresponde), las evalúa con
// entradas ficticias y guarda el resultado tal cual. Si una línea no es la
// esperada, aborta.
//
// Uso: node scripts/capturar-referencias-reservas.mjs <acciones.ts> <salida.json>
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , origen, salida] = process.argv;
if (!origen || !salida) throw new Error("Uso: capturar-referencias-reservas.mjs <acciones.ts> <salida.json>");
const L = readFileSync(origen, "utf8").split(/\r?\n/);

/** La única línea que contiene `texto` (o la n-ésima, 0-based, si se pide). */
function lineaCon(texto, n) {
  const hits = L.map((t, i) => [t, i]).filter(([t]) => t.includes(texto));
  const hit = n === undefined ? (hits.length === 1 ? hits[0] : null) : hits[n];
  if (!hit) throw new Error(`«${texto}»: ${hits.length} coincidencias${n === undefined ? " (se esperaba 1)" : ""}`);
  return hit[0].trim().replace(/,$/, "");
}
function bloque(inicio, fin) {
  const i = L.findIndex((t) => t.includes(inicio));
  if (i < 0) throw new Error(`No está «${inicio}»`);
  let j = i;
  while (!L[j].startsWith(fin)) j++;
  return L.slice(i, j + 1).join("\n");
}

const fechaHoraCorta = bloque("function fechaHoraCorta", "}");
const horario = bloque("function horario(", "}");
const h = lineaCon("const h = (min: number)");
const tipoCtx = bloque("type ContextoAviso = {", "};");
const avisosFn = bloque("function avisos(c: ContextoAviso | null", "}");
const saldoTexto = lineaCon("const saldoTexto = (c: ContextoAviso)");
const esAlq = lineaCon("const esAlquiler = m.categoria_aplicada != null;");
const plan = lineaCon("const planNombre = m.plan?.nombre ??");
const tuClase = lineaCon("tuClase: esAlquiler");
const tuClaseCorta = lineaCon("tuClaseCorta: esAlquiler");
const paqueteL = lineaCon("paquete: esAlquiler");
const alumnoN = lineaCon("alumnoNombre: alumnoNombre ||");
const guardaEstado = lineaCon('if (destino !== "confirmada" && destino !== "suspendida")');

// [id, línea del alumno, línea del profesor] — las líneas se leen del código.
const CASOS = {
  solicitada: [lineaCon("Hola! Estamos coordinando ${c?.tuClase}"), lineaCon("Hola! Estamos coordinando una clase particular")],
  suspendida_estado: [
    lineaCon("quedó suspendida (${etiquetaMotivoSuspension}). Esa hora vuelve"),
    lineaCon("quedó suspendida (${etiquetaMotivoSuspension}).`"),
  ],
  suspendida_operativa: [
    lineaCon("quedó suspendida (${campos.motivoTexto}). Esa hora vuelve"),
    lineaCon("quedó suspendida (${campos.motivoTexto}).`"),
  ],
  restablecida: [lineaCon("Hola! Se restableció ${c?.tuClase}"), lineaCon("Hola! Se restableció una clase particular")],
  reprogramada: [lineaCon("Hola! Reprogramamos"), lineaCon("Hola! Se reprogramó la clase particular")],
  cancelada_fuera_plazo: [lineaCon("Hola! Registramos la cancelación"), lineaCon("canceló fuera de plazo la clase particular")],
  cancelada_en_plazo: [lineaCon("Hola! Cancelamos ${c?.tuClaseCorta}"), lineaCon("Hola! Se canceló a pedido del alumno")],
};

const horarios = pathToFileURL(resolve("src/lib/horarios.ts")).href;
const casosJs = Object.entries(CASOS)
  .map(
    ([id, [a, p]]) => `  ${JSON.stringify(id)}: (c: ContextoAviso | null, E: any, cuando: string, antes: string, ahoraEs: string, lugar: string) => {
    const etiquetaMotivoSuspension = E.motivo;
    const campos = { motivoTexto: E.motivo };
    const plazoHoras = E.plazoHoras;
    void etiquetaMotivoSuspension; void campos; void plazoHoras; void antes; void ahoraEs;
    return avisos(c,
      ${a},
      ${p});
  },`
  )
  .join("\n");

const harness = `
import { formatearHoras, horaFin } from ${JSON.stringify(horarios)};
import { readFileSync, writeFileSync } from "node:fs";
${fechaHoraCorta}
${horario}
${h}
${tipoCtx}
${saldoTexto}
${avisosFn}
const CASOS: Record<string, any> = {
${casosJs}
};
const variantes = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out: Record<string, unknown> = {};
for (const [id, E] of Object.entries(variantes) as [string, any][]) {
  const m = { categoria_aplicada: E.esAlquiler ? "x" : null, plan: E.planNombre == null ? null : { nombre: E.planNombre } };
  const profesorNombre: string = E.profesorNombre;
  const alumnoNombre: string = E.alumnoNombre;
  const saldo = { contratadasMin: E.contratadasMin, disponibleMin: E.disponibleMin };
  ${esAlq}
  ${plan}
  const c: ContextoAviso | null = E.sinContexto ? null : {
    destinatario: E.sinDestinatario ? null : { nombre: E.destinatarioNombre, whatsapp: E.destinatarioWhatsapp },
    ${tuClase},
    ${tuClaseCorta},
    ${paqueteL},
    ${alumnoN},
    profesor: { nombre: profesorNombre, whatsapp: E.profesorWhatsapp },
    planNombre,
    contratadasMin: saldo.contratadasMin,
    disponibleMin: saldo.disponibleMin,
    lugar: () => E.lugar,
  };
  const cuando = horario(E.fecha, E.hora, E.duracionMin);
  const antes = E.anterior ? horario(E.anterior.fecha, E.anterior.hora, E.anterior.duracionMin) : "";
  const r = CASOS[E.caso](c, E, cuando, antes, cuando, E.lugar);
  out[id] = { entrada: E, resultado: r };
}
// Cuándo un cambio de estado NO emite aviso (cambiarEstadoReserva).
const guarda = (destino: string) => { ${guardaEstado} return false; return true; };
const estados = ["solicitada", "confirmada", "reprogramada", "reagendar", "suspendida", "ausente", "realizada"];
out["__avisaPorEstado"] = Object.fromEntries(estados.map((e) => [e, guarda(e)]));
writeFileSync(process.argv[3], JSON.stringify(out, null, 2) + "\\n", "utf8");
`;

const base = {
  esAlquiler: false, planNombre: "Paquete 10 h", profesorNombre: "Mario Rojas", alumnoNombre: "Ana Pérez",
  destinatarioNombre: "Luis Pérez (tutor)", destinatarioWhatsapp: "+59171234567", profesorWhatsapp: "+59178901234",
  contratadasMin: 600, disponibleMin: 450, fecha: "2026-10-02", hora: "15:00:00", duracionMin: 60, lugar: "Tropicana (Sala 1)",
  motivo: "feriado nacional", plazoHoras: 8,
  anterior: { fecha: "2026-10-01", hora: "18:00:00", duracionMin: 90 },
};
const alq = { esAlquiler: true, planNombre: "Alquiler Sala 1", profesorNombre: "", alumnoNombre: "Colegio Sol", destinatarioNombre: "Sofía Rivas (Colegio Sol)" };
const variantes = {};
for (const caso of Object.keys(CASOS)) {
  const b = { ...base, caso };
  const add = (nombre, cambios) => (variantes[`${caso}.${nombre}`] = { ...b, ...cambios });
  add("particular.base", {});
  add("particular.lugar_externo", { lugar: "Estudio Luna" });
  add("particular.lugar_tropicana_sin_sala", { lugar: "Tropicana" });
  add("particular.saldo_decimal", { contratadasMin: 630, disponibleMin: 15 });
  add("particular.saldo_cero", { contratadasMin: 60, disponibleMin: 0 });
  add("particular.sin_duracion", { duracionMin: 0, anterior: { ...base.anterior, duracionMin: 0 } });
  add("particular.fin_de_anio", { fecha: "2026-12-31", hora: "09:30:00", duracionMin: 45, anterior: { fecha: "2026-12-30", hora: "23:30:00", duracionMin: 60 } });
  add("particular.cambio_de_mes", { fecha: "2026-03-01", hora: "08:00:00", anterior: { fecha: "2026-02-28", hora: "08:00", duracionMin: 60 } });
  add("particular.sin_plan", { planNombre: null });
  add("particular.sin_nombre_alumno", { alumnoNombre: "" });
  add("particular.destinatario_propio", { destinatarioNombre: "Ana Pérez", destinatarioWhatsapp: null });
  add("particular.caracteres_especiales", { planNombre: "Clase ñandú ¡Más!", profesorNombre: "Íñigo Muñoz", alumnoNombre: "Ángela Núñez", lugar: "Estudio «Ñ»", motivo: "señor Núñez: ¡clausura!" });
  add("particular.sin_destinatario", { sinDestinatario: true });
  add("particular.sin_nombre_profesor", { profesorNombre: "" });
  add("particular.sin_contexto", { sinContexto: true });
  add("alquiler.base", { ...alq });
  add("alquiler.lugar_externo", { ...alq, lugar: "Estudio Luna" });
  add("alquiler.sin_plan", { ...alq, planNombre: null });
  add("alquiler.sin_nombre_titular", { ...alq, alumnoNombre: "" });
  add("alquiler.saldo_decimal", { ...alq, contratadasMin: 630, disponibleMin: 90 });
  add("alquiler.sin_destinatario", { ...alq, sinDestinatario: true });
  if (caso.startsWith("suspendida")) {
    add("particular.motivo_cierre_de_sala", { motivo: "un cierre de sala" });
    add("particular.motivo_con_glosa", { motivo: "Cierre de sala (Feriado)" });
    add("particular.motivo_bloqueo", { motivo: "Mantenimiento — pintura" });
    add("particular.motivo_vacio", { motivo: "" });
    add("particular.motivo_nulo", { motivo: null });
  }
  if (caso.startsWith("cancelada")) {
    add("particular.plazo_1h", { plazoHoras: 1 });
    add("particular.plazo_24h", { plazoHoras: 24 });
  }
}

const dir = mkdtempSync(join(tmpdir(), "r20-ref-res-"));
const arnes = join(dir, "arnes.ts");
const entradas = join(dir, "entradas.json");
writeFileSync(arnes, harness, "utf8");
writeFileSync(entradas, JSON.stringify(variantes), "utf8");
execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", arnes, entradas, resolve(salida)], { stdio: "inherit" });
console.log(`Referencias escritas en ${salida}: ${Object.keys(variantes).length} variantes.`);
