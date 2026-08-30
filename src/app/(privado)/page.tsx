import { obtenerPerfilActual } from "@/lib/sesion";
import EncabezadoPagina from "@/components/EncabezadoPagina";
import Link from "next/link";

export default async function Inicio() {
  const perfil = await obtenerPerfilActual();
  const esAdmin = perfil?.rol?.clave === "administrador";
  const nombre = perfil?.nombre || "";

  return (
    <div className="p-8 max-w-5xl">
      <EncabezadoPagina
        titulo={`Hola${nombre ? `, ${nombre}` : ""}`}
        descripcion="Bienvenido al sistema de gestión de Tropicana."
      />

      {esAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TarjetaAcceso
            href="/administracion/usuarios"
            titulo="Usuarios"
            texto="Gestioná las cuentas de acceso y sus roles."
          />
          <TarjetaAcceso
            href="/administracion/roles"
            titulo="Roles y permisos"
            texto="Definí qué puede hacer cada rol por módulo."
          />
          <TarjetaAcceso
            href="/administracion/parametros"
            titulo="Parámetros"
            texto="Moneda, tolerancia de faltas y otras políticas."
          />
          <TarjetaAcceso
            href="/administracion/catalogos"
            titulo="Catálogos"
            texto="Listas configurables usadas en toda la app."
          />
        </div>
      ) : (
        <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6">
          <p className="text-[var(--texto-tenue)] text-lg">
            Los módulos de tu rol aparecerán acá a medida que se construyan.
          </p>
        </div>
      )}
    </div>
  );
}

function TarjetaAcceso({
  href,
  titulo,
  texto,
}: {
  href: string;
  titulo: string;
  texto: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 hover:border-[var(--primario)] transition-colors"
    >
      <div className="titulo text-xl mb-1">{titulo}</div>
      <div className="text-[var(--texto-tenue)]">{texto}</div>
    </Link>
  );
}
