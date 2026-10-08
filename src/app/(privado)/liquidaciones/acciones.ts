"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual, alcanceDe, obtenerProfesorActual } from "@/lib/sesion";
import { imputarPago } from "@/lib/liquidacion/cuenta";
import { isoHoy, rangoLiquidable, primerDiaMesDe } from "@/lib/liquidacion/periodo";
import {
  calcularDescuentos,
  calcularLiquidacion,
  leerDatosMotor,
} from "@/lib/liquidacion/lecturas";
import { type MembresiaBloqueada } from "@/lib/liquidacion/motor";
import { liquidar, SIN_LIMITE } from "@/lib/liquidacion/liquidar";

// El cálculo del reparto vive en `@/lib/liquidacion/motor`, sin base de datos,
// para poder fijarlo con pruebas deterministas. Acá quedan las lecturas.
export type { DevengoPendiente, MembresiaBloqueada, LineaReparto } from "@/lib/liquidacion/motor";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}
type Admin = ReturnType<typeof admin>;

// `primerDiaMesVencidoISO`/`finMesVencidoISO`/`rangoLiquidable` viven ahora en
// `@/lib/liquidacion/periodo` (H5): las comparte el motor de particulares.

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
// Antes esto repartía usando `membresias.curso_id` —el curso principal de
// la venta— así que en un plan de cinco cursos un solo profesor se llevaba
// todo y los otros cuatro no cobraban.

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
  /** Particulares que no se pueden liquidar, con su motivo (calidad 5: se dice, no se esconde). */
  particularesBloqueadas: { alumno: string; motivo: string }[];
};

