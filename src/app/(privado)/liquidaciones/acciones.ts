"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual } from "@/lib/sesion";
import { exigir } from "@/lib/datos";
import { diaIso, isoFecha } from "@/lib/inscripcion";
import type { TarifasDeCurso } from "@/lib/precios";
import type { Curso } from "@/lib/tipos";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}
type Admin = ReturnType<typeof admin>;

/** Primer día del MES VENCIDO (mes anterior): el período que se liquida. */
function primerDiaMesVencidoISO(hoy = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Último día del MES VENCIDO (mes anterior): tope de elegibilidad para liquidar.
 *  Solo entran membresías completadas (fecha_fin) hasta esta fecha inclusive. */
function finMesVencidoISO(hoy = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), 0); // día 0 del mes actual = último día del anterior
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Cálculo de devengos criterio 1 (membresías cobradas + completadas) ────
//
// **Regla de negocio 10, a prorrata.** Una membresía puede dar acceso a varios
// cursos, y cada curso tiene su profesor. La comisión no es de la membresía:
// es de cada curso, sobre **su parte** de lo efectivamente cobrado.
//
// Peso de un curso = precio de una clase de ese curso × clases que ese curso
// **realmente dictó** × personas cubiertas. Un curso que no dictó nada pesa 0
// y no cobra nada. La clase de prueba no es un caso especial: es el caso
// general con una clase por curso y N personas.
//
// Antes esto repartía usando `inscripciones.curso_id` —el curso principal de
// la venta— así que en un plan de cinco cursos un solo profesor se llevaba
// todo y los otros cuatro no cobraban.

export type DevengoPendiente = {
  membresiaId: number;
  profesorId: number;
  cursoId: number;
  alumno: string;
  curso: string;
  base: number;
  pct: number;
  monto: number;
  /** Clases que ese curso dictó para esta membresía: el peso del reparto. */
  clases: number;
  /** Personas cubiertas (1, salvo prueba grupal). */
  personas: number;
  /** Cuánto de lo cobrado le tocó a este curso, sobre el total de la venta. */
  cobradoTotal: number;
  /** Cómo se repartió la venta entre TODOS los cursos del plan. */
  reparto: LineaReparto[];
};

/**
 * Una membresía que **no se puede liquidar** porque alguna de sus clases no
 * tiene ni asistencia cargada ni suspensión (regla de negocio 17).
 *
 * No desaparece de la pantalla: se muestra con lo que falta y dónde cargarlo.
 * Una capacidad que no está disponible se explica (regla de calidad 5) — si la
 * membresía simplemente no apareciera, "todavía no cargué la asistencia" y
 * "algo se rompió" se verían igual.
 */
export type MembresiaBloqueada = {
  membresiaId: number;
  alumno: string;
  /** Los días de clase sin registrar, por curso. */
  cursos: { cursoId: number; curso: string; fechas: string[] }[];
  /** Profesores que no pueden cobrar esta membresía hasta que se registren. */
  profesorIds: number[];
};

/**
 * Lo que se le muestra al profesor: **el curso y las fechas**, no las ventas.
 *
 * El problema es del curso y de la fecha —una clase que nadie registró—, y es
 * independiente del plan que la haya vendido. La misma clase puede estar
 * trabando cinco membresías: se lista una vez. Javier, 2026-09-12: *"No veo
 * necesario mencionar los planes. El problema es con los cursos."*
 */
export type CursoSinRegistrar = { cursoId: number; curso: string; fechas: string[] };

/** Junta las membresías trabadas de un profesor en una lista por curso. */
function porCurso(bloqueadas: MembresiaBloqueada[]): CursoSinRegistrar[] {
  const m = new Map<number, { curso: string; fechas: Set<string> }>();
  for (const b of bloqueadas)
    for (const c of b.cursos) {
      const ya = m.get(c.cursoId) ?? { curso: c.curso, fechas: new Set<string>() };
      for (const f of c.fechas) ya.fechas.add(f);
      m.set(c.cursoId, ya);
    }
  return [...m.entries()]
    .map(([cursoId, v]) => ({ cursoId, curso: v.curso, fechas: [...v.fechas].sort() }))
    .sort((a, b) => a.curso.localeCompare(b.curso, "es"));
}

/** Una línea del reparto: qué peso tuvo un curso y por qué. */
export type LineaReparto = {
  cursoId: number;
  curso: string;
  clases: number;
  precioClase: number;
  /** Número intermedio: clases × valor de una clase. NO es plata. */
  peso: number;
  /** La plata que le tocó a este curso. Las partes suman lo cobrado. */
  parte: number;
};

type InscLiq = {
  id: number;
  alumno_id: number;
  curso_id: number;
  plan_id: number | null;
  es_prueba: boolean | null;
  acompanantes: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
};

