import type { ReactNode } from "react";

/**
 * Íconos del menú lateral plegable (I-012, commit 9): SVG de trazo propios, sin
 * dependencia. Uno por ítem de `BarraLateral`, por su `href`. Todos en una
 * grilla de 24 × 24, trazo de 1.75, heredan el color del texto.
 */
const TRAZOS: Record<string, ReactNode> = {
  // casa
  "/": (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
      <path d="M10 19.5v-5h4v5" />
    </>
  ),
  // tarjeta con signo +
  "/inscribir": (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M12 12.5v4M10 14.5h4" />
    </>
  ),
  // casilla con tilde
  "/asistencia": (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>
  ),
  // calendario
  "/sala": (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  // credencial (carné)
  "/membresias": (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.5-1.6 1.7-2.5 3-2.5s2.5.9 3 2.5M14.5 10h3.5M14.5 13.5H18" />
    </>
  ),
  // persona
  "/particulares": (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.6-3.6 3.3-5.5 7-5.5s6.4 1.9 7 5.5" />
    </>
  ),
  // llave
  "/alquileres": (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8.5-8.5M16 7l3 3M14 9l2 2" />
    </>
  ),
  // dos personas
  "/alumnos": (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3 19.5c.5-3.2 2.9-5 6-5s5.5 1.8 6 5" />
      <path d="M15.5 5.7a3 3 0 0 1 0 5.6M17.5 14.8c2 .6 3.2 2.1 3.5 4.7" />
    </>
  ),
  // libro abierto
  "/cursos": (
    <>
      <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  // etiqueta de precio
  "/planes": (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.6 7.6a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0L3.8 12.9a1 1 0 0 1-.3-.7Z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  // birrete
  "/profesores": (
    <>
      <path d="m2.5 9.5 9.5-5 9.5 5-9.5 5-9.5-5Z" />
      <path d="M6.5 11.8v4.2c0 1.2 2.5 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.2M21.5 9.5V15" />
    </>
  ),
  // documento con moneda
  "/liquidaciones": (
    <>
      <path d="M6 3.5h8.5L19 8v12.5H6V3.5Z" />
      <path d="M14.5 3.5V8H19" />
      <circle cx="12.5" cy="14.5" r="2.5" />
    </>
  ),
  // billetes
  "/caja": (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v.01M18 14.5v.01" />
    </>
  ),
  // persona con engranaje
  "/administracion/usuarios": (
    <>
      <circle cx="9.5" cy="8" r="3.3" />
      <path d="M3 20c.5-3.3 3-5.2 6.5-5.2 1 0 1.9.1 2.7.5" />
      <circle cx="18" cy="17" r="2" />
      <path d="M18 12.8v1.2M18 20v1.2M21.6 14.9l-1 .6M15.4 18.5l-1 .6M21.6 19.1l-1-.6M15.4 15.5l-1-.6" />
    </>
  ),
  // candado
  "/administracion/roles": (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5" />
    </>
  ),
  // caja de paquete
  "/precios": (
    <>
      <path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z" />
      <path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9" />
    </>
  ),
  // reloj
  "/administracion/sala": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.2 2" />
    </>
  ),
  // controles deslizantes
  "/administracion/parametros": (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  // lista
  "/administracion/catalogos": (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <path d="M4.5 6.5v.01M4.5 12v.01M4.5 17.5v.01" />
    </>
  ),
};

const POR_DEFECTO = <circle cx="12" cy="12" r="3" />;

export function IconoMenu({ href }: { href: string }) {
  return (
    <svg
      width="20"
      height="20"
      style={{ width: "1.4286rem", height: "1.4286rem", flexShrink: 0 }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[href] ?? POR_DEFECTO}
    </svg>
  );
}

export function IconoHamburguesa() {
  return (
    <svg width="20" height="20" style={{ width: "1.4286rem", height: "1.4286rem" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/** Clavo del menú: relleno = fijo, contorno = libre. */
export function IconoClavo({ fijo }: { fijo: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      style={{ width: "1.2857rem", height: "1.2857rem" }}
      viewBox="0 0 24 24"
      fill={fijo ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 4h6l-1 6 3.5 3.5V15h-11v-1.5L10 10 9 4Z" />
      <path d="M12 15v5.5" />
    </svg>
  );
}

export function IconoSalir() {
  return (
    <svg width="20" height="20" style={{ width: "1.4286rem", height: "1.4286rem" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M10 4.5H5.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H10M15 8l4 4-4 4M19 12H9.5" />
    </svg>
  );
}
