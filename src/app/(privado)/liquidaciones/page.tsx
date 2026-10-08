import Link from "next/link";
import { tienePermiso, alcanceDe, obtenerParametro } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import SinAcceso from "@/components/SinAcceso";
import ClienteLiquidaciones from "./ClienteLiquidaciones";
import { cargarLiquidaciones } from "./acciones";
import Pagina from "@/components/Pagina";

export const dynamic = "force-dynamic";

export default async function PaginaLiquidaciones() {
  if (!(await tienePermiso("liquidaciones", "ver"))) return <SinAcceso />;

  const [{ profesores, liquidaciones }, mediosParam, alcance] = await Promise.all([
    cargarLiquidaciones(),
    obtenerParametro("medios_pago"),
    alcanceDe("liquidaciones"),
  ]);
  const medios = (mediosParam ?? "Efectivo,QR / transf.,Otro")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <Pagina ancho="5xl">
      <EncabezadoPagina
        titulo="Liquidaciones"
        descripcion="Comisiones devengadas por membresías cobradas, según el criterio de liquidación de cada una (1, 2 o 3). Generá la liquidación del profesor, pagá y descargá el comprobante."
        accion={
          // El informe muestra a todos los profesores: un rol con visibilidad
          // "propio" (Profesor) no lo ve, igual que la página.
          alcance === "propio" ? undefined : (
            <div className="shrink-0 flex flex-wrap gap-3">
              <Link
                href="/liquidaciones/pre-liquidacion"
                className="inline-flex items-center justify-center min-h-[44px] px-5 text-base font-semibold rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
              >
                Pre-liquidación
              </Link>
              <Link
                href="/liquidaciones/pre-liquidacion?modo=simulacion"
                className="inline-flex items-center justify-center min-h-[44px] px-5 text-base font-semibold rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
              >
                Simular cierre del período
              </Link>
            </div>
          )
        }
      />
      <ClienteLiquidaciones
        profesores={profesores}
        liquidaciones={liquidaciones}
        medios={medios}
        puedeCrear={await tienePermiso("liquidaciones", "crear")}
      />
    </Pagina>
  );
}