async function calcularPendientes(
  sb: Awaited<ReturnType<typeof createClient>>,
  hastaISO: string
): Promise<{ pendientes: DevengoPendiente[]; bloqueadas: MembresiaBloqueada[] }> {
  // 1. Membresías completadas cuyo ciclo terminó a más tardar en `hastaISO`.
  //    Una que se completó después no corresponde a este período.
  const insc = exigir(
    await sb
      .from("inscripciones")
      .select("id, alumno_id, curso_id, plan_id, es_prueba, acompanantes, fecha_inicio, fecha_fin")
      .eq("estado", "completada")
      .not("plan_id", "is", null)
      .not("fecha_fin", "is", null)
      .lte("fecha_fin", hastaISO),
    "las membresías a liquidar"
  ) as InscLiq[];
  if (insc.length === 0) return { pendientes: [], bloqueadas: [] };
  const inscIds = insc.map((m) => m.id);

  // 2. Los cursos de cada membresía, con sus días y —si es prueba— la fecha
  //    exacta de su clase. El curso principal es solo el respaldo para filas
  //    viejas sin `inscripcion_cursos`.
  const icRows = exigir(
    await sb
      .from("inscripcion_cursos")
      .select("inscripcion_id, curso_id, dias, fecha")
      .in("inscripcion_id", inscIds),
    "los cursos de las membresías"
  ) as { inscripcion_id: number; curso_id: number; dias: number[] | null; fecha: string | null }[];
  const cursosDe = new Map<number, typeof icRows>();
  for (const r of icRows) {
    const ya = cursosDe.get(r.inscripcion_id);
    if (ya) ya.push(r);
    else cursosDe.set(r.inscripcion_id, [r]);
  }
  for (const m of insc)
    if (!cursosDe.has(m.id))
      cursosDe.set(m.id, [{ inscripcion_id: m.id, curso_id: m.curso_id, dias: null, fecha: null }]);

  // 3. Ya devengado, por (membresía, curso). Una fila vieja con `curso_id`
  //    nulo se devengó con el modelo anterior, por la membresía entera: esa
  //    membresía queda afuera completa (regla 12: no se reescribe lo devengado).
  const comis = exigir(
    await sb.from("comisiones_devengadas").select("membresia_id, curso_id").in("membresia_id", inscIds),
    "las comisiones ya devengadas"
  ) as { membresia_id: number | null; curso_id: number | null }[];
  const devengadoEntero = new Set<number>();
  const devengadoCurso = new Set<string>();
  for (const c of comis) {
    if (c.membresia_id == null) continue;
    if (c.curso_id == null) devengadoEntero.add(c.membresia_id);
    else devengadoCurso.add(`${c.membresia_id}|${c.curso_id}`);
  }

  // 4. Cuotas y pagos → saldo y plata efectivamente cobrada por membresía.
  //    La comisión se calcula sobre lo COBRADO: el descuento no suma (regla 8).
  const cuotaRows = exigir(
    await sb
      .from("cuotas")
      .select("id, inscripcion_id, monto_devengado, descuento_adelanto")
      .in("inscripcion_id", inscIds),
    "las cuotas"
  ) as { id: number; inscripcion_id: number; monto_devengado: number; descuento_adelanto: number }[];
  const cuotaIds = cuotaRows.map((c) => c.id);
  const pagadoPorCuota: Record<number, number> = {};
  const plataPorCuota: Record<number, number> = {};
  if (cuotaIds.length) {
    const pagos = exigir(
      await sb.from("pagos").select("cuota_id, monto, descuento").eq("tipo", "cobro").in("cuota_id", cuotaIds),
      "los pagos"
    ) as { cuota_id: number | null; monto: number; descuento: number }[];
    for (const p of pagos) {
      if (p.cuota_id == null) continue;
      plataPorCuota[p.cuota_id] = (plataPorCuota[p.cuota_id] ?? 0) + Number(p.monto);
      pagadoPorCuota[p.cuota_id] = (pagadoPorCuota[p.cuota_id] ?? 0) + Number(p.monto) + Number(p.descuento);
    }
  }
  const saldoPorInsc: Record<number, number> = {};
  const cobradoPorInsc: Record<number, number> = {};
  for (const c of cuotaRows) {
    const efectivo = Math.max(0, Number(c.monto_devengado) - Number(c.descuento_adelanto));
    saldoPorInsc[c.inscripcion_id] =
      (saldoPorInsc[c.inscripcion_id] ?? 0) + Math.max(0, efectivo - (pagadoPorCuota[c.id] ?? 0));
    cobradoPorInsc[c.inscripcion_id] = (cobradoPorInsc[c.inscripcion_id] ?? 0) + (plataPorCuota[c.id] ?? 0);
  }

  // 5. Las clases del ciclo, por curso: **calendario menos suspendidas**
  //    (decisión de Javier, 2026-09-11). Una clase suspendida no la dio nadie
  //    y no pesa (regla 4); una falta sí — la clase ocurrió, el profesor la
  //    dio (regla 3). Antes se contaban solo las sesiones con estado
  //    `dictada`, y eso hacía que una clase que ocurrió pero cuya asistencia
  //    nadie cargó pesara cero: el profesor cobraba de menos por un trámite
  //    pendiente, no por algo que pasó en la sala.
  //
  //    El precio de ese criterio es que una clase sin registrar ahora cuenta
  //    aunque nunca se haya dictado. Por eso viene con su contrapeso: si
  //    queda **alguna** sesión sin asistencia ni suspensión, la membresía no
  //    se liquida hasta que se registre (regla de negocio 17).
  const cursoIds = [...new Set(icRows.map((r) => r.curso_id).concat(insc.map((m) => m.curso_id)))];
  const desde = insc.map((m) => m.fecha_inicio).sort()[0];
  const sesiones = exigir(
    await sb
      .from("sesiones")
      .select("curso_id, fecha, estado")
      .in("curso_id", cursoIds)
      .gte("fecha", desde)
      .lte("fecha", hastaISO),
    "las clases del período"
  ) as { curso_id: number; fecha: string; estado: string }[];
  const suspendidas = new Set(
    sesiones.filter((s) => s.estado === "suspendida").map((s) => `${s.curso_id}|${s.fecha}`)
  );
  // Registrada = tiene sesión, cualquiera sea su estado. Sin fila, nadie tocó
  // esa clase: ni se tomó asistencia ni se suspendió.
  const registradas = new Set(sesiones.map((s) => `${s.curso_id}|${s.fecha}`));

  // 6. Precio de una clase de cada curso. Para la prueba es su tarifa de
  //    prueba; para el resto, el valor de una clase según el tramo (regla 9).
  const cursos = exigir(
    await sb.from("cursos").select("*").in("id", cursoIds),
    "los cursos"
  ) as Curso[];
  const cursoPorId = new Map(cursos.map((c) => [c.id, c]));
  const tarifas = exigir(
    await sb.from("curso_tarifas").select("curso_id, modalidad, precio").in("curso_id", cursoIds),
    "las tarifas"
  ) as { curso_id: number; modalidad: string; precio: number }[];
  const tarifaDe = new Map<number, TarifasDeCurso & { prueba?: number }>();
  for (const t of tarifas) {
    const actual = tarifaDe.get(t.curso_id) ?? {};
    (actual as Record<string, number>)[t.modalidad] = Number(t.precio);
    tarifaDe.set(t.curso_id, actual);
  }

  // 7. Asignación vigente por curso (profesor + %).
  const asig = exigir(
    await sb
      .from("asignaciones")
      .select("curso_id, profesor_id, pct_ingresos, desde")
      .in("curso_id", cursoIds)
      .is("hasta", null)
      .order("desde", { ascending: false }),
    "las asignaciones de profesores"
  ) as { curso_id: number; profesor_id: number; pct_ingresos: number }[];
  const asigPorCurso = new Map<number, { profesor_id: number; pct: number }>();
  for (const r of asig)
    if (!asigPorCurso.has(r.curso_id))
      asigPorCurso.set(r.curso_id, { profesor_id: r.profesor_id, pct: Number(r.pct_ingresos) });

  // 8. Nombres.
  const al = exigir(
    await sb.from("alumnos").select("id, nombre, apellido").in("id", [...new Set(insc.map((m) => m.alumno_id))]),
    "los alumnos"
  ) as { id: number; nombre: string; apellido: string }[];
  const alNombre = new Map(al.map((a) => [a.id, `${a.apellido}, ${a.nombre}`]));

  // 9. Repartir.
  const out: DevengoPendiente[] = [];
  const bloqueadas: MembresiaBloqueada[] = [];
  for (const m of insc) {
    if (devengadoEntero.has(m.id)) continue;
    if ((saldoPorInsc[m.id] ?? 0) > 0) continue; // vendida pero no cobrada
    const cobrado = cobradoPorInsc[m.id] ?? 0;
    if (cobrado <= 0) continue;

    const personas = 1 + Math.max(0, Number(m.acompanantes) || 0);
    const propios = cursosDe.get(m.id) ?? [];

    // Peso de cada curso = precio de una clase × clases del ciclo × personas.
    const pesos = propios.map((ic) => {
      const curso = cursoPorId.get(ic.curso_id);
      const { clases, faltan } = clasesDelCiclo(ic, m, curso, suspendidas, registradas);
      const precio = precioDeUnaClase(curso, tarifaDe.get(ic.curso_id) ?? {}, m.es_prueba === true);
      return { ic, curso, clases, faltan, peso: clases > 0 ? precio * clases * personas : 0 };
    });

    // **Regla de negocio 17 (revisada 2026-09-12): solo bloquea el prorrateo.**
    //
    // Si la membresía tiene UN SOLO curso, el conteo no decide plata: lo
    // cobrado va entero a ese curso, se hayan dictado tres clases o doce (el
    // reparto de abajo con un solo peso da `cobrado` siempre). Bloquearla
    // sería trabar una liquidación por un trámite que no puede cambiar su
    // número. Se liquida sin esperar a nadie.
    //
    // Con dos o más cursos sí: ahí el conteo es lo que reparte, y una clase
    // sin asistencia ni suspensión pesa igual que una dictada (regla 10). Esa
    // membresía espera. El bloqueo es de la membresía, no del profesor ni del
    // período: las demás se liquidan, y esta entra después como complemento
    // —agregar una membresía no toca el reparto de ninguna otra—.
    //
    // Una clase sin alumnos nunca llega hasta acá: el recorrido es el del
    // ciclo de ESTA membresía, así que todo día que cuenta la tiene a ella.
    const faltantes = propios.length > 1 ? pesos.filter((x) => x.faltan.length > 0) : [];
    if (faltantes.length > 0) {
      bloqueadas.push({
        membresiaId: m.id,
        alumno: alNombre.get(m.alumno_id) ?? `#${m.alumno_id}`,
        cursos: faltantes.map((x) => ({
          cursoId: x.ic.curso_id,
          curso: x.curso?.nombre ?? `#${x.ic.curso_id}`,
          fechas: x.faltan,
        })),
        profesorIds: [
          ...new Set(
            pesos
              .map((x) => asigPorCurso.get(x.ic.curso_id)?.profesor_id)
              .filter((x): x is number => x != null)
          ),
        ],
      });
      continue;
    }

    const total = pesos.reduce((t, x) => t + x.peso, 0);
    if (total <= 0) continue; // ningún curso dictó: no hay nada que repartir

    // Se reparte en centavos y el resto va al curso de mayor peso, para que
    // las partes sumen exactamente lo cobrado y no se pierda un centavo.
    const centavos = Math.round(cobrado * 100);
    const porCurso = pesos.map((x) => ({ ...x, cent: Math.floor((centavos * x.peso) / total) }));
    const sobra = centavos - porCurso.reduce((t, x) => t + x.cent, 0);
    if (sobra > 0) {
      const mayor = porCurso.reduce((a, b) => (b.peso > a.peso ? b : a));
      mayor.cent += sobra;
    }

    // La foto del reparto: va igual en cada comisión de esta membresía, con
    // TODOS los cursos —también los de otros profesores y los que no dictaron—
    // porque es lo que permite verificar que los pesos suman el total.
    const reparto: LineaReparto[] = porCurso.map((x) => ({
      cursoId: x.ic.curso_id,
      curso: x.curso?.nombre ?? `#${x.ic.curso_id}`,
      clases: x.clases,
      precioClase: precioDeUnaClase(x.curso, tarifaDe.get(x.ic.curso_id) ?? {}, m.es_prueba === true),
      peso: x.peso,
      // La parte en plata, con el mismo reparto en centavos que se devenga:
      // así lo que muestra el comprobante suma EXACTAMENTE lo cobrado.
      parte: x.cent / 100,
    }));

    for (const x of porCurso) {
      if (x.peso <= 0) continue;
      if (devengadoCurso.has(`${m.id}|${x.ic.curso_id}`)) continue;
      const a = asigPorCurso.get(x.ic.curso_id);
      if (!a) continue; // sin profesor asignado
      const base = x.cent / 100;
      out.push({
        membresiaId: m.id,
        profesorId: a.profesor_id,
        cursoId: x.ic.curso_id,
        alumno: alNombre.get(m.alumno_id) ?? `#${m.alumno_id}`,
        curso: x.curso?.nombre ?? `#${x.ic.curso_id}`,
        base,
        pct: a.pct,
        monto: Math.round(base * a.pct) / 100,
        clases: x.clases,
        personas,
        cobradoTotal: cobrado,
        reparto,
      });
    }
  }
  return { pendientes: out, bloqueadas };
}

