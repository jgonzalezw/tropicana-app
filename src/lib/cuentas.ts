import type { createClient } from "@/lib/supabase/server";
import {
  recalcularMembresia,
  type ClienteAdmin,
} from "@/lib/membresias";
import { fechaClaseN, gs } from "@/lib/inscripcion";
import { obtenerParametro } from "@/lib/sesion";
import type { CuotaCuenta, EntradaCobro, EstadoCuenta, MembresiaCuenta, PagoCuenta } from "@/lib/tipos";
import type { Bucket, LineaPendiente } from "@/lib/caja";
import { exigir, exigirUno } from "@/lib/datos";
import { saldoDeReemplazos, type ClaseReemplazo } from "@/lib/liquidacion/reemplazos";
import { saldoMembresia } from "@/lib/reservas";

function hoyLocal(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function parseFechaISO(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isoFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * La cuenta del alumno: qué compró, qué consumió, qué debe y qué pagó.
 *
 * Es la contracara de `@/lib/membresias`: allá vive cuándo se cierra un ciclo,
 * acá cómo se lee esa historia y cómo entra la plata. Las dos pantallas que la
 * usan (estado de cuenta y el cobro) comparten esta pieza para no volver a
 * calcular la deuda cada una por su lado, que es como se desincronizan.
 *
 * No es "use server": son piezas internas, no acciones expuestas al cliente.
 */

type ClienteLectura = Awaited<ReturnType<typeof createClient>>;

const num = (v: unknown) => Number(v ?? 0);

/** Saldo de una cuota: lo devengado menos lo cubierto (plata + descuentos). */
function saldoCuota(devengado: number, descuentoAdelanto: number, cubierto: number) {
  return Math.max(0, devengado - descuentoAdelanto - cubierto);
}

/** El estado que le corresponde a una cuota según lo efectivamente cubierto. */
export function estadoQueCorresponde(devengado: number, descuentoAdelanto: number, cubierto: number) {
  const referencia = Math.max(0, devengado - descuentoAdelanto);
  if (referencia === 0 || cubierto >= referencia) return "pagada";
  return cubierto > 0 ? "parcial" : "pendiente";
}

// ── Qué cursos toca una membresía, y hasta cuándo ───────────────────────

export type CursoDeMembresia = { cursoId: number; nombre: string; dias: number[] };

/**
 * Qué cursos toca cada membresía, con sus días — por `membresia_cursos`,
 * que es donde el glosario de `REGLAS.md` dice que vive esta información.
 *
 * **Con respaldo a `curso_id`** para membresías viejas que nunca llegaron a
 * tener fila en `membresia_cursos` (paquetes por clase vendidos antes del
 * motor de planes — medido en dev, 2026-09-16: existían de verdad). El
 * glosario lo dice explícito: *"`membresias.curso_id` NO es 'el curso' de
 * la membresía... queda como respaldo para filas viejas"*. Sin este respaldo,
 * esas membresías se mostraban sin ningún curso.
 *
 * Usable desde cualquier pantalla que muestre una membresía — hoy la Cuenta
 * del alumno y el Recibo de pago.
 */
export async function cursosDeMembresias(
  sb: ClienteLectura,
  inscripciones: {
    id: number;
    curso_id: number | null;
    curso: { nombre: string; dias_semana: number[] | null } | null;
  }[]
): Promise<Map<number, CursoDeMembresia[]>> {
  const porInsc = new Map<number, CursoDeMembresia[]>();
  if (!inscripciones.length) return porInsc;

  const icRows = exigir(
    await sb
      .from("membresia_cursos")
      .select("membresia_id, curso_id, dias, curso:cursos(nombre)")
      .in(
        "membresia_id",
        inscripciones.map((r) => r.id)
      ),
    "los cursos de las membresías"
  );
  for (const ic of (icRows as unknown as {
    membresia_id: number;
    curso_id: number;
    dias: number[];
    curso: { nombre: string } | null;
  }[]) ?? []) {
    if (!ic.curso) continue;
    const l = porInsc.get(ic.membresia_id) ?? [];
    l.push({ cursoId: ic.curso_id, nombre: ic.curso.nombre, dias: ic.dias ?? [] });
    porInsc.set(ic.membresia_id, l);
  }

  // Respaldo: la membresía no tiene ninguna fila en membresia_cursos, pero
  // sí un curso_id directo (fila vieja). Se usan los días DEL CURSO, porque
  // en el camino viejo no había forma de elegir un subconjunto.
  for (const r of inscripciones) {
    if (porInsc.has(r.id)) continue;
    if (r.curso_id == null || !r.curso) continue;
    porInsc.set(r.id, [{ cursoId: r.curso_id, nombre: r.curso.nombre, dias: r.curso.dias_semana ?? [] }]);
  }

  return porInsc;
}

/**
 * La fecha de fin de una membresía: la real si ya está calculada, o una
 * **estimación** cuando no la hay.
 *
 * **Por qué puede faltar.** Un paquete por clase (regla de negocio 3) termina
 * por consumo, no por fecha — `fecha_fin` queda `null` a propósito, porque no
 * se sabe de antemano cuándo el alumno va a gastar sus clases. Javier pidió
 * mostrar igual una proyección: *"asegurate que tenga la fecha estimada de
 * fin"* (2026-09-16).
 *
 * **Cómo se estima**: la fecha de la última clase del paquete (`clases_total`)
 * contando desde `fecha_inicio` por el calendario del curso — la misma
 * función (`fechaClaseN`) que ya usa la venta para el plan mensual. Es una
 * proyección con asistencia perfecta, no una promesa: una falta no consume el
 * paquete (la clase pasó igual), así que el fin real puede ser más tarde.
 *
 * Con más de un curso se usa el primero — hoy no hay una regla de cómo se
 * reparten `clases_total` clases entre varios cursos, y esto es una
 * estimación, no una liquidación.
 */
export function finDeMembresia(
  fechaFinReal: string | null,
  fechaInicio: string,
  clasesTotal: number | null,
  cursos: CursoDeMembresia[]
): { fecha: string; estimada: boolean } | null {
  if (fechaFinReal) return { fecha: fechaFinReal, estimada: false };
  if (!clasesTotal || clasesTotal <= 0) return null;
  const curso = cursos.find((c) => c.dias.length);
  if (!curso) return null;
  const inicio = parseFechaISO(fechaInicio);
  if (!inicio) return null;
  const fin = fechaClaseN(curso.dias, inicio, clasesTotal);
  return fin ? { fecha: isoFecha(fin), estimada: true } : null;
}

// ── Lectura: el estado de cuenta ────────────────────────────────────────

/** Lo que `armarMembresiasCuenta` necesita de cada membresía (la consulta es de quien llama). */
export type FilaParaCuenta = {
  id: number;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  clases_plan: number | null;
  clases_total: number | null;
  /** Resabio mono-curso (glosario `REGLAS.md`): respaldo cuando la
   *  membresía no tiene fila en `membresia_cursos`. */
  curso_id: number | null;
  /** Particular/alquiler (regla 21): no tiene curso, tiene horas. */
  horas_contratadas: number | null;
  profesor: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
  plan: { nombre: string; estilo: string | null } | null;
  curso: { nombre: string; dias_semana: number[] | null } | null;
};

/** Un cobro tal como sale de `pagos`. */
export type PagoCobroCrudo = {
  id: number;
  cuota_id: number | null;
  fecha: string;
  monto: number;
  descuento: number;
  descuento_motivo: string | null;
  medio: string | null;
  motivo: string | null;
};

/**
 * La cuenta de cada membresía dada: cuotas con lo cobrado, saldo, consumo,
 * faltas, bonos, cursos con sus días y, en particulares y alquileres, el
 * saldo de horas. La comparten la cuenta del alumno (`estadoDeCuenta`) y la
 * lista y ficha de Membresías (`membresiasLectura`), para que la plata y el
 * consumo no se calculen cada uno por su lado. No filtra por estado: quien
 * llama decide qué membresías pasa.
 *
 * `leerPagos` recibe los ids de las cuotas leídas y devuelve los cobros: la
 * cuenta del alumno los trae por alumno (también los que no tienen cuota, que
 * muestra aparte); la lista, por cuota.
 */
export async function armarMembresiasCuenta(
  sb: ClienteLectura,
  inscripciones: FilaParaCuenta[],
  leerPagos: (cuotaIds: number[]) => Promise<PagoCobroCrudo[]>
): Promise<{
  membresias: MembresiaCuenta[];
  cuotas: { id: number; membresia_id: number }[];
  pagos: PagoCobroCrudo[];
}> {
  if (!inscripciones.length) return { membresias: [], cuotas: [], pagos: [] };
  const inscIds = inscripciones.map((r) => r.id);

  // Particular/alquiler (regla 21: no tiene curso, tiene horas): el estilo se
  // lee del plan, del mismo catálogo que ya resuelve `/particulares`.
  const conHoras = inscripciones.filter((r) => r.curso_id == null && r.horas_contratadas != null);
  const estilos = new Map<string, string>();
  if (conHoras.length) {
    const estRows = exigir(await sb.from("estilos").select("clave, nombre"), "los estilos");
    for (const e of estRows as { clave: string; nombre: string }[]) estilos.set(e.clave, e.nombre);
  }
  // El saldo de horas se calcula desde las reservas (regla de negocio 23),
  // igual que en `/particulares` — nunca se guarda paso a paso. Se trae
  // fecha/hora/sala para mostrar cada reserva una por una acá también,
  // incluida una Suspendida por un cierre de sala (H4) — no solo el saldo
  // agregado.
  type ReservaRow = {
    membresia_id: number | null;
    fecha: string;
    hora: string;
    duracion_min: number;
    estado: string;
    solicitada_hasta: string | null;
    sala: { nombre: string } | null;
  };
  const reservasPorInsc = new Map<number, ReservaRow[]>();
  if (conHoras.length) {
    const resRows = exigir(
      await sb
        .from("reservas_sala")
        .select("membresia_id, fecha, hora, duracion_min, estado, solicitada_hasta, es_cortesia, sala:salas(nombre)")
        .in(
          "membresia_id",
          conHoras.map((r) => r.id)
        )
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true }),
      "las reservas de las membresías"
    );
    for (const r of resRows as unknown as ReservaRow[]) {
      if (r.membresia_id == null) continue;
      const l = reservasPorInsc.get(r.membresia_id) ?? [];
      l.push(r);
      reservasPorInsc.set(r.membresia_id, l);
    }
  }

  // Consumo y faltas, solo sobre sesiones dictadas.
  const presentes: Record<number, number> = {};
  const conLic: Record<number, number> = {};
  const sinLic: Record<number, number> = {};
  const asis = exigir(
    await sb.from("asistencias").select("membresia_id, sesion_id, estado, con_licencia").in("membresia_id", inscIds),
    "las asistencias de las membresías"
  ) as { membresia_id: number | null; sesion_id: number; estado: string; con_licencia: boolean }[];
  if (asis.length) {
    const ses = exigir(
      await sb
        .from("sesiones")
        .select("id, estado")
        .in("id", [...new Set(asis.map((a) => a.sesion_id))]),
      "las sesiones de las asistencias"
    ) as { id: number; estado: string }[];
    const dictadas = new Set(ses.filter((s) => s.estado === "dictada").map((s) => s.id));
    for (const a of asis) {
      if (a.membresia_id == null || !dictadas.has(a.sesion_id)) continue;
      if (a.estado === "presente") presentes[a.membresia_id] = (presentes[a.membresia_id] ?? 0) + 1;
      else if (a.con_licencia) conLic[a.membresia_id] = (conLic[a.membresia_id] ?? 0) + 1;
      else sinLic[a.membresia_id] = (sinLic[a.membresia_id] ?? 0) + 1;
    }
  }

  // Cuotas y lo cobrado contra cada una.
  const cuotas = exigir(
    await sb
      .from("cuotas")
      .select("id, membresia_id, periodo, vencimiento, fecha_compromiso, monto_devengado, descuento_adelanto, estado")
      .in("membresia_id", inscIds)
      .order("periodo", { ascending: true }),
    "las cuotas de las membresías"
  ) as {
    id: number;
    membresia_id: number;
    periodo: string;
    vencimiento: string | null;
    fecha_compromiso: string | null;
    monto_devengado: number;
    descuento_adelanto: number;
    estado: string;
  }[];

  const pagosCrudos = await leerPagos(cuotas.map((c) => c.id));

  const plataPorCuota: Record<number, number> = {};
  const cubiertoPorCuota: Record<number, number> = {};
  for (const p of pagosCrudos) {
    if (p.cuota_id == null) continue;
    plataPorCuota[p.cuota_id] = (plataPorCuota[p.cuota_id] ?? 0) + num(p.monto);
    cubiertoPorCuota[p.cuota_id] = (cubiertoPorCuota[p.cuota_id] ?? 0) + num(p.monto) + num(p.descuento);
  }

  const cuotasPorInsc = new Map<number, CuotaCuenta[]>();
  for (const c of cuotas) {
    const cubierto = cubiertoPorCuota[c.id] ?? 0;
    const fila: CuotaCuenta = {
      id: c.id,
      periodo: c.periodo,
      vencimiento: c.vencimiento,
      fechaCompromiso: c.fecha_compromiso,
      devengado: num(c.monto_devengado),
      descuentoAdelanto: num(c.descuento_adelanto),
      cobrado: plataPorCuota[c.id] ?? 0,
      cubierto,
      saldo: saldoCuota(num(c.monto_devengado), num(c.descuento_adelanto), cubierto),
      estado: c.estado,
    };
    const lista = cuotasPorInsc.get(c.membresia_id) ?? [];
    lista.push(fila);
    cuotasPorInsc.set(c.membresia_id, lista);
  }

  // Qué cursos toca cada membresía, con sus días — para TODAS, no solo las
  // que tienen bono. Por `membresia_cursos`, que es donde el glosario dice
  // que vive esta información; `membresias.curso_id` es "un resabio que
  // solo significa algo en un plan mono-curso, y queda como respaldo para
  // filas viejas" — y hay filas viejas de verdad (paquetes por clase
  // vendidos antes del motor de planes) que nunca llegaron a tener fila en
  // `membresia_cursos`. Sin este respaldo, esas membresías se mostraban
  // sin ningún curso.
  const cursosPorInsc = await cursosDeMembresias(sb, inscripciones);

  // Bono de tolerancia pendiente, POR CURSO (D35): cada uno trae su vencimiento,
  // que es la renovación bonificada de su curso (se guarda al generarlo).
  const bonosPorInsc = new Map<number, { cursoNombre: string; clases: number; vence: string | null }[]>();
  const bonoRows = exigir(
    await sb
      .from("membresia_bonos")
      .select("membresia_id, clases, vence, curso:cursos(nombre)")
      .in("membresia_id", inscIds)
      .is("aplicado", null),
    "los bonos de las membresías"
  );
  for (const b of bonoRows as unknown as { membresia_id: number; clases: number; vence: string | null; curso: { nombre: string } | null }[]) {
    const lista = bonosPorInsc.get(b.membresia_id) ?? [];
    lista.push({ cursoNombre: b.curso?.nombre ?? "un curso", clases: b.clases, vence: b.vence });
    bonosPorInsc.set(b.membresia_id, lista);
  }

  const ahoraSaldo = new Date();
  const membresias: MembresiaCuenta[] = inscripciones.map((r) => {
    const propias = cuotasPorInsc.get(r.id) ?? [];
    const hechas = presentes[r.id] ?? 0;
    const cursos = cursosPorInsc.get(r.id) ?? [];
    const fin = finDeMembresia(r.fecha_fin, r.fecha_inicio, r.clases_total, cursos);

    const esParticular = r.curso_id == null && r.horas_contratadas != null;
    const saldo = esParticular
      ? saldoMembresia({
          horasContratadas: num(r.horas_contratadas),
          reservas: reservasPorInsc.get(r.id) ?? [],
          ahora: ahoraSaldo,
        })
      : null;
    const pc = r.profesor?.contacto;
    const profesorNombre = pc ? `${pc.nombre ?? ""} ${pc.apellido ?? ""}`.trim() : null;
    const estiloTexto = r.plan?.estilo ? (estilos.get(r.plan.estilo) ?? r.plan.estilo) : null;

    return {
      id: r.id,
      plan: r.plan?.nombre ?? null,
      curso: r.curso?.nombre ?? null,
      cursos: cursos.map((c) => ({ nombre: c.nombre, dias: c.dias })),
      estado: r.estado,
      fechaInicio: r.fecha_inicio,
      fechaFin: fin?.fecha ?? null,
      fechaFinEstimada: fin?.estimada ?? false,
      progreso: r.clases_plan != null ? { hechas, total: r.clases_plan } : null,
      restantes: r.clases_total != null ? Math.max(0, r.clases_total - hechas) : null,
      horas: saldo
        ? { contratadasMin: saldo.contratadasMin, consumidasMin: saldo.consumidasMin, disponibleMin: saldo.disponibleMin }
        : null,
      estiloProfesor: esParticular ? [estiloTexto, profesorNombre].filter(Boolean).join(" · ") || null : null,
      reservas: esParticular
        ? (reservasPorInsc.get(r.id) ?? []).map((res) => ({
            fecha: res.fecha,
            hora: res.hora,
            duracionMin: res.duracion_min,
            estado: res.estado,
            salaNombre: res.sala?.nombre ?? null,
          }))
        : null,
      faltasConLicencia: conLic[r.id] ?? 0,
      faltasSinLicencia: sinLic[r.id] ?? 0,
      bonos: bonosPorInsc.get(r.id) ?? [],
      bono: (bonosPorInsc.get(r.id) ?? []).reduce((t, b) => t + b.clases, 0),
      renovacionBonificada:
        (bonosPorInsc.get(r.id) ?? []).map((b) => b.vence).filter((v): v is string => !!v).sort()[0] ?? null,
      cuotas: propias,
      saldo: propias.reduce((t, c) => t + c.saldo, 0),
    };
  });

  return { membresias, cuotas: cuotas.map((c) => ({ id: c.id, membresia_id: c.membresia_id })), pagos: pagosCrudos };
}

