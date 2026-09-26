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

/** 'propio' = el rol solo ve sus datos en ese módulo; 'todo' = ve todo. */
export type Alcance = "propio" | "todo";

/** Alcance de visibilidad por (rol, módulo) — 0043. Sin fila = 'todo'. */
export type RolVisibilidad = {
  rol_id: number;
  modulo: string;
  alcance: Alcance;
};

/** Una alternativa admitida por un parámetro: el valor guardado y cómo se lee. */
export type OpcionParametro = { valor: string; etiqueta: string };

export type Parametro = {
  clave: string;
  valor: string;
  tipo: "texto" | "numero" | "booleano";
  nombre: string;
  descripcion: string | null;
  grupo: string;
  /**
   * Lista cerrada de valores admitidos (0028). Cuando está cargada, el
   * parámetro se **elige** de un desplegable y no se escribe: un valor a mano
   * que no existe no falla, cae al default, y la aplicación se comporta
   * distinto sin decir por qué. `null` = no tiene alternativas.
   */
  opciones: OpcionParametro[] | null;
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

// ── Contactos (C3-0a.1, migración 0048) ────────────────────────────────
// Una persona u organización, un solo registro. `alumnos`/`profesores` son
// EXTENSIONES DE ROL que apuntan acá por `contacto_id`: ya no tienen su
// propio nombre/apellido/whatsapp. Ver docs/REGLAS.md, glosario.

export type TipoContacto = "persona" | "organizacion";

export type Contacto = {
  id: number;
  tipo: TipoContacto;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  sexo: string | null;
  /** Formato internacional boliviano `+591...`, o crudo si no se pudo normalizar. */
  whatsapp: string | null;
  telefono_alt: string | null;
  email: string | null;
  canal_captacion: string | null;
  fecha_primer_contacto: string;
  no_contactar: boolean;
  anonimizado_en: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  /**
   * Solo el número de documento, para buscar y detectar duplicados. Lo trae
   * el padrón embebido (`contactos_privados`), y su RLS lo deja vacío para
   * quien no tiene el permiso `contactos_privados`.
   */
  privados?: { numero: string | null } | null;
};

/** Datos que el selector/ficha de contacto envía al crear o actualizar la persona. */
export type DatosContacto = {
  nombre: string;
  apellido: string;
  whatsapp: string;
  canal_captacion: string | null;
};

export type ContactoPrivado = {
  contacto_id: number;
  tipo_documento: string | null;
  pais_emisor: string;
  numero: string | null;
  complemento: string | null;
  expedido: string | null;
  fecha_nacimiento: string | null;
  actualizado_en: string;
};

export type TipoRelacionContacto = "tutor_de" | "referido_por" | "trabaja_en" | "contacto_emergencia";

export type ContactoRelacion = {
  id: number;
  desde_id: number;
  hacia_id: number;
  tipo: TipoRelacionContacto;
  desde_fecha: string;
};

// ── Redes, documento y consentimiento (0048, campos de C3-0a.3) ────────

export type RedSocial = { clave: string; nombre: string; patron_url: string | null; orden: number; activo: boolean };

export type ContactoRed = { id: number; contacto_id: number; red: string; usuario: string };

export type TipoDocumento = { clave: string; nombre: string; patron: string | null; orden: number; activo: boolean };

export type ContactoPrivadoDatos = {
  tipo_documento: string;
  numero: string;
  complemento: string | null;
  expedido: string | null;
};

/** El último consentimiento otorgado por un contacto para "contacto" (vista `consentimientos_vigentes`). */
export type ConsentimientoVigente = {
  contacto_id: number;
  otorgado: boolean;
  medio: string;
  version_politica: string | null;
  creado_en: string;
};

/**
 * Lo que un formulario de contacto (alumno, profesor) envía además de su
 * identidad — controlado por la matriz de mínimos (C3-0a.3): un campo en
 * `-` no se manda; el formulario solo arma lo que muestra.
 */
export type DatosContactoExtra = {
  email: string | null;
  sexo: string | null;
  redes: { red: string; usuario: string }[];
  documento: ContactoPrivadoDatos | null;
  fecha_nacimiento: string | null;
  /** `null` = no se tocó el consentimiento (no se registra nada nuevo). */
  consentimiento: { otorgado: boolean; medio: string } | null;
};

/** Catálogos de apoyo que `CamposContacto` necesita para renderizar sus listas (regla de calidad 6). */
export type ListasContacto = {
  redesDisponibles: RedSocial[];
  tiposDocumento: TipoDocumento[];
  mediosConsentimiento: { valor: string; etiqueta: string }[];
  sexoOpciones: { valor: string; etiqueta: string }[];
  textoPolitica: string;
};

/** Estilo de baile (D12, migración 0048) — catálogo propio, no texto libre. */
export type Estilo = { clave: string; nombre: string; orden: number; activo: boolean };

// ── Matriz de mínimos por contexto (0048, editable desde C3-0a.2) ──────
// Qué tan obligatorio es cada campo según el contexto en que se carga un
// contacto: O = obligatorio, V = visible opcional, - = oculto.

export const NIVELES_MINIMO = ["O", "V", "-"] as const;
export type NivelMinimo = (typeof NIVELES_MINIMO)[number];

export const CONTEXTOS_MINIMO = [
  "prospecto",
  "prueba",
  "alumno_adulto",
  "alumno_menor",
  "profesor",
  "tercero_persona",
  "tercero_org",
  "proveedor",
  "form_publico",
] as const;
export type ContextoMinimo = (typeof CONTEXTOS_MINIMO)[number];

export const CAMPOS_MINIMO = [
  "nombre",
  "apellido",
  "razon_social",
  "whatsapp",
  "red_social",
  "es_menor",
  "tutor",
  "tipo_profesor",
  "canal_captacion",
  "interes",
  "consentimiento",
  "email",
  "documento",
  "facturacion",
  "nacimiento",
  "sexo",
] as const;
export type CampoMinimo = (typeof CAMPOS_MINIMO)[number];

export type MatrizMinimo = { contexto: ContextoMinimo; campo: CampoMinimo; nivel: NivelMinimo };

export const ETIQUETA_CONTEXTO_MINIMO: Record<ContextoMinimo, string> = {
  prospecto: "Prospecto",
  prueba: "Prueba",
  alumno_adulto: "Alumno adulto",
  alumno_menor: "Alumno menor",
  profesor: "Profesor",
  tercero_persona: "Tercero (persona)",
  tercero_org: "Tercero (organización)",
  proveedor: "Proveedor",
  form_publico: "Formulario público",
};

export const ETIQUETA_CAMPO_MINIMO: Record<CampoMinimo, string> = {
  nombre: "Nombre",
  apellido: "Apellido",
  razon_social: "Razón social",
  whatsapp: "WhatsApp",
  red_social: "Red social",
  es_menor: "Es menor",
  tutor: "Tutor",
  tipo_profesor: "Tipo de profesor",
  canal_captacion: "Canal de captación",
  interes: "Interés",
  consentimiento: "Consentimiento",
  email: "Email",
  documento: "Documento",
  facturacion: "Facturación",
  nacimiento: "Fecha de nacimiento",
  sexo: "Sexo",
};

export const ETIQUETA_NIVEL_MINIMO: Record<NivelMinimo, string> = {
  O: "Obligatorio",
  V: "Visible (opcional)",
  "-": "Oculto",
};

// ── Etapa 1 — entidades base ──────────────────────────────────────────

export type TipoProfesor = "activo" | "externo";

export type Profesor = {
  id: number;
  contacto_id: number;
  /** Siempre presente: `contacto_id` es NOT NULL y único desde la 0048. */
  contacto: Contacto;
  tipo: TipoProfesor;
  /**
   * Claves de `estilos` (D12, vía `profesor_estilos`). Se llena solo en las
   * lecturas que lo piden, igual que `Alumno.tutor` — no todo `select` de
   * profesores lo necesita.
   */
  estilos?: string[];
  /**
   * Lo que se le paga por clase cuando dicta como **reemplazante** (0030).
   * Es una **referencia**: el monto real se confirma al registrar la
   * asistencia, y ese es el que manda (regla 12). `null` = sin cargar.
   */
  tarifa_reemplazo: number | null;
  /**
   * Fee por hora de particulares (0052, C3 H1): lo que gana este profesor
   * cuando el plan elige `forma_pago_profesor = 'fee_hora'`. Reemplaza a
   * `comision_particular_pct` (OBSOLETA, nunca tuvo uso). `null` = sin cargar.
   */
  fee_hora: number | null;
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
  /** @deprecated desde 0048 — usar `estilo` (FK a `estilos.clave`). Se borra en la 0049. */
  linea: string | null;
  /** Clave de `estilos` (D12). */
  estilo: string | null;
  nivel: string | null;
  dias_semana: number[];
  hora: string | null;
  /** Cuánto dura una clase, en minutos. La hora de fin se calcula (0034). */
  duracion_min: number;
  /** En qué sala se dicta (0037). De acá sale qué clases ocupan cada sala;
   *  `null` = sin asignar, y entonces no ocupa ninguna. */
  sala_id: number | null;
  precio_mensual: number;
  activo: boolean;
  /** Desde cuándo corre el curso: el calendario no genera clases antes (0033). */
  vigente_desde: string | null;
  /** Fecha de baja; null = sigue corriendo. */
  vigente_hasta: string | null;
  creado_en: string;
  actualizado_en: string;
};

/** Datos que el componente de Profesor envía al host para crear/editar. */
export type DatosProfesor = DatosContactoExtra & {
  nombre: string;
  apellido: string;
  whatsapp: string;
  tipo: TipoProfesor;
  /** Claves de `estilos` (D12) — reemplaza al array de texto libre. */
  estilos: string[];
  usuario_id: string | null;
  /** Referencia de pago por clase como reemplazante. null = sin cargar. */
  tarifa_reemplazo: number | null;
  /** Fee por hora de particulares (0052). null = sin cargar. */
  fee_hora: number | null;
};

export type Alumno = {
  id: number;
  contacto_id: number;
  /** Siempre presente: `contacto_id` es NOT NULL y único desde la 0048. */
  contacto: Contacto;
  es_menor: boolean;
  /**
   * El tutor, ya resuelto (vía `contacto_relaciones` tipo `tutor_de`), o
   * `null` si no tiene uno cargado. Se llena solo en las lecturas que lo
   * piden — no todo `select` de alumnos lo necesita.
   */
  tutor?: Contacto | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

/** Datos que el componente de Alumno envía al host para crear/editar. */
export type DatosAlumno = DatosContactoExtra & {
  nombre: string;
  apellido: string;
  whatsapp: string;
  es_menor: boolean;
  /** Contacto existente a reusar como tutor (otro alumno-tutor, un profesor, o cualquier contacto ya cargado). */
  tutorContactoId: number | null;
  tutorNombre: string;
  tutorWhatsapp: string;
  canal_captacion: string | null;
  /** Si este alumno se está cargando desde la clase de prueba (elige el contexto de la matriz). */
  enPrueba?: boolean;
};

/** Tarifas parciales por curso (tabla A). null = no cargada → cae al mensual. */
export type TarifasCurso = {
  clase: number | null;
  semana: number | null;
  medio_mes: number | null;
  /** Precio de la clase de prueba, por alumno. Explícitamente por curso: una
   *  prueba de Heels no vale lo que una de Zumba. */
  prueba: number | null;
};

/** Datos que el componente de Curso envía al host para crear/editar. */
export type DatosCurso = {
  nombre: string;
  /** Clave de `estilos` (D12). */
  estilo: string;
  nivel: string;
  dias_semana: number[];
  hora: string | null;
  duracion_min: number;
  sala_id: number | null;
  precio_mensual: number;
  /** Vigencia del curso (0033). La baja es opcional: null = sigue corriendo. */
  vigente_desde: string;
  vigente_hasta: string | null;
  tarifas: TarifasCurso;
};

/** Plan vendible (motor). Puede dar acceso a uno o varios cursos (plan_cursos). */
export type AccesoModo = "solo" | "todas" | "excepto";

/** Tipos de servicio de un plan (regla de negocio 22). */
export type TipoServicioPlan = "curso_regular" | "taller" | "particular" | "alquiler" | "prueba";

/** Modalidad de reserva de un plan de particulares (definiciones-v2, 7.5). */
export type ReservaModalidad = "fija" | "flexible";

/** A qué salas da acceso el plan (mismo patrón que `AccesoModo` de cursos). */
export type SalasModo = "todas" | "solo";

/** Cómo gana el profesor con este plan (definiciones-v2, sección 3). */
export type FormaPagoProfesor = "fee_hora" | "pct_margen" | "monto_fijo";

/** Cómo se cobra una extensión de membresía ya vendida (definiciones-v2, 7.3). */
export type ExtensionModo = "lista" | "recargo";

export type Plan = {
  id: number;
  nombre: string;
  tipo_servicio: TipoServicioPlan;
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
  /** Si este plan se puede ofrecer como clase de prueba. */
  acepta_prueba: boolean;
  /** En cuántos cursos DISTINTOS del plan puede probar el prospecto. null = 1. */
  prueba_cursos_max: number | null;
  /** Si al convertir dentro del plazo, lo pagado se acredita a la membresía nueva. */
  prueba_acredita: boolean;
  /** Días para convertir conservando el crédito. null = usa el parámetro. */
  prueba_plazo_dias: number | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  /** Cursos seleccionados (desde plan_cursos): incluidos si acceso='solo',
   *  excluidos si acceso='excepto'. Poblado por la pantalla. */
  cursoIds?: number[];

  // ── Particulares (0052, C3 H1) ──────────────────────────────────────
  /** Estilo (clave de `estilos`): de ahí sale qué tramos de `tarifas_particular`
   *  se ofrecen al vender. `null` en un plan de curso regular. */
  estilo: string | null;
  /** Vigencia del paquete, en días. `null` = usa el parámetro `vencimiento_paquete_meses`. */
  vigencia_dias: number | null;
  reserva_modalidad: ReservaModalidad | null;
  salas_modo: SalasModo;
  /** Salas permitidas (desde plan_salas) cuando `salas_modo='solo'`. Poblado por la pantalla. */
  salaIds?: number[];
  forma_pago_profesor: FormaPagoProfesor | null;
  pago_pct_margen: number | null;
  pago_descuenta_sala: boolean;
  pago_monto_fijo: number | null;
  extension_modo: ExtensionModo;
  extension_recargo_pct: number | null;
  /** Política de asistentes de un grupo (definiciones-v2, 7.4): si se
   *  registran uno a uno o no. Nunca afecta la liquidación del profesor. */
  registra_acompanantes: boolean;
};

/** Datos que la pantalla de Planes envía al host para crear/editar. */
export type DatosPlan = {
  nombre: string;
  tipo_servicio: TipoServicioPlan;
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
  /** Si el plan se ofrece como clase de prueba, y con qué condiciones. */
  acepta_prueba: boolean;
  prueba_cursos_max: number | null;
  prueba_acredita: boolean;
  prueba_plazo_dias: number | null;

  // ── Particulares (0052, C3 H1) ──────────────────────────────────────
  estilo: string | null;
  vigencia_dias: number | null;
  reserva_modalidad: ReservaModalidad | null;
  salas_modo: SalasModo;
  salaIds: number[];
  forma_pago_profesor: FormaPagoProfesor | null;
  pago_pct_margen: number | null;
  pago_descuenta_sala: boolean;
  pago_monto_fijo: number | null;
  extension_modo: ExtensionModo;
  extension_recargo_pct: number | null;
  registra_acompanantes: boolean;
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
  /** @deprecated Resabio mono-curso — usar `cursos`, que cubre multi-curso. */
  curso: string | null;
  /** Los cursos que toca la membresía, con sus días (por `membresia_cursos`,
   *  con respaldo a `curso_id` para filas viejas). Vacío = no se pudo determinar. */
  cursos: { nombre: string; dias: number[] }[];
  estado: string;
  fechaInicio: string;
  /** Real si ya se calculó, o una estimación cuando el paquete termina por
   *  consumo y no por fecha (ver `fechaFinEstimada`). */
  fechaFin: string | null;
  /** `true` = `fechaFin` es una proyección (asistencia perfecta desde hoy),
   *  no un compromiso. Un paquete por clase no tiene fecha de fin real. */
  fechaFinEstimada: boolean;
  /** Plan con N: cuántas clases asistió de las N del ciclo. */
  progreso: { hechas: number; total: number } | null;
  /** Paquete por clase: cuántas le quedan. */
  restantes: number | null;
  /** Particular/alquiler (`curso_id` null, `horas_contratadas` no null): el
   *  saldo de horas, calculado igual que en `/particulares`
   *  (`saldoMembresia`, `@/lib/reservas`) — nunca guardado paso a paso (regla
   *  de negocio 23). `null` para una membresía de curso regular. */
  horas: { contratadasMin: number; consumidasMin: number; disponibleMin: number } | null;
  /** Para una particular sin `membresia_cursos` que mostrar (regla 21: no
   *  tiene curso, tiene estilo + profesor): "Salsa · Inamsai De Dazan", lista
   *  para reemplazar el fallback "Curso sin determinar". `null` si no aplica
   *  o falta el dato. */
  estiloProfesor: string | null;
  /** Las reservas de una particular/alquiler, una por una — incluida una
   *  Suspendida por un cierre de sala (H4): acá también tiene que verse, no
   *  solo en `/particulares/[id]`. `null` para una membresía de curso
   *  regular (esas no tienen filas en `reservas_sala`). */
  reservas: { fecha: string; hora: string; duracionMin: number; estado: string; salaNombre: string | null }[] | null;
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
  /** A qué membresía corresponde este pago (por su cuota → membresía), para
   *  poder distinguirlo cuando el alumno tiene varias — el nombre del plan
   *  solo no alcanza cuando dos ventas comparten plantilla, así que se suma
   *  la fecha de inicio de esa membresía. `null` si el pago no está atado a
   *  ninguna cuota (no debería pasar en un cobro, regla de negocio 7). */
  membresiaPlan: string | null;
  membresiaFechaInicio: string | null;
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
  /** Es una membresía de prueba: se muestra distinta y no renueva. */
  esPrueba: boolean;
  /**
   * Cuánta gente cubre esta fila. Casi siempre 1; una prueba grupal es un
   * titular más N acompañantes sin nombre, con una sola asistencia (regla 11),
   * así que la fila vale por varios para el conteo de la clase.
   */
  personas: number;
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
  /**
   * La clase la dictó alguien distinto del titular (regla de negocio 20).
   * `motivo` sale del catálogo `motivo_reemplazo` y es el que decide la plata:
   * `titular` se la descuenta a él, `administrativo` la deja en Tropicana.
   * Obligatorio si el curso no tenía titular esa fecha y la clase se dictó.
   */
  reemplazo?: { profesorId: number; motivo: string; costo: number } | null;
  /**
   * La persona ya vio el aviso de que esto recalcula una liquidación cobrada
   * y decidió seguir. Sin esto, `guardarAsistencia` devuelve el aviso en vez
   * de guardar (regla de negocio 16: avisa, no bloquea).
   */
  confirmado?: boolean;
};

export const MODULOS = [
  "alumnos",
  "profesores",
  "cursos",
  "inscripciones",
  "asistencia",
  "pagos",
  "costos",
  "particulares",
  "inventario",
  "caja",
  "dashboard",
  "usuarios",
  "administracion",
  // Los cuatro de acá abajo se separaron el 2026-09-16 (regla de proceso 11):
  // vivían gateados con el permiso de otro módulo (cursos, comisiones,
  // administracion) y un asistente con ese permiso los veía sin poder
  // restringírselo. Ver docs/REGLAS.md §3.11. "comisiones" se dio de baja en
  // el mismo cambio: ninguna pantalla lo lee ya, lo reemplazó "liquidaciones".
  "planes",
  "liquidaciones",
  "precios",
  "sala",
  // Contactos (C3-0a.1, 2026-09-24, regla de proceso 11): "contactos" hereda
  // los permisos de alumnos+profesores en la migración 0048, así ningún rol
  // pierde acceso a lo que ya veía. "contactos_privados", "solicitudes" y
  // "enlaces_captacion" son nuevos, sin pantalla todavía los dos últimos
  // (nacen para C3-0b) — aparecen en Roles y Permisos con esa nota.
  "contactos",
  "contactos_privados",
  "solicitudes",
  "enlaces_captacion",
] as const;

export const ACCIONES = ["ver", "crear", "editar", "eliminar"] as const;

export type ModuloClave = (typeof MODULOS)[number];
export type AccionClave = (typeof ACCIONES)[number];

/**
 * Módulos que tienen "dueño" de la fila y por eso admiten un alcance de
 * visibilidad propio/todo (0043): Asistencia (el profesor de cada curso),
 * Liquidaciones (el profesor liquidado), Caja (quién registró el movimiento),
 * Contactos (el profesor ve los contactos de sus alumnos, vía RLS — 0048).
 * La UI de Roles ofrece el selector solo para estos, y solo estos consultan
 * `alcanceDe`. Agregar un módulo acá es todo lo que hace falta para que gane
 * la opción — el resto (tabla, helper) ya es genérico.
 */
export const MODULOS_CON_ALCANCE = ["asistencia", "liquidaciones", "caja", "contactos"] as const;
export type ModuloConAlcance = (typeof MODULOS_CON_ALCANCE)[number];

export const ETIQUETA_MODULO: Record<string, string> = {
  alumnos: "Alumnos",
  profesores: "Profesores",
  cursos: "Cursos",
  inscripciones: "Inscripciones",
  asistencia: "Asistencia",
  pagos: "Pagos",
  costos: "Costos",
  particulares: "Particulares",
  inventario: "Inventario",
  caja: "Caja",
  dashboard: "Dashboard",
  usuarios: "Usuarios",
  administracion: "Administración",
  planes: "Planes",
  liquidaciones: "Liquidaciones",
  precios: "Precios y paquetes",
  sala: "Sala y horarios",
  contactos: "Contactos",
  contactos_privados: "Contactos · datos privados",
  solicitudes: "Solicitudes (se usa desde C3-0b)",
  enlaces_captacion: "Enlaces de captación (se usa desde C3-0b)",
};

export const ETIQUETA_ACCION: Record<string, string> = {
  ver: "Ver",
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
};
