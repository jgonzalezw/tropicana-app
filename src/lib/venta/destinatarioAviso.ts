/**
 * A quién le llega el aviso de una venta (regla de proceso 12): al titular, o a
 * su tutor si es un menor. Una sola función para toda venta de cursos.
 * Solo se usa del lado servidor, con un cliente que pueda leer `contactos`.
 */

type Lector = {
  from: (tabla: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/** `contactoId` = el contacto que de verdad recibe (el tutor si es menor): lo usa el registro de avisos (R20 E4b). */
export type DestinatarioAviso = { nombre: string; whatsapp: string | null; contactoId: number };

export async function destinatarioAviso(
  a: Lector,
  titular: { contactoId: number; esMenor: boolean; nombre: string; whatsapp: string | null }
): Promise<DestinatarioAviso> {
  const propio = { nombre: titular.nombre, whatsapp: titular.whatsapp, contactoId: titular.contactoId };
  if (!titular.esMenor) return propio;
  const { data } = await a
    .from("contacto_relaciones")
    .select("tutor:contactos!contacto_relaciones_desde_id_fkey(id, nombre, apellido, whatsapp)")
    .eq("tipo", "tutor_de")
    .eq("hacia_id", titular.contactoId)
    .limit(1)
    .maybeSingle();
  const tutor = (data as { tutor: { id: number; nombre: string | null; apellido: string | null; whatsapp: string | null } | null } | null)?.tutor;
  if (!tutor) return propio;
  const nombreTutor = `${tutor.nombre ?? ""} ${tutor.apellido ?? ""}`.trim();
  // "Natalia Salek (tutor de Bruna Marquez)": el aviso dice a quién se le habla y por quién.
  return { nombre: nombreTutor ? `${nombreTutor} (tutor de ${titular.nombre})` : propio.nombre, whatsapp: tutor.whatsapp, contactoId: tutor.id };
}
