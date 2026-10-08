/**
 * Calendario del ciclo: funciones puras de fechas y de caminar clases. Viven
 * aparte de `membresias.ts` (que toca la base) para poder probarse sin ella.
 */

/**
 * Recorre el calendario desde `desdeISO` juntando `n` clases que cuentan, y
 * devuelve la fecha de la n-ésima. Una membresía puede tener varios cursos: si
 * dos caen el mismo día, ese día aporta dos clases.
 *
 * Es pura a propósito: la comparten el motor (que lee con el cliente admin) y
 * el estado de cuenta (que lee con el de sesión), sin duplicar la regla.
 * `suspendidas` son claves `cursoId|YYYY-MM-DD`.
 */
export function caminarClases(
  desdeISO: string,
  cursos: { curso_id: number; dias: number[] }[],
  suspendidas: Set<string>,
  n: number
): string | null {
  const d = parseISOLocal(desdeISO);
  let acc = 0;
  for (let i = 0; i < 800; i++) {
    const dia = diaSemanaISO(d);
    const iso = isoLocal(d);
    for (const c of cursos) {
      if (!c.dias.includes(dia)) continue;
      if (suspendidas.has(`${c.curso_id}|${iso}`)) continue;
      acc++;
    }
    if (acc >= n) return iso;
    d.setDate(d.getDate() + 1);
  }
  return null;
}

export function parseISOLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function diaSemanaISO(d: Date): number {
  const wd = d.getDay();
  return wd === 0 ? 7 : wd;
}
export function sumarDiasISO(iso: string, n: number): string {
  const d = parseISOLocal(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}
