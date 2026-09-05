/**
 * Refresh de datos: PRODUCCION -> DEV (una sola direccion).
 *
 * Copia los datos de dominio de produccion al proyecto de pruebas (tropicana-dev)
 * para poder probar con datos reales. LEE de produccion (solo SELECT) y ESCRIBE
 * en dev (TRUNCATE + INSERT). Produccion NO se modifica.
 *
 * Se corre en la maquina de Javier (tiene acceso a ambos Supabase). Code corre
 * en la nube y NO tiene acceso a ninguno.
 *
 * Uso (PowerShell):
 *   $env:PROD_DB_URL="postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres"
 *   $env:DEV_DB_URL="postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres"
 *   node scripts/refresh-dev.mjs --yes
 *
 * Las URLs salen de Supabase -> boton "Connect" -> Connection string -> Session
 * pooler (puerto 5432), reemplazando [YOUR-PASSWORD]. NUNCA se guardan en el repo
 * ni se pegan en el chat.
 *
 * Notas:
 *  - Solo copia tablas de DOMINIO. La config (roles, perfiles, parametros,
 *    catalogos, temas) NO se toca: dev conserva su propio admin y ajustes.
 *  - Las columnas que referencian a usuarios (perfiles / auth.users) se ANULAN
 *    automaticamente al copiar (son "on delete set null": no se pierde dato de
 *    dominio). Las auto-referencias (tutor, referido, renovacion) se completan
 *    en una segunda pasada. Ambas cosas se detectan solas por las FK del esquema.
 *  - Preserva los ids (OVERRIDING SYSTEM VALUE) y reajusta las secuencias.
 */

import pg from "pg";

const { Client } = pg;

// Orden padre -> hijo (respeta las llaves foraneas al insertar).
const ORDEN = [
  "profesores",
  "alumnos",
  "cursos",
  "curso_tarifas",
  "planes",
  "asignaciones",
  "descuentos_adelanto",
  "inscripciones",
  "cuotas",
  "sesiones",
  "asistencias",
  "liquidaciones",
  "comisiones_devengadas",
  "liquidacion_items",
  "pagos",
  "corrimientos_ciclo",
];

// Tablas de usuarios/config a cuyas FK hay que anular (no se copian a dev).
const TABLAS_USUARIO = new Set(["perfiles", "users"]);

function fatal(msg) {
  console.error("ERROR: " + msg);
  process.exit(1);
}

function clienteDe(url) {
  if (!url) return null;
  const noSsl = process.env.REFRESH_NO_SSL === "1";
  return new Client({ connectionString: url, ssl: noSsl ? false : { rejectUnauthorized: false } });
}

/**
 * Lee las FK del esquema public y arma, por tabla:
 *  - nullCols: columnas que apuntan a perfiles/auth.users (se anulan).
 *  - deferCols: columnas que apuntan a la misma tabla (auto-ref, 2da pasada).
 */
async function mapaReferencias(db) {
  const { rows } = await db.query(`
    select tc.table_name as tbl,
           kcu.column_name as col,
           ccu.table_name as ref_tbl
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.constraint_schema = tc.constraint_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.constraint_schema = tc.constraint_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
  `);
  const nullCols = {};
  const deferCols = {};
  for (const r of rows) {
    if (TABLAS_USUARIO.has(r.ref_tbl)) (nullCols[r.tbl] ??= new Set()).add(r.col);
    else if (r.ref_tbl === r.tbl) (deferCols[r.tbl] ??= new Set()).add(r.col);
  }
  return { nullCols, deferCols };
}

