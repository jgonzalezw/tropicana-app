"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { alcancePropioDe, tienePermiso } from "@/lib/sesion";
import { filtrarMembresias, tipoDeMembresia, type FilaMembresia, type FiltroMembresias, type TipoMembresia, TIPOS_MEMBRESIA } from "@/lib/listaMembresias";
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

  // Los permisos y los alcances no dependen uno del otro: se piden juntos.
  const [verAlumnos, verParticulares, verAlquileres] = await Promise.all([
    tienePermiso("alumnos", "ver"),
    tienePermiso("particulares", "ver"),
    tienePermiso("alquileres", "ver"),
  ]);
  const [alcanceAlumnos, alcanceParticulares, alcanceAlquileres] = await Promise.all([
    verAlumnos ? alcancePropioDe("contactos") : null,
    verParticulares ? alcancePropioDe("particulares") : null,
    verAlquileres ? alcancePropioDe("alquileres") : null,
  ]);

  // Con contactos en alcance propio (es lo que oculta el nombre del titular; «alumnos» no tiene selector de visibilidad), el profesor ve las regulares y pruebas de los cursos que dicta (o dictó):
  // las demás no entran, así nunca aparece una fila sin titular. Sin profesor vinculado no ve ninguna.
  let cursosPropios: Set<number> | null = null;
  if (alcanceAlumnos) {
    if (!alcanceAlumnos.propio) {
      tipos.add("regular");
      tipos.add("prueba");
    } else if (alcanceAlumnos.profesorId != null) {
      tipos.add("regular");
      tipos.add("prueba");
      const supabase = await createClient();
      const r = await supabase.from("asignaciones").select("curso_id").eq("profesor_id", alcanceAlumnos.profesorId);
      if (r.error) return { error: `No se pudieron leer los cursos del profesor: ${r.error.message}` };
      cursosPropios = new Set((r.data as { curso_id: number }[]).map((x) => x.curso_id));
    }
  }
  if (alcanceParticulares) {
    if (!alcanceParticulares.propio) tipos.add("particular");
    else if (alcanceParticulares.profesorId != null) {
      tipos.add("particular");
      profesorIdPropio = alcanceParticulares.profesorId;
    }
  }
  // Un alquiler es de gestión de la escuela: con alcance propio no se ve (P17·3).
  if (alcanceAlquileres && !alcanceAlquileres.propio) tipos.add("alquiler");
  if (!tipos.size) return { error: "No tenés permiso para ver membresías." };

  const sb = await createClient();
  const admin = tipos.has("alquiler") ? createAdminClient() : null;
  if (tipos.has("alquiler") && !admin) return { error: "No se pudieron leer los alquileres: falta la clave de servicio." };
  return { acceso: { sb, admin: admin as unknown as AccesoMembresias["admin"], tipos, profesorIdPropio, cursosPropios } };
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

/**
 * El tipo de una membresía con una sola consulta liviana, para pedir su detalle
 * (reservas, saldo de horas) a la vez que la ficha y no después. Solo adelanta
 * la lectura: quién puede ver la ficha lo sigue decidiendo `leerFichaMembresia`.
 */
async function tipoDeLaMembresia(id: number): Promise<TipoMembresia | null> {
  const sb = await createClient();
  const { data, error } = await sb.from("membresias").select("es_prueba, curso_id, categoria_aplicada").eq("id", id).maybeSingle();
  if (error) throw new Error(`No se pudo leer la membresía: ${error.message}`);
  if (!data) return null;
  const r = data as { es_prueba: boolean; curso_id: number | null; categoria_aplicada: string | null };
  return tipoDeMembresia({ esPrueba: r.es_prueba, cursoId: r.curso_id, categoriaAplicada: r.categoria_aplicada });
}

export async function obtenerMembresia(id: number): Promise<FichaMembresiaCompleta | { error: string }> {
  try {
    const [a, tipo] = await Promise.all([accesoActual(), tipoDeLaMembresia(id)]);
    if ("error" in a) return a;
    if (!tipo) return { error: "Esa membresía no existe o no tenés permiso para verla." };

    const [ficha, d] = await Promise.all([
      leerFichaMembresia(a.acceso, id),
      tipo === "particular" ? obtenerMembresiaParticular(id) : tipo === "alquiler" ? obtenerMembresiaAlquiler(id) : null,
    ]);
    if (!ficha) return { error: "Esa membresía no existe o no tenés permiso para verla." };

    let detalle: MembresiaParticularDetalle | null = null;
    if (d) {
      if ("error" in d && d.error && !("id" in d)) return { error: d.error };
      detalle = d as MembresiaParticularDetalle;
    }
    return { ...ficha, detalle };
  } catch (e) {
    return { error: mensaje(e) };
  }
}
