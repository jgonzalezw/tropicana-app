/**
 * El motor de liquidación, **sin base de datos**.
 *
 * Acá vive el cálculo de la regla de negocio 10 (prorrata) y su contrapeso, la
 * regla 17. Se separó de `liquidaciones/acciones.ts` por un motivo concreto:
 * mientras el cálculo vivía dentro de la server action, la única forma de
 * probarlo era mirar lo que produjo contra los datos que hubiera en dev ese
 * día — y los datos de dev se mueven. Acá entra data cruda y sale el reparto,
 * así que se puede fijar con pruebas deterministas (`motor.test.ts`).
 *
 * **Lo que este módulo NO decide.** La plata sale de las membresías
 * **completadas** (agotadas) y **cobradas al 100%**; las clases solo afectan
 * contadores, y entran acá únicamente como insumo del prorrateo: cuántas puso
 * cada curso y quién las dictó. Una clase nunca "tiene" plata encima.
 * *(Javier, 2026-09-18.)*
 *
 * La server action queda como envoltorio: lee las filas y llama acá.
 */

import {
  asignacionEnFecha,
  titularVigente,
  type AsignacionVigencia,
} from "../asignaciones.ts";
import { enVigencia } from "../vigencia.ts";
import { diaIso, isoFecha } from "../inscripcion.ts";
import type { TarifasDeCurso } from "../precios.ts";
import type { Curso } from "../tipos.ts";

// ── Lo que devuelve ──────────────────────────────────────────────────────

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
  /**
   * Cómo se dividió la parte del curso cuando lo dictó **más de un profesor**
   * (un cambio de titular a mitad de ciclo). Ausente en el caso normal.
   */
  profesores?: { profesorId: number; profesor: string; clases: number; parte: number }[];
  /**
   * Clases del curso dictadas **con reemplazo por causa administrativa**: el
   * curso no tenía titular ese día (regla 20b). Cuentan para el conteo —se
   * dictaron— y su parte queda para Tropicana, de donde sale el costo del
   * reemplazo.
   *
   * Van con su plata porque **sin ellas el desglose del curso no cierra**: la
   * parte del curso menos lo de sus profesores deja un hueco mudo.
   */
  sinAsignar?: number;
  parteSinAsignar?: number;
};

