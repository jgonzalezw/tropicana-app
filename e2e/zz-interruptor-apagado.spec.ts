import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { apagarInterruptor, restaurarInterruptor } from "./interruptor";

// Interruptor apagado: la app queda igual que hoy. Es la única prueba que
// cambia datos (el parámetro `membresias_nuevas`), por eso:
//  - se niega a correr si la base no es DEV (hyhijzuomqpylcmrzdvw);
//  - restaura el valor que encontró (afterAll), aunque falle a mitad, y si el
//    proceso se corta lo repone la próxima corrida (e2e/interruptor.ts);
//  - se llama zz-… para correr al final (la config usa un solo worker).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(
  !process.env.E2E_PASSWORD && !process.env.QA_CLOUD_PASSWORD,
  "Faltan credenciales del usuario QA (E2E_PASSWORD o QA_CLOUD_PASSWORD)"
);
test.skip(!llave, "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");

const admin = () => createClient(url, llave!, { auth: { persistSession: false } });

test.describe.configure({ mode: "serial" });

// `apagarInterruptor` anota el valor original en un archivo antes de apagarlo; si esta
// corrida se corta de golpe (sin `afterAll`), la próxima lo repone en `login.setup`.
test.beforeAll(async () => {
  await apagarInterruptor();
});

test.afterAll(async () => {
  await restaurarInterruptor();
});

test("interruptor apagado: sin entrada, /membresias da 404 y el resto sigue igual", async ({ page }) => {
  await page.goto("/");
  const barra = page.getByRole("navigation");
  await expect(barra.getByRole("link", { name: "Particulares" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Membresías" })).toHaveCount(0);

  // Una ficha real (fase 1b) tampoco existe con el interruptor apagado.
  const { data: una, error: eUna } = await admin().from("membresias").select("id").limit(1).single();
  if (eUna) throw eUna;
  for (const ruta of ["/membresias", `/membresias/${una.id}`, "/membresias/muestrario"]) {
    const r = await page.goto(ruta);
    expect(r?.status()).toBe(404);
  }

  // Las pantallas de hoy siguen abriendo.
  for (const ruta of ["/particulares", "/alquileres", "/alumnos"]) {
    const r = await page.goto(ruta);
    expect(r?.status(), ruta).toBe(200);
  }
});
