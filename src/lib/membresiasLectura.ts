import type { createClient } from "@/lib/supabase/server";
import { exigir } from "@/lib/datos";
import { armarMembresiasCuenta, type FilaParaCuenta, type PagoCobroCrudo } from "@/lib/cuentas";
import { leerAvancesAlCorte } from "@/lib/liquidacion/lecturaAvance";
import { nombreCompleto } from "@/lib/contactos";
import { esSustituto } from "@/lib/fichaMembresia";
import { destinatarioAviso } from "@/lib/venta/destinatarioAviso";
import { destinatarioDeTitular } from "@/lib/destinatarioTitular";
import { solicitudVigente } from "@/lib/reservas";
import { asignacionEnFecha, titularVigente, COLUMNAS_ASIGNACION, type AsignacionVigencia } from "@/lib/asignaciones";
import type { MembresiaCuenta } from "@/lib/tipos";
import {
  banderas,
  chipEstado,
  membresiaVisible,
  siguienteCiclo,
  tipoDeMembresia,
  usoDelCiclo,
  type EntradaCiclo,
  type FilaMembresia,
  type TipoMembresia,
} from "@/lib/listaMembresias";

/**
 * La lectura de la lista y la ficha unificadas (I-012, fase 0). Solo lee: no
 * cambia ningún dato. Todo fallo de lectura se muestra (`exigir`, calidad 1):
 * una membresía que no se pudo leer no se disfraza de «no hay».
 *
 * Reutiliza lo que ya existe en vez de calcular de nuevo:
 * - la cuenta (cuotas, saldo, bonos, cursos, horas) sale de
 *   `armarMembresiasCuenta`, la misma pieza de la cuenta del alumno;
 * - el avance de las clases, de `leerAvancesAlCorte` (la regla de Asistencia).
 *
 * No es "use server": el permiso y el alcance los resuelve la acción que lo
 * llama (`membresias/acciones.ts`), que decide qué tipos entran acá.
 */

type Lector = Awaited<ReturnType<typeof createClient>>;

export type AccesoMembresias = {
  /** Cliente de la sesión: regulares, pruebas y particulares. */
  sb: Lector;
  /** Cliente admin: solo para alquileres, cuyo titular puede ser un contacto que el rol no ve. */
  admin: Lector | null;
  /** Tipos que el rol puede ver (la acción ya validó el permiso de cada uno). */
  tipos: ReadonlySet<TipoMembresia>;
  /** Si el rol ve solo lo propio en particulares: el profesor. */
  profesorIdPropio: number | null;
};

export type ExtensionMembresia = {
  fecha: string;
  horas: number;
  precioTotal: number;
  modoPrecio: string;
};

/** Un pago (cobro) de la membresía, tal como lo muestra la pestaña Pagos. */
export type PagoFicha = {
  id: number;
  cuotaId: number | null;
  fecha: string;
  monto: number;
  descuento: number;
  descuentoMotivo: string | null;
  medio: string | null;
  concepto: string | null;
};

/** Una clase registrada de la membresía (regular o prueba). */
export type ClaseFicha = {
  sesionId: number;
  fecha: string;
  cursoNombre: string;
  /** `dictada` u otro estado de la sesión: solo las dictadas consumen. */
  estadoSesion: string;
  presente: boolean;
  conLicencia: boolean;
  /** Quién dictó (hecho registrado, no inferido). */
  profesorNombre: string | null;
  /** Dictó alguien que no era el titular del curso ese día (asignación); sin asignación, el motivo de reemplazo anotado. */
  sustituto: boolean;
};

/** El titular: puede ser alumno, profesor de la escuela, o una persona u organización sin rol. */
export type TitularFicha = {
  contactoId: number | null;
  rol: "alumno" | "profesor" | "sin_rol";
  esMenor: boolean;
  /** A quién se le avisa: el tutor si es menor, la persona que atiende si es una organización. */
  avisarA: { nombre: string; whatsapp: string | null } | null;
};

/** Precio y categoría de un alquiler (columnas que ya existen en la membresía). */
export type AlquilerFicha = {
  categoria: string;
  categoriaPropuesta: string | null;
  categoriaCambiada: boolean;
  motivo: string | null;
  glosa: string | null;
  personas: number | null;
  ruta: string | null;
  precio: number | null;
};