export async function estadoDeCuenta(sb: ClienteLectura, alumnoId: number): Promise<EstadoCuenta | null> {
  const al = exigirUno(
    await sb.from("alumnos").select("id, contacto:contactos(nombre, apellido)").eq("id", alumnoId).maybeSingle(),
    "el alumno"
  );
  if (!al) return null;
  const alRow = al as unknown as { id: number; contacto: { nombre: string | null; apellido: string | null } | null };
  const alumno = { id: alRow.id, nombre: alRow.contacto?.nombre ?? "", apellido: alRow.contacto?.apellido ?? "" };

  const inscripciones = exigir(
    await sb
      .from("membresias")
      .select(
        "id, estado, fecha_inicio, fecha_fin, clases_plan, clases_total, curso_id, " +
          "horas_contratadas, profesor:profesores(contacto:contactos(nombre, apellido)), " +
          "plan:planes(nombre, estilo), curso:cursos(nombre, dias_semana)"
      )
      .eq("alumno_id", alumnoId)
      .neq("estado", "baja")
      .order("fecha_inicio", { ascending: false }),
    "las membresías del alumno"
  ) as unknown as FilaParaCuenta[];
  if (!inscripciones.length)
    return { alumno, membresias: [], pagos: [], deuda: 0 };

  // Los cobros se piden por alumno, no por cuota: la cuenta muestra también
  // los que no están atados a una cuota.
  const { membresias, cuotas, pagos: pagosCrudos } = await armarMembresiasCuenta(sb, inscripciones, async () =>
    exigir(
      await sb
        .from("pagos")
        .select("id, cuota_id, fecha, monto, descuento, descuento_motivo, medio, motivo")
        .eq("tipo", "cobro")
        .eq("alumno_id", alumnoId)
        .order("fecha", { ascending: false }),
      "los pagos del alumno"
    ) as PagoCobroCrudo[]
  );

  // A qué membresía corresponde cada pago (por su cuota) — un alumno con
  // varias membresías necesita distinguir a cuál se le aplicó cada pago, y el
  // nombre del plan solo no alcanza cuando dos ventas comparten plantilla.
  const membresiaIdPorCuota = new Map(cuotas.map((c) => [c.id, c.membresia_id]));
  const planFechaPorMembresia = new Map(
    inscripciones.map((r) => [r.id, { plan: r.plan?.nombre ?? null, fechaInicio: r.fecha_inicio }])
  );

  const pagos: PagoCuenta[] = pagosCrudos.map((p) => {
    const membresiaId = p.cuota_id != null ? membresiaIdPorCuota.get(p.cuota_id) : undefined;
    const info = membresiaId != null ? planFechaPorMembresia.get(membresiaId) : undefined;
    return {
      id: p.id,
      fecha: p.fecha,
      monto: num(p.monto),
      descuento: num(p.descuento),
      descuentoMotivo: p.descuento_motivo,
      medio: p.medio,
      concepto: p.motivo,
      membresiaPlan: info?.plan ?? null,
      membresiaFechaInicio: info?.fechaInicio ?? null,
    };
  });

  return {
    alumno,
    membresias,
    pagos,
    deuda: membresias.reduce((t, m) => t + m.saldo, 0),
  };
}

