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
  fecha: string;
  cerrado: boolean;
  desde: string | null;
  hasta: string | null;
  motivo: string | null;
  glosa: string | null;
};

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
      if (error.code === "23505")
        return { error: `Ya hay una excepción cargada para el ${e.fecha}: editá esa, no agregues otra.` };
      return { error: `No se pudo guardar la excepción del ${e.fecha}: ${error.message}` };
    }
  }

  revalidatePath("/administracion/sala");
  return { ok: true };
}
