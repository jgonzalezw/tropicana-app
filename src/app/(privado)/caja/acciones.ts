"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerPerfilActual, tienePermiso } from "@/lib/sesion";
import { cargarReemplazos, registrarCobro } from "@/lib/cuentas";
import { imputarPagoReemplazos } from "@/lib/liquidacion/reemplazos";
import { pagarAProfesor } from "../liquidaciones/acciones";
import { etiquetaMotivo, saldaLiquidacion, saldaReemplazo, type EntradaMovimiento } from "@/lib/caja";
import { gs } from "@/lib/inscripcion";

/**
 * Asienta un movimiento de caja. Si el motivo salda una deuda y se eligió el
 * titular, va contra esa línea (y puede cerrar su membresía); si no, entra como
 * movimiento suelto que solo mueve la caja.
 */
export async function registrarMovimiento(
  e: EntradaMovimiento
): Promise<{ ok?: true; error?: string; resumen?: string }> {
  if (!(await tienePermiso("caja", "crear")))
    return { error: "No tenés permiso para registrar movimientos de caja." };

  const a = createAdminClient();
  if (!a) return { error: "Falta configurar la clave service_role en el servidor." };
  const perfil = await obtenerPerfilActual();

  const monto = Math.max(0, Math.round(Number(e.monto) || 0));
  const descuento = Math.max(0, Math.round(Number(e.descuento) || 0));
  // Un pago a un profesor puede ser de centavos (un saldo de prorrateo casi
  // nunca es redondo): el redondeo a entero de arriba no puede tirarlo abajo.
  const aProfesor = e.profesorId != null && e.direccion === "egreso" && Number(e.monto) > 0;
  if (monto + descuento <= 0 && !aProfesor) return { error: "Escribí el monto del movimiento." };
  if (!e.glosa.trim()) return { error: "Poné una glosa corta, para saber después de qué fue." };
  if (e.fechaEfectiva && e.fechaEfectiva > new Date().toISOString().slice(0, 10))
    return { error: "La fecha en que ocurrió el movimiento no puede ser futura." };

  // Contra una deuda concreta: lo resuelve la pieza compartida, que además
  // recalcula la membresía (cobrar puede ser lo que cierre el ciclo).
  if (e.cuotaId != null) {
    const res = await registrarCobro(
      a,
      {
        cuotaId: e.cuotaId,
        monto,
        medio: e.medio,
        notaMedio: e.notaMedio,
        descuento,
        descuentoMotivo: e.descuentoMotivo,
        fechaCompromiso: e.fechaCompromiso,
        fechaEfectiva: e.fechaEfectiva,
        glosa: e.glosa,
        motivo: e.motivo,
      },
      perfil?.id ?? null
    );
    if (res.error) return { error: res.error };

    revalidatePath("/caja");
    const cierre =
      res.saldoRestante === 0
        ? res.cerroMembresia
          ? " Saldo cerrado y membresía completada."
          : " Saldo cerrado."
        : ` Queda ${gs(res.saldoRestante ?? 0)} pendiente.`;
    const conDesc = descuento > 0 ? ` + ${gs(descuento)} de descuento` : "";
    return {
      ok: true,
      resumen: `Ingreso de ${gs(monto)}${conDesc} · ${etiquetaMotivo(e.motivo)}.${cierre}`,
    };
  }

  // Contra lo que se le debe a un profesor por sus reemplazos: el suplente
  // cobra por tarifa, así que esto NO pasa por liquidaciones. Cada pago queda
  // atado a las clases que salda (`pagos.sesion_id`), de la más vieja a la más
  // nueva, y la suma de las filas es exactamente el efectivo que sale.
  if (e.profesorId != null && e.direccion === "egreso" && saldaReemplazo(e.motivo)) {
    const exacto = Math.round((Number(e.monto) || 0) * 100) / 100;
    if (!e.medio) return { error: "Elegí el medio de pago." };
    const carga = (await cargarReemplazos(a, e.profesorId)).get(e.profesorId);
    if (!carga) return { error: "Ese profesor no tiene reemplazos pendientes de pago." };
    const imp = imputarPagoReemplazos(carga.clases, exacto, carga.pagadoSinClase);
    if (!imp.ok) return { error: imp.error };
    for (const f of imp.filas) {
      const { error: errPago } = await a.from("pagos").insert({
        tipo: "pago",
        motivo: "pago_reemplazante",
        profesor_id: e.profesorId,
        sesion_id: f.sesionId,
        monto: f.monto,
        medio: e.medio,
        glosa: e.glosa.trim(),
        fecha_efectiva: e.fechaEfectiva,
        registrado_por: perfil?.id ?? null,
      });
      if (errPago) return { error: "No se pudo registrar el pago: " + errPago.message };
    }
    revalidatePath("/caja");
    return {
      ok: true,
      resumen: `Egreso de ${gs(exacto)} · ${etiquetaMotivo(e.motivo)}. Se imputó a ${imp.filas.length} ${
        imp.filas.length === 1 ? "clase" : "clases"
      } de reemplazo.`,
    };
  }

  // Contra el saldo de un profesor: lo resuelve la misma pieza que usa la
  // pantalla de Liquidaciones. **Un solo camino a propósito**: si hubiera dos
  // formas de pagarle a un profesor podrían discrepar, y la diferencia recién
  // aparecería en el arqueo.
  // **Solo la comisión.** Un pago suelto a un profesor (`otro_pago_profesor`:
  // multa, bonificación…) cae más abajo: queda a su nombre pero no se imputa a
  // ninguna liquidación ni mueve su saldo.
  if (e.profesorId != null && e.direccion === "egreso" && saldaLiquidacion(e.motivo)) {
    // **Con centavos, no redondeado a entero.** El resto de la caja trabaja en
    // bolivianos enteros, pero un saldo de liquidación sale de un prorrateo y
    // casi nunca es redondo (11,68 · 353,19). Redondeándolo, pagar el saldo
    // exacto daba "el pago supera el saldo": el monto subía a 12 y no entraba.
    const exacto = Math.round((Number(e.monto) || 0) * 100) / 100;
    const res = await pagarAProfesor({
      profesorId: e.profesorId,
      monto: exacto,
      medio: e.medio,
      notaMedio: e.notaMedio,
    });
    if (res.error) return { error: res.error };
    revalidatePath("/caja");
    return {
      ok: true,
      resumen: `Egreso de ${gs(exacto)} · ${etiquetaMotivo(e.motivo)}. Se imputó al saldo del profesor.`,
    };
  }

  // Sin línea: el movimiento solo mueve la caja. Pasa con los motivos "Otro" y
  // con un motivo que hoy no tiene ninguna deuda abierta.
  const { error: errPago } = await a.from("pagos").insert({
    tipo: e.direccion === "ingreso" ? "cobro" : "pago",
    motivo: e.motivo,
    monto,
    medio: monto > 0 ? e.medio : null,
    descuento,
    descuento_motivo: descuento > 0 ? e.descuentoMotivo.trim() || null : null,
    glosa: e.glosa.trim(),
    fecha_efectiva: e.fechaEfectiva,
    // A quién se le pagó, si se eligió; sin liquidacion_id: no salda ninguna.
    profesor_id: e.direccion === "egreso" ? e.profesorId : null,
    registrado_por: perfil?.id ?? null,
  });
  if (errPago) return { error: "No se pudo registrar el movimiento: " + errPago.message };

  revalidatePath("/caja");
  return {
    ok: true,
    resumen: `${e.direccion === "ingreso" ? "Ingreso" : "Egreso"} de ${gs(monto)} · ${etiquetaMotivo(
      e.motivo
    )}. No afecta ninguna deuda.`,
  };
}
