"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

/** Lista a la izquierda y ficha a la derecha. La lista persiste mientras se
 *  cambia de ficha (se monta en el layout de la sección). En celular
 *  (< 900 px, el mismo corte que `BarraLateral`) son dos pantallas: sin
 *  ficha elegida se ve la lista; con una, la ficha a pantalla completa con
 *  «‹ Volver». Solo dispone: no sabe de membresías. */
export default function DisposicionListaFicha({
  encabezado,
  filas,
  vacio,
  hrefLista,
  miga,
  children,
}: {
  /** Título, buscador y filtros de la lista. */
  encabezado: React.ReactNode;
  /** Filas ya armadas (cada una con `className="n-fila"`); null si no hay. */
  filas: React.ReactNode;
  /** Texto cuando la lista no tiene filas. */
  vacio: string;
  /** A dónde vuelve «‹ Volver» en celular. */
  hrefLista: string;
  /** Texto de la barra superior de la ficha (p. ej. «Membresías › Ana Pérez»). */
  miga: string;
  children: React.ReactNode;
}) {
  const { id } = useParams<{ id?: string }>();
  return (
    <div className="n-disposicion" data-vista={id ? "ficha" : "lista"}>
      <aside className="n-lista" aria-label="Lista">
        <div className="n-lista__encabezado">{encabezado}</div>
        <div className="n-lista__filas">
          {filas ?? <div className="n-lista__vacio">{vacio}</div>}
        </div>
      </aside>
      <section className="n-ficha">
        <div className="n-ficha__miga">
          <Link href={hrefLista} className="n-volver">
            ‹ Volver
          </Link>
          <span>{miga}</span>
        </div>
        <div className="n-ficha__cuerpo">{children}</div>
      </section>
    </div>
  );
}
