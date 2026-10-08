/**
 * El informe de pre-liquidación (solo lectura): qué se devengaría a cada
 * profesor si se liquidara hoy el período vencido, qué quedó afuera y por qué,
 * y qué clases siguen sin registrar.
 *
 * **No calcula plata nueva.** Recibe lo que ya calcularon el motor
 * (`calcularDevengos`), el de particulares y los descuentos, y lo ordena para
 * leerlo. Lo único que decide solo es lo que el motor descarta en silencio
 * —`continue` sin dejar rastro— y que el informe tiene que decir con todas las
 * letras: las excepciones y las clases sin registrar (regla de calidad 1: un
 * fallo, o un descarte, nunca se disfraza de ausencia).
 *
 * Sin base de datos, para poder fijarlo con pruebas deterministas.
 */

import { asignacionEnFecha } from "../asignaciones.ts";
import { enVigencia } from "../vigencia.ts";
import { diaIso, isoFecha } from "../inscripcion.ts";
import { compararPorApellido } from "../texto.ts";
import { cobroPorMembresia } from "./cobro.ts";
import { armarLineas, type ContextoLineas, type LineaParticular, type LineaRegular } from "./lineas.ts";
import type {
  DatosMotor,
  DevengoPendiente,
  MembresiaBloqueada,
  MembresiaLiq,
  PersonaLiq,
} from "./motor.ts";
import {
  horasDadas,
  situacionParticular,
  type DatosParticulares,
  type DevengoParticular,
  type ParticularBloqueada,
} from "./particulares.ts";

// ── Lo que recibe ────────────────────────────────────────────────────────

/** Un descuento por reemplazo todavía no liquidado (regla 20a). */
export type DescuentoPre = {
  profesorId: number;
  monto: number;
  curso: string;
  fecha: string;
  reemplazante: string;
};

export type SesionCal = { curso_id: number; fecha: string; estado: string };

export type MembresiaSinPlan = {
  id: number;
  alumnoId: number;
  alumno: string;
  curso: string;
  fecha_inicio: string;
  estado: string;
};

export type LiquidacionExistente = {
  id: number;
  profesor: string;
  estado: string;
  total: number;
};

/** Rótulo de una pre-liquidación simulada (D29): ausente = el informe real. */
export type SimulacionInfo = {
  periodicidad: "mes" | "semana";
  /** El día en que se corrió la simulación. */
  alFecha: string;
  desdeISO: string;
  limites: string[];
};

export type EntradaPre = {
  simulacion?: SimulacionInfo;
  /** Lo que leyó el motor regular, tal cual. */
  datos: DatosMotor;
  periodoVencido: string;
  hastaISO: string;
  hoyISO: string;
  pendientes: DevengoPendiente[];
  bloqueadas: MembresiaBloqueada[];
  particulares: { pendientes: DevengoParticular[]; bloqueadas: ParticularBloqueada[] };
  /**
   * Las filas con que se calcularon las particulares. Hacen falta aparte porque
   * `calcularDevengosParticulares` descarta en silencio (`continue`) las que no
   * están cobradas o no se completaron, y el informe tiene que decirlo.
   */
  datosParticulares?: DatosParticulares | null;
  descuentos: DescuentoPre[];
  /** Todos los profesores: el nombre de quien cobra puede no estar en `datos`. */
  profesores: PersonaLiq[];
  planes: { id: number; nombre: string }[];
  membresiasSinPlan: MembresiaSinPlan[];
  /** Las clases (con o sin asistencia) hasta hoy, para ver cuáles faltan. */
  sesionesCal: SesionCal[];
  existentes: LiquidacionExistente[];
  /** Cuenta, bonos, criterio y ciclo de las membresías (decoran las líneas estándar). */
  contexto?: ContextoLineas;
  /**
   * Solo en la simulación: lo que ya se le debe a cada profesor de
   * liquidaciones anteriores (devengado − descuentos − pagado) y lo que se
   * debe hoy a suplentes. Con esto sale la cifra de liquidez.
   */
  saldos?: { previos: SaldoPrevio[]; reemplazos: number };
};

