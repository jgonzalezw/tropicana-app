import { tienePermiso } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { avisosDe, historialDe, indicadoresDe, lineasDePagos } from "@/lib/fichaMembresia";
import { obtenerMembresia } from "../../acciones";
import FichaMembresiaVista from "./FichaMembresiaVista";
import type { DatosReservas } from "./PestanasFicha";

export const dynamic = "force-dynamic";

// El mismo texto para una membresía que no existe y para una que el rol no ve:
// no se revela cuál de las dos es (`obtenerMembresia`).
const NO_EXISTE = "Esa membresía no existe o no tenés permiso para verla.";

export default async function PaginaFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresiaId = Number(id);
  const ficha = Number.isInteger(membresiaId) && membresiaId > 0 ? await obtenerMembresia(membresiaId) : { error: NO_EXISTE };
  if ("error" in ficha)
    return (
      <p className="n-error" role="alert" data-testid="ficha-error">
        {ficha.error}
      </p>
    );

  const ahora = new Date();
  const detalle = ficha.detalle;

  // Lo que `GestionReserva` necesita para mostrar (sin editar) cada reserva.
  let reservas: DatosReservas | null = null;
  if (detalle && (ficha.fila.tipo === "particular" || ficha.fila.tipo === "alquiler")) {
    const sb = await createClient();
    const [salasR, catalogoR, incR, minR] = await Promise.all([
      sb.from("salas").select("id, nombre, activa, es_externa").eq("activa", true).order("orden"),
      sb.from("catalogos").select("id").eq("clave", "motivo_suspension_reserva").maybeSingle(),
      sb.from("parametros").select("valor").eq("clave", "tiempos_incremento_min").maybeSingle(),
      sb.from("parametros").select("valor").eq("clave", "duracion_minima_curso_min").maybeSingle(),
    ]);
    if (salasR.error) throw new Error(`No se pudieron leer las salas: ${salasR.error.message}`);
    const catalogo = catalogoR.data as { id: number } | null;
    const motivos = catalogo
      ? await sb.from("catalogo_valores").select("valor, etiqueta").eq("catalogo_id", catalogo.id).eq("activo", true).order("orden")
      : null;
    if (motivos?.error) throw new Error(`No se pudieron leer los motivos: ${motivos.error.message}`);
    const externa = detalle.salasDeLaMembresia.find((s) => s.esExterna);
    reservas = {
      membresiaId,
      tipo: detalle.tipo,
      disponibleMin: detalle.saldo.disponibleMin,
      fechaInicio: detalle.fechaInicio,
      fechaFin: detalle.fechaFin,
      salasPropias: ((salasR.data as { id: number; nombre: string; es_externa: boolean }[]) ?? [])
        .filter((s) => !s.es_externa)
        .map((s) => ({ id: s.id, nombre: s.nombre })),
      salaExterna: externa ? { salaId: externa.salaId, nombre: externa.nombre } : null,
      motivosSuspension: (motivos?.data as { valor: string; etiqueta: string }[] | null) ?? [],
      incrementoMin: Math.max(1, Number((incR.data as { valor: string } | null)?.valor) || 30),
      minimoMin: Math.max(1, Number((minR.data as { valor: string } | null)?.valor) || 30),
      reservas: detalle.reservas,
    };
  }

  return (
    <FichaMembresiaVista
      ficha={ficha}
      indicadores={indicadoresDe(ficha)}
      avisos={avisosDe(ficha, detalle?.reservas ?? null, ahora)}
      historial={historialDe(ficha, detalle?.reservas ?? null)}
      pagos={lineasDePagos(ficha)}
      reservas={reservas}
      puedeVerRecibo={await tienePermiso("caja", "ver")}
    />
  );
}
