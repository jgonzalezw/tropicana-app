"use server";

/**
 * El horario base de la sala (C1) — el lienzo del motor de disponibilidad.
 *
 * **Dos piezas que no se mezclan**: el patrón semanal (recurrente) y las
 * excepciones por fecha (un feriado que cierra, un día que abre distinto).
 *
 * **Vacío significa cerrado.** Guardar un día sin franjas lo deja cerrado, y eso
 * es deliberado: el default contrario dejaría la sala reservable a cualquier
 * hora por olvidar configurarla.
 *
 * **C3, hito H4 (26/09/2026)**: el impacto de una excepción ya no mira solo
 * clases de cursos — también las reservas de particular/alquiler confirmadas
 * (ROADMAP R1), y ya no solo un cierre completo, sino también un horario
 * reducido que deja una clase o una reserva afuera de la ventana nueva.
 * Borrar una excepción que ya suspendió algo ofrece revertirlo (ROADMAP R22).
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso, obtenerPerfilActual, obtenerParametro } from "@/lib/sesion";
import { aMinutos } from "@/lib/horarios";
import { COLS_VIGENCIA } from "@/lib/vigencia";
import {
  clasesAfectadasPorExcepciones,
  type ClaseAfectada,
  type CursoOcupa,
  type ExcepcionHorario,
  type MembresiaCobertura,
} from "@/lib/sala";
import { reservasAfectadasPorExcepciones, type ReservaAfectadaPorExcepcion, type ReservaOcupanteExcepcion } from "@/lib/reservas";
import { ejecutarSuspension, ejecutarReapertura, validarFecha } from "../../asistencia/acciones";
import { suspenderReservaOperativa, revertirSuspension } from "../../particulares/acciones";
import { fechaLarga } from "@/lib/inscripcion";

/** Un aviso listo para mandar a un alumno afectado por el cierre. `id` es
 *  solo la clave de React (no siempre es un alumno de curso: una reserva de
 *  particular suma su alumno Y su profesor, cada uno con su propio aviso). */
export type AvisoAlumno = { id: string; nombre: string; whatsapp: string | null; mensaje: string };

/** Qué se suspendió y quedaría atado a una excepción que se está por borrar
 *  (R22): se muestra antes de borrar, para poder ofrecer revertirlo. */
export type SuspensionLigada =
  | { tipo: "curso"; cursoId: number; cursoNombre: string; fecha: string }
  | { tipo: "particular"; reservaId: number; etiqueta: string; fecha: string; hora: string };

type ResultadoSimple = { ok?: true; error?: string; mensaje?: string };
type Resultado =
  | (ResultadoSimple & { avisos?: AvisoAlumno[] })
  | { requiereConfirmacion: true; afectadas: ClaseAfectada[]; reservasAfectadas: ReservaAfectadaPorExcepcion[] }
  | { requiereConfirmacionEliminacion: true; ligadas: SuspensionLigada[] };

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

export type FranjaEdit = { dia_semana: number; desde: string; hasta: string };

export type ExcepcionEdit = {
  /** null = fila nueva. */
  id: number | null;
  /** Primer día del rango. */
  fecha: string;
  /** Último día, inclusive. Igual a `fecha` en una excepción de un solo día. */
  hasta_fecha: string;
  cerrado: boolean;
  desde: string | null;
  hasta: string | null;
  motivo: string | null;
  glosa: string | null;
};

export type SalaEdit = {
  /** null = sala nueva. */
  id: number | null;
  nombre: string;
  orden: number;
  activa: boolean;
};

/**
 * Alta y edición de las salas.
 *
 * **El orden no es cosmético**: la de menor orden es la que se ofrece primero al
 * vender, y la siguiente entra cuando esa está ocupada (Javier, 2026-09-12).
 * Por eso se edita acá y no se deduce del id.
 */