// ── Cuentas por cobrar ──────────────────────────────────────────────────

/**
 * Las deudas abiertas contra las que se puede imputar un cobro: una línea por
 * cuota con saldo, con el nombre de quien debe y contra qué. Es la lista que
 * Caja usa para navegar ("¿a quién se le cobra?") y la misma que alimenta el
 * atajo desde la operación. Una línea saldada desaparece.
 *
 * Hoy solo produce el bucket `cuotas`: particulares, alquiler, pruebas y
 * productos van a entrar cuando existan esas ventas.
 */
export async function lineasPorCobrar(
  sb: ClienteLectura,
  filtro?: { alumnoId?: number }
): Promise<LineaPendiente[]> {
  const data = exigir(
    await sb
      .from("cuotas")
      .select(
        "id, membresia_id, monto_devengado, descuento_adelanto, vencimiento, fecha_compromiso, " +
          "inscripcion:membresias(id, alumno_id, contacto_id, categoria_aplicada, " +
          "alumno:alumnos(id, contacto:contactos(nombre, apellido)), " +
          "titular:contactos(id, tipo, nombre, apellido, razon_social), " +
          "plan:planes(nombre, tipo_servicio), curso:cursos(nombre))"
      )
      .neq("estado", "pagada"),
    "las cuotas pendientes"
  );

  type Fila = {
    id: number;
    membresia_id: number;
    monto_devengado: number;
    descuento_adelanto: number;
    vencimiento: string | null;
    fecha_compromiso: string | null;
    inscripcion: {
      id: number;
      alumno_id: number | null;
      contacto_id: number | null;
      categoria_aplicada: string | null;
      alumno: { id: number; contacto: { nombre: string | null; apellido: string | null } | null } | null;
      /** El titular como contacto: es quien debe en un alquiler (sin rol alumno, regla 21). */
      titular: { id: number; tipo: "persona" | "organizacion"; nombre: string | null; apellido: string | null; razon_social: string | null } | null;
      plan: { nombre: string; tipo_servicio: string } | null;
      curso: { nombre: string } | null;
    } | null;
  };
  // Una membresía tiene un alumno; un alquiler (H7) solo un titular-contacto.
  let filas = ((data as unknown as Fila[]) ?? []).filter(
    (f) => f.inscripcion?.alumno || f.inscripcion?.categoria_aplicada != null
  );
  if (filtro?.alumnoId != null)
    filas = filas.filter((f) => f.inscripcion!.alumno_id === filtro.alumnoId);
  if (!filas.length) return [];

  // Lo ya cubierto de cada cuota (plata + descuentos).
  const cubierto: Record<number, number> = {};
  const pagos = exigir(
    await sb
      .from("pagos")
      .select("cuota_id, monto, descuento")
      .eq("tipo", "cobro")
      .in("cuota_id", filas.map((f) => f.id)),
    "los cobros de las cuotas"
  ) as unknown as { cuota_id: number | null; monto: number; descuento: number }[];
  for (const p of pagos)
    if (p.cuota_id != null) cubierto[p.cuota_id] = (cubierto[p.cuota_id] ?? 0) + num(p.monto) + num(p.descuento);

  return filas
    .map((f) => {
      const insc = f.inscripcion!;
      const servicio = insc.plan?.nombre ?? insc.curso?.nombre ?? "Membresía";
      // El bucket y el motivo sugerido siguen el tipo de servicio del plan, no
      // "membresía": una particular (H2) y un alquiler (H7) no tienen curso.
      const tipoServicio = insc.plan?.tipo_servicio;
      const esParticular = tipoServicio === "particular";
      const esAlquiler = tipoServicio === "alquiler";
      const bucket: Bucket = esAlquiler ? "alquiler" : esParticular ? "particulares" : "cuotas";
      const al = insc.alumno;
      const t = insc.titular;
      const sujeto = al
        ? `${al.contacto?.apellido ?? ""}, ${al.contacto?.nombre ?? ""}`
        : t
          ? t.tipo === "organizacion"
            ? t.razon_social ?? "—"
            : `${t.apellido ?? ""}, ${t.nombre ?? ""}`
          : "Titular de alquiler";
      return {
        clave: `cuota:${f.id}`,
        bucket,
        cuotaId: f.id,
        sujetoTipo: al ? ("alumno" as const) : ("tercero" as const),
        sujetoId: al ? al.id : insc.contacto_id,
        sujeto,
        detalle: servicio,
        saldo: saldoCuota(num(f.monto_devengado), num(f.descuento_adelanto), cubierto[f.id] ?? 0),
        // Si se pactó una fecha de compromiso, esa manda sobre el vencimiento
        // original: es la que la escuela acordó con el alumno.
        fechaLimite: f.fecha_compromiso ?? f.vencimiento,
        motivoSugerido: esAlquiler ? "alquiler" : esParticular ? "clase_particular" : "membresia",
      };
    })
    .filter((l) => l.saldo > 0)
    // Primero la deuda más vieja: es la que hay que perseguir. Las que no
    // tienen fecha pactada van al final, ahí sí por apellido.
    .sort((a, b) => {
      if (a.fechaLimite !== b.fechaLimite) {
        if (!a.fechaLimite) return 1;
        if (!b.fechaLimite) return -1;
        return a.fechaLimite < b.fechaLimite ? -1 : 1;
      }
      return a.sujeto.localeCompare(b.sujeto, "es") || a.detalle.localeCompare(b.detalle, "es");
    });
}