export type FichaMembresia = {
  fila: FilaMembresia;
  /** La cuenta de esta membresía: cuotas, saldo, cursos con días, faltas, bonos, horas. */
  cuenta: MembresiaCuenta;
  pagos: PagoFicha[];
  /** Vacío en particular y alquiler (no tienen clases: tienen reservas). */
  clases: ClaseFicha[];
  titular: TitularFicha;
  /** El titular de cada curso por asignación (regla 20); vacío en particular y alquiler. */
  profesoresCurso: { curso: string; profesor: string | null; whatsapp: string | null }[];
  /** Solo en alquiler. */
  alquiler: AlquilerFicha | null;
  ciclo: { anteriorId: number | null; siguienteId: number | null };
  /** Vacío hasta que exista `membresia_extensiones` (H6). */
  extensiones: ExtensionMembresia[];
};

type Contacto = { tipo: "persona" | "organizacion"; nombre: string | null; apellido: string | null; razon_social: string | null; whatsapp: string | null };

type FilaBase = FilaParaCuenta & {
  es_prueba: boolean;
  categoria_aplicada: string | null;
  alumno_id: number | null;
  contacto_id: number | null;
  plan_id: number | null;
  membresia_anterior_id: number | null;
  ciclo_numero: number | null;
  profesor_id: number | null;
  categoria_propuesta: string | null;
  categoria_motivo: string | null;
  categoria_glosa: string | null;
  alquiler_personas: number | null;
  alquiler_ruta: string | null;
  precio_aplicado: number | null;
  alumno: { es_menor: boolean; contacto_id: number; contacto: Contacto | null } | null;
  profesor: { contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null } | null;
  titular: Contacto | null;
};

const SELECT =
  "id, estado, es_prueba, curso_id, categoria_aplicada, alumno_id, contacto_id, plan_id, membresia_anterior_id, ciclo_numero, " +
  "fecha_inicio, fecha_fin, clases_plan, clases_total, horas_contratadas, profesor_id, " +
  "categoria_propuesta, categoria_motivo, categoria_glosa, alquiler_personas, alquiler_ruta, precio_aplicado, " +
  "alumno:alumnos(es_menor, contacto_id, contacto:contactos(tipo, nombre, apellido, razon_social, whatsapp)), " +
  "titular:contactos(tipo, nombre, apellido, razon_social, whatsapp), " +
  "profesor:profesores(contacto:contactos(nombre, apellido, whatsapp)), " +
  "plan:planes(nombre, estilo), curso:cursos(nombre, dias_semana)";

const tipoDe = (r: Pick<FilaBase, "es_prueba" | "curso_id" | "categoria_aplicada">) =>
  tipoDeMembresia({ esPrueba: r.es_prueba, cursoId: r.curso_id, categoriaAplicada: r.categoria_aplicada });

const entradaCiclo = (r: FilaCiclo): EntradaCiclo => ({
  id: r.id,
  esPrueba: r.es_prueba,
  cursoId: r.curso_id,
  categoriaAplicada: r.categoria_aplicada,
  alumnoId: r.alumno_id,
  contactoId: r.contacto_id,
  planId: r.plan_id,
  anteriorId: r.membresia_anterior_id,
  fechaInicio: r.fecha_inicio,
});

/** Lo mínimo de una membresía para saber si otra la renueva (sin ninguna relación). */
const SELECT_CICLO =
  "id, es_prueba, curso_id, categoria_aplicada, alumno_id, contacto_id, plan_id, membresia_anterior_id, fecha_inicio, profesor_id";
type FilaCiclo = Pick<
  FilaBase,
  "id" | "es_prueba" | "curso_id" | "categoria_aplicada" | "alumno_id" | "contacto_id" | "plan_id" | "membresia_anterior_id" | "fecha_inicio" | "profesor_id"
>;

/**
 * Las membresías que este acceso puede ver, sin enriquecer (una consulta por
 * lector). Con `id` trae completa solo esa, más —livianas, sin relaciones— las
 * demás: `siguienteCiclo` necesita saber si otra la renueva.
 */
