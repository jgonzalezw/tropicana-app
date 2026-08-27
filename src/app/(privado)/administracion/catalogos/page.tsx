import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClienteCatalogos from "./ClienteCatalogos";
import type { Catalogo, CatalogoValor } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaCatalogos() {
  if (!(await tienePermiso("administracion", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [{ data: catalogos }, { data: valores }] = await Promise.all([
    supabase.from("catalogos").select("*").order("nombre"),
    supabase.from("catalogo_valores").select("*").order("orden"),
  ]);

  return (
    <div className="p-8 max-w-4xl">
      <EncabezadoPagina
        titulo="Catálogos"
        descripcion="Listas configurables que se usan en toda la app. Agregá o desactivá valores sin tocar el código."
      />
      <ClienteCatalogos
        catalogos={(catalogos as Catalogo[]) ?? []}
        valores={(valores as CatalogoValor[]) ?? []}
      />
    </div>
  );
}