// ── Escritura: registrar un cobro contra una cuota ──────────────────────

/**
 * Asienta plata (y/o un descuento con motivo) contra una cuota existente, deja
 * la cuota en el estado que le corresponde y **recalcula la membresía**: cobrar
 * puede ser lo que cierre el ciclo, porque una membresía se cierra agotada Y
 * cobrada.
 *
 * Es lo que faltaba para poder cobrar una deuda después de la venta: hasta
 * ahora esto vivía incrustado dentro de `venderPlan` y no se podía reusar.
 */
export async function registrarCobro(
  a: ClienteAdmin,
  e: EntradaCobro,
  registradoPor: string | null
): Promise<{ ok?: true; error?: string; cerroMembresia?: boolean; saldoRestante?: number }> {
  const { data: cuotaRow } = await a
    .from("cuotas")
    .select("id, membresia_id, monto_devengado, descuento_adelanto")
    .eq("id", e.cuotaId)
    .maybeSingle();
  if (!cuotaRow) return { error: "La cuota no existe." };
  const cuota = cuotaRow as {
    id: number;
    membresia_id: number;
    monto_devengado: number;
    descuento_adelanto: number;
  };

  const { data: inscRow } = await a
    .from("membresias")
    .select("id, alumno_id, contacto_id")
    .eq("id", cuota.membresia_id)
    .maybeSingle();
  if (!inscRow) return { error: "La membresía de esa cuota no existe." };
  const insc = inscRow as { id: number; alumno_id: number | null; contacto_id: number | null };

  // Cuánto se debe hoy, antes de este cobro.
  const { data: previos } = await a
    .from("pagos")
    .select("monto, descuento")
    .eq("tipo", "cobro")
    .eq("cuota_id", cuota.id);
  const cubiertoPrevio = ((previos as { monto: number; descuento: number }[]) ?? []).reduce(
    (t, p) => t + num(p.monto) + num(p.descuento),
    0
  );
  const saldo = saldoCuota(num(cuota.monto_devengado), num(cuota.descuento_adelanto), cubiertoPrevio);
  if (saldo <= 0) return { error: "Esa cuota ya está saldada." };

  const plata = Math.max(0, Math.round(num(e.monto)));
  const descuento = Math.max(0, Math.round(num(e.descuento)));
  if (plata + descuento <= 0) return { error: "Cargá un monto a cobrar o un descuento." };
  if (plata + descuento > saldo)
    return { error: `No se puede cobrar más de lo que se debe (saldo: ${saldo}).` };
  if (plata > 0 && !e.medio) return { error: "Elegí el medio de pago." };
  if (descuento > 0 && !e.descuentoMotivo.trim())
    return { error: "El descuento necesita un motivo." };

  // Fecha en que ocurrió de verdad, si no fue hoy: no puede ser futura (no se
  // registra por adelantado un cobro que todavía no pasó).
  if (e.fechaEfectiva) {
    const fe = parseFechaISO(e.fechaEfectiva);
    if (!fe) return { error: "La fecha en que ocurrió el movimiento no es válida." };
    if (fe > hoyLocal()) return { error: "La fecha en que ocurrió el movimiento no puede ser futura." };
  }

  // Fecha de compromiso de pago del saldo: misma regla que la venta (§ /inscribir)
  // — obligatoria si queda saldo, entre hoy y el tope del parámetro.
  const saldoRestanteAntes = saldo - plata - descuento;
  let fechaCompromiso: string | null = null;
  if (saldoRestanteAntes > 0) {
    const diasMax = Math.max(1, Number(await obtenerParametro("dias_compromiso_pago")) || 30);
    const fc = parseFechaISO(e.fechaCompromiso ?? "");
    if (!fc) return { error: "Cargá la fecha de compromiso de pago del saldo." };
    const hoy0 = hoyLocal();
    const maxF = new Date(hoy0);
    maxF.setDate(maxF.getDate() + diasMax);
    if (fc < hoy0) return { error: "La fecha de compromiso no puede ser anterior a hoy." };
    if (fc > maxF) return { error: `La fecha de compromiso no puede superar ${diasMax} días desde hoy.` };
    fechaCompromiso = isoFecha(fc);
  }

  const { error: errPago } = await a.from("pagos").insert({
    tipo: "cobro",
    // El motivo elegido manda: antes se asentaba siempre "cuota" y en Caja se
    // descartaba lo que elegia el operador.
    motivo: e.motivo?.trim() || "membresia",
    alumno_id: insc.alumno_id,
    // Un alquiler no tiene alumno (regla 21): la plata queda a nombre del contacto.
    contacto_id: insc.alumno_id == null ? insc.contacto_id : null,
    membresia_id: insc.id,
    cuota_id: cuota.id,
    monto: plata,
    medio: plata > 0 ? e.medio : null,
    descuento,
    descuento_motivo: descuento > 0 ? e.descuentoMotivo.trim() : null,
    glosa: e.glosa?.trim() || e.notaMedio?.trim() || null,
    fecha_efectiva: e.fechaEfectiva,
    registrado_por: registradoPor,
  });
  if (errPago) return { error: "No se pudo registrar el cobro: " + errPago.message };

  const cubierto = cubiertoPrevio + plata + descuento;
  await a
    .from("cuotas")
    .update({
      estado: estadoQueCorresponde(num(cuota.monto_devengado), num(cuota.descuento_adelanto), cubierto),
      // Saldada: no hay nada que prometer, se limpia. Con saldo: la fecha nueva
      // reemplaza cualquier compromiso anterior (se está renegociando).
      fecha_compromiso: fechaCompromiso,
    })
    .eq("id", cuota.id);

  // Cobrar puede cerrar la membresía: es la segunda condición de la regla base.
  const cerroMembresia = await recalcularMembresia(a, insc.id);

  return {
    ok: true,
    cerroMembresia,
    saldoRestante: saldoCuota(num(cuota.monto_devengado), num(cuota.descuento_adelanto), cubierto),
  };
}

