"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AccionAviso = { txt: string; onClick: () => void };
type EstadoAviso = { mensaje: string; acciones: AccionAviso[] };

const DURACION_MS = 6000;

/** Mensaje breve abajo («Guardado», «Cambio deshecho») con acciones como
 *  Deshacer o Copiar aviso. Dura 6 s; uno nuevo reemplaza al anterior.
 *  Uso: `const { aviso, mostrar } = useAviso();` y renderizar `{aviso}`. */
export function useAviso() {
  const [estado, setEstado] = useState<EstadoAviso | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ocultar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setEstado(null);
  }, []);

  const mostrar = useCallback((mensaje: string, acciones: AccionAviso[] = []) => {
    if (timer.current) clearTimeout(timer.current);
    setEstado({ mensaje, acciones });
    timer.current = setTimeout(() => setEstado(null), DURACION_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const aviso = estado ? (
    <div className="n-aviso" role="status" aria-live="polite" data-testid="aviso">
      <span>{estado.mensaje}</span>
      {estado.acciones.map((a) => (
        <button
          key={a.txt}
          type="button"
          onClick={() => {
            ocultar();
            a.onClick();
          }}
        >
          {a.txt}
        </button>
      ))}
    </div>
  ) : null;

  return { aviso, mostrar, ocultar };
}
