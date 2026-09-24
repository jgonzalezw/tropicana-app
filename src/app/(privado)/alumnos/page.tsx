import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClienteAlumnos from "./ClienteAlumnos";
import type { Alumno, Contacto } from "@/lib/tipos";
import { cargarListasContacto } from "@/app/(privado)/contactos/acciones";
import Pagina from "@/components/Pagina";

export const dynamic = "force-dynamic";

export default async function PaginaAlumnos() {
  if (!(await tienePermiso("alumnos", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [{ data: alumnosRaw }, { data: cat }, { data: insc }, { data: pagosAl }, contactoListas, puedeEditar] =
    await Promise.all([
      supabase.from("alumnos").select("*, contacto:contactos(*, privados:contactos_privados(numero))"),
      supabase.from("catalogos").select("id").eq("clave", "canal_captacion").maybeSingle(),
      supabase.from("membresias").select("alumno_id"),
      supabase.from("pagos").select("alumno_id"),
      cargarListasContacto(),
      tienePermiso("alumnos", "editar"),
    ]);

  const alumnos = ((alumnosRaw as Alumno[]) ?? []).slice();

  // El tutor no viaja en el select de arriba (es una relación aparte, no una
  // columna de alumnos): se resuelve en un segundo round trip, batido por
  // los contacto_id de los menores.
  const idsMenores = alumnos.filter((a) => a.es_menor).map((a) => a.contacto_id);
  if (idsMenores.length) {
    const { data: rels } = await supabase
      .from("contacto_relaciones")
      .select("hacia_id, tutor:contactos!contacto_relaciones_desde_id_fkey(*)")
      .eq("tipo", "tutor_de")
      .in("hacia_id", idsMenores);
    const tutorPorHijo = new Map<number, Contacto>();
    for (const r of (rels as unknown as { hacia_id: number; tutor: Contacto }[]) ?? [])
      tutorPorHijo.set(r.hacia_id, r.tutor);
    for (const a of alumnos) a.tutor = tutorPorHijo.get(a.contacto_id) ?? null;
  }

  // Historial dependiente por alumno = inscripciones + pagos. Con historial se
  // desactiva (conservando lo registrado); sin historial se elimina de verdad.
  const deps: Record<number, number> = {};
  for (const r of (insc as { alumno_id: number | null }[]) ?? [])
    if (r.alumno_id != null) deps[r.alumno_id] = (deps[r.alumno_id] ?? 0) + 1;
  for (const r of (pagosAl as { alumno_id: number | null }[]) ?? [])
    if (r.alumno_id != null) deps[r.alumno_id] = (deps[r.alumno_id] ?? 0) + 1;

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
    <Pagina ancho="6xl">
      <EncabezadoPagina
        titulo="Alumnos"
        descripcion="Padrón de alumnos. El WhatsApp identifica al adulto; para un menor, el WhatsApp del tutor más su nombre."
      />
      <ClienteAlumnos
        alumnos={alumnos}
        canales={canales}
        deps={deps}
        matriz={contactoListas.matriz}
        listasContacto={contactoListas.listas}
        puedeVerPrivados={contactoListas.puedeVerPrivados}
        puedeEditar={puedeEditar}
      />
    </Pagina>
  );
}
