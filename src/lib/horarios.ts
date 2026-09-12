/**
 * La hora de fin de una clase.
 *
 * **Se calcula, no se guarda** (D6, Javier 2026-09-12: *"implementá la duración
 * de las sesiones de cursos en el maestro de cursos, con eso se obtiene la hora
 * de fin"*). Guardar inicio y fin sería tener el mismo hecho en dos campos que
 * pueden contradecirse, que es exactamente la confusión más cara de este
 * proyecto: dos campos llamados "fin de ciclo". El glosario existe para no
 * repetirla.
 *
 * De acá sale el bloque que la agenda de sala va a validar: sin duración, una
 * clase "a las 19:00" no choca con ninguna otra.
 */

/** Minutos desde medianoche de un `HH:MM` o `HH:MM:SS`. `null` si no es hora. */
export function aMinutos(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hora.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** `HH:MM` desde minutos. Envuelve a las 24 h por si una clase cruza medianoche. */
export function aHora(minutos: number): string {
  const m = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Hora de fin = inicio + duración. `null` si el curso no tiene hora cargada. */
export function horaFin(hora: string | null | undefined, duracionMin: number | null | undefined): string | null {
  const ini = aMinutos(hora);
  if (ini == null) return null;
  const dur = Number(duracionMin);
  if (!(dur > 0)) return null;
  return aHora(ini + dur);
}

/** "19:00 → 20:30", o solo "19:00" si falta la duración, o `null` si no hay hora. */
export function rangoHorario(
  hora: string | null | undefined,
  duracionMin: number | null | undefined
): string | null {
  const ini = aMinutos(hora);
  if (ini == null) return null;
  const fin = horaFin(hora, duracionMin);
  return fin ? `${aHora(ini)} → ${fin}` : aHora(ini);
}

/** "1 h 30", "45 min", "2 h" — para mostrar la duración sin hacer cuentas. */
export function etiquetaDuracion(duracionMin: number | null | undefined): string {
  const d = Number(duracionMin);
  if (!(d > 0)) return "—";
  const h = Math.floor(d / 60);
  const m = d % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

/**
 * ¿Se pisan dos bloques? Medio abierto `[inicio, fin)`: una clase que termina
 * 20:00 y otra que empieza 20:00 **no** chocan — es el cambio de turno normal
 * de una sala, no un conflicto.
 *
 * Lo usa la validación de disponibilidad de sala; vive acá para que haya un
 * solo criterio y no dos que se contradigan.
 */
export function seSolapan(
  aIni: string | null | undefined,
  aDur: number | null | undefined,
  bIni: string | null | undefined,
  bDur: number | null | undefined
): boolean {
  const a1 = aMinutos(aIni);
  const b1 = aMinutos(bIni);
  if (a1 == null || b1 == null) return false;
  const da = Number(aDur);
  const db = Number(bDur);
  if (!(da > 0) || !(db > 0)) return false;
  return a1 < b1 + db && b1 < a1 + da;
}
