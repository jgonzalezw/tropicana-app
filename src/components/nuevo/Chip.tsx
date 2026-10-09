export type TonoChip = "tipo" | "neutro" | "ambar" | "exito" | "peligro" | "tenue";

/** Etiqueta de estado (Activa, Por vencer, Con deuda…). Solo presenta: el
 *  tono lo decide quien la usa. */
export function Chip({
  tono = "neutro",
  chico = false,
  children,
}: {
  tono?: TonoChip;
  chico?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`n-chip${chico ? " n-chip--chico" : ""}`} data-tono={tono}>
      {children}
    </span>
  );
}

export type OpcionFiltro = { valor: string; etiqueta: string };

/** Fila de chips de filtro; uno prendido a la vez (`valor`). */
export function FiltroChips({
  etiqueta,
  opciones,
  valor,
  onCambio,
}: {
  /** Nombre del grupo para lectores de pantalla (p. ej. «Tipo»). */
  etiqueta: string;
  opciones: OpcionFiltro[];
  valor: string;
  onCambio: (valor: string) => void;
}) {
  return (
    <div className="n-chips" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          className="n-chip-filtro"
          aria-pressed={o.valor === valor}
          onClick={() => onCambio(o.valor)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
