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
