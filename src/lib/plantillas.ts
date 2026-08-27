import { type ModuloClave, type AccionClave } from "@/lib/tipos";

export type ClavePlantilla =
  | "administrador_total"
  | "gestion"
  | "recepcion"
  | "solo_lectura"
  | "sin_permisos";

export const PLANTILLAS: {
  clave: ClavePlantilla;
  nombre: string;
  descripcion: string;
}[] = [
  {
    clave: "gestion",
    nombre: "Gerente (gestión)",
    descripcion: "Todo el negocio salvo Administración (usuarios y configuración).",
  },
  {
    clave: "recepcion",
    nombre: "Asistente (recepción)",
    descripcion: "Mostrador diario: alumnos, cobros, asistencia; sin finanzas ni configuración.",
  },
  {
    clave: "solo_lectura",
    nombre: "Solo lectura",
    descripcion: "Puede ver todos los módulos, sin modificar nada.",
  },
  {
    clave: "administrador_total",
    nombre: "Acceso total",
    descripcion: "Todos los permisos en todos los módulos.",
  },
  {
    clave: "sin_permisos",
    nombre: "Sin permisos",
    descripcion: "Reinicia el rol: ningún permiso marcado.",
  },
];

// Recepción / Asistente: acciones permitidas por módulo.
const RECEPCION: Partial<Record<ModuloClave, AccionClave[]>> = {
  alumnos: ["ver", "crear", "editar"],
  inscripciones: ["ver", "crear", "editar"],
  asistencia: ["ver", "crear", "editar"],
  pagos: ["ver", "crear"],
  particulares: ["ver", "crear"],
  inventario: ["ver", "crear"],
  caja: ["ver", "crear"],
  cursos: ["ver"],
  profesores: ["ver"],
  dashboard: ["ver"],
  // comisiones, costos, administracion => sin acceso
};

/** ¿La plantilla permite esta acción en este módulo? */
export function permitidoEnPlantilla(
  plantilla: ClavePlantilla,
  modulo: ModuloClave,
  accion: AccionClave
): boolean {
  switch (plantilla) {
    case "administrador_total":
      return true;
    case "sin_permisos":
      return false;
    case "solo_lectura":
      return accion === "ver";
    case "gestion":
      return modulo !== "administracion";
    case "recepcion":
      return (RECEPCION[modulo] ?? []).includes(accion);
  }
}