export type DevengoPendiente = {
  membresiaId: number;
  profesorId: number;
  cursoId: number;
  alumno: string;
  curso: string;
  /**
   * `'comision'` la primera vez que esta (membresía, curso, profesor)
   * devenga; `'ajuste'` cuando ya habia devengado y el recálculo da otra
   * cosa. Un ajuste viaja **firmado**: positivo si hay que pagarle más,
   * negativo si hay que descontarle.
   */
  tipo: "comision" | "ajuste";
  /**
   * Solo en los ajustes: el período de la comisión original. El ajuste entra
   * ahí como complemento —reabriendo esa liquidación— en vez de caer en el
   * mes vencido. Lo pagado no se reescribe; se le suma el delta.
   * *(Javier, 2026-09-18.)*
   */
  periodo?: string;
  /** Solo en los ajustes: la comisión que corrige (traza para el comprobante). */
  ajustaComisionId?: number;
  base: number;
  pct: number;
  monto: number;
  /** Clases que ESTE profesor dictó de ese curso para esta membresía. */
  clases: number;
  /** Clases que puso el curso entero: si difiere, el curso lo dictó más de uno. */
  clasesDelCurso: number;
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

// ── Lo que recibe: las filas crudas, tal como salen de la base ───────────

export type MembresiaLiq = {
  id: number;
  alumno_id: number;
  curso_id: number;
  plan_id: number | null;
  es_prueba: boolean | null;
  acompanantes: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
};

export type CursoDeMembresia = {
  inscripcion_id: number;
  curso_id: number;
  dias: number[] | null;
  fecha: string | null;
};

export type ComisionPrevia = {
  id: number;
  membresia_id: number | null;
  curso_id: number | null;
  profesor_id: number;
  base: number;
  monto: number;
  /** `'comision'` la original, `'ajuste'` una corrección posterior (0044). */
  tipo: string;
  /** El período en que entró: el ajuste va al mismo, como complemento. */
  periodo: string | null;
};

export type CuotaLiq = {
  id: number;
  inscripcion_id: number;
  monto_devengado: number;
  descuento_adelanto: number;
};

export type PagoLiq = { cuota_id: number | null; monto: number; descuento: number };

export type SesionLiq = {
  curso_id: number;
  fecha: string;
  estado: string;
  reemplazo_motivo: string | null;
};

export type TarifaLiq = { curso_id: number; modalidad: string; precio: number };

export type PersonaLiq = { id: number; nombre: string; apellido: string };

/** Todo lo que el motor necesita leer, ya traído de la base. */
export type DatosMotor = {
  membresias: MembresiaLiq[];
  cursosDeMembresia: CursoDeMembresia[];
  comisionesPrevias: ComisionPrevia[];
  cuotas: CuotaLiq[];
  pagos: PagoLiq[];
  sesiones: SesionLiq[];
  cursos: Curso[];
  tarifas: TarifaLiq[];
  asignaciones: AsignacionVigencia[];
  alumnos: PersonaLiq[];
  profesores: PersonaLiq[];
};

// ── El cálculo ───────────────────────────────────────────────────────────

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
export function precioDeUnaClase(
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
 * Devuelve las **fechas**, no un total: el reparto entre profesores necesita
 * saber en qué día cayó cada clase para atribuirla a quien tenía el curso ese
 * día (regla 10).
 *
 * `faltan` son los días de clase **sin sesión**: ni asistencia cargada ni
 * suspensión. Son los que bloquean la liquidación (regla de negocio 17): con
 * este criterio esas clases cuentan, así que liquidar sin registrarlas es
 * pagar por clases que quizá no ocurrieron.
 *
 * **El calendario tiene principio y fin** (vigencia del curso, 0033). Un día
 * fuera de la vigencia no es una clase: no cuenta para el reparto y tampoco se
 * exige registrarlo. Sin esto, `dias_semana` genera clases hacia atrás sin
 * límite y un curso que arrancó el 31 de agosto igual "pone" ocho clases de
 * agosto — que pesan en el prorrateo y traban la liquidación por sesiones que
 * nunca existieron.
 */
export function clasesDelCiclo(
  ic: { curso_id: number; dias: number[] | null; fecha: string | null },
  m: MembresiaLiq,
  curso: Curso | undefined,
  suspendidas: Set<string>,
  registradas: Set<string>
): { fechas: string[]; faltan: string[] } {
  const clave = (f: string) => `${ic.curso_id}|${f}`;

  if (ic.fecha) {
    if (suspendidas.has(clave(ic.fecha))) return { fechas: [], faltan: [] };
    if (!enVigencia(curso, ic.fecha)) return { fechas: [], faltan: [] };
    return { fechas: [ic.fecha], faltan: registradas.has(clave(ic.fecha)) ? [] : [ic.fecha] };
  }
  if (!m.fecha_fin) return { fechas: [], faltan: [] };

  // Los días que el alumno eligió; si la fila no los tiene (dato viejo), los
  // del curso. Sin ninguno de los dos no hay calendario que recorrer.
  const dias = ic.dias?.length ? ic.dias : curso?.dias_semana ?? [];
  if (!dias.length) return { fechas: [], faltan: [] };

  const fechas: string[] = [];
  const faltan: string[] = [];
  const d = new Date(m.fecha_inicio + "T00:00:00");
  const fin = new Date(m.fecha_fin + "T00:00:00");
  for (let i = 0; i < 400 && d <= fin; i++, d.setDate(d.getDate() + 1)) {
    if (!dias.includes(diaIso(d))) continue;
    const iso = isoFecha(d);
    if (!enVigencia(curso, iso)) continue; // el curso no corría: no hay clase
    if (suspendidas.has(clave(iso))) continue; // no consume ciclo: lo corre
    fechas.push(iso);
    if (!registradas.has(clave(iso))) faltan.push(iso);
  }
  return { fechas, faltan };
}

/**
 * El reparto completo, a partir de las filas crudas.
 *
 * `hastaISO` es el tope de elegibilidad: solo entran membresías cuyo ciclo
 * terminó a más tardar ese día (el último del mes vencido).
 */
export function calcularDevengos(
  datos: DatosMotor,
  hastaISO: string
): { pendientes: DevengoPendiente[]; bloqueadas: MembresiaBloqueada[] } {
  const insc = datos.membresias;
  if (insc.length === 0) return { pendientes: [], bloqueadas: [] };

  // Los cursos de cada membresía. El curso principal es solo el respaldo para
  // filas viejas sin `inscripcion_cursos`.
  const cursosDe = new Map<number, CursoDeMembresia[]>();
  for (const r of datos.cursosDeMembresia) {
    const ya = cursosDe.get(r.inscripcion_id);
    if (ya) ya.push(r);
    else cursosDe.set(r.inscripcion_id, [r]);
  }
  for (const m of insc)
    if (!cursosDe.has(m.id))
      cursosDe.set(m.id, [{ inscripcion_id: m.id, curso_id: m.curso_id, dias: null, fecha: null }]);

  // Ya devengado, por (membresía, curso). Una fila vieja con `curso_id` nulo se
  // devengó con el modelo anterior, por la membresía entera: esa membresía
  // queda afuera completa (regla 12: no se reescribe lo devengado).
  const devengadoEntero = new Set<number>();
  /**
   * Lo ya devengado por (membresía, curso, profesor): la comisión original
   * **más los ajustes que ya se le hicieron**. Contra esta suma se mide el
   * delta — por eso es un total y no una marca de "ya pasó por acá".
   */
  const yaDevengado = new Map<string, { base: number; monto: number }>();
  /** La comisión original de esa llave: a ella apunta el ajuste, y su período
   *  es el que el ajuste tiene que complementar. */
  const comisionOriginal = new Map<string, { id: number; periodo: string | null }>();
  /** Qué profesores ya tienen algo devengado en cada (membresía, curso): si a
   *  alguno ya no le corresponde, su delta es negativo y hay que emitirlo. */
  const profesoresConDevengo = new Map<string, Set<number>>();
  for (const c of datos.comisionesPrevias) {
    if (c.membresia_id == null) continue;
    if (c.curso_id == null) {
      devengadoEntero.add(c.membresia_id);
      continue;
    }
    const k = `${c.membresia_id}|${c.curso_id}|${c.profesor_id}`;
    const ya = yaDevengado.get(k) ?? { base: 0, monto: 0 };
    ya.base += Number(c.base);
    ya.monto += Number(c.monto);
    yaDevengado.set(k, ya);
    if (c.tipo !== "ajuste") comisionOriginal.set(k, { id: c.id, periodo: c.periodo });
    const kc = `${c.membresia_id}|${c.curso_id}`;
    const set = profesoresConDevengo.get(kc) ?? new Set<number>();
    set.add(c.profesor_id);
    profesoresConDevengo.set(kc, set);
  }

  // Cuotas y pagos → saldo y plata efectivamente cobrada por membresía.
  // La comisión se calcula sobre lo COBRADO: el descuento no suma (regla 8).
  const pagadoPorCuota: Record<number, number> = {};
  const plataPorCuota: Record<number, number> = {};
  for (const p of datos.pagos) {
    if (p.cuota_id == null) continue;
    plataPorCuota[p.cuota_id] = (plataPorCuota[p.cuota_id] ?? 0) + Number(p.monto);
    pagadoPorCuota[p.cuota_id] = (pagadoPorCuota[p.cuota_id] ?? 0) + Number(p.monto) + Number(p.descuento);
  }
  const saldoPorInsc: Record<number, number> = {};
  const cobradoPorInsc: Record<number, number> = {};
  for (const c of datos.cuotas) {
    const efectivo = Math.max(0, Number(c.monto_devengado) - Number(c.descuento_adelanto));
    saldoPorInsc[c.inscripcion_id] =
      (saldoPorInsc[c.inscripcion_id] ?? 0) + Math.max(0, efectivo - (pagadoPorCuota[c.id] ?? 0));
    cobradoPorInsc[c.inscripcion_id] = (cobradoPorInsc[c.inscripcion_id] ?? 0) + (plataPorCuota[c.id] ?? 0);
  }

  // Las clases del ciclo, por curso: **calendario menos suspendidas** (Javier,
  // 2026-09-11). Una clase suspendida no la dio nadie y no pesa (regla 4); una
  // falta sí — la clase ocurrió, el profesor la dio (regla 3).
  const suspendidas = new Set(
    datos.sesiones.filter((s) => s.estado === "suspendida").map((s) => `${s.curso_id}|${s.fecha}`)
  );
  // Registrada = tiene sesión, cualquiera sea su estado. Sin fila, nadie tocó
  // esa clase: ni se tomó asistencia ni se suspendió.
  const registradas = new Set(datos.sesiones.map((s) => `${s.curso_id}|${s.fecha}`));
  // Clases dictadas con reemplazo **por causa administrativa** (regla 20b): la
  // clase cuenta para el conteo —se dictó— pero su parte no es del titular,
  // queda para Tropicana. El otro motivo, `titular` (regla 20a), no entra acá:
  // ahí la clase le cuenta y la cobra normal, y lo pagado al reemplazante se
  // le descuenta del total.
  const reemplazoAdmin = new Set(
    datos.sesiones
      .filter((s) => s.reemplazo_motivo === "administrativo")
      .map((s) => `${s.curso_id}|${s.fecha}`)
  );

  const cursoPorId = new Map(datos.cursos.map((c) => [c.id, c]));
  const tarifaDe = new Map<number, TarifasDeCurso & { prueba?: number }>();
  for (const t of datos.tarifas) {
    const actual = tarifaDe.get(t.curso_id) ?? {};
    (actual as Record<string, number>)[t.modalidad] = Number(t.precio);
    tarifaDe.set(t.curso_id, actual);
  }

  // **Historial** de asignaciones por curso, no solo la vigente. La comisión es
  // de quien **dictó** la clase, no de quien figura hoy al frente del curso
  // (regla de negocio 10).
  const asigPorCurso = new Map<number, AsignacionVigencia[]>();
  for (const r of datos.asignaciones) {
    const ya = asigPorCurso.get(r.curso_id);
    if (ya) ya.push(r);
    else asigPorCurso.set(r.curso_id, [r]);
  }
  /** Quién tenía el curso el día `f`. El criterio vive en `@/lib/asignaciones`
   *  para que la pantalla de asistencia y esta cuenta no puedan discrepar. */
  const asignacionEn = (cursoId: number, f: string) =>
    asignacionEnFecha(asigPorCurso.get(cursoId) ?? [], f);
  /** El titular de hoy: solo para decir de quién es una membresía trabada. */
  const titularHoy = (cursoId: number) => titularVigente(asigPorCurso.get(cursoId) ?? []);

  const alNombre = new Map(datos.alumnos.map((a) => [a.id, `${a.apellido}, ${a.nombre}`]));
  // Los profesores hacen falta por nombre: cuando un curso lo dictó más de uno,
  // el comprobante tiene que poder decir quién se llevó qué parte.
  const profNombre = new Map(datos.profesores.map((p) => [p.id, `${p.apellido}, ${p.nombre}`]));

  // Repartir.
  const out: DevengoPendiente[] = [];
  const bloqueadas: MembresiaBloqueada[] = [];
  for (const m of insc) {
    if (m.fecha_fin != null && m.fecha_fin > hastaISO) continue; // aún no corresponde a este período
    if (devengadoEntero.has(m.id)) continue;
    if ((saldoPorInsc[m.id] ?? 0) > 0) continue; // vendida pero no cobrada
    const cobrado = cobradoPorInsc[m.id] ?? 0;
    if (cobrado <= 0) continue;

    const personas = 1 + Math.max(0, Number(m.acompanantes) || 0);
    const propios = cursosDe.get(m.id) ?? [];

    // Peso de cada curso = precio de una clase × clases del ciclo × personas.
    const pesos = propios.map((ic) => {
      const curso = cursoPorId.get(ic.curso_id);
      const { fechas, faltan } = clasesDelCiclo(ic, m, curso, suspendidas, registradas);
      const precio = precioDeUnaClase(curso, tarifaDe.get(ic.curso_id) ?? {}, m.es_prueba === true);
      const clases = fechas.length;
      return { ic, curso, clases, fechas, faltan, peso: clases > 0 ? precio * clases * personas : 0 };
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
              .map((x) => titularHoy(x.ic.curso_id)?.profesor_id)
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

    // **Segundo nivel del reparto: dentro del curso, entre sus profesores.**
    //
    // La parte de un curso se divide por las clases que dictó cada uno. Un
    // cambio de titular a mitad de ciclo deja dos líneas para ese curso, cada
    // una con su profesor, su % y sus clases. En el caso normal —un solo
    // titular todo el ciclo— da una sola línea con la parte entera.
    //
    // **Una clase con asistencia registrada la dictó alguien** (regla 20). Si
    // ese día el curso no tenía titular, la dio un **suplente**, que cobra por
    // tarifa y no entra en el prorrateo. La clase **cuenta igual** para el peso
    // del curso —se dictó—, y lo que le toca **queda para Tropicana**.
    const repartoProf = porCurso.map((x) => {
      const conteo = new Map<number, { pct: Map<number, number>; clases: number }>();
      for (const f of x.fechas) {
        // Reemplazo administrativo: la parte de esa clase no es de nadie más
        // que de Tropicana, aunque el curso tuviera titular ese día.
        if (reemplazoAdmin.has(`${x.ic.curso_id}|${f}`)) continue;
        const a = asignacionEn(x.ic.curso_id, f);
        if (!a) continue;
        const ya = conteo.get(a.profesor_id) ?? { pct: new Map<number, number>(), clases: 0 };
        ya.clases++;
        const p = Number(a.pct_ingresos);
        ya.pct.set(p, (ya.pct.get(p) ?? 0) + 1);
        conteo.set(a.profesor_id, ya);
      }
      // Si el % del profesor cambió dentro del mismo ciclo, manda el que rigió
      // en más clases suyas: es un solo número por (curso, profesor) y tiene
      // que ser el que explica la mayor parte de su plata.
      const lineas = [...conteo.entries()].map(([profesorId, v]) => ({
        profesorId,
        clases: v.clases,
        pct: [...v.pct.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0],
        cent: x.clases > 0 ? Math.floor((x.cent * v.clases) / x.clases) : 0,
      }));
      // El centavo que sobra va al que más clases dio, y solo si TODAS las
      // clases del curso tenían profesor: si alguna no lo tenía, esa plata no
      // le corresponde a nadie.
      const clasesConProfesor = lineas.reduce((t, l) => t + l.clases, 0);
      if (lineas.length && clasesConProfesor === x.clases) {
        const sobraCurso = x.cent - lineas.reduce((t, l) => t + l.cent, 0);
        if (sobraCurso > 0) lineas.reduce((a, b) => (b.clases > a.clases ? b : a)).cent += sobraCurso;
      }
      return { x, lineas, sinAsignar: x.clases - clasesConProfesor };
    });

    // La foto del reparto: va igual en cada comisión de esta membresía, con
    // TODOS los cursos —también los de otros profesores y los que no dictaron—
    // porque es lo que permite verificar que los pesos suman el total.
    const reparto: LineaReparto[] = repartoProf.map(({ x, lineas, sinAsignar }) => ({
      cursoId: x.ic.curso_id,
      curso: x.curso?.nombre ?? `#${x.ic.curso_id}`,
      clases: x.clases,
      precioClase: precioDeUnaClase(x.curso, tarifaDe.get(x.ic.curso_id) ?? {}, m.es_prueba === true),
      peso: x.peso,
      parte: x.cent / 100,
      // Con un solo titular y sin reemplazos, la línea del curso ya lo dice todo.
      profesores:
        lineas.length > 1 || sinAsignar > 0
          ? lineas.map((l) => ({
              profesorId: l.profesorId,
              profesor: profNombre.get(l.profesorId) ?? `#${l.profesorId}`,
              clases: l.clases,
              parte: l.cent / 100,
            }))
          : undefined,
      sinAsignar: sinAsignar > 0 ? sinAsignar : undefined,
      parteSinAsignar:
        sinAsignar > 0 ? (x.cent - lineas.reduce((t, l) => t + l.cent, 0)) / 100 : undefined,
    }));

    // **El reparto se calcula como un objetivo absoluto, no como un
    // incremento.** Para cada (curso, profesor) el motor dice cuánto le
    // corresponde HOY; lo que se emite es la diferencia contra lo que ya se le
    // devengó. Si nunca devengó, la diferencia es el total y sale como
    // `comision`; si ya devengó y el número cambió, sale como `ajuste`
    // firmado, que se complementa en el período de la comisión original.
    //
    // Esto reemplaza al tope que había acá antes. Aquel tope impedía pagarle
    // al segundo profesor cuando una comisión vieja se había llevado el curso
    // entero — pero lo hacía dejándolo sin cobrar. Con el objetivo absoluto el
    // caso se resuelve solo: al primero le sale un ajuste negativo por lo que
    // ya no le toca y al segundo su comisión, y el curso sigue sumando lo
    // mismo. Lo pagado no se reescribe: se compensa.
    for (const { x, lineas } of repartoProf) {
      const objetivo = new Map<number, { base: number; pct: number; clases: number }>();
      if (x.peso > 0)
        for (const l of lineas)
          objetivo.set(l.profesorId, { base: l.cent / 100, pct: l.pct, clases: l.clases });

      // Los que hoy tienen parte, más los que ya tenían algo devengado: a esos
      // últimos puede corresponderles un ajuste hacia abajo.
      const enJuego = new Set<number>([
        ...objetivo.keys(),
        ...(profesoresConDevengo.get(`${m.id}|${x.ic.curso_id}`) ?? []),
      ]);

      for (const profesorId of enJuego) {
        const k = `${m.id}|${x.ic.curso_id}|${profesorId}`;
        const obj = objetivo.get(profesorId);
        const ya = yaDevengado.get(k);
        const baseObjetivo = obj?.base ?? 0;
        const montoObjetivo = obj ? Math.round(baseObjetivo * obj.pct) / 100 : 0;
        const base = Math.round((baseObjetivo - (ya?.base ?? 0)) * 100) / 100;
        const monto = Math.round((montoObjetivo - (ya?.monto ?? 0)) * 100) / 100;
        if (base === 0 && monto === 0) continue; // ya está al día

        const esAjuste = ya != null;
        const original = comisionOriginal.get(k);
        out.push({
          membresiaId: m.id,
          profesorId,
          cursoId: x.ic.curso_id,
          alumno: alNombre.get(m.alumno_id) ?? `#${m.alumno_id}`,
          curso: x.curso?.nombre ?? `#${x.ic.curso_id}`,
          tipo: esAjuste ? "ajuste" : "comision",
          periodo: esAjuste ? original?.periodo ?? undefined : undefined,
          ajustaComisionId: esAjuste ? original?.id : undefined,
          base,
          pct: obj?.pct ?? 0,
          monto,
          clases: obj?.clases ?? 0,
          // Cuántas clases puso el curso en total: sin esto no se entiende por
          // qué su base es menor que la parte del curso.
          clasesDelCurso: x.clases,
          personas,
          cobradoTotal: cobrado,
          reparto,
        });
      }
    }
  }
  return { pendientes: out, bloqueadas };
}
