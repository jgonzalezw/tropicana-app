"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import { esMultiploDe } from "@/lib/horarios";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

export async function guardarParametro(clave: string, valor: string) {
  // Gobernado por el permiso (no solo el rol administrador): cualquier rol con
  // administracion.editar puede cambiar parámetros. La escritura va por
  // service_role tras el chequeo, igual que el resto de operativos.
  if (!(await tienePermiso("administracion", "editar"))) {
    return { error: "No tenés permiso para editar parámetros." };
  }

  const a = admin();

  // Si el parámetro tiene una lista cerrada de valores (0028), el que decide es
  // el servidor. El desplegable de la pantalla ayuda, pero no alcanza: un valor
  // fuera de la lista no rompe nada visible — cae al default y la aplicación se
  // comporta distinto sin decir por qué.
  const { data: p } = await a
    .from("parametros")
    .select("opciones")
    .eq("clave", clave)
    .maybeSingle();
  const opciones = (p?.opciones as { valor: string; etiqueta: string }[] | null) ?? null;
  if (opciones?.length && !opciones.some((o) => o.valor === valor)) {
    return {
      error: `Valor no admitido. Los válidos son: ${opciones.map((o) => o.valor).join(", ")}.`,
    };
  }

  // Item 3 (Javier, 2026-09-16): la duración mínima de una clase tiene que
  // respetar el mismo incremento que gobierna toda la app — si no, un
  // mínimo de 45 con un incremento de 30 dejaría duraciones válidas que no
  // se pueden ofrecer en la lista de Cursos.
  if (clave === "duracion_minima_curso_min") {
    const min = Number(valor);
    if (!(min > 0)) return { error: "La duración mínima tiene que ser un número mayor a 0." };
    const { data: inc } = await a
      .from("parametros")
      .select("valor")
      .eq("clave", "tiempos_incremento_min")
      .maybeSingle();
    const incremento = Number(inc?.valor) || 30;
    if (!esMultiploDe(min, incremento))
      return { error: `Tiene que ser múltiplo del incremento vigente (${incremento} minutos).` };
  }

  const { error } = await a
    .from("parametros")
    .update({ valor, actualizado_en: new Date().toISOString() })
    .eq("clave", clave);

  if (error) return { error: error.message };

  revalidatePath("/administracion/parametros");
  return { ok: true };
}
