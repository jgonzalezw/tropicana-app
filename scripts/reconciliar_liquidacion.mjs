/**
 * Reconciliación del motor de liquidación contra lo ya devengado.
 *
 * **Para qué.** Las pruebas de `src/lib/liquidacion/motor.test.ts` fijan la
 * matemática contra entradas conocidas. Esto hace la otra mitad: recalcula el
 * reparto **desde cero** sobre los datos reales y lo compara con lo que está
 * guardado en `comisiones_devengadas`. Responde tres preguntas:
 *
 *  1. ¿El motor dice hoy lo mismo que se devengó en su momento? (si no, o el
 *     motor cambió, o los datos que lo alimentan cambiaron después).
 *  2. ¿Cuántos **deltas históricos** hay? Es el numero que hay que conocer
 *     ANTES de habilitar el mecanismo de ajuste: el motor revisa todas las
 *     membresías completadas de la historia, así que encenderlo sin medir
 *     podria emitir una avalancha de ajustes viejos de una.
 *  3. ¿Quedó alguna comisión guardada que el motor ya no produciria?
 *
 * **No escribe nada.** Solo lee y compara.
 *
 * Uso:
 *   node scripts/reconciliar_liquidacion.mjs              # dev, desde .env.local
 *   node scripts/reconciliar_liquidacion.mjs --dump x.json # sobre un volcado
 *   node scripts/reconciliar_liquidacion.mjs --hasta 2026-08-31
 *
 * El modo `--dump` existe para producción, donde no hay credenciales en el
 * repo: el volcado se genera con la consulta de `reconciliar_dump.sql`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calcularDevengos } from "../src/lib/liquidacion/motor.ts";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ── Argumentos ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const valor = (bandera) => {
  const i = args.indexOf(bandera);
  return i >= 0 ? args[i + 1] : null;
};

/** Último día del mes vencido: el mismo tope que usa `generarLiquidacion`. */
function finMesVencidoISO(hoy = new Date()) {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const hasta = valor("--hasta") ?? finMesVencidoISO();
const dump = valor("--dump");

// ── Lectura ──────────────────────────────────────────────────────────────

function envLocal() {
  const p = path.join(raiz, ".env.local");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const linea of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

async function leerDeSupabase(hastaISO) {
  const env = { ...envLocal(), ...process.env };
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "ERROR: faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o .env.local).\n" +
        "Para producción usá --dump con la salida de scripts/reconciliar_dump.sql."
    );
    process.exit(1);
  }
  console.log(`Leyendo de ${new URL(url).host} · período hasta ${hastaISO}\n`);

  const pedir = async (tabla, query) => {
    const r = await fetch(`${url}/rest/v1/${tabla}?${query}`, {
      headers: { apikey: key, authorization: `Bearer ${key}`, prefer: "count=none" },
    });
    if (!r.ok) throw new Error(`${tabla}: ${r.status} ${await r.text()}`);
    return r.json();
  };
  const enLista = (ids) => `in.(${ids.join(",")})`;

  const membresias = await pedir(
    "inscripciones",
    "select=id,alumno_id,curso_id,plan_id,es_prueba,acompanantes,fecha_inicio,fecha_fin" +
      `&estado=eq.completada&plan_id=not.is.null&fecha_fin=not.is.null&fecha_fin=lte.${hastaISO}&limit=10000`
  );
  if (!membresias.length) return null;
  const ids = membresias.map((m) => m.id);

  const cursosDeMembresia = await pedir(
    "inscripcion_cursos",
    `select=inscripcion_id,curso_id,dias,fecha&inscripcion_id=${enLista(ids)}&limit=10000`
  );
  const comisionesGuardadas = await pedir(
    "comisiones_devengadas",
    `select=id,membresia_id,curso_id,profesor_id,base,monto,periodo,liquidacion_id&membresia_id=${enLista(ids)}&limit=10000`
  );
  const cuotas = await pedir(
    "cuotas",
    `select=id,inscripcion_id,monto_devengado,descuento_adelanto&inscripcion_id=${enLista(ids)}&limit=10000`
  );
  const pagos = cuotas.length
    ? await pedir(
        "pagos",
        `select=cuota_id,monto,descuento&tipo=eq.cobro&cuota_id=${enLista(cuotas.map((c) => c.id))}&limit=10000`
      )
    : [];

  const cursoIds = [
    ...new Set(cursosDeMembresia.map((r) => r.curso_id).concat(membresias.map((m) => m.curso_id))),
  ];
  const desde = membresias.map((m) => m.fecha_inicio).sort()[0];
  const sesiones = await pedir(
    "sesiones",
    `select=curso_id,fecha,estado,reemplazo_motivo&curso_id=${enLista(cursoIds)}` +
      `&fecha=gte.${desde}&fecha=lte.${hastaISO}&limit=20000`
  );
  const cursos = await pedir("cursos", `select=*&id=${enLista(cursoIds)}&limit=10000`);
  const tarifas = await pedir(
    "curso_tarifas",
    `select=curso_id,modalidad,precio&curso_id=${enLista(cursoIds)}&limit=10000`
  );
  const asignaciones = await pedir(
    "asignaciones",
    `select=id,curso_id,profesor_id,pct_ingresos,desde,hasta&curso_id=${enLista(cursoIds)}&limit=10000`
  );
  const alumnos = await pedir(
    "alumnos",
    `select=id,nombre,apellido&id=${enLista([...new Set(membresias.map((m) => m.alumno_id))])}&limit=10000`
  );
  const profesores = await pedir("profesores", "select=id,nombre,apellido&limit=10000");

  return {
    datos: {
      membresias,
      cursosDeMembresia,
      comisionesPrevias: [],
      cuotas,
      pagos,
      sesiones,
      cursos,
      tarifas,
      asignaciones,
      alumnos,
      profesores,
    },
    comisionesGuardadas,
  };
}

