import { test, expect, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { crearMembresiaDePrueba, retirarMembresiaDePrueba, type MembresiaDePrueba } from "./membresiaDePrueba";

// R20 · PR #47: comprobación operativa del cableado de los avisos de reservas particulares.
// Recorre, con una membresía de prueba propia (contacto «E2E-PRUEBA»), crear → reprogramar →
// cancelar, y guarda el texto exacto de cada aviso que muestra la pantalla en
// `test-results/r20-avisos-reservas.json`. Falla si algún aviso trae marcadores sin resolver
// ({{ }}), `undefined`, `null` o `NaN`. Solo contra dev y con la llave de servicio.

const DEV = "hyhijzuomqpylcmrzdvw";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(!process.env.E2E_PASSWORD && !process.env.QA_CLOUD_PASSWORD, "Faltan credenciales del usuario QA");
test.skip(!llave || !url.includes(DEV), "Crea reservas: solo contra dev y con SUPABASE_SERVICE_ROLE_KEY");

const sb = () => createClient(url, llave!, { auth: { persistSession: false } });
const LIBRE = '.n-franja[data-aspecto="libre"]:not([aria-disabled="true"])';
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fila = (page: Page, id: number) => page.locator(`[data-testid="fila-reserva"][data-reserva-id="${id}"]`);

type Aviso = { paso: string; nombre: string; texto: string };
const recogidos: Aviso[] = [];
const guardar = () => {
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/r20-avisos-reservas.json", JSON.stringify(recogidos, null, 2));
};

/** Lee y cierra todos los avisos del panel de la derecha; devuelve cuántos había. */
async function recogerAvisos(page: Page, paso: string): Promise<number> {
  const panel = page.getByTestId("avisos-pendientes");
  await page.waitForTimeout(1500);
  let n = 0;
  while (await panel.count()) {
    const tarjeta = panel.locator("p.whitespace-pre-wrap").first();
    if (!(await tarjeta.count())) break;
    const texto = (await tarjeta.innerText()).trim();
    const nombre = (await tarjeta.locator("xpath=preceding-sibling::div[1]").innerText().catch(() => "")).trim();
    recogidos.push({ paso, nombre, texto });
    n++;
    await panel.getByRole("button", { name: "Cerrar aviso" }).first().click();
    await page.waitForTimeout(250);
  }
  return n;
}

async function irAUnDiaLibre(hoja: Locator) {
  await expect(hoja.getByTestId("franjas")).toBeVisible();
  let hayLibre = false;
  for (let dias = 3; dias <= 10 && !hayLibre; dias++) {
    await hoja.getByLabel("Otra fecha").fill(iso(new Date(Date.now() + dias * 86_400_000)));
    await expect(hoja.getByTestId("franjas").locator(".n-franja").first().or(hoja.getByTestId("sala-cerrada"))).toBeVisible();
    hayLibre = (await hoja.locator(LIBRE).count()) > 0;
  }
  test.skip(!hayLibre, "No hay franjas libres a más de 48 h en los próximos días");
}

test("avisos de reservas particulares: crear, reprogramar y cancelar", async ({ page }) => {
  test.setTimeout(240_000);
  let prueba: MembresiaDePrueba | null = null;
  try {
    prueba = await crearMembresiaDePrueba(2);
    test.skip(!prueba, "No hay una particular activa de dev que sirva de modelo");
    await page.goto(`/membresias/${prueba!.membresiaId}?estado=activas`);
    await expect(page.getByTestId("ficha-membresia")).toBeVisible();

    // 1. Crear (Confirmar directo)
    await page.getByTestId("boton-nueva-reserva").click();
    let hoja = page.getByRole("dialog");
    await irAUnDiaLibre(hoja);
    await hoja.locator(LIBRE).first().click();
    await hoja.getByRole("button", { name: "Confirmar directo" }).click();
    await expect(hoja.getByRole("button", { name: "Listo" })).toBeVisible({ timeout: 30_000 });
    // los avisos que la hoja muestra al crear
    const enHoja = await hoja.locator("p.whitespace-pre-wrap").allInnerTexts();
    for (const t of enHoja) recogidos.push({ paso: "crear (en la hoja)", nombre: "", texto: t.trim() });
    await hoja.getByRole("button", { name: "Listo" }).click();
    const { data } = await sb().from("reservas_sala").select("id").eq("membresia_id", prueba!.membresiaId).order("id", { ascending: false }).limit(1);
    const id = data?.[0]?.id as number;
    expect(id, "se creó la reserva").toBeTruthy();
    await recogerAvisos(page, "crear (panel)");

    // 2. Reprogramar a la franja libre más tarde
    const f = fila(page, id);
    await f.locator(".n-res__fila").click();
    await f.getByRole("button", { name: "Reprogramar" }).click();
    hoja = page.getByRole("dialog");
    await expect(hoja.getByTestId("franjas")).toBeVisible();
    await hoja.locator(LIBRE).last().click();
    await hoja.getByRole("button", { name: "Mover reserva" }).click();
    await expect(hoja.getByText(/Reserva movida/)).toBeVisible({ timeout: 30_000 });
    const enHojaMov = await hoja.locator("p.whitespace-pre-wrap").allInnerTexts();
    for (const t of enHojaMov) recogidos.push({ paso: "reprogramar (en la hoja)", nombre: "", texto: t.trim() });
    await hoja.getByRole("button", { name: "Listo" }).click();
    await recogerAvisos(page, "reprogramar (panel)");
    guardar();

    // 3. Cancelar (reprogramar crea una reserva nueva ligada: se cancela la vigente, la más reciente)
    const { data: vigente } = await sb().from("reservas_sala").select("id").eq("membresia_id", prueba!.membresiaId).order("id", { ascending: false }).limit(1);
    const idVigente = vigente?.[0]?.id as number;
    expect(idVigente, "hay una reserva vigente tras reprogramar").toBeTruthy();
    guardar();
    const g = fila(page, idVigente);
    await expect(g).toBeVisible();
    if (!(await g.getAttribute("data-abierta"))) await g.locator(".n-res__fila").click();
    await g.getByRole("button", { name: /^Cancelar/ }).click();
    await g.getByRole("button", { name: /Confirmar cancelación/ }).click();
    await expect.poll(async () => (await sb().from("reservas_sala").select("estado").eq("id", idVigente).single()).data?.estado, { timeout: 60_000 }).toBe("reagendar");
    await expect(page.getByTestId("avisos-pendientes")).toBeVisible({ timeout: 60_000 });
    await recogerAvisos(page, "cancelar (panel)");
    expect(recogidos.filter((a) => a.paso.startsWith("cancelar")).length, "la cancelación dejó su aviso").toBeGreaterThan(0);
  } finally {
    await retirarMembresiaDePrueba(prueba);
    guardar();
  }

  expect(recogidos.length, "la pantalla mostró avisos").toBeGreaterThan(0);
  for (const a of recogidos) {
    expect(a.texto, `${a.paso}: texto del aviso`).not.toMatch(/\{\{|\}\}|undefined|\bnull\b|NaN|\[object/);
    expect(a.texto.length, `${a.paso}: el aviso no está vacío`).toBeGreaterThan(20);
  }
  // El saludo original es «Hola!» sin nombre; el destinatario figura en la cabecera de la tarjeta.
  expect(recogidos.some((a) => a.nombre.includes("E2E-PRUEBA")), "algún aviso va dirigido al alumno de prueba").toBe(true);
});
