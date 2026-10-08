/**
 * Las lecturas del cálculo de liquidación, en un solo lugar: las usan
 * `generarLiquidacion` y `cargarLiquidaciones` (acciones.ts) y la
 * pre-liquidación. Viven acá y no en `acciones.ts` porque ese archivo es
 * `"use server"` y todo lo que exporta queda como endpoint invocable.
 *
 * Movidas tal cual desde `acciones.ts`: no cambia ningún resultado.
 */

import { createClient } from "@/lib/supabase/server";
import { obtenerParametro } from "@/lib/sesion";
import { exigir } from "@/lib/datos";
import type { Curso } from "@/lib/tipos";
import { COLUMNAS_ASIGNACION, type AsignacionVigencia } from "@/lib/asignaciones";
import { cobroPorMembresia } from "@/lib/liquidacion/cobro";
import { liquidar, parametrosMotores, type DatosLiquidacion, type ModoLiquidacion, type ResultadoLiquidacion } from "@/lib/liquidacion/liquidar";
import {
  type DatosParticulares,
  type ModoVencida,
} from "@/lib/liquidacion/particulares";
import {
  type DatosMotor,
  type MembresiaLiq,
} from "@/lib/liquidacion/motor";

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
export async function calcularDescuentos(
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
 * Lo pendiente de devengar según el **modo** (ver `liquidar.ts`): lee lo que ese
 * modo necesita y lo calcula con el proceso único. El cálculo no vive acá: está
 * en `motor.ts` y `particulares.ts`, sin base de datos, para fijarlo con pruebas.
 */
export async function calcularLiquidacion(
  sb: Awaited<ReturnType<typeof createClient>>,
  modo: ModoLiquidacion
): Promise<ResultadoLiquidacion & { datos: DatosLiquidacion }> {
  const p = parametrosMotores(modo);
  const regular = await leerDatosMotor(sb, p.regular.hastaISO);
  const particulares = p.particulares ? await leerDatosParticulares(sb) : null;
  const datos = { regular, particulares };
  // Las filas que se leyeron viajan con el resultado: la exposición las usa para
  // decorar las líneas (cuenta, bonos, ciclo) sin volver a leer.
  return { ...liquidar(datos, modo), datos };
}

/**
 * Las lecturas que el motor necesita, en un solo lugar.
 *
 * Devuelve `null` cuando no hay ninguna membresía elegible: sin eso no tiene
 * sentido ir a buscar cursos, sesiones ni tarifas de nadie.
 */
export async function leerDatosMotor(
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
      .select("id, alumno_id, curso_id, plan_id, es_prueba, acompanantes, fecha_inicio, fecha_fin, estado, clases_plan, criterio_liquidacion, plan:planes!inner(tipo_servicio, criterio_liquidacion)")
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
      .select("id, membresia_id, curso_id, profesor_id, base, monto, tipo, periodo, liquidacion_id")
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

  // 5b. Presentes de las ilimitadas: su conteo es lo asistido (regla 10).
  const ilimitadas = membresias.filter((m) => m.clases_plan == null && m.es_prueba !== true).map((m) => m.id);
  const asistRaw = ilimitadas.length
    ? (exigir(
        await sb
          .from("asistencias")
          .select("membresia_id, sesion:sesiones!inner(curso_id, fecha, estado)")
          .eq("estado", "presente")
          .in("membresia_id", ilimitadas),
        "las asistencias de las ilimitadas"
      ) as unknown as { membresia_id: number; sesion: { curso_id: number; fecha: string; estado: string } }[])
    : [];
  const asistencias = asistRaw
    .filter((r) => r.sesion.estado === "dictada")
    .map((r) => ({ membresia_id: r.membresia_id, curso_id: r.sesion.curso_id, fecha: r.sesion.fecha }));

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
    asistencias,
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
export async function leerDatosParticulares(
  sb: Awaited<ReturnType<typeof createClient>>
): Promise<DatosParticulares | null> {
  const filas = exigir(
    await sb
      .from("membresias")
      .select(
        "id, alumno_id, profesor_id, plan_id, criterio_liquidacion, forma_pago_profesor, fee_hora_aplicado, pago_pct_margen, pago_monto_fijo, pago_descuenta_sala, costo_sala_aplicado, horas_contratadas, fecha_inicio, fecha_fin, es_cortesia, plan:planes!inner(tipo_servicio)"
      )
      .is("curso_id", null)
      .not("plan_id", "is", null)
      .not("profesor_id", "is", null)
      .not("horas_contratadas", "is", null)
      .in("estado", ["activa", "completada"])
      .eq("plan.tipo_servicio", "particular"),
    "las membresías de clases particulares"
  ) as unknown as (Omit<DatosParticulares["membresias"][number], "alumno"> & { alumno_id: number })[];
  if (filas.length === 0) return null;
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
    await sb.from("comisiones_devengadas").select("id, membresia_id, monto, tipo, periodo, liquidacion_id").in("membresia_id", ids),
    "las comisiones ya devengadas de las particulares"
  ) as DatosParticulares["previas"];

  const modo = ((await obtenerParametro("particular_vencida_modo")) || "proporcional") as ModoVencida;
  return {
    membresias: filas.map((f) => ({ ...f, alumno: nombre.get(f.alumno_id) ?? `#${f.alumno_id}` })),
    reservas,
    cobrado,
    saldo,
    previas,
    modoVencida: modo === "completo" ? "completo" : "proporcional",
  };
}
