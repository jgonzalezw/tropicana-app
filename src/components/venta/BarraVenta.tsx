"use client";

/**
 * La barra fija al pie de toda venta: lo que falta (el primer faltante, en
 * palabras), el total y el botón. Arranca después de la barra lateral y
 * alinea con el mismo padding que `<Pagina>` (regla de calidad 8). El botón
 * queda deshabilitado mientras haya algo por completar (regla de calidad 9):
 * `falta` viene de la misma función pura que valida el servidor.
 */
export default function BarraVenta({
  falta,
  total,
  etiqueta = "Vender",
  pendiente = false,
  error,
  onConfirmar,
}: {
  /** Primer faltante ("el profesor"); null si la venta está completa. */
  falta: string | null;
  /** Monto ya formateado, si hay uno. */
  total?: string | null;
  etiqueta?: string;
  pendiente?: boolean;
  error?: string | null;
  onConfirmar: () => void;
}) {
  return (
    <>
      {/* Reserva el alto de la barra para que no tape el último bloque. */}
      <div className="h-40 min-[640px]:h-20" aria-hidden />
      <div className="fixed left-0 right-0 bottom-0 min-[900px]:left-64 bg-[var(--fondo-panel)] border-t border-[var(--borde)] py-3 z-10">
        <div className="px-6 sm:px-8 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[12rem] text-base" aria-live="polite">
            {error ? (
              <span className="text-[var(--peligro)]" role="alert">
                {error}
              </span>
            ) : falta ? (
              <span className="text-[var(--texto-tenue)]">Falta {falta}.</span>
            ) : (
              <span className="text-[var(--exito-texto)]">Todo listo para registrar la venta.</span>
            )}
          </div>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!!falta || pendiente}
            className="px-5 py-3 text-lg font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
          >
            {pendiente ? "Guardando…" : total ? `${etiqueta} · ${total}` : etiqueta}
          </button>
        </div>
      </div>
    </>
  );
}
