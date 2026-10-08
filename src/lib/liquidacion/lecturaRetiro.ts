/**
 * La lectura del retiro de un profesor (I-005, D34): trae lo que el motor y la
 * base saben y arma la `EntradaRetiro` que `armarRetiro` (puro) convierte en la
 * vista simulada. **No escribe nada.** La usan las dos acciones —la vista y la
 * confirmación— para que calculen exactamente lo mismo: el servidor nunca
 * confía en lo que mostró la pantalla.
 *
 * No es `"use server"`: no queda como endpoint.
 */

import { createClient } from "@/lib/supabase/server";
import { exigir } from "@/lib/datos";
import { isoHoy, primerDiaMesDe } from "@/lib/liquidacion/periodo";
import { calcularDevengos } from "@/lib/liquidacion/motor";
import { calcularDescuentos, leerDatosMotor, leerDatosParticulares } from "@/lib/liquidacion/lecturas";
import { cobroPorMembresia } from "@/lib/liquidacion/cobro";
import { calcularDevengosParticulares, horasDadas, situacionParticular } from "@/lib/liquidacion/particulares";
import type { EntradaRetiro, MembresiaInconclusa } from "@/lib/liquidacion/retiro";
import type { DatosSustituto } from "@/lib/desasignacion";

type Persona = { nombre: string | null; apellido: string | null } | null;
const nombreDe = (c: Persona) => [c?.apellido, c?.nombre].filter(Boolean).join(", ") || "—";

export type LecturaRetiro = { ok: true; entrada: EntradaRetiro } | { ok: false; error: string };