export async function guardarSalas(salas: SalaEdit[]): Promise<ResultadoSimple> {
  if (!(await tienePermiso("sala", "editar")))
    return { error: "Sin permiso para editar las salas." };

  if (salas.length === 0) return { error: "Tiene que haber al menos una sala." };

  for (const s of salas) {
    if (!s.nombre.trim())
      return { error: "Una sala sin nombre no se puede distinguir de otra: poné el nombre." };
  }

  const nombres = salas.map((s) => s.nombre.trim().toLowerCase());
  const repetido = nombres.find((n, i) => nombres.indexOf(n) !== i);
  if (repetido)
    return {
      error: `Hay dos salas con el mismo nombre ("${repetido}"). Con nombres iguales no se puede saber en cuál se reservó.`,
    };

  if (!salas.some((s) => s.activa))
    return { error: "Tiene que quedar al menos una sala activa: si no, no se puede reservar nada." };

  const a = admin();

  for (const s of salas) {
    const fila = { nombre: s.nombre.trim(), orden: s.orden, activa: s.activa };
    const { error } = s.id
      ? await a.from("salas").update(fila).eq("id", s.id)
      : await a.from("salas").insert(fila);
    if (error) return { error: `No se pudo guardar la sala: ${error.message}` };
  }

  revalidatePath("/administracion/sala");
  revalidatePath("/cursos");
  return { ok: true };
}

const DIAS: Record<number, string> = {
  1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves",
  5: "viernes", 6: "sábado", 7: "domingo",
};

/**
 * Valida el patrón **antes** de tocar la base.
 *
 * Importa el orden: guardar el patrón reemplaza las filas de la sala (borrar +
 * insertar), así que un insert que falle después del borrado dejaría a la
 * escuela sin horario. Las dos únicas restricciones que puede rechazar la base
 * —fin posterior al inicio, y franjas que no se pisen— se chequean acá primero,
 * con el mismo criterio, para que ese caso no pueda ocurrir.
 */
function validarPatron(patron: FranjaEdit[], incrementoMin: number): string | null {
  for (const f of patron) {
    const d = aMinutos(f.desde);
    const h = aMinutos(f.hasta);
    if (d == null || h == null)
      return `Hay una franja del ${DIAS[f.dia_semana]} sin hora de inicio o de fin.`;
    if (h <= d)
      return `El ${DIAS[f.dia_semana]} tiene una franja que termina antes de empezar (${f.desde}–${f.hasta}).`;
    // Item 3 (Javier, 2026-09-16): mismo incremento que Cursos, para que el
    // calendario de sala no quede con minutos sueltos (8:07, 14:23...). Es
    // hora del día, no una duración: 00:00 (d=0) es un múltiplo válido, por
    // eso el resto se mira directo en vez de `esMultiploDe` (que exige > 0).
    if (d % incrementoMin !== 0 || h % incrementoMin !== 0)
      return (
        `El ${DIAS[f.dia_semana]} tiene una franja (${f.desde}–${f.hasta}) que no cae en el ` +
        `incremento de ${incrementoMin} minutos.`
      );
  }

  for (let dia = 1; dia <= 7; dia++) {
    const delDia = patron
      .filter((f) => f.dia_semana === dia)
      .map((f) => ({ d: aMinutos(f.desde)!, h: aMinutos(f.hasta)!, f }))
      .sort((a, b) => a.d - b.d);
    for (let i = 1; i < delDia.length; i++) {
      if (delDia[i].d < delDia[i - 1].h)
        return (
          `Dos franjas del ${DIAS[dia]} se pisan: ${delDia[i - 1].f.desde}–${delDia[i - 1].f.hasta} ` +
          `y ${delDia[i].f.desde}–${delDia[i].f.hasta}. Un rango no puede estar abierto dos veces.`
        );
    }
  }
  return null;
}

/** "Alumno Apellido" de una reserva particular con el join de `contextoAviso`
 *  hecho a mano (acá no hace falta el contexto completo, solo el nombre para
 *  la lista de impacto/ligadas). */
function nombreAlumnoDe(r: {
  membresia: { alumno: { contacto: { nombre: string | null; apellido: string | null } | null } | null } | null;
}): string | null {
  const c = r.membresia?.alumno?.contacto;
  return c ? `${c.nombre ?? ""} ${c.apellido ?? ""}`.trim() || null : null;
}