export type SaldoPrevio = { profesorId: number; saldo: number };

/** La plata que hay que tener al cierre (D29). Por profesor y con piso 0. */
export type LiquidezPre = {
  total: number;
  devengo: number;
  saldoPrevio: number;
  reemplazos: number;
  /** Profesores con deuda previa y sin devengo en el período. */
  soloSaldo: number;
};

// ── Lo que devuelve ──────────────────────────────────────────────────────

/** Reemplazo o ajuste: va aparte del subtotal, con su signo (regla 20a / 0044). */
export type AjustePre = { titulo: string; detalle: string; monto: number };

export type ProfesorPre = {
  profesorId: number;
  nombre: string;
  membresias: number;
  cursos: string[];
  /** Las líneas estándar de la liquidación (`lineas.ts`), iguales en todo flujo. */
  regulares: LineaRegular[];
  particulares: LineaParticular[];
  /** Comisiones (sin reemplazos ni ajustes). */
  subtotal: number;
  extras: AjustePre[];
  neto: number;
  /** Solo en la simulación: saldo sin pagar de liquidaciones anteriores y neto + saldo. */
  saldoPrevio?: number;
  aPagar?: number;
};

export type MotivoClave =
  | "sin_plan"
  | "sin_titular"
  | "bloqueada_clases"
  | "particular_bloqueada"
  | "saldo"
  | "ciclo_posterior";

export type CasoExcepcion = {
  persona: string;
  curso: string | null;
  detalle: string;
  /** A dónde se arregla (o se mira, en `ciclo_posterior`). */
  href: string;
  accion: "Resolver" | "Ver membresía";
  membresiaId: number | null;
};

export type MotivoExcepcion = { clave: MotivoClave; titulo: string; casos: CasoExcepcion[] };

export type ClaseSinRegistrar = {
  cursoId: number;
  curso: string;
  fecha: string;
  alumnosEsperados: number;
  traba: boolean;
  /** Por qué traba o no (texto listo para mostrar). */
  motivo: string;
};

export type InformePre = {
  simulacion?: SimulacionInfo;
  periodoVencido: string;
  hastaISO: string;
  profesores: ProfesorPre[];
  resumen: {
    total: number;
    comisiones: number;
    extras: number;
    profesoresConDevengo: number;
    membresiasQueEntran: number;
    membresiasConExcepcion: number;
  };
  excepciones: MotivoExcepcion[];
  clases: {
    vencidas: ClaseSinRegistrar[];
    proximas: ClaseSinRegistrar[];
    sinAlumnos: ClaseSinRegistrar[];
  };
  existentes: LiquidacionExistente[];
  /** Solo en la simulación. */
  liquidez?: LiquidezPre;
};

export const TITULOS_MOTIVO: Record<MotivoClave, string> = {
  sin_plan: "Membresía sin plan o sin criterio de liquidación",
  sin_titular: "Curso sin titular en esa fecha",
  bloqueada_clases: "Bloqueada por clases sin registrar",
  particular_bloqueada: "Clase particular bloqueada",
  saldo: "Saldo pendiente",
  ciclo_posterior: "Ciclo que termina después del corte",
};
const ORDEN_MOTIVOS: MotivoClave[] = [
  "sin_plan",
  "sin_titular",
  "bloqueada_clases",
  "particular_bloqueada",
  "saldo",
  "ciclo_posterior",
];

// ── Utilidades ───────────────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;
const nombreDe = (p: { nombre: string; apellido: string }) => `${p.apellido}, ${p.nombre}`;

/** "2026-09-28" → "28/09" (corto, para listas de fechas). */
export function diaMes(fechaISO: string): string {
  return `${fechaISO.slice(8, 10)}/${fechaISO.slice(5, 7)}`;
}

