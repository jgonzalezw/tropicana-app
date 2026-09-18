/**
 * Qué liquidaciones se verían tocadas si se cambia una clase vieja.
 *
 * **Esto ya no bloquea. Informa.** Y el cambio de rol viene de corregir un
 * error de modelo, no de aflojar un control.
 *
 * **Lo que se creía.** Que una clase "tenía plata encima": si de ella dependía
 * una comisión ya pagada, no se la podía tocar —ni tomar asistencia, ni
 * corregirla, ni suspenderla— y el sistema lo impedía de plano. Ese era el
 * congelador.
 *
 * **Lo que es.** Las clases solo afectan **contadores** (Javier, 2026-09-18).
 * La plata sale de las membresías completadas (agotadas) y cobradas al 100%;
 * el conteo de clases es apenas el insumo del prorrateo al liquidar. Una clase
 * nunca tiene plata encima.
 *
 * De ahí se sigue que prohibir era la respuesta equivocada. Lo correcto es
 * dejar hacer —registrar tarde, corregir, suspender: todo eso son hechos que
 * pasaron y el sistema tiene que poder reflejarlos— y **compensar la
 * diferencia**: al liquidar, la membresía se recalcula y, si su devengado
 * cambió, sale un **ajuste** por el delta (migración 0044). Lo ya pagado no se
 * reescribe nunca; se le suma o se le resta la diferencia como complemento del
 * período original. Y lo devengado por **otras** membresías que compartieron
 * esa misma clase no cambia: cada venta se reparte sola.
 *
 * Lo que queda es el **aviso**: quien va a tocar una clase de un período ya
 * liquidado y pagado merece saber, antes de guardar, que eso va a mover la
 * liquidación de alguien. No para pedirle permiso al sistema — para que no se
 * entere después.
 */

import type { createClient } from "@/lib/supabase/server";
import { COLS_VIGENCIA, enVigencia, type VigenciaCurso } from "@/lib/vigencia";

type Cliente = Awaited<ReturnType<typeof createClient>>;

