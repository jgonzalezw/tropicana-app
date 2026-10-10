// R20 · E2 · H3 (grupo clases) — captura de las referencias de N19 (clase
// suspendida, alumno), N20 (clase suspendida, profesor) y N21 (clase
// restablecida, alumno) desde el CÓDIGO ACTUAL.
//
// Igual que los otros capturadores: herramienta de una sola vez, válida SOLO
// contra el commit anterior a la extracción. Copia, sin tocarlas, las funciones
// de `src/lib/avisosClase.ts` y los bloques de armado de `asistencia/acciones.ts`
// (reapertura), las evalúa con entradas ficticias y guarda el resultado tal cual.
// Cubre también cuándo un aviso NO corresponde (sin profesor, sin contacto, sin
// alumnos afectados, la clase no estaba suspendida). Si una línea no es la
// esperada, aborta.
//
// Uso: node scripts/capturar-referencias-clases.mjs <avisosClase.ts> <asistencia-acciones.ts> <salida.json>
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , origenAvisos, origenAsistencia, salida] = process.argv;
if (!origenAvisos || !origenAsistencia || !salida)
  throw new Error("Uso: capturar-referencias-clases.mjs <avisosClase.ts> <asistencia-acciones.ts> <salida.json>");
const leer = (p) => readFileSync(p, "utf8").split(/\r?\n/);
const A = leer(origenAvisos);
const S = leer(origenAsistencia);

function indice(L, texto, desde = 0) {
  const hits = L.map((t, i) => [t, i]).filter(([t, i]) => i >= desde && t.includes(texto));
  if (hits.length < 1) throw new Error(`No está «${texto}»`);
  return hits[0][1];
}
/** Desde la línea con `inicio` hasta la primera que empieza con `fin` (inclusive). */
function bloque(L, inicio, fin) {
  const i = indice(L, inicio);
  let j = i;
  while (!(fin === "}" ? L[j].trimEnd() === "}" : L[j].startsWith(fin))) j++;
  return L.slice(i, j + 1).join("\n");
}
/** Entre dos líneas con texto (inclusive). */
function tramo(L, desde, hasta) {
  const i = indice(L, desde);
  const j = indice(L, hasta, i);
  return L.slice(i, j + 1).join("\n");
}
const sinExport = (s) => s.replace(/^export /, "");

const fmtLarga = sinExport(bloque(A, "export function fmtLarga", "}"));
const tipoAviso = sinExport(bloque(A, "export type AvisoAlumno", "export type ClaseSuspendida").split("\n")[0]);
const tipoClase = sinExport(bloque(A, "export type ClaseSuspendida", "};"));
const tipoContacto = sinExport(bloque(A, "export type ContactoAviso", "export type ContactoAviso"));
const mensajeSuspension = sinExport(bloque(A, "export function mensajeSuspension(", "}"));
const mensajeReapertura = sinExport(bloque(A, "export function mensajeReapertura(", "}"));
const mensajeProfesor = sinExport(bloque(A, "export function mensajeSuspensionProfesor(", "}"));

// Armado de los avisos (lo que decide para quién y cuándo no corresponde).
const sinProfesor = A[indice(A, "if (profesorId == null) return null;")].trim();
const armadoAlumnos = tramo(A, "const avisos: AvisoAlumno[] = [];", "return avisos.sort");
const armadoProfesor = tramo(A, "if (!p?.contacto) return null;", "mensaje: mensajeSuspensionProfesor");
const cierreProfesor = "  };";
const condicionReapertura = S[indice(S, "if (estabaSuspendida && r.alumnosRestablecidos.length)")].trim();
const cursoDeRespaldo = S[indice(S, 'const cursoNombre = (curso as { nombre: string } | null)?.nombre ?? "tu curso";')].trim();
const armadoReapertura = tramo(S, "avis" + "os = r.alumnosRestablecidos", ".sort((x, y) => x.nombre.localeCompare(y.nombre");

