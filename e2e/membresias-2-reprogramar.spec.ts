import { test, expect, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { crearMembresiaDePrueba, retirarMembresiaDePrueba, type MembresiaDePrueba } from "./membresiaDePrueba";

// Fase 2 (I-012): reprogramar y cancelar desde la ficha. Supone el interruptor
// `membresias_nuevas` = true en dev. Cada test crea su propia membresía de
// prueba (`membresiaDePrueba.ts`: contacto, alumno, 2 h) y la retira al terminar:
// nunca toca una membresía real. Las reservas de prueba van a más de 48 h, así
// cancelar no cae en «Ausente» ni consume horas. Solo contra dev y con la llave
// de servicio.

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

/** Abre la ficha de una membresía de prueba recién creada (por defecto 2 h para pedir: con poco saldo, un clic lejano no puede alargar). */
async function abrirDePrueba(page: Page, horas = 2): Promise<MembresiaDePrueba | null> {
  const prueba = await crearMembresiaDePrueba(horas);
  if (!prueba) return null;
  await page.goto(`/membresias/${prueba.membresiaId}?estado=activas`);
  await expect(page.getByTestId("ficha-membresia")).toBeVisible();
  expect(await disponible(page)).toBe(horas);
  return prueba;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** En la hoja abierta, va a un día a más de 48 h que tenga franjas libres. */
async function irAUnDiaLibre(hoja: Locator) {
  await expect(hoja.getByTestId("franjas")).toBeVisible();
  let hayLibre = false;
  for (let dias = 3; dias <= 10 && !hayLibre; dias++) {
    await hoja.getByLabel("Otra fecha").fill(iso(new Date(Date.now() + dias * 86_400_000)));
    await expect(hoja.getByTestId("franjas").locator(".n-franja").first().or(hoja.getByTestId("sala-cerrada"))).toBeVisible();
    hayLibre = (await hoja.locator(LIBRE).count()) > 0;
  }
  test.skip(!hayLibre, "No hay franjas libres a más de 48 h en los próximos días");
}

/** Crea una reserva Confirmada con el mínimo, a más de 48 h, en la primera franja libre; devuelve su id. */
async function crearReserva(page: Page, membresiaId: number): Promise<number> {
  await page.getByTestId("boton-nueva-reserva").click();
  const hoja = page.getByRole("dialog");
  await irAUnDiaLibre(hoja);
  await hoja.locator(LIBRE).first().click();
  await hoja.getByRole("button", { name: "Confirmar directo" }).click();
  await expect(hoja.getByRole("button", { name: "Listo" })).toBeVisible({ timeout: 30_000 });
  await hoja.getByRole("button", { name: "Listo" }).click();
  const { data } = await sb().from("reservas_sala").select("id").eq("membresia_id", membresiaId).order("id", { ascending: false }).limit(1);
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

test("reprogramar: más tarde, más temprano, alargar, acortar, hasta lo disponible y el mismo rango", async ({ page }) => {
  test.setTimeout(300_000);
  let prueba: MembresiaDePrueba | null = null;
  try {
    prueba = await abrirDePrueba(page);
    test.skip(!prueba, "No hay una particular activa de dev que sirva de modelo");
    const id = await crearReserva(page, prueba!.membresiaId);
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
    // En el tope: la línea fija del resumen lo explica y "+ sumar" ya no está.
    if ((await hoja.locator('.n-franja[data-sumar="true"]').count()) === 0) {
      await expect(hoja.getByTestId("aviso-tope")).toContainText("No quedan horas para alargar · disponible 0 h");
    }
    // Un clic más allá del tope no alarga: empieza un rango nuevo con la duración mínima o no hace nada.
    const mas = hoja.locator(LIBRE).last();
    if (await mas.count()) await mas.click();
    const duracion = /([\d.,]+) h\s*·/.exec(await hoja.getByTestId("resumen-reserva").innerText());
    if (duracion) expect(Number(duracion[1].replace(",", ".")), "lo elegido no pasa de lo disponible").toBeLessThanOrEqual(tope + 1e-9);
    if (await hoja.getByRole("button", { name: "Mover reserva" }).isEnabled()) await mover(page, hoja);
    expect((await leer(id)).min / 60, "lo guardado no pasa de lo disponible").toBeLessThanOrEqual(tope + 1e-9);
  } finally {
    await retirarMembresiaDePrueba(prueba);
  }
});

test("cancelar: el aviso sale en la columna derecha, se puede cerrar y no vuelve al refrescar", async ({ page }) => {
  test.setTimeout(180_000);
  let prueba: MembresiaDePrueba | null = null;
  try {
    prueba = await abrirDePrueba(page);
    test.skip(!prueba, "No hay una particular activa de dev que sirva de modelo");
    const id = await crearReserva(page, prueba!.membresiaId);

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

    // A más de 48 h cancelar devuelve la hora: queda «reagendar», nunca «Ausente».
    await expect.poll(() => leer(id).then((r) => r.estado), { timeout: 60_000 }).toBe("reagendar");
    await expect.poll(() => disponible(page)).toBe(2);

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
    await retirarMembresiaDePrueba(prueba);
  }
});

/** Cancela la reserva desde su fila y espera a que quede «Por reagendar»; cierra los avisos que dejó. */
async function cancelarReserva(page: Page, id: number) {
  const f = fila(page, id);
  await f.locator(".n-res__fila").click();
  await f.getByRole("button", { name: /^Cancelar/ }).click();
  await f.getByRole("button", { name: /Confirmar cancelación/ }).click();
  await expect.poll(() => leer(id).then((r) => r.estado), { timeout: 60_000 }).toBe("reagendar");
  const panel = page.getByTestId("avisos-pendientes");
  await expect(panel).toBeVisible({ timeout: 60_000 });
  while (await panel.count()) {
    await panel.getByRole("button", { name: "Cerrar aviso" }).first().click();
    await page.waitForTimeout(200);
  }
}

test("reagendar: una reserva «Por reagendar» se reemplaza por una nueva ligada, con enlace en la fila", async ({ page }) => {
  test.setTimeout(240_000);
  let prueba: MembresiaDePrueba | null = null;
  try {
    prueba = await abrirDePrueba(page);
    test.skip(!prueba, "No hay una particular activa de dev que sirva de modelo");
    const id = await crearReserva(page, prueba!.membresiaId);
    const original = await leer(id);
    await cancelarReserva(page, id);

    // La fila dice «Por reagendar» y ofrece «Reagendar» (no «Estado final»).
    const f = fila(page, id);
    await expect(f).toContainText("Por reagendar");
    await f.locator(".n-res__fila").click();
    await expect(f.getByText("Estado final")).toHaveCount(0);
    await f.getByTestId("boton-reagendar").click();

    // La hoja es de reserva nueva, con la sala y la duración de la original ya cargadas.
    const hoja = page.getByRole("dialog");
    await expect(hoja.getByText("Reagendar reserva")).toBeVisible();
    await expect(hoja.getByTestId("reserva-por-reagendar")).toContainText(original.hora);
    await expect(hoja.getByRole("button", { name: "Solicitar" })).toHaveCount(0);
    await irAUnDiaLibre(hoja);
    await hoja.locator(LIBRE).first().click();
    await expect(hoja.getByTestId("resumen-reserva")).toContainText("1 h");
    await hoja.getByRole("button", { name: "Reagendar", exact: true }).click();
    await expect(hoja.getByText(/Reagendada para el/)).toBeVisible({ timeout: 30_000 });
    await hoja.getByRole("button", { name: "Listo" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // En la base: una reserva nueva, confirmada, ligada a la original; el saldo baja 1 h.
    const { data } = await sb().from("reservas_sala").select("id, estado, duracion_min, reagenda_de").eq("reagenda_de", id);
    expect(data?.length).toBe(1);
    expect(data![0].estado).toBe("confirmada");
    expect(data![0].duracion_min).toBe(60);
    await expect.poll(() => disponible(page)).toBe(1);

    // La original muestra «Reagendada →» con enlace a la nueva.
    await expect(f.getByTestId("reagendada-a")).toBeVisible({ timeout: 30_000 });
    await expect(f.getByTestId("reagendada-a")).toContainText("Reagendada →");
    await expect(f.getByRole("button", { name: "Reagendar", exact: true })).toHaveCount(0);
    await f.getByTestId("reagendada-a").getByRole("button").click();
    await expect(fila(page, data![0].id)).toHaveAttribute("data-abierta", "true");
  } finally {
    await retirarMembresiaDePrueba(prueba);
  }
});

test("alargar con saldo justo: la línea del tope se ve y el clic en la franja de abajo mueve sin alargar", async ({ page }) => {
  test.setTimeout(240_000);
  let prueba: MembresiaDePrueba | null = null;
  try {
    prueba = await abrirDePrueba(page, 1); // 1 h: la reserva de 1 h agota el paquete
    test.skip(!prueba, "No hay una particular activa de dev que sirva de modelo");
    const id = await crearReserva(page, prueba!.membresiaId);
    const creada = await leer(id);
    await expect.poll(() => disponible(page)).toBe(0);

    const hoja = await abrirReprogramar(page, id);
    await hoja.locator('.n-franja[data-aspecto="actual"]').first().click();
    await expect(hoja.getByTestId("aviso-tope")).toContainText("No quedan horas para alargar · disponible 0 h");
    await expect(hoja.locator('.n-franja[data-sumar="true"]')).toHaveCount(0);

    // La franja inmediata (justo después de la reserva) no está bloqueada: mueve la reserva sin alargarla.
    const [h, m] = creada.hora.split(":").map(Number);
    const finMin = h * 60 + m + 60;
    const siguiente = `${String(Math.floor(finMin / 60)).padStart(2, "0")}:${String(finMin % 60).padStart(2, "0")}`;
    const inmediata = hoja.locator(`.n-franja[data-hora="${siguiente}"]`);
    test.skip((await inmediata.count()) === 0 || (await inmediata.getAttribute("aria-disabled")) === "true", "La franja siguiente no está libre");
    await inmediata.click();
    await expect(hoja.getByTestId("resumen-reserva")).toContainText(`${siguiente}–`);
    await expect(hoja.getByTestId("resumen-reserva")).toContainText("1 h");
    await mover(page, hoja);
    await expect.poll(() => leer(id).then((r) => r.hora)).toBe(siguiente);
    expect((await leer(id)).min).toBe(60);
  } finally {
    await retirarMembresiaDePrueba(prueba);
  }
});
