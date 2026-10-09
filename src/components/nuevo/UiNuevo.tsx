import { Geist } from "next/font/google";
import "./ui-nuevo.css";

// Geist solo dentro de las secciones nuevas: `next/font` limita la fuente al
// componente que la usa, así que el resto de la app sigue con Montserrat y
// Figtree (D37, tema `.ui-nuevo`).
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/** Contenedor del tema nuevo. Toda sección nueva (Membresías, y luego Hoy y
 *  Agenda) se monta adentro; las variables `--n-*` no existen afuera. */
export default function UiNuevo({ children }: { children: React.ReactNode }) {
  return <div className={`ui-nuevo ${geist.variable}`}>{children}</div>;
}
