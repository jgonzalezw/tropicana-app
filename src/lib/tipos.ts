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

export type Alumno = {
  id: number;
  nombre: string;
  apellido: string;
  whatsapp: string | null;
  es_menor: boolean;
  tutor_alumno_id: number | null;
  tutor_nombre: string | null;
  tutor_whatsapp: string | null;
  referido_por_alumno_id: number | null;
  canal_captacion: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

/** Datos que el componente de Alumno envía al host para crear/editar. */
export type DatosAlumno = {
  nombre: string;
  apellido: string;
  whatsapp: string;
  es_menor: boolean;
  tutor_alumno_id: number | null;
  tutor_nombre: string;
  tutor_whatsapp: string;
  canal_captacion: string | null;
};

/** Tarifas parciales por curso (tabla A). null = no cargada → cae al mensual. */
export type TarifasCurso = {
  clase: number | null;
  semana: number | null;
  medio_mes: number | null;
};

/** Datos que el componente de Curso envía al host para crear/editar. */
export type DatosCurso = {
  nombre: string;
  linea: string;
  nivel: string;
  dias_semana: number[];
  hora: string | null;
  precio_mensual: number;
  tarifas: TarifasCurso;
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

/** Decisión del paso Cobro que viaja del navegador a la server action. */
export type CobroInscripcion = {
  modo: "entero" | "parcial" | "sin";
  monto: number;
  medio: string | null;
  notaMedio: string;
  /** Descuento manual (política "descuento"). */
  ajuste: number;
  ajusteMotivo: string;
  total: number;
  saldo: number;
};

/** Entrada de la server action que inscribe y cobra en un solo paso. */
export type EntradaInscripcion = {
  alumnoId: number;
  cursoId: number;
  modalidad: "mensual" | "clase" | "semana" | "medio_mes";
  /** Fecha de inicio, ISO local YYYY-MM-DD. */
  fechaInicio: string;
  /** Meses adelantados (solo mensual); 1 en el resto. */
  meses: number;
  /** Subconjunto de días para medio mes; null = todos los del curso. */
  diasElegidos: number[] | null;
  cobro: CobroInscripcion;
};

/** Fila del padrón de una sesión de asistencia (un alumno inscripto). */
export type AlumnoSesion = {
  inscripcionId: number | null;
  alumnoId: number;
  apellido: string;
  nombre: string;
  modalidad: "mensual" | "clase" | "semana" | "medio_mes";
  /** Parciales: clases que quedan en el paquete; mensual: null. */
  restantes: number | null;
};

export type MarcaAsistencia = {
  alumnoId: number;
  inscripcionId: number | null;
  estado: "presente" | "ausente";
};

/** Entrada de la server action que guarda la asistencia de una sesión. */
export type EntradaAsistencia = {
  cursoId: number;
  /** Fecha de la sesión, ISO local YYYY-MM-DD. */
  fecha: string;
  marcas: MarcaAsistencia[];
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
