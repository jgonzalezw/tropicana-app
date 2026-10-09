import type { createClient } from "@/lib/supabase/server";
import { exigir } from "@/lib/datos";
import { armarMembresiasCuenta, type FilaParaCuenta, type PagoCobroCrudo } from "@/lib/cuentas";
import { leerAvancesAlCorte } from "@/lib/liquidacion/lecturaAvance";
import { nombreCompleto } from "@/lib/contactos";
import { destinatarioAviso } from "@/lib/venta/destinatarioAviso";
import { destinatarioDeTitular } from "@/lib/destinatarioTitular";
import { solicitudVigente } from "@/lib/reservas";
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
  /** Hubo reemplazo: `sesiones.reemplazo_motivo` no vacío. */
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
  titular: Contacto | null;
};

const SELECT =
  "id, estado, es_prueba, curso_id, categoria_aplicada, alumno_id, contacto_id, plan_id, membresia_anterior_id, ciclo_numero, " +
  "fecha_inicio, fecha_fin, clases_plan, clases_total, horas_contratadas, profesor_id, " +
  "categoria_propuesta, categoria_motivo, categoria_glosa, alquiler_personas, alquiler_ruta, precio_aplicado, " +
  "alumno:alumnos(es_menor, contacto_id, contacto:contactos(tipo, nombre, apellido, razon_social, whatsapp)), " +
  "titular:contactos(tipo, nombre, apellido, razon_social, whatsapp), " +
  "profesor:profesores(contacto:contactos(nombre, apellido)), " +
  "plan:planes(nombre, estilo), curso:cursos(nombre, dias_semana)";

const tipoDe = (r: FilaBase) =>
  tipoDeMembresia({ esPrueba: r.es_prueba, cursoId: r.curso_id, categoriaAplicada: r.categoria_aplicada });

