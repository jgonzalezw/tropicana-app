import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans-tropicana",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tropicana — Gestión",
  description: "Sistema de gestión de la Escuela de Bailes Tropicana",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
