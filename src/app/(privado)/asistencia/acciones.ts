"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso, obtenerParametro, obtenerPerfilActual } from "@/lib/sesion";
import { compararPorApellido } from "@/lib/texto";
import type { EntradaAsistencia, FilaAsistencia } from "@/lib/tipos";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

type Estado = "presente" | "ausente";

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function restarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Padrón completo de una clase (curso + fecha) para tomar asistencia:
 * inscriptos activos con sus faltas del mes de esa fecha, clases restantes
 * (parciales) y deuda; más las marcas ya guardadas de esa sesión (re-editable).
 */
export async function cargarPadron(
  cursoId: number,
  fecha: string
): Promise<{ filas: FilaAsistencia[]; marcas: Record<number, Estado> }> {
  if (!(await tienePermiso("asistencia", "ver"))) return { filas: [], marcas: {} };
  if (!ISO.test(fecha)) return { filas: [], marcas: {} };

  const sb = await createClient();

  // 1. Inscriptos activos del curso.
  const { data: insc } = await sb
    .from("inscripciones")
    .select("id, alumno_id, modalidad, clases_total, alumno:alumnos(id, nombre, apellido, activo)")
    .eq("curso_id", cursoId)
    .eq("estado", "activa");

  type InscRow = {
    id: number;
    alumno_id: number;
    modalidad: FilaAsistencia["modalidad"];
    clases_total: number | null;
    alumno: { id: number; nombre: string; apellido: string; activo: boolean } | null;
  };
  const inscripciones = ((insc as unknown as InscRow[]) ?? []).filter((r) => r.alumno?.activo);
  const inscIds = inscripciones.map((r) => r.id);
  const alumnoIds = [...new Set(inscripciones.map((r) => r.alumno_id))];

  // 2. Clases consumidas (presentes de todas las sesiones) por inscripción parcial.
  const consumidas: Record<number, number> = {};
  if (inscIds.length) {
    const { data } = await sb
      .from("asistencias")
      .select("inscripcion_id")
      .eq("estado", "presente")
      .in("inscripcion_id", inscIds);
    for (const a of (data as { inscripcion_id: number | null }[]) ?? [])
      if (a.inscripcion_id != null) consumidas[a.inscripcion_id] = (consumidas[a.inscripcion_id] ?? 0) + 1;
  }

  // 3. Faltas del alumno en ESTE curso, en el mes de la fecha elegida.
  const [y, m] = fecha.split("-").map(Number);
  const desde = `${y}-${String(m).padStart(2, "0")}-01`;
  const hastaDate = new Date(y, m, 0); // último día del mes
  const hasta = `${y}-${String(m).padStart(2, "0")}-${String(hastaDate.getDate()).padStart(2, "0")}`;
  const faltasMes: Record<number, number> = {};
  const { data: sesMes } = await sb
    .from("sesiones")
    .select("id")
    .eq("curso_id", cursoId)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const sesMesIds = ((sesMes as { id: number }[]) ?? []).map((s) => s.id);
  if (sesMesIds.length && alumnoIds.length) {
    const { data } = await sb
      .from("asistencias")
      .select("alumno_id")
      .eq("estado", "ausente")
      .in("sesion_id", sesMesIds)
      .in("alumno_id", alumnoIds);
    for (const a of (data as { alumno_id: number }[]) ?? [])
      faltasMes[a.alumno_id] = (faltasMes[a.alumno_id] ?? 0) + 1;
  }

  // 4. Deuda del alumno (saldo de cuotas no pagadas menos lo cobrado).
  const deuda: Record<number, number> = {};
  if (alumnoIds.length) {
    const { data: inscAll } = await sb
      .from("inscripciones")
      .select("id, alumno_id")
      .in("alumno_id", alumnoIds);
    const inscToAlumno = new Map<number, number>(
      ((inscAll as { id: number; alumno_id: number }[]) ?? []).map((r) => [r.id, r.alumno_id])
    );
    const allInscIds = [...inscToAlumno.keys()];
    if (allInscIds.length) {
      const { data: cuotas } = await sb
        .from("cuotas")
        .select("id, inscripcion_id, monto_devengado, descuento_adelanto, estado")
        .in("inscripcion_id", allInscIds)
        .neq("estado", "pagada");
      const cuotaRows =
        (cuotas as {
          id: number;
          inscripcion_id: number;
          monto_devengado: number;
          descuento_adelanto: number;
        }[]) ?? [];
      const pagado: Record<number, number> = {};
      if (cuotaRows.length) {
        const { data: pagos } = await sb
          .from("pagos")
          .select("cuota_id, monto, descuento")
          .eq("tipo", "cobro")
          .in(
            "cuota_id",
            cuotaRows.map((c) => c.id)
          );
        for (const p of (pagos as { cuota_id: number | null; monto: number; descuento: number }[]) ?? [])
          if (p.cuota_id != null)
            pagado[p.cuota_id] = (pagado[p.cuota_id] ?? 0) + Number(p.monto) + Number(p.descuento);
      }
      for (const c of cuotaRows) {
        const efectivo = Math.max(0, Number(c.monto_devengado) - Number(c.descuento_adelanto));
        const saldo = Math.max(0, efectivo - (pagado[c.id] ?? 0));
        const al = inscToAlumno.get(c.inscripcion_id);
        if (al != null && saldo > 0) deuda[al] = (deuda[al] ?? 0) + saldo;
      }
    }
  }

  // 5. Marcas ya guardadas de la sesión (curso + fecha).
  const marcas: Record<number, Estado> = {};
  const extras: FilaAsistencia[] = [];
  const { data: sesion } = await sb
    .from("sesiones")
    .select("id")
    .eq("curso_id", cursoId)
    .eq("fecha", fecha)
    .maybeSingle();
  if (sesion) {
    const { data } = await sb
      .from("asistencias")
      .select("estado, inscripcion_id, alumno:alumnos(id, nombre, apellido)")
      .eq("sesion_id", sesion.id);
    const idsBase = new Set(alumnoIds);
    for (const r of (data as unknown as {
      estado: Estado;
      inscripcion_id: number | null;
      alumno: { id: number; nombre: string; apellido: string } | null;
    }[]) ?? []) {
      if (!r.alumno) continue;
      marcas[r.alumno.id] = r.estado;
      // Marcados que ya no están en el padrón (parcial consumido) → extra visible.
      if (!idsBase.has(r.alumno.id)) {
        extras.push({
          inscripcionId: r.inscripcion_id,
          alumnoId: r.alumno.id,
          apellido: r.alumno.apellido,
          nombre: r.alumno.nombre,
          modalidad: "mensual",
          restantes: null,
          faltasMes: faltasMes[r.alumno.id] ?? 0,
          deuda: deuda[r.alumno.id] ?? 0,
        });
      }
    }
  }

  // 6. Filas del padrón (parcial ya consumido no aparece, salvo que esté marcado).
  const filas: FilaAsistencia[] = inscripciones
    .map((r) => {
      const esMensual = r.modalidad === "mensual";
      const restantes = esMensual ? null : Math.max(0, (r.clases_total ?? 0) - (consumidas[r.id] ?? 0));
      return {
        inscripcionId: r.id,
        alumnoId: r.alumno!.id,
        apellido: r.alumno!.apellido,
        nombre: r.alumno!.nombre,
        modalidad: r.modalidad,
        restantes,
        faltasMes: faltasMes[r.alumno_id] ?? 0,
        deuda: deuda[r.alumno_id] ?? 0,
      };
    })
    .filter((f) => f.modalidad === "mensual" || f.restantes === null || f.restantes > 0 || marcas[f.alumnoId]);

  const todas = [...filas, ...extras].sort(compararPorApellido);
  return { filas: todas, marcas };
}

