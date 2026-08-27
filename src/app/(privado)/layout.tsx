import { redirect } from "next/navigation";
import { obtenerPerfilActual, tienePermiso } from "@/lib/sesion";
import BarraLateral from "@/components/BarraLateral";

export default async function LayoutPrivado({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await obtenerPerfilActual();

  if (!perfil) {
    redirect("/login");
  }

  if (!perfil.activo) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-3">Cuenta inactiva</h1>
          <p className="text-[var(--texto-tenue)] mb-6">
            Tu cuenta está desactivada. Comunicate con la administración.
          </p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="px-5 py-2 rounded-[var(--radio)] border border-[var(--borde)]"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </main>
    );
  }

  const [puedeUsuarios, puedeConfig] = await Promise.all([
    tienePermiso("usuarios", "ver"),
    tienePermiso("administracion", "ver"),
  ]);

  return (
    <div className="flex min-h-screen">
      <BarraLateral
        perfil={perfil}
        puedeUsuarios={puedeUsuarios}
        puedeConfig={puedeConfig}
      />
      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
