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
 * Uso (PowerShell / cmd):
 *   set PROD_DB_URL=postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres
 *   set DEV_DB_URL=postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres
 *   node scripts/refresh-dev.mjs --yes
 *
 * Las URLs salen de Supabase -> Settings -> Database -> Connection string (URI),
 * preferentemente la del "Session pooler" (puerto 5432). NUNCA se guardan en el
 * repo ni se pegan en el chat.
 *
 * Notas:
 *  - Solo copia tablas de DOMINIO. La config (roles, perfiles, parametros,
 *    catalogos, temas) NO se toca: dev conserva su propio admin y ajustes.
 *  - Las referencias a usuarios (perfiles) se ANULAN al copiar (usuario_id,
 *    registrado_por) porque los perfiles/auth de prod no existen en dev. Son
 *    columnas "on delete set null", asi que no se pierde dato de dominio.
 *  - Preserva los ids (OVERRIDING SYSTEM VALUE) y reajusta las secuencias.
 */

import pg from "pg";

const { Client } = pg;

// Orden padre -> hijo (respeta las llaves foraneas al insertar).
// nullCols: se ponen en NULL (referencias a perfiles/auth, inexistentes en dev).
// deferCols: auto-referencias; se insertan en NULL y se completan en una 2da pasada.
const TABLAS = [
  { t: "profesores", nullCols: ["usuario_id"] },
  { t: "alumnos", deferCols: ["tutor_alumno_id", "referido_por_alumno_id"] },
  { t: "cursos" },
  { t: "curso_tarifas" },
  { t: "planes" },
  { t: "asignaciones" },
  { t: "descuentos_adelanto" },
  { t: "inscripciones", deferCols: ["membresia_anterior_id"] },
  { t: "cuotas" },
  { t: "sesiones" },
  { t: "asistencias", nullCols: ["registrado_por"] },
  { t: "liquidaciones" },
  { t: "comisiones_devengadas" },
  { t: "liquidacion_items" },
  { t: "pagos", nullCols: ["registrado_por"] },
  { t: "corrimientos_ciclo", nullCols: ["registrado_por"] },
];

function fatal(msg) {
  console.error("ERROR: " + msg);
  process.exit(1);
}

function clienteDe(url) {
  if (!url) return null;
  const noSsl = process.env.REFRESH_NO_SSL === "1";
  return new Client({ connectionString: url, ssl: noSsl ? false : { rejectUnauthorized: false } });
}

async function copiarTabla(prod, dev, spec) {
  const { t } = spec;
  const nullCols = spec.nullCols ?? [];
  const deferCols = spec.deferCols ?? [];

  const { rows } = await prod.query(`select * from public.${t}`);
  if (rows.length === 0) return { tabla: t, filas: 0 };

  const cols = Object.keys(rows[0]);
  const pendientes = []; // { id, valores {col:val} } para deferCols

  // Normaliza filas: anula nullCols; guarda y anula deferCols.
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

  // Inserta en lotes con OVERRIDING SYSTEM VALUE (preserva ids identity).
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

  // 2da pasada: completa las auto-referencias.
  for (const p of pendientes) {
    const sets = Object.keys(p.dif).map((c, i) => `"${c}" = $${i + 1}`);
    const vals = Object.values(p.dif);
    vals.push(p.id);
    await dev.query(`update public.${t} set ${sets.join(", ")} where id = $${vals.length}`, vals);
  }

  return { tabla: t, filas: rows.length };
}

async function reajustarSecuencia(dev, t) {
  // Solo si la tabla tiene columna id con secuencia asociada (identity).
  const col = await dev.query(
    `select 1 from information_schema.columns
      where table_schema = 'public' and table_name = $1 and column_name = 'id'`,
    [t]
  );
  if (col.rows.length === 0) return;
  const { rows } = await dev.query(
    `select pg_get_serial_sequence('public.${t}', 'id') as seq`
  );
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
    // Sanidad: dev debe tener el esquema (planes existe = 0012 aplicada).
    const chk = await dev.query(
      "select to_regclass('public.planes') as p, to_regclass('public.inscripciones') as i"
    );
    if (!chk.rows[0].p || !chk.rows[0].i)
      fatal("La base DEV no tiene el esquema del motor. Aplicá primero setup_dev_full.sql y 0012 en dev.");

    console.log("Vaciando tablas de dominio en DEV...");
    const lista = TABLAS.map((x) => `public.${x.t}`).join(", ");
    await dev.query(`truncate ${lista} restart identity cascade`);

    console.log("Copiando datos de PROD -> DEV:");
    for (const spec of TABLAS) {
      const r = await copiarTabla(prod, dev, spec);
      console.log(`  ${r.tabla.padEnd(22)} ${r.filas} filas`);
    }

    console.log("Reajustando secuencias...");
    for (const spec of TABLAS) await reajustarSecuencia(dev, spec.t);

    console.log("\nRefresh completo. DEV ahora tiene los datos de PROD (sin usuarios/config).");
    console.log("Login de dev: seguí usando tu usuario admin de dev (no se tocó).");
  } finally {
    await prod.end();
    await dev.end();
  }
}

main().catch((e) => fatal(e.message));
