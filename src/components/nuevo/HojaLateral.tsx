"use client";

import { useState } from "react";
import ConfirmacionIrreversible from "./ConfirmacionIrreversible";
import { useCapa } from "./useCapa";

export type AccionHoja = {
  txt: string;
  onClick: () => void;
  /** Deshabilitada: el motivo va en `pie`, nunca en silencio. */
  bloqueada?: boolean;
  tono?: "peligro";
};

/** Panel derecho para una acción sobre la ficha (cobrar, reservar, dar de
 *  baja…): encabezado, cuerpo con scroll y pie con las acciones y el motivo
 *  de bloqueo. Se monta solo cuando está abierta (quien la usa decide).
 *  Se cierra con Esc, ✕ o el velo; si `sucia`, antes pregunta. En celular
 *  cubre la pantalla. */
export default function HojaLateral({
  contexto,
  titulo,
  onCerrar,
  pie,
  pieTono,
  verCancelar = true,
  secundaria,
  primaria,
  sucia = false,
  children,
}: {
  contexto?: string;
  titulo: string;
  onCerrar: () => void;
  /** Motivo por el que la acción principal está bloqueada, o una ayuda. */
  pie?: string;
  pieTono?: "error";
  verCancelar?: boolean;
  secundaria?: AccionHoja;
  primaria?: AccionHoja;
  /** Hay datos sin guardar: cerrar pide confirmación. */
  sucia?: boolean;
  children: React.ReactNode;
}) {
  const [preguntando, setPreguntando] = useState(false);

  function intentarCerrar() {
    if (sucia) setPreguntando(true);
    else onCerrar();
  }
  const ref = useCapa<HTMLDivElement>(intentarCerrar);

  return (
    <>
      <div className="n-velo" data-testid="hoja-velo" onClick={intentarCerrar} />
      <div
        ref={ref}
        className="n-hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="n-hoja-titulo"
        tabIndex={-1}
      >
        <div className="n-hoja__enc">
          <div>
            {contexto && <div className="n-hoja__ctx">{contexto}</div>}
            <h2 id="n-hoja-titulo" className="n-hoja__titulo">
              {titulo}
            </h2>
          </div>
          <button type="button" className="n-cerrar" aria-label="Cerrar" onClick={intentarCerrar}>
            ✕
          </button>
        </div>
        <div className="n-hoja__cuerpo">{children}</div>
        <div className="n-hoja__pie">
          <div className="n-hoja__motivo" data-tono={pieTono}>
            {pie}
          </div>
          {verCancelar && (
            <button type="button" className="n-boton" onClick={intentarCerrar}>
              Cancelar
            </button>
          )}
          {secundaria && (
            <button
              type="button"
              className="n-boton"
              disabled={secundaria.bloqueada}
              onClick={secundaria.onClick}
            >
              {secundaria.txt}
            </button>
          )}
          {primaria && (
            <button
              type="button"
              className={`n-boton ${primaria.tono === "peligro" ? "n-boton--peligro" : "n-boton--primario"}`}
              disabled={primaria.bloqueada}
              onClick={primaria.onClick}
            >
              {primaria.txt}
            </button>
          )}
        </div>
      </div>
      {preguntando && (
        <ConfirmacionIrreversible
          titulo="¿Descartar lo que cargaste?"
          texto="Si cerrás ahora, se pierde lo que ingresaste en esta hoja."
          txtVolver="Seguir editando"
          txtConfirmar="Descartar"
          onVolver={() => setPreguntando(false)}
          onConfirmar={() => {
            setPreguntando(false);
            onCerrar();
          }}
        />
      )}
    </>
  );
}
