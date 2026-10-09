import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// I-012 1b (revisión de Javier): búsqueda por menor, tutor y WhatsApp; filtros que
// vuelven a Todas + Activas; conteos contra la base; avisos de otros estados; ficha
// con el contacto de avisos y el profesor titular. Los datos son los de dev: Bruna
// Marquez (menor) y su tutora Natalia Salek. Solo lee la base (no cambia nada).

test.skip(
  !process.env.E2E_PASSWORD && !process.env.QA_CLOUD_PASSWORD,
  "Faltan credenciales del usuario QA (E2E_PASSWORD o QA_CLOUD_PASSWORD)"
);

const DEV = "hyhijzuomqpylcmrzdvw";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hayBase = !!llave && url.includes(DEV);
const base = () => createClient(url, llave!, { auth: { persistSession: false } });

const filas = (page: Page) => page.getByTestId("fila-membresia");
const buscar = (page: Page) => page.getByLabel("Buscar");
const tipo = (page: Page, n: string) => page.getByRole("group", { name: "Tipo" }).getByRole("button", { name: n, exact: true }).click();
const estado = (page: Page, n: string) => page.getByRole("group", { name: "Estado" }).getByRole("button", { name: n, exact: true }).click();

async function abrirLista(page: Page, query = "") {
  await page.goto(`/membresias${query}`);
  await expect(page.getByRole("complementary", { name: "Lista" })).toBeVisible();
  await expect(filas(page).first().or(page.getByTestId("lista-vacia"))).toBeVisible();
}
const nombres = async (page: Page) => (await filas(page).locator(".n-fila__nombre").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());

// ── filtros que se traban ───────────────────────────────────────────────

test("combinar tipo, estado y búsqueda y volver a Todas + Activas da la cantidad inicial", async ({ page }) => {
  await abrirLista(page);
  const inicial = await filas(page).count();
  expect(inicial).toBeGreaterThan(0);

  for (const t of ["Regulares", "Pruebas", "Particulares", "Alquileres", "Todas"]) {
    for (const e of ["Históricas", "Con deuda", "Por vencer", "Solicitudes", "Activas"]) {
      await tipo(page, t);
      await estado(page, e);
      await buscar(page).fill("ma");
      await buscar(page).fill("");
    }
  }
  await tipo(page, "Todas");
  await estado(page, "Activas");
  await expect(page).toHaveURL(/\/membresias$/);
  await expect(buscar(page)).toHaveValue("");
  await expect(filas(page)).toHaveCount(inicial);

  // Con una búsqueda en el medio, lo mismo.
  await buscar(page).fill("salek");
  await estado(page, "Históricas");
  await buscar(page).fill("");
  await estado(page, "Activas");
  await expect(filas(page)).toHaveCount(inicial);
});

test("la búsqueda se lee de la URL: un cambio de URL (atrás/adelante, enlace) la actualiza", async ({ page }) => {
  await abrirLista(page, "?estado=todas&q=bruna");
  await expect(buscar(page)).toHaveValue("bruna");
  await expect(filas(page)).toHaveCount(1);

  // Cambia la URL sin pasar por el cuadro (como atrás/adelante): el cuadro y la lista la siguen.
  await page.evaluate(() => window.history.pushState(null, "", "/membresias?estado=todas&q=natalia"));
  await expect(buscar(page)).toHaveValue("natalia");
  await page.evaluate(() => window.history.pushState(null, "", "/membresias?estado=todas"));
  await expect(buscar(page)).toHaveValue("");
  expect(await filas(page).count()).toBeGreaterThan(5);
});

test("con menos de 2 caracteres la lista dice que hay que escribir más", async ({ page }) => {
  await abrirLista(page);
  const todas = await filas(page).count();
  await buscar(page).fill("b");
  await expect(page.getByTestId("busqueda-corta")).toContainText("al menos 2 caracteres");
  await expect(filas(page)).toHaveCount(todas); // no filtra, pero lo dice
  await buscar(page).fill("br");
  await expect(page.getByTestId("busqueda-corta")).toHaveCount(0);
});

// ── conteos contra la base ──────────────────────────────────────────────

