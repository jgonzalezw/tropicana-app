import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

// R20 · PR #47: comprobación operativa del cableado de los avisos de clases (N19–N21).
// En /asistencia suspende una clase del curso con más alumnos (motivo «E2E R20») y la reabre;
// guarda el texto exacto de cada aviso que muestra la pantalla en
// `test-results/r20-avisos-clases.json`. Solo dev (el usuario QA entra a dev). La clase queda
// reabierta al terminar (también si la prueba falla a mitad).

test.skip(!process.env.E2E_PASSWORD && !process.env.QA_CLOUD_PASSWORD, "Faltan credenciales del usuario QA");

type Aviso = { paso: string; nombre: string; texto: string };
const recogidos: Aviso[] = [];
const guardar = () => {
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/r20-avisos-clases.json", JSON.stringify(recogidos, null, 2));
};

async function leerAvisos(page: Page, paso: string) {
  const cont = page.locator("main p.whitespace-pre-wrap");
  await expect(cont.first()).toBeVisible({ timeout: 30_000 });
  const n = await cont.count();
  for (let i = 0; i < n; i++) {
    const p = cont.nth(i);
    const nombre = (await p.locator("xpath=preceding-sibling::div[1]").innerText().catch(() => "")).trim();
    recogidos.push({ paso, nombre, texto: (await p.innerText()).trim() });
  }
}

test("avisos de clases: suspender y reabrir", async ({ page }) => {
  test.setTimeout(240_000);
  let suspendida = false;
  try {
    await page.goto("/asistencia");
    // los cursos con alumnos, del que más tiene al que menos; se toma el primero con una fecha libre
    const abrirSelector = () => page.locator("button:has(span:text-is('⌄'))").first().click();
    await abrirSelector();
    const opciones = page.locator("div.absolute.z-20 button");
    await expect(opciones.first()).toBeVisible();
    const textos = await opciones.allInnerTexts();
    const orden = textos
      .map((t, i) => ({ i, n: Number(/(\d+) alumnos/.exec(t)?.[1] ?? 0) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
    test.skip(orden.length === 0, "No hay un curso con alumnos");
    const select = page.locator("select.entrada").first();
    const marcar = page.getByRole("button", { name: "Marcar esta clase como suspendida" });
    let encontrada = false;
    for (const [k, c] of orden.slice(0, 8).entries()) {
      if (k > 0) await abrirSelector();
      await opciones.nth(c.i).click();
      await page.waitForLoadState("networkidle");
      await expect(select).toBeVisible();
      // fechas sin marca de estado (las tomadas, suspendidas o sin alumnos llevan ✓ ⊘ ⚠ ○ al frente)
      const libres = await select.evaluate((el: HTMLSelectElement) =>
        [...el.options].filter((x) => /^[a-záéíóúñ]/i.test((x.textContent ?? "").trim()) && !/sin alumnos/.test(x.textContent ?? "")).map((x) => x.value)
      );
      for (const v of libres.slice(0, 3)) {
        await select.selectOption(v);
        await page.waitForLoadState("networkidle");
        if (await marcar.isVisible().catch(() => false)) { encontrada = true; break; }
      }
      if (encontrada) break;
    }
    test.skip(!encontrada, "Ningún curso tiene una clase que se pueda suspender");

    await page.getByRole("button", { name: "Marcar esta clase como suspendida" }).click();
    await page.getByPlaceholder(/Motivo \(opcional\)/).fill("E2E R20");
    await page.getByRole("button", { name: "Confirmar suspensión" }).click();
    suspendida = true;
    await expect(page.getByText("Clase suspendida").first()).toBeVisible({ timeout: 60_000 });
    await leerAvisos(page, "suspender");
    guardar();

    await page.getByRole("button", { name: /Reabrir clase/ }).click();
    suspendida = false;
    await expect(page.getByRole("button", { name: /Reabrir clase/ })).toHaveCount(0, { timeout: 60_000 });
    // los avisos de la suspensión siguen en pantalla hasta que llegan los de la reapertura
    await expect
      .poll(async () => (await page.locator("main p.whitespace-pre-wrap").allInnerTexts()).filter((t) => !/quedó suspendida/.test(t)).length, { timeout: 30_000 })
      .toBeGreaterThan(0);
    await leerAvisos(page, "reabrir (restablecer)");
  } finally {
    if (suspendida) {
      const b = page.getByRole("button", { name: /Reabrir clase/ });
      if (await b.count()) await b.click().catch(() => {});
    }
    guardar();
  }

  expect(recogidos.length, "la pantalla mostró avisos").toBeGreaterThan(0);
  for (const a of recogidos) {
    expect(a.texto, `${a.paso}: texto del aviso`).not.toMatch(/\{\{|\}\}|undefined|\bnull\b|NaN|\[object/);
    expect(a.texto.length, `${a.paso}: no está vacío`).toBeGreaterThan(20);
  }
  expect(recogidos.some((a) => a.paso === "suspender"), "la suspensión dejó avisos").toBe(true);
  expect(recogidos.some((a) => a.paso.startsWith("reabrir")), "reabrir dejó avisos").toBe(true);
});