/**
 * Clases que ESE curso puso para ESA membresía, y cuáles de ellas quedaron sin
 * registrar.
 *
 * **Criterio: calendario menos suspendidas** (Javier, 2026-09-11). Se cuentan
 * los días de clase del ciclo —los del calendario del curso que el alumno
 * eligió, entre el inicio y el fin del ciclo— y se descuentan las suspendidas,
 * que no las dio nadie. Una falta no descuenta: la clase ocurrió.
 *
 * Una prueba es una sola clase, en su fecha elegida (0024).
 *
 * `faltan` son los días de clase **sin sesión**: ni asistencia cargada ni
 * suspensión. Son los que bloquean la liquidación (regla de negocio 17): con
 * este criterio esas clases cuentan, así que liquidar sin registrarlas es
 * pagar por clases que quizá no ocurrieron.
 */
function clasesDelCiclo(
  ic: { curso_id: number; dias: number[] | null; fecha: string | null },
  m: InscLiq,
  curso: Curso | undefined,
  suspendidas: Set<string>,
  registradas: Set<string>
): { clases: number; faltan: string[] } {
  const clave = (f: string) => `${ic.curso_id}|${f}`;

  if (ic.fecha) {
    if (suspendidas.has(clave(ic.fecha))) return { clases: 0, faltan: [] };
    return { clases: 1, faltan: registradas.has(clave(ic.fecha)) ? [] : [ic.fecha] };
  }
  if (!m.fecha_fin) return { clases: 0, faltan: [] };

  // Los días que el alumno eligió; si la fila no los tiene (dato viejo), los
  // del curso. Sin ninguno de los dos no hay calendario que recorrer.
  const dias = ic.dias?.length ? ic.dias : curso?.dias_semana ?? [];
  if (!dias.length) return { clases: 0, faltan: [] };

  let clases = 0;
  const faltan: string[] = [];
  const d = new Date(m.fecha_inicio + "T00:00:00");
  const fin = new Date(m.fecha_fin + "T00:00:00");
  for (let i = 0; i < 400 && d <= fin; i++, d.setDate(d.getDate() + 1)) {
    if (!dias.includes(diaIso(d))) continue;
    const iso = isoFecha(d);
    if (suspendidas.has(clave(iso))) continue; // no consume ciclo: lo corre
    clases++;
    if (!registradas.has(clave(iso))) faltan.push(iso);
  }
  return { clases, faltan };
}

