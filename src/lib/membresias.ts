import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerParametro } from "@/lib/sesion";

/**
 * Motor de membresías: el ciclo de vida de una membresía, compartido por todo
 * el que pueda cerrarla. Hoy lo tocan dos flujos —tomar asistencia (consume
 * clases) y cobrar (salda la deuda)—, y los dos tienen que llegar a la misma
 * conclusión, así que la regla vive acá y no en cada pantalla.
 *
 * No es "use server": son piezas internas, no acciones expuestas al cliente.
 */

export type ClienteAdmin = NonNullable<ReturnType<typeof createAdminClient>>;

type EstadoAsistencia = "presente" | "ausente";

/**
 * Recalcula una membresía desde sus asistencias.
 *
 * **Regla base del modelo:** una membresía se cierra (`completada`) cuando se
 * cumplen las DOS condiciones — el ciclo se agotó Y está íntegramente cobrada.
 * Agotada pero con saldo, sigue `activa`: la venta no terminó. Que ya no tome
 * más clases es cosa aparte, y lo resuelve el padrón (`cicloAgotado` en
 * `cargarPadron`), no el estado.
 *
 * Qué significa "agotado" según cómo se vendió:
 *  - **Plan con N clases:** ocurrieron N (=`clases_plan`) sesiones DICTADAS de
 *    la membresía. La falta, justificada o no, no lo alarga: la clase pasó.
 *  - **Paquete por clase (sin plan, `clases_total`):** consumió las clases
 *    compradas. Solo la asistencia consume paquete; una falta no lo gasta, así
 *    que el alumno conserva su clase.
 *
 * Además, para los planes con N: `clases_hechas` = clases a las que ASISTIÓ
 * (presentes) -> se muestra "X/N"; `bono_generado` = faltas CON licencia (tope
 * `tolerancia_faltas` del plan), la clase de tolerancia que se redime al
 * renovar. Una sola falta SIN licencia deja el bono en 0: la tolerancia premia
 * al ciclo sin faltas injustificadas. Los paquetes por clase no generan bono.
 *
 * Las membresías ilimitadas (plan por fecha, sin N) no se cierran acá: su ciclo
 * termina por `fecha_fin`. No toca las dadas de baja. Devuelve true si quedó
 * completada.
 */