/**
 * Qué clases de cursos y qué reservas de particular/alquiler quedan afectadas
 * por las excepciones que se están por guardar: cierre completo u horario
 * reducido (H4 — antes solo miraba cursos y solo cierres completos, R1).
 */
async function calcularImpacto(
  a: ReturnType<typeof admin>,
  salaId: number,
  excepciones: ExcepcionEdit[]
): Promise<{ clases: ClaseAfectada[]; reservas: ReservaAfectadaPorExcepcion[] }> {
  // Cualquier excepción bien formada puede afectar algo: un cierre completo,
  // o una que abre distinto con menos horas que antes.
  const relevantes = excepciones.filter((e) => e.cerrado || (e.desde && e.hasta));
  if (!relevantes.length) return { clases: [], reservas: [] };

  const desde = relevantes.reduce((m, e) => (e.fecha < m ? e.fecha : m), relevantes[0].fecha);
  const hasta = relevantes.reduce((m, e) => (e.hasta_fecha > m ? e.hasta_fecha : m), relevantes[0].hasta_fecha);
  const excepcionesHorario: ExcepcionHorario[] = relevantes.map((e) => ({
    fecha: e.fecha,
    hasta_fecha: e.hasta_fecha,
    cerrado: e.cerrado,
    desde: e.desde,
    hasta: e.hasta,
    motivo: e.motivo,
    glosa: e.glosa,
  }));

  // ── Cursos regulares ──────────────────────────────────────────────────
  const { data: cursosRows } = await a
    .from("cursos")
    .select(`id, nombre, dias_semana, hora, duracion_min, sala_id, ${COLS_VIGENCIA}`)
    .eq("sala_id", salaId)
    .eq("activo", true);
  const cursos = (cursosRows as unknown as CursoOcupa[]) ?? [];
  const cursoIds = cursos.map((c) => c.id);

  let clases: ClaseAfectada[] = [];
  if (cursoIds.length) {
    // Membresías: por `membresia_cursos`, que es donde el glosario dice que
    // vive qué cursos toca una membresía — no `membresias.curso_id`, que es
    // un resabio mono-curso.
    const { data: icRows } = await a
      .from("membresia_cursos")
      .select("curso_id, inscripcion:membresias!inner(alumno_id, estado, fecha_inicio, fecha_fin)")
      .in("curso_id", cursoIds);
    const membresias: MembresiaCobertura[] = (
      (icRows as unknown as {
        curso_id: number;
        inscripcion: { alumno_id: number; estado: string; fecha_inicio: string; fecha_fin: string | null };
      }[]) ?? []
    )
      .filter((r) => r.inscripcion.estado === "activa")
      .map((r) => ({
        alumno_id: r.inscripcion.alumno_id,
        curso_id: r.curso_id,
        fecha_inicio: r.inscripcion.fecha_inicio,
        fecha_fin: r.inscripcion.fecha_fin,
      }));

    const { data: susRows } = await a
      .from("sesiones")
      .select("curso_id, fecha")
      .in("curso_id", cursoIds)
      .eq("estado", "suspendida")
      .gte("fecha", desde)
      .lte("fecha", hasta);
    const yaSuspendidas = new Set(
      ((susRows as { curso_id: number; fecha: string }[]) ?? []).map((s) => `${s.curso_id}|${s.fecha}`)
    );

    clases = clasesAfectadasPorExcepciones(cursos, membresias, excepcionesHorario, desde, hasta, yaSuspendidas);
  }

  // ── Reservas de particular/alquiler (R1) ──────────────────────────────
  const { data: resRows } = await a
    .from("reservas_sala")
    .select(
      "id, tipo, fecha, hora, duracion_min, membresia:membresias(alumno:alumnos(contacto:contactos(nombre, apellido)))"
    )
    .eq("sala_id", salaId)
    .in("tipo", ["particular", "alquiler"])
    .in("estado", ["confirmada", "reprogramada"])
    .gte("fecha", desde)
    .lte("fecha", hasta);
  type ReservaImpactoRow = {
    id: number;
    tipo: string;
    fecha: string;
    hora: string;
    duracion_min: number;
    membresia: { alumno: { contacto: { nombre: string | null; apellido: string | null } | null } | null } | null;
  };
  const candidatas: ReservaOcupanteExcepcion[] = ((resRows as unknown as ReservaImpactoRow[]) ?? []).map((r) => ({
    reservaId: r.id,
    fecha: r.fecha,
    hora: r.hora,
    duracionMin: r.duracion_min,
    etiqueta: r.tipo === "particular" ? nombreAlumnoDe(r) ?? "Clase particular" : "Alquiler de sala",
    detalle: null,
  }));
  const reservas = reservasAfectadasPorExcepciones(candidatas, excepcionesHorario);

  return { clases, reservas };
}

