"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { InfoRelease } from "@/lib/version";
import SelectorTema from "@/components/SelectorTema";
import InfoReleaseChip from "@/components/InfoRelease";
import { IconoClavo, IconoHamburguesa, IconoMenu, IconoSalir } from "@/components/IconosMenu";
import type { ItemNav, OpcionTema } from "@/components/BarraLateral";

/* ── menú plegable (interruptor `menu_plegable`, 0068) ────────────────────
   Riel de 4.25rem con íconos; al pasar el mouse, al recibir foco con Tab o
   con el botón ☰ se despliega a 17rem ENCIMA del contenido. El clavo lo
   fija y entonces empuja el contenido. Por defecto arranca fijo (abierto,
   como la barra de siempre); la preferencia de cada persona queda en
   localStorage. Medidas en rem (14 px del mockup = 1rem, la base de la app) para que crezca con
   el zoom y el tamaño de letra. Mismos ítems, orden y permisos: los trae
   `BarraLateral` ya filtrados. */
const EVENTO_PREFERENCIA = "tropicana:menu-fijo";
const ANCHO_RIEL = "4.25rem";
const ANCHO_ABIERTO = "17rem";

function suscribir(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO_PREFERENCIA, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO_PREFERENCIA, avisar);
  };
}

function useMenuFijo(clave: string): [boolean, (fijo: boolean) => void] {
  const fijo = useSyncExternalStore(
    suscribir,
    () => {
      try {
        return window.localStorage.getItem(clave) !== "0";
      } catch {
        return true;
      }
    },
    () => true
  );
  const guardar = (valor: boolean) => {
    try {
      window.localStorage.setItem(clave, valor ? "1" : "0");
    } catch {
      /* sin almacenamiento: vale solo mientras dura la pantalla */
    }
    window.dispatchEvent(new Event(EVENTO_PREFERENCIA));
  };
  return [fijo, guardar];
}

