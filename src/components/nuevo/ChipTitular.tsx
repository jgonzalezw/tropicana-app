import { iniciales } from "@/lib/fichaMembresia";

/** El titular como chip con avatar de iniciales (spec visual de la ficha). Solo presenta. */
export default function ChipTitular({ nombre, testid }: { nombre: string; testid?: string }) {
  return (
    <span className="n-titular">
      <span className="n-titular__av" aria-hidden="true">
        {iniciales(nombre)}
      </span>
      <span data-testid={testid}>{nombre}</span>
    </span>
  );
}
