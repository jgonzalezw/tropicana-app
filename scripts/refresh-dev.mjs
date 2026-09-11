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
  "plan_cursos",
  "asignaciones",
  "descuentos_adelanto",
  "inscripciones",
  "inscripcion_cursos",
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
  // La tabla puede no existir todavia en prod (migracion aplicada solo en dev):
  // no es un error, simplemente no hay nada que traer.
  const existe = (await prod.query(`select to_regclass($1) as t`, [`public.${t}`])).rows[0].t != null;
  if (!existe) return { tabla: t, filas: 0, ausenteEnProd: true };
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

/**
 * Repone en DEV lo que PROD no pudo aportar porque su esquema es mas viejo: la
 * etiqueta planes.modalidad y, si prod todavia no tiene las tablas de 0013, una
 * fila por el curso principal en plan_cursos / inscripcion_cursos.
 *
 * OJO: esto es un RESPALDO, no la fuente. Las dos tablas se copian de prod en
 * ORDEN. Antes se reconstruian siempre desde el curso principal, y eso APLANABA
 * un plan multi-curso a un solo curso en cada refresh, en silencio. Como el
 * padron resuelve por inscripcion_cursos, eso volvia invisibles a los alumnos
 * en todos los demas cursos de su plan.
 */
async function postBackfill(dev) {
  const existeCol = async (tabla, col) =>
    (
      await dev.query(
        `select 1 from information_schema.columns
          where table_schema='public' and table_name=$1 and column_name=$2`,
        [tabla, col]
      )
    ).rows.length > 0;
  const existeTabla = async (tabla) =>
    (await dev.query(`select to_regclass($1) as t`, [`public.${tabla}`])).rows[0].t != null;

  if (await existeCol("planes", "modalidad")) {
    await dev.query(
      `update public.planes set modalidad='mensual'
        where modalidad is null and tipo_servicio='curso_regular' and nombre like 'Plan Regular %'`
    );
    await dev.query(
      `update public.planes set modalidad='medio_mes'
        where modalidad is null and nombre like 'Plan Medio Mes %'`
    );
  }
  if (await existeTabla("plan_cursos")) {
    await dev.query(
      `insert into public.plan_cursos (plan_id, curso_id)
         select p.id, p.curso_id from public.planes p
          where p.curso_id is not null
            and not exists (select 1 from public.plan_cursos pc
                             where pc.plan_id=p.id and pc.curso_id=p.curso_id)`
    );
  }
  if (await existeTabla("inscripcion_cursos")) {
    await dev.query(
      `insert into public.inscripcion_cursos (inscripcion_id, curso_id, dias)
         select i.id, i.curso_id, coalesce(nullif(i.dias_elegidos, '{}'), c.dias_semana, '{}')
           from public.inscripciones i join public.cursos c on c.id=i.curso_id
          where i.plan_id is not null
            and not exists (select 1 from public.inscripcion_cursos ic
                             where ic.inscripcion_id=i.id and ic.curso_id=i.curso_id)`
    );
  }
}

/**
 * Sincroniza la config de DOMINIO (catalogos, sus valores y parametros) desde
 * prod, **por clave y sin borrar**: pisa lo que existe en las dos y agrega lo
 * que falta, pero deja intacta una clave que solo existe en dev (tipicamente
 * una migracion todavia no pasada a prod).
 *
 * No toca roles, perfiles ni temas: ahi vive el acceso, y dev conserva su
 * propio admin.
 *
 * Existe porque sin esto dev y prod derivan en silencio: se ajusta un catalogo
 * en produccion, se refresca dev, y las pruebas corren contra otra config que
 * la real sin que nada lo avise.
 */
async function sincronizarConfig(prod, dev) {
  const tocadas = [];

  const params = await prod.query(`select * from public.parametros`);
  for (const r of params.rows) {
    const cols = Object.keys(r);
    const otras = cols.filter((c) => c !== "clave");
    await dev.query(
      `insert into public.parametros (${cols.map((c) => `"${c}"`).join(", ")})
       values (${cols.map((_, i) => `$${i + 1}`).join(", ")})
       on conflict (clave) do update set
         ${otras.map((c) => `"${c}" = excluded."${c}"`).join(", ")}`,
      cols.map((c) => r[c])
    );
  }
  tocadas.push(`parametros: ${params.rows.length}`);

  // Los catalogos se identifican por clave, no por id: los ids pueden no
  // coincidir entre las dos bases.
  const cats = await prod.query(`select * from public.catalogos`);
  let valores = 0;
  for (const c of cats.rows) {
    const up = await dev.query(
      `insert into public.catalogos (clave, nombre, descripcion, es_sistema)
       values ($1, $2, $3, $4)
       on conflict (clave) do update set nombre = excluded.nombre,
         descripcion = excluded.descripcion, es_sistema = excluded.es_sistema
       returning id`,
      [c.clave, c.nombre, c.descripcion, c.es_sistema]
    );
    const devCatId = up.rows[0].id;
    const vs = await prod.query(`select * from public.catalogo_valores where catalogo_id = $1`, [c.id]);
    for (const v of vs.rows) {
      await dev.query(
        `insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden, activo)
         values ($1, $2, $3, $4, $5)
         on conflict (catalogo_id, valor) do update set etiqueta = excluded.etiqueta,
           orden = excluded.orden, activo = excluded.activo`,
        [devCatId, v.valor, v.etiqueta, v.orden, v.activo]
      );
      valores++;
    }
  }
  tocadas.push(`catalogos: ${cats.rows.length} (${valores} valores)`);
  return tocadas;
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
    const enDev = [];
    for (const t of ORDEN) {
      const r = await dev.query(`select to_regclass($1) as t`, [`public.${t}`]);
      if (r.rows[0].t != null) enDev.push(t);
    }
    const lista = enDev.map((t) => `public.${t}`).join(", ");
    await dev.query(`truncate ${lista} restart identity cascade`);

    console.log("Copiando datos de PROD -> DEV:");
    for (const t of enDev) {
      const r = await copiarTabla(prod, dev, t, nullCols[t] ?? new Set(), deferCols[t] ?? new Set());
      console.log(`  ${t.padEnd(22)} ${r.filas} filas${r.ausenteEnProd ? "  (no existe en prod)" : ""}`);
    }

    console.log("Reajustando secuencias...");
    for (const t of enDev) await reajustarSecuencia(dev, t);

    console.log("Rellenando tablas/etiquetas de dev que no existen en prod...");
    await postBackfill(dev);

    if (process.argv.includes("--sin-config")) {
      console.log("Config: NO sincronizada (--sin-config).");
    } else {
      console.log("Sincronizando config de dominio (por clave, sin borrar)...");
      for (const t of await sincronizarConfig(prod, dev)) console.log(`  ${t}`);
    }

    console.log("\nRefresh completo. DEV ahora tiene los datos de PROD.");
    console.log("Login de dev: seguí usando tu usuario admin de dev (no se tocó).");
  } finally {
    await prod.end();
    await dev.end();
  }
}

main().catch((e) => fatal(e.message));
