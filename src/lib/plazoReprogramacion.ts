/**
 * Plazo para reprogramar una reserva. Hoy no hay plazo: siempre se puede. La
 * función existe para que la acción la llame y, si más adelante hay una regla
 * (decisión de negocio anotada en DECISIONES), se cambie acá y en ningún otro
 * lado. No aparece en ningún texto de pantalla.
 */
export function validarPlazoReprogramacion(reserva: { fecha: string; hora: string }, ahora: Date): { ok: true } | { ok: false; motivo: string } {
  void reserva;
  void ahora;
  return { ok: true };
}
