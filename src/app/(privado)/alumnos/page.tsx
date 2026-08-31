import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClienteAlumnos from "./ClienteAlumnos";
import type { Alumno } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaAlumnos() {
  if (!(await tienePermiso("alumnos", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [{ data: alumnos }, { data: cat }] = await Promise.all([
    supabase.from("alumnos").select("*").order("apellido").order("nombre"),
    supabase.from("catalogos").select("id").eq("clave", "canal_captacion").maybeSingle(),
  ]);

  let canales: { valor: string; etiqueta: string }[] = [];
  if (cat?.id) {
    const { data: valores } = await supabase
      .from("catalogo_valores")
      .select("valor, etiqueta")
      .eq("catalogo_id", cat.id)
      .eq("activo", true)
      .order("orden");
    canales = (valores as { valor: string; etiqueta: string }[]) ?? [];
  }

  return (
    <div className="p-8 max-w-6xl">
      <EncabezadoPagina
        titulo="Alumnos"
        descripcion="Padrón de alumnos. El WhatsApp identifica al adulto; para un menor, el WhatsApp del tutor más su nombre."
      />
      <ClienteAlumnos alumnos={(alumnos as Alumno[]) ?? []} canales={canales} deps={{}} />
    </div>
  );
}
