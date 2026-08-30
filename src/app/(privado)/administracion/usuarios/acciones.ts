"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";

export async function actualizarUsuario(formData: FormData) {
  if (!(await tienePermiso("usuarios", "editar"))) {
    return { error: "Sin permiso." };
  }

  const id = String(formData.get("id"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellido = String(formData.get("apellido") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const rol_id = Number(formData.get("rol_id"));
  const activo = formData.get("activo") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfiles")
    .update({
      nombre,
      apellido,
      whatsapp,
      rol_id,
      activo,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/administracion/usuarios");
  return { ok: true };
}

/** Campos que limpian el bloqueo de acceso (desbloquear + reiniciar contador). */
const DESBLOQUEO = {
  bloqueado: false,
  motivo_bloqueo: null as string | null,
  intentos_fallidos: 0,
  bloqueado_en: null as string | null,
};

/**
 * Acción 1 — Reiniciar/cambiar contraseña. Asigna una contraseña nueva
 * (activa de inmediato) usando service_role, y de paso desbloquea la
 * cuenta y reinicia el contador de intentos. Camino para "olvidé la clave".
 */
export async function resetearContrasena(id: string, password: string) {
  if (!(await tienePermiso("usuarios", "editar"))) {
    return { error: "Sin permiso." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      error:
        "Falta configurar la clave service_role de Supabase en el servidor. Avisá al equipo de desarrollo.",
    };
  }

  const { error: errAuth } = await admin.auth.admin.updateUserById(id, {
    password,
  });
  if (errAuth) return { error: errAuth.message };

  const { error: errPerfil } = await admin
    .from("perfiles")
    .update({ ...DESBLOQUEO, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (errPerfil) {
    return {
      error:
        "La contraseña se cambió, pero no se pudo limpiar el bloqueo: " +
        errPerfil.message,
    };
  }

  revalidatePath("/administracion/usuarios");
  return { ok: true };
}

/**
 * Acción 2 — Desbloquear sin cambiar la contraseña. Levanta el bloqueo y
 * reinicia el contador, dejando intacta la clave actual. No toca `activo`
 * (desbloquear no revierte una baja).
 */
export async function desbloquearUsuario(id: string) {
  if (!(await tienePermiso("usuarios", "editar"))) {
    return { error: "Sin permiso." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: "Falta configurar service_role en el servidor." };

  const { error } = await admin
    .from("perfiles")
    .update({ ...DESBLOQUEO, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/administracion/usuarios");
  return { ok: true };
}

/**
 * Acción 3 — Bloquear manualmente una cuenta (independiente de los intentos
 * fallidos): mientras está bloqueada no puede iniciar sesión ni con la
 * contraseña correcta. Se levanta con resetearContrasena o desbloquearUsuario.
 */
export async function bloquearUsuario(id: string) {
  if (!(await tienePermiso("usuarios", "editar"))) {
    return { error: "Sin permiso." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: "Falta configurar service_role en el servidor." };

  const { error } = await admin
    .from("perfiles")
    .update({
      bloqueado: true,
      motivo_bloqueo: "manual",
      bloqueado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/administracion/usuarios");
  return { ok: true };
}

export async function crearUsuario(formData: FormData) {
  if (!(await tienePermiso("usuarios", "crear"))) {
    return { error: "Sin permiso." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellido = String(formData.get("apellido") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rol_id = Number(formData.get("rol_id"));

  if (!email) return { error: "El correo es obligatorio." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "El correo no tiene un formato válido." };
  if (password.length < 8)
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (!rol_id) return { error: "Elegí un rol." };

  const admin = createAdminClient();
  if (!admin) {
    return {
      error:
        "Falta configurar la clave service_role de Supabase en el servidor. Avisá al equipo de desarrollo.",
    };
  }

  // 1) Crear la cuenta de acceso (Auth). email_confirm evita el paso de
  //    confirmación por correo: la cuenta queda lista para ingresar.
  const { data: creado, error: errAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, apellido, whatsapp },
  });

  if (errAuth) {
    const msg = /already been registered|already exists/i.test(errAuth.message)
      ? "Ya existe una cuenta con ese correo."
      : errAuth.message;
    return { error: msg };
  }

  const nuevoId = creado.user?.id;
  if (!nuevoId) return { error: "No se pudo crear la cuenta." };

  // 2) El trigger creó el perfil con rol por defecto. Ajustamos el rol
  //    elegido (y garantizamos nombre/apellido/whatsapp por si el trigger
  //    corrió antes que los metadatos). Usamos el cliente admin para no
  //    depender de las políticas RLS en este paso.
  const { error: errPerfil } = await admin
    .from("perfiles")
    .update({
      nombre,
      apellido,
      whatsapp,
      rol_id,
      activo: true,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", nuevoId);

  if (errPerfil) {
    return {
      error:
        "La cuenta se creó, pero no se pudo asignar el rol: " + errPerfil.message,
    };
  }

  revalidatePath("/administracion/usuarios");
  return { ok: true };
}
