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
import { criteriosYCiclos, leerCuentasYBonos, previasDe } from "@/lib/liquidacion/lecturaContexto";
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
        .select("id, total_devengado, total_descuentos, total_pagado")
        .eq("profesor_id", profesorId),
      "las liquidaciones del profesor"
    ) as { id: number; total_devengado: number; total_descuentos: number | null; total_pagado: number }[];
    const saldoDe = (l: (typeof liqs)[number]) =>
      Number(l.total_devengado) - Number(l.total_descuentos ?? 0) - Number(l.total_pagado);
    const saldoPrevio = liqs.reduce((s, l) => s + saldoDe(l), 0);
    // De dónde sale: las liquidaciones con saldo sin pagar (se listan en la vista).
    const sinPagar = new Set(liqs.filter((l) => saldoDe(l) > 0.005).map((l) => l.id));
    const saldoDesglose = {
      liquidado: r2(liqs.reduce((s, l) => s + Number(l.total_devengado), 0)),
      descuentos: r2(liqs.reduce((s, l) => s + Number(l.total_descuentos ?? 0), 0)),
      pagado: r2(liqs.reduce((s, l) => s + Number(l.total_pagado), 0)),
      liquidaciones: [...sinPagar].sort((a, b) => a - b),
    };

    // Las membresías que ya están **enteras** en una liquidación sin pagar: el
    // cierre no las vuelve a emitir, pero componen el saldo previo y se muestran.
    const yaLiquidadas: EntradaRetiro["yaLiquidadas"] = [];
    {
      const alumnoDe = new Map((datos?.alumnos ?? []).map((a) => [a.id, `${a.apellido}, ${a.nombre}`]));
      const cursoDe = new Map((datos?.cursos ?? []).map((c) => [c.id, c.nombre]));
      const membDe = new Map((datos?.membresias ?? []).map((m) => [m.id, m]));
      const grupos = new Map<string, { membresiaId: number; cursoId: number; base: number; monto: number }>();
      for (const c of datos?.comisionesPrevias ?? []) {
        if (c.profesor_id !== profesorId || c.membresia_id == null || c.curso_id == null) continue;
        if (c.liquidacion_id == null || !sinPagar.has(c.liquidacion_id)) continue;
        const k = `${c.membresia_id}|${c.curso_id}`;
        const g = grupos.get(k) ?? { membresiaId: c.membresia_id, cursoId: c.curso_id, base: 0, monto: 0 };
        g.base += Number(c.base);
        g.monto += Number(c.monto);
        grupos.set(k, g);
      }
      for (const g of grupos.values()) {
        const m = membDe.get(g.membresiaId);
        if (!m || Math.abs(g.monto) < 0.005) continue;
        yaLiquidadas.push({
          membresiaId: g.membresiaId, cursoId: g.cursoId, tipo: "regular",
          alumno: alumnoDe.get(m.alumno_id) ?? `#${m.alumno_id}`,
          curso: cursoDe.get(g.cursoId) ?? `#${g.cursoId}`,
          base: r2(g.base), monto: r2(g.monto),
        });
      }
      const porMemb = new Map<number, number>();
      for (const c of datosPart?.previas ?? []) {
        if (c.membresia_id == null || c.liquidacion_id == null || !sinPagar.has(c.liquidacion_id)) continue;
        porMemb.set(c.membresia_id, (porMemb.get(c.membresia_id) ?? 0) + Number(c.monto));
      }
      for (const [id, monto] of porMemb) {
        const m = (datosPart?.membresias ?? []).find((x) => x.id === id);
        if (!m || m.profesor_id !== profesorId || Math.abs(monto) < 0.005) continue;
        yaLiquidadas.push({
          membresiaId: id, cursoId: null, tipo: "particular", alumno: m.alumno, curso: "Clase particular",
          base: 0, monto: r2(monto),
          horasDadas: horasDadas((datosPart?.reservas ?? []).filter((r) => r.membresia_id === id), corte),
          horasContratadas: m.horas_contratadas, forma: m.forma_pago_profesor ?? "",
        });
      }
    }

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
        ...yaLiquidadas.map((y) => y.membresiaId),
      ]),
    ];
    const { cuentas, bonos } = await leerCuentasYBonos(sb, ids);

    // Lo ya devengado de las membresías de las líneas (de este profesor), y en qué liquidación.
    const previas = previasDe(datos, datosPart).filter((c) => c.profesorId == null || c.profesorId === profesorId);
    const { criterios, ciclos } = criteriosYCiclos(datos, datosPart);

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
        yaLiquidadas,
        saldoDesglose,
        previas,
      },
    };
  } catch (e) {
    // Un fallo no se disfraza de «no hay nada» (calidad 1).
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