test("por cada tipo × estado, la lista cuenta lo mismo que una consulta directa a la base", async ({ page }) => {
  test.skip(!hayBase, "Necesita SUPABASE_SERVICE_ROLE_KEY y dev");
  const { data, error } = await base().from("membresias").select("estado, es_prueba, curso_id, categoria_aplicada");
  if (error) throw error;
  const tipoDe = (m: { es_prueba: boolean; curso_id: number | null; categoria_aplicada: string | null }) =>
    m.categoria_aplicada != null ? "alquiler" : m.es_prueba ? "prueba" : m.curso_id == null ? "particular" : "regular";
  const directo = (t: string, e: "activas" | "historicas") =>
    data!.filter((m) => (t === "todas" || tipoDe(m) === t) && (e === "activas") === (m.estado === "activa")).length;

  const botonTipo: Record<string, string> = { todas: "Todas", regular: "Regulares", prueba: "Pruebas", particular: "Particulares", alquiler: "Alquileres" };
  const tabla: string[] = ["tipo × estado          | lista | base"];
  await abrirLista(page);
  for (const t of Object.keys(botonTipo)) {
    await tipo(page, botonTipo[t]);
    for (const [e, boton] of [["activas", "Activas"], ["historicas", "Históricas"]] as const) {
      await estado(page, boton);
      const esperado = directo(t, e);
      await expect(filas(page)).toHaveCount(esperado);
      tabla.push(`${t.padEnd(10)} × ${e.padEnd(10)} | ${String(await filas(page).count()).padStart(5)} | ${String(esperado).padStart(4)}`);
    }
  }
  console.log(tabla.join("\n"));
});

// ── menores, tutores y WhatsApp (datos de dev: Bruna Marquez y Natalia Salek) ──

test.describe("menor y tutora", () => {
  test("buscar a la tutora trae la membresía de su hija menor", async ({ page }) => {
    await abrirLista(page, "?estado=todas");
    await buscar(page).fill("Natalia Salek");
    const n = await nombres(page);
    expect(n.some((t) => t.includes("Bruna Marquez"))).toBe(true);
    expect(n.some((t) => t.startsWith("Natalia Salek"))).toBe(true);
  });

  test("buscar al menor, con o sin acento y mayúsculas", async ({ page }) => {
    await abrirLista(page, "?estado=todas");
    for (const q of ["Bruna", "Bruna Marquez", "Márquez", "MARQUEZ", "marquéz"]) {
      await buscar(page).fill(q);
      await expect(filas(page).filter({ hasText: "Bruna Marquez" }), q).toHaveCount(1);
    }
  });

  test("el WhatsApp de la tutora, en cualquier formato y parcial, ubica a la menor", async ({ page }) => {
    await abrirLista(page, "?estado=todas");
    for (const q of ["77311069", "+59177311069", "+591 773-11069", "591 77311069", "7731", "311069"]) {
      await buscar(page).fill(q);
      await expect(filas(page).filter({ hasText: "Bruna Marquez" }), q).toHaveCount(1);
      await expect(filas(page).filter({ hasText: "Natalia Salek" }), q).not.toHaveCount(0);
    }
    await buscar(page).fill("99999999");
    await expect(page.getByTestId("lista-vacia")).toBeVisible();
  });

  test("la fila del menor dice «Menor · tutor …» como Alumnos e Inscripción", async ({ page }) => {
    await abrirLista(page, "?estado=todas&q=Bruna");
    await expect(filas(page)).toHaveCount(1);
    await expect(filas(page).first().getByTestId("fila-menor")).toHaveText("Menor · tutor Natalia Salek");
    // Un adulto no lleva la línea.
    await buscar(page).fill("charo salek");
    await expect(filas(page).first()).toBeVisible();
    await expect(filas(page).first().getByTestId("fila-menor")).toHaveCount(0);
  });

  test("la ficha del menor muestra al tutor y el WhatsApp de avisos con enlace de WhatsApp", async ({ page }) => {
    await abrirLista(page, "?estado=todas&q=Bruna");
    await filas(page).first().click();
    await expect(page.getByTestId("ficha-membresia")).toBeVisible();
    await expect(page.getByTestId("ficha-menor")).toHaveText("Menor · tutor Natalia Salek");
    const bloque = page.getByTestId("bloque-whatsapp");
    await expect(bloque).toContainText("Natalia Salek");
    await expect(bloque).toContainText("tutor de Bruna Marquez");
    const enlace = page.getByTestId("whatsapp-numero").getByRole("link");
    await expect(enlace).toHaveAttribute("href", /^https:\/\/wa\.me\/59177311069/);
    await expect(enlace).toContainText("+59177311069");
  });

  test("la ficha de un adulto avisa a él mismo", async ({ page }) => {
    await abrirLista(page, "?q=charo salek");
    await filas(page).first().click();
    await expect(page.getByTestId("bloque-whatsapp")).toContainText("Charo Salek");
    await expect(page.getByTestId("whatsapp-numero").getByRole("link")).toHaveAttribute("href", /wa\.me\/59169177689/);
  });
});

