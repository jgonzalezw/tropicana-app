import type { TonoChip } from "@/components/nuevo/Chip";
import type { ClaveChip, FilaMembresia, TipoMembresia } from "@/lib/listaMembresias";
import { formatearHoras } from "@/lib/horarios";

// Textos y tonos que comparten la lista (cliente) y la ficha (servidor).

export const ETIQUETA_TIPO: Record<TipoMembresia, string> = {
  regular: "Curso regular",
  prueba: "Clase de prueba",
  particular: "Particular",
  alquiler: "Alquiler",
};

export const TONO_CHIP: Record<ClaveChip, TonoChip> = {
  baja: "peligro",
  renovada: "exito",
  solicitud: "ambar",
  deuda: "peligro",
  por_vencer: "ambar",
  completada: "tenue",
  activa: "exito",
};

/** «7/8» en clases, «1/4 h» en horas. */
export const usoTexto = (u: FilaMembresia["uso"]) =>
  u.unidad === "h"
    ? `${formatearHoras(u.hechas)}${u.total != null ? `/${formatearHoras(u.total)}` : ""} h`
    : `${u.hechas}${u.total != null ? `/${u.total}` : ""}`;