/** Cada fecha ISO desde `a` hasta `b`, ambas inclusive. Tope de 400 como el motor. */
function fechasEntre(a: string, b: string): string[] {
  const out: string[] = [];
  const d = new Date(a + "T00:00:00");
  const fin = new Date(b + "T00:00:00");
  for (let i = 0; i < 400 && d <= fin; i++, d.setDate(d.getDate() + 1)) out.push(isoFecha(d));
  return out;
}

const HREF = {
  precios: "/precios",
  planes: "/planes",
  profesores: "/profesores",
  asistencia: "/asistencia",
  caja: "/caja",
  cuenta: (alumnoId: number) => `/alumnos/${alumnoId}/cuenta`,
};

// ── Excepciones ──────────────────────────────────────────────────────────

/** Los cursos de cada membresía; el curso "principal" es solo respaldo de filas viejas. */
function cursosPorMembresia(datos: DatosMotor): Map<number, { curso_id: number; dias: number[] | null; fecha: string | null }[]> {
  const m = new Map<number, { curso_id: number; dias: number[] | null; fecha: string | null }[]>();
  for (const r of datos.cursosDeMembresia) {
    const ya = m.get(r.membresia_id) ?? [];
    ya.push({ curso_id: r.curso_id, dias: r.dias, fecha: r.fecha });
    m.set(r.membresia_id, ya);
  }
  for (const mb of datos.membresias)
    if (!m.has(mb.id)) m.set(mb.id, [{ curso_id: mb.curso_id, dias: null, fecha: null }]);
  return m;
}

type RazonDescarte = "sin_criterio" | "ciclo_posterior" | "sin_agotar" | "saldo" | null;

/**
 * Por qué el motor **no** devengó una membresía regular, o `null` si entra (o
 * ya está devengada, o está bloqueada por clases: eso lo dice `bloqueadas`).
 * Los mismos filtros, en el mismo orden, que `calcularDevengos`.
 */
export function razonDeDescarte(
  m: MembresiaLiq,
  ctx: { hastaISO: string; saldo: number; yaDevengada: boolean; simulada?: boolean }
): RazonDescarte {
  const criterio = m.criterio_liquidacion ?? null;
  if (criterio == null) return "sin_criterio";
  if (criterio !== 1 && criterio !== 2 && criterio !== 3) return "sin_criterio"; // 4 y 5 son de taller
  if (ctx.yaDevengada) return null;
  const estado = m.estado ?? "completada";
  const terminaDespues = m.fecha_fin != null && m.fecha_fin > ctx.hastaISO;
  if (criterio === 1 && terminaDespues) return "ciclo_posterior";
  if (criterio === 3 && estado !== "completada" && terminaDespues) return "ciclo_posterior";
  // Simulado, «activa» con el fin dentro del período solo puede deberse a la
  // plata (la simulación ya da por dictadas las clases que faltan).
  if (ctx.simulada && estado === "activa" && ctx.saldo > 0) return "saldo";
  if (criterio === 2 ? estado !== "activa" && estado !== "completada" : estado !== "completada") return "sin_agotar";
  if (ctx.saldo > 0) return "saldo";
  return null;
}

/** El calendario de clases de cada curso, con quién esperaba y qué se registró. */
type FilaCalendario = {
  cursoId: number;
  curso: string;
  fecha: string;
  /** Membresías que tenían clase ese día. */
  esperadas: { id: number; alumno: string; multiCurso: boolean }[];
  sesion: SesionCal | null;
  titular: boolean;
};

