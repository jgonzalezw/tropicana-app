/**
 * La lectura de la pre-liquidación: trae lo que el motor ya sabe calcular y
 * se lo pasa a `armarInforme` (`preliquidacion.ts`, puro). **No escribe nada.**
 *
 * Devuelve **datos completos o el error con qué lectura falló** — nunca una
 * lista vacía por un error (regla de calidad 1, N55 de Design): con una
 * lectura incompleta, un profesor sin devengo o una sección vacía no
 * significarían nada. Por eso las lecturas van en orden y, al primer fallo, las
 * que siguen quedan "sin leer" en vez de seguir con datos a medias.
 *
 * No es `"use server"`: no queda como endpoint, la usa la página.
 */

import { createClient } from "@/lib/supabase/server";
import { obtenerParametro } from "@/lib/sesion";
import { exigir } from "@/lib/datos";
import { isoHoy, rangoEnCurso, rangoLiquidable } from "@/lib/liquidacion/periodo";
import { LIMITES_SIMULACION, simularCierre, simularParticulares } from "@/lib/liquidacion/simulacion";
import { calcularDevengos, type DatosMotor } from "@/lib/liquidacion/motor";
import {
  calcularDescuentos,
  leerDatosMotor,
  leerDatosParticulares,
} from "@/lib/liquidacion/lecturas";
import { calcularDevengosParticulares } from "@/lib/liquidacion/particulares";
import {
  armarInforme,
  type InformePre,
  type LiquidacionExistente,
  type MembresiaSinPlan,
  type SimulacionInfo,
  type SesionCal,
} from "@/lib/liquidacion/preliquidacion";

export type Lectura = { nombre: string; estado: "leido" | "fallo" | "sin_leer"; detalle?: string };

export type ResultadoPre =
  | { ok: true; informe: InformePre; generadoEn: string; lecturas: Lectura[] }
  | { ok: false; lecturas: Lectura[]; error: string };

export const LECTURAS_PRE = [
  "El período a liquidar",
  "Membresías, cobros, asignaciones y clases de cursos regulares",
  "Clases particulares",
  "Reemplazos por descontar",
  "Profesores y planes",
  "Membresías sin plan",
  "Asistencia: clases del calendario hasta hoy",
  "Liquidaciones ya generadas del período",
] as const;

/** Un nombre "Apellido, Nombre" desde la fila anidada de `contactos`. */
type ConContacto = { id: number; contacto: { nombre: string | null; apellido: string | null } | null };
const aPersona = (r: ConContacto) => ({
  id: r.id,
  nombre: r.contacto?.nombre ?? "",
  apellido: r.contacto?.apellido ?? "",
});

const VACIO: DatosMotor = {
  membresias: [], cursosDeMembresia: [], comisionesPrevias: [], cuotas: [], pagos: [],
  sesiones: [], cursos: [], tarifas: [], asignaciones: [], alumnos: [], profesores: [],
};

export type ModoPre = "vencido" | "simulacion";

