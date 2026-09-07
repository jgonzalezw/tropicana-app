import { tienePermiso } from "@/lib/sesion";
import { obtenerParametro } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClienteLiquidaciones from "./ClienteLiquidaciones";
import { cargarLiquidaciones } from "./acciones";

export const dynamic = "force-dynamic";

export default async function PaginaLiquidaciones() {
  if (!(await tienePermiso("comisiones", "ver"))) return <SinAcceso />;

  const [{ profesores, liquidaciones }, mediosParam] = await Promise.all([
    cargarLiquidaciones(),
    obtenerParametro("medios_pago"),
  ]);
  const medios = (mediosParam ?? "Efectivo,QR / transf.,Otro")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="p-8 max-w-5xl">
      <EncabezadoPagina
        titulo="Liquidaciones"
        descripcion="Comisiones devengadas por membresías cobradas y completadas (criterio 1). Generá la liquidación del profesor, pagá y descargá el comprobante."
      />
      <ClienteLiquidaciones
        profesores={profesores}
        liquidaciones={liquidaciones}
        medios={medios}
        puedeCrear={await tienePermiso("comisiones", "crear")}
      />
    </div>
  );
}
