import { notFound } from "next/navigation";
import Pagina from "@/components/Pagina";
import { obtenerInfoRelease } from "@/lib/version";
import Muestrario from "./Muestrario";

// Muestrario de los componentes de `src/components/nuevo/`: donde se ven y se
// prueban (Playwright) mientras no hay una pantalla que los use. Lo cubre el
// mismo interruptor del layout y, además, solo existe fuera de producción
// (mismo criterio de entorno que el chip PROD/DEV: la base a la que apunta).
export default function PaginaMuestrario() {
  if (obtenerInfoRelease().entorno === "PROD") notFound();
  return (
    <Pagina ancho="4xl">
      <Muestrario />
    </Pagina>
  );
}
