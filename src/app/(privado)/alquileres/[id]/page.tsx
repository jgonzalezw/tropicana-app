import Link from "next/link";
import { notFound } from "next/navigation";
import { tienePermiso } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import SinAcceso from "@/components/SinAcceso";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import Pagina from "@/components/Pagina";
import ReservasDeMembresia from "@/components/ReservasDeMembresia";
import { obtenerMembresiaAlquiler } from "../../particulares/acciones";

export const dynamic = "force-dynamic";

/** "25/09/2026" */
function fecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Reservas de un alquiler (C3, Hito B): el mismo componente que
 * `/particulares/[id]` — solicitar, confirmar, reprogramar, cancelar a pedido,
 * suspender y marcar Ausente/Realizada, con los 7 estados de la regla 23.
 */
export default async function PaginaAlquiler({ params }: { params: Promise<{ id: string }> }) {
  if (!(await tienePermiso("alquileres", "ver"))) return <SinAcceso />;

  const { id } = await params;
  const membresiaId = Number(id);
  if (!Number.isFinite(membresiaId)) notFound();

  const detalle = await obtenerMembresiaAlquiler(membresiaId);
  const volver = (
    <div className="mb-4">
      <Link href="/alquileres" className="text-[var(--primario)] text-base">
        ← Volver a Alquileres
      </Link>
    </div>
  );
  if ("error" in detalle) {
    return (
      <Pagina ancho="4xl">
        {volver}
        <EncabezadoPagina titulo="Reservas del alquiler" />
        <p className="text-[var(--peligro)]" role="alert">
          {detalle.error}
        </p>
      </Pagina>
    );
  }

  const [puedeCrear, puedeEditar, sb] = await Promise.all([
    tienePermiso("alquileres", "crear"),
    tienePermiso("alquileres", "editar"),
    createClient(),
  ]);

  const [salasR, catalogoR, incR, minR] = await Promise.all([
    sb.from("salas").select("id, nombre, activa, es_externa").eq("activa", true).order("orden"),
    sb.from("catalogos").select("id").eq("clave", "motivo_suspension_reserva").maybeSingle(),
    sb.from("parametros").select("valor").eq("clave", "tiempos_incremento_min").maybeSingle(),
    sb.from("parametros").select("valor").eq("clave", "duracion_minima_curso_min").maybeSingle(),
  ]);
  const catalogo = catalogoR.data as { id: number } | null;
  const motivosSuspension = catalogo
    ? ((
        await sb.from("catalogo_valores").select("valor, etiqueta").eq("catalogo_id", catalogo.id).eq("activo", true).order("orden")
      ).data as { valor: string; etiqueta: string }[] | null) ?? []
    : [];
  const incrementoMin = Math.max(1, Number((incR.data as { valor: string } | null)?.valor) || 30);
  const minimoMin = Math.max(1, Number((minR.data as { valor: string } | null)?.valor) || 30);
  const salas = ((salasR.data as { id: number; nombre: string; activa: boolean; es_externa: boolean }[]) ?? []).filter((s) => !s.es_externa);
  const hayExternaActiva = ((salasR.data as { es_externa: boolean }[]) ?? []).some((s) => s.es_externa);
  const tieneExterna = detalle.permiteSalaExterna && hayExternaActiva;

  return (
    <Pagina ancho="4xl" className="pb-24">
      {volver}
      <EncabezadoPagina
        titulo={detalle.alumnoNombre || `Alquiler #${detalle.id}`}
        descripcion={`${detalle.planNombre} · vigente ${fecha(detalle.fechaInicio)} a ${fecha(detalle.fechaFin)}`}
      />
      <ReservasDeMembresia
        detalle={detalle}
        salas={salas}
        tieneExterna={tieneExterna}
        motivosSuspension={motivosSuspension}
        incrementoMin={incrementoMin}
        minimoMin={minimoMin}
        puedeCrear={puedeCrear}
        puedeEditar={puedeEditar}
      />
    </Pagina>
  );
}