export type FilaLiquidacion = {
  id: number;
  profesorId: number;
  profesor: string;
  periodo: string;
  periodicidad: string;
  /** Fecha efectiva del retiro cuando la liquidación incluye su cierre; null = normal. */
  retiroHasta: string | null;
  estado: string;
  totalDevengado: number;
  /** Lo que se le descuenta (regla 20a). El neto ya lo resta. */
  totalDescuentos: number;
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
  if (!(await tienePermiso("liquidaciones", "ver"))) return { profesores: [], liquidaciones: [] };

  // Visibilidad "propio" (0043, default para el rol Profesor): solo ve sus
  // propias liquidaciones, procesadas o pendientes de proceso — nunca las de
  // otro profesor. Sin cuenta vinculada, no hay nada que mostrarle.
  const alcance = await alcanceDe("liquidaciones");
  const profesorActual = alcance === "propio" ? await obtenerProfesorActual() : null;
  if (alcance === "propio" && !profesorActual) return { profesores: [], liquidaciones: [] };

  const sb = await createClient();

  // El mismo rango que usa `generarLiquidacion`: el parámetro de periodicidad.
  const rango = rangoLiquidable((await obtenerParametro("periodicidad_liquidacion")) || "mes");
  if (!rango.ok) throw new Error(rango.error);
  const periodoVencido = rango.periodoVencido;
  const calculo = await calcularLiquidacion(sb, {
    tipo: "vencido", hastaISO: rango.hastaISO, periodoVencido, hoyISO: isoHoy(),
  });
  const { pendientes, bloqueadas } = calculo.regular;
  const particulares = calculo.particulares;
  // `count` son MEMBRESÍAS distintas, no líneas: un curso por profesor y un
  // avance dejan varias líneas de una misma membresía y la columna decía
  // "2 membresías" para una sola.
  const porProf = new Map<number, { monto: number; count: number }>();
  const membresiasPorProf = new Map<number, Set<number>>();
  for (const p of [...pendientes, ...particulares.pendientes]) {
    const cur = porProf.get(p.profesorId) ?? { monto: 0, count: 0 };
    cur.monto += p.monto;
    const ms = membresiasPorProf.get(p.profesorId) ?? new Set<number>();
    ms.add(p.membresiaId);
    membresiasPorProf.set(p.profesorId, ms);
    cur.count = ms.size;
    porProf.set(p.profesorId, cur);
  }
  const trabadasPorProf = new Map<number, MembresiaBloqueada[]>();
  for (const b of bloqueadas)
    for (const id of b.profesorIds) {
      const ya = trabadasPorProf.get(id);
      if (ya) ya.push(b);
      else trabadasPorProf.set(id, [b]);
    }

  const { data: profs } = await sb.from("profesores").select("id, contacto:contactos(nombre, apellido)");
  const profesores: FilaProfesor[] = (
    (profs as unknown as { id: number; contacto: { nombre: string | null; apellido: string | null } | null }[]) ?? []
  )
    .map((p) => ({
      profesorId: p.id,
      nombre: `${p.contacto?.apellido ?? ""}, ${p.contacto?.nombre ?? ""}`,
      pendienteMonto: porProf.get(p.id)?.monto ?? 0,
      pendienteCount: porProf.get(p.id)?.count ?? 0,
      sinRegistrar: porCurso(trabadasPorProf.get(p.id) ?? []),
      ventasEsperando: (trabadasPorProf.get(p.id) ?? []).length,
      particularesBloqueadas: particulares.bloqueadas
        .filter((b) => b.profesorId === p.id)
        .map((b) => ({ alumno: b.alumno, motivo: b.motivo })),
    }))
    .filter((p) => p.pendienteCount > 0 || p.ventasEsperando > 0 || p.particularesBloqueadas.length > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const { data: liqs } = await sb
    .from("liquidaciones")
    .select("id, profesor_id, periodo, periodicidad, retiro_hasta, estado, total_devengado, total_descuentos, total_pagado, neto")
    .order("periodo", { ascending: false });
  const profNombre = new Map(
    (
      (profs as unknown as { id: number; contacto: { nombre: string | null; apellido: string | null } | null }[]) ?? []
    ).map((p) => [p.id, `${p.contacto?.apellido ?? ""}, ${p.contacto?.nombre ?? ""}`])
  );
  const liquidaciones: FilaLiquidacion[] = ((liqs as {
    id: number;
    profesor_id: number;
    periodo: string;
    periodicidad: string;
    retiro_hasta: string | null;
    estado: string;
    total_devengado: number;
    total_descuentos: number;
    total_pagado: number;
    neto: number;
  }[]) ?? []).map((l) => ({
    id: l.id,
    profesorId: l.profesor_id,
    profesor: profNombre.get(l.profesor_id) ?? `#${l.profesor_id}`,
    periodo: l.periodo,
    periodicidad: l.periodicidad,
    retiroHasta: l.retiro_hasta,
    estado: l.estado,
    totalDevengado: Number(l.total_devengado),
    totalDescuentos: Number(l.total_descuentos ?? 0),
    totalPagado: Number(l.total_pagado),
    neto: Number(l.neto),
    // Solo la del período que se está liquidando puede quedar desactualizada:
    // los pendientes se calculan contra ese período.
    pendienteMonto: l.periodo === periodoVencido ? porProf.get(l.profesor_id)?.monto ?? 0 : 0,
    pendienteCount: l.periodo === periodoVencido ? porProf.get(l.profesor_id)?.count ?? 0 : 0,
    sinRegistrar: l.periodo === periodoVencido ? porCurso(trabadasPorProf.get(l.profesor_id) ?? []) : [],
    ventasEsperando: l.periodo === periodoVencido ? (trabadasPorProf.get(l.profesor_id) ?? []).length : 0,
  }));

  if (alcance === "propio" && profesorActual) {
    return {
      profesores: profesores.filter((p) => p.profesorId === profesorActual.id),
      liquidaciones: liquidaciones.filter((l) => l.profesorId === profesorActual.id),
    };
  }
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
    .from("membresia_cursos")
    .select("membresia_id, fecha")
    .eq("curso_id", cursoId);
  const candidatas = ((ic as { membresia_id: number; fecha: string | null }[]) ?? []).map(
    (r) => r.membresia_id
  );
  if (!candidatas.length) return 0;

  const { data: insc } = await a
    .from("membresias")
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
    .eq("curso_id", cursoId)
    // El cierre de cuentas de un profesor que se retiró no se recrea solo (el
    // criterio 1 todavía no corresponde): revertirlo lo perdería en silencio.
    .neq("tipo", "cierre");
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
  if (!(await tienePermiso("liquidaciones", "crear"))) return { error: "Sin permiso." };
  const a = admin();
  const sb = await createClient();

  const rango = rangoLiquidable((await obtenerParametro("periodicidad_liquidacion")) || "mes");
  if (!rango.ok) return { error: rango.error };
  const { periodicidad, periodoVencido: periodo, hastaISO } = rango;

  const todo = await calcularLiquidacion(sb, { tipo: "vencido", hastaISO, periodoVencido: periodo, hoyISO: isoHoy() });
  const calculo = todo.regular;
  const pendientes = calculo.pendientes.filter((p) => p.profesorId === profesorId);
  const calculoP = todo.particulares;
  const pendientesP = calculoP.pendientes.filter((p) => p.profesorId === profesorId);

  // Regla 17 revisada: las membresías con prorrateo y clases sin registrar ya
  // quedaron afuera de `pendientes`. El profesor **sí** liquida el resto: no
  // hay por qué trabarle la plata de diez membresías por una que espera un
  // trámite. La que espera entra después como complemento, y no se pierde
  // porque la clase que le falta sigue siendo editable (regla 16 revisada:
  // solo se congela una clase de la que depende un prorrateo YA pagado).
  if (pendientes.length === 0 && pendientesP.length === 0) {
    // Una particular que no se puede liquidar se dice con su motivo (calidad 5).
    const sinFoto = calculoP.bloqueadas.filter((b) => b.profesorId === profesorId);
    if (sinFoto.length > 0)
      return {
        error:
          "Hay clases particulares de este profesor que no se pueden liquidar: " +
          sinFoto.map((b) => `${b.alumno} — ${b.motivo}`).join(" | "),
      };
    const trabadas = calculo.bloqueadas.filter((b) => b.profesorIds.includes(profesorId));
    if (trabadas.length > 0)
      return {
        error:
          "Lo único pendiente de este profesor son membresías multi-curso con clases sin registrar. " +
          "Cargá la asistencia —o marcá la clase como suspendida— en Asistencia, y volvé a generar.",
      };
    return { error: "No hay devengos pendientes para este profesor." };
  }

  /**
   * La liquidación del profesor para un período: la que exista o una nueva.
   *
   * **Una liquidación ya pagada acepta un complemento** y eso es deliberado:
   * si aparece una membresía que en su momento no estaba (se vendió
   * retroactiva) o el recálculo de una que ya devengó da otro número, lo nuevo
   * se agrega y la liquidación vuelve a quedar con saldo. No se reescribe nada
   * de lo ya pagado — se suma el delta. *(Javier, 2026-09-18.)*
   */
  const cache = new Map<string, number>();
  const creadasAhora = new Set<number>();
  async function liquidacionDe(periodoDestino: string): Promise<number | { error: string }> {
    const ya = cache.get(periodoDestino);
    if (ya != null) return ya;
    const { data: existente } = await a
      .from("liquidaciones")
      .select("id")
      .eq("profesor_id", profesorId)
      .eq("periodo", periodoDestino)
      .eq("periodicidad", periodicidad)
      .maybeSingle();
    let id: number;
    if (existente) id = existente.id as number;
    else {
      const { data: nueva, error } = await a
        .from("liquidaciones")
        .insert({ profesor_id: profesorId, periodo: periodoDestino, periodicidad, estado: "abierta" })
        .select("id")
        .single();
      if (error) return { error: error.message };
      id = nueva.id as number;
      creadasAhora.add(id);
    }
    cache.set(periodoDestino, id);
    return id;
  }

  const liquidacionId = await liquidacionDe(periodo);
  if (typeof liquidacionId !== "number") return liquidacionId;

  // Devengar cada pendiente y crear su ítem.
  //
  // **Un ajuste va al período de la comisión que corrige**, no al mes vencido:
  // es la misma plata de aquel mes, que se recalculó. Por eso cada pendiente
  // dice a qué período pertenece y la liquidación destino se resuelve por ahí.
  for (const p of pendientes) {
    const destino = await liquidacionDe(p.periodo ?? periodo);
    if (typeof destino !== "number") return destino;
    const esAjuste = p.tipo === "ajuste";
    const esAvance = p.tipo === "avance";

    // La glosa tiene que dejar auditar el reparto sin abrir el código: de
    // cuánto se partió, qué parte le tocó a este curso y por qué.
    const detalleReparto =
      (p.base !== p.cobradoTotal && !esAjuste && !esAvance
        ? ` — parte de ${p.cobradoTotal} cobrado, a prorrata por ${p.clases} ${
            p.clases === 1 ? "clase" : "clases"
          }${p.personas > 1 ? ` x ${p.personas} personas` : ""}`
        : "") +
      // El curso lo dictó más de uno: sin esto, la base parece mal calculada
      // contra la parte del curso que muestra el reparto.
      (p.clases !== p.clasesDelCurso && !esAjuste && !esAvance
        ? ` — ${p.clases} de las ${p.clasesDelCurso} clases del curso (cambio de titular en el ciclo)`
        : "");

    const { data: com, error: errCom } = await a
      .from("comisiones_devengadas")
      .insert({
        profesor_id: p.profesorId,
        membresia_id: p.membresiaId,
        curso_id: p.cursoId,
        criterio: p.criterio,
        periodo: p.periodo ?? periodo,
        tipo: p.tipo,
        ajusta_comision_id: p.ajustaComisionId ?? null,
        base: p.base,
        monto: p.monto,
        // Foto del reparto: el comprobante la lee en vez de recalcular, para
        // que el mismo papel diga siempre lo mismo (regla 12).
        reparto: p.reparto.length > 1 ? p.reparto : null,
        origen: esAjuste
          ? `Ajuste por recálculo de la membresía (${p.curso} / ${p.alumno}): ` +
            `${p.base >= 0 ? "faltaba" : "sobraba"} ${Math.abs(p.base)} de base, ` +
            `${p.base >= 0 ? "se le suma" : "se le descuenta"} ${Math.abs(p.monto)}. ` +
            `Lo ya liquidado no se reescribe: entra como complemento del período.`
          : esAvance
            ? `Criterio 2, avance a la fecha (${p.curso} / ${p.alumno}): ${p.pct}% de ${p.base} (${p.clases} de ${p.clasesDelCurso} clases dictadas). ` +
              `Se paga lo dictado menos lo ya devengado, en el período que se liquida.`
            : `Criterio ${p.criterio}: ${p.pct}% de ${p.base} (${p.curso} / ${p.alumno})` + detalleReparto,
        liquidacion_id: destino,
      })
      .select("id")
      .single();
    if (errCom) return { error: "Falló devengar una comisión: " + errCom.message };
    await a.from("liquidacion_items").insert({
      liquidacion_id: destino,
      comision_id: com.id,
      membresia_id: p.membresiaId,
      descripcion: esAjuste
        ? `Ajuste · ${p.alumno} — ${p.curso} (recálculo de la membresía)`
        : esAvance
          ? `Avance · ${p.alumno} — ${p.curso} (${p.clases}/${p.clasesDelCurso} clases · ${p.pct}% de ${p.base})`
          : `${p.alumno} — ${p.curso} (${p.pct}% de ${p.base})` +
          (p.base !== p.cobradoTotal ? ` · parte de ${p.cobradoTotal}` : "") +
          (p.clases !== p.clasesDelCurso ? ` · ${p.clases}/${p.clasesDelCurso} clases` : ""),
      monto: p.monto,
    });
  }

  // Clases particulares (H5). Mismo mecanismo: comisión la primera vez, ajuste
  // firmado al período original cuando el recálculo cambia (criterios 1 y 3), o
  // `avance` en el período que se liquida (criterio 2, excepción a la regla 16).
  for (const p of pendientesP) {
    const destino = await liquidacionDe(p.periodo);
    if (typeof destino !== "number") return destino;
    const d = p.detalle;
    const cuanto =
      d.forma === "fee_hora"
        ? `${d.horasDadas} h × ${d.fee}`
        : d.forma === "monto_fijo"
          ? `monto fijo ${d.montoFijo}${d.factor < 1 ? ` × ${d.factor}` : ""}`
          : `${d.pct}% de ${p.base} (cobrado ${d.cobrado}${d.costoSala != null ? ` − sala ${d.costoSala}` : ""})${d.factor < 1 ? ` × ${d.factor}` : ""}`;
    const origen =
      p.tipo === "ajuste"
        ? `Ajuste por recálculo de la particular (${p.alumno}): objetivo ${d.objetivo}, ya devengado ${d.yaDevengado}. Lo ya liquidado no se reescribe: entra como complemento del período.`
        : p.tipo === "avance"
          ? `Criterio 2, avance a la fecha (${p.alumno}): objetivo ${d.objetivo}, ya devengado ${d.yaDevengado} — ${d.horasDadas} de ${d.horasContratadas} h.`
          : `Criterio ${p.criterio} (${p.alumno}): ${cuanto}` +
            (d.completadaPor === "vencimiento" ? ` — venció con horas sin usar (${d.modoVencida})` : "");
    const { data: com, error: errCom } = await a
      .from("comisiones_devengadas")
      .insert({
        profesor_id: p.profesorId,
        membresia_id: p.membresiaId,
        plan_id: p.planId,
        curso_id: null,
        criterio: p.criterio,
        periodo: p.periodo,
        tipo: p.tipo,
        ajusta_comision_id: p.ajustaComisionId ?? null,
        base: p.base,
        monto: p.monto,
        detalle_particular: p.detalle,
        origen,
        liquidacion_id: destino,
      })
      .select("id")
      .single();
    if (errCom) return { error: "Falló devengar una comisión de particular: " + errCom.message };
    await a.from("liquidacion_items").insert({
      liquidacion_id: destino,
      comision_id: com.id,
      membresia_id: p.membresiaId,
      descripcion:
        (p.tipo === "ajuste" ? "Ajuste · " : p.tipo === "avance" ? "Avance · " : "") +
        `${p.alumno} — Clase particular · ${d.horasDadas} de ${d.horasContratadas} h dadas · ` +
        (p.tipo === "avance" ? "membresía en curso" : "membresía completada") +
        ` · criterio ${p.criterio}` +
        (p.tipo === "comision" ? ` · ${cuanto}` : ""),
      monto: p.monto,
    });
  }

  // Los descuentos del profesor (regla 20a). Van en la misma corrida: si se
  // generaran aparte, una liquidación podría pagarse antes de que el descuento
  // entre, y esa plata ya no se recupera.
  for (const d of (await calcularDescuentos(sb, hastaISO)).filter(
    (d) => d.profesorId === profesorId && d.periodo === periodo
  )) {
    const { error: errDesc } = await a.from("descuentos_liquidacion").insert({
      profesor_id: d.profesorId,
      sesion_id: d.sesionId,
      periodo: d.periodo,
      motivo: d.motivo,
      monto: d.monto,
      origen: `Reemplazo de ${d.curso} del ${d.fecha}, dictada por ${d.reemplazante}`,
      liquidacion_id: liquidacionId,
    });
    // Si otra corrida ya lo tomó, el índice único lo rechaza: no es un error.
    if (errDesc && errDesc.code !== "23505")
      return { error: "Falló registrar un descuento: " + errDesc.message };
  }

  // Se recomputan TODAS las liquidaciones tocadas, no solo la del mes vencido:
  // un ajuste pudo haber caído en un período anterior, y esa liquidación
  // también cambió de total y de estado.
  for (const id of new Set(cache.values())) await recomputarTotales(a, id);
  // El período vencido se abre siempre arriba; si esta corrida lo creó y todo
  // lo devengado cayó en otro período (criterio 3 paga en el mes de la
  // completada), quedaría una liquidación vacía. Solo se borra una que ESTA
  // corrida creó y que sigue sin ítems ni pagos.
  for (const id of creadasAhora) {
    const { count } = await a
      .from("liquidacion_items")
      .select("id", { count: "exact", head: true })
      .eq("liquidacion_id", id);
    if (count === 0) {
      await a.from("liquidaciones").delete().eq("id", id);
      cache.forEach((v, k) => v === id && cache.delete(k));
    }
  }
  revalidatePath("/liquidaciones");
  // Si la del período vencido se borró, se devuelve donde sí quedó lo devengado.
  return { ok: true, liquidacionId: cache.get(periodo) ?? [...cache.values()][0] ?? liquidacionId };
}

export type VistaCierre = {
  error?: string;
  /** Una línea por (membresía, curso) con lo que se le debe al profesor al corte. */
  lineas?: { membresiaId: number; alumno: string; curso: string; clases: number; clasesDelCurso: number; base: number; monto: number }[];
  total?: number;
  /** Membresías multi-curso con clases sin registrar a ese corte: quedan afuera. */
  sinRegistrar?: { alumno: string }[];
  liquidacionId?: number;
};

/**
 * **Cierre de cuentas** de un profesor que se retira (regla 8, excepción;
 * Javier 2026-10-01): el avance al `corte`, pagado a cuenta de la liquidación
 * final. Con `devengar = false` solo calcula (vista previa); con `true` lo
 * devenga como `tipo='cierre'` en la liquidación del mes del corte. El pago
 * real se hace en Caja ("Por pagar").
 */
export async function cierreDeCuentas(
  profesorId: number,
  corte: string,
  devengar: boolean,
  cursoId?: number
): Promise<VistaCierre> {
  if (!(await tienePermiso("liquidaciones", "crear"))) return { error: "Sin permiso para liquidar." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corte)) return { error: "La fecha de corte no es válida." };
  const a = admin();
  const sb = await createClient();
  const periodicidad = "mes";

  const datos = await leerDatosMotor(sb, SIN_LIMITE);
  if (!datos) return { lineas: [], total: 0, sinRegistrar: [] };
  // Si se desasigna de UN curso, el cierre es solo de ese curso.
  const calculo = liquidar({ regular: datos, particulares: null }, { tipo: "curso", profesorId, cursoId: cursoId ?? null, corte }).regular;
  const pendientes = calculo.pendientes;
  const bloqueadas = calculo.bloqueadas;
  const lineas = pendientes.map((p) => ({
    membresiaId: p.membresiaId, alumno: p.alumno, curso: p.curso, clases: p.clases,
    clasesDelCurso: p.clasesDelCurso, base: p.base, monto: p.monto,
  }));
  const total = Math.round(lineas.reduce((s, l) => s + l.monto, 0) * 100) / 100;
  const sinRegistrar = bloqueadas
    .filter((b) => b.profesorIds.includes(profesorId))
    .map((b) => ({ alumno: b.alumno }));
  if (!devengar || pendientes.length === 0) return { lineas, total, sinRegistrar };

  const periodo = primerDiaMesDe(corte);
  const { data: existente } = await a
    .from("liquidaciones").select("id")
    .eq("profesor_id", profesorId).eq("periodo", periodo).eq("periodicidad", periodicidad)
    .maybeSingle();
  let liquidacionId: number;
  let creada = false;
  if (existente) liquidacionId = existente.id as number;
  else {
    const { data: nueva, error } = await a
      .from("liquidaciones")
      .insert({ profesor_id: profesorId, periodo, periodicidad, estado: "abierta" })
      .select("id").single();
    if (error) return { error: error.message };
    liquidacionId = nueva.id as number;
    creada = true;
  }

  const [, mes, dia] = corte.split("-");
  const rotulo = `Cierre de cuentas · corte ${dia}/${mes}`;
  const creadas: number[] = [];
  for (const p of pendientes) {
    const { data: com, error: errCom } = await a
      .from("comisiones_devengadas")
      .insert({
        profesor_id: p.profesorId, membresia_id: p.membresiaId, curso_id: p.cursoId,
        criterio: p.criterio, periodo, tipo: "cierre", base: p.base, monto: p.monto,
        reparto: p.reparto.length > 1 ? p.reparto : null,
        origen:
          `${rotulo} (${p.curso} / ${p.alumno}): ${p.pct}% de ${p.base} (${p.clases} de ${p.clasesDelCurso} clases al corte). ` +
          `Pago a cuenta de la liquidación final: lo ya devengado se resta de lo que corresponda al completarse.`,
        liquidacion_id: liquidacionId,
      })
      .select("id").single();
    if (errCom) {
      // No se deja a medias: se deshace lo devengado en esta corrida.
      if (creadas.length) {
        await a.from("liquidacion_items").delete().in("comision_id", creadas);
        await a.from("comisiones_devengadas").delete().in("id", creadas);
      }
      if (creada) await a.from("liquidaciones").delete().eq("id", liquidacionId);
      else await recomputarTotales(a, liquidacionId);
      return { error: "Falló devengar el cierre: " + errCom.message };
    }
    creadas.push(com.id as number);
    await a.from("liquidacion_items").insert({
      liquidacion_id: liquidacionId, comision_id: com.id, membresia_id: p.membresiaId,
      descripcion: `${rotulo} · ${p.alumno} — ${p.curso} (${p.clases}/${p.clasesDelCurso} clases · ${p.pct}% de ${p.base})`,
      monto: p.monto,
    });
  }
  await recomputarTotales(a, liquidacionId);
  revalidatePath("/liquidaciones");
  revalidatePath("/caja");
  return { lineas, total, sinRegistrar, liquidacionId };
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
  if (!(await tienePermiso("liquidaciones", "crear"))) return { error: "Sin permiso." };
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

  // Y solo una `abierta`. Sin ítems ni pagos el estado siempre debería ser esa,
  // así que este guard no cambia ningún caso real — es la red por si alguna vez
  // deja de ser cierto. Un borrado en una tabla que mueve plata no se apoya en
  // que dos condiciones impliquen una tercera.
  const { data: liq } = await a
    .from("liquidaciones")
    .select("estado")
    .eq("id", liquidacionId)
    .maybeSingle();
  if (!liq) return { error: "La liquidación no existe." };
  if (liq.estado !== "abierta")
    return { error: `No se puede eliminar una liquidación ${liq.estado}.` };

  const { error } = await a.from("liquidaciones").delete().eq("id", liquidacionId);
  if (error) return { error: error.message };
  revalidatePath("/liquidaciones");
  return { ok: true };
}

