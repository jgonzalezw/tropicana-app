/**
 * La sala: quién la ocupa, cuándo, y cuánto cuesta.
 *
 * **Dos preguntas distintas que viven juntas porque se hacen juntas.** Al
 * vender una particular o un alquiler hay que saber (a) si la sala está libre
 * en ese rango y (b) cuánto cuesta esa sala, que sale de la matriz del bloque E
 * de *Precios y paquetes*.
 *
 * **La ocupación tiene dos fuentes y una sola de ellas es una tabla.** Las
 * reservas —particulares, alquileres y bloqueos internos (D7)— son filas de
 * `reservas_sala`, y ahí la base garantiza el no-solapamiento con una
 * restricción `exclude`. Las clases de cursos regulares **no tienen fila**: se
 * calculan desde el curso (`dias_semana` + `hora` + `duracion_min`), su
 * vigencia (0033) y las sesiones suspendidas. Guardar el mismo hecho en dos
 * lugares es la confusión más cara de este proyecto; el calendario del curso ya
 * es la fuente de verdad de cuándo hay clase.
 *
 * Por eso el chequeo contra cursos regulares vive acá, en código, y el chequeo
 * entre reservas vive en la base: cada uno donde está el dato.
 */

import { diaIso } from "@/lib/inscripcion";
import { aMinutos, etiquetaDuracion, seSolapan } from "@/lib/horarios";
import { enVigencia, type VigenciaCurso } from "@/lib/vigencia";
import type { TipoProfesor } from "@/lib/tipos";

/**
 * Las cuatro categorías con las que se entra a la matriz de sala. Son los
 * valores del catálogo `categoria_comprador`, que existe desde la 0001 con
 * exactamente este propósito — no se inventa una grafía nueva para el mismo
 * concepto (glosario de `docs/REGLAS.md`).
 */
export type CategoriaSala =
  | "alumno"
  | "profesor_tropicana"
  | "profesor_externo"
  | "tercero";

export type ClaveTamano = "individual" | "pareja" | "grupo";

export type TamanoSala = {
  clave: ClaveTamano;
  etiqueta: string;
  max_personas: number;
  orden: number;
};

/** Una celda de la matriz del bloque E. `precio: null` = sin tarifa cargada. */
export type TarifaSala = {
  categoria: CategoriaSala;
  tamano: ClaveTamano;
  horas: number;
  precio: number | null;
};

export const ETIQUETA_CATEGORIA: Record<CategoriaSala, string> = {
  alumno: "Alumno",
  profesor_tropicana: "Profesor Tropicana",
  profesor_externo: "Profesor Externo",
  tercero: "Tercero",
};

/**
 * Con qué categoría entra un profesor a la matriz.
 *
 * `profesores.tipo` dice 'activo' | 'externo' (0005) y el catálogo de
 * categorías dice 'profesor_tropicana' | 'profesor_externo' (0001). Son dos
 * vocabularios preexistentes para el mismo hecho; la traducción vive en un
 * solo lugar —acá— en vez de repetirse en cada pantalla.
 */
export function categoriaSalaDeProfesor(tipo: TipoProfesor): CategoriaSala {
  return tipo === "externo" ? "profesor_externo" : "profesor_tropicana";
}

/**
 * El primer tamaño cuyo máximo alcanza a la cantidad de personas (E.3 del
 * handoff: 1 → Individual, 2 → Pareja, 5 → Grupo). Si nadie alcanza —más gente
 * que el máximo del grupo— devuelve `null`: no hay tamaño que la cubra, y eso
 * se dice, no se estira el más grande.
 */
export function tamanoPorPersonas(
  tamanos: TamanoSala[],
  personas: number
): TamanoSala | null {
  return (
    [...tamanos]
      .sort((a, b) => a.max_personas - b.max_personas)
      .find((t) => personas <= t.max_personas) ?? null
  );
}

export type CostoSala =
  | { precio: number; ruta: string }
  | { precio: null; ruta: string; motivo: string };

/**
 * El costo de sala para una combinación categoría × tamaño × horas.
 *
 * **La falta es un estado diseñado, no un cero** (N39/N34 del handoff, y la
 * regla de calidad 1). Si la matriz no tiene fila para esas horas, o la celda
 * está vacía, se devuelve `precio: null` **con el motivo escrito**: la venta se
 * puede cobrar igual, pero el paquete de sala queda sin precio y no se liquida.
 * Sustituir por 0 haría que una tarifa sin cargar parezca una sala gratis.
 *
 * `ruta` es la coordenada resuelta ("Profesor Tropicana × Pareja × 4 h") para
 * que quien vende pueda **verificar** la búsqueda en vez de confiar en ella.
 */
