import { alcanceDe, tienePermiso } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import Pagina from "@/components/Pagina";
import { prepararPreliquidacion } from "@/lib/liquidacion/lecturaPre";
import ClientePreliquidacion from "./ClientePreliquidacion";

export const dynamic = "force-dynamic";

/**
 * Pre-liquidación: lo que se devengaría si se liquidara hoy el período
 * vencido. Solo lectura. Permiso: el del módulo Liquidaciones ("ver"). Un rol
 * con visibilidad "propio" (un Profesor) no la ve: el informe muestra a todos
 * los profesores a la vez.
 */
export default async function PaginaPreliquidacion() {
  if (!(await tienePermiso("liquidaciones", "ver"))) return <SinAcceso />;
  if ((await alcanceDe("liquidaciones")) === "propio") return <SinAcceso />;

  const resultado = await prepararPreliquidacion();
  return (
    <Pagina ancho="5xl">
      <ClientePreliquidacion resultado={resultado} />
    </Pagina>
  );
}
