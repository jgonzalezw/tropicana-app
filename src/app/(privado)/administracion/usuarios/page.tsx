import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import FilaUsuario from "./FilaUsuario";
import FormularioNuevoUsuario from "./FormularioNuevoUsuario";
import type { PerfilConRol, Rol } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaUsuarios() {
  if (!(await tienePermiso("usuarios", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [{ data: perfiles }, { data: roles }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("*, rol:roles(*)")
      .order("apellido", { ascending: true })
      .order("nombre", { ascending: true }),
    supabase.from("roles").select("*").order("id"),
  ]);

  const listaPerfiles = (perfiles as PerfilConRol[]) ?? [];
  const listaRoles = (roles as Rol[]) ?? [];

  return (
    <div className="p-8 max-w-5xl">
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Cuentas de acceso al sistema. Creá una cuenta nueva con nombre, correo, contraseña y rol; queda lista para ingresar."
      />

      <FormularioNuevoUsuario roles={listaRoles} />

      {listaPerfiles.length === 0 ? (
        <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 text-[var(--texto-tenue)] text-lg">
          Todavía no hay usuarios. Usá “+ Nuevo usuario” para crear la primera
          cuenta.
        </div>
      ) : (
        <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
                <th className="py-3 px-4 font-medium">Nombre</th>
                <th className="py-3 px-4 font-medium">WhatsApp</th>
                <th className="py-3 px-4 font-medium">Rol</th>
                <th className="py-3 px-4 font-medium">Estado</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {listaPerfiles.map((p) => (
                <FilaUsuario key={p.id} perfil={p} roles={listaRoles} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
