import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Fase 1b (I-012): lista y ficha de lectura. Supone el interruptor
// `membresias_nuevas` = true en dev. Las membresías se toman de la lista
// misma (nunca ids fijos). Los alquileres no existen hoy en dev ni en
// producción, así que el caso de titulares que no son alumnos siembra los
// suyos —solo contra dev— y los borra siempre al terminar.

test.skip(
  !process.env.E2E_PASSWORD && !process.env.QA_CLOUD_PASSWORD,
  "Faltan credenciales del usuario QA (E2E_PASSWORD o QA_CLOUD_PASSWORD)"
);

const NO_EXISTE = "Esa membresía no existe o no tenés permiso para verla.";

async function abrirLista(page: Page, query = "") {
  await page.goto(`/membresias${query}`);
  await expect(page.getByRole("complementary", { name: "Lista" })).toBeVisible();
}

const filas = (page: Page) => page.getByTestId("fila-membresia");

/** La primera fila de ese tipo (el punto de la fila lo dice en `data-tipo`). */
async function abrirPrimeraDe(page: Page, tipo: string) {
  await abrirLista(page, "?estado=activas");
  const fila = filas(page).filter({ has: page.locator(`.n-punto[data-tipo="${tipo}"]`) }).first();
  await expect(fila, `hay una membresía activa de tipo ${tipo} en dev`).toBeVisible();
  await fila.click();
  await expect(page.getByTestId("ficha-membresia")).toBeVisible();
  return Number(await page.getByTestId("ficha-membresia").getAttribute("data-membresia-id"));
}

test("la lista carga todas las filas de una vez y dice cuánto tarda", async ({ page }) => {
  const t0 = Date.now();
  await abrirLista(page);
  await expect(filas(page).first()).toBeVisible();
  const ms = Date.now() - t0;
  const total = await filas(page).count();
  console.log(`[1b] /membresias: ${total} filas activas en ${ms} ms (dev)`);
  expect(total).toBeGreaterThan(0);
  await expect(page.getByPlaceholder("Alumno, WhatsApp, profesor o plan")).toBeVisible();
  await expect(page.getByText("Solo ves los tipos que tu rol puede ver.")).toBeVisible();
});