// ── Cuentas por pagar ───────────────────────────────────────────────────

/**
 * Lo que Tropicana le debe a cada profesor: **una línea por profesor**, con el
 * saldo de todas sus liquidaciones.
 *
 * **Es un saldo, no una lista de períodos**, y ahí está la diferencia con el
 * lado de cobrar. Un ajuste de recálculo puede dejar un período con plata
 * pagada de más (0044); si cada período fuera su propia línea, ese negativo
 * quedaría suelto esperando que el profesor vuelva a devengar. Sumados, se
 * compensan solos y el número que se ve es el que hay que pagar.
 *
 * **Se listan todos**, incluso con saldo 0 o negativo — es la regla del handoff
 * para los buckets de política `ajuste`. Un saldo negativo es plata a recuperar:
 * esconderlo sería disfrazar una deuda de ausencia (regla de calidad 1).
 *
 * **El alcance, que importa no confundir**: esto es el saldo de LIQUIDACIONES
 * —comisiones de cursos regulares y pruebas, y el descuento al reemplazado—.
 * El pago al reemplazante NO va acá: es su propia línea (`lineasPorPagarReemplazos`). Los conceptos ad-hoc (multas, bonificaciones,
 * débitos y créditos de administración) se resuelven enteros en Caja y **no
 * entran acá**: por eso el detalle lo dice con todas las letras, y un pago con
 * motivo `otro_pago_profesor` no salda esta línea. *(Javier, 2026-09-18.)*
 */