export async function recalcularMembresia(a: ClienteAdmin, inscripcionId: number): Promise<boolean> {
  const { data: insc } = await a
    .from("inscripciones")
    .select("id, plan_id, clases_plan, clases_total, estado, tolerancia_faltas")
    .eq("id", inscripcionId)
    .maybeSingle();
  if (!insc || insc.estado === "baja") return false;
  const esPlanConN = insc.plan_id != null && insc.clases_plan != null;
  if (!esPlanConN && insc.clases_total == null) return false;

  const { data: asis } = await a
    .from("asistencias")
    .select("sesion_id, estado, con_licencia")
    .eq("inscripcion_id", inscripcionId);
  const rows = (asis as { sesion_id: number; estado: EstadoAsistencia; con_licencia: boolean }[]) ?? [];

  let dictadas = 0; // sesiones de la membresía efectivamente dictadas
  let presentes = 0; // asistió
  let faltasConLic = 0; // faltas justificadas
  let faltasSinLic = 0; // faltas sin justificar: anulan el bono del ciclo
  if (rows.length) {
    const sesIds = [...new Set(rows.map((r) => r.sesion_id))];
    const { data: ses } = await a.from("sesiones").select("id, estado").in("id", sesIds);
    const dictadasSet = new Set(
      ((ses as { id: number; estado: string }[]) ?? [])
        .filter((s) => s.estado === "dictada")
        .map((s) => s.id)
    );
    for (const r of rows) {
      if (!dictadasSet.has(r.sesion_id)) continue;
      dictadas++;
      if (r.estado === "presente") presentes++;
      else if (r.con_licencia) faltasConLic++;
      else faltasSinLic++;
    }
  }

  if (!esPlanConN) {
    const consumido = presentes >= (insc.clases_total as number);
    // El saldo solo se consulta si ya se consumió: es la única situación en la
    // que puede cambiar el estado, y así no se pega a la base al pedo.
    const cerrado = consumido && (await saldoDeMembresia(a, inscripcionId)) <= 0;
    await a
      .from("inscripciones")
      .update({
        clases_hechas: presentes,
        estado: cerrado ? "completada" : "activa",
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", inscripcionId);
    return cerrado;
  }

  // El fin de ciclo se mantiene junto con los contadores: si una sesion cambio
  // de estado, la fecha tiene que seguirla.
  await recalcularFinDeCiclo(a, inscripcionId);

  const clasesPlan = insc.clases_plan as number;
  const tolerancia = await toleranciaDe(a, insc.plan_id as number, insc.tolerancia_faltas as number | null);
  const bono = faltasSinLic > 0 ? 0 : Math.min(faltasConLic, Math.max(0, tolerancia));
  // Se cierra solo si además está cobrada; el saldo se consulta únicamente
  // cuando el ciclo ya se agotó, que es cuando puede cambiar el estado.
  const completada = dictadas >= clasesPlan && (await saldoDeMembresia(a, inscripcionId)) <= 0;
  await a
    .from("inscripciones")
    .update({
      clases_hechas: presentes,
      bono_generado: bono,
      estado: completada ? "completada" : "activa",
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", inscripcionId);
  return completada;
}

// ── Fin de ciclo: se calcula desde las clases que REALMENTE ocurrieron ────

/**
 * Fecha de la última clase del ciclo, contando solo las clases que de verdad
 * cuentan: una sesión **suspendida** no consume ciclo, así que corre el fin
 * hacia adelante (política de corrimiento).
 *
 * **Por qué se calcula y no se guarda paso a paso.** Antes el fin de ciclo se
 * fijaba en la venta proyectando días de calendario, y cada suspensión lo movía
 * con un evento aparte. Eso lo dejaba a merced del ORDEN: una membresía vendida
 * con fecha retroactiva sobre una clase ya suspendida nunca recibía su
 * corrimiento, porque el evento había pasado antes de que ella existiera.
 * Calculándolo desde los hechos, da lo mismo el orden — es lo que pidió Javier
 * al pedir que funcione "en cualquier caso".
 *
 * Devuelve `null` si la membresía no tiene N (ilimitada o paquete sin días).
 */
export async function finDeCicloReal(
  a: ClienteAdmin,
  inscripcionId: number
): Promise<string | null> {
  const { data: insc } = await a
    .from("inscripciones")
    .select("id, fecha_inicio, clases_plan, plan_id")
    .eq("id", inscripcionId)
    .maybeSingle();
  if (!insc?.fecha_inicio || insc.clases_plan == null) return null;
  const n = Number(insc.clases_plan);
  if (!(n > 0)) return null;

  const { data: ic } = await a
    .from("inscripcion_cursos")
    .select("curso_id, dias")
    .eq("inscripcion_id", inscripcionId);
  const cursos = ((ic as { curso_id: number; dias: number[] }[]) ?? []).filter(
    (c) => c.dias?.length
  );
  if (!cursos.length) return null;

  // Las suspensiones de esos cursos desde el inicio: una clase suspendida no
  // cuenta para el ciclo.
  const { data: ses } = await a
    .from("sesiones")
    .select("curso_id, fecha")
    .in("curso_id", cursos.map((c) => c.curso_id))
    .eq("estado", "suspendida")
    .gte("fecha", insc.fecha_inicio as string);
  const suspendidas = new Set(
    ((ses as { curso_id: number; fecha: string }[]) ?? []).map((s) => `${s.curso_id}|${s.fecha}`)
  );

  return caminarClases(insc.fecha_inicio as string, cursos, suspendidas, n);
}

/**
 * Hasta cuándo puede renovar sin perder el bono de tolerancia: la siguiente
 * clase del calendario después del fin de ciclo. `null` si no aplica.
 */
export async function renovacionBonificada(
  a: ClienteAdmin,
  inscripcionId: number
): Promise<string | null> {
  const fin = await finDeCicloReal(a, inscripcionId);
  if (!fin) return null;

  const { data: ic } = await a
    .from("inscripcion_cursos")
    .select("curso_id, dias")
    .eq("inscripcion_id", inscripcionId);
  const cursos = ((ic as { curso_id: number; dias: number[] }[]) ?? []).filter(
    (c) => c.dias?.length
  );
  if (!cursos.length) return null;

  const { data: ses } = await a
    .from("sesiones")
    .select("curso_id, fecha")
    .in("curso_id", cursos.map((c) => c.curso_id))
    .eq("estado", "suspendida")
    .gt("fecha", fin);
  const suspendidas = new Set(
    ((ses as { curso_id: number; fecha: string }[]) ?? []).map((s) => `${s.curso_id}|${s.fecha}`)
  );

  // Una clase más, arrancando el día siguiente al fin de ciclo.
  const desde = sumarDiasISO(fin, 1);
  return caminarClases(desde, cursos, suspendidas, 1);
}

/**
 * Recorre el calendario desde `desdeISO` juntando `n` clases que cuentan, y
 * devuelve la fecha de la n-ésima. Una membresía puede tener varios cursos: si
 * dos caen el mismo día, ese día aporta dos clases.
 *
 * Es pura a propósito: la comparten el motor (que lee con el cliente admin) y
 * el estado de cuenta (que lee con el de sesión), sin duplicar la regla.
 * `suspendidas` son claves `cursoId|YYYY-MM-DD`.
 */
export function caminarClases(
  desdeISO: string,
  cursos: { curso_id: number; dias: number[] }[],
  suspendidas: Set<string>,
  n: number
): string | null {
  const d = parseISOLocal(desdeISO);
  let acc = 0;
  for (let i = 0; i < 800; i++) {
    const dia = diaSemanaISO(d);
    const iso = isoLocal(d);
    for (const c of cursos) {
      if (!c.dias.includes(dia)) continue;
      if (suspendidas.has(`${c.curso_id}|${iso}`)) continue;
      acc++;
    }
    if (acc >= n) return iso;
    d.setDate(d.getDate() + 1);
  }
  return null;
}

function parseISOLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function diaSemanaISO(d: Date): number {
  const wd = d.getDay();
  return wd === 0 ? 7 : wd;
}
export function sumarDiasISO(iso: string, n: number): string {
  const d = parseISOLocal(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

/**
 * Deja la traza de las suspensiones que corren el ciclo de una membresía y que
 * todavía no la tienen. Es el agujero que dejaba la venta retroactiva:
 * `suspenderClase` solo alcanza a las membresías que existen en ese momento, y
 * una vendida después sobre esas mismas fechas nunca recibía su corrimiento.
 *
 * Reconstruye el antes/después real de cada suspensión, en orden de fecha:
 * "antes" es el fin de ciclo contando solo las suspensiones anteriores a ella.
 * Devuelve cuántas filas agregó.
 */
export async function registrarCorrimientosPendientes(
  a: ClienteAdmin,
  inscripcionId: number,
  registradoPor: string | null
): Promise<number> {
  const { data: insc } = await a
    .from("inscripciones")
    .select("id, alumno_id, fecha_inicio, fecha_fin, clases_plan, estado")
    .eq("id", inscripcionId)
    .maybeSingle();
  if (!insc || insc.estado === "baja" || insc.clases_plan == null || !insc.fecha_inicio) return 0;
  const n = Number(insc.clases_plan);
  if (!(n > 0)) return 0;

  const { data: ic } = await a
    .from("inscripcion_cursos")
    .select("curso_id, dias")
    .eq("inscripcion_id", inscripcionId);
  const cursos = ((ic as { curso_id: number; dias: number[] }[]) ?? []).filter((c) => c.dias?.length);
  if (!cursos.length) return 0;

  const hasta = (insc.fecha_fin as string | null) ?? null;
  let q = a
    .from("sesiones")
    .select("id, curso_id, fecha, motivo")
    .in("curso_id", cursos.map((c) => c.curso_id))
    .eq("estado", "suspendida")
    .gte("fecha", insc.fecha_inicio as string);
  if (hasta) q = q.lte("fecha", hasta);
  const { data: ses } = await q;
  const suspendidas = ((ses as { id: number; curso_id: number; fecha: string; motivo: string | null }[]) ?? [])
    .sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : x.curso_id - y.curso_id));
  if (!suspendidas.length) return 0;

  const { data: yaHay } = await a
    .from("corrimientos_ciclo")
    .select("sesion_id")
    .eq("inscripcion_id", inscripcionId);
  const conTraza = new Set(
    ((yaHay as { sesion_id: number | null }[]) ?? []).map((r) => r.sesion_id).filter((x): x is number => x != null)
  );

  const inicio = insc.fecha_inicio as string;
  let agregadas = 0;
  const acumuladas = new Set<string>();
  for (const s of suspendidas) {
    const antes = caminarClases(inicio, cursos, new Set(acumuladas), n);
    acumuladas.add(`${s.curso_id}|${s.fecha}`);
    const despues = caminarClases(inicio, cursos, new Set(acumuladas), n);
    if (conTraza.has(s.id)) continue;
    const { error } = await a.from("corrimientos_ciclo").insert({
      inscripcion_id: inscripcionId,
      alumno_id: insc.alumno_id,
      sesion_id: s.id,
      tipo: "suspension",
      fecha_clase: s.fecha,
      fin_ciclo_anterior: antes,
      fin_ciclo_nuevo: despues,
      motivo: s.motivo,
      registrado_por: registradoPor,
    });
    if (!error) agregadas++;
  }
  return agregadas;
}

/** ¿Esta membresía ya devengó comisión? Sus fechas no se tocan en silencio. */
export async function tieneComisionDevengada(
  a: ClienteAdmin,
  inscripcionId: number
): Promise<boolean> {
  const { data } = await a
    .from("comisiones_devengadas")
    .select("id")
    .eq("membresia_id", inscripcionId)
    .limit(1);
  return (((data as { id: number }[]) ?? []).length) > 0;
}

/**
 * Deja `inscripciones.fecha_fin` en la fecha que corresponde según las clases
 * reales. Devuelve qué pasó, para poder reportarlo.
 */
export async function recalcularFinDeCiclo(
  a: ClienteAdmin,
  inscripcionId: number
): Promise<{ estado: "sin_cambio" | "actualizado" | "no_aplica" | "bloqueado_devengada"; antes: string | null; despues: string | null }> {
  const { data: insc } = await a
    .from("inscripciones")
    .select("id, fecha_fin, estado")
    .eq("id", inscripcionId)
    .maybeSingle();
  if (!insc || insc.estado === "baja")
    return { estado: "no_aplica", antes: null, despues: null };

  const antes = (insc.fecha_fin as string | null) ?? null;
  const despues = await finDeCicloReal(a, inscripcionId);
  if (!despues) return { estado: "no_aplica", antes, despues: null };
  if (antes === despues) return { estado: "sin_cambio", antes, despues };

  // Ya liquidada: la fecha define en qué período entró la comisión. No se
  // cambia sola; se reporta para que alguien decida.
  if (await tieneComisionDevengada(a, inscripcionId))
    return { estado: "bloqueado_devengada", antes, despues };

  await a
    .from("inscripciones")
    .update({ fecha_fin: despues, actualizado_en: new Date().toISOString() })
    .eq("id", inscripcionId);
  return { estado: "actualizado", antes, despues };
}

/**
 * Saldo pendiente de una membresía: lo devengado en sus cuotas menos lo
 * cubierto (pago + descuento). Sin cuotas devuelve 0: no hay nada que cobrar.
 */
export async function saldoDeMembresia(a: ClienteAdmin, inscripcionId: number): Promise<number> {
  const { data: cuotas } = await a
    .from("cuotas")
    .select("id, monto_devengado, descuento_adelanto")
    .eq("inscripcion_id", inscripcionId);
  const filas = (cuotas as { id: number; monto_devengado: number; descuento_adelanto: number }[]) ?? [];
  if (!filas.length) return 0;

  const { data: pagos } = await a
    .from("pagos")
    .select("cuota_id, monto, descuento")
    .eq("tipo", "cobro")
    .in("cuota_id", filas.map((c) => c.id));
  const cubierto: Record<number, number> = {};
  for (const p of (pagos as { cuota_id: number | null; monto: number; descuento: number }[]) ?? [])
    if (p.cuota_id != null)
      cubierto[p.cuota_id] = (cubierto[p.cuota_id] ?? 0) + Number(p.monto) + Number(p.descuento);

  let saldo = 0;
  for (const c of filas)
    saldo += Math.max(0, Number(c.monto_devengado) - Number(c.descuento_adelanto) - (cubierto[c.id] ?? 0));
  return saldo;
}

/** Tolerancia de faltas efectiva: snapshot de la membresía, si no el plan, si no el parámetro. */
export async function toleranciaDe(a: ClienteAdmin, planId: number, snapshot: number | null): Promise<number> {
  if (snapshot != null) return snapshot;
  const { data: plan } = await a.from("planes").select("tolerancia_faltas").eq("id", planId).maybeSingle();
  const t = (plan?.tolerancia_faltas as number | null) ?? null;
  if (t != null) return t;
  return Math.max(0, Number(await obtenerParametro("faltas_toleradas")) || 0);
}