const inscripcion = pathToFileURL(resolve("src/lib/inscripcion.ts")).href;
const harness = `
import { fechaLarga } from ${JSON.stringify(inscripcion)};
import { readFileSync, writeFileSync } from "node:fs";
${tipoAviso}
${tipoClase}
${tipoContacto}
${fmtLarga}
${mensajeSuspension}
${mensajeReapertura}
${mensajeProfesor}

function armarAlumnos(datos: Map<number, ContactoAviso>, porAlumno: Map<number, ClaseSuspendida[]>): AvisoAlumno[] {
  ${armadoAlumnos}
}
function armarProfesor(profesorId: number | null, p: any, e: { curso: string; fecha: string; motivoTexto: string }): AvisoAlumno | null {
  ${sinProfesor}
  ${armadoProfesor}
  ${cierreProfesor}
}
function armarReapertura(
  estabaSuspendida: boolean,
  r: { alumnosRestablecidos: { alumnoId: number; finCiclo: string | null }[] },
  curso: { nombre: string } | null,
  datos: Map<number, ContactoAviso>,
  args: { fecha: string }
): AvisoAlumno[] {
  let avisos: AvisoAlumno[] = [];
  ${condicionReapertura}
    ${cursoDeRespaldo}
    ${armadoReapertura}
  }
  return avisos;
}

const variantes = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out: Record<string, unknown> = {};
const mapa = (d: any) => new Map<number, ContactoAviso>((d ?? []).map((x: any) => [x.id, x.contacto]));
for (const [id, E] of Object.entries(variantes) as [string, any][]) {
  if (E.caso === "suspension") {
    const porAlumno = new Map<number, ClaseSuspendida[]>(E.porAlumno.map((x: any) => [x.id, x.clases]));
    out[id] = { entrada: E, resultado: armarAlumnos(mapa(E.contactos), porAlumno) };
  } else if (E.caso === "profesor") {
    out[id] = { entrada: E, resultado: armarProfesor(E.profesorId, E.p, E.datos) };
  } else {
    out[id] = { entrada: E, resultado: armarReapertura(E.estabaSuspendida, { alumnosRestablecidos: E.restablecidos }, E.curso, mapa(E.contactos), { fecha: E.fecha }) };
  }
}
writeFileSync(process.argv[3], JSON.stringify(out, null, 2) + "\\n", "utf8");
`;

const WA = "+59171234567";
const c = (nombre, nombrePila, whatsapp = WA) => ({ nombre, nombrePila, whatsapp });
const clase = (curso, fecha, finCicloNuevo = null, motivoTexto = "un feriado") => ({ curso, fecha, finCicloNuevo, motivoTexto });
const v = {};

