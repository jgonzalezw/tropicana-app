// R20 · E2 · H3 (grupo ventas) — captura de las referencias de N01 (confirmación
// de inscripción), N02 (recibo de pago), N03 (clase de prueba), N04/N05
// (particular: alumno y profesor) y N06 (alquiler) desde el CÓDIGO ACTUAL.
//
// Igual que los otros capturadores: herramienta de una sola vez, válida SOLO
// contra el commit anterior a la extracción. N01/N02 viven en
// `src/lib/venta/mensajeInscripcion.ts` (ya puras): se copia el archivo entero
// con sus imports reescritos. Los textos de N03–N06 están dentro de las
// acciones de venta: se copian, sin tocarlas, las líneas que los arman. Si una
// línea no es la esperada, aborta.
//
// Uso: node scripts/capturar-referencias-ventas.mjs <mensajeInscripcion.ts> <inscribir-acciones.ts> <accionesAlquiler.ts> <salida.json>
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , origenMsg, origenVenta, origenAlq, salida] = process.argv;
if (!origenMsg || !origenVenta || !origenAlq || !salida)
  throw new Error("Uso: capturar-referencias-ventas.mjs <mensajeInscripcion.ts> <inscribir-acciones.ts> <accionesAlquiler.ts> <salida.json>");
const leer = (p) => readFileSync(p, "utf8").split(/\r?\n/);
const V = leer(origenVenta);
const Q = leer(origenAlq);

function indices(L, texto) {
  return L.map((t, i) => [t, i]).filter(([t]) => t.includes(texto)).map(([, i]) => i);
}
function unico(L, texto) {
  const ix = indices(L, texto);
  if (ix.length !== 1) throw new Error(`«${texto}»: ${ix.length} coincidencias (se esperaba 1)`);
  return ix[0];
}
const linea = (L, texto) => L[unico(L, texto)].trim().replace(/,$/, "");
/** Desde la línea con `desde` hasta la siguiente con `hasta` (inclusive). */
function tramo(L, desde, hasta) {
  const i = unico(L, desde);
  const j = L.findIndex((t, k) => k >= i && t.includes(hasta));
  if (j < 0) throw new Error(`No está «${hasta}» después de «${desde}»`);
  return L.slice(i, j + 1).map((t) => t.trim()).join("\n");
}

// ── N01 / N02: el archivo entero, con sus imports apuntando al repo ──
const dir = mkdtempSync(join(tmpdir(), "r20-ref-ventas-"));
const url = (rel) => pathToFileURL(resolve(rel)).href;
const msgSrc = readFileSync(origenMsg, "utf8")
  .replace('"../horarios.ts"', JSON.stringify(url("src/lib/horarios.ts")))
  .replace('"../inscripcion.ts"', JSON.stringify(url("src/lib/inscripcion.ts")));
if (msgSrc.includes('"../')) throw new Error("Quedó un import relativo sin reescribir");
const msgPath = join(dir, "mensajeInscripcion_previo.ts");
writeFileSync(msgPath, msgSrc, "utf8");

// ── N03: clase de prueba ──
const gente = linea(V, "const gente = personas === 1");
const clases = tramo(V, "const clases = guardadas", ".map((g) =>");
const sujetoP = linea(V, "const sujetoP =");
const mensajePrueba = linea(V, "Hola! Confirmamos ${sujetoP}");

// ── N04 / N05: particular ──
const esFija = linea(V, 'const esFija = e.agenda.modalidad === "fija";');
const restoCoordina = linea(V, "const restoCoordina = !!leftoverMin");
const introAlumno = tramo(V, "const introAlumno = esFija", '"Tu primera clase reservada es";');
const introProfesor = linea(V, "const introProfesor = esFija");
const mensajeParticularAlumno = linea(V, "Hola! Confirmamos tu paquete de ${horasContratadas} h");
const mensajeParticularProfesor = linea(V, "Hola! Se te agendó una clase particular");

