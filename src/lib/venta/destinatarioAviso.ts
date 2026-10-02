/**
 * A quién le llega el aviso de una venta (regla de proceso 12): al titular, o a
 * su tutor si es un menor. Una sola función para toda venta de cursos.
 * Solo se usa del lado servidor, con un cliente que pueda leer `contactos`.
 */

type Lector = {
  from: (tabla: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type DestinatarioAviso = { nombre: string; whatsapp: string | null };

export async function destinatarioAviso(
  a: Lector,
  titular: { contactoId: number; esMenor: boolean; nombre: string; whatsapp: string | null }
): Promise<DestinatarioAviso> {
  const propio = { nombre: titular.nombre, whatsapp: titular.whatsapp };
  if (!titular.esMenor) return propio;
  const { data } = await a
    .from("contacto_relaciones")
    .select("tutor:contactos!contacto_relaciones_desde_id_fkey(nombre, apellido, whatsapp)")
    .eq("tipo", "tutor_de")
    .eq("hacia_id", titular.contactoId)
    .limit(1)
    .maybeSingle();
  const tutor = (data as { tutor: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null } | null)?.tutor;
  if (!tutor) return propio;
  return { nombre: `${tutor.nombre ?? ""} ${tutor.apellido ?? ""}`.trim() || propio.nombre, whatsapp: tutor.whatsapp };
}
