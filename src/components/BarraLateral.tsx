"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PerfilConRol } from "@/lib/tipos";
import SelectorTema from "@/components/SelectorTema";

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
  temas,
  temaActual,
}: {
  perfil: PerfilConRol;
  puedeUsuarios: boolean;
  puedeConfig: boolean;
  puedeAlumnos: boolean;
  puedeProfesores: boolean;
  puedeCursos: boolean;
  puedeInscribir: boolean;
  puedeAsistencia: boolean;
  temas: OpcionTema[];
  temaActual: string;
}) {
  const pathname = usePathname();

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
          href: "/profesores",
          etiqueta: "Profesores",
          mostrar: puedeProfesores,
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

  return (
    <aside className="w-64 shrink-0 bg-[var(--fondo-panel)] border-r border-[var(--borde)] flex flex-col">
      <div className="p-6 border-b border-[var(--borde)]">
        <div className="titulo text-2xl text-[var(--primario)]">Tropicana</div>
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
    </aside>
  );
}
