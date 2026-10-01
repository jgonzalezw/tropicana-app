"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual, alcanceDe, obtenerProfesorActual } from "@/lib/sesion";
import { exigir } from "@/lib/datos";
import type { Curso } from "@/lib/tipos";
import { COLUMNAS_ASIGNACION, type AsignacionVigencia } from "@/lib/asignaciones";
import { imputarPago } from "@/lib/liquidacion/cuenta";
import { primerDiaMesVencidoISO, finMesVencidoISO, rangoLiquidable, isoHoy } from "@/lib/liquidacion/periodo";
import { cobroPorMembresia } from "@/lib/liquidacion/cobro";
import {
  calcularDevengosParticulares,
  type DatosParticulares,
  type DevengoParticular,
  type ParticularBloqueada,
  type ModoVencida,
} from "@/lib/liquidacion/particulares";
import {
  calcularDevengos,
  type DatosMotor,
  type DevengoPendiente,
  type MembresiaBloqueada,
  type MembresiaLiq,
} from "@/lib/liquidacion/motor";

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

/**
 * Lo que se le **descuenta** a un profesor de su liquidación.
 *
 * **No es una comisión** (Javier, 2026-09-12): la liquidación va normal —esas
 * clases le cuentan y las cobra— y el costo del reemplazante se resta del
 * total. Por eso vive en su propia tabla y en su propio total: si se restara
 * del devengado, el comprobante ya no podría mostrar la comisión completa, que
 * es justo lo que el profesor tiene derecho a discutir.
 */
export type DescuentoPendiente = {
  sesionId: number;
  profesorId: number;
  periodo: string;
  motivo: string;
  monto: number;
  curso: string;
  fecha: string;
  reemplazante: string;
};

/**
 * Los descuentos que todavía no entraron en ninguna liquidación.
 *
 * Sale de las clases dictadas **con reemplazo atribuible al titular** (regla
 * 20a). El otro motivo, `administrativo`, no descuenta a nadie: esa plata la
 * pone la academia (regla 20b).
 */
async function calcularDescuentos(
  sb: Awaited<ReturnType<typeof createClient>>,
  hastaISO: string
): Promise<DescuentoPendiente[]> {
  const ses = exigir(
    await sb
      .from("sesiones")
      .select("id, curso_id, fecha, titular_id, profesor_id, reemplazo_motivo, reemplazo_costo")
      .eq("estado", "dictada")
      .eq("reemplazo_motivo", "titular")
      .lte("fecha", hastaISO),
    "las clases con reemplazo"
  ) as {
    id: number; curso_id: number; fecha: string; titular_id: number | null;
    profesor_id: number | null; reemplazo_motivo: string | null; reemplazo_costo: number | null;
  }[];
  // Sin titular no hay a quién descontarle, y sin costo no hay qué descontar.
  const candidatas = ses.filter((s) => s.titular_id != null && Number(s.reemplazo_costo) > 0);
  if (!candidatas.length) return [];

  // Lo ya descontado no se vuelve a descontar (regla 12: no se reescribe).
  const ya = exigir(
    await sb
      .from("descuentos_liquidacion")
      .select("sesion_id")
      .in("sesion_id", candidatas.map((s) => s.id)),
    "los descuentos ya aplicados"
  ) as { sesion_id: number | null }[];
  const aplicados = new Set(ya.map((d) => d.sesion_id).filter((x): x is number => x != null));

  const pendientes = candidatas.filter((s) => !aplicados.has(s.id));
  if (!pendientes.length) return [];

  const cursos = exigir(
    await sb.from("cursos").select("id, nombre").in("id", [...new Set(pendientes.map((s) => s.curso_id))]),
    "los cursos"
  ) as { id: number; nombre: string }[];
  const cuNombre = new Map(cursos.map((c) => [c.id, c.nombre]));
  const profIds = [
    ...new Set(pendientes.flatMap((s) => [s.titular_id, s.profesor_id]).filter((x): x is number => x != null)),
  ];
  const profs = exigir(
    await sb.from("profesores").select("id, contacto:contactos(nombre, apellido)").in("id", profIds),
    "los profesores"
  ) as unknown as { id: number; contacto: { nombre: string | null; apellido: string | null } | null }[];
  const prNombre = new Map(profs.map((p) => [p.id, `${p.contacto?.apellido ?? ""}, ${p.contacto?.nombre ?? ""}`]));

  return pendientes.map((s) => {
    const curso = cuNombre.get(s.curso_id) ?? `#${s.curso_id}`;
    const reemplazante = s.profesor_id != null ? prNombre.get(s.profesor_id) ?? `#${s.profesor_id}` : "—";
    return {
      sesionId: s.id,
      profesorId: s.titular_id as number,
      // El período es el del MES de la clase, igual que una comisión.
      periodo: `${s.fecha.slice(0, 7)}-01`,
      motivo: "reemplazo",
      monto: Number(s.reemplazo_costo),
      curso,
      fecha: s.fecha,
      reemplazante,
    };
  });
}

