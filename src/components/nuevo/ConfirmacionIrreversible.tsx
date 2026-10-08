"use client";

import { useCapa } from "./useCapa";

/** Modal centrado para lo que no se puede deshacer. El velo NO lo cierra
 *  (se elige a propósito) y Esc equivale a «Volver». Va por encima de una
 *  hoja: como máximo una capa más una confirmación. */
export default function ConfirmacionIrreversible({
  titulo,
  texto,
  txtVolver = "Volver",
  txtConfirmar,
  onVolver,
  onConfirmar,
}: {
  titulo: string;
  texto: string;
  txtVolver?: string;
  txtConfirmar: string;
  onVolver: () => void;
  onConfirmar: () => void;
}) {
  const ref = useCapa<HTMLDivElement>(onVolver);
  return (
    <div className="n-velo n-velo--modal" data-testid="confirmacion-velo">
      <div
        ref={ref}
        className="n-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="n-modal-titulo"
        aria-describedby="n-modal-texto"
        tabIndex={-1}
      >
        <h2 id="n-modal-titulo" className="n-modal__titulo">
          {titulo}
        </h2>
        <p id="n-modal-texto" className="n-modal__texto">
          {texto}
        </p>
        <div className="n-modal__botones">
          <button type="button" className="n-boton" onClick={onVolver}>
            {txtVolver}
          </button>
          <button type="button" className="n-boton n-boton--peligro" onClick={onConfirmar}>
            {txtConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
