"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerPerfilActual, tienePermiso } from "@/lib/sesion";
import { registrarCobro } from "@/lib/cuentas";
import { etiquetaMotivo, type EntradaMovimiento } from "@/lib/caja";
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
  if (monto + descuento <= 0) return { error: "Escribí el monto del movimiento." };
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
