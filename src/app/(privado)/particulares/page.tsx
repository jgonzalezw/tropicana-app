import { tienePermiso } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import Pagina from "@/components/Pagina";
import { listarMembresiasParticulares } from "./acciones";
import ClienteParticulares from "./ClienteParticulares";

export const dynamic = "force-dynamic";

/**
 * C3 — hito H3: lista de membresías de particulares activas, con su saldo de
 * horas. Cada fila abre "Reservas de la membresía" (`/particulares/[id]`),
 * donde vive todo lo de los 7 estados (solicitar, confirmar, reprogramar,
 * suspender, cancelar).
 */
export default async function PaginaParticulares() {
  if (!(await tienePermiso("particulares", "ver"))) return <SinAcceso />;

  const { items, error } = await listarMembresiasParticulares();

  return (
    <Pagina ancho="4xl">
      <EncabezadoPagina
        titulo="Particulares"
        descripcion="Membresías de clases particulares activas, con su saldo de horas y sus Solicitadas por vencer."
      />
      {error ? (
        <p className="text-[var(--peligro)]" role="alert">
          {error}
        </p>
      ) : (
        <ClienteParticulares items={items} />
      )}
    </Pagina>
  );
}
