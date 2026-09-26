import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import { exigir } from "@/lib/datos";
import { opcionesDuracion } from "@/lib/horarios";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClienteCursos from "./ClienteCursos";
import type { Curso, TarifasCurso, Estilo } from "@/lib/tipos";
import Pagina from "@/components/Pagina";

export const dynamic = "force-dynamic";

export default async function PaginaCursos() {
  if (!(await tienePermiso("cursos", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [
    { data: cursos },
    salas,
    { data: tarifasRows },
    { data: asigRows },
    { data: estilosRows },
    incrementoParam,
    duracionMinimaParam,
  ] = await Promise.all([
      supabase.from("cursos").select("*").order("nombre"),
      // Las salas son necesarias para asignarle una al curso: un fallo acá se
      // muestra, no se convierte en "no hay salas" (regla de calidad 1).
      supabase
        .from("salas")
        .select("id, nombre")
        .eq("activa", true)
        .eq("es_externa", false)
        .order("orden")
        .order("id")
        .then((r) => exigir(r, "las salas")),
      supabase.from("curso_tarifas").select("curso_id, modalidad, precio"),
      supabase.from("asignaciones").select("curso_id"),
      supabase.from("estilos").select("*").eq("activo", true).order("orden"),
      obtenerParametro("tiempos_incremento_min"),
      obtenerParametro("duracion_minima_curso_min"),
    ]);

  const tarifas: Record<number, TarifasCurso> = {};
  for (const r of (tarifasRows as { curso_id: number; modalidad: string; precio: number }[]) ?? []) {
    const t = (tarifas[r.curso_id] ??= {
      clase: null,
      semana: null,
      medio_mes: null,
      prueba: null,
    });
    if (r.modalidad === "clase") t.clase = r.precio;
    else if (r.modalidad === "semana") t.semana = r.precio;
    else if (r.modalidad === "medio_mes") t.medio_mes = r.precio;
    else if (r.modalidad === "prueba") t.prueba = r.precio;
  }

  const deps: Record<number, number> = {};
  for (const a of (asigRows as { curso_id: number }[]) ?? []) {
    deps[a.curso_id] = (deps[a.curso_id] ?? 0) + 1;
  }

  // Duraciones elegibles: múltiplos del incremento vigente, desde el mínimo
  // (ítem 3, Javier 2026-09-16). Se calculan acá, no se guardan aparte —
  // cambiar el incremento o el mínimo las actualiza solas.
  const incrementoMin = Math.max(1, Number(incrementoParam) || 30);
  const duracionMinimaMin = Math.max(1, Number(duracionMinimaParam) || 30);
  const opcionesDuracionMin = opcionesDuracion(incrementoMin, duracionMinimaMin);

  return (
    <Pagina ancho="6xl">
      <EncabezadoPagina
        titulo="Cursos"
        descripcion="Los cursos de la escuela, su precio mensual y las tarifas parciales (una clase, una semana, medio mes)."
      />
      <ClienteCursos
        cursos={(cursos as Curso[]) ?? []}
        tarifas={tarifas}
        deps={deps}
        estilos={(estilosRows as Estilo[]) ?? []}
        opcionesDuracion={opcionesDuracionMin}
        salas={salas as { id: number; nombre: string }[]}
      />
    </Pagina>
  );
}
