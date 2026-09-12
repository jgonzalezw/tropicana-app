import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import { exigir, exigirUno } from "@/lib/datos";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClienteSalaHorario from "./ClienteSalaHorario";

export const dynamic = "force-dynamic";

/**
 * Sala y horarios — el horario base (C1).
 *
 * Todo lo que se lee es necesario para que la pantalla haga su trabajo, así que
 * va con `exigir()`: un fallo de lectura se muestra, nunca se convierte en "no
 * hay horario cargado" — que acá significaría exactamente lo contrario y
 * mandaría a cargar de nuevo algo que ya estaba (regla de calidad 1).
 */
export default async function PaginaSalaHorario() {
  if (!(await tienePermiso("administracion", "ver"))) return <SinAcceso />;

  const sb = await createClient();

  // D20: el modelo soporta varias salas; mientras haya una sola se opera esa y
  // no se muestra selector — elegir entre una opción es ruido.
  const sala = exigirUno(
    await sb.from("salas").select("id, nombre").order("id").limit(1).maybeSingle(),
    "la sala"
  ) as { id: number; nombre: string } | null;

  if (!sala) {
    return (
      <div className="p-8 max-w-4xl">
        <EncabezadoPagina
          titulo="Sala y horarios"
          descripcion="Cuándo abre la sala. Es el lienzo: fuera de este horario no se puede reservar."
        />
        <p className="text-base text-[var(--texto-tenue)]">
          No hay ninguna sala cargada, así que no hay horario que definir. La sala se crea
          con la migración del módulo; si llegaste acá y no existe, avisá — es un problema
          de instalación, no algo que se cargue desde esta pantalla.
        </p>
      </div>
    );
  }

  const [patron, excepciones, catalogo] = await Promise.all([
    sb
      .from("sala_horario_patron")
      .select("id, dia_semana, desde, hasta")
      .eq("sala_id", sala.id)
      .order("dia_semana")
      .order("desde")
      .then((r) => exigir(r, "el horario de la sala")),
    sb
      .from("sala_horario_excepciones")
      .select("id, fecha, cerrado, desde, hasta, motivo, glosa")
      .eq("sala_id", sala.id)
      .order("fecha")
      .then((r) => exigir(r, "las excepciones del horario")),
    sb
      .from("catalogos")
      .select("id")
      .eq("clave", "motivo_excepcion_horario")
      .maybeSingle()
      .then((r) => exigirUno(r, "el catálogo de motivos de excepción")),
  ]);

  const motivos = catalogo
    ? (exigir(
        await sb
          .from("catalogo_valores")
          .select("valor, etiqueta")
          .eq("catalogo_id", (catalogo as { id: number }).id)
          .eq("activo", true)
          .order("orden"),
        "los motivos de excepción"
      ) as { valor: string; etiqueta: string }[])
    : [];

  return (
    <div className="p-8 max-w-4xl">
      <EncabezadoPagina
        titulo="Sala y horarios"
        descripcion="Cuándo abre la sala. Es el lienzo del que depende todo lo demás: fuera de este horario no se puede reservar ni vender una hora."
      />
      <ClienteSalaHorario
        sala={sala}
        patron={
          patron as { id: number; dia_semana: number; desde: string; hasta: string }[]
        }
        excepciones={
          excepciones as {
            id: number;
            fecha: string;
            cerrado: boolean;
            desde: string | null;
            hasta: string | null;
            motivo: string | null;
            glosa: string | null;
          }[]
        }
        motivos={motivos}
      />
    </div>
  );
}
