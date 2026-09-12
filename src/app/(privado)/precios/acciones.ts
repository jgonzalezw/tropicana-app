"use server";

/**
 * Precios y paquetes — el punto único donde se definen los precios base de
 * todos los servicios de la escuela (D8, activada por Javier el 2026-09-12:
 * *"ese debe ser el centro donde se definen los precios base de todos los
 * servicios"*).
 *
 * **Una sola acción de guardado, porque la pantalla tiene un solo botón.** Es
 * una superficie de configuración, no transaccional: el gerente edita varias
 * celdas de varias tablas y guarda una vez. Partirlo en cinco acciones haría
 * que un guardado a medias dejara la pantalla diciendo una cosa y la base otra.
 *
 * **Lo vacío no es cero.** En todos los bloques, una celda sin valor se guarda
 * como ausencia (se borra la fila de tarifa), nunca como 0. La diferencia es
 * justamente lo que decide si una modalidad cae al mensual o si una sala no se
 * puede liquidar (regla de calidad 1).
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";

type Resultado = { ok?: true; error?: string };

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

/** Un número que puede no estar cargado. Vacío, null o basura → null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type TarifasCursoEdit = {
  cursoId: number;
  clase: number | null;
  semana: number | null;
  medio_mes: number | null;
  prueba: number | null;
};

export type DescuentoEdit = { meses: number; porcentaje: number };

export type PaqueteParticularEdit = {
  /** null = fila nueva. */
  id: number | null;
  nombre: string;
  estilo: string;
  horas: number;
  precio: number;
  activo: boolean;
};

export type SalaEdit = {
  tamanos: { clave: string; max_personas: number }[];
  /** Los paquetes de horas: `id` null = fila nueva. */
  horas: { id: number | null; horas: number }[];
  /** Celdas de la matriz. `precio` null = sin tarifa cargada. */
  precios: { categoria: string; tamano: string; horas: number; precio: number | null }[];
};

export type CambiosPrecios = {
  cursos?: TarifasCursoEdit[];
  descuentos?: DescuentoEdit[];
  paquetes?: PaqueteParticularEdit[];
  paquetesEliminados?: number[];
  sala?: SalaEdit;
  horasEliminadas?: number[];
};

