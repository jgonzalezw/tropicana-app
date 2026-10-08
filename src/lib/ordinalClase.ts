/**
 * ¿Qué número de clase es la de esta fecha para esta membresía, y cuántas le
 * quedan? (I-009)
 *
 * Usa el mismo criterio que `cicloAgotadoAl` de Asistencia, para que el número
 * que se ve y el momento en que el alumno sale del padrón no discrepen:
 * - **Plan de N clases** (`clasesPlan`): cuentan las clases **dictadas** antes
 *   de la fecha; el total ya incluye el bono.
 * - **Paquete por clase** (`clasesTotal`): cuentan las **presentes**; una falta
 *   no consume.
 * - Ilimitado o legado sin N: `null`, no hay número que mostrar.
 *
 * Solo cuentan las anteriores a `fecha`: la del propio día es la que se está
 * por marcar. Si dos cursos del mismo alumno caen el mismo día, los dos
 * muestran el mismo número (dentro del día no hay orden).
 */
export type OrdinalClase = {
  /** Número de la clase de `fecha` dentro del ciclo (1 = la primera). */
  numero: number;
  total: number;
  /** Clases que le quedan después de esta (nunca negativo). */
  quedan: number;
  /** Es la última del ciclo. */
  ultima: boolean;
};

export type EntradaOrdinal = {
  clasesPlan: number | null;
  clasesTotal: number | null;
  /** Fechas (ISO) de las sesiones dictadas de la membresía. */
  fechasDictadas: string[];
  /** Fechas (ISO) de las sesiones dictadas en que estuvo presente. */
  fechasPresentes: string[];
  fecha: string;
};

/** Qué fechas consumen el ciclo (la regla es una sola): dictadas en un plan de N, presentes en un paquete. */
function fechasQueConsumen(e: Omit<EntradaOrdinal, "fecha">): string[] {
  return e.clasesPlan != null ? e.fechasDictadas : e.fechasPresentes;
}

/**
 * Cuánto lleva consumido el ciclo **hasta una fecha inclusive** (p. ej. el corte
 * de un retiro) y de cuánto es el total (`null` = ilimitado: se cuentan las
 * presentes). Una falta cuenta en un plan de N: la clase se dio.
 */
export function avanceAlCorte(
  e: Omit<EntradaOrdinal, "fecha">,
  corte: string
): { hechas: number; total: number | null } {
  const total = e.clasesPlan ?? e.clasesTotal;
  return { hechas: fechasQueConsumen(e).filter((x) => x <= corte).length, total: total != null && total > 0 ? total : null };
}

export function ordinalDeClase(e: EntradaOrdinal): OrdinalClase | null {
  const porPlan = e.clasesPlan != null;
  const total = porPlan ? e.clasesPlan : e.clasesTotal;
  if (total == null || total <= 0) return null;
  const previas = fechasQueConsumen(e).filter((x) => x < e.fecha).length;
  const numero = previas + 1;
  return { numero, total, quedan: Math.max(0, total - numero), ultima: numero >= total };
}
