import { tienePermiso } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { avisosDe, historialDe, indicadoresDe, lineasDePagos, permisosReservasFicha } from "@/lib/fichaMembresia";
import { obtenerMembresia } from "../../acciones";
import FichaMembresiaVista from "./FichaMembresiaVista";
import type { DatosReservas } from "./PestanasFicha";

export const dynamic = "force-dynamic";

// El mismo texto para una membresía que no existe y para una que el rol no ve:
// no se revela cuál de las dos es (`obtenerMembresia`).
const NO_EXISTE = "Esa membresía no existe o no tenés permiso para verla.";

export default async function PaginaFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresiaId = Number(id);
  const ficha = Number.isInteger(membresiaId) && membresiaId > 0 ? await obtenerMembresia(membresiaId) : { error: NO_EXISTE };
  if ("error" in ficha)
    return (
      <p className="n-error" role="alert" data-testid="ficha-error">
        {ficha.error}
      </p>
    );

  const ahora = new Date();
  const detalle = ficha.detalle;

  // Lo que necesitan `GestionReserva` y `NuevaReserva` para operar las reservas.
  let reservas: DatosReservas | null = null;
  const puedeVerReciboP = tienePermiso("caja", "ver");
  // Los permisos son del módulo del tipo (`particulares` o `alquileres`).
  if (detalle && (ficha.fila.tipo === "particular" || ficha.fila.tipo === "alquiler")) {
    const modulo = ficha.fila.tipo === "alquiler" ? "alquileres" : "particulares";
    const [puedeCrear, puedeEditar, sb] = await Promise.all([
      tienePermiso(modulo, "crear"),
      tienePermiso(modulo, "editar"),
      createClient(),
    ]);
    const [salasR, catalogoR, incR, minR, plazoR] = await Promise.all([
      sb.from("salas").select("id, nombre, activa, es_externa").eq("activa", true).order("orden"),
      sb
        .from("catalogos")
        .select("valores:catalogo_valores(valor, etiqueta, activo, orden)")
        .eq("clave", "motivo_suspension_reserva")
        .maybeSingle(),
      sb.from("parametros").select("valor").eq("clave", "tiempos_incremento_min").maybeSingle(),
      sb.from("parametros").select("valor").eq("clave", "duracion_minima_curso_min").maybeSingle(),
      sb.from("parametros").select("valor").eq("clave", "reserva_cancelacion_plazo_horas").maybeSingle(),
    ]);
    if (salasR.error) throw new Error(`No se pudieron leer las salas: ${salasR.error.message}`);
    if (catalogoR.error) throw new Error(`No se pudieron leer los motivos: ${catalogoR.error.message}`);
    if (plazoR.error) throw new Error(`No se pudo leer el plazo de cancelación: ${plazoR.error.message}`);
    const motivos = (
      (catalogoR.data as { valores: { valor: string; etiqueta: string; activo: boolean; orden: number }[] } | null)?.valores ?? []
    )
      .filter((v) => v.activo)
      .sort((x, y) => x.orden - y.orden);
    const externa = detalle.salasDeLaMembresia.find((s) => s.esExterna);
    const salasLeidas = (salasR.data as { id: number; nombre: string; es_externa: boolean }[]) ?? [];
    const permisos = permisosReservasFicha({
      estado: ficha.fila.estado,
      puedeCrear,
      puedeEditar,
      planPermiteExterna: detalle.permiteSalaExterna,
      hayExternaActiva: salasLeidas.some((s) => s.es_externa),
    });
    reservas = {
      membresiaId,
      tipo: detalle.tipo,
      contratadasMin: detalle.saldo.contratadasMin,
      disponibleMin: detalle.saldo.disponibleMin,
      fechaInicio: detalle.fechaInicio,
      fechaFin: detalle.fechaFin,
      salasPropias: salasLeidas.filter((s) => !s.es_externa).map((s) => ({ id: s.id, nombre: s.nombre })),
      salaExterna: externa ? { salaId: externa.salaId, nombre: externa.nombre } : null,
      puedeEditar: permisos.editar,
      ofrecerExterna: permisos.ofrecerExterna,
      motivoSinAlta: permisos.motivo,
      motivosSuspension: motivos.map(({ valor, etiqueta }) => ({ valor, etiqueta })),
      incrementoMin: Math.max(1, Number((incR.data as { valor: string } | null)?.valor) || 30),
      minimoMin: Math.max(1, Number((minR.data as { valor: string } | null)?.valor) || 30),
      // Mismo valor por defecto que `cancelarAPedido` (parámetro de la migración 0054).
      plazoCancelacionHoras: Math.max(1, Number((plazoR.data as { valor: string } | null)?.valor) || 8),
      ahora: ahora.toISOString(),
      reservas: detalle.reservas,
    };
  }

  return (
    <FichaMembresiaVista
      ficha={ficha}
      indicadores={indicadoresDe(ficha, ahora)}
      avisos={avisosDe(ficha, detalle?.reservas ?? null, ahora)}
      historial={historialDe(ficha, detalle?.reservas ?? null, ahora)}
      pagos={lineasDePagos(ficha)}
      reservas={reservas}
      puedeVerRecibo={await puedeVerReciboP}
    />
  );
}
