import { test, expect, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Fase 2 (I-012): reprogramar y cancelar desde la ficha. Supone el interruptor
// `membresias_nuevas` = true en dev. Cada test crea su propia reserva en una
// particular activa con saldo (nunca una existente) y la libera en `finally`,
// solo contra dev y con la llave de servicio.

const DEV = "hyhijzuomqpylcmrzdvw";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(!process.env.E2E_PASSWORD && !process.env.QA_CLOUD_PASSWORD, "Faltan credenciales del usuario QA (E2E_PASSWORD o QA_CLOUD_PASSWORD)");
test.skip(!llave || !url.includes(DEV), "Crea reservas: solo contra dev y con SUPABASE_SERVICE_ROLE_KEY");

const sb = () => createClient(url, llave!, { auth: { persistSession: false } });
const LIBRE = '.n-franja[data-aspecto="libre"]:not([aria-disabled="true"])';

const disponible = async (page: Page) => {
  const t = await page.getByTestId("resumen-reservas").innerText();
  const m = /Disponible para pedir\s*([\d.,]+) h/.exec(t);
  return m ? Number(m[1].replace(",", ".")) : NaN;
};

/** Abre la ficha de la primera particular activa con al menos `minimoH` horas para pedir; devuelve su id (0 si no hay). */
async function abrirParticular(page: Page, minimoH: number): Promise<number> {
  await page.goto("/membresias?estado=activas");
  const particulares = () => page.getByTestId("fila-membresia").filter({ has: page.locator('.n-punto[data-tipo="particular"]') });
  const total = await particulares().count();
  for (let i = 0; i < total; i++) {
    await page.goto("/membresias?estado=activas");
    await particulares().nth(i).click();
    const ficha = page.getByTestId("ficha-membresia");
    await expect(ficha).toBeVisible();
    if ((await disponible(page)) >= minimoH) return Number(await ficha.getAttribute("data-membresia-id"));
  }
  return 0;
}

/** Crea una reserva Confirmada con el mínimo en la primera franja libre y devuelve su id. */
async function crearReserva(page: Page, membresiaId: number, inicio: string): Promise<number> {
  await page.getByTestId("boton-nueva-reserva").click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByTestId("franjas")).toBeVisible();
  const libres = hoja.locator(LIBRE);
  test.skip((await libres.count()) === 0, "El día por defecto no tiene franjas libres; no hay qué elegir");
  await libres.first().click();
  await hoja.getByRole("button", { name: "Confirmar directo" }).click();
  await expect(hoja.getByRole("button", { name: "Listo" })).toBeVisible({ timeout: 30_000 });
  await hoja.getByRole("button", { name: "Listo" }).click();
  const { data } = await sb().from("reservas_sala").select("id").eq("membresia_id", membresiaId).gte("creado_en", inicio).order("id", { ascending: false }).limit(1);
  const id = data?.[0]?.id as number;
  expect(id, "se creó la reserva").toBeTruthy();
  return id;
}

const leer = async (id: number) => {
  const { data } = await sb().from("reservas_sala").select("estado, fecha, hora, duracion_min").eq("id", id).single();
  return { estado: data!.estado as string, hora: (data!.hora as string).slice(0, 5), min: data!.duracion_min as number };
};

const fila = (page: Page, id: number) => page.locator(`[data-testid="fila-reserva"][data-reserva-id="${id}"]`);

/** Abre la hoja «Reprogramar reserva» de esa reserva. */
async function abrirReprogramar(page: Page, id: number): Promise<Locator> {
  const f = fila(page, id);
  await expect(f).toBeVisible();
  if (!(await f.getAttribute("data-abierta"))) await f.locator(".n-res__fila").click();
  await f.getByRole("button", { name: "Reprogramar" }).click();
  const hoja = page.getByRole("dialog");
  await expect(hoja.getByText("Reprogramar reserva")).toBeVisible();
  await expect(hoja.getByTestId("franjas")).toBeVisible();
  await expect(hoja.locator('.n-franja[data-aspecto="actual"]').first()).toBeVisible();
  return hoja;
}