/**
 * Qué suspensiones (de curso o de reserva) quedaron atadas a estas
 * excepciones — lo que se ofrece revertir si se borran (R22).
 */
async function buscarLigadasAExcepciones(
  a: ReturnType<typeof admin>,
  excepcionIds: number[]
): Promise<SuspensionLigada[]> {
  if (!excepcionIds.length) return [];

  const [susR, resR] = await Promise.all([
    a
      .from("sesiones")
      .select("id, curso_id, fecha, curso:cursos(nombre)")
      .in("excepcion_id", excepcionIds)
      .eq("estado", "suspendida"),
    a
      .from("reservas_sala")
      .select(
        "id, fecha, hora, tipo, membresia:membresias(alumno:alumnos(contacto:contactos(nombre, apellido)))"
      )
      .in("suspendida_por_excepcion_id", excepcionIds)
      .eq("estado", "suspendida"),
  ]);

  const cursoLigadas: SuspensionLigada[] = (
    (susR.data as unknown as { id: number; curso_id: number; fecha: string; curso: { nombre: string } | null }[]) ?? []
  ).map((s) => ({
    tipo: "curso" as const,
    cursoId: s.curso_id,
    cursoNombre: s.curso?.nombre ?? `Curso #${s.curso_id}`,
    fecha: s.fecha,
  }));

  type ReservaLigadaRow = {
    id: number;
    fecha: string;
    hora: string;
    tipo: string;
    membresia: { alumno: { contacto: { nombre: string | null; apellido: string | null } | null } | null } | null;
  };
  const reservaLigadas: SuspensionLigada[] = ((resR.data as unknown as ReservaLigadaRow[]) ?? []).map((r) => ({
    tipo: "particular" as const,
    reservaId: r.id,
    etiqueta: (r.tipo === "particular" ? nombreAlumnoDe(r) : null) ?? "Clase particular",
    fecha: r.fecha,
    hora: r.hora,
  }));

  return [...cursoLigadas, ...reservaLigadas];
}

/** Revierte cada ligada: reabre la sesión (cursos) o crea la reserva nueva
 *  que reemplaza a la suspendida (particulares — `revertirSuspension`, que
 *  ya revalida sala/profesor/saldo/vigencia de cero). Nunca a ciegas: lo que
 *  no se pudo revertir se informa, no se silencia (calidad 1). */
async function revertirLigadas(
  a: ReturnType<typeof admin>,
  ligadas: SuspensionLigada[]
): Promise<{ revertidas: number; fallidas: string[] }> {
  let revertidas = 0;
  const fallidas: string[] = [];
  for (const l of ligadas) {
    if (l.tipo === "curso") {
      await ejecutarReapertura(a, { cursoId: l.cursoId, fecha: l.fecha });
      revertidas++;
    } else {
      const r = await revertirSuspension(l.reservaId);
      if (r.error) fallidas.push(`${l.etiqueta} (${l.fecha} ${l.hora.slice(0, 5)}): ${r.error}`);
      else revertidas++;
    }
  }
  return { revertidas, fallidas };
}

