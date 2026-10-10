import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

// R20 · PR #47: comprobación operativa del cableado de los avisos de venta (N01 inscripción y
// N02 recibo). Crea un contacto «E2E-PRUEBA» con WhatsApp, lo inscribe en un plan regular de
// 1 clase cobrando la cuota entera en efectivo y guarda el texto exacto de cada aviso en
// `test-results/r20-avisos-ventas.json`. Solo contra dev y con la llave de servicio. Al terminar,
// la membresía queda en «baja» y el contacto marcado (el historial de solo agregar impide borrar).

const DEV = "hyhijzuomqpylcmrzdvw";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(!process.env.E2E_PASSWORD && !process.env.QA_CLOUD_PASSWORD, "Faltan credenciales del usuario QA");
test.skip(!llave || !url.includes(DEV), "Crea una venta: solo contra dev y con SUPABASE_SERVICE_ROLE_KEY");

type Aviso = { paso: string; nombre: string; texto: string };
const recogidos: Aviso[] = [];
const guardar = () => {
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/r20-avisos-ventas.json", JSON.stringify(recogidos, null, 2));
};

test("avisos de venta: inscripción y recibo", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(url, llave!, { auth: { persistSession: false } });
  const c = await sb.from("contactos").insert({ tipo: "persona", nombre: "E2E-PRUEBA", apellido: `Venta ${Date.now()}`, whatsapp: `+5917${Date.now().toString().slice(-7)}` }).select("id, apellido").single();
  expect(c.error, "se creó el contacto de prueba").toBeNull();
  try {
    await page.goto("/inscribir");
    await page.waitForLoadState("networkidle");
    await page.locator("main input").first().fill(c.data!.apellido);
    await page.getByRole("button", { name: new RegExp(c.data!.apellido) }).first().click();
    await page.locator("main button", { hasText: "CR - TU RITMO 1 -" }).first().click();
    await expect(page.getByText("Precio del plan")).toBeVisible();
    await page.getByRole("button", { name: "Cuota entera" }).click();
    await page.getByRole("button", { name: "Efectivo", exact: true }).click();
    const inscribir = page.getByRole("button", { name: /^Inscribir ·/ });
    await expect(inscribir).toBeEnabled({ timeout: 15_000 });
    await inscribir.click();
    await expect(page.getByText("Inscripción registrada")).toBeVisible({ timeout: 60_000 });
    const tarjetas = page.locator("main p.whitespace-pre-wrap");
    await expect(tarjetas.first()).toBeVisible();
    for (let i = 0; i < (await tarjetas.count()); i++) {
      const p = tarjetas.nth(i);
      const nombre = (await p.locator("xpath=preceding-sibling::div[1]").innerText().catch(() => "")).trim();
      recogidos.push({ paso: "inscribir", nombre, texto: (await p.innerText()).trim() });
    }
  } finally {
    guardar();
    const m = await sb.from("membresias").select("id").eq("contacto_id", c.data!.id);
    for (const x of m.data ?? []) await sb.from("membresias").update({ estado: "baja" }).eq("id", x.id);
    // si la venta no llegó a hacerse, el contacto de prueba no queda
    if (!(m.data ?? []).length) await sb.from("contactos").delete().eq("id", c.data!.id);
  }
  expect(recogidos.length, "la pantalla mostró avisos").toBeGreaterThan(0);
  for (const a of recogidos) {
    expect(a.texto, `${a.paso}: texto del aviso`).not.toMatch(/\{\{|\}\}|undefined|\bnull\b|NaN|\[object/);
    expect(a.texto.length, `${a.paso}: no está vacío`).toBeGreaterThan(20);
  }
});