/**
 * Precio de UNA clase del curso: el peso unitario del reparto.
 *
 * **Es la tarifa de clase suelta del curso, NO el valor por tramo** (Javier,
 * 2026-09-11). El tramo existe para *proponer* el precio de un plan (regla 9):
 * ahí la pregunta es cuánto costaría comprar eso por separado, y comprar suelto
 * sale más caro por clase que comprar el mes. Repartir plata **ya cobrada** es
 * otra cosa: la pregunta es cuánto vale una clase de cada curso, comparadas
 * entre sí. Si cada curso se midiera con el tramo que le tocó según cuántas
 * clases dictó, dos cursos igual de caros pesarían distinto solo por eso — el
 * reparto dejaría de estar ecualizado.
 *
 * Para una prueba es su tarifa de prueba: es lo que efectivamente se cobró por
 * esa clase.
 */
function precioDeUnaClase(
  curso: Curso | undefined,
  tarifa: TarifasDeCurso & { prueba?: number },
  esPrueba: boolean
): number {
  if (esPrueba) return Number(tarifa.prueba ?? 0);
  if (Number(tarifa.clase ?? 0) > 0) return Number(tarifa.clase);
  // Sin tarifa de clase cargada, se deriva del mensual: el precio pleno es por
  // 4 semanas del calendario del curso (8 clases si es de dos por semana).
  if (!curso) return 0;
  const porMes = Math.max(1, (curso.dias_semana ?? []).length * 4);
  return Number(curso.precio_mensual ?? 0) / porMes;
}