export async function guardarAsistencia(
  e: EntradaAsistencia
): Promise<{ ok?: true; resumen?: string; error?: string }> {
  if (!(await tienePermiso("asistencia", "crear")))
    return { error: "No tenés permiso para registrar asistencia." };
  if (!ISO.test(e.fecha)) return { error: "Fecha inválida." };
  if (!e.marcas.length) return { error: "No hay nada marcado." };

  // Regla: nunca a futuro; el pasado solo con permiso de edición y dentro de la
  // ventana (parámetro `asistencia_semanas_retro`, en semanas).
  const hoy = hoyISO();
  if (e.fecha > hoy) return { error: "No se puede registrar asistencia de una fecha futura." };
  if (e.fecha < hoy) {
    if (!(await tienePermiso("asistencia", "editar")))
      return { error: "No tenés permiso para cargar asistencia de fechas pasadas." };
    const semanas = Math.max(0, Number(await obtenerParametro("asistencia_semanas_retro")) || 2);
    if (e.fecha < restarDias(hoy, semanas * 7))
      return { error: `Solo se puede cargar hasta ${semanas} semanas hacia atrás.` };
  }

  const perfil = await obtenerPerfilActual();
  const a = admin();

  const { data: curso } = await a.from("cursos").select("id").eq("id", e.cursoId).maybeSingle();
  if (!curso) return { error: "El curso no existe." };

  const { data: asig } = await a
    .from("asignaciones")
    .select("profesor_id")
    .eq("curso_id", e.cursoId)
    .is("hasta", null)
    .maybeSingle();

  const { data: sesion, error: errSesion } = await a
    .from("sesiones")
    .upsert(
      {
        curso_id: e.cursoId,
        fecha: e.fecha,
        profesor_id: asig?.profesor_id ?? null,
        registrado_por: perfil?.id ?? null,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "curso_id,fecha" }
    )
    .select("id")
    .single();
  if (errSesion) return { error: errSesion.message };

  const filas = e.marcas.map((m) => ({
    sesion_id: sesion.id as number,
    alumno_id: m.alumnoId,
    inscripcion_id: m.inscripcionId,
    estado: m.estado,
  }));
  const { error: errAsis } = await a
    .from("asistencias")
    .upsert(filas, { onConflict: "sesion_id,alumno_id" });
  if (errAsis) return { error: errAsis.message };

  const presentes = e.marcas.filter((m) => m.estado === "presente").length;
  const ausentes = e.marcas.filter((m) => m.estado === "ausente").length;
  const plu = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

  revalidatePath("/asistencia");
  return {
    ok: true,
    resumen: `Asistencia guardada · ${plu(presentes, "presente", "presentes")} y ${plu(
      ausentes,
      "ausente",
      "ausentes"
    )}.`,
  };
}
