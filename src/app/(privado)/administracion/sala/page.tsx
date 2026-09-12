import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import { exigir, exigirUno } from "@/lib/datos";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClienteSalaHorario from "./ClienteSalaHorario";

export const dynamic = "force-dynamic";

/**
 * Salas y horarios — el horario base (C1) y el alta de salas (0037).
 *
 * Se leen **todas** las salas con su horario completo: son pocas filas y así el
 * cambio de sala en la pantalla es inmediato, sin una vuelta al servidor.
 *
 * Todo lo que se lee es necesario para que la pantalla haga su trabajo, así que
 * va con `exigir()`: un fallo de lectura se muestra, nunca se convierte en "no
 * hay horario cargado" — que acá significaría lo contrario y mandaría a cargar
 * de nuevo algo que ya estaba (regla de calidad 1).
 */
export default async function PaginaSalaHorario() {
  if (!(await tienePermiso("administracion", "ver"))) return <SinAcceso />;

  const sb = await createClient();

  const [salas, patron, excepciones, catalogo] = await Promise.all([
    sb
      .from("salas")
      .select("id, nombre, orden, activa")
      .order("orden")
      .order("id")
      .then((r) => exigir(r, "las salas")),
    sb
      .from("sala_horario_patron")
      .select("id, sala_id, dia_semana, desde, hasta")
      .order("dia_semana")
      .order("desde")
      .then((r) => exigir(r, "el horario de las salas")),
    sb
      .from("sala_horario_excepciones")
      .select("id, sala_id, fecha, hasta_fecha, cerrado, desde, hasta, motivo, glosa")
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
        titulo="Salas y horarios"
        descripcion="Cuándo abre cada sala. Es el lienzo del que depende todo lo demás: fuera de este horario no se puede reservar ni vender una hora."
      />
      <ClienteSalaHorario
        salas={salas as { id: number; nombre: string; orden: number; activa: boolean }[]}
        patron={
          patron as {
            id: number;
            sala_id: number;
            dia_semana: number;
            desde: string;
            hasta: string;
          }[]
        }
        excepciones={
          excepciones as {
            id: number;
            sala_id: number;
            fecha: string;
            hasta_fecha: string;
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
