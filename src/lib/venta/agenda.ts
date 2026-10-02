/**
 * Qué sesiones se piden al vender un paquete de horas con agenda (particular y
 * alquiler). Pura: la misma cuenta para la pantalla y el servidor.
 *
 * La agenda fija se genera entera al vender; la flexible solo reserva la
 * primera. NUNCA se reservan más minutos que los comprados: la cuenta es por
 * piso, y el sobrante se informa y se coordina después (hallazgo de Javier,
 * 26/09/2026).
 */

export type AgendaVenta =
  | { modalidad: "flexible"; hora: string; duracionMin: number }
  | { modalidad: "fija"; diasSemana: number[]; hora: string; duracionMin: number };

export type SesionPedida = { fecha: string; hora: string; duracionMin: number };

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Las próximas fechas (incluida `desde`) en que cae alguno de `dias` (1=lun..7=dom). Tope de 400 días. */
export function fechasDeDias(dias: number[], desde: Date, cuantas: number): string[] {
  const out: string[] = [];
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  for (let i = 0; i < 400 && out.length < cuantas; i++) {
    const dow = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (dias.includes(dow)) out.push(iso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function planificarSesiones(
  agenda: AgendaVenta,
  inicio: Date,
  horas: number,
): { pedidas: SesionPedida[]; leftoverMin: number } | { error: string } {
  const minutos = Math.round(horas * 60);
  const largo = `La duración elegida (${agenda.duracionMin} min) es mayor a las horas del paquete (${horas} h).`;
  if (agenda.modalidad === "flexible") {
    if (agenda.duracionMin > minutos) return { error: largo };
    return {
      pedidas: [{ fecha: iso(inicio), hora: agenda.hora, duracionMin: agenda.duracionMin }],
      leftoverMin: minutos - agenda.duracionMin,
    };
  }
  if (!agenda.diasSemana.length) return { error: "Elegí al menos un día para la agenda fija." };
  const necesarias = Math.floor(minutos / agenda.duracionMin);
  if (necesarias < 1) return { error: largo };
  const fechas = fechasDeDias(agenda.diasSemana, inicio, necesarias);
  if (fechas.length < necesarias) return { error: "No se encontraron suficientes fechas para cubrir las horas del paquete." };
  return {
    pedidas: fechas.map((f) => ({ fecha: f, hora: agenda.hora, duracionMin: agenda.duracionMin })),
    leftoverMin: minutos - necesarias * agenda.duracionMin,
  };
}
