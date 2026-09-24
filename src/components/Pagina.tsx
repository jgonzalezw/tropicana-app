/**
 * El contenedor de TODA pantalla: mismo padding y mismo borde izquierdo en
 * todas (Javier, 2026-09-24: "estandarizar que siempre se comporten igual").
 * Nunca se centra. Cada pantalla elige solo su ancho máximo; el resto es fijo.
 * Lo hace cumplir `src/lib/pantallas.test.ts` (regla de calidad 8).
 */
const ANCHOS = {
  lg: "max-w-lg",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
} as const;

export default function Pagina({
  ancho,
  className = "",
  children,
}: {
  ancho: keyof typeof ANCHOS;
  /** Solo para lo propio de la pantalla (p. ej. `pb-28` si tiene barra abajo). */
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`p-6 sm:p-8 ${ANCHOS[ancho]} ${className}`.trim()}>{children}</div>;
}
