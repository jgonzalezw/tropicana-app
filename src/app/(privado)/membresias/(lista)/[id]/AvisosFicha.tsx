"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import AvisoDeReserva from "@/components/AvisoDeReserva";
import type { RegistroAviso } from "@/lib/comunicaciones/avisos/tipos";

/**
 * Los avisos por WhatsApp que deja una acción de la ficha (cancelar, suspender,
 * reprogramar, crear una reserva) van todos en la columna derecha, en una
 * tarjeta «Para avisar» que se puede cerrar. Viven solo en memoria de la
 * página: no se guardan en la base, la URL ni el navegador, así que un refresco
 * los borra; lo que sí queda es el estado de la reserva, que es lo que manda.
 */
type Aviso = { nombre: string; whatsapp: string | null; mensaje: string; registro?: RegistroAviso };
export type AvisosDeAccion = { mensaje?: string; avisoAlumno?: Aviso; avisoProfesor?: Aviso };
type Publicado = { id: number; mensaje?: string; avisos: Aviso[] };

type Contexto = {
  /** Publica los avisos de una acción; devuelve `true` si había alguno. */
  publicar: (r: AvisosDeAccion) => boolean;
};

const AvisosContexto = createContext<Contexto | null>(null);
const PublicadosContexto = createContext<{ lista: Publicado[]; cerrar: (id: number) => void }>({ lista: [], cerrar: () => {} });

export function usePublicarAvisos(): Contexto | null {
  return useContext(AvisosContexto);
}

export function ProveedorAvisos({ children }: { children: React.ReactNode }) {
  const [lista, setLista] = useState<Publicado[]>([]);
  const siguiente = useRef(1);
  const publicar = useCallback((r: AvisosDeAccion) => {
    const avisos = [r.avisoAlumno, r.avisoProfesor].filter((a): a is Aviso => !!a);
    if (avisos.length === 0) return false;
    setLista((prev) => [...prev, { id: siguiente.current++, mensaje: r.mensaje, avisos }]);
    return true;
  }, []);
  const cerrar = useCallback((id: number) => setLista((prev) => prev.filter((p) => p.id !== id)), []);
  const [contexto] = useState<Contexto>(() => ({ publicar }));
  return (
    <AvisosContexto.Provider value={contexto}>
      <PublicadosContexto.Provider value={{ lista, cerrar }}>{children}</PublicadosContexto.Provider>
    </AvisosContexto.Provider>
  );
}

/** La tarjeta de la columna derecha; no ocupa lugar si no hay nada que avisar. */
export function TarjetaParaAvisar() {
  const { lista, cerrar } = useContext(PublicadosContexto);
  if (lista.length === 0) return null;
  return (
    <section className="n-tarjeta" data-testid="avisos-pendientes">
      <h2 className="n-tarjeta__titulo">Para avisar</h2>
      {lista.map((p) => (
        <div key={p.id} data-testid="aviso-accion" style={{ display: "flex", flexDirection: "column", gap: "0.5714rem", marginBottom: "0.8571rem" }}>
          {p.mensaje && <p className="n-ok" style={{ margin: 0 }}>{p.mensaje}</p>}
          {p.avisos.map((a, i) => (
            <AvisoDeReserva key={i} aviso={a} />
          ))}
          <button type="button" className="n-res__boton" onClick={() => cerrar(p.id)}>
            Cerrar aviso
          </button>
        </div>
      ))}
    </section>
  );
}
