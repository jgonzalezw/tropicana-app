"use server";

/**
 * C2 — Disponibilidad + reserva mínima (solo bloqueos: D7).
 *
 * **Pantalla operativa, no administrativa.** El horario base (C1: patrón +
 * excepciones) se edita poco y vive en Administración → Sala y horarios. Ver
 * qué ocupa la sala hoy, bloquearla y cancelar un bloqueo es cotidiano —
 * Javier, 2026-09-17: "no me resulta útil que esta pantalla deba ser
 * accesible solo desde el contexto de administración... es operativa". Por
 * eso esta pantalla y sus acciones viven en su propia ruta (`/sala`), no
 * debajo de `administracion/`.
 *
 * Sin ventas de particulares/alquiler todavía (eso es C3), la única reserva
 * posible en `reservas_sala` es tipo 'bloqueo'. La disponibilidad combina el
 * horario base (C1) + los cursos regulares + esas reservas, con las
 * funciones de `src/lib/sala.ts` (las mismas que usa `calcularImpacto` en
 * `administracion/sala/acciones.ts` para C5).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso, obtenerParametro } from "@/lib/sesion";
import { aMinutos, esMultiploDe } from "@/lib/horarios";
import { COLS_VIGENCIA } from "@/lib/vigencia";
import {
  ocupacionDeCursos,
  ocupacionDeReservas,
  ocupacionDelDia,
  tramosLibres,
  ventanasDelDia,
  type BloqueOcupado,
  type CursoOcupa,
  type ExcepcionHorario,
  type FranjaPatron,
  type ReservaSalaOcupa,
  type Tramo,
  type Ventana,
} from "@/lib/sala";
import { validarReservaSala } from "@/lib/reservas";

const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

type ResultadoSimple = { ok?: true; error?: string; mensaje?: string };

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

export type BloqueDisponibilidad = BloqueOcupado & { id: number | null; notas: string | null };

export type DisponibilidadDia = {
  ventanas: Ventana[];
  excepcion: ExcepcionHorario | null;
  /** El motivo de `excepcion` ya resuelto a su etiqueta ("Feriado"), no la clave
   *  cruda del catálogo ("feriado") — regla de calidad 6: lo que se muestra es
   *  la etiqueta, la clave es solo lo que se guarda. */
  excepcionMotivoTexto: string | null;
  ocupados: BloqueDisponibilidad[];
  tramosLibres: Tramo[];
  /** Falló una lectura necesaria. Nunca se disfraza de "día libre" (regla de calidad 1). */
  error: string | null;
};