export type FilaProfesor = {
  profesorId: number;
  nombre: string;
  pendienteMonto: number;
  pendienteCount: number;
  /**
   * Clases suyas sin registrar que dejan alguna venta multi-curso esperando
   * (regla de negocio 17). El profesor sigue listado aunque todo lo suyo esté
   * esperando: si desapareciera, no habría forma de saber desde la pantalla
   * que le falta cobrar algo ni por qué (regla de calidad 5).
   */
  sinRegistrar: CursoSinRegistrar[];
  /** Cuántas ventas suyas están esperando por eso. */
  ventasEsperando: number;
};

export type FilaLiquidacion = {
  id: number;
  profesorId: number;
  profesor: string;
  periodo: string;
  periodicidad: string;
  estado: string;
  totalDevengado: number;
  totalPagado: number;
  neto: number;
  /**
   * Quedaron devengos de este profesor y período **fuera** de la liquidación:
   * o nunca se incluyeron, o se dieron de baja porque alguien corrigió una
   * clase (regla de negocio 16). En los dos casos la liquidación quedó
   * desactualizada y hay que volver a generarla — y eso tiene que verse, no
   * quedar en que alguien se acuerde.
   */
  pendienteMonto: number;
  pendienteCount: number;
  /**
   * Clases del período sin registrar que dejan alguna venta multi-curso suya
   * esperando. **No impide pagar** (regla 16 revisada): la que espera se cobra
   * después como complemento. Se muestra para que se sepa que falta.
   */
  sinRegistrar: CursoSinRegistrar[];
  ventasEsperando: number;
};