function calendarioDeClases(e: EntradaPre): FilaCalendario[] {
  const { datos } = e;
  const cursosDe = cursosPorMembresia(datos);
  const cursoPor = new Map(datos.cursos.map((c) => [c.id, c]));
  const alumnoPor = new Map(datos.alumnos.map((a) => [a.id, nombreDe(a)]));
  const sesionPor = new Map(e.sesionesCal.map((s) => [`${s.curso_id}|${s.fecha}`, s]));
  const asigPor = new Map<number, typeof datos.asignaciones>();
  for (const a of datos.asignaciones) asigPor.set(a.curso_id, [...(asigPor.get(a.curso_id) ?? []), a]);

  // Solo las membresías que todavía pesan: las activas, o las que terminaron
  // desde el período vencido en adelante. Más atrás ya no hay nada que corregir.
  const relevantes = datos.membresias.filter(
    (m) => m.estado === "activa" || (m.fecha_fin != null && m.fecha_fin >= e.periodoVencido)
  );
  if (!relevantes.length) return [];
  const desde = relevantes.map((m) => m.fecha_inicio).sort()[0];
  const cursoIds = new Set<number>();
  for (const m of relevantes) for (const ic of cursosDe.get(m.id) ?? []) cursoIds.add(ic.curso_id);

  const filas: FilaCalendario[] = [];
  for (const cursoId of [...cursoIds].sort((a, b) => a - b)) {
    const curso = cursoPor.get(cursoId);
    if (!curso || !curso.dias_semana?.length) continue;
    for (const fecha of fechasEntre(desde, e.hoyISO)) {
      if (!curso.dias_semana.includes(diaIso(new Date(fecha + "T00:00:00")))) continue;
      if (!enVigencia(curso, fecha)) continue;
      const esperadas: FilaCalendario["esperadas"] = [];
      for (const m of relevantes) {
        const ic = (cursosDe.get(m.id) ?? []).find((x) => x.curso_id === cursoId);
        if (!ic) continue;
        const cae = ic.fecha
          ? ic.fecha === fecha
          : m.fecha_fin != null &&
            fecha >= m.fecha_inicio &&
            fecha <= m.fecha_fin &&
            (!ic.dias?.length || ic.dias.includes(diaIso(new Date(fecha + "T00:00:00"))));
        if (cae)
          esperadas.push({
            id: m.id,
            alumno: alumnoPor.get(m.alumno_id) ?? `#${m.alumno_id}`,
            multiCurso: (cursosDe.get(m.id) ?? []).length >= 2,
          });
      }
      filas.push({
        cursoId,
        curso: curso.nombre,
        fecha,
        esperadas,
        sesion: sesionPor.get(`${cursoId}|${fecha}`) ?? null,
        titular: asignacionEnFecha(asigPor.get(cursoId) ?? [], fecha) != null,
      });
    }
  }
  return filas;
}

/** Las clases sin registrar, en los tres bloques del informe (por curso y fecha). */
export function clasesSinRegistrar(e: EntradaPre): InformePre["clases"] {
  const out: InformePre["clases"] = { vencidas: [], proximas: [], sinAlumnos: [] };
  for (const f of calendarioDeClases(e)) {
    if (f.sesion) continue; // registrada: con asistencia o suspendida
    const n = f.esperadas.length;
    const multi = f.esperadas.filter((x) => x.multiCurso);
    const fila: ClaseSinRegistrar = {
      cursoId: f.cursoId,
      curso: f.curso,
      fecha: f.fecha,
      alumnosEsperados: n,
      traba: false,
      motivo: "",
    };
    if (f.fecha >= e.hoyISO) {
      fila.motivo = "aún no vencida";
      out.proximas.push(fila);
    } else if (n === 0) {
      fila.motivo = "no existe para nadie";
      out.sinAlumnos.push(fila);
    } else if (multi.length) {
      fila.traba = true;
      fila.motivo = `${multi.map((x) => x.alumno).join("; ")} · membresía de varios cursos`;
      out.vencidas.push(fila);
    } else {
      fila.motivo = "solo membresías de un curso";
      out.vencidas.push(fila);
    }
  }
  const orden = (a: ClaseSinRegistrar, b: ClaseSinRegistrar) =>
    a.fecha.localeCompare(b.fecha) || a.curso.localeCompare(b.curso, "es");
  out.vencidas.sort(orden);
  out.proximas.sort(orden);
  out.sinAlumnos.sort(orden);
  return out;
}

const EPS = 0.005;