export async function lineasPorPagar(sb: ClienteLectura): Promise<LineaPendiente[]> {
  const filas = exigir(
    await sb
      .from("liquidaciones")
      .select(
        "id, profesor_id, periodo, total_devengado, total_descuentos, total_pagado, profesor:profesores(id, contacto:contactos(nombre, apellido))"
      ),
    "las liquidaciones"
  ) as unknown as {
    id: number;
    profesor_id: number;
    periodo: string;
    total_devengado: number;
    total_descuentos: number | null;
    total_pagado: number;
    profesor: { id: number; contacto: { nombre: string | null; apellido: string | null } | null } | null;
  }[];

  const porProfesor = new Map<
    number,
    { nombre: string; saldo: number; periodos: number; porDescontar: number; clasesPorDescontar: number }
  >();
  for (const f of filas) {
    if (!f.profesor) continue;
    const neto = num(f.total_devengado) - num(f.total_descuentos) - num(f.total_pagado);
    const ya = porProfesor.get(f.profesor.id) ?? {
      nombre: `${f.profesor.contacto?.apellido ?? ""}, ${f.profesor.contacto?.nombre ?? ""}`,
      saldo: 0,
      periodos: 0,
      porDescontar: 0,
      clasesPorDescontar: 0,
    };
    ya.saldo += neto;
    ya.periodos += 1;
    porProfesor.set(f.profesor.id, ya);
  }

  // Lo que se le va a descontar por haber faltado y tener reemplazo (regla 20a)
  // y todavía no entró a ninguna liquidación. **Ya es plata que no se le debe**:
  // si esperara al cierre del mes, hasta entonces se le podría pagar de más.
  // Cuando la liquidación de ese mes lo incorpore, deja de estar "por
  // descontar" y pasa a restar en su período — nunca cuenta dos veces.
  const porDescontar = await cargarDescuentosPendientes(sb);
  const sinLiquidaciones = [...porDescontar.keys()].filter((id) => !porProfesor.has(id));
  if (sinLiquidaciones.length) {
    const profs = exigir(
      await sb.from("profesores").select("id, contacto:contactos(nombre, apellido)").in("id", sinLiquidaciones),
      "los profesores con descuentos pendientes"
    ) as unknown as { id: number; contacto: { nombre: string | null; apellido: string | null } | null }[];
    for (const p of profs)
      porProfesor.set(p.id, {
        nombre: `${p.contacto?.apellido ?? ""}, ${p.contacto?.nombre ?? ""}`,
        saldo: 0,
        periodos: 0,
        porDescontar: 0,
        clasesPorDescontar: 0,
      });
  }
  for (const [id, d] of porDescontar) {
    const v = porProfesor.get(id);
    if (!v) continue;
    v.porDescontar = d.monto;
    v.clasesPorDescontar = d.clases;
  }

  return [...porProfesor.entries()]
    .map(([profesorId, v]) => {
      const partes = [
        v.periodos > 0
          ? `Saldo de liquidaciones · ${v.periodos} ${v.periodos === 1 ? "período" : "períodos"}`
          : "Sin liquidaciones todavía",
      ];
      // "Pagado de más" es solo lo que ya salió de caja: un descuento por
      // reemplazo que todavía no se aplicó es otra cosa y se dice aparte.
      if (v.saldo < 0) partes.push("se le pagó de más");
      if (v.porDescontar > 0)
        partes.push(
          `${gs(v.porDescontar)} por reemplazo de ${v.clasesPorDescontar} ${
            v.clasesPorDescontar === 1 ? "clase" : "clases"
          }, a descontar`
        );
      return {
        clave: `profesor:${profesorId}`,
        bucket: "profesores" as const,
        // No se imputa contra una cuota: el destino se resuelve por cuenta, al
        // pagar, repartiendo entre los períodos del profesor.
        cuotaId: null,
        sujetoTipo: "profesor" as const,
        sujetoId: profesorId,
        sujeto: v.nombre,
        detalle: partes.join(" · "),
        saldo: Math.round((v.saldo - v.porDescontar) * 100) / 100,
        // Una liquidación no tiene fecha pactada de pago: no hay vencidas.
        fechaLimite: null,
        motivoSugerido: "comision_profesor",
      };
    })
    .sort((a, b) => a.sujeto.localeCompare(b.sujeto, "es"));
}

