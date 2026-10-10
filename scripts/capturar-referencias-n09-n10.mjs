// R20 · E2 · H1 — captura de las referencias de N09 (reserva confirmada, alumno)
// y N10 (reserva confirmada, profesor) desde el CÓDIGO ACTUAL.
//
// Herramienta de una sola vez, válida SOLO contra el commit anterior a la
// extracción (`git show <commit>:src/app/(privado)/particulares/acciones.ts`).
// No reimplementa nada: copia, línea por línea y sin tocarlas, las piezas que
// arman el texto en `crearReserva` y `cambiarEstadoReserva`, las evalúa con las
// entradas ficticias de abajo y guarda la salida tal cual. Si una línea no es
// la esperada, aborta: la referencia no se captura de un código que cambió.
//
// Uso: node scripts/capturar-referencias-n09-n10.mjs <acciones.ts> <salida.json>
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , origen, salida] = process.argv;
if (!origen || !salida) throw new Error("Uso: capturar-referencias-n09-n10.mjs <acciones.ts> <salida.json>");
const L = readFileSync(origen, "utf8").split(/\r?\n/);
const linea = (n, debeContener) => {
  const t = L[n - 1];
  if (t === undefined || !t.includes(debeContener)) throw new Error(`Línea ${n} inesperada (se esperaba «${debeContener}»): ${t}`);
  return t;
};
const rango = (a, b, inicio, fin) => {
  linea(a, inicio);
  linea(b, fin);
  return L.slice(a - 1, b).join("\n");
};

// Piezas verbatim (números de línea del commit 4b1d4c6 + docs R20).
const fechaHoraCorta = rango(171, 177, "function fechaHoraCorta", "}");
const horario = rango(180, 182, "function horario", "}");
const h = linea(184, "const h = ");
const tipoCtx = rango(192, 206, "type ContextoAviso = {", "};");
const esAlq = linea(264, "const esAlquiler = m.categoria_aplicada != null;");
const plan = linea(265, "const planNombre = m.plan?.nombre ??");
const tuClase = linea(272, "tuClase: esAlquiler");
const tuClaseCorta = linea(273, "tuClaseCorta: esAlquiler");
const paquete = linea(274, "paquete: esAlquiler");
const alumnoN = linea(275, "alumnoNombre: alumnoNombre ||");
const saldoTexto = linea(298, "const saldoTexto = (c: ContextoAviso)");
// Los dos orígenes (crearReserva y cambiarEstadoReserva) deben ser idénticos.
const tAlumno = linea(1123, "Hola! Confirmamos ${c?.tuClase}").trim().replace(/,$/, "");
const tProf = linea(1124, "Hola! Se te confirmó una clase particular").trim().replace(/,$/, "");
if (linea(1455, "Hola! Confirmamos").trim().replace(/,$/, "") !== tAlumno) throw new Error("Los dos orígenes de N09 difieren");
if (linea(1456, "Hola! Se te confirmó").trim().replace(/,$/, "") !== tProf) throw new Error("Los dos orígenes de N10 difieren");

const horarios = pathToFileURL(resolve("src/lib/horarios.ts")).href;
const harness = `
import { formatearHoras, horaFin } from ${JSON.stringify(horarios)};
import { readFileSync, writeFileSync } from "node:fs";
${fechaHoraCorta}
${horario}
${h}
${tipoCtx}
${saldoTexto}
const variantes = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out: Record<string, unknown> = {};
for (const [id, E] of Object.entries(variantes) as [string, any][]) {
  const m = { categoria_aplicada: E.esAlquiler ? "x" : null, plan: E.planNombre == null ? null : { nombre: E.planNombre } };
  const profesorNombre: string = E.profesorNombre;
  const alumnoNombre: string = E.alumnoNombre;
  const saldo = { contratadasMin: E.contratadasMin, disponibleMin: E.disponibleMin };
  ${esAlq}
  ${plan}
  const c: ContextoAviso = {
    destinatario: null,
    ${tuClase}
    ${tuClaseCorta}
    ${paquete}
    ${alumnoN}
    profesor: { nombre: profesorNombre, whatsapp: null },
    planNombre,
    contratadasMin: saldo.contratadasMin,
    disponibleMin: saldo.disponibleMin,
    lugar: () => E.lugar,
  };
  const cuando = horario(E.fecha, E.hora, E.duracionMin);
  const lugar = c.lugar(1);
  const alumno = ${tAlumno};
  const profesor = ${tProf};
  out[id] = { entrada: E, alumno, profesor: E.esAlquiler ? null : profesor };
}
writeFileSync(process.argv[3], JSON.stringify(out, null, 2) + "\\n", "utf8");
`;