// ── plan, curso, estilo y profesor ──────────────────────────────────────

test("busca por plan, curso o estilo y por el profesor titular del curso", async ({ page }) => {
  test.skip(!hayBase, "Necesita SUPABASE_SERVICE_ROLE_KEY y dev");
  const sb = base();
  // Una membresía activa de curso, con su plan, su curso y el titular de ese curso por asignación.
  const { data: m, error } = await sb
    .from("membresias")
    .select("id, plan:planes(nombre, estilo), membresia_cursos(curso_id, curso:cursos(nombre))")
    .eq("estado", "activa").is("categoria_aplicada", null).not("curso_id", "is", null).eq("es_prueba", false).limit(1).single();
  if (error) throw error;
  const mc = (m.membresia_cursos as unknown as { curso_id: number; curso: { nombre: string } }[])[0];
  const plan = m.plan as unknown as { nombre: string; estilo: string | null };
  const { data: asig } = await sb
    .from("asignaciones").select("profesor:profesores(contacto:contactos(nombre, apellido))")
    .eq("curso_id", mc.curso_id).is("hasta", null).limit(1).maybeSingle();
  const pc = (asig?.profesor as unknown as { contacto: { nombre: string; apellido: string } } | undefined)?.contacto;

  await abrirLista(page);
  const unaMas = async (q: string, porque: string) => {
    await buscar(page).fill(q);
    await expect(filas(page), porque).not.toHaveCount(0);
  };
  await unaMas(plan.nombre.slice(0, 8), "plan");
  await unaMas(mc.curso.nombre.toUpperCase(), "curso");
  if (plan.estilo) await unaMas(plan.estilo.slice(0, 5), "estilo");
  if (pc) await unaMas(`${pc.nombre} ${pc.apellido}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase(), "profesor titular");
});

// ── otros estados ───────────────────────────────────────────────────────

test("una lista vacía dice dónde están: «No hay pruebas activas. Hay N en Históricas · Ver»", async ({ page }) => {
  test.skip(!hayBase, "Necesita SUPABASE_SERVICE_ROLE_KEY y dev");
  const { data } = await base().from("membresias").select("estado").eq("es_prueba", true).is("categoria_aplicada", null);
  const activas = data!.filter((m) => m.estado === "activa").length;
  const historicas = data!.length - activas;
  test.skip(activas > 0 || historicas === 0, "En dev hoy hay pruebas activas o ninguna histórica");

  await abrirLista(page);
  await tipo(page, "Pruebas");
  await expect(page.getByTestId("lista-vacia")).toContainText("No hay pruebas activas.");
  await expect(page.getByTestId("otros-estados")).toContainText(`Hay ${historicas} en Históricas`);
  await page.getByTestId("otros-estados").getByRole("button", { name: "Ver" }).click();
  await expect(page).toHaveURL(/estado=historicas/);
  await expect(filas(page)).toHaveCount(historicas);
});

test("al buscar, avisa si hay más coincidencias en otro estado: «También hay N en Históricas · Ver»", async ({ page }) => {
  test.skip(!hayBase, "Necesita SUPABASE_SERVICE_ROLE_KEY y dev");
  // Un apellido con una membresía activa y otra que no lo está (en cursos, no en alquiler).
  const { data } = await base()
    .from("membresias")
    .select("estado, alumno:alumnos(contacto:contactos(apellido))")
    .is("categoria_aplicada", null).not("alumno_id", "is", null);
  const porApellido = new Map<string, Set<boolean>>();
  for (const r of data ?? []) {
    const ap = (r.alumno as unknown as { contacto: { apellido: string | null } } | null)?.contacto?.apellido?.trim();
    if (!ap || ap.length < 3) continue;
    const set = porApellido.get(ap) ?? new Set<boolean>();
    set.add(r.estado === "activa");
    porApellido.set(ap, set);
  }
  const apellido = [...porApellido].find(([, s]) => s.size === 2)?.[0];
  test.skip(!apellido, "En dev no hay un apellido con membresías activas e históricas");

  await abrirLista(page, `?q=${encodeURIComponent(apellido!)}`);
  await expect(filas(page).first()).toBeVisible();
  await expect(page.getByTestId("otros-estados")).toContainText(/También hay \d+ en Históricas/);
  await page.getByTestId("otros-estados").getByRole("button", { name: "Ver" }).click();
  await expect(page).toHaveURL(/estado=historicas/);
  await expect(page.getByTestId("otros-estados")).toContainText(/También hay \d+ en Activas/);
});

// ── profesor titular y quién dictó ──────────────────────────────────────

test("ficha regular: el profesor es el titular del curso y las clases dicen quién dictó, con el sustituto marcado", async ({ page }) => {
  test.skip(!hayBase, "Necesita SUPABASE_SERVICE_ROLE_KEY y dev");
  const sb = base();
  // Una membresía con clases dictadas por alguien distinto del titular de ese día, si existe;
  // si no, una cualquiera con clases.
  const { data: asis } = await sb
    .from("asistencias")
    .select("membresia_id, sesion:sesiones!inner(fecha, curso_id, profesor_id, estado)")
    .eq("sesion.estado", "dictada").limit(400);
  const { data: asigs } = await sb.from("asignaciones").select("curso_id, profesor_id, desde, hasta");
  const titularEn = (cursoId: number, f: string) =>
    (asigs ?? []).filter((a) => a.curso_id === cursoId && a.desde <= f && (a.hasta == null || a.hasta >= f)).sort((a, b) => (a.desde < b.desde ? 1 : -1))[0];
  const conSust = (asis ?? []).find((x) => {
    const s = x.sesion as unknown as { fecha: string; curso_id: number; profesor_id: number | null };
    const t = titularEn(s.curso_id, s.fecha);
    return t && s.profesor_id != null && t.profesor_id !== s.profesor_id;
  });
  const idMembresia = (conSust ?? (asis ?? [])[0])?.membresia_id as number | undefined;
  test.skip(!idMembresia, "En dev no hay clases dictadas");

  await page.goto(`/membresias/${idMembresia}?estado=todas`);
  await expect(page.getByTestId("ficha-membresia")).toBeVisible();
  await expect(page.getByTestId("profesor-titular").first()).toContainText("Titular de");
  await expect(page.getByTestId("profesor-titular").first()).not.toContainText("Sin titular asignado");
  const clases = page.getByRole("tabpanel", { name: "Clases" }).locator(".n-linea__sub");
  expect(await clases.count()).toBeGreaterThan(0);
  for (const sub of await clases.allInnerTexts()) expect(sub).not.toBe("");
  if (conSust) await expect(clases.filter({ hasText: "sustituto" }).first()).toBeVisible();
});

// ── velocidad: el esqueleto responde al instante ────────────────────────

test("al abrir una membresía aparece el esqueleto de la ficha antes que los datos", async ({ page }) => {
  await abrirLista(page);
  await page.evaluate(() => {
    const w = window as unknown as { __vioEsqueleto: boolean };
    w.__vioEsqueleto = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="ficha-cargando"]')) w.__vioEsqueleto = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await filas(page).first().click();
  await expect(page.getByTestId("ficha-membresia")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __vioEsqueleto: boolean }).__vioEsqueleto)).toBe(true);
});
