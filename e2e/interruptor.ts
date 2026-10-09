import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

// El interruptor `membresias_nuevas` (parámetro) lo apaga la prueba
// zz-interruptor-apagado. Si el proceso se corta de golpe (cierre de la
// terminal, kill, apagón) el `afterAll` no corre: por eso el valor original se
// anota en un archivo ANTES de tocar nada, y la próxima corrida (login.setup,
// que va siempre primero) lo repone antes de empezar.

const DEV = "hyhijzuomqpylcmrzdvw";
const MARCA = "playwright/.interruptor-original.json";
const CLAVE = "membresias_nuevas";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const cliente = () => {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!llave || !url().includes(DEV)) return null; // solo contra dev y con la llave de servicio
  return createClient(url(), llave, { auth: { persistSession: false } });
};

export const hayClaveDeServicio = () => !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Anota el valor que hay ahora y apaga el interruptor. Devuelve el valor original. */
export async function apagarInterruptor(): Promise<string> {
  const sb = cliente();
  if (!sb) throw new Error(`Esta prueba solo corre contra dev (${DEV}) y con SUPABASE_SERVICE_ROLE_KEY; URL: ${url()}`);
  // Una marca de una corrida cortada manda: el valor de ahora (apagado) no es el original.
  await restaurarInterruptor();
  const { data, error } = await sb.from("parametros").select("valor").eq("clave", CLAVE).single();
  if (error) throw error;
  mkdirSync("playwright", { recursive: true });
  writeFileSync(MARCA, JSON.stringify({ valor: data.valor }));
  const { error: e2 } = await sb.from("parametros").update({ valor: "false" }).eq("clave", CLAVE);
  if (e2) throw e2;
  return data.valor;
}

/** Repone el valor anotado (si hay marca) y borra la marca. No hace nada si no hay marca. */
export async function restaurarInterruptor(): Promise<string | null> {
  if (!existsSync(MARCA)) return null;
  const sb = cliente();
  if (!sb) return null;
  const { valor } = JSON.parse(readFileSync(MARCA, "utf8")) as { valor: string };
  const { error } = await sb.from("parametros").update({ valor }).eq("clave", CLAVE);
  if (error) throw error;
  rmSync(MARCA);
  return valor;
}