/**
 * Lo que se le va a descontar a cada titular por las clases que faltó y dictó
 * un reemplazante (regla de negocio 20a), **y que todavía no entró a ninguna
 * liquidación**. No es prorrateo: es la tarifa fija de esas clases, y se resta
 * de la cuenta del titular. Sale de las mismas filas que la liquidación
 * (`descuentos_liquidacion.sesion_id` marca las ya aplicadas).
 */
export async function cargarDescuentosPendientes(
  sb: ClienteLectura | ClienteAdmin
): Promise<Map<number, { monto: number; clases: number }>> {
  const ses = exigir(
    await sb
      .from("sesiones")
      .select("id, titular_id, reemplazo_costo")
      .eq("estado", "dictada")
      .eq("reemplazo_motivo", "titular")
      .not("titular_id", "is", null)
      .gt("reemplazo_costo", 0),
    "las clases con reemplazo del titular"
  ) as unknown as { id: number; titular_id: number; reemplazo_costo: number }[];
  const salida = new Map<number, { monto: number; clases: number }>();
  if (!ses.length) return salida;
  const aplicados = new Set(
    (
      exigir(
        await sb.from("descuentos_liquidacion").select("sesion_id").in("sesion_id", ses.map((x) => x.id)),
        "los descuentos ya aplicados"
      ) as { sesion_id: number | null }[]
    )
      .map((d) => d.sesion_id)
      .filter((x): x is number => x != null)
  );
  for (const x of ses) {
    if (aplicados.has(x.id)) continue;
    const ya = salida.get(x.titular_id) ?? { monto: 0, clases: 0 };
    ya.monto = Math.round((ya.monto + num(x.reemplazo_costo)) * 100) / 100;
    ya.clases += 1;
    salida.set(x.titular_id, ya);
  }
  return salida;
}

