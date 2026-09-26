import { notFound } from "next/navigation";
import { tienePermiso } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import SinAcceso from "@/components/SinAcceso";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import Pagina from "@/components/Pagina";
import { obtenerMembresiaParticular } from "../acciones";
import ClienteMembresiaParticular from "./ClienteMembresiaParticular";

export const dynamic = "force-dynamic";

/**
 * "Reservas de la membresía" (C3, hito H3) — reemplaza al viejo "Confirmar
 * sesión" del handoff: acá se solicita, confirma, reprograma, suspende y se
 * marca ausente/realizada, con los 7 estados de la regla de negocio 23.
 */
export default async function PaginaMembresiaParticular({ params }: { params: Promise<{ id: string }> }) {
  if (!(await tienePermiso("particulares", "ver"))) return <SinAcceso />;

  const { id } = await params;
  const membresiaId = Number(id);
  if (!Number.isFinite(membresiaId)) notFound();

  const detalle = await obtenerMembresiaParticular(membresiaId);
  if ("error" in detalle) {
    return (
      <Pagina ancho="4xl">
        <EncabezadoPagina titulo="Reservas de la membresía" />
        <p className="text-[var(--peligro)]" role="alert">
          {detalle.error}
        </p>
      </Pagina>
    );
  }

  const [puedeCrear, puedeEditar, sb] = await Promise.all([
    tienePermiso("particulares", "crear"),
    tienePermiso("particulares", "editar"),
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
  const salas = ((salasR.data as { id: number; nombre: string; activa: boolean; es_externa: boolean }[]) ?? []).filter(
    (s) => !s.es_externa
  );
  const tieneExterna = ((salasR.data as { es_externa: boolean }[]) ?? []).some((s) => s.es_externa);

  return (
    <Pagina ancho="4xl" className="pb-24">
      <EncabezadoPagina
        titulo={detalle.alumnoNombre || `Membresía #${detalle.id}`}
        descripcion={`${detalle.planNombre} · con ${detalle.profesorNombre || "—"} · vigente ${detalle.fechaInicio} a ${detalle.fechaFin}`}
      />
      <ClienteMembresiaParticular
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
