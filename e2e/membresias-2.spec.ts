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

test("elegir franjas en la grilla, solicitar y comprobar que baja el saldo", async ({ page }) => {
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
    await expect(hoja.getByTestId("franjas")).toBeVisible();

    // Sin elección: los botones están apagados y el resumen pide la hora de inicio.
    const resumen = hoja.getByTestId("resumen-reserva");
    await expect(resumen).toContainText("Elegí la hora de inicio");
    await expect(hoja.getByRole("button", { name: "Solicitar" })).toBeDisabled();

    // Primer clic: inicio con el mínimo; la franja siguiente invita a sumar un intervalo.
    const libres = hoja.locator('.n-franja[data-aspecto="libre"]');
    test.skip((await libres.count()) === 0, "El día por defecto no tiene franjas libres; no hay qué elegir");
    await libres.first().click();
    await expect(resumen).toContainText(/\d{2}:\d{2}–\d{2}:\d{2}/);
    const sumar = hoja.locator('.n-franja[data-sumar="true"]');
    if (await sumar.count()) {
      // Segundo clic: suma un intervalo (solo si lo que queda para pedir lo permite).
      await sumar.first().click();
    }
    await expect(hoja.getByRole("button", { name: "Solicitar" })).toBeEnabled();

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
