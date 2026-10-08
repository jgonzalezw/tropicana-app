import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import Pagina from "@/components/Pagina";
import { compararPorApellido } from "@/lib/texto";
import { isoHoy } from "@/lib/liquidacion/periodo";
import ClienteRetiro, { type CursoRetiro, type OpcionSustituto } from "./ClienteRetiro";

export const dynamic = "force-dynamic";

type Persona = { nombre: string | null; apellido: string | null } | null;
const nombreDe = (c: Persona) => [c?.apellido, c?.nombre].filter(Boolean).join(", ") || "—";

/**
 * Retirar a un profesor (I-005, D34): una simulación de lo que pasaría —acciones
 * y liquidación final— que no guarda nada hasta confirmar. Requiere editar
 * profesores y crear liquidaciones (el retiro liquida su cierre).
 */
export default async function PaginaRetiro({ params }: { params: Promise<{ id: string }> }) {
  if (!(await tienePermiso("profesores", "editar")) || !(await tienePermiso("liquidaciones", "crear")))
    return <SinAcceso />;

  const { id } = await params;
  const profesorId = Number(id);
  if (!Number.isInteger(profesorId)) notFound();

  const sb = await createClient();
  const { data: prof } = await sb
    .from("profesores")
    .select("id, activo, contacto:contactos(nombre, apellido)")
    .eq("id", profesorId)
    .maybeSingle();
  if (!prof) notFound();

  const [{ data: asigs }, { data: posibles }] = await Promise.all([
    sb
      .from("asignaciones")
      .select("id, curso_id, desde, curso:cursos(nombre)")
      .eq("profesor_id", profesorId)
      .is("hasta", null),
    sb.from("profesores").select("id, contacto:contactos(nombre, apellido)").eq("activo", true).eq("tipo", "activo").neq("id", profesorId),
  ]);

  const cursos: CursoRetiro[] = (
    (asigs as unknown as { id: number; curso_id: number; desde: string; curso: { nombre: string } | null }[]) ?? []
  )
    .map((a) => ({ asignacionId: a.id, cursoId: a.curso_id, curso: a.curso?.nombre ?? `#${a.curso_id}`, desde: a.desde }))
    .sort((a, b) => a.curso.localeCompare(b.curso, "es"));

  const sustitutos: OpcionSustituto[] = (
    (posibles as unknown as { id: number; contacto: Persona }[]) ?? []
  )
    .sort((a, b) => compararPorApellido(a.contacto ?? {}, b.contacto ?? {}))
    .map((p) => ({ id: p.id, nombre: nombreDe(p.contacto) }));

  const p = prof as unknown as { id: number; activo: boolean; contacto: Persona };
  return (
    <Pagina ancho="5xl">
      <ClienteRetiro
        profesorId={p.id}
        profesor={nombreDe(p.contacto)}
        activo={p.activo}
        hoyISO={isoHoy()}
        cursos={cursos}
        sustitutos={sustitutos}
      />
    </Pagina>
  );
}
