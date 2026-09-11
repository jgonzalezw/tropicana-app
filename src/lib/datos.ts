/**
 * Leer datos sin que un fallo se disfrace de "no hay nada".
 *
 * **El problema que resuelve.** Supabase devuelve `{ data, error }`. El patrón
 * cómodo —`const { data } = await sb.from(...)`— tira el error a la basura, y
 * después `data ?? []` convierte el fallo en una lista vacía. La pantalla
 * entonces miente: muestra "no hay planes" cuando lo que pasó es que la
 * consulta se rompió. Ya costó dos veces en este proyecto (el recibo que daba
 * 404 y la venta que se quedaba sin planes), y las dos veces se fue el tiempo
 * buscando el problema donde no estaba.
 *
 * **La regla** (regla de calidad 1 en `docs/REGLAS.md`): si el dato es
 * necesario para que la pantalla haga su trabajo, un fallo de lectura **se
 * muestra**; nunca se convierte en ausencia. Si vacío es un resultado legítimo
 * —contar dependencias, buscar algo opcional—, esto no hace falta.
 *
 * **Cómo se usa.** Envolviendo la lectura:
 *
 * ```ts
 * const planes = exigir(await sb.from("planes").select("*"), "los planes");
 * ```
 *
 * Lanza si falló. El `error.tsx` de `(privado)` lo muestra con su mensaje, que
 * es lo que permite diagnosticar en un vistazo en vez de adivinar.
 */

type Resultado<T> = { data: T | null; error: { message: string } | null };

/**
 * Devuelve los datos o lanza con un mensaje que nombra QUÉ se estaba leyendo.
 * El nombre importa: "no se pudieron cargar los planes" se entiende; el
 * mensaje crudo de Postgres, no.
 */
export function exigir<T>(r: Resultado<T>, que: string): T {
  if (r.error) throw new Error(`No se pudieron cargar ${que}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

/**
 * Igual, para una lectura de una sola fila que puede no existir: `null` es un
 * resultado válido (el alumno no existe), pero un error sigue siendo un error.
 */
export function exigirUno<T>(r: Resultado<T>, que: string): T | null {
  if (r.error) throw new Error(`No se pudo cargar ${que}: ${r.error.message}`);
  return r.data;
}