export async function cargarLiquidaciones(): Promise<{
  profesores: FilaProfesor[];
  liquidaciones: FilaLiquidacion[];
}> {
  if (!(await tienePermiso("comisiones", "ver"))) return { profesores: [], liquidaciones: [] };
  const sb = await createClient();

  const periodoVencido = primerDiaMesVencidoISO();
  const { pendientes, bloqueadas } = await calcularPendientes(sb, finMesVencidoISO());
  const porProf = new Map<number, { monto: number; count: number }>();
  for (const p of pendientes) {
    const cur = porProf.get(p.profesorId) ?? { monto: 0, count: 0 };
    cur.monto += p.monto;
    cur.count += 1;
    porProf.set(p.profesorId, cur);
  }
  const trabadasPorProf = new Map<number, MembresiaBloqueada[]>();
  for (const b of bloqueadas)
    for (const id of b.profesorIds) {
      const ya = trabadasPorProf.get(id);
      if (ya) ya.push(b);
      else trabadasPorProf.set(id, [b]);
    }

  const { data: profs } = await sb.from("profesores").select("id, nombre, apellido").order("apellido");
  const profesores: FilaProfesor[] = ((profs as { id: number; nombre: string; apellido: string }[]) ?? [])
    .map((p) => ({
      profesorId: p.id,
      nombre: `${p.apellido}, ${p.nombre}`,
      pendienteMonto: porProf.get(p.id)?.monto ?? 0,
      pendienteCount: porProf.get(p.id)?.count ?? 0,
      sinRegistrar: porCurso(trabadasPorProf.get(p.id) ?? []),
      ventasEsperando: (trabadasPorProf.get(p.id) ?? []).length,
    }))
    .filter((p) => p.pendienteCount > 0 || p.ventasEsperando > 0);

  const { data: liqs } = await sb
    .from("liquidaciones")
    .select("id, profesor_id, periodo, periodicidad, estado, total_devengado, total_pagado, neto")
    .order("periodo", { ascending: false });
  const profNombre = new Map(
    ((profs as { id: number; nombre: string; apellido: string }[]) ?? []).map((p) => [p.id, `${p.apellido}, ${p.nombre}`])
  );
  const liquidaciones: FilaLiquidacion[] = ((liqs as {
    id: number;
    profesor_id: number;
    periodo: string;
    periodicidad: string;
    estado: string;
    total_devengado: number;
    total_pagado: number;
    neto: number;
  }[]) ?? []).map((l) => ({
    id: l.id,
    profesorId: l.profesor_id,
    profesor: profNombre.get(l.profesor_id) ?? `#${l.profesor_id}`,
    periodo: l.periodo,
    periodicidad: l.periodicidad,
    estado: l.estado,
    totalDevengado: Number(l.total_devengado),
    totalPagado: Number(l.total_pagado),
    neto: Number(l.neto),
    // Solo la del período que se está liquidando puede quedar desactualizada:
    // los pendientes se calculan contra ese período.
    pendienteMonto: l.periodo === periodoVencido ? porProf.get(l.profesor_id)?.monto ?? 0 : 0,
    pendienteCount: l.periodo === periodoVencido ? porProf.get(l.profesor_id)?.count ?? 0 : 0,
    sinRegistrar: l.periodo === periodoVencido ? porCurso(trabadasPorProf.get(l.profesor_id) ?? []) : [],
    ventasEsperando: l.periodo === periodoVencido ? (trabadasPorProf.get(l.profesor_id) ?? []).length : 0,
  }));

  return { profesores, liquidaciones };
}

/** Genera (o completa) la liquidación de un profesor con sus devengos pendientes. */
/**
 * Revierte los devengos que una clase afecta, **si su liquidación sigue
 * abierta** (nadie cobró todavía).
 *
 * Es la otra mitad de la regla de negocio 16, opción (a) de Javier: un período
 * pagado está cerrado y no se toca; uno abierto se puede corregir, y entonces
 * el devengo viejo tiene que irse para que el cálculo lo rehaga con los datos
 * nuevos. Sin esto, `calcularPendientes` ve la membresía como "ya devengada" y
 * la saltea para siempre — la corrección no llegaría nunca a la comisión.
 *
 * Devuelve cuántos devengos se revirtieron, para poder avisarlo.
 */
