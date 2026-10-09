"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { alcancePropioDe, tienePermiso } from "@/lib/sesion";
import { filtrarMembresias, type FilaMembresia, type FiltroMembresias, type TipoMembresia, TIPOS_MEMBRESIA } from "@/lib/listaMembresias";
import { leerFichaMembresia, leerFilasMembresias, type AccesoMembresias, type FichaMembresia } from "@/lib/membresiasLectura";
import {
  obtenerMembresiaAlquiler,
  obtenerMembresiaParticular,
  type MembresiaParticularDetalle,
} from "../particulares/acciones";

/**
 * Lista y ficha unificadas de membresías (I-012, fase 0): solo datos, sin
 * pantalla. Cada tipo se ve con el permiso que ya lo protege —`alumnos.ver`
 * para regulares y pruebas, `particulares.ver`, `alquileres.ver`— y con el
 * mismo alcance propio/todo que hoy; el servidor lo valida cada vez, no la
 * interfaz. No cambia ningún dato.
 */

async function accesoActual(): Promise<{ acceso: AccesoMembresias } | { error: string }> {
  const tipos = new Set<TipoMembresia>();
  let profesorIdPropio: number | null = null;

  if (await tienePermiso("alumnos", "ver")) {
    tipos.add("regular");
    tipos.add("prueba");
  }
  if (await tienePermiso("particulares", "ver")) {
    const { propio, profesorId } = await alcancePropioDe("particulares");
    if (!propio) tipos.add("particular");
    else if (profesorId != null) {
      tipos.add("particular");
      profesorIdPropio = profesorId;
    }
  }
  if (await tienePermiso("alquileres", "ver")) {
    // Un alquiler es de gestión de la escuela: con alcance propio no se ve (P17·3).
    const { propio } = await alcancePropioDe("alquileres");
    if (!propio) tipos.add("alquiler");
  }
  if (!tipos.size) return { error: "No tenés permiso para ver membresías." };

  const sb = await createClient();
  const admin = tipos.has("alquiler") ? createAdminClient() : null;
  if (tipos.has("alquiler") && !admin) return { error: "No se pudieron leer los alquileres: falta la clave de servicio." };
  return { acceso: { sb, admin: admin as unknown as AccesoMembresias["admin"], tipos, profesorIdPropio } };
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "Error desconocido.");

/** Los tipos que el rol puede ver: la lista solo ofrece esos filtros. */
export async function tiposVisiblesMembresias(): Promise<TipoMembresia[]> {
  const a = await accesoActual();
  if ("error" in a) return [];
  return TIPOS_MEMBRESIA.filter((t) => a.acceso.tipos.has(t));
}

export async function listarMembresias(
  filtro: FiltroMembresias = {}
): Promise<{ items: FilaMembresia[]; error?: string }> {
  try {
    const a = await accesoActual();
    if ("error" in a) return { items: [], error: a.error };
    const { filas } = await leerFilasMembresias(a.acceso);
    return { items: filtrarMembresias(filas, filtro) };
  } catch (e) {
    return { items: [], error: mensaje(e) };
  }
}

export type FichaMembresiaCompleta = FichaMembresia & {
  /** Reservas, saldo de horas desglosado y lugar externo (particular y alquiler); `null` en un curso. */
  detalle: MembresiaParticularDetalle | null;
};

export async function obtenerMembresia(id: number): Promise<FichaMembresiaCompleta | { error: string }> {
  try {
    const a = await accesoActual();
    if ("error" in a) return a;
    const ficha = await leerFichaMembresia(a.acceso, id);
    if (!ficha) return { error: "Esa membresía no existe o no tenés permiso para verla." };

    let detalle: MembresiaParticularDetalle | null = null;
    if (ficha.fila.tipo === "particular" || ficha.fila.tipo === "alquiler") {
      const d = await (ficha.fila.tipo === "particular" ? obtenerMembresiaParticular(id) : obtenerMembresiaAlquiler(id));
      if ("error" in d && d.error && !("id" in d)) return { error: d.error };
      detalle = d as MembresiaParticularDetalle;
    }
    return { ...ficha, detalle };
  } catch (e) {
    return { error: mensaje(e) };
  }
}
