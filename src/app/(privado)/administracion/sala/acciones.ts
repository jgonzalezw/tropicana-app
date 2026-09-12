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
import { tienePermiso } from "@/lib/sesion";
import { aMinutos } from "@/lib/horarios";

type Resultado = { ok?: true; error?: string };

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
export async function guardarSalas(salas: SalaEdit[]): Promise<Resultado> {
  if (!(await tienePermiso("administracion", "editar")))
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
function validarPatron(patron: FranjaEdit[]): string | null {
  for (const f of patron) {
    const d = aMinutos(f.desde);
    const h = aMinutos(f.hasta);
    if (d == null || h == null)
      return `Hay una franja del ${DIAS[f.dia_semana]} sin hora de inicio o de fin.`;
    if (h <= d)
      return `El ${DIAS[f.dia_semana]} tiene una franja que termina antes de empezar (${f.desde}–${f.hasta}).`;
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

export async function guardarHorarioSala(
  salaId: number,
  patron: FranjaEdit[],
  excepciones: ExcepcionEdit[],
  excepcionesEliminadas: number[]
): Promise<Resultado> {
  if (!(await tienePermiso("administracion", "editar")))
    return { error: "Sin permiso para editar el horario de la sala." };

  const err = validarPatron(patron);
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
    }
  }

  const a = admin();

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

  revalidatePath("/administracion/sala");
  return { ok: true };
}
