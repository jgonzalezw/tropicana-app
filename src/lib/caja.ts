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
  | "talleres"
  | "productos"
  | "profesores"
  | "proveedores"
  | "gastos";

export type Direccion = "ingreso" | "egreso";

/** Motivo (clave del catálogo) -> qué deuda salda. `null` = solo mueve caja. */
export const BUCKET_POR_MOTIVO: Record<string, Bucket | null> = {
  // Ingresos (catálogo `motivo_cobro`). El motivo nombra la OPERACION de la
  // que viene la plata, no el momento en que se cobra: para la caja da igual
  // si es la primera cuota o la quinta, lo que importa es que es una membresía.
  membresia: "cuotas",
  clase_particular: "particulares",
  clase_prueba: "pruebas",
  alquiler: "alquiler",
  taller: "talleres",
  venta_producto: "productos",
  // Egresos (catálogo `motivo_pago`)
  comision_profesor: "profesores",
  otro_pago_profesor: "profesores",
  gasto_costo_fijo: "gastos",
  pago_proveedor: "proveedores",
  // Ajuste y "otro" no vienen de ninguna operación: solo mueven la caja.
  ajuste: null,
  otro: null,
  // Claves de antes de la migración 0020, por si queda algún pago viejo sin
  // remapear: no se ofrecen en el selector, pero se siguen entendiendo.
  inscripcion: "cuotas",
  mensualidad: "cuotas",
  cuota: "cuotas",
  venta_paquete: "cuotas",
  alquiler_de_sala: "alquiler",
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
  talleres: "descuento",
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
  talleres: "talleres",
  productos: "venta de productos",
  profesores: "pagos a profesores",
  proveedores: "pagos a proveedores",
  gastos: "gastos fijos",
};

/**
 * Cómo se llama cada motivo en pantalla. Está acá y no solo en el catálogo
 * porque las listas muestran motivos ya asentados, incluidos los viejos que
 * el selector ya no ofrece.
 */
const ETIQUETA_MOTIVO: Record<string, string> = {
  membresia: "Membresía",
  clase_particular: "Clase particular",
  clase_prueba: "Clase de prueba",
  alquiler: "Alquiler de sala",
  taller: "Taller",
  venta_producto: "Venta de producto",
  ajuste: "Ajuste de caja",
  otro: "Otro",
  comision_profesor: "Comisión a profesor",
  otro_pago_profesor: "Otros pagos a profesor",
  gasto_costo_fijo: "Gasto o costo fijo",
  pago_proveedor: "Pago a proveedor",
  // Anteriores a 0020.
  inscripcion: "Inscripción",
  mensualidad: "Mensualidad",
  cuota: "Cuota",
  venta_paquete: "Venta de paquete",
  alquiler_de_sala: "Alquiler de sala",
};

/** Etiqueta legible de un motivo. Si es desconocido, se arma desde la clave. */
export function etiquetaMotivo(clave: string): string {
  const conocida = ETIQUETA_MOTIVO[clave];
  if (conocida) return conocida;
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
   * Con qué motivo conviene asentar el cobro de esta línea cuando se llega por
   * el atajo de "Por cobrar". Hoy toda deuda de cuota viene de una membresía;
   * queda editable porque otras operaciones van a producir líneas también.
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
