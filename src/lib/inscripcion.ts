/**
 * Lógica pura de inscripción: fechas de clase, precio por modalidad y descuento
 * por meses adelantados. La usan tanto la pantalla (para mostrar) como la server
 * action (para recomputar contra los datos reales de la base — nunca se confía
 * en el monto que manda el navegador).
 */

export type Modalidad = "mensual" | "clase" | "semana" | "medio_mes";

export const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
/** 1=lunes … 7=domingo → etiqueta larga en plural (para el toggle de días). */
export const DIAS_LARGOS: Record<number, string> = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves",
  5: "Viernes", 6: "Sábados", 7: "Domingos",
};

export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  mensual: "Mensual completo",
  clase: "Una clase",
  semana: "Una semana",
  medio_mes: "Medio mes",
};

/** Día de la semana en convención ISO (1=lun … 7=dom). */
export function diaIso(d: Date): number {
  const wd = d.getDay();
  return wd === 0 ? 7 : wd;
}

/** Suma meses conservando el día (o el último día del mes si no existe). */
export function sumarMeses(fecha: Date, n: number): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth() + n, 1);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(fecha.getDate(), ultimoDia));
  return d;
}

/** Primer día del mes de la fecha dada. */
export function primerDiaDelMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

/** Fecha en formato ISO local (YYYY-MM-DD) sin corrimiento por zona horaria. */
export function isoFecha(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "mié 3 sep" */
export function fechaLarga(d: Date): string {
  return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

/** Próximas `n` clases desde `desde`, cayendo en los días indicados (ISO). */
export function proximasClases(dias: number[], n: number, desde: Date): Date[] {
  const validos = dias.length ? dias : [1, 2, 3, 4, 5, 6, 7];
  const out: Date[] = [];
  const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  for (let i = 0; i < 90 && out.length < n; i++) {
    if (validos.includes(diaIso(d))) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Avanza desde `inicio` juntando `n` clases de los días indicados (por conteo). */
export function clasesPorConteo(dias: number[], inicio: Date, n: number): Date[] {
  const out: Date[] = [];
  const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  for (let i = 0; i < 400 && out.length < n; i++) {
    if (dias.includes(diaIso(d))) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Clases del curso que caen dentro de una ventana de `ventana` días. */
export function clasesEnPeriodo(diasCurso: number[], inicio: Date, ventana: number): Date[] {
  const out: Date[] = [];
  const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const fin = new Date(d);
  fin.setDate(fin.getDate() + ventana - 1);
  while (d <= fin) {
    if (diasCurso.includes(diaIso(d))) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Total de clases de "medio mes" = factor × días de clase semanales del curso. */
export function totalMedioMes(diasCurso: number[], factor: number): number {
  return Math.max(1, factor) * Math.max(1, diasCurso.length);
}

/** Subconjunto de días del curso elegidos para medio mes; null/vacío = todos. */
export function diasMedioMes(diasCurso: number[], sel: number[] | null): number[] {
  if (sel && sel.length) return diasCurso.filter((d) => sel.includes(d));
  return diasCurso;
}

/**
 * Clases concretas que cubre la modalidad, desde `inicio`.
 *  - clase:     1 clase
 *  - semana:    una repetición del patrón semanal (ventana de 7 días)
 *  - medio_mes: `totalMedioMes`, repartido en los días elegidos
 */
export function clasesModalidad(
  diasCurso: number[],
  inicio: Date,
  modalidad: Modalidad,
  factorMedio: number,
  diasElegidos: number[] | null
): Date[] {
  if (modalidad === "clase") return clasesEnPeriodo(diasCurso, inicio, 1);
  if (modalidad === "semana") return clasesEnPeriodo(diasCurso, inicio, 7);
  if (modalidad === "medio_mes") {
    return clasesPorConteo(
      diasMedioMes(diasCurso, diasElegidos),
      inicio,
      totalMedioMes(diasCurso, factorMedio)
    );
  }
  return [];
}

export type TarifasParciales = {
  clase: number | null;
  semana: number | null;
  medio_mes: number | null;
};

/**
 * Precio de la modalidad. Parcial sin tarifa propia → cae al mensual.
 * `meses` sólo aplica a mensual (multiplica el precio del mes).
 */
export function precioModalidad(
  modalidad: Modalidad,
  precioMensual: number,
  tarifas: TarifasParciales,
  meses: number
): number {
  if (modalidad === "mensual") return precioMensual * Math.max(1, meses);
  const t = tarifas[modalidad];
  return t != null ? t : precioMensual;
}

/**
 * Descuento por meses adelantados (tabla B). Cruce EXACTO: sólo aplica si hay
 * una fila para esa cantidad de meses. Devuelve el % y el monto redondeado.
 */
export function descuentoAdelanto(
  subtotal: number,
  meses: number,
  tabla: Record<number, number>
): { pct: number; monto: number } {
  const pct = meses >= 2 ? tabla[meses] ?? 0 : 0;
  return { pct, monto: Math.round((subtotal * pct) / 100) };
}

/** Reparte un descuento total entre `meses` cuotas (el resto va a las primeras). */
export function repartirDescuento(total: number, meses: number): number[] {
  const n = Math.max(1, meses);
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

/** Nombra el mes una sola vez por tramo: "lun 24, lun 31 ago y lun 7 sep". */
export function listaFechas(ds: Date[]): string {
  if (!ds.length) return "";
  const partes = ds.map((d, i) => {
    const base = `${DIAS_CORTOS[d.getDay()]} ${d.getDate()}`;
    const cierraMes = i === ds.length - 1 || ds[i + 1].getMonth() !== d.getMonth();
    return cierraMes ? `${base} ${MESES_CORTOS[d.getMonth()]}` : base;
  });
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

export const gs = (n: number) => `Bs. ${Number(n || 0).toLocaleString("es-BO")}`;
