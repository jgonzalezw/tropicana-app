"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PerfilConRol } from "@/lib/tipos";
import type { InfoRelease } from "@/lib/version";
import SelectorTema from "@/components/SelectorTema";
import InfoReleaseChip from "@/components/InfoRelease";

type ItemNav = { href: string; etiqueta: string; mostrar: boolean };
type OpcionTema = { clave: string; nombre: string };

export default function BarraLateral({
  perfil,
  puedeUsuarios,
  puedeConfig,
  puedeAlumnos,
  puedeProfesores,
  puedeCursos,
  puedeInscribir,
  puedeAsistencia,
  puedeCaja,
  puedePlanes,
  puedeLiquidaciones,
  puedePrecios,
  puedeSala,
  puedeDisponibilidadSala,
  puedeParticulares,
  temas,
  temaActual,
  infoRelease,
}: {
  perfil: PerfilConRol;
  puedeUsuarios: boolean;
  puedeConfig: boolean;
  puedeAlumnos: boolean;
  puedeProfesores: boolean;
  puedeCursos: boolean;
  puedeInscribir: boolean;
  puedeAsistencia: boolean;
  puedeCaja: boolean;
  puedePlanes: boolean;
  puedeLiquidaciones: boolean;
  puedePrecios: boolean;
  /** Administración → Sala y horarios (horario base). */
  puedeSala: boolean;
  /** Gestión → Disponibilidad de sala (H4): permiso propio, separado de `puedeSala`. */
  puedeDisponibilidadSala: boolean;
  puedeParticulares: boolean;
  temas: OpcionTema[];
  temaActual: string;
  infoRelease: InfoRelease;
}) {
  const pathname = usePathname();

  // Corte a celular en 900px, evaluado en JS (no en CSS): el sidebar y el
  // drawer son el mismo elemento en dos posiciones, así la lista de
  // navegación existe una sola vez — mismo criterio que el App Shell
  // diseñado (`docs/design/App Shell.dc.html`).
  const [esMovil, setEsMovil] = useState(false);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  useEffect(() => {
    const medir = () => setEsMovil(window.innerWidth < 900);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  // Cambiar de pantalla cierra el drawer: nadie quiere seguir viendo el menú
  // abierto sobre la pantalla nueva. Ajustado durante el render (no en un
  // efecto aparte) comparando contra el pathname anterior — es el patrón que
  // React recomienda para "resetear estado cuando cambia algo", y evita el
  // repintado en cascada de hacerlo en un `useEffect`.
  const [pathnameAnterior, setPathnameAnterior] = useState(pathname);
  if (pathname !== pathnameAnterior) {
    setPathnameAnterior(pathname);
    setDrawerAbierto(false);
  }

  const nombreMostrado =
    [perfil.nombre, perfil.apellido].filter(Boolean).join(" ") || "Usuario";

  const secciones: { grupo: string; items: ItemNav[] }[] = [
    {
      grupo: "General",
      items: [{ href: "/", etiqueta: "Inicio", mostrar: true }],
    },
    {
      grupo: "Gestión",
      items: [
        {
          href: "/inscribir",
          etiqueta: "Inscribir y cobrar",
          mostrar: puedeInscribir,
        },
        {
          href: "/asistencia",
          etiqueta: "Tomar asistencia",
          mostrar: puedeAsistencia,
        },
        {
          href: "/sala",
          etiqueta: "Disponibilidad de sala",
          mostrar: puedeDisponibilidadSala,
        },
        {
          href: "/particulares",
          etiqueta: "Particulares",
          mostrar: puedeParticulares,
        },
        {
          href: "/alumnos",
          etiqueta: "Alumnos",
          mostrar: puedeAlumnos,
        },
        {
          href: "/cursos",
          etiqueta: "Cursos",
          mostrar: puedeCursos,
        },
        {
          href: "/planes",
          etiqueta: "Planes",
          mostrar: puedePlanes,
        },
        {
          href: "/profesores",
          etiqueta: "Profesores",
          mostrar: puedeProfesores,
        },
        {
          href: "/liquidaciones",
          etiqueta: "Liquidaciones",
          mostrar: puedeLiquidaciones,
        },
        {
          href: "/caja",
          etiqueta: "Caja",
          mostrar: puedeCaja,
        },
      ],
    },
    {
      grupo: "Administración",
      items: [
        {
          href: "/administracion/usuarios",
          etiqueta: "Usuarios",
          mostrar: puedeUsuarios,
        },
        {
          href: "/administracion/roles",
          etiqueta: "Roles y permisos",
          mostrar: puedeConfig,
        },
        {
          href: "/precios",
          etiqueta: "Precios y paquetes",
          mostrar: puedePrecios,
        },
        {
          href: "/administracion/sala",
          etiqueta: "Sala y horarios",
          mostrar: puedeSala,
        },
        {
          href: "/administracion/parametros",
          etiqueta: "Parámetros",
          mostrar: puedeConfig,
        },
        {
          href: "/administracion/catalogos",
          etiqueta: "Catálogos",
          mostrar: puedeConfig,
        },
      ],
    },
  ];

  // El contenido es el mismo elemento en las dos posiciones (sidebar fija en
  // desktop, drawer en celular): una sola lista de navegación, nunca dos que
  // puedan desincronizarse.
  const contenido = (
    <>
      <div className="p-6 border-b border-[var(--borde)]">
        <div className="flex items-center justify-between gap-2">
          <div className="titulo text-2xl text-[var(--primario)]">Tropicana</div>
          <InfoReleaseChip info={infoRelease} />
        </div>
        <div className="text-sm text-[var(--texto-tenue)] mt-1">Gestión</div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {secciones.map((seccion) => {
          const items = seccion.items.filter((i) => i.mostrar);
          if (items.length === 0) return null;
          return (
            <div key={seccion.grupo}>
              <div className="text-xs uppercase tracking-wider text-[var(--texto-tenue)] mb-2 px-2">
                {seccion.grupo}
              </div>
              <ul className="space-y-1">
                {items.map((item) => {
                  const activo =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block px-4 py-2.5 rounded-[var(--radio-control)] text-base transition-colors ${
                          activo
                            ? "bg-[var(--primario)] text-[var(--primario-texto)] font-semibold"
                            : "text-[var(--texto)] hover:bg-[var(--fondo-elevado)]"
                        }`}
                      >
                        {item.etiqueta}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--borde)]">
        <SelectorTema temas={temas} actual={temaActual} />
        <div className="px-2 mb-3">
          <div className="text-base font-medium truncate">{nombreMostrado}</div>
          <div className="text-sm text-[var(--texto-tenue)]">
            {perfil.rol?.nombre}
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full px-4 py-2.5 text-base rounded-[var(--radio-control)] border border-[var(--borde)] text-[var(--texto-tenue)] hover:text-[var(--texto)] hover:border-[var(--texto-tenue)] transition-colors"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </>
  );

  if (!esMovil) {
    return (
      <aside className="w-64 shrink-0 bg-[var(--fondo-panel)] border-r border-[var(--borde)] flex flex-col">
        {contenido}
      </aside>
    );
  }

  // Celular: barra superior con hamburguesa + logo, y el mismo contenido
  // corrido a un drawer que se abre encima. Retraído por defecto para no
  // robarle espacio a la pantalla — es lo que pidió Javier al probar en
  // celular con el App Shell actual.
  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-30 h-14 flex items-center gap-3 px-3 bg-[var(--fondo-panel)] border-b border-[var(--borde)]">
        <button
          onClick={() => setDrawerAbierto(true)}
          aria-label="Abrir menú"
          className="w-11 h-11 -ml-1 flex items-center justify-center rounded-[var(--radio-control)] hover:bg-[var(--fondo-elevado)]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <div className="titulo text-xl text-[var(--primario)]">Tropicana</div>
        <div className="ml-auto">
          <InfoReleaseChip info={infoRelease} />
        </div>
      </div>

      {drawerAbierto && (
        <button
          aria-label="Cerrar menú"
          onClick={() => setDrawerAbierto(false)}
          className="fixed inset-0 z-40 bg-black/60"
        />
      )}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[min(300px,86vw)] bg-[var(--fondo-panel)] border-r border-[var(--borde)] flex flex-col transition-transform duration-200 ease-out ${
          drawerAbierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {contenido}
      </aside>
    </>
  );
}
