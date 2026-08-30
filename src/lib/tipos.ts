export type Rol = {
  id: number;
  clave: string;
  nombre: string;
  descripcion: string | null;
  es_sistema: boolean;
};

export type Perfil = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  whatsapp: string | null;
  rol_id: number;
  activo: boolean;
  /** Clave del tema visual elegido por el usuario (ver tabla `temas`). */
  tema: string | null;
  creado_en: string;
  actualizado_en: string;
};

export type PerfilConRol = Perfil & { rol: Rol };

export type RolPermiso = {
  id: number;
  rol_id: number;
  modulo: string;
  accion: string;
  permitido: boolean;
};

export type Parametro = {
  clave: string;
  valor: string;
  tipo: "texto" | "numero" | "booleano";
  nombre: string;
  descripcion: string | null;
  grupo: string;
  actualizado_en: string;
};

export type Catalogo = {
  id: number;
  clave: string;
  nombre: string;
  descripcion: string | null;
  es_sistema: boolean;
};

export type CatalogoValor = {
  id: number;
  catalogo_id: number;
  valor: string;
  etiqueta: string;
  orden: number;
  activo: boolean;
};

export const MODULOS = [
  "alumnos",
  "profesores",
  "cursos",
  "inscripciones",
  "asistencia",
  "pagos",
  "comisiones",
  "costos",
  "particulares",
  "inventario",
  "caja",
  "dashboard",
  "usuarios",
  "administracion",
] as const;

export const ACCIONES = ["ver", "crear", "editar", "eliminar"] as const;

export type ModuloClave = (typeof MODULOS)[number];
export type AccionClave = (typeof ACCIONES)[number];

export const ETIQUETA_MODULO: Record<string, string> = {
  alumnos: "Alumnos",
  profesores: "Profesores",
  cursos: "Cursos",
  inscripciones: "Inscripciones",
  asistencia: "Asistencia",
  pagos: "Pagos",
  comisiones: "Comisiones",
  costos: "Costos",
  particulares: "Particulares",
  inventario: "Inventario",
  caja: "Caja",
  dashboard: "Dashboard",
  usuarios: "Usuarios",
  administracion: "Administración",
};

export const ETIQUETA_ACCION: Record<string, string> = {
  ver: "Ver",
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
};