/**
 * Lo que se le debe a cada profesor por las clases que dictó como
 * **reemplazante** (regla de negocio 20), con lo ya pagado contra cada clase.
 *
 * Es la fuente única: la lista de "Por pagar" y la acción que paga leen de acá,
 * así que no pueden discrepar. Se puede acotar a un profesor.
 */
export async function cargarReemplazos(
  sb: ClienteLectura | ClienteAdmin,
  profesorId?: number
): Promise<Map<number, { nombre: string; clases: ClaseReemplazo[]; pagadoSinClase: number }>> {
  let consulta = sb
    .from("sesiones")
    .select(
      "id, fecha, profesor_id, reemplazo_costo, profesor:profesores!sesiones_profesor_id_fkey(contacto:contactos(nombre, apellido))"
    )
    .eq("estado", "dictada")
    .not("reemplazo_motivo", "is", null)
    .gt("reemplazo_costo", 0);
  if (profesorId != null) consulta = consulta.eq("profesor_id", profesorId);
  const ses = exigir(await consulta, "las clases con reemplazo") as unknown as {
    id: number;
    fecha: string;
    profesor_id: number | null;
    reemplazo_costo: number;
    profesor: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
  }[];

  let consultaPagos = sb.from("pagos").select("profesor_id, sesion_id, monto").eq("motivo", "pago_reemplazante");
  if (profesorId != null) consultaPagos = consultaPagos.eq("profesor_id", profesorId);
  const pagos = exigir(await consultaPagos, "los pagos a reemplazantes") as unknown as {
    profesor_id: number | null;
    sesion_id: number | null;
    monto: number;
  }[];

  const salida = new Map<number, { nombre: string; clases: ClaseReemplazo[]; pagadoSinClase: number }>();
  const vigentes = new Set<number>();
  for (const s of ses) {
    if (s.profesor_id == null) continue;
    vigentes.add(s.id);
    const ya = salida.get(s.profesor_id) ?? {
      nombre: s.profesor ? `${s.profesor.contacto?.apellido ?? ""}, ${s.profesor.contacto?.nombre ?? ""}` : `#${s.profesor_id}`,
      clases: [],
      pagadoSinClase: 0,
    };
    ya.clases.push({ sesionId: s.id, fecha: s.fecha, costo: num(s.reemplazo_costo), pagado: 0 });
    salida.set(s.profesor_id, ya);
  }
  for (const p of pagos) {
    if (p.profesor_id == null) continue;
    const dest = salida.get(p.profesor_id);
    const clase = dest?.clases.find((c) => c.sesionId === p.sesion_id);
    if (dest && clase) clase.pagado += num(p.monto);
    else if (dest) dest.pagadoSinClase += num(p.monto);
    // Un profesor sin ninguna clase vigente con pagos: queda fuera de la lista
    // (no hay nada que pagarle); su saldo negativo solo importa si aún dicta.
  }
  return salida;
}

/**
 * Una línea de "Por pagar" por profesor con reemplazos pendientes. **Aparte del
 * saldo de liquidaciones**: el suplente cobra por tarifa y desde que se registra
 * la clase, sin esperar al cierre del mes. *(Javier, 2026-09-18: "el monto
 * debería estar pagable de inmediato".)* Solo se listan los que tienen algo
 * pendiente.
 */
export async function lineasPorPagarReemplazos(sb: ClienteLectura): Promise<LineaPendiente[]> {
  const porProfesor = await cargarReemplazos(sb);
  const out: LineaPendiente[] = [];
  for (const [profesorId, v] of porProfesor) {
    const saldo = saldoDeReemplazos(v.clases, v.pagadoSinClase);
    if (saldo <= 0) continue;
    const pendientes = v.clases.filter((c) => c.costo - c.pagado > 0).length;
    out.push({
      clave: `reemplazo:${profesorId}`,
      bucket: "reemplazos",
      cuotaId: null,
      sujetoTipo: "profesor",
      sujetoId: profesorId,
      sujeto: v.nombre,
      detalle: `Reemplazos · ${pendientes} ${pendientes === 1 ? "clase" : "clases"}`,
      saldo,
      fechaLimite: null,
      motivoSugerido: "pago_reemplazante",
    });
  }
  return out.sort((a, b) => a.sujeto.localeCompare(b.sujeto, "es"));
}