/**
 * Las clases particulares que **no entran** y por qué. Espeja los `continue` de
 * `calcularDevengosParticulares` (mismo orden), sin recalcular plata:
 *  - cobrada < 100%: no entra con ningún criterio (regla 1) → **saldo pendiente**;
 *  - criterio 1 o 3 sin completar (horas por dar y vigencia sin vencer) o criterio 1
 *    que se completa después del corte → **ciclo posterior**;
 *  - cortesía entera: no devenga por decisión (no es excepción);
 *  - ya devengada y sin diferencia: nada que mostrar.
 * Las que no se pueden calcular (falta un dato de la venta) ya vienen en `bloqueadas`.
 */
export function excepcionesParticulares(e: EntradaPre): { motivo: MotivoClave; caso: CasoExcepcion }[] {
  const datos = e.datosParticulares;
  if (!datos) return [];
  const bloqueadas = new Set(e.particulares.bloqueadas.map((b) => b.membresiaId));
  const entran = new Set(e.particulares.pendientes.map((p) => p.membresiaId));
  const out: { motivo: MotivoClave; caso: CasoExcepcion }[] = [];
  for (const m of datos.membresias) {
    if (m.es_cortesia || bloqueadas.has(m.id) || entran.has(m.id)) continue;
    const criterio = m.criterio_liquidacion;
    if (criterio !== 1 && criterio !== 2 && criterio !== 3) continue; // ya figura en `bloqueadas`
    const reservas = datos.reservas.filter((r) => r.membresia_id === m.id);
    const saldo = datos.saldo[m.id] ?? 0;
    const sit = situacionParticular(m, reservas, saldo, e.hoyISO);
    const yaDevengo = datos.previas.some((p) => p.membresia_id === m.id);
    const base = { persona: m.alumno, curso: "Clase particular", membresiaId: m.id };
    if (saldo > EPS) {
      out.push({
        motivo: "saldo",
        caso: {
          ...base, href: HREF.caja, accion: "Resolver",
          detalle: `Vendida pero no cobrada: faltan Bs. ${r2(saldo).toFixed(2)}. No entra hasta cobrarla al 100%.`,
        },
      });
      continue;
    }
    if (yaDevengo) continue; // sin diferencia que mostrar
    const fin = m.fecha_fin ? diaMes(m.fecha_fin) : null;
    if (criterio === 2) continue; // cobrada y sin avance nuevo: nada que decir
    if (!sit.completa || !sit.fechaCompletada) {
      out.push({
        motivo: "ciclo_posterior",
        caso: {
          ...base, href: "/particulares", accion: "Ver membresía",
          detalle: `Aún en curso (${horasDadas(reservas, e.hastaISO)} de ${m.horas_contratadas} h dadas${fin ? `, vigente hasta el ${fin}` : ""}): entra cuando se consuman sus horas o venza.`,
        },
      });
    } else if (criterio === 1 && sit.fechaCompletada > e.hastaISO) {
      out.push({
        motivo: "ciclo_posterior",
        caso: {
          ...base, href: "/particulares", accion: "Ver membresía",
          detalle: `Se completa el ${diaMes(sit.fechaCompletada)}: entra en la pre-liquidación del período siguiente.`,
        },
      });
    }
  }
  return out;
}

