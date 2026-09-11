import type { Curso } from "@/lib/tipos";

/**
 * Referencia de precio: cuánto costaría comprar por separado lo que el plan
 * ofrece junto. Sugiere, nunca impone — el precio lo fija quien arma el plan
 * (regla 9 de `docs/REGLAS.md`).
 *
 * **Por qué no alcanza con sumar los precios mensuales.** Un plan de 4 clases
 * no vale un mes de cada curso. La referencia estima **el valor de una clase**
 * del curso y lo multiplica por las clases que el plan ofrece.
 *
 * **De dónde sale el valor de una clase.** De la tarifa del tramo que mejor
 * corresponde a esa cantidad (Javier: "las tablas de paquetes y precios
 * acercan la referencia al precio por intervalos de cantidad de clases").
 * Comprar 1 clase suelta sale más caro por clase que comprar el mes: usar
 * siempre la tarifa suelta inflaría la referencia, y usar siempre la mensual
 * la hundiría.
 */

export type TarifasDeCurso = { clase?: number; semana?: number; medio_mes?: number };

/** Cuántas clases tiene el curso en cada tramo, según su calendario semanal. */
function tramos(curso: Curso, factorMedioMes: number) {
  const porSemana = Math.max(1, (curso.dias_semana ?? []).length);
  return {
    porSemana,
    porMedioMes: Math.max(1, Math.round(factorMedioMes * porSemana)),
    porMes: Math.max(1, porSemana * 4),
  };
}

/**
 * Valor estimado de UNA clase del curso, para una compra de `clases` clases.
 * Devuelve también de qué tramo salió, para poder mostrarlo: una referencia
 * que no explica de dónde sale no se puede discutir.
 */
export function valorDeUnaClase(
  curso: Curso,
  tarifas: TarifasDeCurso,
  clases: number,
  factorMedioMes: number
): { valor: number; tramo: string } | null {
  const t = tramos(curso, factorMedioMes);
  const mensual = Number(curso.precio_mensual ?? 0);

  // Del tramo más chico al más grande: se usa el primero que cubra la compra
  // y tenga precio cargado.
  const escala: { hasta: number; precio: number | undefined; clases: number; nombre: string }[] = [
    { hasta: 1, precio: tarifas.clase, clases: 1, nombre: "clase suelta" },
    { hasta: t.porSemana, precio: tarifas.semana, clases: t.porSemana, nombre: "una semana" },
    { hasta: t.porMedioMes, precio: tarifas.medio_mes, clases: t.porMedioMes, nombre: "medio mes" },
    { hasta: Infinity, precio: mensual || undefined, clases: t.porMes, nombre: "el mes" },
  ];

  for (const e of escala) {
    if (clases <= e.hasta && e.precio && e.precio > 0)
      return { valor: e.precio / e.clases, tramo: e.nombre };
  }
  // Ningún tramo cubre la compra con precio cargado: se cae al más grande que
  // sí lo tenga, de mayor a menor.
  for (const e of [...escala].reverse()) {
    if (e.precio && e.precio > 0) return { valor: e.precio / e.clases, tramo: e.nombre };
  }
  return null;
}

export type LineaReferencia = {
  curso: Curso;
  valorClase: number;
  tramo: string;
  subtotal: number;
};

export type Referencia = {
  total: number;
  lineas: LineaReferencia[];
  /** Cursos del plan sin ninguna tarifa cargada: no pudieron estimarse. */
  sinTarifa: Curso[];
};

/**
 * Referencia de un plan con N clases.
 *
 * Con varios cursos no se sabe cómo va a repartir el alumno sus N clases entre
 * ellos, así que se toma el **promedio** del valor por clase de los cursos del
 * plan. Con un solo curso el promedio es ese curso, así que el caso común sale
 * exacto.
 */
export function referenciaPorClases(
  cursos: Curso[],
  tarifasPorCurso: Record<number, TarifasDeCurso>,
  clases: number,
  factorMedioMes: number
): Referencia {
  const lineas: LineaReferencia[] = [];
  const sinTarifa: Curso[] = [];
  for (const c of cursos) {
    const v = valorDeUnaClase(c, tarifasPorCurso[c.id] ?? {}, clases, factorMedioMes);
    if (!v) sinTarifa.push(c);
    else lineas.push({ curso: c, valorClase: v.valor, tramo: v.tramo, subtotal: v.valor * clases });
  }
  if (!lineas.length) return { total: 0, lineas, sinTarifa };
  const promedio = lineas.reduce((t, l) => t + l.valorClase, 0) / lineas.length;
  return { total: promedio * clases, lineas, sinTarifa };
}

/**
 * Referencia de un plan ilimitado: no hay N, el ciclo es un período. Se toma
 * el precio mensual de cada curso escalado a la duración del ciclo, y se suman
 * — acá sí se suma, porque el alumno tiene acceso simultáneo a todos.
 */
export function referenciaPorPeriodo(cursos: Curso[], cicloDias: number): Referencia {
  const factor = Math.max(0, cicloDias) / 30;
  const lineas: LineaReferencia[] = [];
  const sinTarifa: Curso[] = [];
  for (const c of cursos) {
    const mensual = Number(c.precio_mensual ?? 0);
    if (!(mensual > 0)) sinTarifa.push(c);
    else
      lineas.push({
        curso: c,
        valorClase: mensual,
        tramo: "el mes",
        subtotal: mensual * factor,
      });
  }
  return { total: lineas.reduce((t, l) => t + l.subtotal, 0), lineas, sinTarifa };
}
