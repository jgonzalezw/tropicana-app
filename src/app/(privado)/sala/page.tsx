import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import { exigir, exigirUno } from "@/lib/datos";
import { opcionesDuracionReserva } from "@/lib/horarios";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClientePanelSala from "./ClientePanelSala";
import Pagina from "@/components/Pagina";

export const dynamic = "force-dynamic";

/**
 * Disponibilidad de sala (C2) — pantalla operativa, no administrativa.
 *
 * Javier, 2026-09-17: "no me resulta útil que esta pantalla deba ser
 * accesible solo desde el contexto de administración... ver las actividades
 * y disponibilidad de las salas, tomar asistencia, bloquear, y después
 * reservar, es totalmente cotidiano." Por eso vive en su propia ruta,
 * separada de Administración → Sala y horarios (que sigue siendo el lugar
 * del horario base: patrón semanal + excepciones, algo que se toca poco).
 *
 * Muestra todas las salas activas a la vez — no se elige una por vez, porque
 * lo que se necesita a diario es la foto completa.
 */
export default async function PaginaSala() {
  if (!(await tienePermiso("disponibilidad_sala", "ver"))) return <SinAcceso />;

  const sb = await createClient();
  const puedeEditar = await tienePermiso("disponibilidad_sala", "editar");

  const [salas, catalogoBloqueo, catalogoSuspension, incrementoParam, minimoParam] = await Promise.all([
    sb
      .from("salas")
      .select("id, nombre, orden, activa")
      .eq("activa", true)
      .eq("es_externa", false)
      .order("orden")
      .order("id")
      .then((r) => exigir(r, "las salas")),
    sb
      .from("catalogos")
      .select("id")
      .eq("clave", "motivo_bloqueo_sala")
      .maybeSingle()
      .then((r) => exigirUno(r, "el catálogo de motivos de bloqueo")),
    // H4: para el panel de gestión de una reserva abierto desde acá
    // (`GestionReserva`), que necesita los mismos motivos de suspensión y el
    // mismo incremento/mínimo que ya usa `/particulares/[id]`.
    sb.from("catalogos").select("id").eq("clave", "motivo_suspension_reserva").maybeSingle(),
    obtenerParametro("tiempos_incremento_min"),
    obtenerParametro("duracion_minima_curso_min"),
  ]);

  const motivosBloqueo = catalogoBloqueo
    ? (exigir(
        await sb
          .from("catalogo_valores")
          .select("valor, etiqueta")
          .eq("catalogo_id", (catalogoBloqueo as { id: number }).id)
          .eq("activo", true)
          .order("orden"),
        "los motivos de bloqueo"
      ) as { valor: string; etiqueta: string }[])
    : [];

  const catSus = catalogoSuspension.data as { id: number } | null;
  const motivosSuspension = catSus
    ? ((
        await sb.from("catalogo_valores").select("valor, etiqueta").eq("catalogo_id", catSus.id).eq("activo", true).order("orden")
      ).data as { valor: string; etiqueta: string }[] | null) ?? []
    : [];

  const incrementoMin = Math.max(1, Number(incrementoParam) || 30);
  const minimoMin = Math.max(1, Number(minimoParam) || 30);
  const opcionesDuracionMin = opcionesDuracionReserva(minimoMin);

  return (
    <Pagina ancho="6xl">
      <EncabezadoPagina
        titulo="Disponibilidad de sala"
        descripcion="Qué ocupa cada sala hoy y qué queda libre. El horario base (feriados, franjas semanales) se edita en Administración → Sala y horarios."
      />
      <ClientePanelSala
        salas={(salas as { id: number; nombre: string; orden: number; activa: boolean }[]).map((s) => ({
          id: s.id,
          nombre: s.nombre,
        }))}
        motivos={motivosBloqueo}
        motivosSuspension={motivosSuspension}
        opcionesDuracionMin={opcionesDuracionMin}
        incrementoMin={incrementoMin}
        minimoMin={minimoMin}
        puedeEditar={puedeEditar}
      />
    </Pagina>
  );
}
