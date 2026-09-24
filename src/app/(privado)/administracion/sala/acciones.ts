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
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso, obtenerPerfilActual, obtenerParametro } from "@/lib/sesion";
import { aMinutos } from "@/lib/horarios";
import { COLS_VIGENCIA } from "@/lib/vigencia";
import { clasesAfectadasPorCierre, type ClaseAfectada, type CursoOcupa, type MembresiaCobertura } from "@/lib/sala";
import { ejecutarSuspension, validarFecha } from "../../asistencia/acciones";
import { fechaLarga } from "@/lib/inscripcion";

/** Un aviso listo para mandar a un alumno afectado por el cierre. */
export type AvisoAlumno = {
  alumnoId: number;
  nombre: string;
  whatsapp: string | null;
  mensaje: string;
};

type ResultadoSimple = { ok?: true; error?: string; mensaje?: string };
type Resultado =
  | (ResultadoSimple & { avisos?: AvisoAlumno[] })
  | { requiereConfirmacion: true; afectadas: ClaseAfectada[] };

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

/**
 * Qué clases con membresía activa quedan afectadas por las excepciones que se
 * están por guardar. Es el impacto de C5, acotado a cursos regulares: sin
 * ventas de particulares/alquiler todavía, del otro lado no hay nada que
 * revisar (Javier, 2026-09-16).
 */
async function calcularImpacto(
  a: ReturnType<typeof admin>,
  salaId: number,
  excepciones: ExcepcionEdit[]
): Promise<ClaseAfectada[]> {
  const cierres = excepciones.filter((e) => e.cerrado);
  if (!cierres.length) return [];

  const { data: cursosRows } = await a
    .from("cursos")
    .select(`id, nombre, dias_semana, hora, duracion_min, sala_id, ${COLS_VIGENCIA}`)
    .eq("sala_id", salaId)
    .eq("activo", true);
  const cursos = (cursosRows as unknown as CursoOcupa[]) ?? [];
  if (!cursos.length) return [];
  const cursoIds = cursos.map((c) => c.id);

  const desde = cierres.reduce((m, e) => (e.fecha < m ? e.fecha : m), cierres[0].fecha);
  const hasta = cierres.reduce((m, e) => (e.hasta_fecha > m ? e.hasta_fecha : m), cierres[0].hasta_fecha);

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

  // Se calcula por el rango completo y se filtra a las fechas que de verdad
  // caen dentro de algún cierre — más simple que recortar por cada excepción
  // y da el mismo resultado porque las excepciones de una sala no se pisan.
  const todas = clasesAfectadasPorCierre(cursos, membresias, desde, hasta, yaSuspendidas);
  return todas.filter((c) => cierres.some((e) => e.fecha <= c.fecha && c.fecha <= e.hasta_fecha));
}

export async function guardarHorarioSala(
  salaId: number,
  patron: FranjaEdit[],
  excepciones: ExcepcionEdit[],
  excepcionesEliminadas: number[],
  confirmarCierres = false
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

  // Antes de tocar la base: si algún cierre nuevo pisa clases con membresía
  // activa, se avisa y se pide confirmación explícita — nunca se suspende
  // nada en silencio (regla de proceso: el humano decide, no C5 solo).
  const afectadas = await calcularImpacto(a, salaId, excepciones);
  if (afectadas.length && !confirmarCierres) return { requiereConfirmacion: true, afectadas };

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
  // unique por (sala, fecha) las mantiene en una sola fila por día.
  for (const id of excepcionesEliminadas) {
    const { error } = await a.from("sala_horario_excepciones").delete().eq("id", id);
    if (error) return { error: `No se pudo eliminar una excepción: ${error.message}` };
  }

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
    const { error } = e.id
      ? await a.from("sala_horario_excepciones").update(fila).eq("id", e.id)
      : await a.from("sala_horario_excepciones").insert(fila);
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
  }

  // El cierre ya está guardado: ahora sí se suspenden las clases que caían
  // adentro. Se usa el mismo núcleo que la asistencia del día a día
  // (`ejecutarSuspension`), con `permitirFutura` porque acá se sabe con
  // anticipación que la sala no va a estar disponible — un feriado de la
  // semana que viene no puede esperar a que llegue la fecha.
  let suspendidas = 0;
  const bloqueadas: string[] = [];
  // Por alumno: cada clase suya que quedó suspendida en este cierre, con el
  // motivo tal como lo va a leer (etiqueta del catálogo + la glosa entre
  // paréntesis) y a qué fecha le quedó el ciclo si se corrió. Un alumno con
  // dos clases dentro del mismo feriado recibe un solo aviso con las dos.
  const porAlumno = new Map<
    number,
    { curso: string; fecha: string; finCicloNuevo: string | null; motivoTexto: string }[]
  >();

  if (afectadas.length) {
    const perfil = await obtenerPerfilActual();

    // Etiqueta legible del motivo (regla de calidad 6: el valor guardado es
    // la clave del catálogo, "feriado"; lo que se lee es su etiqueta).
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

    for (const c of afectadas) {
      const exc = excepciones.find((e) => e.fecha <= c.fecha && c.fecha <= e.hasta_fecha);
      // Lo que va al campo `motivo` de la sesión (auditoría interna, texto
      // libre) sigue siendo explícito sobre que viene de un cierre de sala.
      const motivo = ["Cierre de sala", exc?.motivo, exc?.glosa].filter(Boolean).join(" — ");
      // Lo que lee el alumno: el motivo tal cual lo elige quien carga la
      // excepción, con la glosa como aclaración entre paréntesis — sin hablar
      // de "sala" ni de mecánica interna (Javier, 2026-09-16).
      const motivoTexto = exc?.motivo
        ? `${etiquetaDe.get(exc.motivo) ?? exc.motivo}${exc.glosa ? ` (${exc.glosa})` : ""}`
        : exc?.glosa ?? "un cierre";
      const errFecha = await validarFecha(c.cursoId, c.fecha, { permitirFutura: true });
      if (errFecha) {
        // Regla de negocio 16: una clase de la que depende una comisión ya
        // pagada no se toca, ni siquiera por un feriado. La sala queda
        // cerrada igual; esa clase puntual necesita una corrección manual.
        bloqueadas.push(`${c.cursoNombre} (${c.fecha}): ${errFecha}`);
        continue;
      }
      const r = await ejecutarSuspension(a, {
        cursoId: c.cursoId,
        fecha: c.fecha,
        motivo,
        registradoPor: perfil?.id ?? null,
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
  }

  // El aviso, listo para copiar y pegar por WhatsApp — pedido de Javier
  // (2026-09-16): mientras no haya envío automático, al menos poder pasarlo a
  // mano a cada alumno hoy mismo.
  const avisos: AvisoAlumno[] = [];
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
      avisos.push({ alumnoId, nombre, whatsapp, mensaje: partesMsg.join(" ") });
    }
    avisos.sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
  }

  revalidatePath("/administracion/sala");
  revalidatePath("/asistencia");

  const plu = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
  const partes = ["Horario guardado."];
  if (suspendidas > 0)
    partes.push(`Se suspendieron ${plu(suspendidas, "clase", "clases")} que tenían membresías activas.`);
  if (bloqueadas.length)
    partes.push(
      `${plu(bloqueadas.length, "clase queda", "clases quedan")} sin suspender porque ya tienen comisión ` +
        `pagada — corregilas a mano: ${bloqueadas.join("; ")}.`
    );

  return { ok: true, mensaje: partes.join(" "), avisos };
}

function fmtLarga(iso: string): string {
  return fechaLarga(new Date(iso.slice(0, 10) + "T00:00:00"));
}
