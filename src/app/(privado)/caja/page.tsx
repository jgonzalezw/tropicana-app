import { createClient } from "@/lib/supabase/server";
import { obtenerParametro, tienePermiso } from "@/lib/sesion";
import { lineasPorCobrar } from "@/lib/cuentas";
import SinAcceso from "@/components/SinAcceso";
import ClienteCaja from "./ClienteCaja";

export const dynamic = "force-dynamic";

/** Claves del catálogo, en el orden en que se muestran. */
async function motivosDe(
  sb: Awaited<ReturnType<typeof createClient>>,
  clave: string
): Promise<string[]> {
  const { data: cat } = await sb.from("catalogos").select("id").eq("clave", clave).maybeSingle();
  if (!cat) return ["otro"];
  const { data } = await sb
    .from("catalogo_valores")
    .select("valor")
    .eq("catalogo_id", cat.id)
    .eq("activo", true)
    .order("orden");
  const valores = ((data as { valor: string }[]) ?? []).map((v) => v.valor);
  // "Otro" siempre al final: es el que no salda ninguna deuda.
  return [...valores.filter((v) => v !== "otro"), ...(valores.includes("otro") ? ["otro"] : [])];
}

export default async function PaginaCaja() {
  if (!(await tienePermiso("caja", "ver"))) return <SinAcceso />;

  const sb = await createClient();
  const [lineas, motivosIngreso, motivosEgreso, mediosParam, diasCompromisoParam, puedeRegistrar] =
    await Promise.all([
      lineasPorCobrar(sb),
      motivosDe(sb, "motivo_cobro"),
      motivosDe(sb, "motivo_pago"),
      obtenerParametro("medios_pago"),
      obtenerParametro("dias_compromiso_pago"),
      tienePermiso("caja", "crear"),
    ]);

  // Con quién y por qué: para que "Últimos movimientos" se pueda validar,
  // no solo la plata. Un pago siempre trae su sujeto (alumno o profesor) y,
  // si viene de una membresía, el plan/curso que le dio origen.
  const { data: movRows } = await sb
    .from("pagos")
    .select(
      "id, tipo, motivo, monto, descuento, medio, glosa, fecha, fecha_efectiva, " +
        "alumno:alumnos(nombre, apellido), " +
        "profesor:profesores(nombre, apellido), " +
        "inscripcion:inscripciones(plan:planes(nombre), curso:cursos(nombre))"
    )
    .order("fecha", { ascending: false })
    .limit(12);

  const { data: saldoRows } = await sb.from("pagos").select("tipo, monto, medio");
  const saldo = { efectivo: 0, banco: 0 };
  for (const p of (saldoRows as { tipo: string; monto: number; medio: string | null }[]) ?? []) {
    const signo = p.tipo === "cobro" ? 1 : -1;
    const esEfectivo = (p.medio ?? "").toLowerCase().includes("efectivo");
    if (esEfectivo) saldo.efectivo += signo * Number(p.monto ?? 0);
    else saldo.banco += signo * Number(p.monto ?? 0);
  }

  return (
    <ClienteCaja
      lineas={lineas}
      motivosIngreso={motivosIngreso}
      motivosEgreso={motivosEgreso}
      medios={(mediosParam ?? "Efectivo,QR / transf.,Otro").split(",").map((m) => m.trim())}
      diasCompromiso={Math.max(1, Number(diasCompromisoParam) || 30)}
      puedeRegistrar={puedeRegistrar}
      saldo={saldo}
      movimientos={
        ((movRows as unknown as {
          id: number;
          tipo: string;
          motivo: string | null;
          monto: number;
          descuento: number;
          medio: string | null;
          glosa: string | null;
          fecha: string;
          fecha_efectiva: string | null;
          alumno: { nombre: string; apellido: string } | null;
          profesor: { nombre: string; apellido: string } | null;
          inscripcion: { plan: { nombre: string } | null; curso: { nombre: string } | null } | null;
        }[]) ?? []).map((m) => ({
          id: m.id,
          tipo: m.tipo,
          motivo: m.motivo,
          monto: Number(m.monto ?? 0),
          descuento: Number(m.descuento ?? 0),
          medio: m.medio,
          glosa: m.glosa,
          fecha: m.fecha,
          fechaEfectiva: m.fecha_efectiva,
          sujeto: m.alumno
            ? `${m.alumno.apellido}, ${m.alumno.nombre}`
            : m.profesor
            ? `${m.profesor.apellido}, ${m.profesor.nombre}`
            : null,
          detalle: m.inscripcion?.plan?.nombre ?? m.inscripcion?.curso?.nombre ?? null,
        }))
      }
    />
  );
}