/** Lectura pura de la disponibilidad de una sala en una fecha — no muta nada. */
export async function consultarDisponibilidad(salaId: number, fechaISO: string): Promise<DisponibilidadDia> {
  const vacio: DisponibilidadDia = {
    ventanas: [],
    excepcion: null,
    excepcionMotivoTexto: null,
    ocupados: [],
    tramosLibres: [],
    error: null,
  };
  if (!(await tienePermiso("sala", "ver")))
    return { ...vacio, error: "Sin permiso para ver la disponibilidad de la sala." };
  if (!salaId || !ISO_FECHA.test(fechaISO)) return { ...vacio, error: "La fecha no es válida." };

  const sb = await createClient();

  const [patronR, excR, cursosR, catR, catExcR] = await Promise.all([
    sb.from("sala_horario_patron").select("dia_semana, desde, hasta").eq("sala_id", salaId),
    sb
      .from("sala_horario_excepciones")
      .select("fecha, hasta_fecha, cerrado, desde, hasta, motivo, glosa")
      .eq("sala_id", salaId),
    sb
      .from("cursos")
      .select(`id, nombre, dias_semana, hora, duracion_min, sala_id, ${COLS_VIGENCIA}`)
      .eq("sala_id", salaId)
      .eq("activo", true),
    sb.from("catalogos").select("id").eq("clave", "motivo_bloqueo_sala").maybeSingle(),
    sb.from("catalogos").select("id").eq("clave", "motivo_excepcion_horario").maybeSingle(),
  ]);
  if (patronR.error) return { ...vacio, error: `No se pudo leer el horario de la sala: ${patronR.error.message}` };
  if (excR.error) return { ...vacio, error: `No se pudieron leer las excepciones: ${excR.error.message}` };
  if (cursosR.error) return { ...vacio, error: `No se pudieron leer los cursos de la sala: ${cursosR.error.message}` };

  const patron = (patronR.data as FranjaPatron[]) ?? [];
  const excepciones = (excR.data as ExcepcionHorario[]) ?? [];
  const cursos = (cursosR.data as unknown as CursoOcupa[]) ?? [];
  const cursoIds = cursos.map((c) => c.id);

  const { data: susRows, error: errSus } = cursoIds.length
    ? await sb
        .from("sesiones")
        .select("curso_id")
        .in("curso_id", cursoIds)
        .eq("estado", "suspendida")
        .eq("fecha", fechaISO)
    : { data: [] as { curso_id: number }[], error: null };
  if (errSus) return { ...vacio, error: `No se pudieron leer las clases suspendidas: ${errSus.message}` };
  const suspendidos = new Set(((susRows as { curso_id: number }[]) ?? []).map((s) => s.curso_id));

  const { data: resRows, error: errRes } = await sb
    .from("reservas_sala")
    .select(
      "id, tipo, motivo, glosa, notas, hora, duracion_min, " +
        "membresia:membresias(alumno:alumnos(contacto:contactos(nombre, apellido)), plan:planes(estilo)), " +
        "profesor:profesores(contacto:contactos(nombre, apellido))"
    )
    .eq("sala_id", salaId)
    .eq("fecha", fechaISO)
    .neq("estado", "cancelada");
  if (errRes) return { ...vacio, error: `No se pudieron leer las reservas de la sala: ${errRes.message}` };
  type ReservaConJoins = {
    id: number;
    tipo: ReservaSalaOcupa["tipo"];
    motivo: string | null;
    glosa: string | null;
    notas: string | null;
    hora: string;
    duracion_min: number;
    membresia: {
      alumno: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
      plan: { estilo: string | null } | null;
    } | null;
    profesor: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
  };
  const resRaw = (resRows as unknown as ReservaConJoins[]) ?? [];

  // El estilo llega como clave (FK a `estilos`) — se resuelve a su nombre
  // como cualquier otro catálogo (regla de calidad 6), solo si hace falta.
  const clavesEstilo = new Set(
    resRaw
      .map((r) => r.membresia?.plan?.estilo)
      .filter((v): v is string => Boolean(v))
  );
  let nombreEstilo: ((v: string) => string) | undefined;
  if (clavesEstilo.size) {
    const { data: estRows, error: errEst } = await sb
      .from("estilos")
      .select("clave, nombre")
      .in("clave", [...clavesEstilo]);
    if (errEst) return { ...vacio, error: `No se pudieron leer los estilos: ${errEst.message}` };
    const mapaEst = new Map(((estRows as { clave: string; nombre: string }[]) ?? []).map((v) => [v.clave, v.nombre]));
    nombreEstilo = (v: string) => mapaEst.get(v) ?? v;
  }

  const reservas: (ReservaSalaOcupa & { notas: string | null })[] = resRaw.map((r) => {
    const contactoAlumno = r.membresia?.alumno?.contacto;
    const contactoProfesor = r.profesor?.contacto;
    const claveEstilo = r.membresia?.plan?.estilo ?? null;
    return {
      id: r.id,
      tipo: r.tipo,
      motivo: r.motivo,
      glosa: r.glosa,
      notas: r.notas,
      hora: r.hora,
      duracion_min: r.duracion_min,
      alumnoNombre: contactoAlumno ? `${contactoAlumno.nombre ?? ""} ${contactoAlumno.apellido ?? ""}`.trim() : null,
      profesorNombre: contactoProfesor
        ? `${contactoProfesor.nombre ?? ""} ${contactoProfesor.apellido ?? ""}`.trim()
        : null,
      estilo: claveEstilo ? (nombreEstilo?.(claveEstilo) ?? claveEstilo) : null,
    };
  });

  let etiquetaMotivo: ((v: string) => string) | undefined;
  const catalogo = catR.data as { id: number } | null;
  if (catalogo) {
    const { data: valRows, error: errVal } = await sb
      .from("catalogo_valores")
      .select("valor, etiqueta")
      .eq("catalogo_id", catalogo.id);
    if (errVal) return { ...vacio, error: `No se pudieron leer los motivos de bloqueo: ${errVal.message}` };
    const mapa = new Map(((valRows as { valor: string; etiqueta: string }[]) ?? []).map((v) => [v.valor, v.etiqueta]));
    etiquetaMotivo = (v: string) => mapa.get(v) ?? v;
  }

  const { ventanas, excepcion } = ventanasDelDia(patron, excepciones, fechaISO);

  // El motivo del cierre, resuelto a su etiqueta — nunca la clave cruda del
  // catálogo (regla de calidad 6). Mismo criterio que `guardarHorarioSala` usa
  // para el aviso al alumno.
  let excepcionMotivoTexto: string | null = null;
  const catalogoExc = catExcR.data as { id: number } | null;
  if (excepcion?.motivo && catalogoExc) {
    const { data: valExcRows, error: errValExc } = await sb
      .from("catalogo_valores")
      .select("valor, etiqueta")
      .eq("catalogo_id", catalogoExc.id);
    if (errValExc) return { ...vacio, error: `No se pudieron leer los motivos de excepción: ${errValExc.message}` };
    const mapaExc = new Map(((valExcRows as { valor: string; etiqueta: string }[]) ?? []).map((v) => [v.valor, v.etiqueta]));
    excepcionMotivoTexto = [mapaExc.get(excepcion.motivo) ?? excepcion.motivo, excepcion.glosa]
      .filter(Boolean)
      .join(" · ");
  } else if (excepcion?.glosa) {
    excepcionMotivoTexto = excepcion.glosa;
  }

  // Se arma a mano (no con `ocupacionDelDia`) para poder llevar el `id` y las
  // `notas` de cada reserva junto a su bloque — son propios de la fila, no del
  // concepto genérico "bloque ocupado" que usa el resto de `sala.ts`.
  const deCursos: BloqueDisponibilidad[] = ocupacionDeCursos(cursos, fechaISO, suspendidos, salaId).map((b) => ({
    ...b,
    id: null,
    notas: null,
  }));
  const deReservas: BloqueDisponibilidad[] = ocupacionDeReservas(reservas, etiquetaMotivo).map((b, i) => ({
    ...b,
    id: reservas[i].id,
    notas: reservas[i].notas,
  }));
  const ocupados = [...deCursos, ...deReservas].sort((a, b) => (aMinutos(a.hora) ?? 0) - (aMinutos(b.hora) ?? 0));

  return {
    ventanas,
    excepcion,
    excepcionMotivoTexto,
    ocupados,
    tramosLibres: tramosLibres(ventanas, ocupados),
    error: null,
  };
}

