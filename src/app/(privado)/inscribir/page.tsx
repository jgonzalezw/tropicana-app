import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import { exigir } from "@/lib/datos";
import { isoFecha } from "@/lib/inscripcion";
import ClienteVentas from "./ClienteVentas";
import type { PlanVenta } from "./ClienteInscribir";
import type { Alumno, Curso } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaInscribir() {
  if (!(await tienePermiso("inscripciones", "ver"))) return <SinAcceso />;

  const supabase = await createClient();

  const [
    { data: alumnos },
    { data: cursos },
    { data: planes, error: errPlanes },
    { data: planCursos },
    { data: catCanal },
    mediosParam,
    diasCompromisoParam,
  ] = await Promise.all([
    supabase.from("alumnos").select("*").eq("activo", true).order("apellido").order("nombre"),
    supabase.from("cursos").select("*").eq("activo", true).order("nombre"),
    supabase
      .from("planes")
      .select("id, nombre, cantidad_clases, precio, acceso_modo, clases_ilimitadas, ciclo_dias, acepta_prueba, prueba_cursos_max, prueba_acredita, prueba_plazo_dias")
      .eq("tipo_servicio", "curso_regular")
      .eq("activo", true)
      .order("nombre"),
    supabase.from("plan_cursos").select("plan_id, curso_id"),
    supabase.from("catalogos").select("id").eq("clave", "canal_captacion").maybeSingle(),
    obtenerParametro("medios_pago"),
    obtenerParametro("dias_compromiso_pago"),
  ]);

  // Sin planes no hay venta: un fallo acá no puede pasar por "no hay ninguno".
  if (errPlanes) throw new Error(`No se pudieron cargar los planes: ${errPlanes.message}`);

  const cursosById = new Map<number, Curso>(((cursos as Curso[]) ?? []).map((c) => [c.id, c]));

  // Precio de prueba por curso: sin él, ese curso no se puede ofrecer a prueba.
  // Se exige: si esta lectura falla, la pantalla no puede decir "no hay
  // precios de prueba" — diría una mentira y nos manda a buscar el problema
  // donde no está (ya pasó).
  const tarifasPrueba = exigir(
    await supabase.from("curso_tarifas").select("curso_id, precio").eq("modalidad", "prueba"),
    "los precios de clase de prueba"
  );
  const precioPruebaPorCurso = new Map<number, number>(
    ((tarifasPrueba as { curso_id: number; precio: number }[]) ?? []).map((t) => [
      t.curso_id,
      Number(t.precio),
    ])
  );

  // Clases suspendidas: la pantalla tiene que poder decir a qué clase va el
  // alumno, y una suspendida no cuenta (regla de negocio 4). Sin esto la
  // pantalla mostraría una fecha y el motor guardaría otra.
  const desdeSusp = new Date();
  desdeSusp.setDate(desdeSusp.getDate() - 90);
  const sesionesSusp = exigir(
    await supabase
      .from("sesiones")
      .select("curso_id, fecha")
      .eq("estado", "suspendida")
      .gte("fecha", isoFecha(desdeSusp)),
    "las clases suspendidas"
  );
  const suspendidas = ((sesionesSusp as { curso_id: number; fecha: string }[]) ?? []).map(
    (s) => `${s.curso_id}|${s.fecha}`
  );

  // Cursos por plan.
  const cursosPorPlan: Record<number, number[]> = {};
  for (const r of (planCursos as { plan_id: number; curso_id: number }[]) ?? [])
    (cursosPorPlan[r.plan_id] ??= []).push(r.curso_id);

  // Cursos que da acceso un plan segun su modo (todas / excepto / solo).
  const activos = (cursos as Curso[]) ?? [];
  function cursosDelPlan(planId: number, modo: string): Curso[] {
    const sel = cursosPorPlan[planId] ?? [];
    if (modo === "todas") return activos;
    if (modo === "excepto") return activos.filter((c) => !sel.includes(c.id));
    return sel.map((cid) => cursosById.get(cid)).filter((c): c is Curso => !!c);
  }

  // Planes vendibles con sus cursos resueltos.
  const planesVenta: PlanVenta[] = ((planes as {
    id: number;
    nombre: string;
    cantidad_clases: number | null;
    precio: number;
    acceso_modo: string;
    clases_ilimitadas: boolean;
    ciclo_dias: number | null;
    acepta_prueba: boolean;
    prueba_cursos_max: number | null;
  }[]) ?? [])
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      cantidadClases: p.cantidad_clases,
      precio: Number(p.precio),
      ilimitado: p.clases_ilimitadas,
      cicloDias: p.ciclo_dias,
      aceptaPrueba: p.acepta_prueba,
      pruebaCursosMax: Math.max(1, Number(p.prueba_cursos_max) || 1),
      cursos: cursosDelPlan(p.id, p.acceso_modo).map((c) => ({
        id: c.id,
        nombre: c.nombre,
        dias_semana: c.dias_semana,
        hora: c.hora,
        precioPrueba: precioPruebaPorCurso.get(c.id) ?? null,
      })),
    }))
    .filter((p) => p.cursos.length > 0);

  // Canales de captación (alta rápida de alumno).
  let canales: { valor: string; etiqueta: string }[] = [];
  if (catCanal?.id) {
    const { data: valores } = await supabase
      .from("catalogo_valores")
      .select("valor, etiqueta")
      .eq("catalogo_id", catCanal.id)
      .eq("activo", true)
      .order("orden");
    canales = (valores as { valor: string; etiqueta: string }[]) ?? [];
  }

  // Panel del alumno: cursos activos y deuda pendiente + planes activos (dup).
  const [{ data: inscripciones }, { data: cuotas }, { data: pagos }] = await Promise.all([
    supabase.from("inscripciones").select("id, alumno_id, curso_id, plan_id, estado").eq("estado", "activa"),
    supabase.from("cuotas").select("id, inscripcion_id, monto_devengado, descuento_adelanto, estado"),
    supabase.from("pagos").select("cuota_id, monto, descuento").eq("tipo", "cobro"),
  ]);

  // Bonos de tolerancia pendientes de redimir, por alumno y plan.
  const { data: bonos } = await supabase
    .from("inscripciones")
    .select("alumno_id, plan_id, bono_generado")
    .eq("estado", "completada")
    .eq("bono_redimido", false)
    .gt("bono_generado", 0);
  const bonoPorAlumnoPlan: Record<number, Record<number, number>> = {};
  for (const b of (bonos as { alumno_id: number; plan_id: number | null; bono_generado: number }[]) ?? []) {
    if (b.plan_id == null) continue;
    (bonoPorAlumnoPlan[b.alumno_id] ??= {});
    bonoPorAlumnoPlan[b.alumno_id][b.plan_id] =
      (bonoPorAlumnoPlan[b.alumno_id][b.plan_id] ?? 0) + Math.max(0, Number(b.bono_generado));
  }

  // Crédito de clase de prueba por alumno y plan: lo que pagó por una prueba
  // de ese plan que todavía no convirtió. La pantalla lo muestra ANTES de
  // cobrar; el servidor lo vuelve a calcular al vender, que es lo que manda.
  const pruebas = exigir(
    await supabase
      .from("inscripciones")
      .select("id, alumno_id, plan_id, fecha_fin, acompanantes")
      .eq("es_prueba", true)
      .neq("estado", "baja"),
    "las clases de prueba"
  ) as {
    id: number; alumno_id: number; plan_id: number | null;
    fecha_fin: string | null; acompanantes: number | null;
  }[];
  const creditoPruebaPorAlumnoPlan: Record<
    number,
    Record<number, { monto: number; fecha: string; personas: number; pagado: number }>
  > = {};
  if (pruebas.length) {
    const convertidas = exigir(
      await supabase
        .from("inscripciones")
        .select("membresia_anterior_id")
        .in("membresia_anterior_id", pruebas.map((p) => p.id)),
      "las conversiones previas"
    ) as { membresia_anterior_id: number | null }[];
    const usadas = new Set(convertidas.map((x) => x.membresia_anterior_id));
    const cuotasPrueba = exigir(
      await supabase.from("cuotas").select("id, inscripcion_id").in("inscripcion_id", pruebas.map((p) => p.id)),
      "las cuotas de las pruebas"
    ) as { id: number; inscripcion_id: number }[];
    const pagosPrueba = cuotasPrueba.length
      ? (exigir(
          await supabase
            .from("pagos")
            .select("cuota_id, monto")
            .eq("tipo", "cobro")
            .in("cuota_id", cuotasPrueba.map((q) => q.id)),
          "los pagos de las pruebas"
        ) as { cuota_id: number | null; monto: number }[])
      : [];
    const pagadoPorInsc: Record<number, number> = {};
    const inscDeCuota = new Map(cuotasPrueba.map((q) => [q.id, q.inscripcion_id]));
    for (const pg of pagosPrueba) {
      const ins = pg.cuota_id != null ? inscDeCuota.get(pg.cuota_id) : undefined;
      if (ins != null) pagadoPorInsc[ins] = (pagadoPorInsc[ins] ?? 0) + Number(pg.monto);
    }
    const plazoParam = Math.max(0, Number(await obtenerParametro("prueba_plazo_dias")) || 7);
    const planCfg = new Map(
      ((planes as { id: number; prueba_acredita?: boolean; prueba_plazo_dias?: number | null }[]) ?? []).map(
        (p) => [p.id, p]
      )
    );
    const hoyStr = isoFecha(new Date());
    for (const pr of pruebas) {
      if (pr.plan_id == null || usadas.has(pr.id) || !pr.fecha_fin) continue;
      const cfg = planCfg.get(pr.plan_id);
      if (cfg && cfg.prueba_acredita === false) continue;
      const plazo = cfg?.prueba_plazo_dias ?? plazoParam;
      const v = new Date(pr.fecha_fin + "T00:00:00");
      v.setDate(v.getDate() + plazo);
      if (hoyStr > isoFecha(v)) continue; // fuera de plazo
      const pagado = pagadoPorInsc[pr.id] ?? 0;
      if (pagado <= 0) continue;
      // Se acredita LA PARTE DE ESTE ALUMNO, no el total del grupo (Javier,
      // opción b): en una prueba grupal cada uno paga lo suyo.
      const personas = 1 + Math.max(0, Number(pr.acompanantes) || 0);
      const monto = Math.round((pagado / personas) * 100) / 100;
      if (monto <= 0) continue;
      (creditoPruebaPorAlumnoPlan[pr.alumno_id] ??= {});
      // Con la fecha: "se le acredita su prueba" sin decir CUÁL prueba obliga
      // a ir a buscarla a otra pantalla.
      creditoPruebaPorAlumnoPlan[pr.alumno_id][pr.plan_id] = {
        monto, fecha: pr.fecha_fin, personas, pagado,
      };
    }
  }

  const inscById = new Map<number, { alumno_id: number }>();
  const cursosPorAlumno: Record<number, string[]> = {};
  const planesActivosPorAlumno: Record<number, number[]> = {};
  for (const i of (inscripciones as {
    id: number;
    alumno_id: number;
    curso_id: number;
    plan_id: number | null;
    estado: string;
  }[]) ?? []) {
    inscById.set(i.id, { alumno_id: i.alumno_id });
    const nom = cursosById.get(i.curso_id)?.nombre;
    if (nom) (cursosPorAlumno[i.alumno_id] ??= []).push(nom);
    if (i.plan_id != null) (planesActivosPorAlumno[i.alumno_id] ??= []).push(i.plan_id);
  }

  const pagadoPorCuota: Record<number, number> = {};
  for (const p of (pagos as { cuota_id: number | null; monto: number; descuento: number }[]) ?? []) {
    if (p.cuota_id == null) continue;
    pagadoPorCuota[p.cuota_id] = (pagadoPorCuota[p.cuota_id] ?? 0) + Number(p.monto) + Number(p.descuento);
  }
  const deudaPorAlumno: Record<number, number> = {};
  for (const q of (cuotas as {
    id: number;
    inscripcion_id: number;
    monto_devengado: number;
    descuento_adelanto: number;
    estado: string;
  }[]) ?? []) {
    if (q.estado === "pagada") continue;
    const insc = inscById.get(q.inscripcion_id);
    if (!insc) continue;
    const efectivo = Math.max(0, Number(q.monto_devengado) - Number(q.descuento_adelanto));
    const saldo = Math.max(0, efectivo - (pagadoPorCuota[q.id] ?? 0));
    if (saldo > 0) deudaPorAlumno[insc.alumno_id] = (deudaPorAlumno[insc.alumno_id] ?? 0) + saldo;
  }

  const medios = (mediosParam ?? "Efectivo,QR / transf.,Otro")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <ClienteVentas
      alumnos={(alumnos as Alumno[]) ?? []}
      planes={planesVenta}
      diasCompromiso={Math.max(1, Number(diasCompromisoParam) || 30)}
      medios={medios}
      canales={canales}
      cursosPorAlumno={cursosPorAlumno}
      deudaPorAlumno={deudaPorAlumno}
      planesActivosPorAlumno={planesActivosPorAlumno}
      bonoPorAlumnoPlan={bonoPorAlumnoPlan}
      suspendidas={suspendidas}
      creditoPruebaPorAlumnoPlan={creditoPruebaPorAlumnoPlan}
    />
  );
}