export async function guardarHorarioSala(
  salaId: number,
  patron: FranjaEdit[],
  excepciones: ExcepcionEdit[],
  excepcionesEliminadas: number[],
  opciones: { confirmarImpacto?: boolean; confirmarEliminacion?: "revertir" | "sin_revertir" } = {}
): Promise<Resultado> {
  if (!(await tienePermiso("sala", "editar")))
    return { error: "Sin permiso para editar el horario de la sala." };

  // Item 3 (Javier, 2026-09-16): mismo incremento que gobierna Cursos.
  const incrementoMin = Math.max(1, Number(await obtenerParametro("tiempos_incremento_min")) || 30);

  const err = validarPatron(patron, incrementoMin);
  if (err) return { error: err };

  for (const e of excepciones) {
    if (!e.fecha) return { error: "Una excepción sin fecha no significa nada: poné la fecha." };
    if (!e.hasta_fecha) return { error: `La excepción del ${e.fecha} no tiene fecha de fin.` };
    if (e.hasta_fecha < e.fecha)
      return { error: `La excepción del ${e.fecha} termina antes de empezar.` };
    if (!e.cerrado) {
      const d = aMinutos(e.desde ?? "");
      const h = aMinutos(e.hasta ?? "");
      if (d == null || h == null)
        return { error: `El ${e.fecha} abre en otro horario: cargá desde y hasta.` };
      if (h <= d)
        return { error: `El horario del ${e.fecha} termina antes de empezar.` };
      if (d % incrementoMin !== 0 || h % incrementoMin !== 0)
        return {
          error: `El horario del ${e.fecha} (${e.desde}–${e.hasta}) no cae en el incremento de ${incrementoMin} minutos.`,
        };
    }
  }

  const a = admin();

  // Borrar una excepción que ya suspendió algo (curso o reserva) pregunta
  // primero si se quiere revertir eso (R22) — nunca se pierde en silencio.
  if (excepcionesEliminadas.length && !opciones.confirmarEliminacion) {
    const ligadas = await buscarLigadasAExcepciones(a, excepcionesEliminadas);
    if (ligadas.length) return { requiereConfirmacionEliminacion: true, ligadas };
  }

  // Antes de tocar la base: si algún cierre u horario reducido nuevo pisa
  // clases o reservas activas, se avisa y se pide confirmación explícita —
  // nunca se suspende nada en silencio.
  const impacto = await calcularImpacto(a, salaId, excepciones);
  if ((impacto.clases.length || impacto.reservas.length) && !opciones.confirmarImpacto)
    return { requiereConfirmacion: true, afectadas: impacto.clases, reservasAfectadas: impacto.reservas };

  const perfil = await obtenerPerfilActual();

  // Se captura ANTES de borrar la excepción: sus vínculos (`excepcion_id`,
  // `suspendida_por_excepcion_id`) son `on delete set null` — después de
  // borrarla ya no se podría encontrar qué revertir.
  let ligadasARevertir: SuspensionLigada[] = [];
  if (excepcionesEliminadas.length && opciones.confirmarEliminacion === "revertir") {
    ligadasARevertir = await buscarLigadasAExcepciones(a, excepcionesEliminadas);
  }

  // El patrón se reemplaza entero. Es una tabla de configuración chica (a lo
  // sumo unas pocas franjas por día) y el diff no compraría nada.
  const { error: errDel } = await a
    .from("sala_horario_patron")
    .delete()
    .eq("sala_id", salaId);
  if (errDel) return { error: `No se pudo limpiar el horario: ${errDel.message}` };

  if (patron.length) {
    const { error } = await a.from("sala_horario_patron").insert(
      patron.map((f) => ({
        sala_id: salaId,
        dia_semana: f.dia_semana,
        desde: f.desde,
        hasta: f.hasta,
      }))
    );
    if (error) return { error: `No se pudo guardar el horario: ${error.message}` };
  }

  // Las excepciones sí van una por una: son hechos con fecha propia, y el
  // EXCLUDE por sala las mantiene sin pisarse entre ellas.
  for (const id of excepcionesEliminadas) {
    const { error } = await a.from("sala_horario_excepciones").delete().eq("id", id);
    if (error) return { error: `No se pudo eliminar una excepción: ${error.message}` };
  }

  // Se guarda cada excepción reteniendo su id definitivo (una nueva recién lo
  // tiene después del insert): hace falta para que `ejecutarSuspension` deje
  // el vínculo `sesiones.excepcion_id` y H4 pueda revertir SOLO lo que causó
  // esta excepción puntual, nunca una suspensión de otro origen.
  const excepcionesGuardadas: (ExcepcionEdit & { idFinal: number })[] = [];
  for (const e of excepciones) {
    const fila = {
      sala_id: salaId,
      fecha: e.fecha,
      hasta_fecha: e.hasta_fecha,
      cerrado: e.cerrado,
      desde: e.cerrado ? null : e.desde,
      hasta: e.cerrado ? null : e.hasta,
      motivo: e.motivo || null,
      glosa: e.glosa?.trim() || null,
    };
    const { data, error } = e.id
      ? await a.from("sala_horario_excepciones").update(fila).eq("id", e.id).select("id").single()
      : await a.from("sala_horario_excepciones").insert(fila).select("id").single();
    if (error) {
      // `23P01` = exclusion_violation: el rango se pisa con otra excepción.
      // No se puede permitir, porque una fecha tendría dos horarios distintos
      // y no habría forma de elegir cuál vale.
      if (error.code === "23P01" || error.code === "23505")
        return {
          error:
            `El período ${e.fecha} → ${e.hasta_fecha} se pisa con otra excepción ya cargada ` +
            `de esta sala. Editá la que existe o ajustá las fechas para que no se superpongan.`,
        };
      return { error: `No se pudo guardar la excepción del ${e.fecha}: ${error.message}` };
    }
    excepcionesGuardadas.push({ ...e, idFinal: (data as { id: number }).id });
  }
  const excepcionQueCubre = (fecha: string) =>
    excepcionesGuardadas.find((e) => e.fecha <= fecha && fecha <= e.hasta_fecha) ?? null;

  // Recién ACÁ se revierte lo que la excepción borrada había suspendido: la
  // excepción ya no existe en la base, así que `dentroDelHorario` no la ve
  // más al revalidar la franja (si se revertía antes de borrarla, la
  // reversión se rechazaba a sí misma: "la sala no abre" por el cierre que
  // se está borrando en el mismo guardado).
  let revertidasMsg = "";
  const noRevertidas: string[] = [];
  if (ligadasARevertir.length) {
    const { revertidas, fallidas } = await revertirLigadas(a, ligadasARevertir);
    if (revertidas) revertidasMsg = `Se restableci${revertidas === 1 ? "ó 1 clase" : `eron ${revertidas} clases`}.`;
    noRevertidas.push(...fallidas);
  }

  // Etiqueta legible del motivo (regla de calidad 6: el valor guardado es la
  // clave del catálogo, "feriado"; lo que se lee es su etiqueta).
  const { data: catRow } = await a
    .from("catalogos")
    .select("id")
    .eq("clave", "motivo_excepcion_horario")
    .maybeSingle();
  const { data: valRows } = catRow
    ? await a.from("catalogo_valores").select("valor, etiqueta").eq("catalogo_id", catRow.id)
    : { data: [] };
  const etiquetaDe = new Map(
    ((valRows as { valor: string; etiqueta: string }[]) ?? []).map((v) => [v.valor, v.etiqueta])
  );

  // El cierre ya está guardado: ahora sí se suspenden las clases y reservas
  // que caían adentro. Se usa el mismo núcleo que la asistencia del día a día
  // (`ejecutarSuspension`), con `permitirFutura` porque acá se sabe con
  // anticipación que la sala no va a estar disponible — un feriado de la
  // semana que viene no puede esperar a que llegue la fecha.
  let suspendidas = 0;
  const noSuspendidas: string[] = [...noRevertidas];
  // Por alumno: cada clase suya que quedó suspendida en este cierre, con el
  // motivo tal como lo va a leer (etiqueta del catálogo + la glosa entre
  // paréntesis) y a qué fecha le quedó el ciclo si se corrió. Un alumno con
  // dos clases dentro del mismo feriado recibe un solo aviso con las dos.
  const porAlumno = new Map<
    number,
    { curso: string; fecha: string; finCicloNuevo: string | null; motivoTexto: string }[]
  >();
  const avisos: AvisoAlumno[] = [];

  for (const c of impacto.clases) {
    const exc = excepcionQueCubre(c.fecha);
    const etiquetaImpacto = c.motivoImpacto === "cierre" ? "Cierre de sala" : "Horario reducido de sala";
    // Lo que va al campo `motivo` de la sesión (auditoría interna, texto
    // libre) sigue siendo explícito sobre que viene de una excepción de sala.
    const motivo = [etiquetaImpacto, exc?.motivo, exc?.glosa].filter(Boolean).join(" — ");
    // Lo que lee el alumno: el motivo tal cual lo elige quien carga la
    // excepción, con la glosa como aclaración entre paréntesis — sin hablar
    // de "sala" ni de mecánica interna (Javier, 2026-09-16).
    const motivoTexto = exc?.motivo
      ? `${etiquetaDe.get(exc.motivo) ?? exc.motivo}${exc.glosa ? ` (${exc.glosa})` : ""}`
      : (exc?.glosa ?? "un cierre");
    const errFecha = await validarFecha(c.cursoId, c.fecha, { permitirFutura: true });
    if (errFecha) {
      // `validarFecha` rechazó esta clase (hoy solo por vigencia del curso o
      // por la ventana de semanas). La sala queda cerrada igual; esa clase
      // puntual queda listada para corregirla a mano.
      noSuspendidas.push(`${c.cursoNombre} (${c.fecha}): ${errFecha}`);
      continue;
    }
    const r = await ejecutarSuspension(a, {
      cursoId: c.cursoId,
      fecha: c.fecha,
      motivo,
      registradoPor: perfil?.id ?? null,
      excepcionId: exc?.idFinal ?? null,
    });
    suspendidas++;

    const finPorAlumno = new Map(r.alumnosCorridos.map((x) => [x.alumnoId, x.finCicloNuevo]));
    for (const alumnoId of r.alumnosAfectados) {
      const lista = porAlumno.get(alumnoId) ?? [];
      lista.push({
        curso: c.cursoNombre,
        fecha: c.fecha,
        finCicloNuevo: finPorAlumno.get(alumnoId) ?? null,
        motivoTexto,
      });
      porAlumno.set(alumnoId, lista);
    }
  }

  for (const r of impacto.reservas) {
    const exc = excepcionQueCubre(r.fecha);
    const motivoTexto = exc?.motivo
      ? `${etiquetaDe.get(exc.motivo) ?? exc.motivo}${exc.glosa ? ` (${exc.glosa})` : ""}`
      : (exc?.glosa ?? "un cierre de sala");
    const res = await suspenderReservaOperativa(
      r.reservaId,
      { motivoClave: "cierre_sala", motivoTexto, excepcionId: exc?.idFinal },
      perfil?.id ?? null
    );
    if (!res.ok) {
      noSuspendidas.push(`${r.etiqueta} (${r.fecha}): ${res.error}`);
      continue;
    }
    suspendidas++;
    if (res.avisoAlumno) avisos.push({ id: `reserva-${r.reservaId}-alumno`, ...res.avisoAlumno });
    if (res.avisoProfesor) avisos.push({ id: `reserva-${r.reservaId}-profesor`, ...res.avisoProfesor });
  }

  // El aviso, listo para copiar y pegar por WhatsApp — pedido de Javier
  // (2026-09-16): mientras no haya envío automático, al menos poder pasarlo a
  // mano a cada alumno hoy mismo.
  if (porAlumno.size) {
    const { data: alRows } = await a
      .from("alumnos")
      .select("id, contacto_id, es_menor, contacto:contactos(nombre, apellido, whatsapp)")
      .in("id", [...porAlumno.keys()]);
    type AlumnoAviso = {
      id: number;
      contacto_id: number;
      es_menor: boolean;
      contacto: { nombre: string | null; apellido: string | null; whatsapp: string | null } | null;
    };
    const filas = (alRows as unknown as AlumnoAviso[]) ?? [];
    const datos = new Map(filas.map((x) => [x.id, x]));

    // Un menor sin WhatsApp propio: se usa el del tutor (contacto_relaciones
    // tipo tutor_de), si tiene uno cargado.
    const idsMenoresSinWa = filas.filter((x) => x.es_menor && !x.contacto?.whatsapp).map((x) => x.contacto_id);
    const waTutorPorContacto = new Map<number, string>();
    if (idsMenoresSinWa.length) {
      const { data: rels } = await a
        .from("contacto_relaciones")
        .select("hacia_id, tutor:contactos!contacto_relaciones_desde_id_fkey(whatsapp)")
        .eq("tipo", "tutor_de")
        .in("hacia_id", idsMenoresSinWa);
      for (const r of (rels as unknown as { hacia_id: number; tutor: { whatsapp: string | null } | null }[]) ?? [])
        if (r.tutor?.whatsapp) waTutorPorContacto.set(r.hacia_id, r.tutor.whatsapp);
    }

    const avisosCurso: AvisoAlumno[] = [];
    for (const [alumnoId, clases] of porAlumno) {
      const al = datos.get(alumnoId);
      const nombre = al?.contacto ? `${al.contacto.nombre ?? ""} ${al.contacto.apellido ?? ""}`.trim() : `Alumno #${alumnoId}`;
      const detalle = clases
        .map((cl) => `${cl.curso} del ${fmtLarga(cl.fecha)}`)
        .join(clases.length > 1 ? ", " : "");
      const finCiclo = clases.find((cl) => cl.finCicloNuevo)?.finCicloNuevo;
      // El motivo que se lee es el de la primera clase: en el uso real se
      // guarda una excepción por vez, así que las clases de un mismo aviso
      // comparten motivo. Si alguna vez difieren, queda pendiente mostrar más
      // de uno — anotado en el ROADMAP junto con el resto de notificaciones.
      const motivoTexto = clases[0].motivoTexto;
      const partesMsg = [
        `Hola ${al?.contacto?.nombre ?? nombre}! Te avisamos que tu clase de ${detalle} qued${
          clases.length > 1 ? "aron suspendidas" : "ó suspendida"
        } por ${motivoTexto}.`,
      ];
      if (finCiclo) partesMsg.push(`Tu ciclo se corrió: ahora vence el ${fmtLarga(finCiclo)}.`);
      partesMsg.push("Cualquier duda, escribinos por acá. ¡Gracias!");
      const whatsapp = al?.contacto?.whatsapp ?? (al ? waTutorPorContacto.get(al.contacto_id) ?? null : null);
      avisosCurso.push({ id: `curso-${alumnoId}`, nombre, whatsapp, mensaje: partesMsg.join(" ") });
    }
    avisosCurso.sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
    avisos.push(...avisosCurso);
  }

  revalidatePath("/administracion/sala");
  revalidatePath("/asistencia");
  revalidatePath("/particulares");
  revalidatePath("/sala");

  const plu = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  const partes = ["Horario guardado."];
  if (revertidasMsg) partes.push(revertidasMsg);
  if (suspendidas > 0)
    partes.push(`Se suspendieron ${plu(suspendidas, "clase", "clases")} u horas ya vendidas.`);
  if (noSuspendidas.length)
    partes.push(
      `${plu(noSuspendidas.length, "clase queda", "clases quedan")} sin resolver automáticamente — revisalas a mano: ${noSuspendidas.join("; ")}.`
    );

  return { ok: true, mensaje: partes.join(" "), avisos };
}

function fmtLarga(iso: string): string {
  return fechaLarga(new Date(iso.slice(0, 10) + "T00:00:00"));
}
