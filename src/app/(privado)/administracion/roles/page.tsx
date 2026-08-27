import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import GestionRoles from "./GestionRoles";
import MatrizPermisos from "./MatrizPermisos";
import type { Rol, RolPermiso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaRoles() {
  if (!(await tienePermiso("administracion", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [{ data: roles }, { data: permisos }, { data: perfiles }] =
    await Promise.all([
      supabase.from("roles").select("*").order("id"),
      supabase.from("rol_permisos").select("*"),
      supabase.from("perfiles").select("rol_id"),
    ]);

  const listaRoles = (roles as Rol[]) ?? [];

  // Conteo de usuarios por rol.
  const conteos: Record<number, number> = {};
  for (const p of (perfiles as { rol_id: number }[]) ?? []) {
    conteos[p.rol_id] = (conteos[p.rol_id] ?? 0) + 1;
  }

  return (
    <div className="p-8 max-w-4xl">
      <EncabezadoPagina
        titulo="Roles y permisos"
        descripcion="Creá los roles que necesite la escuela y definí qué puede hacer cada uno en cada módulo."
      />

      <GestionRoles roles={listaRoles} conteos={conteos} />

      <h2 className="text-xl font-semibold mb-4">Permisos por rol</h2>
      <p className="text-[var(--texto-tenue)] mb-4">
        Elegí un rol y marcá qué acciones puede hacer en cada módulo. Los cambios
        se guardan al instante.
      </p>
      <MatrizPermisos
        roles={listaRoles}
        permisos={(permisos as RolPermiso[]) ?? []}
      />
    </div>
  );
}