// ── N06: alquiler ──
const resto = linea(Q, "const resto = leftoverMin");
const ternario = tramo(Q, "destino.nombre === contacto.nombre", "Los esperamos!`").replace(/,$/, "");

// ── N02 sólo si se cobró algo ──
const expresionRecibo = linea(V, "...(porPlata > 0").replace(/^\.\.\.\(/, "");

const harness = `
import { readFileSync, writeFileSync } from "node:fs";
import { gs, fechaLarga } from ${JSON.stringify(url("src/lib/inscripcion.ts"))};
import { mensajeConfirmacionInscripcion, mensajeReciboPago } from ${JSON.stringify(pathToFileURL(msgPath).href)};

function prueba(d: any): string {
  const { personas, guardadas, nombreCurso } = d;
  const titular = { esMenor: d.esMenor };
  const quien: string = d.quien;
  const plan = { nombre: d.planNombre };
  ${gente}
  ${clases}
  ${sujetoP}
  return ({
    ${mensajePrueba}
  }).mensaje;
}

function particular(d: any): { alumno: string; profesor: string } {
  const { horasContratadas, planNombre, nombreProfesor, dondeTexto, agendaTexto, leftoverMin } = d;
  const alumno = { nombre: d.alumnoNombre };
  const e = { agenda: { modalidad: d.modalidad } };
  const sesiones: unknown[] = Array(d.nSesiones).fill({});
  ${esFija}
  ${restoCoordina}
  ${introAlumno}
  ${introProfesor}
  return {
    alumno: ({ ${mensajeParticularAlumno} }).mensaje,
    profesor: ({ ${mensajeParticularProfesor} }).mensaje,
  };
}

function alquiler(d: any): string {
  const { planNombre, horas, dondeTexto, agendaTexto, leftoverMin } = d;
  const contacto = { nombre: d.contactoNombre };
  const destino = { nombre: d.destinoNombre };
  ${resto}
  return ${ternario};
}

const avisaRecibo = (porPlata: number) => ${expresionRecibo};

const variantes = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out: Record<string, unknown> = {};
for (const [id, E] of Object.entries(variantes) as [string, any][]) {
  let r: unknown;
  if (E.caso === "inscripcion") r = mensajeConfirmacionInscripcion(E.datos, gs);
  else if (E.caso === "recibo") r = mensajeReciboPago(E.datos, gs);
  else if (E.caso === "prueba") r = prueba({ ...E, nombreCurso: new Map(E.nombreCurso) });
  else if (E.caso === "particular") r = particular(E);
  else r = alquiler(E);
  out[id] = { entrada: E, resultado: r };
}
out["__avisaRecibo"] = Object.fromEntries([-1, 0, 0.5, 1, 75, 1500].map((p) => [String(p), avisaRecibo(p)]));
writeFileSync(process.argv[3], JSON.stringify(out, null, 2) + "\\n", "utf8");
`;

// ── Variantes (datos ficticios) ──
const v = {};
const cursoA = { nombre: "Salsa", dias: [1, 3], hora: "19:00", duracionMin: 90 };
const cursoB = { nombre: "Bachata", dias: [5], hora: null, duracionMin: null };
const baseInsc = {
  alumno: "Ana Pérez", esMenor: false, plan: "Plan Doble", cursos: [cursoA, cursoB], clasesPlan: 12, bono: 0, cicloDias: 30,
  inicio: "lun 5 oct", fin: "vie 6 nov", tolerancia: 1, precio: 1200, credito: 0, cobrado: 1200, medio: "Efectivo", saldo: 0, compromiso: null,
};
const insc = (nombre, cambios) => (v[`N01.${nombre}`] = { caso: "inscripcion", datos: { ...baseInsc, ...cambios } });
insc("base", {});
insc("menor_con_tutor", { esMenor: true, alumno: "Sofía Rivas" });
insc("un_curso", { cursos: [cursoA] });
insc("curso_sin_dias_ni_horario", { cursos: [{ nombre: "Kizomba", dias: [], hora: null, duracionMin: null }] });
insc("curso_con_hora_sin_duracion", { cursos: [{ nombre: "Kizomba", dias: [2, 4], hora: "18:30", duracionMin: null }] });
insc("sin_cursos", { cursos: [] });
insc("una_clase", { clasesPlan: 1 });
insc("ilimitado", { clasesPlan: null, cicloDias: 30 });
insc("ilimitado_sin_ciclo", { clasesPlan: null, cicloDias: null });
insc("bono_sin_curso", { bono: 1 });
insc("bono_un_curso", { bono: 2, bonoCursos: [{ curso: "Salsa", clases: 2 }] });
insc("bono_dos_cursos", { bono: 3, bonoCursos: [{ curso: "Salsa", clases: 2 }, { curso: "Bachata", clases: 1 }] });
insc("bono_curso_lista_vacia", { bono: 2, bonoCursos: [] });
insc("sin_fin", { fin: null });
insc("tolerancia_cero", { tolerancia: 0 });
insc("tolerancia_dos", { tolerancia: 2 });
insc("con_credito_de_prueba", { precio: 1200, credito: 150, cobrado: 1050 });
insc("sin_pago", { cobrado: 0, saldo: 1200 });
insc("saldo_con_compromiso", { cobrado: 600, saldo: 600, compromiso: "vie 16 oct" });
insc("saldo_sin_compromiso", { cobrado: 600, saldo: 600, compromiso: null });
insc("pago_sin_medio", { medio: null });
insc("montos_con_miles_y_decimales", { precio: 1234567.5, cobrado: 1000000.25, saldo: 234567.25, credito: 0, compromiso: "lun 2 nov" });
insc("caracteres_especiales", { alumno: "Ángela Núñez", plan: "Plan ¡Más! Ñandú", cursos: [{ nombre: "Ñoño «Ñ»", dias: [6], hora: "09:00", duracionMin: 60 }], medio: "Transferencia — QR" });
insc("fin_de_anio", { inicio: "jue 31 dic", fin: "dom 31 ene" });

const baseRec = { alumno: "Ana Pérez", plan: "Plan Doble", fecha: "lun 5 oct", monto: 1200, medio: "Efectivo", saldo: 0, compromiso: null };
const rec = (nombre, cambios) => (v[`N02.${nombre}`] = { caso: "recibo", datos: { ...baseRec, ...cambios } });
rec("saldada", {});
rec("sin_medio", { medio: null });
rec("saldo_con_compromiso", { monto: 600, saldo: 600, compromiso: "vie 16 oct" });
rec("saldo_sin_compromiso", { monto: 600, saldo: 600, compromiso: null });
rec("miles_y_decimales", { monto: 1234567.5, saldo: 100.25, compromiso: "lun 2 nov" });
rec("caracteres_especiales", { alumno: "Ángela Núñez", plan: "Plan ¡Más! Ñandú", medio: "Tarjeta «Ñ»" });
rec("alumno_con_tutor", { alumno: "Sofía Rivas" });

const basePru = { esMenor: false, quien: "Ana Pérez", planNombre: "Plan Doble", personas: 1, nombreCurso: [[1, "Salsa"], [2, "Bachata"]], guardadas: [{ curso_id: 1, fecha: "2026-10-09" }] };
const pru = (nombre, cambios) => (v[`N03.${nombre}`] = { caso: "prueba", ...basePru, ...cambios });
pru("un_curso", {});
pru("dos_cursos_orden_por_fecha", { guardadas: [{ curso_id: 2, fecha: "2026-10-12" }, { curso_id: 1, fecha: "2026-10-09" }] });
pru("dos_personas", { personas: 2 });
pru("tres_personas", { personas: 3 });
pru("menor", { esMenor: true, quien: "Sofía Rivas" });
pru("menor_con_espacio_final", { esMenor: true, quien: "Sofía Rivas " });
pru("sin_clases_con_fecha", { guardadas: [{ curso_id: 1, fecha: null }] });
pru("sin_clases", { guardadas: [] });
pru("curso_desconocido", { guardadas: [{ curso_id: 9, fecha: "2026-10-09" }] });
pru("fin_de_anio", { guardadas: [{ curso_id: 1, fecha: "2026-12-31" }] });
pru("caracteres_especiales", { quien: "Ángela Núñez", planNombre: "Plan ¡Más!", nombreCurso: [[1, "Ñandú «Ñ»"]] });

const basePar = { horasContratadas: 10, planNombre: "Paquete 10 h", nombreProfesor: "Mario Rojas", dondeTexto: "Tropicana", modalidad: "fija", nSesiones: 3, agendaTexto: "vie 02/10 15:00, vie 09/10 15:00, vie 16/10 15:00", leftoverMin: 0, alumnoNombre: "Ana Pérez" };
const par = (nombre, cambios) => (v[`N04-N05.${nombre}`] = { caso: "particular", ...basePar, ...cambios });
par("fija_varias", {});
par("fija_una", { nSesiones: 1, agendaTexto: "vie 02/10 15:00" });
par("flexible", { modalidad: "flexible", nSesiones: 1, agendaTexto: "vie 02/10 15:00" });
par("flexible_con_resto_por_coordinar", { modalidad: "flexible", nSesiones: 1, agendaTexto: "vie 02/10 15:00", leftoverMin: 540 });
par("fija_con_resto", { leftoverMin: 60 });
par("lugar_externo", { dondeTexto: "Estudio Luna" });
par("horas_con_decimales", { horasContratadas: 1.5 });
par("horas_cuarto", { horasContratadas: 2.25 });
par("alumno_sin_nombre", { alumnoNombre: "" });
par("profesor_sin_nombre", { nombreProfesor: "" });
par("agenda_vacia", { nSesiones: 0, agendaTexto: "" });
par("caracteres_especiales", { planNombre: "Paquete ¡Más!", nombreProfesor: "Íñigo Muñoz", alumnoNombre: "Ángela Núñez", dondeTexto: "Estudio «Ñ»" });

const baseAlq = { planNombre: "Alquiler 4 h", horas: 4, dondeTexto: "Tropicana", agendaTexto: "sáb 03/10 10:00, sáb 10/10 10:00", leftoverMin: 0, contactoNombre: "Colegio Sol", destinoNombre: "Colegio Sol" };
const alq = (nombre, cambios) => (v[`N06.${nombre}`] = { caso: "alquiler", ...baseAlq, ...cambios });
alq("titular_propio", {});
alq("a_persona_de_contacto", { destinoNombre: "Sofía Rivas (Colegio Sol)" });
alq("con_resto", { leftoverMin: 120 });
alq("a_persona_de_contacto_con_resto", { destinoNombre: "Sofía Rivas (Colegio Sol)", leftoverMin: 120 });
alq("lugar_externo", { dondeTexto: "Estudio Luna" });
alq("horas_con_decimales", { horas: 1.5 });
alq("una_reserva", { agendaTexto: "sáb 03/10 10:00" });
alq("caracteres_especiales", { contactoNombre: "Colegio «Ñandú»", destinoNombre: "Colegio «Ñandú»", planNombre: "Alquiler ¡Más!", dondeTexto: "Estudio «Ñ»" });

const arnes = join(dir, "arnes.ts");
const entradas = join(dir, "entradas.json");
writeFileSync(arnes, harness, "utf8");
writeFileSync(entradas, JSON.stringify(v), "utf8");
execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", arnes, entradas, resolve(salida)], { stdio: "inherit" });
console.log(`Referencias escritas en ${salida}: ${Object.keys(v).length} variantes.`);