export type BloqueoNuevo = {
  fecha: string;
  hora: string;
  duracionMin: number;
  /** Valor del catálogo `motivo_bloqueo_sala` — nunca texto libre (regla de calidad 6). */
  motivo: string;
  glosa: string | null;
  notas: string | null;
};

/**
 * Crea un bloqueo de sala sin venta detrás (D7). Es la única reserva posible
 * hoy: particular/alquiler necesitan la venta (C3), que todavía no existe.
 */
export async function crearBloqueoSala(salaId: number, datos: BloqueoNuevo): Promise<ResultadoSimple> {
  if (!(await tienePermiso("sala", "editar")))
    return { error: "Sin permiso para reservar o bloquear la sala." };

  if (!ISO_FECHA.test(datos.fecha)) return { error: "La fecha de la reserva no es válida." };
  if (aMinutos(datos.hora) == null) return { error: "La hora de la reserva no es válida." };

  // Item 3: mismo incremento y mínimo que gobiernan Cursos y el horario base.
  const incrementoMin = Math.max(1, Number(await obtenerParametro("tiempos_incremento_min")) || 30);
  const minimoMin = Math.max(1, Number(await obtenerParametro("duracion_minima_curso_min")) || 30);
  if (!esMultiploDe(datos.duracionMin, incrementoMin) || datos.duracionMin < minimoMin)
    return { error: `La duración tiene que ser un múltiplo de ${incrementoMin} minutos, de al menos ${minimoMin}.` };

  const a = admin();

  // El motivo se re-valida en servidor aunque la UI ya lo restrinja a un
  // <select>: la lista manda, el cliente no es de confiar (regla de calidad 6).
  const { data: catRow, error: errCat } = await a
    .from("catalogos")
    .select("id")
    .eq("clave", "motivo_bloqueo_sala")
    .maybeSingle();
  if (errCat) return { error: `No se pudo leer el catálogo de motivos: ${errCat.message}` };
  const { data: valRows, error: errVal } = catRow
    ? await a.from("catalogo_valores").select("valor").eq("catalogo_id", catRow.id).eq("activo", true)
    : { data: [] as { valor: string }[], error: null };
  if (errVal) return { error: `No se pudieron leer los motivos de bloqueo: ${errVal.message}` };
  const motivosValidos = new Set(((valRows as { valor: string }[]) ?? []).map((v) => v.valor));
  if (!datos.motivo || !motivosValidos.has(datos.motivo))
    return { error: "Elegí un motivo de la lista: no se puede bloquear la sala sin decir por qué." };

  const [patronR, excR, cursosR, resR] = await Promise.all([
    a.from("sala_horario_patron").select("dia_semana, desde, hasta").eq("sala_id", salaId),
    a
      .from("sala_horario_excepciones")
      .select("fecha, hasta_fecha, cerrado, desde, hasta, motivo, glosa")
      .eq("sala_id", salaId),
    a
      .from("cursos")
      .select(`id, nombre, dias_semana, hora, duracion_min, sala_id, ${COLS_VIGENCIA}`)
      .eq("sala_id", salaId)
      .eq("activo", true),
    a
      .from("reservas_sala")
      .select("id, tipo, motivo, glosa, hora, duracion_min")
      .eq("sala_id", salaId)
      .eq("fecha", datos.fecha)
      .neq("estado", "cancelada"),
  ]);
  if (patronR.error) return { error: `No se pudo leer el horario de la sala: ${patronR.error.message}` };
  if (excR.error) return { error: `No se pudieron leer las excepciones: ${excR.error.message}` };
  if (cursosR.error) return { error: `No se pudieron leer los cursos de la sala: ${cursosR.error.message}` };
  if (resR.error) return { error: `No se pudieron leer las reservas de la sala: ${resR.error.message}` };

  const patron = (patronR.data as FranjaPatron[]) ?? [];
  const excepciones = (excR.data as ExcepcionHorario[]) ?? [];
  const cursos = (cursosR.data as unknown as CursoOcupa[]) ?? [];
  const reservas = (resR.data as ReservaSalaOcupa[]) ?? [];

  // Para leer el motivo de un cierre, si el horario rechaza por eso.
  const { data: catExcRow } = await a
    .from("catalogos")
    .select("id")
    .eq("clave", "motivo_excepcion_horario")
    .maybeSingle();
  const { data: valExcRows } = catExcRow
    ? await a.from("catalogo_valores").select("valor, etiqueta").eq("catalogo_id", catExcRow.id)
    : { data: [] as { valor: string; etiqueta: string }[] };
  const etiquetaExc = new Map(((valExcRows as { valor: string; etiqueta: string }[]) ?? []).map((v) => [v.valor, v.etiqueta]));

  const cursoIds = cursos.map((c) => c.id);
  const { data: susRows, error: errSus } = cursoIds.length
    ? await a.from("sesiones").select("curso_id").in("curso_id", cursoIds).eq("estado", "suspendida").eq("fecha", datos.fecha)
    : { data: [] as { curso_id: number }[], error: null };
  if (errSus) return { error: `No se pudieron leer las clases suspendidas: ${errSus.message}` };
  const suspendidos = new Set(((susRows as { curso_id: number }[]) ?? []).map((s) => s.curso_id));

  const ocupadosSala = ocupacionDelDia(cursos, reservas, datos.fecha, suspendidos, salaId);
  const validacion = validarReservaSala({
    fecha: datos.fecha,
    hora: datos.hora,
    duracionMin: datos.duracionMin,
    incrementoMin,
    minimoMin,
    sala: { esExterna: false, capacidad: null },
    patron,
    excepciones,
    ocupadosSala,
    etiquetaMotivoExcepcion: (v) => etiquetaExc.get(v) ?? v,
  });
  if (!validacion.ok) return { error: validacion.motivo };

  const { error: errIns } = await a.from("reservas_sala").insert({
    sala_id: salaId,
    tipo: "bloqueo",
    motivo: datos.motivo,
    glosa: datos.glosa?.trim() || null,
    notas: datos.notas?.trim() || null,
    fecha: datos.fecha,
    hora: datos.hora,
    duracion_min: datos.duracionMin,
  });
  if (errIns) {
    // `23P01` = exclusion_violation: alguien reservó ese rango entre la
    // validación de arriba y este insert. El cinturón de seguridad es la
    // base; el mensaje de choque (arriba) ya cubre el caso normal.
    if (errIns.code === "23P01")
      return {
        error:
          "La sala se acaba de ocupar con otra reserva en ese horario. Recargá la disponibilidad e intentá de nuevo.",
      };
    return { error: `No se pudo guardar la reserva: ${errIns.message}` };
  }

  revalidatePath("/sala");
  return { ok: true, mensaje: "Bloqueo registrado." };
}

/**
 * Cancela un bloqueo ya creado. Nunca hard delete: es un hecho auditable, como
 * cualquier suspensión (regla de negocio 16 aplicada acá a la sala).
 *
 * Acotado a `tipo='bloqueo'`: particular/alquiler todavía no se venden (C3), y
 * cuando existan van a tener sus propias reglas de cancelación (¿se devuelven
 * las horas al paquete?) que esta acción no contempla.
 */
export async function cancelarReservaSala(reservaId: number): Promise<ResultadoSimple> {
  if (!(await tienePermiso("sala", "editar")))
    return { error: "Sin permiso para cancelar una reserva de la sala." };

  const a = admin();
  const { data, error } = await a
    .from("reservas_sala")
    .update({ estado: "cancelada" })
    .eq("id", reservaId)
    .eq("tipo", "bloqueo")
    .neq("estado", "cancelada")
    .select("id");
  if (error) return { error: `No se pudo cancelar la reserva: ${error.message}` };
  if (!data || data.length === 0) return { error: "Esa reserva ya estaba cancelada, o no existe." };

  revalidatePath("/sala");
  return { ok: true, mensaje: "Reserva cancelada." };
}