export default function RielPlegable({
  secciones,
  pathname,
  clavePreferencia,
  nombreMostrado,
  rol,
  temas,
  temaActual,
  infoRelease,
}: {
  secciones: { grupo: string; items: ItemNav[] }[];
  pathname: string;
  clavePreferencia: string;
  nombreMostrado: string;
  rol?: string;
  temas: OpcionTema[];
  temaActual: string;
  infoRelease: InfoRelease;
}) {
  const [fijo, guardarFijo] = useMenuFijo(clavePreferencia);
  // `abierto`: desplegado por mouse o foco. `porBoton`: lo abrió el ☰ y se
  // queda hasta Esc, un clic fuera o volver a tocar el botón.
  const [abierto, setAbierto] = useState(false);
  const [porBoton, setPorBoton] = useState(false);
  const aside = useRef<HTMLElement>(null);

  const cerrar = () => {
    setAbierto(false);
    setPorBoton(false);
  };

  // Cambiar de pantalla cierra el desplegado (mismo patrón que el drawer).
  const [pathnameAnterior, setPathnameAnterior] = useState(pathname);
  if (pathname !== pathnameAnterior) {
    setPathnameAnterior(pathname);
    setAbierto(false);
    setPorBoton(false);
  }

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        setPorBoton(false);
      }
    };
    const alTocarFuera = (e: MouseEvent) => {
      if (!aside.current?.contains(e.target as Node)) {
        setAbierto(false);
        setPorBoton(false);
      }
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", alTocarFuera);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", alTocarFuera);
    };
  }, [abierto]);

  const desplegado = fijo || abierto;
  const encima = abierto && !fijo;

  return (
    <div className="shrink-0 relative" style={{ width: fijo ? ANCHO_ABIERTO : ANCHO_RIEL }} data-testid="menu-plegable" data-fijo={fijo ? "true" : "false"}>
      <aside
        ref={aside}
        aria-label="Menú principal"
        className="sticky top-0 z-40 flex h-dvh flex-col overflow-hidden border-r border-[var(--borde)] bg-[var(--fondo-panel)] text-[1rem]"
        style={{ width: desplegado ? ANCHO_ABIERTO : ANCHO_RIEL, boxShadow: encima ? "10px 0 30px rgba(0,0,0,.45)" : undefined }}
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={() => {
          if (!porBoton) setAbierto(false);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={(e) => {
          if (!porBoton && !e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false);
        }}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--borde)] px-[0.75rem]">
          {!fijo && (
            <button
              type="button"
              aria-label={abierto && porBoton ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={abierto}
              title="Menú"
              onClick={() => {
                if (abierto && porBoton) cerrar();
                else {
                  setAbierto(true);
                  setPorBoton(true);
                }
              }}
              className="flex h-[2.625rem] w-[2.625rem] shrink-0 items-center justify-center rounded-[var(--radio-control)] hover:bg-[var(--fondo-elevado)]"
            >
              <IconoHamburguesa />
            </button>
          )}
          {desplegado && (
            <>
              <div className="titulo min-w-0 flex-1 whitespace-nowrap text-2xl text-[var(--primario)]">Tropicana</div>
              <InfoReleaseChip info={infoRelease} />
              <button
                type="button"
                aria-pressed={fijo}
                aria-label={fijo ? "Desfijar el menú" : "Fijar el menú"}
                title={fijo ? "Desfijar el menú" : "Fijar el menú"}
                onClick={() => {
                  guardarFijo(!fijo);
                  if (fijo) cerrar();
                }}
                className={`flex h-[2.375rem] w-[2.375rem] shrink-0 items-center justify-center rounded-[var(--radio-control)] hover:bg-[var(--fondo-elevado)] ${
                  fijo ? "text-[var(--primario)]" : "text-[var(--texto-tenue)]"
                }`}
              >
                <IconoClavo fijo={fijo} />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {secciones.map((seccion, i) => {
            const items = seccion.items.filter((it) => it.mostrar);
            if (items.length === 0) return null;
            return (
              <div key={seccion.grupo} className={i > 0 ? "mt-4" : undefined}>
                {desplegado ? (
                  <div className="mb-1.5 whitespace-nowrap px-4 text-[0.75rem] uppercase tracking-wider text-[var(--texto-tenue)]">
                    {seccion.grupo}
                  </div>
                ) : (
                  i > 0 && <hr className="mx-3 mb-2 border-[var(--borde)]" />
                )}
                <ul className="space-y-0.5 px-[0.5rem]">
                  {items.map((item) => {
                    const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          prefetch={false}
                          title={item.etiqueta}
                          aria-label={item.etiqueta}
                          aria-current={activo ? "page" : undefined}
                          className={`flex h-[2.75rem] items-center gap-3 rounded-[var(--radio-control)] px-[0.875rem] transition-colors ${
                            activo
                              ? "bg-[var(--fondo-elevado)] font-semibold text-[var(--primario)]"
                              : "text-[var(--texto)] hover:bg-[var(--fondo-elevado)]"
                          }`}
                        >
                          <IconoMenu href={item.href} />
                          <span className="whitespace-nowrap transition-opacity duration-150" style={{ opacity: desplegado ? 1 : 0 }}>
                            {item.etiqueta}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-[var(--borde)] p-2">
          {desplegado ? (
            <div className="p-2">
              <SelectorTema temas={temas} actual={temaActual} />
              <div className="mb-3 px-1">
                <div className="truncate font-medium">{nombreMostrado}</div>
                <div className="text-[0.875rem] text-[var(--texto-tenue)]">{rol}</div>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="h-[2.75rem] w-full rounded-[var(--radio-control)] border border-[var(--borde)] text-[var(--texto-tenue)] transition-colors hover:border-[var(--texto-tenue)] hover:text-[var(--texto)]"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          ) : (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="flex h-[2.75rem] w-full items-center justify-center rounded-[var(--radio-control)] text-[var(--texto-tenue)] hover:bg-[var(--fondo-elevado)] hover:text-[var(--texto)]"
              >
                <IconoSalir />
              </button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
