import { tienePermiso } from "@/lib/sesion";
import Pagina from "@/components/Pagina";

export default async function LayoutAdministracion({
  children,
}: {
  children: React.ReactNode;
}) {
  const [puedeUsuarios, puedeConfig] = await Promise.all([
    tienePermiso("usuarios", "ver"),
    tienePermiso("administracion", "ver"),
  ]);

  if (!puedeUsuarios && !puedeConfig) {
    return (
      <Pagina ancho="2xl">
        <h1 className="text-2xl mb-3">Sin acceso</h1>
        <p className="text-[var(--texto-tenue)] text-lg">
          No tenés permisos para esta sección.
        </p>
      </Pagina>
    );
  }

  return <>{children}</>;
}
