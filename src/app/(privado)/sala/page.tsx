import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import { exigir, exigirUno } from "@/lib/datos";
import { opcionesDuracion } from "@/lib/horarios";
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
  if (!(await tienePermiso("sala", "ver"))) return <SinAcceso />;

  const sb = await createClient();
  const puedeEditar = await tienePermiso("sala", "editar");

  const [salas, catalogoBloqueo] = await Promise.all([
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

  const incrementoMin = Math.max(1, Number(await obtenerParametro("tiempos_incremento_min")) || 30);
  const minimoMin = Math.max(1, Number(await obtenerParametro("duracion_minima_curso_min")) || 30);
  const opcionesDuracionMin = opcionesDuracion(incrementoMin, minimoMin);

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
        opcionesDuracionMin={opcionesDuracionMin}
        puedeEditar={puedeEditar}
      />
    </Pagina>
  );
}
