import type { Metadata } from "next";
import { Montserrat, Figtree } from "next/font/google";
import "./globals.css";
import { obtenerPerfilActual } from "@/lib/sesion";
import {
  obtenerTemas,
  resolverTema,
  bloqueCssTema,
  TEMA_DEFECTO,
} from "@/lib/temas";

// Títulos y cifras.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// Cuerpo / interfaz.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Tropicana — Gestión",
  description: "Sistema de gestión de la Escuela de Bailes Tropicana",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Tema activo del usuario (o el por defecto si no hay sesión / migración).
  let claveTema = TEMA_DEFECTO;
  try {
    const perfil = await obtenerPerfilActual();
    if (perfil?.tema) claveTema = perfil.tema;
  } catch {
    // Sin sesión o sin backend: se usa el tema por defecto.
  }

  const temas = await obtenerTemas();
  const tema = resolverTema(temas, claveTema);

  return (
    <html
      lang="es"
      data-theme={tema.clave}
      className={`${montserrat.variable} ${figtree.variable} h-full antialiased`}
    >
      <head>
        {/* Tokens del tema activo, inyectados desde el servidor. */}
        <style
          id="tokens-tema"
          dangerouslySetInnerHTML={{ __html: bloqueCssTema(tema) }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
