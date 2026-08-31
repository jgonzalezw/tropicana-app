import { redirect } from "next/navigation";
import { obtenerPerfilActual, tienePermiso } from "@/lib/sesion";
import { obtenerTemas, TEMA_DEFECTO } from "@/lib/temas";
import { puedeIniciarSesion } from "@/lib/acceso";
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

  // Defensa en profundidad: si la cuenta quedó bloqueada o dada de baja
  // mientras había sesión abierta, se corta acá (regla única de acceso).
  if (!puedeIniciarSesion(perfil)) {
    const bloqueada = perfil.activo && perfil.bloqueado;
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl mb-3">
            {bloqueada ? "Cuenta bloqueada" : "Cuenta inactiva"}
          </h1>
          <p className="text-[var(--texto-tenue)] mb-6">
            {bloqueada
              ? "Tu cuenta está bloqueada. Comunicate con la administración para que la desbloquee o te reinicie la contraseña."
              : "Tu cuenta está desactivada. Comunicate con la administración."}
          </p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-[var(--radio-control)] border border-[var(--borde)]"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </main>
    );
  }

  const [puedeUsuarios, puedeConfig, puedeAlumnos, puedeProfesores, puedeCursos, temas] =
    await Promise.all([
      tienePermiso("usuarios", "ver"),
      tienePermiso("administracion", "ver"),
      tienePermiso("alumnos", "ver"),
      tienePermiso("profesores", "ver"),
      tienePermiso("cursos", "ver"),
      obtenerTemas(),
    ]);

  return (
    <div className="flex min-h-screen">
      <BarraLateral
        perfil={perfil}
        puedeUsuarios={puedeUsuarios}
        puedeConfig={puedeConfig}
        puedeAlumnos={puedeAlumnos}
        puedeProfesores={puedeProfesores}
        puedeCursos={puedeCursos}
        temas={temas.map((t) => ({ clave: t.clave, nombre: t.nombre }))}
        temaActual={perfil.tema ?? TEMA_DEFECTO}
      />
      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
