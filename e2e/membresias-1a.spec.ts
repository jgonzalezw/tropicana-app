import { test, expect } from "@playwright/test";

// Fase 1a (I-012): la entrada nueva, la disposición y los componentes del
// muestrario. Supone el interruptor `membresias_nuevas` = true en dev.
// El caso «apagado» vive en zz-interruptor-apagado.spec.ts y corre al final.

test.skip(
  !process.env.E2E_PASSWORD && !process.env.QA_CLOUD_PASSWORD,
  "Faltan credenciales del usuario QA (E2E_PASSWORD o QA_CLOUD_PASSWORD)"
);

test("la entrada Membresías aparece y abre la disposición lista + ficha", async ({ page }) => {
  await page.goto("/");
  const entrada = page.getByRole("link", { name: "Membresías" });
  await expect(entrada).toBeVisible();
  await entrada.click();
  await expect(page).toHaveURL(/\/membresias$/);
  await expect(page.getByRole("complementary", { name: "Lista" })).toBeVisible();
  await expect(page.getByTestId("ficha-vacia")).toHaveText("Elegí una membresía.");
});

test.describe("muestrario", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/membresias/muestrario");
    await expect(page.getByRole("heading", { name: "Muestrario" })).toBeVisible();
  });

  test("la hoja se abre y se cierra con Esc; no pregunta si no hay datos", async ({ page }) => {
    await page.getByRole("button", { name: "Abrir hoja" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("con datos cargados, cerrar pregunta antes de descartar", async ({ page }) => {
    await page.getByRole("button", { name: "Abrir hoja" }).click();
    const guardar = page.getByRole("button", { name: "Guardar" });
    await expect(guardar).toBeDisabled();
    await expect(page.getByText("Escribí un nombre para guardar.")).toBeVisible();
    await page.getByLabel("Nombre").fill("Ejemplo");
    await expect(guardar).toBeEnabled();

    await page.keyboard.press("Escape"); // pide confirmación, no cierra
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible(); // la hoja sigue debajo
    await page.keyboard.press("Escape"); // Esc cierra primero la confirmación, no la hoja
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("guardar muestra la tarjeta de confirmación con el aviso sin enviar", async ({ page }) => {
    await page.getByRole("button", { name: "Abrir hoja" }).click();
    await page.getByLabel("Nombre").fill("Ejemplo");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByTestId("tarjeta-confirmacion")).toBeVisible();
    await expect(page.getByText("Sin enviar", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Listo" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("la confirmación irreversible no se cierra con el velo", async ({ page }) => {
    await page.getByRole("button", { name: "Dar de baja…" }).first().click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByTestId("confirmacion-velo").click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("el menú ⋯ abre, ejecuta y se cierra", async ({ page }) => {
    const boton = page.getByRole("button", { name: "Más acciones" });
    await boton.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await boton.click();
    await page.getByRole("menuitem", { name: /Renovar/ }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByTestId("aviso")).toContainText("Renovar");
  });

  test("el aviso ofrece Deshacer y se reemplaza", async ({ page }) => {
    await page.getByRole("button", { name: "Mostrar aviso" }).click();
    await expect(page.getByTestId("aviso")).toContainText("Membresía guardada");
    await page.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByTestId("aviso")).toContainText("Cambio deshecho");
  });

  test("los filtros prenden de a uno", async ({ page }) => {
    const grupo = page.getByRole("group", { name: "Tipo" });
    await expect(grupo.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
    await grupo.getByRole("button", { name: "Pruebas" }).click();
    await expect(grupo.getByRole("button", { name: "Pruebas" })).toHaveAttribute("aria-pressed", "true");
    await expect(grupo.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("celular (390 px)", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("la lista ocupa la pantalla y la hoja la cubre", async ({ page }) => {
    await page.goto("/membresias");
    const lista = page.getByRole("complementary", { name: "Lista" });
    await expect(lista).toBeVisible();
    await expect(page.getByTestId("ficha-vacia")).toBeHidden();
    // Esperar a que hidrate: antes de eso la grilla aún no es de una columna.
    await expect.poll(async () => (await lista.boundingBox())?.width ?? 0).toBeGreaterThan(380);

    await page.goto("/membresias/muestrario");
    await page.getByRole("button", { name: "Abrir hoja" }).click();
    const hoja = await page.getByRole("dialog").boundingBox();
    expect(hoja!.width).toBeGreaterThanOrEqual(389);
  });
});
