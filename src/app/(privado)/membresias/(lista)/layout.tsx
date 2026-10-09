import { Suspense } from "react";
import { listarMembresias, tiposVisiblesMembresias } from "../acciones";
import ListaMembresias from "./ListaMembresias";

// La lista persiste entre `/membresias` y `/membresias/[id]` (fase 1b): se lee
// una vez, con todos los estados, y los filtros se aplican en el cliente.
// `leerBase` falla con un mensaje si la API cortara las filas (no muestra una
// lista truncada); al pasar de unas 500 membresías, filtrar y paginar en el
// servidor (decisión postergada, D37).
export default async function LayoutLista({ children }: { children: React.ReactNode }) {
  const [{ items, error }, tiposVisibles] = await Promise.all([
    listarMembresias({ tipo: "todas", estado: "todas" }),
    tiposVisiblesMembresias(),
  ]);
  return (
    <Suspense>
      <ListaMembresias filas={items} tiposVisibles={tiposVisibles} error={error}>
        {children}
      </ListaMembresias>
    </Suspense>
  );
}