/**
 * Lo pendiente de devengar, para un período.
 *
 * **El cálculo no vive acá**: está en `@/lib/liquidacion/motor`, sin base de
 * datos, para poder fijarlo con pruebas deterministas. Esta función es el
 * envoltorio que trae las filas y se las pasa.
 */
async function calcularPendientes(
  sb: Awaited<ReturnType<typeof createClient>>,
  hastaISO: string
): Promise<{ pendientes: DevengoPendiente[]; bloqueadas: MembresiaBloqueada[] }> {
  const datos = await leerDatosMotor(sb, hastaISO);
  if (!datos) return { pendientes: [], bloqueadas: [] };
  return calcularDevengos(datos, hastaISO);
}

/**
 * Las lecturas que el motor necesita, en un solo lugar.
 *
 * Devuelve `null` cuando no hay ninguna membresía elegible: sin eso no tiene
 * sentido ir a buscar cursos, sesiones ni tarifas de nadie.
 */
async function leerDatosMotor(
  sb: Awaited<ReturnType<typeof createClient>>,
  hastaISO: string
): Promise<DatosMotor | null> {
  // 1. Membresías regulares candidatas. El motor decide cuáles entran según el
  //    criterio de cada una (Paso 4): el 1 pide completada con el ciclo
  //    terminado a más tardar en `hastaISO`; el 3, completada sin tope de
  //    fecha; el 2, también las que siguen activas (cobradas al 100%).
  const membresiasRaw = exigir(
    await sb
      .from("membresias")
      .select("id, alumno_id, curso_id, plan_id, es_prueba, acompanantes, fecha_inicio, fecha_fin, estado, criterio_liquidacion, plan:planes!inner(tipo_servicio, criterio_liquidacion)")
      .in("estado", ["activa", "completada"])
      .not("plan_id", "is", null)
      .not("fecha_fin", "is", null)
      // Solo cursos regulares (la prueba es un plan regular): cuentan CLASES.
      // Las particulares cuentan HORAS y tienen su propio cálculo (`particulares.ts`).
      // Se filtra por el tipo del plan, no por `membresias.curso_id`, que es un
      // resabio que solo significa algo en un plan mono-curso (REGLAS, glosario).
      .eq("plan.tipo_servicio", "curso_regular"),
    "las membresías a liquidar"
  ) as unknown as (MembresiaLiq & { plan: { criterio_liquidacion: number | null } })[];
  // Lo que manda es la foto de la venta (0059); sin foto, el criterio del plan.
  const membresias: MembresiaLiq[] = membresiasRaw.map(({ plan, ...m }) => ({
    ...m,
    criterio_liquidacion: m.criterio_liquidacion ?? plan.criterio_liquidacion,
  }));
  if (membresias.length === 0) return null;
  const inscIds = membresias.map((m) => m.id);

  // 2. Los cursos de cada membresía, con sus días y —si es prueba— la fecha
  //    exacta de su clase.
  const cursosDeMembresia = exigir(
    await sb
      .from("membresia_cursos")
      .select("membresia_id, curso_id, dias, fecha")
      .in("membresia_id", inscIds),
    "los cursos de las membresías"
  ) as DatosMotor["cursosDeMembresia"];

  // 3. Ya devengado: contra esto se mide el delta. Van el `monto` y el
  //    `periodo` porque un ajuste se compara en plata y entra como
  //    complemento en el período de la comisión que corrige (0044).
  const comisionesPrevias = exigir(
    await sb
      .from("comisiones_devengadas")
      .select("id, membresia_id, curso_id, profesor_id, base, monto, tipo, periodo")
      .in("membresia_id", inscIds),
    "las comisiones ya devengadas"
  ) as DatosMotor["comisionesPrevias"];

  // 4. Cuotas y pagos → saldo y plata efectivamente cobrada por membresía.
  //    La comisión se calcula sobre lo COBRADO: el descuento no suma (regla 8).
  const cuotas = exigir(
    await sb
      .from("cuotas")
      .select("id, membresia_id, monto_devengado, descuento_adelanto")
      .in("membresia_id", inscIds),
    "las cuotas"
  ) as DatosMotor["cuotas"];
  const cuotaIds = cuotas.map((c) => c.id);
  const pagos = cuotaIds.length
    ? (exigir(
        await sb
          .from("pagos")
          .select("cuota_id, monto, descuento")
          .eq("tipo", "cobro")
          .in("cuota_id", cuotaIds),
        "los pagos"
      ) as DatosMotor["pagos"])
    : [];

  // 5. Las clases del período. El motor las usa para el conteo del prorrateo
  //    (calendario menos suspendidas) y para saber qué quedó sin registrar.
  const cursoIds = [
    ...new Set(cursosDeMembresia.map((r) => r.curso_id).concat(membresias.map((m) => m.curso_id))),
  ];
  const desde = membresias.map((m) => m.fecha_inicio).sort()[0];
  const sesiones = exigir(
    await sb
      .from("sesiones")
      .select("curso_id, fecha, estado, reemplazo_motivo")
      .in("curso_id", cursoIds)
      .gte("fecha", desde)
      .lte("fecha", hastaISO),
    "las clases del período"
  ) as DatosMotor["sesiones"];

  // 6. Cursos y tarifas → precio de una clase (regla 9 / regla 10).
  const cursos = exigir(
    await sb.from("cursos").select("*").in("id", cursoIds),
    "los cursos"
  ) as Curso[];
  const tarifas = exigir(
    await sb.from("curso_tarifas").select("curso_id, modalidad, precio").in("curso_id", cursoIds),
    "las tarifas"
  ) as DatosMotor["tarifas"];

  // 7. **Historial** de asignaciones por curso, no solo la vigente: la comisión
  //    es de quien dictó la clase, no de quien figura hoy (regla 10).
  const asignaciones = exigir(
    await sb.from("asignaciones").select(COLUMNAS_ASIGNACION).in("curso_id", cursoIds),
    "las asignaciones de profesores"
  ) as AsignacionVigencia[];

  // 8. Nombres — se leen vía contacto y se aplanan a {id, nombre, apellido},
  //    la forma que espera el motor (no vale la pena hacerle conocer contactos
  //    a una pieza pura y certificada con pruebas deterministas).
  const alumnosRaw = exigir(
    await sb
      .from("alumnos")
      .select("id, contacto:contactos(nombre, apellido)")
      .in("id", [...new Set(membresias.map((m) => m.alumno_id))]),
    "los alumnos"
  ) as unknown as { id: number; contacto: { nombre: string | null; apellido: string | null } | null }[];
  const alumnos = alumnosRaw.map((a) => ({
    id: a.id,
    nombre: a.contacto?.nombre ?? "",
    apellido: a.contacto?.apellido ?? "",
  })) as DatosMotor["alumnos"];
  const profesoresRaw = exigir(
    await sb
      .from("profesores")
      .select("id, contacto:contactos(nombre, apellido)")
      .in("id", [...new Set(asignaciones.map((a) => a.profesor_id))]),
    "los profesores"
  ) as unknown as { id: number; contacto: { nombre: string | null; apellido: string | null } | null }[];
  const profesores = profesoresRaw.map((p) => ({
    id: p.id,
    nombre: p.contacto?.nombre ?? "",
    apellido: p.contacto?.apellido ?? "",
  })) as DatosMotor["profesores"];

  return {
    membresias,
    cursosDeMembresia,
    comisionesPrevias,
    cuotas,
    pagos,
    sesiones,
    cursos,
    tarifas,
    asignaciones,
    alumnos,
    profesores,
  };
}

