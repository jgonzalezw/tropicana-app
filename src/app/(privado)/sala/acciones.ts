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
import { aMinutos } from "@/lib/horarios";
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
import { validarReservaSala, validarTiempoReserva, ocupaAhora, FILTRO_ESTADOS_QUE_LIBERAN } from "@/lib/reservas";

const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

type ResultadoSimple = { ok?: true; error?: string; mensaje?: string };

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

export type BloqueDisponibilidad = BloqueOcupado & { id: number | null; notas: string | null; membresiaId: number | null };

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

  // Ronda 1: todo lo que NO depende de otra consulta, en paralelo — incluye
  // `reservas_sala` (solo necesita sala+fecha) y `estilos` entera (catálogo
  // chico, se trae siempre en vez de pedirla condicionada al resultado de
  // `reservas_sala`, para no encadenar una ronda más). Antes esto eran hasta
  // 6 round-trips secuenciales; Javier lo marcó lento al cambiar de fecha
  // (26/09) — con 2 rondas en paralelo alcanza.
  const [patronR, excR, cursosR, catR, catExcR, resR, estR] = await Promise.all([
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
    sb
      .from("reservas_sala")
      .select(
        "id, tipo, motivo, glosa, notas, hora, duracion_min, estado, solicitada_hasta, membresia_id, " +
          "membresia:membresias(alumno:alumnos(contacto:contactos(nombre, apellido)), plan:planes(estilo)), " +
          "profesor:profesores(contacto:contactos(nombre, apellido))"
      )
      .eq("sala_id", salaId)
      .eq("fecha", fechaISO)
      .not("estado", "in", FILTRO_ESTADOS_QUE_LIBERAN),
    sb.from("estilos").select("clave, nombre"),
  ]);
  if (patronR.error) return { ...vacio, error: `No se pudo leer el horario de la sala: ${patronR.error.message}` };
  if (excR.error) return { ...vacio, error: `No se pudieron leer las excepciones: ${excR.error.message}` };
  if (cursosR.error) return { ...vacio, error: `No se pudieron leer los cursos de la sala: ${cursosR.error.message}` };
  if (resR.error) return { ...vacio, error: `No se pudieron leer las reservas de la sala: ${resR.error.message}` };
  if (estR.error) return { ...vacio, error: `No se pudieron leer los estilos: ${estR.error.message}` };

  const patron = (patronR.data as FranjaPatron[]) ?? [];
  const excepciones = (excR.data as ExcepcionHorario[]) ?? [];
  const cursos = (cursosR.data as unknown as CursoOcupa[]) ?? [];
  const cursoIds = cursos.map((c) => c.id);
  const { ventanas, excepcion } = ventanasDelDia(patron, excepciones, fechaISO);
  const catalogo = catR.data as { id: number } | null;
  const catalogoExc = catExcR.data as { id: number } | null;

  // Ronda 2: lo que sí depende de la ronda 1 (cursoIds, o si hace falta el
  // catálogo de motivos), también en paralelo entre sí.
  const [susR, valR, valExcR] = await Promise.all([
    cursoIds.length
      ? sb.from("sesiones").select("curso_id").in("curso_id", cursoIds).eq("estado", "suspendida").eq("fecha", fechaISO)
      : Promise.resolve({ data: [] as { curso_id: number }[], error: null }),
    catalogo
      ? sb.from("catalogo_valores").select("valor, etiqueta").eq("catalogo_id", catalogo.id)
      : Promise.resolve({ data: [] as { valor: string; etiqueta: string }[], error: null }),
    excepcion?.motivo && catalogoExc
      ? sb.from("catalogo_valores").select("valor, etiqueta").eq("catalogo_id", catalogoExc.id)
      : Promise.resolve({ data: [] as { valor: string; etiqueta: string }[], error: null }),
  ]);
  if (susR.error) return { ...vacio, error: `No se pudieron leer las clases suspendidas: ${susR.error.message}` };
  if (valR.error) return { ...vacio, error: `No se pudieron leer los motivos de bloqueo: ${valR.error.message}` };
  if (valExcR.error) return { ...vacio, error: `No se pudieron leer los motivos de excepción: ${valExcR.error.message}` };
  const suspendidos = new Set(((susR.data as { curso_id: number }[]) ?? []).map((s) => s.curso_id));

  type ReservaConJoins = {
    id: number;
    tipo: ReservaSalaOcupa["tipo"];
    motivo: string | null;
    glosa: string | null;
    notas: string | null;
    hora: string;
    duracion_min: number;
    estado: string;
    solicitada_hasta: string | null;
    membresia_id: number | null;
    membresia: {
      alumno: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
      plan: { estilo: string | null } | null;
    } | null;
    profesor: { contacto: { nombre: string | null; apellido: string | null } | null } | null;
  };
  // Ya sin 'cancelada'/'reagendar'/'suspendida' (filtrados arriba); queda
  // descartar una Solicitada que venció su validez y ya no ocupa de verdad
  // (regla de negocio 4: se calcula al leer, no se guarda paso a paso).
  const ahoraSala = new Date();
  const resRaw = ((resR.data as unknown as ReservaConJoins[]) ?? []).filter((r) =>
    ocupaAhora({ tipo: r.tipo, estado: r.estado, solicitadaHasta: r.solicitada_hasta }, ahoraSala)
  );

  // El estilo llega como clave (FK a `estilos`) — se resuelve a su nombre
  // como cualquier otro catálogo (regla de calidad 6).
  const mapaEst = new Map(((estR.data as { clave: string; nombre: string }[]) ?? []).map((v) => [v.clave, v.nombre]));
  const nombreEstilo = (v: string) => mapaEst.get(v) ?? v;

  const reservas: (ReservaSalaOcupa & { notas: string | null; membresiaId: number | null })[] = resRaw.map((r) => {
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
      estilo: claveEstilo ? nombreEstilo(claveEstilo) : null,
      membresiaId: r.membresia_id,
    };
  });

  const etiquetaMotivo: ((v: string) => string) | undefined = catalogo
    ? (() => {
        const mapa = new Map(((valR.data as { valor: string; etiqueta: string }[]) ?? []).map((v) => [v.valor, v.etiqueta]));
        return (v: string) => mapa.get(v) ?? v;
      })()
    : undefined;

  // El motivo del cierre, resuelto a su etiqueta — nunca la clave cruda del
  // catálogo (regla de calidad 6). Mismo criterio que `guardarHorarioSala` usa
  // para el aviso al alumno.
  let excepcionMotivoTexto: string | null = null;
  if (excepcion?.motivo && catalogoExc) {
    const mapaExc = new Map(((valExcR.data as { valor: string; etiqueta: string }[]) ?? []).map((v) => [v.valor, v.etiqueta]));
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
    membresiaId: null,
  }));
  const deReservas: BloqueDisponibilidad[] = ocupacionDeReservas(reservas, etiquetaMotivo).map((b, i) => ({
    ...b,
    id: reservas[i].id,
    notas: reservas[i].notas,
    membresiaId: reservas[i].membresiaId,
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
  const tiempo = validarTiempoReserva({ hora: datos.hora, duracionMin: datos.duracionMin, incrementoMin, minimoMin });
  if (tiempo) return { error: tiempo };

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
      .select("id, tipo, motivo, glosa, hora, duracion_min, estado, solicitada_hasta")
      .eq("sala_id", salaId)
      .eq("fecha", datos.fecha)
      .not("estado", "in", FILTRO_ESTADOS_QUE_LIBERAN),
  ]);
  if (patronR.error) return { error: `No se pudo leer el horario de la sala: ${patronR.error.message}` };
  if (excR.error) return { error: `No se pudieron leer las excepciones: ${excR.error.message}` };
  if (cursosR.error) return { error: `No se pudieron leer los cursos de la sala: ${cursosR.error.message}` };
  if (resR.error) return { error: `No se pudieron leer las reservas de la sala: ${resR.error.message}` };

  const patron = (patronR.data as FranjaPatron[]) ?? [];
  const excepciones = (excR.data as ExcepcionHorario[]) ?? [];
  const cursos = (cursosR.data as unknown as CursoOcupa[]) ?? [];
  const ahoraBloqueo = new Date();
  const reservas = (
    (resR.data as (ReservaSalaOcupa & { estado: string; solicitada_hasta: string | null })[]) ?? []
  ).filter((r) => ocupaAhora({ tipo: r.tipo, estado: r.estado, solicitadaHasta: r.solicitada_hasta }, ahoraBloqueo));

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