export async function leerEntradaRetiro(
  profesorId: number,
  corte: string,
  sustitutos: Record<number, DatosSustituto | null>
): Promise<LecturaRetiro> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corte)) return { ok: false, error: "La fecha de corte no es válida." };
  const sb = await createClient();
  const hoyISO = isoHoy();

  try {
    // El profesor y sus asignaciones.
    const prof = exigir(
      await sb
        .from("profesores")
        .select("id, activo, contacto:contactos(nombre, apellido)")
        .eq("id", profesorId)
        .maybeSingle(),
      "el profesor"
    ) as unknown as { id: number; activo: boolean; contacto: Persona } | null;
    if (!prof) return { ok: false, error: "No se encontró el profesor." };

    const asigs = exigir(
      await sb
        .from("asignaciones")
        .select("id, curso_id, desde, hasta, curso:cursos(nombre)")
        .eq("profesor_id", profesorId),
      "las asignaciones"
    ) as unknown as { id: number; curso_id: number; desde: string; hasta: string | null; curso: { nombre: string } | null }[];

    // Los sustitutos tienen que ser profesores activos y de tipo Activo.
    const idsSust = [
      ...new Set(Object.values(sustitutos).map((s) => s?.profesorId).filter((x): x is number => x != null)),
    ];
    if (idsSust.length) {
      const ok = exigir(
        await sb.from("profesores").select("id, activo, tipo").in("id", idsSust),
        "los sustitutos"
      ) as { id: number; activo: boolean; tipo: string }[];
      for (const id of idsSust) {
        const p = ok.find((x) => x.id === id);
        if (!p || !p.activo || p.tipo !== "activo")
          return { ok: false, error: "El sustituto tiene que ser un profesor Activo." };
      }
    }

    // El cálculo del cierre: regulares (todos sus cursos) y particulares.
    const datos = await leerDatosMotor(sb, "9999-12-31");
    const reg = datos
      ? calcularDevengos(datos, "9999-12-31", { profesorId, corte })
      : { pendientes: [], bloqueadas: [] };
    const datosPart = await leerDatosParticulares(sb);
    const par = datosPart
      ? calcularDevengosParticulares(datosPart, {
          hastaISO: corte,
          periodoVencido: primerDiaMesDe(corte),
          hoyISO,
          cierre: { profesorId, corte },
        })
      : { pendientes: [], bloqueadas: [] };
    const descuentos = (await calcularDescuentos(sb, corte)).filter((d) => d.profesorId === profesorId);

    // Lo que ya se le debe de liquidaciones anteriores.
    const liqs = exigir(
      await sb
        .from("liquidaciones")
        .select("total_devengado, total_descuentos, total_pagado")
        .eq("profesor_id", profesorId),
      "las liquidaciones del profesor"
    ) as { total_devengado: number; total_descuentos: number | null; total_pagado: number }[];
    const saldoPrevio = liqs.reduce(
      (s, l) => s + Number(l.total_devengado) - Number(l.total_descuentos ?? 0) - Number(l.total_pagado),
      0
    );

    // Clases que dictó después del corte, por curso.
    const post = exigir(
      await sb
        .from("sesiones")
        .select("curso_id, fecha")
        .eq("profesor_id", profesorId)
        .eq("estado", "dictada")
        .gt("fecha", corte)
        .order("fecha"),
      "las clases posteriores al corte"
    ) as { curso_id: number; fecha: string }[];
    const nombreCurso = new Map(asigs.map((a) => [a.curso_id, a.curso?.nombre ?? `#${a.curso_id}`]));
    const porCurso = new Map<number, string[]>();
    for (const s of post) porCurso.set(s.curso_id, [...(porCurso.get(s.curso_id) ?? []), s.fecha]);

    // Reservas particulares futuras del profesor.
    const res = exigir(
      await sb
        .from("reservas_sala")
        .select("id, fecha, membresia:membresias(alumno:alumnos(contacto:contactos(nombre, apellido)))")
        .eq("tipo", "particular")
        .eq("profesor_id", profesorId)
        .gt("fecha", corte)
        .in("estado", ["solicitada", "confirmada", "reprogramada"]),
      "las reservas particulares futuras"
    ) as unknown as { id: number; fecha: string; membresia: { alumno: { contacto: Persona } | null } | null }[];

    // Las membresías que quedan sin terminar: las de sus cursos (una línea por
    // membresía, con todos sus cursos) y sus particulares.
    const saldoDe = datos ? cobroPorMembresia(datos.cuotas, datos.pagos).saldo : {};
    const cursoIds = [...new Set(asigs.filter((a) => a.hasta == null).map((a) => a.curso_id))];
    const mcs = cursoIds.length
      ? (exigir(
          await sb
            .from("membresia_cursos")
            .select(
              "curso_id, membresia:membresias(id, estado, clases_plan, clases_hechas, fecha_inicio, fecha_fin, plan:planes(nombre), alumno:alumnos(contacto:contactos(nombre, apellido)))"
            )
            .in("curso_id", cursoIds),
          "las membresías de sus cursos"
        ) as unknown as {
          curso_id: number;
          membresia: {
            id: number; estado: string; clases_plan: number | null; clases_hechas: number;
            fecha_inicio: string | null; fecha_fin: string | null; plan: { nombre: string } | null;
            alumno: { contacto: Persona } | null;
          } | null;
        }[])
      : [];
    const regulares = new Map<number, MembresiaInconclusa>();
    for (const r of mcs) {
      const m = r.membresia;
      if (!m || m.estado !== "activa") continue;
      if (m.clases_plan != null && m.clases_hechas >= m.clases_plan) continue; // agotada: no queda inconclusa
      const curso = nombreCurso.get(r.curso_id) ?? `#${r.curso_id}`;
      const ya = regulares.get(m.id);
      if (ya) {
        if (!ya.detalle.split(", ").includes(curso)) ya.detalle += `, ${curso}`;
        continue;
      }
      regulares.set(m.id, {
        membresiaId: m.id,
        alumno: nombreDe(m.alumno?.contacto ?? null),
        tipo: "regular",
        detalle: curso,
        plan: m.plan?.nombre ?? "—",
        inicio: m.fecha_inicio,
        fin: m.fecha_fin,
        hechas: m.clases_hechas,
        total: m.clases_plan,
        unidad: "clases",
        estado: m.estado,
        saldo: Math.round((saldoDe[m.id] ?? 0) * 100) / 100,
      });
    }
    const particularesInconclusas: MembresiaInconclusa[] = (datosPart?.membresias ?? [])
      .filter((m) => m.profesor_id === profesorId && !m.es_cortesia)
      .flatMap((m) => {
        const reservasM = datosPart!.reservas.filter((r) => r.membresia_id === m.id);
        const saldo = datosPart!.saldo[m.id] ?? 0;
        if (situacionParticular(m, reservasM, saldo, hoyISO).completa) return [];
        return [{
          membresiaId: m.id,
          alumno: m.alumno,
          tipo: "particular" as const,
          detalle: "Clase particular",
          plan: "Clase particular",
          inicio: m.fecha_inicio ?? null,
          fin: m.fecha_fin,
          hechas: horasDadas(reservasM),
          total: m.horas_contratadas,
          unidad: "horas" as const,
          estado: "activa",
          saldo: Math.round(saldo * 100) / 100,
        }];
      });
    const inconclusas = [...regulares.values(), ...particularesInconclusas];

    return {
      ok: true,
      entrada: {
        profesorId,
        profesor: nombreDe(prof.contacto),
        activo: prof.activo,
        corte,
        hoyISO,
        asignaciones: asigs.map((a) => ({
          id: a.id, cursoId: a.curso_id, curso: a.curso?.nombre ?? `#${a.curso_id}`, desde: a.desde, hasta: a.hasta,
        })),
        sustitutos,
        regular: {
          pendientes: reg.pendientes,
          bloqueadas: reg.bloqueadas.filter((b) => b.profesorIds.includes(profesorId)),
        },
        particulares: par,
        descuentos,
        saldoPrevio: Math.round(saldoPrevio * 100) / 100,
        posteriores: [...porCurso.entries()].map(([cursoId, fechas]) => ({
          cursoId, curso: nombreCurso.get(cursoId) ?? `#${cursoId}`, fechas,
        })),
        reservasFuturas: res.map((r) => ({
          id: r.id, fecha: r.fecha, alumno: nombreDe(r.membresia?.alumno?.contacto ?? null),
        })),
        inconclusas,
      },
    };
  } catch (e) {
    // Un fallo no se disfraza de «no hay nada» (calidad 1).
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
