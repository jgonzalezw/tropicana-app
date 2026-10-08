export type CeldaIndicador = {
  etiqueta: string;
  valor: string;
  sub?: string;
  tono?: "exito" | "peligro" | "acento";
  /** 0–100: barra de avance bajo el valor. */
  progreso?: number;
};

/** Cuadro de cifras en una sola caja (clases hechas, saldo, vence…). */
export function Indicadores({ celdas }: { celdas: CeldaIndicador[] }) {
  return (
    <div className="n-indicadores">
      {celdas.map((c) => (
        <div key={c.etiqueta} className="n-indicador" data-tono={c.tono}>
          <div className="n-indicador__etiqueta">{c.etiqueta}</div>
          <div className="n-indicador__valor">{c.valor}</div>
          {c.sub && <div className="n-indicador__sub">{c.sub}</div>}
          {c.progreso !== undefined && (
            <div
              className="n-indicador__barra"
              role="progressbar"
              aria-label={c.etiqueta}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(100, Math.max(0, c.progreso)))}
            >
              <i style={{ width: `${Math.min(100, Math.max(0, c.progreso))}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