export async function guardarPrecios(c: CambiosPrecios): Promise<Resultado> {
  if (!(await tienePermiso("administracion", "editar")))
    return { error: "Sin permiso para editar precios." };

  const a = admin();

  // ── Bloques A y C — tarifas por curso ──────────────────────────────
  // Una modalidad sin precio no guarda una fila en 0: se borra la fila. Es lo
  // que hace que el curso cobre el mensual completo en vez de cobrar nada.
  for (const t of c.cursos ?? []) {
    const modalidades: [string, number | null][] = [
      ["clase", num(t.clase)],
      ["semana", num(t.semana)],
      ["medio_mes", num(t.medio_mes)],
      ["prueba", num(t.prueba)],
    ];
    for (const [modalidad, precio] of modalidades) {
      if (precio == null) {
        const { error } = await a
          .from("curso_tarifas")
          .delete()
          .eq("curso_id", t.cursoId)
          .eq("modalidad", modalidad);
        if (error) return { error: `No se pudo borrar la tarifa ${modalidad}: ${error.message}` };
      } else {
        const { error } = await a
          .from("curso_tarifas")
          .upsert(
            { curso_id: t.cursoId, modalidad, precio },
            { onConflict: "curso_id,modalidad" }
          );
        if (error) return { error: `No se pudo guardar la tarifa ${modalidad}: ${error.message}` };
      }
    }
  }

  // ── Bloque B — descuento por meses adelantados ─────────────────────
  // El cruce es por cantidad EXACTA de meses y no se interpola (N8), así que
  // la tabla es el conjunto completo: lo que no está, no da descuento.
  if (c.descuentos) {
    const filas = c.descuentos
      .filter((d) => d.meses >= 2 && d.porcentaje >= 0 && d.porcentaje <= 100)
      .map((d) => ({ meses: Math.trunc(d.meses), porcentaje: d.porcentaje }));

    const quedan = filas.map((f) => f.meses);
    const borrar = a.from("descuentos_adelanto").delete();
    const { error: errDel } = quedan.length
      ? await borrar.not("meses", "in", `(${quedan.join(",")})`)
      : await borrar.gte("meses", 0);
    if (errDel) return { error: `No se pudieron limpiar los descuentos: ${errDel.message}` };

    if (filas.length) {
      const { error } = await a
        .from("descuentos_adelanto")
        .upsert(filas, { onConflict: "meses" });
      if (error) return { error: `No se pudieron guardar los descuentos: ${error.message}` };
    }
  }

  // ── Bloque D — paquetes de clases particulares ─────────────────────
  for (const id of c.paquetesEliminados ?? []) {
    // Solo se elimina de verdad la fila sin uso; la vendida se desactiva. El
    // llamador ya lo sabe (se lo dice la pantalla), pero el servidor es el que
    // valida: la lista ayuda, no decide.
    const { count } = await a
      .from("paquetes_particular")
      .select("id", { count: "exact", head: true })
      .eq("tarifa_particular_id", id);
    if ((count ?? 0) > 0) {
      const { error } = await a.from("tarifas_particular").update({ activo: false }).eq("id", id);
      if (error) return { error: `No se pudo desactivar el paquete: ${error.message}` };
    } else {
      const { error } = await a.from("tarifas_particular").delete().eq("id", id);
      if (error) return { error: `No se pudo eliminar el paquete: ${error.message}` };
    }
  }

  for (const p of c.paquetes ?? []) {
    if (!p.nombre.trim()) return { error: "Un paquete de particular necesita nombre." };
    if (!p.estilo.trim()) return { error: `Elegí el estilo de "${p.nombre}".` };
    if (!(p.horas > 0)) return { error: `Las horas de "${p.nombre}" tienen que ser mayores a cero.` };
    const precio = num(p.precio);
    if (precio == null) return { error: `Cargá el precio de "${p.nombre}".` };

    const fila = {
      nombre: p.nombre.trim(),
      estilo: p.estilo.trim(),
      horas: p.horas,
      precio,
      activo: p.activo,
      actualizado_en: new Date().toISOString(),
    };
    const { error } = p.id
      ? await a.from("tarifas_particular").update(fila).eq("id", p.id)
      : await a.from("tarifas_particular").insert(fila);
    if (error) return { error: `No se pudo guardar "${p.nombre}": ${error.message}` };
  }

  // ── Bloque E — alquiler de sala ────────────────────────────────────
  if (c.sala) {
    for (const t of c.sala.tamanos) {
      if (!(t.max_personas > 0))
        return { error: "El máximo de personas de un tamaño tiene que ser mayor a cero." };
      const { error } = await a
        .from("sala_tamanos")
        .update({ max_personas: Math.trunc(t.max_personas) })
        .eq("clave", t.clave);
      if (error) return { error: `No se pudo guardar el tamaño: ${error.message}` };
    }

    for (const id of c.horasEliminadas ?? []) {
      const { error } = await a.from("sala_horas_paquete").delete().eq("id", id);
      if (error) return { error: `No se pudo eliminar el paquete de horas: ${error.message}` };
    }

    // Las filas de horas primero: las celdas de precio cuelgan de ellas.
    for (const h of c.sala.horas) {
      if (!(h.horas > 0)) return { error: "Un paquete de horas tiene que ser mayor a cero." };
      if (h.id) {
        const { error } = await a
          .from("sala_horas_paquete")
          .update({ horas: h.horas })
          .eq("id", h.id);
        if (error) return { error: `No se pudo guardar el paquete de horas: ${error.message}` };
      } else {
        const { error } = await a
          .from("sala_horas_paquete")
          .insert({ horas: h.horas, orden: 0 });
        if (error) return { error: `No se pudo agregar el paquete de horas: ${error.message}` };
      }
    }

    // Releer para resolver los ids de las filas nuevas.
    const { data: horasRows, error: errHoras } = await a
      .from("sala_horas_paquete")
      .select("id, horas");
    if (errHoras) return { error: `No se pudieron leer los paquetes de horas: ${errHoras.message}` };
    const idPorHoras = new Map<number, number>();
    for (const r of (horasRows as { id: number; horas: number }[]) ?? [])
      idPorHoras.set(Number(r.horas), r.id);

    for (const p of c.sala.precios) {
      const horasId = idPorHoras.get(Number(p.horas));
      if (!horasId) continue; // la fila de horas se eliminó en este mismo guardado
      const precio = num(p.precio);
      if (precio == null) {
        // Vacío = sin tarifa. Se borra la celda en vez de guardarla en 0: un
        // cero diría "la sala es gratis" y se liquidaría como tal.
        // `sala_id is null` = la tarifa general, la que vale para todas las
        // salas (0037). Esta pantalla edita esa; una tarifa propia de una sala
        // se cargaría aparte y mandaría sobre la general.
        const { error } = await a
          .from("sala_tarifas")
          .delete()
          .is("sala_id", null)
          .eq("categoria", p.categoria)
          .eq("tamano", p.tamano)
          .eq("horas_paquete_id", horasId);
        if (error) return { error: `No se pudo limpiar una tarifa de sala: ${error.message}` };
      } else {
        const { error } = await a.from("sala_tarifas").upsert(
          {
            sala_id: null,
            categoria: p.categoria,
            tamano: p.tamano,
            horas_paquete_id: horasId,
            precio,
            actualizado_en: new Date().toISOString(),
          },
          { onConflict: "sala_id,categoria,tamano,horas_paquete_id" }
        );
        if (error) return { error: `No se pudo guardar una tarifa de sala: ${error.message}` };
      }
    }
  }

  revalidatePath("/precios");
  return { ok: true };
}