/** Registra un pago al profesor contra su liquidación. */
/**
 * Paga contra la **cuenta del profesor**, no contra una liquidación suelta.
 *
 * Se llega acá desde la pantalla de Liquidaciones (con una liquidación a la
 * vista) o desde Caja (con el profesor). En los dos casos el camino es el
 * mismo, a propósito: si fueran dos, podrían discrepar y nadie se enteraría
 * hasta el arqueo.
 *
 * El monto se reparte con `imputarPago`: primero cancela los períodos con
 * pagado de más —devolviéndoles lo que sobró— y después reparte el efectivo
 * entre los que quedan debiendo, del más viejo al más nuevo. La suma de las
 * filas de `pagos` **es** el efectivo que sale.
 */
export async function pagarAProfesor(args: {
  profesorId: number;
  monto: number;
  medio: string | null;
  notaMedio?: string;
}): Promise<{ ok?: true; error?: string }> {
  if (!(await tienePermiso("liquidaciones", "crear"))) return { error: "Sin permiso." };
  const a = admin();
  const perfil = await obtenerPerfilActual();

  const monto = Math.round((Number(args.monto) || 0) * 100) / 100;
  if (monto <= 0) return { error: "El monto debe ser mayor a 0." };
  if (!args.medio) return { error: "Elegí el medio de pago." };

  const { data: liqs } = await a
    .from("liquidaciones")
    .select("id, periodo, total_devengado, total_descuentos, total_pagado")
    .eq("profesor_id", args.profesorId);
  const periodos = ((liqs as {
    id: number;
    periodo: string;
    total_devengado: number;
    total_descuentos: number | null;
    total_pagado: number;
  }[]) ?? []).map((l) => ({
    id: l.id,
    periodo: l.periodo,
    totalDevengado: Number(l.total_devengado),
    totalDescuentos: Number(l.total_descuentos ?? 0),
    totalPagado: Number(l.total_pagado),
  }));
  if (!periodos.length) return { error: "Ese profesor no tiene liquidaciones." };

  const imputacion = imputarPago(periodos, monto);
  if (!imputacion.ok) return { error: imputacion.error };

  const glosa = args.medio && /otro/i.test(args.medio) && args.notaMedio?.trim() ? args.notaMedio.trim() : null;
  for (const i of imputacion.imputaciones) {
    const { error: errPago } = await a.from("pagos").insert({
      tipo: "pago",
      // El motivo que corresponde, y que ya existía en el catálogo: sin esto
      // el egreso no cae en ningún bucket de Caja (0045).
      motivo: "comision_profesor",
      profesor_id: args.profesorId,
      liquidacion_id: i.liquidacionId,
      monto: i.monto,
      medio: args.medio,
      // Una reimputación necesita decir qué es: si no, una fila negativa en el
      // libro de caja no se entiende sola.
      glosa: i.esReimputacion
        ? `Devolución de lo pagado de más en ${i.periodo.slice(0, 7)}, aplicada contra este pago` +
          (glosa ? ` · ${glosa}` : "")
        : glosa,
      registrado_por: perfil?.id ?? null,
    });
    if (errPago) return { error: errPago.message };
  }

  for (const id of new Set(imputacion.imputaciones.map((i) => i.liquidacionId)))
    await recomputarTotales(a, id);

  revalidatePath("/liquidaciones");
  revalidatePath("/caja");
  return { ok: true };
}