// N19 · clase suspendida, alumno
const susp = (nombre, porAlumno, contactos) => (v[`N19.${nombre}`] = { caso: "suspension", porAlumno, contactos });
susp("una_clase_con_ciclo", [{ id: 1, clases: [clase("Salsa", "2026-10-05", "2026-11-09")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana") }]);
susp("una_clase_sin_ciclo", [{ id: 1, clases: [clase("Salsa", "2026-10-05")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana") }]);
susp("dos_clases", [{ id: 1, clases: [clase("Salsa", "2026-10-05"), clase("Bachata", "2026-10-06")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana") }]);
susp("tres_clases_ciclo_en_la_segunda", [{ id: 1, clases: [clase("Salsa", "2026-10-05"), clase("Bachata", "2026-10-06", "2026-11-10"), clase("Kizomba", "2026-10-07", "2026-11-11")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana") }]);
susp("motivo_de_la_primera", [{ id: 1, clases: [clase("Salsa", "2026-10-05", null, "un feriado"), clase("Bachata", "2026-10-06", null, "otro motivo")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana") }]);
susp("motivo_con_glosa", [{ id: 1, clases: [clase("Salsa", "2026-10-05", null, "Cierre de sala (Feriado)")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana") }]);
susp("motivo_por_defecto_manual", [{ id: 1, clases: [clase("Salsa", "2026-10-05", null, "una decisión de la escuela")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana") }]);
susp("motivo_por_defecto_c5", [{ id: 1, clases: [clase("Salsa", "2026-10-05", null, "un cierre de sala")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana") }]);
susp("motivo_vacio", [{ id: 1, clases: [clase("Salsa", "2026-10-05", null, "")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana") }]);
susp("fin_de_anio", [{ id: 1, clases: [clase("Salsa", "2026-12-31", "2027-01-31")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana") }]);
susp("cambio_de_mes", [{ id: 1, clases: [clase("Salsa", "2026-02-28", "2026-03-01")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana") }]);
susp("caracteres_especiales", [{ id: 1, clases: [clase("Ñandú ¡Más!", "2026-10-05", null, "señor Núñez: ¡clausura!")] }], [{ id: 1, contacto: c("Ángela Núñez", "Ángela") }]);
susp("menor_con_whatsapp_del_tutor", [{ id: 1, clases: [clase("Salsa", "2026-10-05")] }], [{ id: 1, contacto: c("Sofía Rivas", "Sofía", "+59170000001") }]);
susp("sin_whatsapp", [{ id: 1, clases: [clase("Salsa", "2026-10-05")] }], [{ id: 1, contacto: c("Ana Pérez", "Ana", null) }]);
susp("sin_contacto_resuelto", [{ id: 7, clases: [clase("Salsa", "2026-10-05")] }], []);
susp("varios_alumnos_ordenados", [
  { id: 1, clases: [clase("Salsa", "2026-10-05")] },
  { id: 2, clases: [clase("Salsa", "2026-10-05")] },
  { id: 3, clases: [clase("Salsa", "2026-10-05")] },
], [{ id: 1, contacto: c("Zoe Ábalos", "Zoe") }, { id: 2, contacto: c("Ángel Díaz", "Ángel") }, { id: 3, contacto: c("Ana Pérez", "Ana") }]);
susp("sin_alumnos_afectados", [], []);

// N20 · clase suspendida, profesor
const e0 = { curso: "Salsa", fecha: "2026-10-05", motivoTexto: "un feriado" };
const prof = (nombre, profesorId, p, datos = e0) => (v[`N20.${nombre}`] = { caso: "profesor", profesorId, p, datos });
prof("base", 3, { id: 3, contacto: { nombre: "Mario", apellido: "Rojas", whatsapp: "+59178901234" } });
prof("motivo_con_glosa", 3, { id: 3, contacto: { nombre: "Mario", apellido: "Rojas", whatsapp: "+59178901234" } }, { ...e0, motivoTexto: "Cierre de sala (Feriado)" });
prof("sin_whatsapp", 3, { id: 3, contacto: { nombre: "Mario", apellido: "Rojas", whatsapp: null } });
prof("sin_apellido", 3, { id: 3, contacto: { nombre: "Mario", apellido: null, whatsapp: "+59178901234" } });
prof("sin_nombre", 3, { id: 3, contacto: { nombre: null, apellido: "Rojas", whatsapp: "+59178901234" } });
prof("sin_nombre_ni_apellido", 3, { id: 3, contacto: { nombre: null, apellido: null, whatsapp: "+59178901234" } });
prof("caracteres_especiales", 3, { id: 3, contacto: { nombre: "Íñigo", apellido: "Muñoz", whatsapp: "+59178901234" } }, { curso: "Ñandú ¡Más!", fecha: "2026-12-31", motivoTexto: "señor Núñez: ¡clausura!" });
prof("sin_profesor_titular", null, null);
prof("profesor_sin_contacto", 3, { id: 3, contacto: null });
prof("profesor_no_encontrado", 3, null);

// N21 · clase restablecida, alumno
const reap = (nombre, estabaSuspendida, restablecidos, contactos, curso = { nombre: "Salsa" }, fecha = "2026-10-05") =>
  (v[`N21.${nombre}`] = { caso: "reapertura", estabaSuspendida, restablecidos, contactos, curso, fecha });
const ana = [{ id: 1, contacto: c("Ana Pérez", "Ana") }];
reap("con_ciclo", true, [{ alumnoId: 1, finCiclo: "2026-11-02" }], ana);
reap("sin_ciclo", true, [{ alumnoId: 1, finCiclo: null }], ana);
reap("fin_de_anio", true, [{ alumnoId: 1, finCiclo: "2027-01-05" }], ana, { nombre: "Salsa" }, "2026-12-31");
reap("cambio_de_mes", true, [{ alumnoId: 1, finCiclo: "2026-03-01" }], ana, { nombre: "Salsa" }, "2026-02-28");
reap("caracteres_especiales", true, [{ alumnoId: 1, finCiclo: "2026-11-02" }], [{ id: 1, contacto: c("Ángela Núñez", "Ángela") }], { nombre: "Ñandú ¡Más!" });
reap("sin_whatsapp", true, [{ alumnoId: 1, finCiclo: "2026-11-02" }], [{ id: 1, contacto: c("Ana Pérez", "Ana", null) }]);
reap("sin_contacto_resuelto", true, [{ alumnoId: 7, finCiclo: "2026-11-02" }], []);
reap("curso_no_encontrado", true, [{ alumnoId: 1, finCiclo: null }], ana, null);
reap("varios_alumnos_ordenados", true, [
  { alumnoId: 1, finCiclo: "2026-11-02" }, { alumnoId: 2, finCiclo: null }, { alumnoId: 3, finCiclo: "2026-11-09" },
], [{ id: 1, contacto: c("Zoe Ábalos", "Zoe") }, { id: 2, contacto: c("Ángel Díaz", "Ángel") }, { id: 3, contacto: c("Ana Pérez", "Ana") }]);
reap("no_estaba_suspendida", false, [{ alumnoId: 1, finCiclo: "2026-11-02" }], ana);
reap("nadie_restablecido", true, [], []);

const dir = mkdtempSync(join(tmpdir(), "r20-ref-clases-"));
const arnes = join(dir, "arnes.ts");
const entradas = join(dir, "entradas.json");
writeFileSync(arnes, harness, "utf8");
writeFileSync(entradas, JSON.stringify(v), "utf8");
execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", arnes, entradas, resolve(salida)], { stdio: "inherit" });
console.log(`Referencias escritas en ${salida}: ${Object.keys(v).length} variantes.`);