test("los filtros cambian las filas y quedan en la URL; la búsqueda encuentra por nombre", async ({ page }) => {
  await abrirLista(page);
  const activas = await filas(page).count();

  await page.getByRole("group", { name: "Estado" }).getByRole("button", { name: "Históricas" }).click();
  await expect(page).toHaveURL(/estado=historicas/);
  await expect(page.getByRole("group", { name: "Estado" }).getByRole("button", { name: "Históricas" })).toHaveAttribute("aria-pressed", "true");
  expect(await filas(page).count()).not.toBe(activas);

  await page.getByRole("group", { name: "Estado" }).getByRole("button", { name: "Activas" }).click();
  await expect(filas(page)).toHaveCount(activas);

  const grupoTipo = page.getByRole("group", { name: "Tipo" });
  await grupoTipo.getByRole("button", { name: "Regulares" }).click();
  await expect(page).toHaveURL(/tipo=regular/);
  for (const punto of await page.locator(".n-fila .n-punto").all()) await expect(punto).toHaveAttribute("data-tipo", "regular");

  // Buscar por el apellido de la primera fila.
  await grupoTipo.getByRole("button", { name: "Todas" }).click();
  const nombre = (await filas(page).first().locator(".n-fila__nombre").innerText()).trim();
  const palabra = nombre.split(/\s+/).slice(-1)[0];
  await page.getByLabel("Buscar").fill(palabra);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(palabra)}`));
  expect(await filas(page).count()).toBeGreaterThan(0);
  await expect(filas(page).first()).toContainText(palabra, { ignoreCase: true });
});

test("ficha regular: indicadores, clases, cuotas, pagos y acciones que esperan su fase", async ({ page }) => {
  await abrirPrimeraDe(page, "regular");
  const ficha = page.getByTestId("ficha-membresia");
  await expect(ficha.getByText("Uso del ciclo")).toBeVisible();
  await expect(ficha.getByText("Saldo", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("bloque-cuotas")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Clases" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("bloque-saldo-horas")).toHaveCount(0);

  // Las acciones de las fases siguientes se ven deshabilitadas y dicen por qué.
  await expect(page.getByRole("button", { name: "Cobrar" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Cobrar" })).toHaveAttribute("title", /Llega en la fase 3/);
  await expect(page.getByRole("button", { name: /Renovar|De baja/ })).toBeDisabled();
  await page.getByRole("button", { name: "Más acciones" }).click();
  await expect(page.getByRole("menuitem", { name: /Dar de baja/ })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: /Dar de baja/ })).toContainText("Llega en la fase 6");
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "Pagos" }).click();
  await expect(page.getByRole("tabpanel", { name: "Pagos" })).toBeVisible();
  const recibo = page.getByRole("link", { name: "Ver recibo" }).first();
  if (await recibo.count()) {
    await recibo.click();
    await expect(page).toHaveURL(/\/caja\/recibo\/\d+/);
  }
});

test("paridad de lectura: el saldo de la ficha regular aparece en la cuenta del alumno", async ({ page }) => {
  await abrirPrimeraDe(page, "regular");
  const saldo = (await page.getByTestId("saldo-cuenta").innerText()).trim();
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: /Ver persona/ }).click();
  await expect(page).toHaveURL(/\/alumnos\/\d+\/cuenta/);
  await expect(page.locator("body")).toContainText(saldo);
});

test("ficha particular: reservas y saldo de horas igual al de /particulares", async ({ page }) => {
  const id = await abrirPrimeraDe(page, "particular");
  await expect(page.getByTestId("bloque-saldo-horas")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Reservas" })).toHaveAttribute("aria-selected", "true");
  // Desde la fase 2 la ficha da de alta reservas (+ Nueva reserva); lo que sigue sin existir acá son los controles de edición de la reserva.
  await expect(page.getByRole("button", { name: /Nueva reserva/ })).toHaveCount(1);

  const texto = async () => {
    const t = await page.locator("body").innerText();
    return {
      disponible: /Disponible para pedir\s*([\d.,]+) h/.exec(t)?.[1],
      contratadas: /Contratadas\s*([\d.,]+) h/.exec(t)?.[1],
    };
  };
  const nueva = await texto();
  expect(nueva.disponible).toBeTruthy();
  await page.goto(`/particulares/${id}`);
  await expect(page.getByText("Saldo del paquete")).toBeVisible();
  const vieja = await texto();
  expect(nueva).toEqual(vieja);
});

test("una membresía que no existe responde lo mismo que una que el rol no ve", async ({ page }) => {
  await abrirLista(page);
  await page.goto("/membresias/999999999");
  await expect(page.getByTestId("ficha-error")).toHaveText(NO_EXISTE);
  await page.goto("/membresias/abc");
  await expect(page.getByTestId("ficha-error")).toHaveText(NO_EXISTE);
});

test.describe("celular (390 px)", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("lista → ficha a pantalla completa → volver", async ({ page }) => {
    await abrirLista(page);
    const lista = page.getByRole("complementary", { name: "Lista" });
    await expect.poll(async () => (await lista.boundingBox())?.width ?? 0).toBeGreaterThan(380);
    await filas(page).first().click();
    await expect(page.getByTestId("ficha-membresia")).toBeVisible();
    await expect(lista).toBeHidden();
    await page.getByRole("link", { name: "← Membresías" }).click();
    await expect(lista).toBeVisible();
  });
});

// ── Titulares que no son alumnos (alquiler a nombre de una institución y de un profesor) ──

test.describe("titulares que no son alumnos", () => {
  const DEV = "hyhijzuomqpylcmrzdvw";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!llave || !url.includes(DEV), "Siembra solo contra dev y con SUPABASE_SERVICE_ROLE_KEY");
  test.describe.configure({ mode: "serial" });

  const admin = () => createClient(url, llave!, { auth: { persistSession: false } });
  const SIGLA = "ZZ E2E 1B";
  const ids: { membresias: number[]; contacto: number | null } = { membresias: [], contacto: null };
  let profesorNombre = "";

  test.beforeAll(async () => {
    const sb = admin();
    const hoy = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const fin = new Date(hoy.getTime() + 30 * 86400_000);

    const org = await sb.from("contactos").insert({ tipo: "organizacion", razon_social: `Colegio ${SIGLA}`, whatsapp: "+59170000001" }).select("id").single();
    if (org.error) throw org.error;
    ids.contacto = org.data.id;

    const prof = await sb.from("profesores").select("contacto:contactos(id, nombre, apellido)").limit(1).single();
    if (prof.error) throw prof.error;
    const pc = prof.data.contacto as unknown as { id: number; nombre: string; apellido: string };
    profesorNombre = `${pc.nombre} ${pc.apellido}`.trim();

    for (const contacto of [org.data.id, pc.id]) {
      const m = await sb
        .from("membresias")
        .insert({
          contacto_id: contacto, fecha_inicio: iso(hoy), fecha_fin: iso(fin), horas_contratadas: 4, precio_aplicado: 0,
          categoria_propuesta: "tercero", categoria_aplicada: "tercero", alquiler_personas: 10,
        })
        .select("id")
        .single();
      if (m.error) throw m.error;
      ids.membresias.push(m.data.id);
    }
  });

  test.afterAll(async () => {
    if (!llave || !url.includes(DEV)) return;
    const sb = admin();
    if (ids.membresias.length) {
      await sb.from("cuotas").delete().in("membresia_id", ids.membresias);
      await sb.from("membresias").delete().in("id", ids.membresias);
    }
    if (ids.contacto) await sb.from("contactos").delete().eq("id", ids.contacto);
  });

  test("alquiler a nombre de una institución: titular, rol y precio y categoría", async ({ page }) => {
    await abrirLista(page, "?tipo=alquiler");
    await page.getByLabel("Buscar").fill(SIGLA);
    await expect(filas(page)).toHaveCount(1);
    await filas(page).first().click();
    await expect(page.getByTestId("ficha-titular")).toContainText(`Colegio ${SIGLA}`);
    await expect(page.getByTestId("ficha-membresia")).toContainText("Institución");
    await expect(page.getByTestId("bloque-alquiler")).toContainText("tercero");
    await expect(page.getByTestId("bloque-alquiler")).toContainText("Avisos a");
    await expect(page.getByRole("tab", { name: "Reservas" })).toBeVisible();
  });

  test("alquiler a nombre de un profesor de la escuela: se muestra como titular, no como alumno", async ({ page }) => {
    await abrirLista(page, "?tipo=alquiler");
    await page.getByLabel("Buscar").fill(profesorNombre.split(" ").slice(-1)[0]);
    const fila = filas(page).filter({ has: page.locator(".n-punto[data-tipo='alquiler']") }).first();
    await fila.click();
    await expect(page.getByTestId("ficha-titular")).toContainText(profesorNombre);
    await expect(page.getByTestId("ficha-membresia")).toContainText("Profesor de Tropicana");
    await page.getByRole("button", { name: "Más acciones" }).click();
    await expect(page.getByRole("menuitem", { name: /Ver persona/ })).toBeDisabled();
  });
});
