"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { puedeIniciarSesion } from "@/lib/acceso";

/**
 * Resultado del intento de login. Distingue explícitamente credenciales
 * incorrectas de cuenta bloqueada, para que el Login pueda mostrar cada
 * estado por separado (la pantalla de Login la maneja Claude Design; este
 * contrato es el que consume).
 */
export type ResultadoLogin =
  | { ok: true }
  | { estado: "credenciales"; avisar: boolean }
  | { estado: "bloqueada" }
  | { estado: "error"; mensaje: string };

const DEFECTO_AVISO = 3;
const DEFECTO_BLOQUEO = 7;

async function leerUmbrales(
  admin: NonNullable<ReturnType<typeof createAdminClient>>
): Promise<{ aviso: number; bloqueo: number }> {
  const { data } = await admin
    .from("parametros")
    .select("clave, valor")
    .in("clave", ["login_umbral_aviso", "login_umbral_bloqueo"]);

  const map = new Map((data ?? []).map((p) => [p.clave, Number(p.valor)]));
  const aviso = map.get("login_umbral_aviso");
  const bloqueo = map.get("login_umbral_bloqueo");
  return {
    aviso: Number.isFinite(aviso) && aviso! > 0 ? aviso! : DEFECTO_AVISO,
    bloqueo: Number.isFinite(bloqueo) && bloqueo! > 0 ? bloqueo! : DEFECTO_BLOQUEO,
  };
}

export async function iniciarSesion(
  email: string,
  password: string
): Promise<ResultadoLogin> {
  const correo = email.trim().toLowerCase();
  const supabase = await createClient();
  const admin = createAdminClient();

  // Sin service_role no podemos leer/actualizar el estado de bloqueo:
  // degradamos a un login básico (sigue funcionando, sin conteo ni bloqueo).
  if (!admin) {
    const { error } = await supabase.auth.signInWithPassword({
      email: correo,
      password,
    });
    return error ? { estado: "credenciales", avisar: false } : { ok: true };
  }

  // Buscamos la cuenta por email para chequear bloqueo ANTES de autenticar.
  const { data: perfil } = await admin
    .from("perfiles")
    .select("id, activo, bloqueado, motivo_bloqueo, intentos_fallidos")
    .eq("email", correo)
    .maybeSingle();

  const { aviso, bloqueo } = await leerUmbrales(admin);

  // Cuenta bloqueada o dada de baja: no intentamos autenticar (no revelamos
  // si la contraseña era correcta). Regla única: activo && !bloqueado.
  if (perfil && !puedeIniciarSesion(perfil)) {
    return { estado: "bloqueada" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password,
  });

  // Éxito: sesión establecida. Reiniciamos el contador de intentos.
  if (!error) {
    if (perfil) {
      await admin
        .from("perfiles")
        .update({ intentos_fallidos: 0 })
        .eq("id", perfil.id);
    }
    return { ok: true };
  }

  // Falla de credenciales. Si no conocemos la cuenta, respondemos genérico
  // (sin contar) para no filtrar qué correos existen.
  if (!perfil) return { estado: "credenciales", avisar: false };

  const intentos = (perfil.intentos_fallidos ?? 0) + 1;

  // Al alcanzar el umbral de bloqueo, la cuenta queda bloqueada (auto).
  if (intentos >= bloqueo) {
    await admin
      .from("perfiles")
      .update({
        intentos_fallidos: intentos,
        bloqueado: true,
        motivo_bloqueo: "auto",
        bloqueado_en: new Date().toISOString(),
      })
      .eq("id", perfil.id);
    return { estado: "bloqueada" };
  }

  await admin
    .from("perfiles")
    .update({ intentos_fallidos: intentos })
    .eq("id", perfil.id);

  return { estado: "credenciales", avisar: intentos >= aviso };
}