/** Último día del mes al que pertenece `iso` (el período es su primer día). */
export function finDelMes(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  const d = new Date(y, m, 0); // día 0 del mes siguiente = último del mes
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Una liquidación que un cambio en esta clase haría recalcular. */
export type LiquidacionTocada = {
  profesor: string;
  periodo: string;
  /** `'pagada'` o `'cerrada'`: ya salió plata, así que el ajuste se va a notar. */
  estado: string;
  /** El alumno de la membresía que mete esta clase en ese período. */
  alumno: string;
};

export type Impacto = {
  /** `curso|fecha` → las liquidaciones que esa clase podría mover. */
  clases: Map<string, LiquidacionTocada[]>;
};

/**
 * Las clases de las que depende una comisión **ya cobrada**, con qué
 * liquidación moverían.
 *
 * Se mira solo lo `pagada`/`cerrada` a propósito. Si la liquidación sigue
 * `abierta` —nada pagado— el cambio se absorbe solo: `revertirDevengosAbiertos`
 * da de baja el devengo y se recalcula en la próxima corrida, sin que nadie
 * tenga que enterarse de nada. Avisar ahí sería ruido.
 *
 * Se lee una vez y se consulta muchas: la pantalla de asistencia pregunta por
 * una fecha, pero la venta pregunta por varias.
 */
export async function cargarImpacto(sb: Cliente): Promise<Impacto> {
  const clases = new Map<string, LiquidacionTocada[]>();
  const sumar = (k: string, l: LiquidacionTocada) => {
    const ya = clases.get(k);
    if (ya) {
      // La misma liquidación puede llegar por varias membresías: una vez basta.
      if (!ya.some((x) => x.profesor === l.profesor && x.periodo === l.periodo && x.alumno === l.alumno))
        ya.push(l);
    } else clases.set(k, [l]);
  };

  // 1. Comisiones cuya liquidación ya tiene plata encima.
  const { data: com } = await sb
    .from("comisiones_devengadas")
    .select("membresia_id, profesor:profesores(nombre, apellido), liquidacion:liquidaciones(estado, periodo)");
  const porMembresia = new Map<number, LiquidacionTocada[]>();
  for (const c of (com as unknown as {
    membresia_id: number | null;
    profesor: { nombre: string; apellido: string } | null;
    liquidacion: { estado: string; periodo: string } | null;
  }[]) ?? []) {
    if (c.membresia_id == null) continue;
    if (c.liquidacion?.estado !== "pagada" && c.liquidacion?.estado !== "cerrada") continue;
    const ya = porMembresia.get(c.membresia_id) ?? [];
    ya.push({
      profesor: c.profesor ? `${c.profesor.apellido}, ${c.profesor.nombre}` : "un profesor",
      periodo: c.liquidacion.periodo,
      estado: c.liquidacion.estado,
      alumno: "",
    });
    porMembresia.set(c.membresia_id, ya);
  }
  if (porMembresia.size === 0) return { clases };

  // 2. Sus días de clase: esas son las fechas sobre las que hay que avisar.
  //    A diferencia del viejo congelador, acá entran TODAS las membresías
  //    devengadas, no solo las multi-curso: desde que existe el ajuste, un
  //    cambio de titular o un reemplazo administrativo puede mover el reparto
  //    de una mono-curso también (cambia de quién es la plata, no cuánta).
  const ids = [...porMembresia.keys()];
  const { data: ic } = await sb
    .from("inscripcion_cursos")
    .select("inscripcion_id, curso_id, dias, fecha")
    .in("inscripcion_id", ids);
  const filas =
    (ic as { inscripcion_id: number; curso_id: number; dias: number[] | null; fecha: string | null }[]) ?? [];
  const porInsc = new Map<number, typeof filas>();
  for (const r of filas) {
    const ya = porInsc.get(r.inscripcion_id);
    if (ya) ya.push(r);
    else porInsc.set(r.inscripcion_id, [r]);
  }

  const { data: insc } = await sb
    .from("inscripciones")
    .select("id, fecha_inicio, fecha_fin, alumno:alumnos(nombre, apellido)")
    .in("id", ids);
  const cursos = new Map<number, number[]>();
  const vigencias = new Map<number, VigenciaCurso>();
  const { data: cur } = await sb
    .from("cursos")
    .select(`id, dias_semana, ${COLS_VIGENCIA}`)
    .in("id", [...new Set(filas.map((f) => f.curso_id))]);
  for (const c of (cur as unknown as ({ id: number; dias_semana: number[] } & VigenciaCurso)[]) ?? []) {
    cursos.set(c.id, c.dias_semana ?? []);
    vigencias.set(c.id, { vigente_desde: c.vigente_desde, vigente_hasta: c.vigente_hasta });
  }

  for (const m of (insc as unknown as {
    id: number;
    fecha_inicio: string;
    fecha_fin: string | null;
    alumno: { nombre: string; apellido: string } | null;
  }[]) ?? []) {
    if (!m.fecha_fin) continue;
    const quien = m.alumno ? `${m.alumno.apellido}, ${m.alumno.nombre}` : `#${m.id}`;
    const tocadas = (porMembresia.get(m.id) ?? []).map((l) => ({ ...l, alumno: quien }));
    for (const f of porInsc.get(m.id) ?? []) {
      if (f.fecha) {
        if (enVigencia(vigencias.get(f.curso_id), f.fecha))
          for (const l of tocadas) sumar(`${f.curso_id}|${f.fecha.slice(0, 10)}`, l);
        continue;
      }
      const dias = f.dias?.length ? f.dias : cursos.get(f.curso_id) ?? [];
      if (!dias.length) continue;
      const d = new Date(m.fecha_inicio + "T00:00:00");
      const fin = new Date(m.fecha_fin + "T00:00:00");
      for (let i = 0; i < 400 && d <= fin; i++, d.setDate(d.getDate() + 1)) {
        const dia = d.getDay() === 0 ? 7 : d.getDay();
        if (!dias.includes(dia)) continue;
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        // Fuera de la vigencia del curso no hay clase: ese día no entró en
        // ningún conteo, así que tocarlo no mueve nada (0033).
        if (!enVigencia(vigencias.get(f.curso_id), iso)) continue;
        for (const l of tocadas) sumar(`${f.curso_id}|${iso}`, l);
      }
    }
  }
  return { clases };
}

/** Las liquidaciones que un cambio en esta clase haría recalcular. Vacío = ninguna. */
export function liquidacionesTocadas(
  i: Impacto,
  cursoId: number,
  fechaISO: string
): LiquidacionTocada[] {
  return i.clases.get(`${cursoId}|${fechaISO.slice(0, 10)}`) ?? [];
}

/**
 * El texto del aviso. Dice **qué va a pasar**, no que no se pueda.
 *
 * Nombra al profesor y el período porque es lo que le permite a quien opera
 * decidir con criterio —y, si hace falta, avisarle—. Toda notificación que
 * nombra a una persona lleva su mecanismo de copiar (regla de proceso 12); el
 * host se lo agrega.
 */
export function avisoDeImpacto(fechaISO: string, tocadas: LiquidacionTocada[]): string {
  if (tocadas.length === 0) return "";
  const lista = tocadas
    .map((t) => `${t.profesor} (${t.periodo.slice(0, 7)}, ${t.estado})`)
    .join(" · ");
  return (
    `Esa clase (${fechaISO}) entra en el ciclo de una membresía ya liquidada y cobrada. ` +
    `Guardar la va a recalcular, y la diferencia va a salir como un ajuste en ${
      tocadas.length === 1 ? "la liquidación de" : "las liquidaciones de"
    } ${lista}. ` +
    `Lo ya pagado no se reescribe: el ajuste se suma como complemento de ese mismo período.`
  );
}