/** Compatibilidad con la pantalla de Liquidaciones: paga por la cuenta del
 *  profesor dueño de esa liquidación. */
export async function registrarPagoLiquidacion(args: {
  liquidacionId: number;
  monto: number;
  medio: string | null;
  notaMedio?: string;
}): Promise<{ ok?: true; error?: string }> {
  const { data: liq } = await admin()
    .from("liquidaciones")
    .select("profesor_id")
    .eq("id", args.liquidacionId)
    .maybeSingle();
  if (!liq) return { error: "La liquidación no existe." };
  const r = await pagarAProfesor({ ...args, profesorId: liq.profesor_id as number });
  if (r.ok) revalidatePath(`/liquidaciones/${args.liquidacionId}`);
  return r;
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

  // Lo devengado sigue siendo lo devengado: el descuento va aparte y se resta
  // del neto (regla 20a). Así el comprobante puede mostrar la comisión entera,
  // que es lo que el profesor tiene derecho a discutir.
  const { data: descs } = await a
    .from("descuentos_liquidacion")
    .select("monto")
    .eq("liquidacion_id", liquidacionId);
  const descuentos = ((descs as { monto: number }[]) ?? []).reduce((s, r) => s + Number(r.monto), 0);

  const neto = devengado - descuentos - pagado;
  const estado = pagado <= 0 ? "abierta" : neto <= 0 ? "pagada" : "cerrada";
  await a
    .from("liquidaciones")
    .update({
      total_devengado: devengado,
      total_descuentos: descuentos,
      total_pagado: pagado,
      neto,
      estado,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", liquidacionId);
}