export async function revertirDevengosAbiertos(
  a: Admin,
  cursoId: number,
  fechaISO: string
): Promise<number> {
  // Membresías que incluyen ese curso y cuyo período cubre esa fecha.
  const { data: ic } = await a
    .from("inscripcion_cursos")
    .select("inscripcion_id, fecha")
    .eq("curso_id", cursoId);
  const candidatas = ((ic as { inscripcion_id: number; fecha: string | null }[]) ?? []).map(
    (r) => r.inscripcion_id
  );
  if (!candidatas.length) return 0;

  const { data: insc } = await a
    .from("inscripciones")
    .select("id, fecha_inicio, fecha_fin")
    .in("id", candidatas)
    .lte("fecha_inicio", fechaISO);
  const afectadas = ((insc as { id: number; fecha_inicio: string; fecha_fin: string | null }[]) ?? [])
    .filter((m) => !m.fecha_fin || m.fecha_fin >= fechaISO)
    .map((m) => m.id);
  if (!afectadas.length) return 0;

  // Sus comisiones de ese curso que estén en una liquidación ABIERTA.
  const { data: com } = await a
    .from("comisiones_devengadas")
    .select("id, liquidacion_id, liquidacion:liquidaciones(estado)")
    .in("membresia_id", afectadas)
    .eq("curso_id", cursoId);
  const revertibles = ((com as unknown as {
    id: number;
    liquidacion_id: number | null;
    liquidacion: { estado: string } | null;
  }[]) ?? []).filter((c) => c.liquidacion?.estado === "abierta");
  if (!revertibles.length) return 0;

  const ids = revertibles.map((c) => c.id);
  await a.from("liquidacion_items").delete().in("comision_id", ids);
  await a.from("comisiones_devengadas").delete().in("id", ids);
  for (const liq of [...new Set(revertibles.map((c) => c.liquidacion_id).filter((x): x is number => x != null))])
    await recomputarTotales(a, liq);
  return ids.length;
}

export async function generarLiquidacion(profesorId: number): Promise<{ ok?: true; liquidacionId?: number; error?: string }> {
  if (!(await tienePermiso("comisiones", "crear"))) return { error: "Sin permiso." };
  const a = admin();
  const sb = await createClient();

  const periodicidad = (await obtenerParametro("periodicidad_liquidacion")) || "mes";
  const periodo = primerDiaMesVencidoISO();

  const calculo = await calcularPendientes(sb, finMesVencidoISO());
  const pendientes = calculo.pendientes.filter((p) => p.profesorId === profesorId);

  // Regla 17 revisada: las membresías con prorrateo y clases sin registrar ya
  // quedaron afuera de `pendientes`. El profesor **sí** liquida el resto: no
  // hay por qué trabarle la plata de diez membresías por una que espera un
  // trámite. La que espera entra después como complemento, y no se pierde
  // porque la clase que le falta sigue siendo editable (regla 16 revisada:
  // solo se congela una clase de la que depende un prorrateo YA pagado).
  if (pendientes.length === 0) {
    const trabadas = calculo.bloqueadas.filter((b) => b.profesorIds.includes(profesorId));
    if (trabadas.length > 0)
      return {
        error:
          "Lo único pendiente de este profesor son membresías multi-curso con clases sin registrar. " +
          "Cargá la asistencia —o marcá la clase como suspendida— en Asistencia, y volvé a generar.",
      };
    return { error: "No hay devengos pendientes para este profesor." };
  }

  // Liquidación abierta del profesor en ese período, o nueva.
  const { data: existente } = await a
    .from("liquidaciones")
    .select("id, estado")
    .eq("profesor_id", profesorId)
    .eq("periodo", periodo)
    .eq("periodicidad", periodicidad)
    .maybeSingle();

  let liquidacionId: number;
  if (existente) {
    // Una liquidación ya pagada **acepta un complemento**: si aparece una
    // membresía que en su momento no estaba (se registró tarde, se vendió
    // retroactiva), su comisión se agrega y la liquidación vuelve a quedar con
    // saldo. No se reescribe nada de lo que ya se pagó — se suma lo nuevo.
    liquidacionId = existente.id as number;
  } else {
    const { data: nueva, error } = await a
      .from("liquidaciones")
      .insert({ profesor_id: profesorId, periodo, periodicidad, estado: "abierta" })
      .select("id")
      .single();
    if (error) return { error: error.message };
    liquidacionId = nueva.id as number;
  }

  // Devengar cada membresía pendiente y crear el ítem.
  for (const p of pendientes) {
    const { data: com, error: errCom } = await a
      .from("comisiones_devengadas")
      .insert({
        profesor_id: p.profesorId,
        membresia_id: p.membresiaId,
        curso_id: p.cursoId,
        criterio: 1,
        periodo,
        tipo: "comision",
        base: p.base,
        monto: p.monto,
        // Foto del reparto: el comprobante la lee en vez de recalcular, para
        // que el mismo papel diga siempre lo mismo (regla 12).
        reparto: p.reparto.length > 1 ? p.reparto : null,
        // La glosa tiene que dejar auditar el reparto sin abrir el código: de
        // cuánto se partió, qué parte le tocó a este curso y por qué.
        origen:
          `Criterio 1: ${p.pct}% de ${p.base} (${p.curso} / ${p.alumno})` +
          (p.base !== p.cobradoTotal
            ? ` — parte de ${p.cobradoTotal} cobrado, a prorrata por ${p.clases} ${
                p.clases === 1 ? "clase" : "clases"
              }${p.personas > 1 ? ` x ${p.personas} personas` : ""}`
            : ""),
        liquidacion_id: liquidacionId,
      })
      .select("id")
      .single();
    if (errCom) return { error: "Falló devengar una comisión: " + errCom.message };
    await a.from("liquidacion_items").insert({
      liquidacion_id: liquidacionId,
      comision_id: com.id,
      membresia_id: p.membresiaId,
      descripcion:
        `${p.alumno} — ${p.curso} (${p.pct}% de ${p.base})` +
        (p.base !== p.cobradoTotal ? ` · parte de ${p.cobradoTotal}` : ""),
      monto: p.monto,
    });
  }

  await recomputarTotales(a, liquidacionId);
  revalidatePath("/liquidaciones");
  return { ok: true, liquidacionId };
}