/** Los seis motivos, siempre presentes (un motivo sin casos sigue ahí, vacío). */
export function armarExcepciones(e: EntradaPre): MotivoExcepcion[] {
  const { datos } = e;
  const casos: Record<MotivoClave, CasoExcepcion[]> = {
    sin_plan: [], sin_titular: [], bloqueada_clases: [], particular_bloqueada: [], saldo: [], ciclo_posterior: [],
  };
  const alumnoPor = new Map(datos.alumnos.map((a) => [a.id, nombreDe(a)]));
  const cursoNombre = new Map(datos.cursos.map((c) => [c.id, c.nombre]));
  const cursosDe = cursosPorMembresia(datos);
  const cursosTexto = (id: number) =>
    (cursosDe.get(id) ?? []).map((c) => cursoNombre.get(c.curso_id) ?? `#${c.curso_id}`).join(", ") || null;

  // 1. Sin plan: ni siquiera entran a la lectura del motor.
  for (const m of e.membresiasSinPlan)
    casos.sin_plan.push({
      persona: m.alumno,
      curso: m.curso,
      detalle: `Membresía del ${diaMes(m.fecha_inicio)} (${m.estado}) sin plan: no tiene criterio de liquidación.`,
      href: HREF.precios,
      accion: "Resolver",
      membresiaId: m.id,
    });

  // 3. Bloqueadas por clases sin registrar (las que dice el motor).
  for (const b of e.bloqueadas)
    casos.bloqueada_clases.push({
      persona: b.alumno,
      curso: b.cursos.map((c) => c.curso).join(", "),
      detalle:
        "Faltan registrar: " +
        b.cursos.map((c) => `${c.curso} (${c.fechas.map(diaMes).join(", ")})`).join("; ") +
        ". Con varios cursos el conteo reparte la plata (regla 17).",
      href: HREF.asistencia,
      accion: "Resolver",
      membresiaId: b.membresiaId,
    });

  // 4. Particulares que el cálculo no pudo liquidar, con su motivo.
  for (const b of e.particulares.bloqueadas)
    casos.particular_bloqueada.push({
      persona: b.alumno,
      curso: "Clase particular",
      detalle: b.motivo,
      href: HREF.precios,
      accion: "Resolver",
      membresiaId: b.membresiaId,
    });

  // 1, 3, 5, 6. Lo que el motor descarta en silencio, membresía por membresía.
  const { saldo } = cobroPorMembresia(datos.cuotas, datos.pagos);
  const devengadas = new Set(datos.comisionesPrevias.map((c) => c.membresia_id).filter((x): x is number => x != null));
  const planNombre = new Map(e.planes.map((p) => [p.id, p.nombre]));
  for (const m of datos.membresias) {
    const razon = razonDeDescarte(m, {
      hastaISO: e.hastaISO,
      saldo: saldo[m.id] ?? 0,
      yaDevengada: devengadas.has(m.id),
      simulada: !!e.simulacion,
    });
    if (!razon) continue;
    const persona = alumnoPor.get(m.alumno_id) ?? `#${m.alumno_id}`;
    const curso = cursosTexto(m.id);
    const plan = m.plan_id != null ? planNombre.get(m.plan_id) ?? `plan #${m.plan_id}` : "sin plan";
    if (razon === "sin_criterio")
      casos.sin_plan.push({
        persona, curso, membresiaId: m.id, href: HREF.planes, accion: "Resolver",
        detalle: `El plan "${plan}" no tiene un criterio de liquidación válido para cursos regulares.`,
      });
    else if (razon === "ciclo_posterior")
      casos.ciclo_posterior.push({
        persona, curso, membresiaId: m.id, href: HREF.cuenta(m.alumno_id), accion: "Ver membresía",
        detalle:
          `Su ciclo termina el ${diaMes(m.fecha_fin ?? "")}: entra en la pre-liquidación del período siguiente.` +
          ((cursosDe.get(m.id)?.length ?? 0) >= 2
            ? ` Membresía de ${cursosDe.get(m.id)!.length} cursos (${curso}): se prorratea y exige las clases registradas.`
            : ""),
      });
    else if (razon === "sin_agotar")
      casos.bloqueada_clases.push({
        persona, curso, membresiaId: m.id, href: HREF.asistencia, accion: "Resolver",
        detalle: `Su ciclo ${(m.fecha_fin ?? "") > e.hoyISO ? "termina" : "terminó"} el ${diaMes(m.fecha_fin ?? "")} pero la membresía sigue activa: faltan clases por registrar o cobrar para que figure completada.`,
      });
    else
      casos.saldo.push({
        persona, curso, membresiaId: m.id, href: HREF.caja, accion: "Resolver",
        detalle: `Vendida pero no cobrada: faltan Bs. ${r2(saldo[m.id] ?? 0).toFixed(2)}. No entra hasta cobrarla al 100%.`,
      });
  }

  // 1b. Las particulares que el cálculo descartó sin decir nada.
  for (const c of excepcionesParticulares(e)) casos[c.motivo].push(c.caso);

  // 2. Curso sin titular ese día (la clase no se le paga a nadie, regla 10).
  const sinTitular = new Map<string, { curso: string; fecha: string; cursoId: number; alumnos: string[] }>();
  for (const f of calendarioDeClases(e)) {
    if (f.titular || !f.esperadas.length || f.sesion?.estado === "suspendida") continue;
    sinTitular.set(`${f.cursoId}|${f.fecha}`, {
      curso: f.curso, fecha: f.fecha, cursoId: f.cursoId, alumnos: f.esperadas.map((x) => x.alumno),
    });
  }
  for (const s of [...sinTitular.values()].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.curso.localeCompare(b.curso, "es")))
    casos.sin_titular.push({
      persona: s.alumnos.join("; "),
      curso: s.curso,
      membresiaId: null,
      href: HREF.profesores,
      accion: "Resolver",
      detalle: `${s.curso} no tenía titular asignado el ${diaMes(s.fecha)}: esa clase no se le paga a nadie.`,
    });

  return ORDEN_MOTIVOS.map((clave) => ({ clave, titulo: TITULOS_MOTIVO[clave], casos: casos[clave] }));
}

