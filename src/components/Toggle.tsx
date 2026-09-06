"use client";

/**
 * Interruptor estandar de la app. Se usa para ACTIVAR/mostrar un dato opcional
 * (tutor de un alumno, aplicar descuento, limite de alumnos, clases ilimitadas,
 * etc.). Regla de UX (Javier): en casos equivalentes, siempre este toggle, nunca
 * un texto/enlace de otro color.
 */
export default function Toggle({
  checked,
  onChange,
  label,
  descripcion,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  descripcion?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 w-full text-left disabled:opacity-50"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[var(--primario)]" : "bg-[var(--borde)]"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="text-sm font-medium block">{label}</span>
        {descripcion && (
          <span className="text-xs text-[var(--texto-tenue)] block">{descripcion}</span>
        )}
      </span>
    </button>
  );
}