export function costoDeSala(
  tarifas: TarifaSala[],
  categoria: CategoriaSala,
  tamano: TamanoSala,
  horas: number
): CostoSala {
  const ruta = `Alquiler de sala → ${ETIQUETA_CATEGORIA[categoria]} × ${tamano.etiqueta} (hasta ${tamano.max_personas}) × ${horas} h`;

  const fila = tarifas.find(
    (t) =>
      t.categoria === categoria &&
      t.tamano === tamano.clave &&
      Number(t.horas) === Number(horas)
  );

  if (!fila)
    return {
      precio: null,
      ruta,
      motivo: `Falta el paquete de ${horas} h en la tabla de alquiler de sala. Sin esa fila, la sala de esta venta no se puede valorizar.`,
    };

  if (fila.precio == null)
    return {
      precio: null,
      ruta,
      motivo: `La celda ${ETIQUETA_CATEGORIA[categoria]} × ${tamano.etiqueta} × ${horas} h está vacía en la tabla de alquiler de sala. Vacío no es cero: cargá el precio para poder liquidarla.`,
    };

  return { precio: Number(fila.precio), ruta };
}

// ── Ocupación ────────────────────────────────────────────────────────────

export type TipoOcupacion = "curso" | "particular" | "alquiler" | "bloqueo";

/** Un rango de la sala que ya está tomado, con por qué y para quién. */
export type BloqueOcupado = {
  tipo: TipoOcupacion;
  /** `HH:MM` de inicio. */
  hora: string;
  duracionMin: number;
  /** Qué es: el nombre del curso, el alumno de la particular, el motivo. */
  etiqueta: string;
  /** Para quién / de quién: el profesor, el comprador. `null` si no aplica. */
  detalle: string | null;
};

/** Lo mínimo que hay que leer de un curso para saber si ocupa la sala. */
export type CursoOcupa = VigenciaCurso & {
  id: number;
  nombre: string;
  dias_semana: number[] | null;
  hora: string | null;
  duracion_min: number | null;
};

/**
 * Las clases de cursos regulares que ocupan la sala una fecha dada.
 *
 * Cuenta una clase cuando el curso corre ese día de la semana **y** la fecha
 * cae dentro de su vigencia. Una sesión **suspendida** no ocupa: la clase no se
 * dictó, la sala estaba libre (regla de negocio 19 — una suspensión libera la
 * sala aunque corra el ciclo del alumno).
 *
 * Un curso sin hora cargada no puede ocupar un rango —no se sabe cuál— así que
 * no genera bloque. No es un dato que se pueda suponer.
 */
export function ocupacionDeCursos(
  cursos: CursoOcupa[],
  fechaISO: string,
  /** Claves `cursoId` de las sesiones suspendidas **de esa fecha**. */
  cursosSuspendidos: Set<number>
): BloqueOcupado[] {
  const dia = diaIso(new Date(fechaISO + "T00:00:00"));

  return cursos
    .filter((c) => (c.dias_semana ?? []).includes(dia))
    .filter((c) => enVigencia(c, fechaISO))
    .filter((c) => !cursosSuspendidos.has(c.id))
    .filter((c) => aMinutos(c.hora) != null && Number(c.duracion_min) > 0)
    .map((c) => ({
      tipo: "curso" as const,
      hora: c.hora!.slice(0, 5),
      duracionMin: Number(c.duracion_min),
      etiqueta: c.nombre,
      detalle: `Clase regular · ${etiquetaDuracion(c.duracion_min)}`,
    }));
}

/**
 * Los bloques que se pisan con el rango pedido.
 *
 * Devuelve la lista, no un booleano: quien pregunta necesita **decir con qué
 * choca**. "La sala está ocupada" manda a buscar el problema a ciegas; "choca
 * con Salsa Inicial, 19:00 → 20:00" se resuelve solo.
 */
export function choquesCon(
  ocupados: BloqueOcupado[],
  hora: string,
  duracionMin: number
): BloqueOcupado[] {
  return ocupados.filter((b) => seSolapan(hora, duracionMin, b.hora, b.duracionMin));
}

/** "Salsa Inicial (19:00 → 20:00)" — para nombrar el choque en un mensaje. */
export function describirBloque(b: BloqueOcupado): string {
  const ini = aMinutos(b.hora) ?? 0;
  const fin = ini + b.duracionMin;
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `${b.etiqueta} (${hhmm(ini)} → ${hhmm(fin)})`;
}