// ── Por profesor ─────────────────────────────────────────────────────────

const CONTEXTO_VACIO: ContextoLineas = { cuentas: {}, bonos: {}, criterios: {}, ciclos: {}, previas: [], yaLiquidadas: [] };

export function armarProfesores(e: EntradaPre): ProfesorPre[] {
  const persona = new Map(e.profesores.map((p) => [p.id, p]));
  const bloques = new Map<number, ProfesorPre>();
  const bloque = (id: number): ProfesorPre => {
    let b = bloques.get(id);
    if (!b) {
      const p = persona.get(id);
      b = {
        profesorId: id, nombre: p ? nombreDe(p) : `#${id}`, membresias: 0, cursos: [],
        regulares: [], particulares: [], subtotal: 0, extras: [], neto: 0,
      };
      bloques.set(id, b);
    }
    return b;
  };

  // Un ajuste por recálculo no es una línea: va aparte, con su signo.
  const regPorProf = new Map<number, DevengoPendiente[]>();
  for (const p of e.pendientes) {
    const b = bloque(p.profesorId);
    if (p.tipo === "ajuste") {
      b.extras.push({
        titulo: "Ajuste por recálculo",
        detalle: `${p.alumno} · ${p.curso}: lo ya liquidado no se reescribe, esta línea es la diferencia.`,
        monto: p.monto,
      });
      continue;
    }
    regPorProf.set(p.profesorId, [...(regPorProf.get(p.profesorId) ?? []), p]);
  }
  const parPorProf = new Map<number, DevengoParticular[]>();
  for (const p of e.particulares.pendientes) {
    const b = bloque(p.profesorId);
    if (p.tipo === "ajuste") {
      b.extras.push({
        titulo: "Ajuste por recálculo",
        detalle: `${p.alumno} · Clase particular: lo ya liquidado no se reescribe, esta línea es la diferencia.`,
        monto: p.monto,
      });
      continue;
    }
    parPorProf.set(p.profesorId, [...(parPorProf.get(p.profesorId) ?? []), p]);
  }

  // Las líneas las arma la misma función que usa el retiro (calidad 10).
  const ctx = e.contexto ?? CONTEXTO_VACIO;
  for (const b of bloques.values()) {
    const l = armarLineas(regPorProf.get(b.profesorId) ?? [], parPorProf.get(b.profesorId) ?? [], ctx);
    b.regulares = l.regulares;
    b.particulares = l.particulares;
  }

  for (const d of e.descuentos) {
    const b = bloque(d.profesorId);
    b.extras.push({
      titulo: "Reemplazo",
      detalle: `${d.curso} · ${diaMes(d.fecha)}: lo cubrió ${d.reemplazante}.`,
      monto: -d.monto,
    });
  }

  for (const b of bloques.values()) {
    b.membresias = new Set([...b.regulares, ...b.particulares].map((l) => l.membresiaId)).size;
    b.cursos = [
      ...new Set([...b.regulares.map((l) => l.curso), ...(b.particulares.length ? ["Clase particular"] : [])]),
    ].sort((x, y) => x.localeCompare(y, "es"));
    b.subtotal = r2([...b.regulares, ...b.particulares].reduce((a, l) => a + l.monto, 0));
    b.neto = r2(b.subtotal + b.extras.reduce((a, x) => a + x.monto, 0));
  }
  return [...bloques.values()].sort((a, b) => {
    const pa = persona.get(a.profesorId);
    const pb = persona.get(b.profesorId);
    return pa && pb ? compararPorApellido(pa, pb) : a.nombre.localeCompare(b.nombre, "es");
  });
}

