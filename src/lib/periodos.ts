/**
 * Hasta dónde se puede tocar el pasado.
 *
 * **El problema.** Desde que la comisión se reparte a prorrata (regla de
 * negocio 10), el monto que cobra cada profesor depende de **cuántas clases
 * puso su curso**. Entonces suspender una clase vieja, reabrirla o corregir una
 * asistencia no son hechos inocentes: cambian el peso del reparto. Si esa
 * comisión ya se pagó, el cambio deja la plata que salió sin respaldo en los
 * datos, y nadie se entera.
 *
 * **Lo que NO es el problema, y antes se trataba como si lo fuera.** La primera
 * versión de esta regla congelaba el mes entero, para todos los cursos y todos
 * los profesores, apenas alguien cobrara una liquidación. Era mucho más amplio
 * que el daño que evita, por dos motivos que se midieron:
 *
 * 1. **Una membresía de un solo curso no depende del conteo.** Con un solo
 *    curso el reparto es trivial: lo cobrado va entero a ese curso, se hayan
 *    dictado tres clases o doce. Cambiar una clase suya no mueve un peso.
 * 2. **Agregar una membresía nueva no toca lo ya repartido.** Cada venta se
 *    reparte sola, con su propia plata. Liquidar después, o complementar una
 *    liquidación con una membresía que apareció más tarde, es seguro.
 *
 * **La regla** (regla de negocio 16, revisada con Javier el 2026-09-12, sobre
 * su decisión original del 11/09): lo que no se puede tocar es una clase que
 * cambiaría el conteo de una membresía **con prorrateo —dos o más cursos—**
 * cuya comisión **ya se pagó**. El corte sigue siendo el primer pago: una
 * liquidación `cerrada` tiene pago parcial y esa plata ya salió. El alcance ya
 * no es el mes: es esa clase.
 *
 * Si hay que corregir algo congelado, se hace con un ajuste con fecha de hoy,
 * que deja rastro — nunca reescribiendo el pasado.
 *
 * **Lo que sigue protegiendo la regla 5**, y que esta no reemplaza: una
 * membresía ya devengada no cambia sus fechas en silencio. Angostar la 16 no
 * toca esa otra garantía.
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

/**
 * Las membresías **con prorrateo y ya pagadas** que cubren cada clase.
 *
 * Se lee una vez y se consulta muchas: la pantalla de asistencia pregunta por
 * una fecha, pero la venta pregunta por varias.
 */
export type Congelador = {
  /** `curso|fecha` → nombre del alumno de la membresía que la congela. */
  clases: Map<string, string>;
};

export async function cargarCongelador(sb: Cliente): Promise<Congelador> {
  const clases = new Map<string, string>();

  // 0. Una clase cuyo DESCUENTO ya se pagó también está congelada: si se
  //    pudiera editar el costo del reemplazo después de pagarlo, el número que
  //    salió de la caja dejaría de coincidir con el dato (regla 20a + 16).
  //    Esta es directa —el descuento apunta a la sesión— y no pasa por el
  //    prorrateo.
  const { data: desc } = await sb
    .from("descuentos_liquidacion")
    .select("sesion_id, sesion:sesiones(curso_id, fecha), liquidacion:liquidaciones(estado)");
  for (const d of (desc as unknown as {
    sesion_id: number | null;
    sesion: { curso_id: number; fecha: string } | null;
    liquidacion: { estado: string } | null;
  }[]) ?? []) {
    if (!d.sesion) continue;
    if (d.liquidacion?.estado !== "pagada" && d.liquidacion?.estado !== "cerrada") continue;
    clases.set(`${d.sesion.curso_id}|${d.sesion.fecha.slice(0, 10)}`, "un descuento ya pagado");
  }

  // 1. Comisiones que ya tienen plata encima: su liquidación cobró algo.
  const { data: com } = await sb
    .from("comisiones_devengadas")
    .select("membresia_id, liquidacion:liquidaciones(estado)");
  const pagadas = new Set(
    ((com as unknown as { membresia_id: number | null; liquidacion: { estado: string } | null }[]) ?? [])
      .filter((c) => c.membresia_id != null && (c.liquidacion?.estado === "pagada" || c.liquidacion?.estado === "cerrada"))
      .map((c) => c.membresia_id as number)
  );
  if (pagadas.size === 0) return { clases };

  // 2. De esas, las que reparten entre DOS O MÁS cursos. Una mono-curso no
  //    depende del conteo: su plata es la misma con cualquier cantidad.
  const { data: ic } = await sb
    .from("inscripcion_cursos")
    .select("inscripcion_id, curso_id, dias, fecha")
    .in("inscripcion_id", [...pagadas]);
  const filas =
    (ic as { inscripcion_id: number; curso_id: number; dias: number[] | null; fecha: string | null }[]) ?? [];
  const porInsc = new Map<number, typeof filas>();
  for (const r of filas) {
    const ya = porInsc.get(r.inscripcion_id);
    if (ya) ya.push(r);
    else porInsc.set(r.inscripcion_id, [r]);
  }
  const conProrrateo = [...porInsc.entries()].filter(([, f]) => f.length > 1).map(([id]) => id);
  if (conProrrateo.length === 0) return { clases };

  // 3. Sus períodos y sus días: esas son las clases congeladas.
  const { data: insc } = await sb
    .from("inscripciones")
    .select("id, fecha_inicio, fecha_fin, alumno:alumnos(nombre, apellido)")
    .in("id", conProrrateo);
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
    for (const f of porInsc.get(m.id) ?? []) {
      if (f.fecha) {
        if (enVigencia(vigencias.get(f.curso_id), f.fecha))
          clases.set(`${f.curso_id}|${f.fecha.slice(0, 10)}`, quien);
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
        // Fuera de la vigencia del curso no hay clase que congelar: ese día no
        // entró en ningún conteo, así que tocarlo no mueve plata (0033).
        if (!enVigencia(vigencias.get(f.curso_id), iso)) continue;
        clases.set(`${f.curso_id}|${iso}`, quien);
      }
    }
  }
  return { clases };
}

/** ¿Esta clase está congelada porque una comisión ya pagada depende de ella? */
export function claseCongelada(c: Congelador, cursoId: number, fechaISO: string): string | null {
  return c.clases.get(`${cursoId}|${fechaISO.slice(0, 10)}`) ?? null;
}

/**
 * El mensaje que ve la persona. Dice **por qué** no se puede y **qué hacer**:
 * un "no se puede" a secas manda a buscar el problema donde no está.
 */
export function motivoCongelada(fechaISO: string, quien: string): string {
  if (quien === "un descuento ya pagado")
    return (
      `Esa clase (${fechaISO}) tiene un descuento al profesor que ya se pagó. ` +
      `Cambiarla movería plata que ya salió de la caja. ` +
      `Si hay que corregirlo, se hace con un ajuste con fecha de hoy.`
    );
  return (
    `Esa clase (${fechaISO}) entra en el ciclo de una membresía multi-curso de ${quien} ` +
    `cuya comisión ya se pagó a los profesores. Cambiarla movería el reparto de plata que ya salió. ` +
    `Si hay que corregirlo, se hace con un ajuste con fecha de hoy.`
  );
}
