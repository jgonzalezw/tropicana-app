"use server";

/**
 * Lectura de los alquileres de sala vendidos (C3, hito H7, tanda 2).
 *
 * Un alquiler es una membresía de un plan de alquiler: lleva su categoría
 * (`categoria_aplicada`) y no tiene alumno. Se lee con el cliente admin porque
 * el titular es un contacto y el select de `contactos` exige el permiso de ese
 * módulo; lo que habilita esta lectura es el permiso `alquileres`.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import { nombreCompleto } from "@/lib/contactos";
import { saldoMembresia } from "@/lib/reservas";

export type ReservaAlquiler = {
  id: number;
  fecha: string;
  hora: string;
  duracionMin: number;
  estado: string;
  salaNombre: string;
};

export type FilaAlquiler = {
  id: number;
  titular: string;
  titularWhatsapp: string | null;
  planNombre: string;
  categoria: string;
  categoriaCambiada: boolean;
  categoriaMotivo: string | null;
  categoriaGlosa: string | null;
  personas: number | null;
  ruta: string | null;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  precio: number;
  saldoCobro: number;
  contratadasMin: number;
  consumidasMin: number;
  disponibleMin: number;
  reservas: ReservaAlquiler[];
};

export async function listarAlquileres(): Promise<{ items: FilaAlquiler[]; error?: string }> {
  if (!(await tienePermiso("alquileres", "ver"))) return { items: [], error: "Sin permiso para ver alquileres." };
  const a = createAdminClient();
  if (!a) return { items: [], error: "Falta configurar la clave service_role en el servidor." };

  const { data, error } = await a
    .from("membresias")
    .select(
      "id, fecha_inicio, fecha_fin, estado, precio_aplicado, horas_contratadas, categoria_propuesta, categoria_aplicada, categoria_motivo, categoria_glosa, alquiler_personas, alquiler_ruta, " +
        "titular:contactos(tipo, nombre, apellido, razon_social, whatsapp), plan:planes(nombre), " +
        "reservas:reservas_sala(id, fecha, hora, duracion_min, estado, solicitada_hasta, es_cortesia, sala:salas(nombre)), " +
        "cuotas(id, monto_devengado, descuento_adelanto)"
    )
    .not("categoria_aplicada", "is", null)
    .order("fecha_inicio", { ascending: false });
  if (error) return { items: [], error: `No se pudieron leer los alquileres: ${error.message}` };

  type Fila = {
    id: number;
    fecha_inicio: string;
    fecha_fin: string;
    estado: string;
    precio_aplicado: number;
    horas_contratadas: number;
    categoria_propuesta: string | null;
    categoria_aplicada: string;
    categoria_motivo: string | null;
    categoria_glosa: string | null;
    alquiler_personas: number | null;
    alquiler_ruta: string | null;
    titular: { tipo: "persona" | "organizacion"; nombre: string | null; apellido: string | null; razon_social: string | null; whatsapp: string | null } | null;
    plan: { nombre: string } | null;
    reservas: { id: number; fecha: string; hora: string; duracion_min: number; estado: string; solicitada_hasta: string | null; es_cortesia: boolean; sala: { nombre: string } | null }[];
    cuotas: { id: number; monto_devengado: number; descuento_adelanto: number }[];
  };
  const filas = (data as unknown as Fila[]) ?? [];

  const cuotaIds = filas.flatMap((f) => f.cuotas.map((c) => c.id));
  const cubierto = new Map<number, number>();
  if (cuotaIds.length) {
    const { data: pagos, error: errPagos } = await a
      .from("pagos")
      .select("cuota_id, monto, descuento")
      .eq("tipo", "cobro")
      .in("cuota_id", cuotaIds);
    if (errPagos) return { items: [], error: `No se pudieron leer los cobros: ${errPagos.message}` };
    for (const p of (pagos as { cuota_id: number | null; monto: number; descuento: number }[]) ?? [])
      if (p.cuota_id != null) cubierto.set(p.cuota_id, (cubierto.get(p.cuota_id) ?? 0) + Number(p.monto) + Number(p.descuento));
  }

  const ahora = new Date();
  const items = filas.map<FilaAlquiler>((f) => {
    const saldo = saldoMembresia({ horasContratadas: Number(f.horas_contratadas) || 0, reservas: f.reservas, ahora });
    const saldoCobro = f.cuotas.reduce(
      (t, c) =>
        t + Math.max(0, Number(c.monto_devengado) - Number(c.descuento_adelanto) - (cubierto.get(c.id) ?? 0)),
      0
    );
    return {
      id: f.id,
      titular: nombreCompleto(f.titular ? { tipo: f.titular.tipo, nombre: f.titular.nombre, apellido: f.titular.apellido, razon_social: f.titular.razon_social } : null),
      titularWhatsapp: f.titular?.whatsapp ?? null,
      planNombre: f.plan?.nombre ?? "—",
      categoria: f.categoria_aplicada,
      categoriaCambiada: !!f.categoria_propuesta && f.categoria_propuesta !== f.categoria_aplicada,
      categoriaMotivo: f.categoria_motivo,
      categoriaGlosa: f.categoria_glosa,
      personas: f.alquiler_personas,
      ruta: f.alquiler_ruta,
      fechaInicio: f.fecha_inicio,
      fechaFin: f.fecha_fin,
      estado: f.estado,
      precio: Number(f.precio_aplicado),
      saldoCobro,
      contratadasMin: saldo.contratadasMin,
      consumidasMin: saldo.consumidasMin,
      disponibleMin: saldo.disponibleMin,
      reservas: [...f.reservas]
        .sort((x, y) => (x.fecha + x.hora < y.fecha + y.hora ? -1 : 1))
        .map((r) => ({ id: r.id, fecha: r.fecha, hora: r.hora, duracionMin: r.duracion_min, estado: r.estado, salaNombre: r.sala?.nombre ?? "—" })),
    };
  });
  return { items };
}