/**
 * Las clases particulares (H5): su propio cálculo, en
 * `@/lib/liquidacion/particulares`. Acá solo las lecturas. Devuelve vacío
 * cuando no hay ninguna particular que mirar.
 */
async function calcularPendientesParticulares(
  sb: Awaited<ReturnType<typeof createClient>>,
  hastaISO: string,
  periodoVencido: string
): Promise<{ pendientes: DevengoParticular[]; bloqueadas: ParticularBloqueada[] }> {
  const filas = exigir(
    await sb
      .from("membresias")
      .select(
        "id, alumno_id, profesor_id, plan_id, criterio_liquidacion, forma_pago_profesor, fee_hora_aplicado, pago_pct_margen, pago_monto_fijo, pago_descuenta_sala, costo_sala_aplicado, horas_contratadas, fecha_fin, es_cortesia, plan:planes!inner(tipo_servicio)"
      )
      .is("curso_id", null)
      .not("plan_id", "is", null)
      .not("profesor_id", "is", null)
      .not("horas_contratadas", "is", null)
      .in("estado", ["activa", "completada"])
      .eq("plan.tipo_servicio", "particular"),
    "las membresías de clases particulares"
  ) as unknown as (Omit<DatosParticulares["membresias"][number], "alumno"> & { alumno_id: number })[];
  if (filas.length === 0) return { pendientes: [], bloqueadas: [] };
  const ids = filas.map((f) => f.id);

  const alumnosRaw = exigir(
    await sb
      .from("alumnos")
      .select("id, contacto:contactos(nombre, apellido)")
      .in("id", [...new Set(filas.map((f) => f.alumno_id))]),
    "los alumnos"
  ) as unknown as { id: number; contacto: { nombre: string | null; apellido: string | null } | null }[];
  const nombre = new Map(
    alumnosRaw.map((a) => [a.id, `${a.contacto?.apellido ?? ""}, ${a.contacto?.nombre ?? ""}`])
  );

  const reservas = exigir(
    await sb
      .from("reservas_sala")
      .select("membresia_id, fecha, estado, duracion_min, es_cortesia")
      .eq("tipo", "particular")
      .in("membresia_id", ids),
    "las reservas de las particulares"
  ) as DatosParticulares["reservas"];

  const cuotas = exigir(
    await sb.from("cuotas").select("id, membresia_id, monto_devengado, descuento_adelanto").in("membresia_id", ids),
    "las cuotas de las particulares"
  ) as { id: number; membresia_id: number; monto_devengado: number; descuento_adelanto: number }[];
  const pagos = cuotas.length
    ? (exigir(
        await sb.from("pagos").select("cuota_id, monto, descuento").eq("tipo", "cobro").in("cuota_id", cuotas.map((c) => c.id)),
        "los pagos de las particulares"
      ) as { cuota_id: number | null; monto: number; descuento: number }[])
    : [];
  const { saldo, cobrado } = cobroPorMembresia(cuotas, pagos);

  const previas = exigir(
    await sb.from("comisiones_devengadas").select("id, membresia_id, monto, tipo, periodo").in("membresia_id", ids),
    "las comisiones ya devengadas de las particulares"
  ) as DatosParticulares["previas"];

  const modo = ((await obtenerParametro("particular_vencida_modo")) || "proporcional") as ModoVencida;
  return calcularDevengosParticulares(
    {
      membresias: filas.map((f) => ({ ...f, alumno: nombre.get(f.alumno_id) ?? `#${f.alumno_id}` })),
      reservas,
      cobrado,
      saldo,
      previas,
      modoVencida: modo === "completo" ? "completo" : "proporcional",
    },
    { hastaISO, periodoVencido, hoyISO: isoHoy() }
  );
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

  const periodoVencido = primerDiaMesVencidoISO();
  const { pendientes, bloqueadas } = await calcularPendientes(sb, finMesVencidoISO());
  const particulares = await calcularPendientesParticulares(sb, finMesVencidoISO(), periodoVencido);
  const porProf = new Map<number, { monto: number; count: number }>();
  for (const p of [...pendientes, ...particulares.pendientes]) {
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
    .select("id, profesor_id, periodo, periodicidad, estado, total_devengado, total_descuentos, total_pagado, neto")
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
  if (!(await tienePermiso("liquidaciones", "crear"))) return { error: "Sin permiso." };
  const a = admin();
  const sb = await createClient();

  const rango = rangoLiquidable((await obtenerParametro("periodicidad_liquidacion")) || "mes");
  if (!rango.ok) return { error: rango.error };
  const { periodicidad, periodoVencido: periodo, hastaISO } = rango;

  const calculo = await calcularPendientes(sb, hastaISO);
  const pendientes = calculo.pendientes.filter((p) => p.profesorId === profesorId);
  const calculoP = await calcularPendientesParticulares(sb, hastaISO, periodo);
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
