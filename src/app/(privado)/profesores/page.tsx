import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClienteProfesores from "./ClienteProfesores";
import type { Profesor, Curso, Asignacion, DepsProfesor, Estilo } from "@/lib/tipos";
import { cargarListasContacto } from "@/app/(privado)/contactos/acciones";

export const dynamic = "force-dynamic";

export default async function PaginaProfesores() {
  if (!(await tienePermiso("profesores", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [
    { data: profesoresRaw },
    { data: cursos },
    { data: asignaciones },
    { data: perfiles },
    { data: estilosRaw },
    { data: profEstilos },
    contactoListas,
  ] = await Promise.all([
    supabase.from("profesores").select("*, contacto:contactos(*)"),
    supabase.from("cursos").select("*").eq("activo", true).order("nombre"),
    supabase.from("asignaciones").select("*"),
    supabase.from("perfiles").select("id, nombre, apellido, email"),
    supabase.from("estilos").select("*").eq("activo", true).order("orden"),
    supabase.from("profesor_estilos").select("profesor_id, estilo"),
    cargarListasContacto(),
  ]);

  const padron = (profesoresRaw as Profesor[]) ?? [];
  const listaAsignaciones = (asignaciones as Asignacion[]) ?? [];
  const estilos = (estilosRaw as Estilo[]) ?? [];

  const estilosPorProfesor: Record<number, string[]> = {};
  for (const r of (profEstilos as { profesor_id: number; estilo: string }[]) ?? []) {
    (estilosPorProfesor[r.profesor_id] ??= []).push(r.estilo);
  }
  for (const p of padron) p.estilos = estilosPorProfesor[p.id] ?? [];

  // Dependencias por profesor (por ahora solo asignaciones; comisiones/
  // liquidaciones/sala llegan en 0007).
  const deps: Record<number, DepsProfesor> = {};
  for (const p of padron) deps[p.id] = { asignaciones: 0, comisiones: 0, liquidaciones: 0, sala: 0 };
  for (const a of listaAsignaciones) {
    if (deps[a.profesor_id]) deps[a.profesor_id].asignaciones += 1;
  }

  const cuentas = ((perfiles as { id: string; nombre: string | null; apellido: string | null; email: string | null }[]) ?? []).map(
    (u) => ({
      id: u.id,
      etiqueta: `${[u.apellido, u.nombre].filter(Boolean).join(", ") || "—"}${u.email ? ` · ${u.email}` : ""}`,
    })
  );

  return (
    <div className="p-8 max-w-6xl">
      <EncabezadoPagina
        titulo="Profesores y cursos"
        descripcion="El padrón de profesores y los porcentajes que gana cada uno por curso."
      />
      <ClienteProfesores
        padron={padron}
        cursos={(cursos as Curso[]) ?? []}
        asignaciones={listaAsignaciones}
        cuentas={cuentas}
        estilos={estilos}
        deps={deps}
        matriz={contactoListas.matriz}
        listasContacto={contactoListas.listas}
        puedeVerPrivados={contactoListas.puedeVerPrivados}
      />
    </div>
  );
}
