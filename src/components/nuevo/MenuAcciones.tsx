"use client";

import { useEffect, useRef, useState } from "react";

export type ItemMenu = {
  label: string;
  sub?: string;
  onClick: () => void;
  peligro?: boolean;
  /** Línea divisoria arriba (para lo destructivo). */
  separador?: boolean;
  /** Si está, el ítem se ve deshabilitado y este texto explica por qué (calidad 5: una capacidad no disponible se explica, no desaparece). */
  motivoBloqueo?: string;
};

/** Menú ⋯ de «más acciones»: la principal queda a la vista y el resto acá. */
export default function MenuAcciones({ items }: { items: ItemMenu[] }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    };
    const alClicAfuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("keydown", alEsc);
    document.addEventListener("mousedown", alClicAfuera);
    return () => {
      document.removeEventListener("keydown", alEsc);
      document.removeEventListener("mousedown", alClicAfuera);
    };
  }, [abierto]);

  return (
    <div className="n-menu" ref={raiz}>
      <button
        ref={boton}
        type="button"
        className="n-menu__boton"
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        ⋯
      </button>
      {abierto && (
        <div className="n-menu__lista" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className="n-menu__item"
              data-peligro={it.peligro ? "true" : undefined}
              data-separador={it.separador ? "true" : undefined}
              disabled={!!it.motivoBloqueo}
              onClick={() => {
                setAbierto(false);
                it.onClick();
              }}
            >
              <b>{it.label}</b>
              {(it.motivoBloqueo ?? it.sub) && <small>{it.motivoBloqueo ?? it.sub}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
