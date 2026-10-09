import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Fase 2 (I-012): «+ Nueva reserva» dentro de la ficha. Supone el interruptor
// `membresias_nuevas` = true en dev. La membresía se toma de la lista (una
// particular activa con saldo), nunca por id fijo. Lo que se crea se borra en
// `finally`, solo contra dev y con la llave de servicio.

const DEV = "hyhijzuomqpylcmrzdvw";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(
  !process.env.E2E_PASSWORD && !process.env.QA_CLOUD_PASSWORD,
  "Faltan credenciales del usuario QA (E2E_PASSWORD o QA_CLOUD_PASSWORD)"
);
test.skip(!llave || !url.includes(DEV), "Crea reservas: solo contra dev y con SUPABASE_SERVICE_ROLE_KEY");

const disponible = async (page: Page) => {
  const t = await page.getByTestId("resumen-reservas").innerText();
  const m = /Disponible para pedir\s*([\d.,]+) h/.exec(t);
  return m ? Number(m[1].replace(",", ".")) : NaN;
};

test("fuera de horario no guarda; una franja válida se solicita y baja el saldo", async ({ page }) => {
  const inicio = new Date().toISOString();
  let membresiaId = 0;
  try {
    await page.goto("/membresias?estado=activas");
    const fila = page.getByTestId("fila-membresia").filter({ has: page.locator('.n-punto[data-tipo="particular"]') }).first();
    await expect(fila, "hay una particular activa en dev").toBeVisible();
    await fila.click();
    const ficha = page.getByTestId("ficha-membresia");
    await expect(ficha).toBeVisible();
    membresiaId = Number(await ficha.getAttribute("data-membresia-id"));

    const antes = await disponible(page);
    expect(antes, "la particular tiene saldo para pedir").toBeGreaterThan(0);

    await page.getByTestId("boton-nueva-reserva").click();
    const hoja = page.getByRole("dialog");
    await expect(hoja).toBeVisible();

    // Fuera de horario: la sala no abre a las 03:00; el servidor lo niega y dice por qué.
    await hoja.locator('input[type="time"]').fill("03:00");
    await hoja.getByRole("button", { name: "Solicitar" }).click();
    const error = hoja.getByRole("alert");
    await expect(error).toContainText(/La sala (abre|no abre)|Todavía no está cargado/);
    expect(await disponible(page), "un rechazo no toca el saldo").toBe(antes);

    // De ahí sale el comienzo de la ventana válida de ese día.
    const abre = /La sala abre (\d{2}:\d{2})–/.exec((await error.innerText()) ?? "");
    test.skip(!abre, "El día por defecto no tiene ventana de apertura; no hay franja válida que probar");
    await hoja.locator('input[type="time"]').fill(abre![1]);
    await hoja.getByRole("button", { name: "Solicitar" }).click();
    await expect(hoja.getByText(/Solicitada para el/)).toBeVisible();

    await hoja.getByRole("button", { name: "Listo" }).click();
    await expect.poll(() => disponible(page)).toBeLessThan(antes);
  } finally {
    if (membresiaId) {
      const sb = createClient(url, llave!, { auth: { persistSession: false } });
      await sb.from("reservas_sala").delete().eq("membresia_id", membresiaId).gte("creado_en", inicio);
    }
  }
});