// Entradas ficticias. Una por variante; cada una cambia UNA cosa respecto de la base.
const base = {
  esAlquiler: false, planNombre: "Paquete 10 h", profesorNombre: "Mario Rojas", alumnoNombre: "Ana Pérez",
  contratadasMin: 600, disponibleMin: 450, fecha: "2026-10-02", hora: "15:00:00", duracionMin: 60, lugar: "Tropicana (Sala 1)",
};
const v = (cambios) => ({ ...base, ...cambios });
const alq = { esAlquiler: true, planNombre: "Alquiler Sala 1", profesorNombre: "", alumnoNombre: "Colegio Sol" };
const variantes = {
  "particular.base": v({}),
  "particular.lugar_externo": v({ lugar: "Estudio Luna" }),
  "particular.lugar_tropicana_sin_sala": v({ lugar: "Tropicana" }),
  "particular.hora_sin_segundos": v({ hora: "15:00", duracionMin: 90 }),
  "particular.domingo": v({ fecha: "2026-10-04" }),
  "particular.fin_de_anio": v({ fecha: "2026-12-31", hora: "09:30:00", duracionMin: 45 }),
  "particular.cambio_de_mes": v({ fecha: "2026-03-01", hora: "08:00:00" }),
  "particular.cruza_medianoche": v({ hora: "23:30:00", duracionMin: 60 }),
  "particular.sin_duracion": v({ duracionMin: 0 }),
  "particular.saldo_decimal_cuarto": v({ contratadasMin: 630, disponibleMin: 15 }),
  "particular.saldo_decimal_medio": v({ contratadasMin: 600, disponibleMin: 450 }),
  "particular.saldo_cero": v({ contratadasMin: 60, disponibleMin: 0 }),
  "particular.saldo_completo": v({ contratadasMin: 600, disponibleMin: 600 }),
  "particular.saldo_vacio": v({ contratadasMin: 0, disponibleMin: 0 }),
  "particular.sin_plan": v({ planNombre: null }),
  "particular.sin_nombre_alumno": v({ alumnoNombre: "" }),
  "particular.caracteres_especiales": v({ planNombre: "Clase ñandú ¡Más!", profesorNombre: "Íñigo Muñoz", alumnoNombre: "Ángela Núñez", lugar: "Estudio «Ñ»" }),
  "alquiler.base": v({ ...alq }),
  "alquiler.lugar_externo": v({ ...alq, lugar: "Estudio Luna" }),
  "alquiler.sin_plan": v({ ...alq, planNombre: null }),
  "alquiler.sin_nombre_titular": v({ ...alq, alumnoNombre: "" }),
  "alquiler.saldo_decimal": v({ ...alq, contratadasMin: 630, disponibleMin: 90 }),
  "alquiler.fin_de_anio": v({ ...alq, fecha: "2026-12-31", hora: "20:00:00", duracionMin: 120 }),
};

const dir = mkdtempSync(join(tmpdir(), "r20-ref-"));
const arnes = join(dir, "arnes.ts");
const entradas = join(dir, "entradas.json");
writeFileSync(arnes, harness, "utf8");
writeFileSync(entradas, JSON.stringify(variantes), "utf8");
execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", arnes, entradas, resolve(salida)], { stdio: "inherit" });
console.log(`Referencias escritas en ${salida}: ${Object.keys(variantes).length} variantes.`);