const entradaCiclo = (r: FilaBase): EntradaCiclo => ({
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

/** Todas las membresías que este acceso puede ver, sin enriquecer (una consulta por lector). */
async function leerBase(a: AccesoMembresias): Promise<{ r: FilaBase; lector: Lector }[]> {
  const grupos: { lector: Lector; alquiler: boolean }[] = [];
  if ([...a.tipos].some((t) => t !== "alquiler")) grupos.push({ lector: a.sb, alquiler: false });
  if (a.tipos.has("alquiler")) {
    if (!a.admin) throw new Error("No se pudo leer los alquileres: falta la clave de servicio.");
    grupos.push({ lector: a.admin, alquiler: true });
  }

  const out: { r: FilaBase; lector: Lector }[] = [];
  for (const g of grupos) {
    let q = g.lector.from("membresias").select(SELECT, { count: "exact" });
    q = g.alquiler ? q.not("categoria_aplicada", "is", null) : q.is("categoria_aplicada", null);
    const raw = await q.order("fecha_inicio", { ascending: false }).order("id", { ascending: false });
    const filas = exigir(raw, "las membresías") as unknown as FilaBase[];
    // El tope de filas de la API corta en silencio: una lista truncada mentiría.
    if (raw.count != null && filas.length < raw.count)
      throw new Error(`No se pudieron cargar las membresías completas (${filas.length} de ${raw.count}).`);
    for (const r of filas) {
      if (!membresiaVisible(a, { tipo: tipoDe(r), profesorId: r.profesor_id })) continue;
      out.push({ r, lector: g.lector });
    }
  }
  return out;
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
}> {
  const base = await leerBase(a);
  const universo = base.map((b) => entradaCiclo(b.r));
  const elegidas = id == null ? base : base.filter((b) => b.r.id === id);

  const filas: FilaMembresia[] = [];
  const cuentas = new Map<number, MembresiaCuenta>();
  const crudas = new Map(elegidas.map((e) => [e.r.id, e] as const));
  const pagos: PagoCobroCrudo[] = [];
  const cuotas: { id: number; membresia_id: number }[] = [];
  const ahora = new Date();

  // Un lote por lector: el de la sesión y, si hay alquileres, el admin.
  for (const lector of new Set(elegidas.map((e) => e.lector))) {
    const grupo = elegidas.filter((e) => e.lector === lector).map((e) => e.r);
    if (!grupo.length) continue;

    const armado = await armarMembresiasCuenta(lector, grupo, async (cuotaIds) => {
      if (!cuotaIds.length) return [];
      const raw = await lector
        .from("pagos")
        .select("id, cuota_id, fecha, monto, descuento, descuento_motivo, medio, motivo")
        .eq("tipo", "cobro")
        .in("cuota_id", cuotaIds);
      return exigir(raw, "los pagos de las membresías") as unknown as PagoCobroCrudo[];
    });
    for (const c of armado.membresias) cuentas.set(c.id, c);
    pagos.push(...armado.pagos);
    cuotas.push(...armado.cuotas);

    const conClases = grupo.filter((r) => {
      const t = tipoDe(r);
      return t === "regular" || t === "prueba";
    });
    const avances = await leerAvancesAlCorte(
      lector,
      conClases.map((r) => ({ id: r.id, clases_plan: r.clases_plan, clases_total: r.clases_total })),
      "9999-12-31"
    );

    const conHoras = grupo.filter((r) => tipoDe(r) === "particular" || tipoDe(r) === "alquiler").map((r) => r.id);
    const reservasPorMembresia = new Map<number, { estado: string; solicitadaHasta: string | null }[]>();
    if (conHoras.length) {
      const raw = await lector.from("reservas_sala").select("membresia_id, estado, solicitada_hasta").in("membresia_id", conHoras);
      for (const r of exigir(raw, "las reservas de las membresías") as unknown as {
        membresia_id: number; estado: string; solicitada_hasta: string | null;
      }[]) {
        const l = reservasPorMembresia.get(r.membresia_id) ?? [];
        l.push({ estado: r.estado, solicitadaHasta: r.solicitada_hasta });
        reservasPorMembresia.set(r.membresia_id, l);
      }
    }

    // El buscador ubica a un menor por el WhatsApp de su tutor, como en Alumnos.
    const menores = grupo.filter((r) => r.alumno?.es_menor).map((r) => r.alumno!.contacto_id);
    const tutores = new Map<number, string | null>();
    if (menores.length) {
      const raw = await lector
        .from("contacto_relaciones")
        .select("hacia_id, tutor:contactos!contacto_relaciones_desde_id_fkey(whatsapp)")
        .eq("tipo", "tutor_de")
        .in("hacia_id", menores);
      for (const r of exigir(raw, "los tutores") as unknown as { hacia_id: number; tutor: { whatsapp: string | null } | null }[])
        tutores.set(r.hacia_id, r.tutor?.whatsapp ?? null);
    }

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
      filas.push({
        id: r.id,
        tipo,
        estado: r.estado,
        chip: chipEstado({ estado: r.estado, renovada, ...b }),
        titular: titular ?? { tipo: "persona", nombre: null, apellido: null, razon_social: null, whatsapp: null },
        titularNombre: nombreCompleto(titular),
        alumnoId: r.alumno_id,
        contactoId: r.contacto_id,
        tutorWhatsapp: r.alumno?.es_menor ? (tutores.get(r.alumno.contacto_id) ?? null) : null,
        planId: r.plan_id,
        planNombre: r.plan?.nombre ?? "—",
        profesorNombre: pc ? `${pc.nombre ?? ""} ${pc.apellido ?? ""}`.trim() || null : null,
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
  return { filas, cuentas, crudas, pagos, cuotas };
}

const nombreDe = (c: { nombre: string | null; apellido: string | null } | null | undefined) =>
  c ? `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim() || null : null;

/** Las clases registradas de una membresía de curso, de la más reciente a la más antigua. */
async function leerClases(lector: Lector, membresiaId: number): Promise<ClaseFicha[]> {
  const raw = await lector
    .from("asistencias")
    .select(
      "estado, con_licencia, sesion:sesiones!inner(id, fecha, estado, profesor_id, reemplazo_motivo, curso:cursos(nombre))",
      { count: "exact" }
    )
    .eq("membresia_id", membresiaId);
  const filas = exigir(raw, "las clases de la membresía") as unknown as {
    estado: string;
    con_licencia: boolean;
    sesion: {
      id: number; fecha: string; estado: string; profesor_id: number | null; reemplazo_motivo: string | null;
      curso: { nombre: string } | null;
    };
  }[];
  // El tope de filas de la API corta en silencio: una lista truncada mentiría.
  if (raw.count != null && filas.length < raw.count)
    throw new Error(`No se pudieron cargar las clases completas (${filas.length} de ${raw.count}).`);

  const profIds = [...new Set(filas.map((f) => f.sesion.profesor_id).filter((x): x is number => x != null))];
  const nombres = new Map<number, string | null>();
  if (profIds.length) {
    const rp = await lector.from("profesores").select("id, contacto:contactos(nombre, apellido)").in("id", profIds);
    for (const p of exigir(rp, "los profesores de las clases") as unknown as {
      id: number; contacto: { nombre: string | null; apellido: string | null } | null;
    }[])
      nombres.set(p.id, nombreDe(p.contacto));
  }

  return filas
    .map((f) => ({
      sesionId: f.sesion.id,
      fecha: f.sesion.fecha,
      cursoNombre: f.sesion.curso?.nombre ?? "—",
      estadoSesion: f.sesion.estado,
      presente: f.estado === "presente",
      conLicencia: f.con_licencia,
      profesorNombre: f.sesion.profesor_id != null ? (nombres.get(f.sesion.profesor_id) ?? null) : null,
      sustituto: !!f.sesion.reemplazo_motivo,
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
  const { filas, cuentas, crudas, pagos, cuotas } = await leerFilasMembresias(a, id);
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
    alquiler,
    ciclo: { anteriorId: fila.anteriorId, siguienteId: fila.siguienteId },
    extensiones: [],
  };
}