/** Aprieta «Mover reserva» y cierra la hoja; el resultado se lee de la base. */
async function mover(page: Page, hoja: Locator) {
  const boton = hoja.getByRole("button", { name: "Mover reserva" });
  await expect(boton).toBeEnabled();
  await boton.click();
  await expect(hoja.getByText(/Reserva movida/)).toBeVisible({ timeout: 30_000 });
  await hoja.getByRole("button", { name: "Listo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

const liberar = async (membresiaId: number, inicio: string) => {
  if (!membresiaId) return;
  // La base no deja borrar una reserva con historial: se libera el saldo pasándola a «reagendar».
  await sb()
    .from("reservas_sala")
    .update({ estado: "reagendar", solicitada_hasta: null })
    .eq("membresia_id", membresiaId)
    .gte("creado_en", inicio)
    .in("estado", ["confirmada", "reprogramada", "solicitada", "ausente"]);
};

test("reprogramar: más tarde, más temprano, alargar, acortar, hasta lo disponible y el mismo rango", async ({ page }) => {
  test.setTimeout(300_000);
  const inicio = new Date().toISOString();
  let membresiaId = 0;
  try {
    membresiaId = await abrirParticular(page, 2);
    test.skip(!membresiaId, "No hay una particular con al menos 2 h para pedir");
    const id = await crearReserva(page, membresiaId, inicio);
    const creada = await leer(id);
    expect(creada.min).toBe(60);

    // Mismo rango: «Mover reserva» queda apagado, sin elegir y eligiendo el horario actual.
    let hoja = await abrirReprogramar(page, id);
    await expect(hoja.getByRole("button", { name: "Mover reserva" })).toBeDisabled();
    await hoja.locator('.n-franja[data-aspecto="actual"]').first().click();
    await expect(hoja.getByTestId("resumen-reserva")).toContainText("Es el horario actual");
    await expect(hoja.getByRole("button", { name: "Mover reserva" })).toBeDisabled();

    // Más tarde, con el horario actual ya elegido: la franja de más abajo empieza un rango nuevo, no se bloquea.
    const ultima = hoja.locator(LIBRE).last();
    const horaTarde = (await ultima.getAttribute("data-hora"))!;
    expect(horaTarde > creada.hora, "hay una franja libre más tarde").toBe(true);
    await ultima.click();
    await expect(hoja.getByTestId("resumen-reserva")).toContainText(horaTarde);
    await mover(page, hoja);
    await expect.poll(() => leer(id).then((r) => r.hora)).toBe(horaTarde);
    expect((await leer(id)).min).toBe(60);

    // Más temprano, sin elegir antes el horario actual.
    hoja = await abrirReprogramar(page, id);
    const primera = hoja.locator(LIBRE).first();
    const horaTemprano = (await primera.getAttribute("data-hora"))!;
    expect(horaTemprano < horaTarde, "hay una franja libre más temprano").toBe(true);
    await primera.click();
    await mover(page, hoja);
    await expect.poll(() => leer(id).then((r) => r.hora)).toBe(horaTemprano);

    // Alargar de 1 h a 1,5 h: se guarda y el saldo baja media hora.
    const antesAlargar = await disponible(page);
    hoja = await abrirReprogramar(page, id);
    await hoja.locator('.n-franja[data-aspecto="actual"]').first().click();
    await hoja.locator('.n-franja[data-sumar="true"]').first().click();
    await expect(hoja.getByTestId("resumen-reserva")).toContainText("1,5 h");
    await mover(page, hoja);
    await expect.poll(() => leer(id).then((r) => r.min)).toBe(90);
    await expect.poll(() => disponible(page)).toBeCloseTo(antesAlargar - 0.5, 1);

    // Acortar de 1,5 h a 1 h: se guarda y el saldo devuelve la diferencia.
    const antesAcortar = await disponible(page);
    hoja = await abrirReprogramar(page, id);
    await hoja.locator('.n-franja[data-aspecto="actual"]').first().click();
    await hoja.locator('.n-franja[data-aspecto="elegida"]').nth(1).click(); // tocar el 2.º bloque deja 1 h
    await expect(hoja.getByTestId("resumen-reserva")).toContainText("1 h");
    await mover(page, hoja);
    await expect.poll(() => leer(id).then((r) => r.min)).toBe(60);
    await expect.poll(() => disponible(page)).toBeCloseTo(antesAcortar + 0.5, 1);

    // Alargar hasta lo disponible: se guarda y no deja pasarse (a lo sumo 1 h + lo que quedaba para pedir).
    const tope = (await disponible(page)) + 1;
    hoja = await abrirReprogramar(page, id);
    await hoja.locator('.n-franja[data-aspecto="actual"]').first().click();
    for (let i = 0; i < 12 && (await hoja.locator('.n-franja[data-sumar="true"]').count()) > 0; i++) {
      await hoja.locator('.n-franja[data-sumar="true"]').first().click();
    }
    // Un clic más allá del tope no alarga: empieza un rango nuevo con la duración mínima o no hace nada.
    const mas = hoja.locator(LIBRE).last();
    if (await mas.count()) await mas.click();
    const duracion = /([\d.,]+) h\s*·/.exec(await hoja.getByTestId("resumen-reserva").innerText());
    if (duracion) expect(Number(duracion[1].replace(",", ".")), "lo elegido no pasa de lo disponible").toBeLessThanOrEqual(tope + 1e-9);
    if (await hoja.getByRole("button", { name: "Mover reserva" }).isEnabled()) await mover(page, hoja);
    expect((await leer(id)).min / 60, "lo guardado no pasa de lo disponible").toBeLessThanOrEqual(tope + 1e-9);
  } finally {
    await liberar(membresiaId, inicio);
  }
});

test("cancelar: el aviso sale en la columna derecha, se puede cerrar y no vuelve al refrescar", async ({ page }) => {
  test.setTimeout(180_000);
  const inicio = new Date().toISOString();
  let membresiaId = 0;
  try {
    membresiaId = await abrirParticular(page, 1);
    test.skip(!membresiaId, "No hay una particular con saldo");
    const id = await crearReserva(page, membresiaId, inicio);

    // Los avisos de la hoja al crear también van a la columna derecha; se cierran antes de cancelar.
    const panel = page.getByTestId("avisos-pendientes");
    await expect(panel).toBeVisible();
    while (await panel.count()) {
      await panel.getByRole("button", { name: "Cerrar aviso" }).first().click();
      await page.waitForTimeout(200);
    }

    const f = fila(page, id);
    await f.locator(".n-res__fila").click();
    await f.getByRole("button", { name: /^Cancelar/ }).click();
    await f.getByRole("button", { name: /Confirmar cancelación/ }).click();

    // El aviso va a la columna derecha (no dentro de la fila) y la fila se cierra con sus opciones como nuevas.
    await expect(panel).toBeVisible({ timeout: 60_000 });
    await expect(panel.getByText("Enviar por WhatsApp").first()).toBeVisible();
    expect(await panel.evaluate((el) => !!el.closest("aside")), "el aviso está en la columna derecha").toBe(true);
    await expect(f.getByText("Enviar por WhatsApp")).toHaveCount(0);
    await expect(f.getByRole("button", { name: /Confirmar cancelación/ })).toHaveCount(0);
    await expect(f).not.toHaveAttribute("data-abierta", "true");

    // Se cierra con su botón.
    await panel.getByRole("button", { name: "Cerrar aviso" }).click();
    await expect(page.getByTestId("avisos-pendientes")).toHaveCount(0);

    // No vuelve al refrescar.
    await page.reload();
    await expect(page.getByTestId("ficha-membresia")).toBeVisible();
    await expect(page.getByTestId("avisos-pendientes")).toHaveCount(0);
  } finally {
    await liberar(membresiaId, inicio);
  }
});
