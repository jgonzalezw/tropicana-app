import type { Politica } from "@/components/Cobro";

/**
 * Las reglas de Caja, según el handoff (`docs/design/README.md`, Screen 3):
 * cada motivo mapea a un **bucket** de deuda, o a `null` para los dos "Otro".
 * Un movimiento cuyo motivo corresponde a la venta de un servicio o producto
 * reduce la cuenta por cobrar que le toca; un pago reduce la cuenta por pagar.
 * Los "Otro" solo mueven la caja y no tocan ninguna deuda.
 *
 * La consecuencia importante: un movimiento no reduce una categoría en
 * abstracto, reduce el saldo de una persona. Por eso el sujeto es obligatorio
 * cuando el motivo tiene deudas abiertas.
 */

export type Bucket =
  | "cuotas"
  | "particulares"
  | "alquiler"
  | "pruebas"
  | "productos"
  | "profesores"
  | "proveedores"
  | "gastos";

export type Direccion = "ingreso" | "egreso";

/** Motivo (clave del catálogo) -> qué deuda salda. `null` = solo mueve caja. */
export const BUCKET_POR_MOTIVO: Record<string, Bucket | null> = {
  // Ingresos (catálogo `motivo_cobro`)
  inscripcion: "cuotas",
  mensualidad: "cuotas",
  venta_paquete: "cuotas",
  clase_particular: "particulares",
  alquiler_de_sala: "alquiler",
  venta_producto: "productos",
  // Egresos (catálogo `motivo_pago`)
  comision_profesor: "profesores",
  otro_pago_profesor: "profesores",
  gasto_costo_fijo: "gastos",
  pago_proveedor: "proveedores",
  // Los dos "otro" (uno por catálogo) no saldan nada.
  otro: null,
};

/**
 * Un movimiento sigue la política de descuento/ajuste de la operación que
 * salda: cobrar acá no es un acto más liviano que cobrar en su propia pantalla.
 */
export const POLITICA_POR_BUCKET: Record<Bucket, Politica> = {
  cuotas: "descuento",
  particulares: "descuento",
  alquiler: "descuento",
  pruebas: "descuento",
  productos: "descuento",
  profesores: "ajuste",
  proveedores: "ajuste",
  gastos: "simple",
};

export function politicaDeMotivo(motivo: string | null): Politica {
  if (!motivo) return "simple";
  const bucket = BUCKET_POR_MOTIVO[motivo];
  return bucket ? POLITICA_POR_BUCKET[bucket] : "simple";
}

export function bucketDeMotivo(motivo: string | null): Bucket | null {
  return motivo ? BUCKET_POR_MOTIVO[motivo] ?? null : null;
}

/** Cómo se llama cada bucket cuando hay que decir "no hay saldos abiertos en…". */
export const NOMBRE_BUCKET: Record<Bucket, string> = {
  cuotas: "cuotas de alumnos",
  particulares: "clases particulares",
  alquiler: "alquiler de sala",
  pruebas: "clases de prueba",
  productos: "venta de productos",
  profesores: "pagos a profesores",
  proveedores: "pagos a proveedores",
  gastos: "gastos fijos",
};

/** Etiqueta legible de un motivo del catálogo (`venta_paquete` -> "Venta paquete"). */
export function etiquetaMotivo(clave: string): string {
  const texto = clave.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Una deuda concreta contra la que se puede imputar un movimiento: la línea
 * abierta de una persona, con su saldo. Es lo que el handoff llama "el deudor
 * o acreedor que el movimiento salda".
 */
export type LineaPendiente = {
  /** Identificador estable de la línea, para el `cuentaId` del paso Cobro. */
  clave: string;
  bucket: Bucket;
  /** Contra qué se imputa realmente (hoy: una cuota). */
  cuotaId: number | null;
  sujetoTipo: "alumno" | "profesor" | "proveedor" | "tercero";
  sujetoId: number | null;
  sujeto: string;
  detalle: string;
  saldo: number;
  /**
   * Cuándo tenía que estar pagada: la fecha de compromiso si se pactó una, si
   * no el vencimiento de la cuota. `null` = la deuda no tiene fecha pactada.
   * Es lo que separa las vencidas de las que están al día.
   */
  fechaLimite: string | null;
  /**
   * Con qué motivo conviene asentar el cobro de esta línea, cuando se llega
   * por el atajo de "Por cobrar" y nadie eligió uno. Es una sugerencia
   * editable, no una verdad: la primera cuota de una membresía se asienta como
   * inscripción y las siguientes como mensualidad.
   */
  motivoSugerido: string | null;
};

/**
 * El contexto de un movimiento. Se puede llegar armado desde la operación
 * (inscripción, estado de cuenta de un alumno o profesor) para ir directo al
 * cobro, o construirlo navegando desde Caja. Cuando viene resuelto, la pantalla
 * no vuelve a preguntar dirección, motivo ni sujeto.
 */
export type ContextoMovimiento = {
  direccion: Direccion;
  motivo: string;
  linea: LineaPendiente;
};

/** Lo que el panel emite al guardar un movimiento. */
export type EntradaMovimiento = {
  direccion: Direccion;
  motivo: string;
  glosa: string;
  /** Contra qué deuda se imputa. `null` = movimiento suelto de caja. */
  cuotaId: number | null;
  monto: number;
  medio: string | null;
  notaMedio: string;
  descuento: number;
  descuentoMotivo: string;
  /** Obligatoria si el cobro deja saldo: mismo criterio que la venta. */
  fechaCompromiso: string | null;
  /** Cuándo ocurrió de verdad, si no fue hoy. `null` = coincide con el registro. */
  fechaEfectiva: string | null;
};
