import DisposicionListaFicha from "@/components/nuevo/DisposicionListaFicha";

// La lista persiste entre `/membresias` y `/membresias/[id]` (fase 1b). En la
// 1a es el esqueleto: la lista llega con `listarMembresias` en la próxima fase.
export default function LayoutLista({ children }: { children: React.ReactNode }) {
  return (
    <DisposicionListaFicha
      encabezado={<h1 className="text-lg font-semibold m-0">Membresías</h1>}
      filas={null}
      vacio="Ninguna membresía todavía. La lista llega en la próxima fase."
      hrefLista="/membresias"
      miga="Membresías"
    >
      {children}
    </DisposicionListaFicha>
  );
}
