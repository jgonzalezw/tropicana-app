import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CORRESPONDENCIAS, FUENTES, construirCatalogo, esquemaDe } from "./catalogo.ts";
import { hashContenido, serializarCanonico } from "./hash.ts";
import { calcularDelta, hashDeVersionEnSql, hayDelta, importadoDe, renderizarDelta, versionesEnSql } from "./importacion.ts";
import { vocabularioClase } from "../predeterminados/clase.ts";
import { vocabularioVenta } from "../predeterminados/venta.ts";

const DIR_MIGRACIONES = fileURLToPath(new URL("../../../../supabase/migrations/", import.meta.url));
const migraciones = readdirSync(DIR_MIGRACIONES)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort()
  .map((f) => ({ f, sql: readFileSync(DIR_MIGRACIONES + f, "utf8") }));
const catalogo = construirCatalogo();

// ── catálogo: 21 casos, 24 plantillas, 24 asignaciones ──
test("hay 21 casos (N01–N21), 24 plantillas y 24 asignaciones, sin huecos ni repetidos", () => {
  assert.equal(CORRESPONDENCIAS.length, 24);
  assert.deepEqual(
    [...new Set(CORRESPONDENCIAS.map((c) => c.caso))],
    Array.from({ length: 21 }, (_, i) => `N${String(i + 1).padStart(2, "0")}`)
  );
  assert.deepEqual(CORRESPONDENCIAS.map((c) => c.plantilla).sort(), Object.keys(FUENTES).sort(), "toda plantilla del código tiene su asignación y viceversa");
  assert.equal(new Set(CORRESPONDENCIAS.map((c) => `${c.uso}|${c.variante}`)).size, 24, "(uso, variante) único");
  assert.equal(new Set(catalogo.map((c) => c.clave)).size, 24, "clave del contenido única");
  assert.equal(new Set(catalogo.map((c) => c.hash)).size, 24);
});

test("el uso es la clave del predeterminado sin la variante; la variante de plantilla va en la clave", () => {
  for (const c of CORRESPONDENCIAS) {
    const f = FUENTES[c.plantilla];
    const esperado = c.variante === "unica" ? c.uso : `${c.uso}.${c.variante}`;
    assert.equal(f.caso.clave, esperado, `${c.plantilla}: uso ${c.uso} / variante ${c.variante}`);
    assert.ok(c.plantilla === c.caso || c.plantilla === `${c.caso}.${c.variante}`, `${c.plantilla} es del caso ${c.caso}`);
  }
  assert.ok(catalogo.every((c) => c.clave === `${c.caso}.${c.variante}.${c.canal}` && c.canal === "whatsapp" && c.asunto === null));
  assert.ok(catalogo.some((c) => c.clave === "N09.unica.whatsapp"), "N09 no tiene variante «alumno»");
});

test("el esquema que viaja con la versión coincide con el vocabulario del código", () => {
  for (const c of CORRESPONDENCIAS) {
    const e = esquemaDe(FUENTES[c.plantilla].caso.plantilla, FUENTES[c.plantilla].esquema);
    const voc = c.caso >= "N19" ? vocabularioClase(c.plantilla) : c.caso <= "N06" ? vocabularioVenta(c.plantilla) : null;
    if (!voc) continue;
    assert.deepEqual([...e.variables.map((x) => x.nombre)].sort(), [...voc.variables.map((x) => x.nombre)].sort(), c.plantilla);
    assert.deepEqual([...e.condiciones].sort(), [...(voc.condiciones ?? [])].sort(), c.plantilla);
    assert.deepEqual([...e.listas].sort(), [...(voc.listas ?? [])].sort(), c.plantilla);
    for (const v of e.variables) assert.equal(v.permiteVacia, voc.variables.find((x) => x.nombre === v.nombre)?.permiteVacia === true, `${c.plantilla}/${v.nombre}`);
  }
});

// ── hash canónico ──
const esq = { condiciones: ["b", "a"], listas: [], variables: [{ nombre: "x", obligatoria: true, permiteVacia: false }] };
test("serialización canónica: claves ordenadas, listas en su orden, sin espacios", () => {
  assert.equal(serializarCanonico({ b: 1, a: [2, 1], c: { z: null, y: "ñ" } }), '{"a":[2,1],"b":1,"c":{"y":"ñ","z":null}}');
  assert.equal(
    hashContenido({ cuerpo: "x", asunto: null, esquema: { variables: esq.variables, listas: [], condiciones: ["b", "a"] } }),
    hashContenido({ cuerpo: "x", asunto: null, esquema: esq }),
    "el orden de las claves no cambia el hash"
  );
});
test("hash canónico: valor fijo (golden), 64 hex minúsculas", () => {
  const h = hashContenido({ cuerpo: "Hola {{a}}!", asunto: null, esquema: esq });
  assert.match(h, /^[0-9a-f]{64}$/);
  // Calculado aparte (sha256 del texto canónico escrito a mano), no con hashContenido.
  assert.equal(h, "bbdf8390a20741c03fd228e3a79f910d597c99b67438a0ac71226dfd63d548e7");
});
test("el texto es exacto: espacios, saltos de línea y Unicode cambian el hash; el orden de una lista también", () => {
  const base = (cuerpo: string, e = esq) => hashContenido({ cuerpo, asunto: null, esquema: e });
  const uno = base("Hola\nmundo");
  assert.notEqual(uno, base("Hola\r\nmundo"));
  assert.notEqual(uno, base("Hola\nmundo "));
  assert.notEqual(base("é"), base("é"), "NFC ≠ NFD (no se normaliza)");
  assert.notEqual(base("x"), base("x", { ...esq, condiciones: ["a", "b"] }), "orden de lista conservado");
  assert.notEqual(hashContenido({ cuerpo: "x", asunto: null, esquema: esq }), hashContenido({ cuerpo: "x", asunto: "", esquema: esq }));
});