async function copiarTabla(prod, dev, t, nullCols, deferCols) {
  const { rows } = await prod.query(`select * from public.${t}`);
  if (rows.length === 0) return { tabla: t, filas: 0 };

  const cols = Object.keys(rows[0]);
  const pendientes = []; // { id, valores {col:val} } para deferCols

  const filas = rows.map((r) => {
    const fila = { ...r };
    for (const c of nullCols) if (c in fila) fila[c] = null;
    const dif = {};
    let hayDif = false;
    for (const c of deferCols) {
      if (c in fila && fila[c] != null) {
        dif[c] = fila[c];
        hayDif = true;
      }
      if (c in fila) fila[c] = null;
    }
    if (hayDif) pendientes.push({ id: fila.id, dif });
    return fila;
  });

  const colList = cols.map((c) => `"${c}"`).join(", ");
  const LOTE = 400;
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    const params = [];
    const tuplas = lote.map((fila) => {
      const ph = cols.map((c) => {
        params.push(fila[c]);
        return `$${params.length}`;
      });
      return `(${ph.join(", ")})`;
    });
    await dev.query(
      `insert into public.${t} (${colList}) overriding system value values ${tuplas.join(", ")}`,
      params
    );
  }

  for (const p of pendientes) {
    const claves = Object.keys(p.dif);
    const sets = claves.map((c, i) => `"${c}" = $${i + 1}`);
    const vals = claves.map((c) => p.dif[c]);
    vals.push(p.id);
    await dev.query(`update public.${t} set ${sets.join(", ")} where id = $${vals.length}`, vals);
  }

  return { tabla: t, filas: rows.length };
}

async function reajustarSecuencia(dev, t) {
  const col = await dev.query(
    `select 1 from information_schema.columns
      where table_schema = 'public' and table_name = $1 and column_name = 'id'`,
    [t]
  );
  if (col.rows.length === 0) return;
  const { rows } = await dev.query(`select pg_get_serial_sequence('public.${t}', 'id') as seq`);
  const seq = rows[0]?.seq;
  if (!seq) return;
  await dev.query(
    `select setval($1, greatest(coalesce((select max(id) from public.${t}), 0), 1),
       (select count(*) > 0 from public.${t}))`,
    [seq]
  );
}

async function main() {
  if (!process.argv.includes("--yes"))
    fatal("Falta --yes. Esto BORRA los datos de dev y los reemplaza con los de prod. Corré: node scripts/refresh-dev.mjs --yes");

  const prodUrl = process.env.PROD_DB_URL;
  const devUrl = process.env.DEV_DB_URL;
  if (!prodUrl) fatal("Falta la variable PROD_DB_URL.");
  if (!devUrl) fatal("Falta la variable DEV_DB_URL.");
  if (prodUrl === devUrl) fatal("PROD_DB_URL y DEV_DB_URL son iguales. Abortando por seguridad.");

  const prod = clienteDe(prodUrl);
  const dev = clienteDe(devUrl);
  await prod.connect();
  await dev.connect();

  try {
    const chk = await dev.query(
      "select to_regclass('public.planes') as p, to_regclass('public.inscripciones') as i"
    );
    if (!chk.rows[0].p || !chk.rows[0].i)
      fatal("La base DEV no tiene el esquema del motor. Aplicá primero setup_dev_full.sql y 0012 en dev.");

    const { nullCols, deferCols } = await mapaReferencias(dev);

    console.log("Vaciando tablas de dominio en DEV...");
    const lista = ORDEN.map((t) => `public.${t}`).join(", ");
    await dev.query(`truncate ${lista} restart identity cascade`);

    console.log("Copiando datos de PROD -> DEV:");
    for (const t of ORDEN) {
      const r = await copiarTabla(prod, dev, t, nullCols[t] ?? new Set(), deferCols[t] ?? new Set());
      console.log(`  ${t.padEnd(22)} ${r.filas} filas`);
    }

    console.log("Reajustando secuencias...");
    for (const t of ORDEN) await reajustarSecuencia(dev, t);

    console.log("\nRefresh completo. DEV ahora tiene los datos de PROD (sin usuarios/config).");
    console.log("Login de dev: seguí usando tu usuario admin de dev (no se tocó).");
  } finally {
    await prod.end();
    await dev.end();
  }
}

main().catch((e) => fatal(e.message));
