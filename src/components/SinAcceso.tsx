import Pagina from "@/components/Pagina";

export default function SinAcceso() {
  return (
    <Pagina ancho="2xl">
      <h1 className="text-2xl mb-3">Sin acceso</h1>
      <p className="text-[var(--texto-tenue)] text-lg">
        No tenés permisos para ver esta pantalla.
      </p>
    </Pagina>
  );
}
