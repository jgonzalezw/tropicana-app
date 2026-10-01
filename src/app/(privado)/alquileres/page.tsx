import { tienePermiso } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import Pagina from "@/components/Pagina";
import { listarAlquileres } from "./acciones";
import ClienteAlquileres from "./ClienteAlquileres";

export const dynamic = "force-dynamic";

/**
 * C3 — hito H7: los alquileres de sala vendidos, con su saldo de horas, su
 * cobro y sus reservas. Se venden desde Inscribir y cobrar → Alquiler de sala.
 */
export default async function PaginaAlquileres() {
  if (!(await tienePermiso("alquileres", "ver"))) return <SinAcceso />;
  const { items, error } = await listarAlquileres();
  return (
    <Pagina ancho="4xl">
      <EncabezadoPagina
        titulo="Alquileres"
        descripcion="Alquileres de sala vendidos, con su saldo de horas, su cobro y sus reservas."
      />
      {error ? (
        <p className="text-[var(--peligro)]" role="alert">
          {error}
        </p>
      ) : (
        <ClienteAlquileres items={items} />
      )}
    </Pagina>
  );
}