export async function prepararPreliquidacion(modo: ModoPre = "vencido"): Promise<ResultadoPre> {
  const sb = await createClient();
  const lecturas: Lectura[] = LECTURAS_PRE.map((nombre) => ({ nombre, estado: "sin_leer" }));
  let primerFallo: string | null = null;

  /** Corre la lectura `i`; tras un fallo, las demás quedan "sin leer". */
  async function paso<T>(i: number, fn: () => Promise<T>): Promise<T | undefined> {
    if (primerFallo) return undefined;
    try {
      const v = await fn();
      lecturas[i].estado = "leido";
      return v;
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e);
      lecturas[i] = { nombre: lecturas[i].nombre, estado: "fallo", detalle };
      primerFallo = detalle;
      return undefined;
    }
  }

  const hoyISO = isoHoy();

  // 0. El período: el mismo que usa Liquidaciones (mes vencido) o, en la
  //    simulación (D29), el período EN CURSO que dice el parámetro.
  const rango = await paso(0, async () => {
    const periodicidad = (await obtenerParametro("periodicidad_liquidacion")) || "mes";
    if (modo === "simulacion") {
      const r = rangoEnCurso(periodicidad, new Date());
      if (!r.ok) throw new Error(r.error);
      const simulacion: SimulacionInfo = {
        periodicidad: r.periodicidad,
        alFecha: hoyISO,
        desdeISO: r.desdeISO,
        limites: [...LIMITES_SIMULACION],
      };
      return { periodoVencido: r.periodo, hastaISO: r.hastaISO, simulacion };
    }
    const r = rangoLiquidable(periodicidad);
    if (!r.ok) throw new Error(r.error);
    return { periodoVencido: r.periodoVencido, hastaISO: r.hastaISO, simulacion: undefined };
  });
  if (!rango) return { ok: false, lecturas, error: primerFallo ?? "No se pudo determinar el período." };

  // 1. Regulares: las mismas filas y el mismo cálculo que `generarLiquidacion`.
  const regular = await paso(1, async () => {
    const leidos = (await leerDatosMotor(sb, rango.hastaISO)) ?? VACIO;
    const datos = rango.simulacion && leidos !== VACIO ? simularCierre(leidos, hoyISO, rango.hastaISO) : leidos;
    const calculo = datos === VACIO ? { pendientes: [], bloqueadas: [] } : calcularDevengos(datos, rango.hastaISO);
    return { datos, ...calculo };
  });

  // 2. Particulares.
  const particulares = await paso(2, async () => {
    const leidos = await leerDatosParticulares(sb);
    const datos = leidos && rango.simulacion ? simularParticulares(leidos, hoyISO, rango.hastaISO) : leidos;
    const calculo = datos
      ? calcularDevengosParticulares(datos, {
          hastaISO: rango.hastaISO,
          periodoVencido: rango.periodoVencido,
          // Simulado, "hoy" es el fin del período: lo que vence adentro cuenta como vencido.
          hoyISO: rango.simulacion ? rango.hastaISO : hoyISO,
        })
      : { pendientes: [], bloqueadas: [] };
    return { datos, ...calculo };
  });

  // 3. Reemplazos que descuentan (regla 20a).
  const descuentos = await paso(3, () => calcularDescuentos(sb, rango.hastaISO));

  // 4. Todos los profesores (el que cobra una particular puede no dictar ningún
  //    curso regular) y los planes, para poner su nombre en cada línea.
  const maestros = await paso(4, async () => {
    const profs = exigir(
      await sb.from("profesores").select("id, contacto:contactos(nombre, apellido)"),
      "los profesores"
    ) as unknown as ConContacto[];
    const planes = exigir(await sb.from("planes").select("id, nombre"), "los planes") as {
      id: number;
      nombre: string;
    }[];
    return { profesores: profs.map(aPersona), planes };
  });

  // 5. Membresías sin plan: el motor ni siquiera las lee.
  const sinPlan = await paso(5, async (): Promise<MembresiaSinPlan[]> => {
    const filas = exigir(
      await sb
        .from("membresias")
        .select("id, alumno_id, fecha_inicio, estado, curso_id, alumno:alumnos(contacto:contactos(nombre, apellido))")
        .is("plan_id", null)
        .in("estado", ["activa", "completada"]),
      "las membresías sin plan"
    ) as unknown as {
      id: number;
      alumno_id: number;
      fecha_inicio: string;
      estado: string;
      curso_id: number | null;
      alumno: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
    }[];
    const cursoIds = [...new Set(filas.map((f) => f.curso_id).filter((x): x is number => x != null))];
    const cursos = cursoIds.length
      ? (exigir(await sb.from("cursos").select("id, nombre").in("id", cursoIds), "los cursos") as {
          id: number;
          nombre: string;
        }[])
      : [];
    const nombreCurso = new Map(cursos.map((c) => [c.id, c.nombre]));
    return filas.map((f) => ({
      id: f.id,
      alumnoId: f.alumno_id,
      alumno: `${f.alumno?.contacto?.apellido ?? ""}, ${f.alumno?.contacto?.nombre ?? ""}`,
      curso: f.curso_id != null ? nombreCurso.get(f.curso_id) ?? `#${f.curso_id}` : "—",
      fecha_inicio: f.fecha_inicio,
      estado: f.estado,
    }));
  });

  // 6. Las clases del calendario hasta HOY (el motor las trae solo hasta el
  //    corte, y las de después del corte también cuentan para saber qué falta).
  const sesionesCal = await paso(6, async (): Promise<SesionCal[]> => {
    const datos = regular!.datos;
    if (!datos.membresias.length) return [];
    const cursoIds = [
      ...new Set(datos.cursosDeMembresia.map((r) => r.curso_id).concat(datos.membresias.map((m) => m.curso_id))),
    ];
    const desde = datos.membresias.map((m) => m.fecha_inicio).sort()[0];
    const r = await sb
      .from("sesiones")
      .select("curso_id, fecha, estado", { count: "exact" })
      .in("curso_id", cursoIds)
      .gte("fecha", desde)
      .lte("fecha", hoyISO);
    const filas = exigir(r, "las clases del calendario") as SesionCal[];
    // El tope de filas de la API corta en silencio: una lectura truncada diría
    // que faltan clases que sí están registradas.
    if (r.count != null && filas.length < r.count)
      throw new Error(`No se pudieron cargar las clases del calendario completas (${filas.length} de ${r.count}).`);
    return filas;
  });

  // 7. Si ya hay liquidaciones de ese período, se avisa (no se mezclan).
  const existentes = await paso(7, async (): Promise<LiquidacionExistente[]> => {
    const liqs = exigir(
      await sb
        .from("liquidaciones")
        .select("id, estado, neto, profesor:profesores(contacto:contactos(nombre, apellido))")
        .eq("periodo", rango.periodoVencido)
        .order("id"),
      "las liquidaciones del período"
    ) as unknown as {
      id: number;
      estado: string;
      neto: number;
      profesor: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
    }[];
    return liqs.map((l) => ({
      id: l.id,
      estado: l.estado,
      total: Number(l.neto),
      profesor: `${l.profesor?.contacto?.apellido ?? ""}, ${l.profesor?.contacto?.nombre ?? ""}`,
    }));
  });

  if (primerFallo || !regular || !particulares || !descuentos || !maestros || !sinPlan || !sesionesCal || !existentes)
    return { ok: false, lecturas, error: primerFallo ?? "Faltó leer algún dato del período." };

  const informe = armarInforme({
    simulacion: rango.simulacion,
    datos: regular.datos,
    periodoVencido: rango.periodoVencido,
    hastaISO: rango.hastaISO,
    hoyISO,
    pendientes: regular.pendientes,
    bloqueadas: regular.bloqueadas,
    particulares: { pendientes: particulares.pendientes, bloqueadas: particulares.bloqueadas },
    datosParticulares: particulares.datos,
    descuentos,
    profesores: maestros.profesores,
    planes: maestros.planes,
    membresiasSinPlan: sinPlan,
    sesionesCal,
    existentes,
  });
  return { ok: true, informe, generadoEn: new Date().toISOString(), lecturas };
}
