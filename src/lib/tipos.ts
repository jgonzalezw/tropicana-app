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

/** Plan vendible (motor). Puede dar acceso a uno o varios cursos (plan_cursos). */
export type AccesoModo = "solo" | "todas" | "excepto";

export type Plan = {
  id: number;
  nombre: string;
  tipo_servicio: string;
  curso_id: number | null;
  cantidad_clases: number | null;
  precio: number;
  criterio_liquidacion: number;
  tolerancia_faltas: number | null;
  modalidad: string | null;
  acceso_modo: AccesoModo;
  clases_ilimitadas: boolean;
  ciclo_dias: number | null;
  renovable: boolean;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  /** Cursos seleccionados (desde plan_cursos): incluidos si acceso='solo',
   *  excluidos si acceso='excepto'. Poblado por la pantalla. */
  cursoIds?: number[];
};

/** Datos que la pantalla de Planes envía al host para crear/editar. */
export type DatosPlan = {
  nombre: string;
  precio: number;
  acceso_modo: AccesoModo;
  clases_ilimitadas: boolean;
  /** Requerido si NO es ilimitado. */
  cantidad_clases: number | null;
  /** Requerido si es ilimitado (duración del ciclo en días). */
  ciclo_dias: number | null;
  criterio_liquidacion: number;
  tolerancia_faltas: number | null;
  /** Cursos seleccionados: incluidos ('solo') o excluidos ('excepto'). */
  cursoIds: number[];
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
  /**
   * Fecha máxima de compromiso de pago del saldo (ISO local YYYY-MM-DD).
   * Solo se usa cuando queda saldo (pago parcial o sin pago). null si se pagó
   * todo. El servidor la valida contra el parámetro `dias_compromiso_pago`.
   */
  fechaCompromiso: string | null;
};

/** Días elegidos para un curso dentro del plan que se vende. */
export type DiasCursoVenta = { cursoId: number; dias: number[] };

/** Entrada de la server action que vende un plan y cobra en un solo paso. */
export type EntradaInscripcion = {
  alumnoId: number;
  /** Plan que se vende (motor). El servidor recomputa N y precio. */
  planId: number;
  /** Fecha de inicio, ISO local YYYY-MM-DD. */
  fechaInicio: string;
  /** Días elegidos por cada curso del plan (1=lun..7=dom). */
  diasPorCurso: DiasCursoVenta[];
  cobro: CobroInscripcion;
};

// ── Cuenta del alumno (estado de cuenta + cobro) ────────────────────────

/** Una cuota vista desde la cuenta del alumno, con lo cobrado y lo que falta. */
export type CuotaCuenta = {
  id: number;
  periodo: string;
  vencimiento: string | null;
  fechaCompromiso: string | null;
  devengado: number;
  descuentoAdelanto: number;
  /** Plata efectivamente cobrada (sin contar descuentos). */
  cobrado: number;
  /** Plata + descuentos: lo que dejó de deberse. */
  cubierto: number;
  saldo: number;
  estado: string;
};

/** Una membresía del alumno con su consumo, su plata y su deuda. */
export type MembresiaCuenta = {
  id: number;
  plan: string | null;
  curso: string | null;
  estado: string;
  fechaInicio: string;
  fechaFin: string | null;
  /** Plan con N: cuántas clases asistió de las N del ciclo. */
  progreso: { hechas: number; total: number } | null;
  /** Paquete por clase: cuántas le quedan. */
  restantes: number | null;
  faltasConLicencia: number;
  faltasSinLicencia: number;
  /** Bono de tolerancia pendiente de redimir (0 si ya se usó). */
  bono: number;
  /**
   * Hasta cuándo puede renovar sin perder el bono: la siguiente clase después
   * del fin de ciclo. `null` si no hay bono o no aplica.
   */
  renovacionBonificada: string | null;
  cuotas: CuotaCuenta[];
  saldo: number;
};

export type PagoCuenta = {
  id: number;
  fecha: string;
  monto: number;
  descuento: number;
  descuentoMotivo: string | null;
  medio: string | null;
  concepto: string | null;
};

export type EstadoCuenta = {
  alumno: { id: number; nombre: string; apellido: string };
  membresias: MembresiaCuenta[];
  pagos: PagoCuenta[];
  deuda: number;
};

/** Lo que hace falta para asentar un cobro contra una cuota existente. */
export type EntradaCobro = {
  cuotaId: number;
  monto: number;
  medio: string | null;
  notaMedio?: string;
  descuento: number;
  descuentoMotivo: string;
  /** Obligatoria si el cobro deja saldo: mismo criterio que la venta. */
  fechaCompromiso: string | null;
  /** Cuándo ocurrió de verdad, si no fue hoy. `null` = coincide con el registro. */
  fechaEfectiva: string | null;
  /** Descripción del movimiento. Si falta, se usa la nota del medio de pago. */
  glosa?: string;
  /**
   * Por qué se cobra (clave del catálogo `motivo_cobro`): inscripción,
   * mensualidad, venta de paquete… Si falta, se asienta como `cuota`, que es
   * lo que hace la venta desde /inscribir.
   */
  motivo?: string;
};

/** Fila del padrón de una sesión de asistencia (un alumno inscripto). */
export type FilaAsistencia = {
  inscripcionId: number | null;
  alumnoId: number;
  apellido: string;
  nombre: string;
  modalidad: "mensual" | "clase" | "semana" | "medio_mes";
  /** Parciales: clases que quedan en el paquete; mensual: null. */
  restantes: number | null;
  /** Faltas (con o sin licencia) de esta membresía, en su ciclo actual (desde que empezó, no por mes calendario). */
  faltasCiclo: number;
  /** Progreso de clases dictadas de la membresía (plan con N): cuántas de las `total`. `null` = no aplica (ilimitado, parcial). */
  progreso: { hechas: number; total: number } | null;
  /** Deuda pendiente del alumno (0 si está al día). */
  deuda: number;
  /**
   * Faltas con licencia que aún puede acreditar en el ciclo antes de agotar la
   * tolerancia del plan. `null` = no aplica (sin plan de N clases: ilimitado,
   * parcial o legado sin plan) — en ese caso no hay opción de "con licencia".
   */
  toleranciaRestante: number | null;
  /**
   * El ciclo ya tiene una falta SIN licencia (en otra sesión): por política no
   * puede generar bono de tolerancia, aunque el plan tuviera cupo.
   */
  faltaSinLicenciaEnCiclo: boolean;
};

export type MarcaAsistencia = {
  alumnoId: number;
  inscripcionId: number | null;
  estado: "presente" | "ausente";
  /** Falta justificada: no da bono de tolerancia si es false. */
  conLicencia?: boolean;
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
