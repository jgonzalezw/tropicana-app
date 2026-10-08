import { notFound } from "next/navigation";
import { obtenerSeccionesVisibles } from "@/lib/sesion";
import UiNuevo from "@/components/nuevo/UiNuevo";

// Sección nueva (I-012, D37). Con el interruptor `membresias_nuevas` apagado,
// o sin permiso de ver alumnos, particulares ni alquileres, la ruta no
// existe: la app queda como antes. La decisión es la misma que muestra la
// entrada en la barra lateral (`seccionesVisibles`).
export default async function LayoutMembresias({ children }: { children: React.ReactNode }) {
  const secciones = await obtenerSeccionesVisibles();
  if (!secciones.membresias) notFound();
  return <UiNuevo>{children}</UiNuevo>;
}
