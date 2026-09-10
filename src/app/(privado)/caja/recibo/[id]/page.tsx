import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import Recibo, { type DatosRecibo } from "./Recibo";

export const dynamic = "force-dynamic";

const num = (v: unknown) => Number(v ?? 0);

/**
 * El recibo de un movimiento de caja. Mismo camino que el comprobante de
 * liquidación: una página propia, con su documento imprimible aparte.
 *
 * Lo que tiene que poder responder sin ayuda de nadie: quién pagó, por qué,
 * cuánto entró, y cuánto sigue debiendo.
 */
export default async function PaginaRecibo({ params }: { params: Promise<{ id: string }> }) {
  if (!(await tienePermiso("caja", "ver"))) return <SinAcceso />;

  const { id } = await params;
  const pagoId = Number(id);
  if (!Number.isFinite(pagoId)) notFound();

  const sb = await createClient();
  // La cuota va en su propia consulta: un embed de más es un modo de falla de
  // más, y este documento tiene que poder abrirse aunque la cuota no cargue.
  const { data, error } = await sb
    .from("pagos")
    .select(
      "id, tipo, motivo, monto, descuento, descuento_motivo, medio, glosa, fecha, fecha_efectiva, " +
        "cuota_id, registrado_por, " +
        "alumno:alumnos(nombre, apellido, whatsapp), " +
        "profesor:profesores(nombre, apellido, whatsapp), " +
        "inscripcion:inscripciones(plan:planes(nombre), curso:cursos(nombre))"
    )
    .eq("id", pagoId)
    .maybeSingle();

  // Un error de consulta no es "no existe": decirlo, en vez de mostrar un 404
  // que no explica nada y manda a buscar el problema donde no está.
  if (error) {
    return (
      <div className="p-6 sm:p-10 max-w-2xl mx-auto">
        <h1 className="text-2xl titulo mb-2">No se pudo abrir el recibo</h1>
        <p className="text-base text-[var(--texto-tenue)] mb-4">
          El movimiento N° {pagoId} existe, pero la consulta falló.
        </p>
        <pre className="text-sm bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-panel)] p-4 whitespace-pre-wrap">
          {error.message}
        </pre>
      </div>
    );
  }
  if (!data) notFound();

  const p = data as unknown as {
    id: number;
    tipo: string;
    motivo: string | null;
    monto: number;
    descuento: number;
    descuento_motivo: string | null;
    medio: string | null;
    glosa: string | null;
    fecha: string;
    fecha_efectiva: string | null;
    cuota_id: number | null;
    registrado_por: string | null;
    alumno: { nombre: string; apellido: string; whatsapp: string | null } | null;
    profesor: { nombre: string; apellido: string; whatsapp: string | null } | null;
    inscripcion: { plan: { nombre: string } | null; curso: { nombre: string } | null } | null;
  };

  // El saldo que dejó este movimiento. Se cuenta lo cubierto hasta él
  // inclusive (por orden de asiento), no el saldo de hoy: un recibo tiene que
  // seguir diciendo lo mismo dentro de un año, aunque después se haya cobrado
  // más contra la misma cuota.
  type CuotaRecibo = {
    id: number;
    periodo: string;
    fecha_compromiso: string | null;
    monto_devengado: number;
    descuento_adelanto: number;
  };
  let cuota: CuotaRecibo | null = null;
  if (p.cuota_id != null) {
    const { data: c } = await sb
      .from("cuotas")
      .select("id, periodo, fecha_compromiso, monto_devengado, descuento_adelanto")
      .eq("id", p.cuota_id)
      .maybeSingle();
    cuota = (c as CuotaRecibo | null) ?? null;
  }

  let saldoAnterior: number | null = null;
  let saldoResultante: number | null = null;
  if (cuota) {
    const { data: previos } = await sb
      .from("pagos")
      .select("monto, descuento")
      .eq("cuota_id", cuota.id)
      .eq("tipo", "cobro")
      .lte("id", p.id);
    const cubierto = ((previos as { monto: number; descuento: number }[]) ?? []).reduce(
      (t, x) => t + num(x.monto) + num(x.descuento),
      0
    );
    const referencia = Math.max(0, num(cuota.monto_devengado) - num(cuota.descuento_adelanto));
    saldoResultante = Math.max(0, referencia - cubierto);
    saldoAnterior = saldoResultante + num(p.monto) + num(p.descuento);
  }

  let registradoPor: string | null = null;
  if (p.registrado_por) {
    const { data: perfil } = await sb
      .from("perfiles")
      .select("nombre, apellido")
      .eq("id", p.registrado_por)
      .maybeSingle();
    const nom = perfil as { nombre: string | null; apellido: string | null } | null;
    const texto = `${nom?.nombre ?? ""} ${nom?.apellido ?? ""}`.trim();
    registradoPor = texto || null;
  }

  const persona = p.alumno ?? p.profesor;
  const datos: DatosRecibo = {
    id: p.id,
    direccion: p.tipo === "cobro" ? "ingreso" : "egreso",
    motivo: p.motivo,
    titular: persona ? `${persona.nombre} ${persona.apellido}` : null,
    whatsapp: persona?.whatsapp ?? null,
    servicio: p.inscripcion?.plan?.nombre ?? null,
    curso: p.inscripcion?.curso?.nombre ?? null,
    periodo: cuota?.periodo ?? null,
    monto: num(p.monto),
    descuento: num(p.descuento),
    descuentoMotivo: p.descuento_motivo,
    medio: p.medio,
    glosa: p.glosa,
    fechaRegistro: p.fecha,
    fechaEfectiva: p.fecha_efectiva,
    saldoAnterior,
    saldoResultante,
    fechaCompromiso: cuota?.fecha_compromiso ?? null,
    registradoPor,
  };

  return <Recibo datos={datos} />;
}
