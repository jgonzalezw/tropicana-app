import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Interruptor apagado: la app queda igual que hoy. Es la única prueba que
// cambia datos (el parámetro `membresias_nuevas`), por eso:
//  - se niega a correr si la base no es DEV (hyhijzuomqpylcmrzdvw);
//  - restaura el valor original siempre (afterAll), aunque falle a mitad;
//  - se llama zz-… para correr al final (la config usa un solo worker).

const DEV = "hyhijzuomqpylcmrzdvw";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(
  !process.env.E2E_PASSWORD && !process.env.QA_CLOUD_PASSWORD,
  "Faltan credenciales del usuario QA (E2E_PASSWORD o QA_CLOUD_PASSWORD)"
);
test.skip(!llave, "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");

const admin = () => createClient(url, llave!, { auth: { persistSession: false } });
let original: string | null = null;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  if (!url.includes(DEV)) throw new Error(`Esta prueba solo corre contra dev (${DEV}); URL: ${url}`);
  const { data, error } = await admin().from("parametros").select("valor").eq("clave", "membresias_nuevas").single();
  if (error) throw error;
  original = data.valor;
  const { error: e2 } = await admin().from("parametros").update({ valor: "false" }).eq("clave", "membresias_nuevas");
  if (e2) throw e2;
});

test.afterAll(async () => {
  if (original === null || !url.includes(DEV)) return;
  await admin().from("parametros").update({ valor: original }).eq("clave", "membresias_nuevas");
});

test("interruptor apagado: sin entrada, /membresias da 404 y el resto sigue igual", async ({ page }) => {
  await page.goto("/");
  const barra = page.getByRole("navigation");
  await expect(barra.getByRole("link", { name: "Particulares" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Membresías" })).toHaveCount(0);

  for (const ruta of ["/membresias", "/membresias/muestrario"]) {
    const r = await page.goto(ruta);
    expect(r?.status()).toBe(404);
  }

  // Las pantallas de hoy siguen abriendo.
  for (const ruta of ["/particulares", "/alquileres", "/alumnos"]) {
    const r = await page.goto(ruta);
    expect(r?.status(), ruta).toBe(200);
  }
});