// ── importación: migraciones generadas, congeladas y sin deriva ──
const generadas = migraciones.filter((m) => /_comunicaciones_predeterminados_/.test(m.f));

test("DERIVA: lo importado por las migraciones del repo coincide con los predeterminados del código", () => {
  const delta = calcularDelta(catalogo, importadoDe(migraciones.map((m) => m.sql)));
  assert.ok(
    !hayDelta(delta),
    `Cambió un predeterminado (o falta importar): ${delta.versiones.map((v) => v.clave).join(", ")}. ` +
      "Correr: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generar-importacion-predeterminados.mjs (genera una migración nueva; no se edita la anterior)."
  );
});

test("cada texto incrustado en una migración generada reproduce el hash que declara y coincide con el código", () => {
  assert.ok(generadas.length >= 1, "existe la importación inicial");
  const porClave = new Map(catalogo.map((c) => [c.clave, c]));
  let n = 0;
  for (const m of generadas) {
    for (const v of versionesEnSql(m.sql)) {
      n++;
      assert.equal(hashDeVersionEnSql(v), v.hash, `${m.f} ${v.clave}: el texto incrustado no reproduce su hash (¿se editó a mano?)`);
      const c = porClave.get(v.clave);
      assert.ok(c, `${v.clave} no existe en el catálogo`);
      if (v.hash === c.hash) assert.equal(v.cuerpo, c.cuerpo, `${v.clave}: texto distinto al del código`);
    }
  }
  assert.ok(n >= 24);
});

test("las migraciones generadas importan en borrador, sin aprobar, publicar ni liberar", () => {
  for (const m of generadas) {
    assert.match(m.sql, /'predeterminado', 'borrador'/);
    assert.ok(!/\b(aprobado|publicado)_(en|por)\b|update\s+public\.|liberar_contenido|cambiar_estado_version|modo\s*=\s*'modulo'/i.test(m.sql.replace(/^--.*$/gm, "")), `${m.f} toca algo más que insertar`);
    assert.ok(!m.sql.includes("\r"), `${m.f} tiene CRLF: los textos dejarían de ser exactos (revisar .gitattributes)`);
  }
});

test("un predeterminado que cambia genera SOLO una versión nueva en borrador; no toca lo existente", () => {
  const ya = importadoDe(migraciones.map((m) => m.sql));
  const cambiado = catalogo.map((c) => {
    if (c.clave !== "N09.unica.whatsapp") return c;
    const cuerpo = c.cuerpo + " ";
    return { ...c, cuerpo, hash: hashContenido({ cuerpo, asunto: null, esquema: c.esquema }) };
  });
  const d = calcularDelta(cambiado, ya);
  assert.equal(d.contenidos.length + d.usos.length, 0);
  assert.deepEqual(d.versiones.map((v) => [v.clave, v.numero]), [["N09.unica.whatsapp", 2]]);
  const sql = renderizarDelta(d, "-- prueba");
  assert.ok(!/insert into public\.contenidos\b|insert into public\.contenido_usos\b/.test(sql));
  assert.match(sql, /on conflict \(contenido_id, hash\) do nothing/);
  // y, aplicada, lo deja al día (sin segunda deriva)
  const despues = calcularDelta(cambiado, importadoDe([...migraciones.map((m) => m.sql), sql]));
  assert.ok(!hayDelta(despues));
});

test("un contenido o asignación nuevos se importan sin repetir lo existente", () => {
  const nuevo = { ...catalogo[0], clave: "N99.unica.whatsapp", caso: "N99", uso: "prueba.nueva", hash: "0".repeat(64) };
  const d = calcularDelta([...catalogo, nuevo], importadoDe(migraciones.map((m) => m.sql)));
  assert.deepEqual([d.contenidos.length, d.usos.length, d.versiones.length], [1, 1, 1]);
  assert.equal(d.versiones[0].numero, 1);
});

// ── la estructura de la 0071 (la prueba real, con roles, corre en dev: scripts/prueba_0071_contenidos.sql) ──
const sql0071 = migraciones.find((m) => m.f.startsWith("0071_"))?.sql ?? "";
test("0071: tabla de transiciones, sin escritura directa y funciones solo para authenticated", () => {
  assert.ok(sql0071, "existe la 0071");
  for (const t of ["('borrador', 'en_revision')", "('en_revision', 'borrador')", "('en_revision', 'aprobado')", "('aprobado', 'publicado')", "('aprobado', 'retirado')", "('publicado', 'retirado')"])
    assert.ok(sql0071.includes(t), `transición ${t}`);
  assert.match(sql0071, /revoke all on table public\.contenidos, public\.contenido_versiones, public\.contenido_usos, public\.contenido_usos_historial\s+from public, anon, authenticated/);
  assert.match(sql0071, /revoke execute on function public\.liberar_contenido\([^)]*\) from public, anon;/);
  assert.match(sql0071, /if not public\.es_admin\(\)/);
  assert.ok(!/insert into public\.contenido_versiones|insert into public\.contenidos\b/.test(sql0071), "la 0071 no importa nada");
});