// ── Comparación ──────────────────────────────────────────────────────────

const plata = (n) => (Math.round(n * 100) / 100).toFixed(2).padStart(10);

function reconciliar({ datos, comisionesGuardadas }, hastaISO) {
  // Se recalcula DESDE CERO: sin `comisionesPrevias`, el motor dice lo que
  // diría hoy si se liquidara todo de nuevo. Eso es lo que hay que comparar.
  const { pendientes, bloqueadas } = calcularDevengos(datos, hastaISO);

  const clave = (c) => `${c.membresia_id ?? c.membresiaId}|${c.curso_id ?? c.cursoId}|${c.profesor_id ?? c.profesorId}`;

  const calculado = new Map();
  for (const p of pendientes) calculado.set(clave(p), p);

  const guardado = new Map();
  for (const c of comisionesGuardadas) {
    if (c.membresia_id == null || c.curso_id == null) continue; // modelo viejo
    const k = clave(c);
    const ya = guardado.get(k);
    if (ya) ya.base += Number(c.base);
    else guardado.set(k, { ...c, base: Number(c.base) });
  }

  const coinciden = [];
  const deltas = [];
  const soloGuardado = [];
  const soloCalculado = [];

  for (const [k, g] of guardado) {
    const c = calculado.get(k);
    if (!c) {
      soloGuardado.push({ k, guardado: g.base });
      continue;
    }
    const dif = Math.round((c.base - g.base) * 100) / 100;
    if (Math.abs(dif) < 0.01) coinciden.push(k);
    else deltas.push({ k, guardado: g.base, calculado: c.base, dif, alumno: c.alumno, curso: c.curso });
  }
  for (const [k, c] of calculado) {
    if (!guardado.has(k)) soloCalculado.push({ k, calculado: c.base, alumno: c.alumno, curso: c.curso });
  }

  return { coinciden, deltas, soloGuardado, soloCalculado, bloqueadas, pendientes };
}

// ── Salida ───────────────────────────────────────────────────────────────

const fuente = dump
  ? JSON.parse(fs.readFileSync(path.resolve(dump), "utf8"))
  : await leerDeSupabase(hasta);

if (!fuente) {
  console.log("No hay ninguna membresía completada hasta " + hasta + ". Nada que reconciliar.");
  process.exit(0);
}

const r = reconciliar(fuente, hasta);

console.log("RECONCILIACIÓN DEL MOTOR DE LIQUIDACIÓN");
console.log("=".repeat(72));
console.log(`Membresías completadas hasta ${hasta}: ${fuente.datos.membresias.length}`);
console.log(`Comisiones guardadas (membresía+curso+profesor): ${r.coinciden.length + r.deltas.length + r.soloGuardado.length}`);
console.log("");
console.log(`  Coinciden ......................... ${r.coinciden.length}`);
console.log(`  CON DELTA (el motor dice otra cosa) ${r.deltas.length}`);
console.log(`  Guardadas que el motor ya no produce ${r.soloGuardado.length}`);
console.log(`  Que el motor produce y no están ..... ${r.soloCalculado.length}`);
console.log(`  Membresías trabadas (regla 17) ...... ${r.bloqueadas.length}`);

if (r.deltas.length) {
  console.log("\nDELTAS — lo que el mecanismo de ajuste tendría que compensar:");
  console.log("  membresía|curso|profesor        guardado   calculado       delta");
  let suma = 0;
  for (const d of r.deltas.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif))) {
    suma += d.dif;
    console.log(`  ${d.k.padEnd(28)} ${plata(d.guardado)} ${plata(d.calculado)} ${plata(d.dif)}   ${d.alumno ?? ""} · ${d.curso ?? ""}`);
  }
  console.log(`  ${"TOTAL".padEnd(28)} ${" ".repeat(21)} ${plata(suma)}`);
}

if (r.soloGuardado.length) {
  console.log("\nGUARDADAS QUE EL MOTOR YA NO PRODUCE (revisar una por una):");
  for (const s of r.soloGuardado) console.log(`  ${s.k.padEnd(28)} ${plata(s.guardado)}`);
}

if (r.soloCalculado.length) {
  console.log("\nQUE EL MOTOR PRODUCE Y NO ESTÁN GUARDADAS (pendientes normales):");
  for (const s of r.soloCalculado)
    console.log(`  ${s.k.padEnd(28)} ${plata(s.calculado)}   ${s.alumno ?? ""} · ${s.curso ?? ""}`);
}

console.log("");
console.log(r.deltas.length === 0 ? "OK: no hay deltas históricos." : "REVISAR: hay deltas históricos.");
