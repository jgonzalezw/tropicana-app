// TEMPORAL (carril L-01): foto de los cuatro flujos de liquidación para comparar
// antes/después de unificarlos. Solo desarrollo, con la sesión del navegador.
// Se borra al cerrar el carril.
import { NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { cargarLiquidaciones, cierreDeCuentas } from "@/app/(privado)/liquidaciones/acciones";
import { prepararPreliquidacion } from "@/lib/liquidacion/lecturaPre";
import { leerEntradaRetiro } from "@/lib/liquidacion/lecturaRetiro";
import { armarRetiro } from "@/lib/liquidacion/retiro";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ error: "solo desarrollo" }, { status: 404 });
  const url = new URL(req.url);
  const cortes = (url.searchParams.get("cortes") ?? "2026-10-06,2026-10-31").split(",");
  const a = createAdminClient();
  if (!a) return NextResponse.json({ error: "sin cliente admin" }, { status: 500 });

  const salida: Record<string, unknown> = {};
  salida.liquidaciones = await cargarLiquidaciones();
  salida.preVencido = await prepararPreliquidacion("vencido");
  salida.preSimulacion = await prepararPreliquidacion("simulacion");

  const profs = ((await a.from("profesores").select("id").order("id")).data ?? []) as { id: number }[];
  const retiros: Record<string, unknown> = {};
  for (const p of profs)
    for (const c of cortes) {
      const l = await leerEntradaRetiro(p.id, c, {});
      retiros[`${p.id}@${c}`] = l.ok ? armarRetiro(l.entrada) : l;
    }
  salida.retiros = retiros;

  const asigs = ((await a.from("asignaciones").select("profesor_id, curso_id").is("hasta", null).order("id")).data ?? []) as {
    profesor_id: number;
    curso_id: number;
  }[];
  const cierres: Record<string, unknown> = {};
  for (const s of asigs)
    for (const c of cortes) cierres[`${s.profesor_id}/${s.curso_id}@${c}`] = await cierreDeCuentas(s.profesor_id, c, false, s.curso_id);
  salida.cierres = cierres;

  const guardar = url.searchParams.get("guardar");
  if (guardar && /^[\w-]+$/.test(guardar)) {
    const dir = join(process.cwd(), ".next", "comparar");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${guardar}.json`), JSON.stringify(salida, null, 1));
    return NextResponse.json({ guardado: `.next/comparar/${guardar}.json` });
  }
  return NextResponse.json(salida);
}
