"use client";

import { useEffect, useRef } from "react";

/** Pila de capas abiertas (la última es la de arriba). Esc y Tab los atiende
 *  solo la de arriba: la confirmación «¿Descartar?» se resuelve antes que la
 *  hoja que tiene debajo. */
const pila: symbol[] = [];

/** Comportamiento común de una capa (hoja o modal): al abrir lleva el foco
 *  adentro, lo mantiene adentro con Tab, y al cerrar lo devuelve a quien lo
 *  tenía. Esc llama a `onEsc` solo si esta es la capa de arriba. */
export function useCapa<T extends HTMLElement>(onEsc: () => void) {
  const ref = useRef<T>(null);
  const alEsc = useRef(onEsc);
  useEffect(() => {
    alEsc.current = onEsc;
  });

  useEffect(() => {
    const id = Symbol("capa");
    pila.push(id);
    const previo = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const enfocables = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
    (enfocables()[0] ?? el)?.focus();

    const alTecla = (e: KeyboardEvent) => {
      if (pila[pila.length - 1] !== id) return; // otra capa está arriba
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        alEsc.current();
        return;
      }
      if (e.key !== "Tab") return;
      const lista = enfocables();
      if (lista.length === 0) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    window.addEventListener("keydown", alTecla, true);
    return () => {
      window.removeEventListener("keydown", alTecla, true);
      const i = pila.indexOf(id);
      if (i >= 0) pila.splice(i, 1);
      previo?.focus?.();
    };
  }, []);

  return ref;
}
