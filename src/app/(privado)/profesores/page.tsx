import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClienteProfesores from "./ClienteProfesores";
import type { Profesor, Curso, Asignacion, DepsProfesor } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaProfesores() {
  if (!(await tienePermiso("profesores", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [
    { data: profesores },
    { data: cursos },
    { data: asignaciones },
    { data: perfiles },
    especialidadesParam,
  ] = await Promise.all([
    supabase.from("profesores").select("*").order("apellido").order("nombre"),
    supabase.from("cursos").select("*").eq("activo", true).order("nombre"),
    supabase.from("asignaciones").select("*"),
    supabase.from("perfiles").select("id, nombre, apellido, email"),
    obtenerParametro("especialidades"),
  ]);

  const padron = (profesores as Profesor[]) ?? [];
  const listaAsignaciones = (asignaciones as Asignacion[]) ?? [];

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

  const especialidades = (especialidadesParam ?? "Salsa,Bachata,Zumba,Urbano,Heels")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

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
        especialidades={especialidades}
        deps={deps}
      />
    </div>
  );
}