/**
 * Borra una liquidación que quedó **sin comisiones y sin pagos**.
 *
 * Pasa cuando se corrige una clase del período: el devengo se revierte (regla
 * de negocio 16) y la liquidación queda en cero. Sin esto se queda ahí para
 * siempre, con totales 0 y sin ninguna acción posible — ruido que después
 * nadie sabe si se puede tocar.
 *
 * Nunca borra una con plata: si tiene ítems o algún pago, se niega.
 */
export async function eliminarLiquidacionVacia(
  liquidacionId: number
): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("comisiones", "crear"))) return { error: "Sin permiso." };
  const a = admin();

  const { data: items } = await a
    .from("liquidacion_items")
    .select("id")
    .eq("liquidacion_id", liquidacionId)
    .limit(1);
  if ((items as unknown[])?.length) return { error: "Tiene comisiones: no se puede eliminar." };

  const { data: pagos } = await a
    .from("pagos")
    .select("id")
    .eq("liquidacion_id", liquidacionId)
    .limit(1);
  if ((pagos as unknown[])?.length) return { error: "Tiene pagos registrados: no se puede eliminar." };

  const { error } = await a.from("liquidaciones").delete().eq("id", liquidacionId);
  if (error) return { error: error.message };
  revalidatePath("/liquidaciones");
  return { ok: true };
}

/** Registra un pago al profesor contra su liquidación. */
export async function registrarPagoLiquidacion(args: {
  liquidacionId: number;
  monto: number;
  medio: string | null;
  notaMedio?: string;
}): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("comisiones", "crear"))) return { error: "Sin permiso." };
  const a = admin();
  const perfil = await obtenerPerfilActual();

  const monto = Math.max(0, Math.round((Number(args.monto) || 0) * 100) / 100);
  if (monto <= 0) return { error: "El monto debe ser mayor a 0." };
  if (!args.medio) return { error: "Elegí el medio de pago." };

  const { data: liq } = await a
    .from("liquidaciones")
    .select("id, profesor_id, periodo, total_devengado, total_pagado")
    .eq("id", args.liquidacionId)
    .maybeSingle();
  if (!liq) return { error: "La liquidación no existe." };

  // Pagar ya no se bloquea por una membresía trabada de otro (regla 16
  // revisada): el pago congela solo las clases de las que depende un prorrateo
  // que este pago hace efectivo, no el mes entero. La membresía que espera
  // sigue pudiendo registrarse y se cobra después, como complemento.
  const restante = Math.max(0, Number(liq.total_devengado) - Number(liq.total_pagado));
  if (monto > restante) return { error: `El pago supera el neto pendiente (${restante}).` };

  const glosa = args.medio && /otro/i.test(args.medio) && args.notaMedio?.trim() ? args.notaMedio.trim() : null;
  const { error: errPago } = await a.from("pagos").insert({
    tipo: "pago",
    motivo: "liquidacion",
    profesor_id: liq.profesor_id,
    liquidacion_id: args.liquidacionId,
    monto,
    medio: args.medio,
    glosa,
    registrado_por: perfil?.id ?? null,
  });
  if (errPago) return { error: errPago.message };

  await recomputarTotales(a, args.liquidacionId);
  revalidatePath("/liquidaciones");
  revalidatePath(`/liquidaciones/${args.liquidacionId}`);
  return { ok: true };
}

/** Recalcula total_devengado (ítems), total_pagado (pagos) y neto/estado. */
async function recomputarTotales(a: Admin, liquidacionId: number): Promise<void> {
  const { data: items } = await a
    .from("liquidacion_items")
    .select("monto")
    .eq("liquidacion_id", liquidacionId);
  const devengado = ((items as { monto: number }[]) ?? []).reduce((s, r) => s + Number(r.monto), 0);

  const { data: pagos } = await a
    .from("pagos")
    .select("monto")
    .eq("tipo", "pago")
    .eq("liquidacion_id", liquidacionId);
  const pagado = ((pagos as { monto: number }[]) ?? []).reduce((s, r) => s + Number(r.monto), 0);

  const neto = devengado - pagado;
  const estado = pagado <= 0 ? "abierta" : neto <= 0 ? "pagada" : "cerrada";
  await a
    .from("liquidaciones")
    .update({
      total_devengado: devengado,
      total_pagado: pagado,
      neto,
      estado,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", liquidacionId);
}