async function leerBase(
  a: AccesoMembresias,
  id?: number
): Promise<{ base: { r: FilaBase; lector: Lector }[]; universo: EntradaCiclo[] }> {
  const grupos: { lector: Lector; alquiler: boolean }[] = [];
  if ([...a.tipos].some((t) => t !== "alquiler")) grupos.push({ lector: a.sb, alquiler: false });
  if (a.tipos.has("alquiler")) {
    if (!a.admin) throw new Error("No se pudo leer los alquileres: falta la clave de servicio.");
    grupos.push({ lector: a.admin, alquiler: true });
  }

  const visible = (r: FilaCiclo) => membresiaVisible(a, { tipo: tipoDe(r), profesorId: r.profesor_id });
  // El tope de filas de la API corta en silencio: una lista truncada mentiría.
  const sinTruncar = (raw: { count: number | null }, n: number) => {
    if (raw.count != null && n < raw.count) throw new Error(`No se pudieron cargar las membresías completas (${n} de ${raw.count}).`);
  };

  const porGrupo = await Promise.all(
    grupos.map(async (g) => {
      const filtrar = <T extends { not: (c: string, o: string, v: null) => T; is: (c: string, v: null) => T }>(q: T) =>
        g.alquiler ? q.not("categoria_aplicada", "is", null) : q.is("categoria_aplicada", null);
      const completa = async () => {
        let q = filtrar(g.lector.from("membresias").select(SELECT, { count: "exact" }));
        if (id != null) q = q.eq("id", id);
        const raw = await q.order("fecha_inicio", { ascending: false }).order("id", { ascending: false });
        const filas = exigir(raw, "las membresías") as unknown as FilaBase[];
        sinTruncar(raw, filas.length);
        return filas;
      };
      const liviana = async () => {
        const raw = await filtrar(g.lector.from("membresias").select(SELECT_CICLO, { count: "exact" }));
        const filas = exigir(raw, "las membresías") as unknown as FilaCiclo[];
        sinTruncar(raw, filas.length);
        return filas;
      };
      const [filas, ciclo] = await Promise.all([completa(), id != null ? liviana() : Promise.resolve(null)]);
      return { g, filas, ciclo };
    })
  );

  const base: { r: FilaBase; lector: Lector }[] = [];
  const universo: EntradaCiclo[] = [];
  for (const { g, filas, ciclo } of porGrupo) {
    for (const r of filas) if (visible(r)) base.push({ r, lector: g.lector });
    if (ciclo) for (const r of ciclo) if (visible(r)) universo.push(entradaCiclo(r));
  }
  if (id == null) universo.push(...base.map((b) => entradaCiclo(b.r)));
  return { base, universo };
}

