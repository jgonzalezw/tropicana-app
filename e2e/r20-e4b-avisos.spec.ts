import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { crearMembresiaDePrueba, retirarMembresiaDePrueba, type MembresiaDePrueba } from "./membresiaDePrueba";

// R20 · E4b/E5: comprobación en vivo de N09/N10 con avisos registrados (S05) — solo dev.
// Confirmar directo → un aviso por destinatario, texto del módulo, Marcar/Rectificar, Historial.

const DEV = "hyhijzuomqpylcmrzdvw";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(!process.env.E2E_PASSWORD && !process.env.QA_CLOUD_PASSWORD, "Faltan credenciales del usuario QA");
test.skip(!llave || !url.includes(DEV), "Solo contra dev y con SUPABASE_SERVICE_ROLE_KEY");

const sb = () => createClient(url, llave!, { auth: { persistSession: false } });
const LIBRE = '.n-franja[data-aspecto="libre"]:not([aria-disabled="true"])';
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("N09/N10 registrados: confirmar, declarar, rectificar, historial", async ({ page }: { page: Page }) => {
  test.setTimeout(240_000);
  let prueba: MembresiaDePrueba | null = null;
  try {
    prueba = await crearMembresiaDePrueba(2);
    test.skip(!prueba, "No hay una particular activa de dev que sirva de modelo");
    await page.goto(`/membresias/${prueba!.membresiaId}?estado=activas`);
    await expect(page.getByTestId("ficha-membresia")).toBeVisible();
    await page.getByTestId("boton-nueva-reserva").click();
    const hoja = page.getByRole("dialog");
    await expect(hoja.getByTestId("franjas")).toBeVisible();
    let hayLibre = false;
    for (let dias = 3; dias <= 10 && !hayLibre; dias++) {
      await hoja.getByLabel("Otra fecha").fill(iso(new Date(Date.now() + dias * 86_400_000)));
      await expect(hoja.getByTestId("franjas").locator(".n-franja").first().or(hoja.getByTestId("sala-cerrada"))).toBeVisible();
      hayLibre = (await hoja.locator(LIBRE).count()) > 0;
    }
    test.skip(!hayLibre, "No hay franjas libres");
    await hoja.locator(LIBRE).first().click();
    await hoja.getByRole("button", { name: "Confirmar directo" }).click();
    await expect(hoja.getByRole("button", { name: "Listo" })).toBeVisible({ timeout: 30_000 });

    await hoja.getByRole("button", { name: "Listo" }).click();
    const panel = page.getByTestId("avisos-pendientes");
    const n09 = panel.getByTestId("aviso-N09");
    const n10 = panel.getByTestId("aviso-N10");
    await expect(n09).toBeVisible();
    await expect(n10).toBeVisible();
    await expect(n09.getByTestId("aviso-estado")).toHaveText("Preparado");
    const texto09 = (await n09.getByTestId("aviso-texto").innerText()).trim();
    expect(texto09).not.toMatch(/\{\{|\}\}|undefined|\bnull\b|NaN/);

    // Un aviso por destinatario, con la versión oficial fijada.
    const { data: avisos } = await sb().from("avisos").select("id, caso, origen, version_id, estado, texto").eq("membresia_id", prueba!.membresiaId).order("caso");
    expect(avisos?.map((a) => a.caso)).toEqual(["N09", "N10"]);
    expect(avisos?.every((a) => a.origen === "modulo" && a.version_id && a.estado === "preparado")).toBe(true);
    expect(avisos?.find((a) => a.caso === "N09")?.texto.trim()).toBe(texto09);

    // Declarar, rectificar y ver el historial (las dos entradas quedan).
    await n09.getByRole("button", { name: "Marcar como enviado" }).click();
    await expect(n09.getByTestId("aviso-estado")).toHaveText("Declarado enviado");
    await n09.getByRole("button", { name: "Rectificar: no se envió" }).click();
    await expect(n09.getByTestId("aviso-estado")).toHaveText("Preparado");
    await n09.getByRole("button", { name: "Historial" }).click();
    await expect(n09.getByTestId("aviso-historial")).toContainText("Declarado enviado por el operador");
    await expect(n09.getByTestId("aviso-historial")).toContainText("Declaración rectificada");
    const { count } = await sb().from("aviso_acciones").select("id", { count: "exact", head: true }).eq("aviso_id", avisos!.find((a) => a.caso === "N09")!.id);
    expect(count).toBe(2);

    // Sigue habiendo un solo aviso por destinatario.
    const { count: total } = await sb().from("avisos").select("id", { count: "exact", head: true }).eq("membresia_id", prueba!.membresiaId);
    expect(total).toBe(2);
  } finally {
    await retirarMembresiaDePrueba(prueba);
  }
});