// ── Todo junto ───────────────────────────────────────────────────────────

/**
 * Liquidez = Σ por profesor max(0, neto + saldo previo) + reemplazos de
 * suplentes. El piso va por profesor: lo pagado de más a uno no compensa lo
 * que se le debe a otro. Anota `saldoPrevio` y `aPagar` en cada bloque.
 */
export function calcularLiquidez(
  profesores: ProfesorPre[],
  saldos: { previos: SaldoPrevio[]; reemplazos: number }
): LiquidezPre {
  const previo = new Map<number, number>();
  for (const s of saldos.previos) previo.set(s.profesorId, (previo.get(s.profesorId) ?? 0) + s.saldo);
  let devengo = 0;
  let saldoPrevio = 0;
  let total = 0;
  for (const p of profesores) {
    const sp = r2(previo.get(p.profesorId) ?? 0);
    previo.delete(p.profesorId);
    p.saldoPrevio = sp;
    p.aPagar = r2(p.neto + sp);
    devengo += Math.max(0, p.neto);
    saldoPrevio += Math.max(0, p.aPagar) - Math.max(0, p.neto);
    total += Math.max(0, p.aPagar);
  }
  let soloSaldo = 0;
  for (const sp of previo.values()) {
    if (sp <= 0) continue;
    soloSaldo += 1;
    saldoPrevio += sp;
    total += sp;
  }
  return {
    total: r2(total + saldos.reemplazos),
    devengo: r2(devengo),
    saldoPrevio: r2(saldoPrevio),
    reemplazos: r2(saldos.reemplazos),
    soloSaldo,
  };
}

export function armarInforme(e: EntradaPre): InformePre {
  const profesores = armarProfesores(e);
  const liquidez = e.simulacion && e.saldos ? calcularLiquidez(profesores, e.saldos) : undefined;
  const excepciones = armarExcepciones(e);
  const ids = new Set<number>();
  for (const m of excepciones) for (const c of m.casos) if (c.membresiaId != null) ids.add(c.membresiaId);
  const comisiones = r2(profesores.reduce((a, p) => a + p.subtotal, 0));
  const total = r2(profesores.reduce((a, p) => a + p.neto, 0));
  return {
    ...(e.simulacion ? { simulacion: e.simulacion } : {}),
    periodoVencido: e.periodoVencido,
    hastaISO: e.hastaISO,
    profesores,
    resumen: {
      total,
      comisiones,
      extras: r2(total - comisiones),
      profesoresConDevengo: profesores.length,
      membresiasQueEntran: new Set(profesores.flatMap((p) => [...p.regulares, ...p.particulares].map((l) => l.membresiaId))).size,
      membresiasConExcepcion: ids.size,
    },
    excepciones,
    clases: clasesSinRegistrar(e),
    existentes: e.existentes,
    ...(liquidez ? { liquidez } : {}),
  };
}