const nombreDe = (c: { nombre: string | null; apellido: string | null } | null | undefined) =>
  c ? `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim() || null : null;

type ProfesorDeCurso = { cursoId: number; curso: string; profesor: string | null; whatsapp: string | null };

/** Las reservas (estado y vencimiento de la solicitud) de las membresías por horas. */
async function leerReservasDe(lector: Lector, ids: number[]) {
  const porMembresia = new Map<number, { estado: string; solicitadaHasta: string | null }[]>();
  if (!ids.length) return porMembresia;
  const raw = await lector.from("reservas_sala").select("membresia_id, estado, solicitada_hasta").in("membresia_id", ids);
  for (const r of exigir(raw, "las reservas de las membresías") as unknown as {
    membresia_id: number; estado: string; solicitada_hasta: string | null;
  }[]) {
    const l = porMembresia.get(r.membresia_id) ?? [];
    l.push({ estado: r.estado, solicitadaHasta: r.solicitada_hasta });
    porMembresia.set(r.membresia_id, l);
  }
  return porMembresia;
}

/** El tutor de cada menor (por el contacto del menor), con nombre y WhatsApp, como lo muestran Alumnos e Inscripción. */
async function leerTutores(lector: Lector, contactoIdsMenores: number[]) {
  const tutores = new Map<number, { id: number; nombre: string; whatsapp: string | null }>();
  if (!contactoIdsMenores.length) return tutores;
  const raw = await lector
    .from("contacto_relaciones")
    .select("hacia_id, tutor:contactos!contacto_relaciones_desde_id_fkey(id, tipo, nombre, apellido, razon_social, whatsapp)")
    .eq("tipo", "tutor_de")
    .in("hacia_id", contactoIdsMenores);
  for (const r of exigir(raw, "los tutores") as unknown as {
    hacia_id: number;
    tutor: { id: number; tipo: "persona" | "organizacion"; nombre: string | null; apellido: string | null; razon_social: string | null; whatsapp: string | null } | null;
  }[])
    if (r.tutor) tutores.set(r.hacia_id, { id: r.tutor.id, nombre: nombreCompleto(r.tutor), whatsapp: r.tutor.whatsapp });
  return tutores;
}

/**
 * El titular de cada curso de una membresía de curso (regla 20: por
 * asignación vigente, no por quien dictó). `membresia_cursos` dice los cursos;
 * una fila vieja sin ellos cae a su `curso_id`.
 */
async function leerProfesoresDeCursos(lector: Lector, regulares: FilaBase[]): Promise<Map<number, ProfesorDeCurso[]>> {
  const out = new Map<number, ProfesorDeCurso[]>();
  if (!regulares.length) return out;
  const raw = await lector
    .from("membresia_cursos")
    .select("membresia_id, curso_id, curso:cursos(nombre)")
    .in("membresia_id", regulares.map((r) => r.id));
  const cursosDe = new Map<number, { cursoId: number; curso: string }[]>();
  for (const r of exigir(raw, "los cursos de las membresías") as unknown as {
    membresia_id: number; curso_id: number; curso: { nombre: string } | null;
  }[]) {
    const l = cursosDe.get(r.membresia_id) ?? [];
    l.push({ cursoId: r.curso_id, curso: r.curso?.nombre ?? "—" });
    cursosDe.set(r.membresia_id, l);
  }
  for (const r of regulares)
    if (!cursosDe.get(r.id)?.length && r.curso_id != null) cursosDe.set(r.id, [{ cursoId: r.curso_id, curso: r.curso?.nombre ?? "—" }]);

  const cursoIds = [...new Set([...cursosDe.values()].flat().map((c) => c.cursoId))];
  const titularDe = new Map<number, { nombre: string | null; whatsapp: string | null }>();
  if (cursoIds.length) {
    const ra = await lector.from("asignaciones").select(COLUMNAS_ASIGNACION).in("curso_id", cursoIds).is("hasta", null);
    const asignaciones = exigir(ra, "las asignaciones de los cursos") as unknown as AsignacionVigencia[];
    const vigentes = new Map<number, number>();
    for (const cid of cursoIds) {
      const t = titularVigente(asignaciones.filter((x) => x.curso_id === cid));
      if (t) vigentes.set(cid, t.profesor_id);
    }
    const idsProfesores = [...new Set(vigentes.values())];
    const [nombres, whatsapps] = await Promise.all([nombresDeProfesores(lector, idsProfesores), whatsappsDeProfesores(lector, idsProfesores)]);
    for (const cid of cursoIds) {
      const pid = vigentes.get(cid);
      titularDe.set(cid, { nombre: pid != null ? (nombres.get(pid) ?? null) : null, whatsapp: pid != null ? (whatsapps.get(pid) ?? null) : null });
    }
  }
  for (const [mid, cursos] of cursosDe) out.set(mid, cursos.map((c) => ({ ...c, profesor: titularDe.get(c.cursoId)?.nombre ?? null, whatsapp: titularDe.get(c.cursoId)?.whatsapp ?? null })));
  return out;
}

/** El WhatsApp del contacto de cada profesor (el mismo dato que muestra la ficha de una particular). */
async function whatsappsDeProfesores(lector: Lector, ids: number[]): Promise<Map<number, string | null>> {
  const out = new Map<number, string | null>();
  if (!ids.length) return out;
  const rp = await lector.from("profesores").select("id, contacto:contactos(whatsapp)").in("id", ids);
  for (const p of exigir(rp, "los WhatsApp de los profesores") as unknown as { id: number; contacto: { whatsapp: string | null } | null }[])
    out.set(p.id, p.contacto?.whatsapp ?? null);
  return out;
}

async function nombresDeProfesores(lector: Lector, ids: number[]): Promise<Map<number, string | null>> {
  const nombres = new Map<number, string | null>();
  if (!ids.length) return nombres;
  const rp = await lector.from("profesores").select("id, contacto:contactos(nombre, apellido)").in("id", ids);
  for (const p of exigir(rp, "los profesores") as unknown as {
    id: number; contacto: { nombre: string | null; apellido: string | null } | null;
  }[])
    nombres.set(p.id, nombreDe(p.contacto));
  return nombres;
}

/**
 * Las filas de la lista (o solo la de `id`) con todo lo que la lista y la
 * ficha necesitan. Devuelve también la cuenta de cada una, que la ficha usa.
 */
export async function leerFilasMembresias(
  a: AccesoMembresias,
  id?: number
): Promise<{
  filas: FilaMembresia[];
  cuentas: Map<number, MembresiaCuenta>;
  crudas: Map<number, { r: FilaBase; lector: Lector }>;
  pagos: PagoCobroCrudo[];
  cuotas: { id: number; membresia_id: number }[];
  profesoresCurso: Map<number, ProfesorDeCurso[]>;
}> {
  const { base, universo } = await leerBase(a, id);
  const elegidas = id == null ? base : base.filter((b) => b.r.id === id);

  const filas: FilaMembresia[] = [];
  const cuentas = new Map<number, MembresiaCuenta>();
  const crudas = new Map(elegidas.map((e) => [e.r.id, e] as const));
  const pagos: PagoCobroCrudo[] = [];
  const cuotas: { id: number; membresia_id: number }[] = [];
  const profesoresCurso = new Map<number, ProfesorDeCurso[]>();
  const ahora = new Date();

  // Un lote por lector: el de la sesión y, si hay alquileres, el admin.
  for (const lector of new Set(elegidas.map((e) => e.lector))) {
    const grupo = elegidas.filter((e) => e.lector === lector).map((e) => e.r);
    if (!grupo.length) continue;

    const conClases = grupo.filter((r) => {
      const t = tipoDe(r);
      return t === "regular" || t === "prueba";
    });
    const conHoras = grupo.filter((r) => tipoDe(r) === "particular" || tipoDe(r) === "alquiler").map((r) => r.id);
    // El buscador ubica a un menor por su tutor, como en Alumnos.
    const menores = grupo.filter((r) => r.alumno?.es_menor).map((r) => r.alumno!.contacto_id);

    // Las cinco lecturas no dependen una de otra: corren juntas.
    const [armado, avances, reservasPorMembresia, tutores, profesoresPorMembresia] = await Promise.all([
      armarMembresiasCuenta(lector, grupo, async (cuotaIds) => {
        if (!cuotaIds.length) return [];
        const raw = await lector
          .from("pagos")
          .select("id, cuota_id, fecha, monto, descuento, descuento_motivo, medio, motivo")
          .eq("tipo", "cobro")
          .in("cuota_id", cuotaIds);
        return exigir(raw, "los pagos de las membresías") as unknown as PagoCobroCrudo[];
      }),
      leerAvancesAlCorte(
        lector,
        conClases.map((r) => ({ id: r.id, clases_plan: r.clases_plan, clases_total: r.clases_total })),
        "9999-12-31"
      ),
      leerReservasDe(lector, conHoras),
      leerTutores(lector, menores),
      leerProfesoresDeCursos(lector, conClases),
    ]);
    for (const c of armado.membresias) cuentas.set(c.id, c);
    pagos.push(...armado.pagos);
    cuotas.push(...armado.cuotas);
    for (const [k, v] of profesoresPorMembresia) profesoresCurso.set(k, v);

    for (const r of grupo) {
      const tipo = tipoDe(r);
      const cuenta = cuentas.get(r.id)!;
      const siguienteId = siguienteCiclo(entradaCiclo(r), universo);
      const renovada = siguienteId != null;
      const uso = usoDelCiclo({
        tipo,
        avance: avances.get(r.id) ?? null,
        horas: cuenta.horas,
      });
      const reservas = reservasPorMembresia.get(r.id) ?? [];
      const b = banderas({ tipo, estado: r.estado, uso, renovada, saldo: cuenta.saldo, reservas }, ahora);
      const titular = r.alumno?.contacto ?? r.titular;
      const pc = r.profesor?.contacto;
      const delCurso = profesoresPorMembresia.get(r.id) ?? [];
      filas.push({
        id: r.id,
        tipo,
        estado: r.estado,
        chip: chipEstado({ estado: r.estado, renovada, ...b }),
        titular: titular ?? { tipo: "persona", nombre: null, apellido: null, razon_social: null, whatsapp: null },
        titularNombre: nombreCompleto(titular),
        alumnoId: r.alumno_id,
        contactoId: r.contacto_id,
        esMenor: !!r.alumno?.es_menor,
        tutor: r.alumno?.es_menor ? (tutores.get(r.alumno.contacto_id) ?? null) : null,
        planId: r.plan_id,
        planNombre: r.plan?.nombre ?? "—",
        estilo: r.plan?.estilo ?? null,
        cursos: cuenta.cursos.map((c) => c.nombre),
        profesorNombre: pc ? `${pc.nombre ?? ""} ${pc.apellido ?? ""}`.trim() || null : null,
        profesorWhatsapp: pc?.whatsapp ?? null,
        profesoresCurso: delCurso.map((d) => d.profesor).filter((x): x is string => !!x),
        fechaInicio: r.fecha_inicio,
        fechaFin: cuenta.fechaFin,
        cicloNumero: r.ciclo_numero,
        anteriorId: r.membresia_anterior_id,
        siguienteId,
        uso,
        saldo: cuenta.saldo,
        solicitudesVigentes: reservas.filter((x) => x.estado === "solicitada" && solicitudVigente(x.solicitadaHasta, ahora)).length,
        ...b,
      });
    }
  }
  return { filas, cuentas, crudas, pagos, cuotas, profesoresCurso };
}

/** Las clases registradas de una membresía de curso, de la más reciente a la más antigua. */
async function leerClases(lector: Lector, membresiaId: number): Promise<ClaseFicha[]> {
  const raw = await lector
    .from("asistencias")
    .select(
      "estado, con_licencia, sesion:sesiones!inner(id, fecha, estado, curso_id, profesor_id, reemplazo_motivo, curso:cursos(nombre))",
      { count: "exact" }
    )
    .eq("membresia_id", membresiaId);
  const filas = exigir(raw, "las clases de la membresía") as unknown as {
    estado: string;
    con_licencia: boolean;
    sesion: {
      id: number; fecha: string; estado: string; curso_id: number | null; profesor_id: number | null; reemplazo_motivo: string | null;
      curso: { nombre: string } | null;
    };
  }[];
  // El tope de filas de la API corta en silencio: una lista truncada mentiría.
  if (raw.count != null && filas.length < raw.count)
    throw new Error(`No se pudieron cargar las clases completas (${filas.length} de ${raw.count}).`);

  // Quién dictó es un hecho registrado; el sustituto es quien dictó sin ser el titular
  // del curso ese día (asignación, regla 20), no quien tenga un motivo de reemplazo anotado.
  const cursoIds = [...new Set(filas.map((f) => f.sesion.curso_id).filter((x): x is number => x != null))];
  const [asignaciones, nombres] = await Promise.all([
    cursoIds.length
      ? lector.from("asignaciones").select(COLUMNAS_ASIGNACION).in("curso_id", cursoIds)
      : Promise.resolve({ data: [], error: null }),
    nombresDeProfesores(lector, [...new Set(filas.map((f) => f.sesion.profesor_id).filter((x): x is number => x != null))]),
  ]);
  const todas = exigir(asignaciones as never, "las asignaciones de los cursos") as unknown as AsignacionVigencia[];
  const titularEn = (cursoId: number | null, fecha: string) =>
    cursoId == null ? null : asignacionEnFecha(todas.filter((x) => x.curso_id === cursoId), fecha);

  return filas
    .map((f) => ({
      sesionId: f.sesion.id,
      fecha: f.sesion.fecha,
      cursoNombre: f.sesion.curso?.nombre ?? "—",
      estadoSesion: f.sesion.estado,
      presente: f.estado === "presente",
      conLicencia: f.con_licencia,
      profesorNombre: f.sesion.profesor_id != null ? (nombres.get(f.sesion.profesor_id) ?? null) : null,
      sustituto: esSustituto(titularEn(f.sesion.curso_id, f.sesion.fecha)?.profesor_id ?? null, f.sesion.profesor_id, !!f.sesion.reemplazo_motivo),
    }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.sesionId - a.sesionId));
}

/** Quién es el titular y a quién se le avisa (menor → su tutor; organización → quien la atiende). */
async function leerTitular(lector: Lector, r: FilaBase, fila: FilaMembresia): Promise<TitularFicha> {
  const contactoId = r.alumno?.contacto_id ?? r.contacto_id;
  const esMenor = !!r.alumno?.es_menor;
  let rol: TitularFicha["rol"] = r.alumno_id != null ? "alumno" : "sin_rol";
  if (rol === "sin_rol" && contactoId != null) {
    const rp = await lector.from("profesores").select("id").eq("contacto_id", contactoId).limit(1);
    if ((exigir(rp, "el rol del titular") as unknown[]).length) rol = "profesor";
  }
  let avisarA: TitularFicha["avisarA"] = null;
  if (contactoId != null) {
    if (esMenor) {
      avisarA = await destinatarioAviso(lector, {
        contactoId, esMenor, nombre: fila.titularNombre, whatsapp: fila.titular.whatsapp,
      });
    } else if (fila.titular.tipo === "organizacion" && fila.tipo === "alquiler") {
      // El alquiler se lee con el cliente admin (ver `AccesoMembresias.admin`).
      avisarA = await destinatarioDeTitular(lector as unknown as Parameters<typeof destinatarioDeTitular>[0], {
        id: contactoId, nombre: fila.titularNombre, whatsapp: fila.titular.whatsapp,
      });
    } else avisarA = { nombre: fila.titularNombre, whatsapp: fila.titular.whatsapp };
  }
  return { contactoId, rol, esMenor, avisarA };
}

/** La ficha de una membresía, o `null` si no existe o este acceso no la ve. */
export async function leerFichaMembresia(a: AccesoMembresias, id: number): Promise<FichaMembresia | null> {
  const { filas, cuentas, crudas, pagos, cuotas, profesoresCurso } = await leerFilasMembresias(a, id);
  const fila = filas[0];
  const cuenta = cuentas.get(id);
  const cruda = crudas.get(id);
  if (!fila || !cuenta || !cruda) return null;
  const { r, lector } = cruda;

  const cuotaIds = new Set(cuotas.filter((c) => c.membresia_id === id).map((c) => c.id));
  const pagosFicha: PagoFicha[] = pagos
    .filter((p) => p.cuota_id != null && cuotaIds.has(p.cuota_id))
    .map((p) => ({
      id: p.id, cuotaId: p.cuota_id, fecha: p.fecha, monto: Number(p.monto), descuento: Number(p.descuento),
      descuentoMotivo: p.descuento_motivo, medio: p.medio, concepto: p.motivo,
    }))
    .sort((x, y) => (x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : y.id - x.id));

  const conClases = fila.tipo === "regular" || fila.tipo === "prueba";
  const [clases, titular] = await Promise.all([
    conClases ? leerClases(lector, id) : Promise.resolve([] as ClaseFicha[]),
    leerTitular(lector, r, fila),
  ]);

  const alquiler: AlquilerFicha | null =
    fila.tipo === "alquiler" && r.categoria_aplicada
      ? {
          categoria: r.categoria_aplicada,
          categoriaPropuesta: r.categoria_propuesta,
          categoriaCambiada: !!r.categoria_propuesta && r.categoria_propuesta !== r.categoria_aplicada,
          motivo: r.categoria_motivo,
          glosa: r.categoria_glosa,
          personas: r.alquiler_personas,
          ruta: r.alquiler_ruta,
          precio: r.precio_aplicado != null ? Number(r.precio_aplicado) : null,
        }
      : null;

  return {
    fila,
    cuenta,
    pagos: pagosFicha,
    clases,
    titular,
    profesoresCurso: (profesoresCurso.get(id) ?? []).map(({ curso, profesor, whatsapp }) => ({ curso, profesor, whatsapp })),
    alquiler,
    ciclo: { anteriorId: fila.anteriorId, siguienteId: fila.siguienteId },
    extensiones: [],
  };
}
