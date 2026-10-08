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
import { isoHoy } from "@/lib/liquidacion/periodo";
import { liquidar, SIN_LIMITE } from "@/lib/liquidacion/liquidar";
import { calcularDescuentos, leerDatosMotor, leerDatosParticulares } from "@/lib/liquidacion/lecturas";
import { cobroPorMembresia } from "@/lib/liquidacion/cobro";
import { horasDadas, situacionParticular } from "@/lib/liquidacion/particulares";
import type { EntradaRetiro, MembresiaInconclusa } from "@/lib/liquidacion/retiro";
import { leerAvancesAlCorte, type Avance } from "@/lib/liquidacion/lecturaAvance";
import type { DatosSustituto } from "@/lib/desasignacion";

type Persona = { nombre: string | null; apellido: string | null } | null;
const r2 = (n: number) => Math.round(n * 100) / 100;
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
    const datos = await leerDatosMotor(sb, SIN_LIMITE);
    const datosPart = await leerDatosParticulares(sb);
    const { regular: reg, particulares: par } = liquidar(
      { regular: datos, particulares: datosPart },
      { tipo: "retiro", profesorId, corte, hoyISO }
    );
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
    const cursoIds = [...new Set(asigs.filter((a) => a.hasta == null).map((a) => a.curso_id))];
    const mcs = cursoIds.length
      ? (exigir(
          await sb
            .from("membresia_cursos")
            .select(
              "curso_id, membresia:membresias(id, estado, clases_plan, clases_total, criterio_liquidacion, fecha_inicio, fecha_fin, plan:planes(nombre), alumno:alumnos(contacto:contactos(nombre, apellido)))"
            )
            .in("curso_id", cursoIds),
          "las membresías de sus cursos"
        ) as unknown as {
          curso_id: number;
          membresia: {
            id: number; estado: string; clases_plan: number | null; clases_total: number | null;
            criterio_liquidacion: number | null;
            fecha_inicio: string | null; fecha_fin: string | null; plan: { nombre: string } | null;
            alumno: { contacto: Persona } | null;
          } | null;
        }[])
      : [];
    const candidatas = new Map<number, NonNullable<(typeof mcs)[number]["membresia"]>>();
    for (const r of mcs) if (r.membresia?.estado === "activa") candidatas.set(r.membresia.id, r.membresia);

    // Avance de cada una **al corte** (regla de Asistencia, una sola lectura).
    const avances = await leerAvancesAlCorte(sb, [...candidatas.values()], corte);

    const regulares = new Map<number, MembresiaInconclusa>();
    for (const r of mcs) {
      const m = r.membresia;
      if (!m || m.estado !== "activa") continue;
      const curso = nombreCurso.get(r.curso_id) ?? `#${r.curso_id}`;
      const ya = regulares.get(m.id);
      if (ya) {
        if (!ya.detalle.split(", ").includes(curso)) ya.detalle += `, ${curso}`;
        continue;
      }
      const av = avances.get(m.id) as Avance;
      if (av.total != null && av.hechas >= av.total) continue; // agotada: no queda inconclusa
      regulares.set(m.id, {
        membresiaId: m.id,
        alumno: nombreDe(m.alumno?.contacto ?? null),
        tipo: "regular",
        detalle: curso,
        plan: m.plan?.nombre ?? "—",
        inicio: m.fecha_inicio,
        fin: m.fecha_fin,
        hechas: av.hechas,
        total: av.total,
        unidad: "clases",
        estado: m.estado,
        criterio: m.criterio_liquidacion,
      });
    }
    // Las horas dadas se miden **al corte**, como el cierre de las particulares.
    const particularesInconclusas: MembresiaInconclusa[] = (datosPart?.membresias ?? [])
      .filter((m) => m.profesor_id === profesorId && !m.es_cortesia)
      .flatMap((m) => {
        const reservasM = datosPart!.reservas.filter((r) => r.membresia_id === m.id && r.fecha <= corte);
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
          criterio: m.criterio_liquidacion,
        }];
      });
    const inconclusas = [...regulares.values(), ...particularesInconclusas];

    // La cuenta (precio, descuento, pagado, saldo) y los bonos de todas las
    // membresías que la vista nombra: las líneas del cierre y las inconclusas.
    const ids = [
      ...new Set([
        ...reg.pendientes.map((p) => p.membresiaId),
        ...par.pendientes.map((p) => p.membresiaId),
        ...inconclusas.map((m) => m.membresiaId),
      ]),
    ];
    const cuentas: EntradaRetiro["cuentas"] = {};
    const bonos: EntradaRetiro["bonos"] = {};
    if (ids.length) {
      const cuotas = exigir(
        await sb.from("cuotas").select("id, membresia_id, monto_devengado, descuento_adelanto").in("membresia_id", ids),
        "las cuotas de las membresías"
      ) as { id: number; membresia_id: number; monto_devengado: number; descuento_adelanto: number }[];
      const pagos = cuotas.length
        ? (exigir(
            await sb.from("pagos").select("cuota_id, monto, descuento").eq("tipo", "cobro").in("cuota_id", cuotas.map((c) => c.id)),
            "los pagos de las membresías"
          ) as { cuota_id: number | null; monto: number; descuento: number }[])
        : [];
      const cobro = cobroPorMembresia(cuotas, pagos);
      for (const id of ids)
        cuentas[id] = {
          precio: r2(cobro.precio[id] ?? 0),
          descuento: r2(cobro.descuento[id] ?? 0),
          pagado: r2(cobro.cobrado[id] ?? 0),
          saldo: r2(cobro.saldo[id] ?? 0),
        };

      // Bono por curso (D35): el que recibió (`redimido_en_membresia_id`) y el que
      // deja pendiente para su renovación (`aplicado` nulo).
      const filas = exigir(
        await sb
          .from("membresia_bonos")
          .select("membresia_id, clases, vence, aplicado, redimido_en_membresia_id")
          .or(`membresia_id.in.(${ids.join(",")}),redimido_en_membresia_id.in.(${ids.join(",")})`),
        "los bonos de tolerancia"
      ) as { membresia_id: number; clases: number; vence: string | null; aplicado: string | null; redimido_en_membresia_id: number | null }[];
      // Las ventas anteriores a la 0064 recibieron el bono sumándolo a `clases_plan`
      // sin dejar `redimido_en_membresia_id`: lo que excede al plan es ese bono.
      const planes = exigir(
        await sb.from("membresias").select("id, clases_plan, plan:planes(cantidad_clases, clases_ilimitadas)").in("id", ids),
        "los planes de las membresías"
      ) as unknown as { id: number; clases_plan: number | null; plan: { cantidad_clases: number | null; clases_ilimitadas: boolean | null } | null }[];
      const excedente = (id: number): number => {
        const m = planes.find((x) => x.id === id);
        if (!m?.plan || m.plan.clases_ilimitadas || m.plan.cantidad_clases == null || m.clases_plan == null) return 0;
        return Math.max(0, m.clases_plan - m.plan.cantidad_clases);
      };
      for (const id of ids) {
        const generados = filas.filter((f) => f.membresia_id === id && f.aplicado == null);
        bonos[id] = {
          aplicado:
            filas
              .filter((f) => f.redimido_en_membresia_id === id && f.aplicado != null)
              .reduce((t, f) => t + f.clases, 0) || excedente(id),
          generado: generados.reduce((t, f) => t + f.clases, 0),
          vence: generados.map((f) => f.vence).filter((v): v is string => v != null).sort()[0] ?? null,
        };
      }
    }

    // Lo ya devengado de las membresías de las líneas, y en qué liquidación.
    const previas: EntradaRetiro["previas"] = [
      ...(datos?.comisionesPrevias ?? [])
        .filter((c) => c.profesor_id === profesorId && c.membresia_id != null)
        .map((c) => ({ membresiaId: c.membresia_id as number, cursoId: c.curso_id, monto: Number(c.monto), liquidacionId: c.liquidacion_id ?? null })),
      ...(datosPart?.previas ?? [])
        .filter((c) => c.membresia_id != null)
        .map((c) => ({ membresiaId: c.membresia_id as number, cursoId: null, monto: Number(c.monto), liquidacionId: c.liquidacion_id ?? null })),
    ];
    const criterios: EntradaRetiro["criterios"] = {};
    for (const m of datos?.membresias ?? []) criterios[m.id] = m.criterio_liquidacion ?? null;
    for (const m of datosPart?.membresias ?? []) criterios[m.id] = m.criterio_liquidacion;
    const ciclos: EntradaRetiro["ciclos"] = {};
    for (const m of datos?.membresias ?? []) ciclos[m.id] = { inicio: m.fecha_inicio, fin: m.fecha_fin };
    for (const m of datosPart?.membresias ?? []) ciclos[m.id] = { inicio: m.fecha_inicio ?? null, fin: m.fecha_fin };

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
        cuentas,
        bonos,
        criterios,
        ciclos,
        previas,
      },
    };
  } catch (e) {
    // Un fallo no se disfraza de «no hay nada» (calidad 1).
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
