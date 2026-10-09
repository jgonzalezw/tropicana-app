import { test as setup } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { restaurarInterruptor } from "./interruptor";

const ARCHIVO = "playwright/.auth/qa.json";

setup("iniciar sesión con el usuario QA de dev", async ({ page }) => {
  // Si una corrida anterior se cortó con el interruptor apagado, se repone antes de empezar.
  const repuesto = await restaurarInterruptor();
  if (repuesto !== null) console.log(`[interruptor] membresias_nuevas repuesto a "${repuesto}" (la corrida anterior se cortó)`);

  const email = process.env.E2E_EMAIL ?? "qa-cloud@tropicana.local";
  const clave = process.env.E2E_PASSWORD ?? process.env.QA_CLOUD_PASSWORD;

  mkdirSync("playwright/.auth", { recursive: true });
  if (!clave) {
    // Sin credenciales las pruebas no pueden correr: se dice por qué (no se
    // pasan en silencio) y las specs se saltan.
    writeFileSync(ARCHIVO, JSON.stringify({ cookies: [], origins: [] }));
    setup.skip(true, "Faltan E2E_PASSWORD o QA_CLOUD_PASSWORD en .env.local");
    return;
  }

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(clave);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.context().storageState({ path: ARCHIVO });
});
