"use client";

/**
 * Qué se ve cuando una pantalla no pudo cargar lo que necesitaba.
 *
 * Existe para que un fallo de lectura no termine en una pantalla vacía que
 * parece decir "no hay datos". Muestra el mensaje real: es lo que permite
 * diagnosticar de un vistazo en vez de salir a buscar el problema donde no
 * está.
 */
export default function ErrorPrivado({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 sm:p-10 max-w-2xl mx-auto">
      <h1 className="text-2xl titulo mb-2">No se pudo cargar esta pantalla</h1>
      <p className="text-base text-[var(--texto-tenue)] mb-4">
        Es un error al leer los datos, no que falten datos. El detalle de abajo dice qué falló.
      </p>
      <pre className="text-sm bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-panel)] p-4 whitespace-pre-wrap mb-4">
        {error.message}
        {error.digest ? `\n\nReferencia: ${error.digest}` : ""}
      </pre>
      <button
        onClick={reset}
        className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]"
      >
        Reintentar
      </button>
    </div>
  );
}
