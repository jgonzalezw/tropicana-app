import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import { exigir } from "@/lib/datos";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClientePrecios from "./ClientePrecios";
import type { Curso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

/**
 * Precios y paquetes — el centro único de los precios base (D8).
 *
 * Todo lo que se lee acá es necesario para que la pantalla haga su trabajo, así
 * que va con `exigir()`: si una consulta falla se muestra el error, nunca una
 * tabla vacía que diga "no hay precios" cuando lo que pasó es que la lectura se
 * rompió (regla de calidad 1).
 */
export default async function PaginaPrecios() {
  if (!(await tienePermiso("administracion", "ver"))) return <SinAcceso />;

  const sb = await createClient();

  const [
    cursos,
    tarifasCurso,
    descuentos,
    paquetes,
    tamanos,
    horasPaquete,
    tarifasSala,
    usoPaquetes,
    usoAlquiler,
    especialidadesParam,
  ] = await Promise.all([
    sb.from("cursos").select("*").order("nombre").then((r) => exigir(r, "los cursos")),
    sb
      .from("curso_tarifas")
      .select("curso_id, modalidad, precio")
      .then((r) => exigir(r, "las tarifas por curso")),
    sb
      .from("descuentos_adelanto")
      .select("meses, porcentaje")
      .order("meses")
      .then((r) => exigir(r, "los descuentos por meses adelantados")),
    sb
      .from("tarifas_particular")
      .select("id, nombre, estilo, horas, precio, activo")
      .order("estilo")
      .order("horas")
      .then((r) => exigir(r, "los paquetes de clases particulares")),
    sb
      .from("sala_tamanos")
      .select("clave, etiqueta, max_personas, orden")
      .order("orden")
      .then((r) => exigir(r, "los tamaños de grupo de la sala")),
    sb
      .from("sala_horas_paquete")
      .select("id, horas, orden")
      .order("horas")
      .then((r) => exigir(r, "los paquetes de horas de sala")),
    sb
      .from("sala_tarifas")
      .select("categoria, tamano, precio, horas_paquete_id")
      // Solo la tarifa general —la que vale para todas las salas—. Una tarifa
      // propia de una sala (0037) manda sobre ésta, y se edita aparte: mostrar
      // las dos mezcladas en una sola grilla no diría cuál está viendo.
      .is("sala_id", null)
      .then((r) => exigir(r, "la matriz de alquiler de sala")),
    sb
      .from("paquetes_particular")
      .select("tarifa_particular_id")
      .then((r) => exigir(r, "el uso de los paquetes de particulares")),
    sb
      .from("alquileres_sala")
      .select("horas_total")
      .then((r) => exigir(r, "el uso de los paquetes de horas")),
    obtenerParametro("especialidades"),
  ]);

  // Tarifas por curso, indexadas para la grilla de los bloques A y C.
  const tarifas: Record<number, Record<string, number | null>> = {};
  for (const t of tarifasCurso as { curso_id: number; modalidad: string; precio: number }[]) {
    (tarifas[t.curso_id] ??= {})[t.modalidad] = t.precio;
  }

  // Cuántas operaciones usan cada fila: es lo que decide eliminar vs. desactivar,
  // y la pantalla muestra el motivo al lado del botón (N32).
  const usoPorPaquete: Record<number, number> = {};
  for (const u of usoPaquetes as { tarifa_particular_id: number | null }[]) {
    if (u.tarifa_particular_id != null)
      usoPorPaquete[u.tarifa_particular_id] = (usoPorPaquete[u.tarifa_particular_id] ?? 0) + 1;
  }
  const usoPorHoras: Record<number, number> = {};
  for (const u of usoAlquiler as { horas_total: number }[]) {
    const h = Number(u.horas_total);
    usoPorHoras[h] = (usoPorHoras[h] ?? 0) + 1;
  }

  const horasDeId = new Map<number, number>();
  for (const h of horasPaquete as { id: number; horas: number }[])
    horasDeId.set(h.id, Number(h.horas));

  const precios = (
    tarifasSala as {
      categoria: string;
      tamano: string;
      precio: number | null;
      horas_paquete_id: number;
    }[]
  ).map((t) => ({
    categoria: t.categoria,
    tamano: t.tamano,
    horas: horasDeId.get(t.horas_paquete_id) ?? 0,
    precio: t.precio,
  }));

  const especialidades = (especialidadesParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="p-8 max-w-6xl">
      <EncabezadoPagina
        titulo="Precios y paquetes"
        descripcion="Todo precio que cobra la escuela se carga acá. Si un valor no está en estas cinco tablas, el sistema no lo puede cobrar."
      />
      <ClientePrecios
        cursos={cursos as Curso[]}
        tarifas={tarifas}
        descuentos={descuentos as { meses: number; porcentaje: number }[]}
        paquetes={
          paquetes as {
            id: number;
            nombre: string;
            estilo: string;
            horas: number;
            precio: number;
            activo: boolean;
          }[]
        }
        usoPorPaquete={usoPorPaquete}
        tamanos={
          tamanos as { clave: string; etiqueta: string; max_personas: number; orden: number }[]
        }
        horasPaquete={horasPaquete as { id: number; horas: number; orden: number }[]}
        usoPorHoras={usoPorHoras}
        precios={precios}
        especialidades={especialidades}
      />
    </div>
  );
}
