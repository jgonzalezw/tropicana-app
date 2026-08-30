import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import FilaParametro from "./FilaParametro";
import type { Parametro } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaParametros() {
  if (!(await tienePermiso("administracion", "ver"))) return <SinAcceso />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("parametros")
    .select("*")
    .order("grupo")
    .order("nombre");

  const parametros = (data as Parametro[]) ?? [];

  const grupos = parametros.reduce<Record<string, Parametro[]>>((acc, p) => {
    (acc[p.grupo] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="p-8 max-w-4xl">
      <EncabezadoPagina
        titulo="Parámetros"
        descripcion="Políticas y valores configurables que usan todos los módulos."
      />

      <div className="space-y-6">
        {Object.entries(grupos).map(([grupo, items]) => (
          <section
            key={grupo}
            className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6"
          >
            <h2 className="text-xl mb-2">{grupo}</h2>
            <div>
              {items.map((p) => (
                <FilaParametro key={p.clave} parametro={p} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
