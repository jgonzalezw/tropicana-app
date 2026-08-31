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
  /** Correo de acceso (denormalizado desde auth.users para buscar por email). */
  email: string | null;
  /** Bloqueo de acceso (por intentos fallidos o manual), independiente de `activo`. */
  bloqueado: boolean;
  motivo_bloqueo: "auto" | "manual" | null;
  intentos_fallidos: number;
  bloqueado_en: string | null;
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

// ── Etapa 1 — entidades base ──────────────────────────────────────────

export type TipoProfesor = "activo" | "externo";

export type Profesor = {
  id: number;
  nombre: string;
  apellido: string;
  whatsapp: string | null;
  tipo: TipoProfesor;
  especialidades: string[];
  /** Cuenta de login vinculada (perfiles.id), uno a uno. */
  usuario_id: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

/** Resumen de dependencias de un profesor: decide eliminar vs. desactivar. */
export type DepsProfesor = {
  asignaciones: number;
  comisiones: number;
  liquidaciones: number;
  sala: number;
};

export type Curso = {
  id: number;
  nombre: string;
  linea: string | null;
  nivel: string | null;
  dias_semana: number[];
  hora: string | null;
  precio_mensual: number;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

/** Datos que el componente de Profesor envía al host para crear/editar. */
export type DatosProfesor = {
  nombre: string;
  apellido: string;
  whatsapp: string;
  tipo: TipoProfesor;
  especialidades: string[];
  usuario_id: string | null;
};

export type Asignacion = {
  id: number;
  curso_id: number;
  profesor_id: number;
  pct_ingresos: number;
  pct_referido: number;
  desde: string;
  hasta: string | null;
  creado_en: string;
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
