"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarTema } from "@/lib/acciones-tema";

type OpcionTema = { clave: string; nombre: string };

/** Selector de tema visual, por usuario. El catálogo llega por props
 *  (de la tabla `temas`), así que sumar variantes no requiere tocar acá. */
export default function SelectorTema({
  temas,
  actual,
}: {
  temas: OpcionTema[];
  actual: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  if (temas.length <= 1) return null;

  return (
    <label className="block px-2 mb-3">
      <span className="block text-sm text-[var(--texto-tenue)] mb-1.5">Tema</span>
      <select
        defaultValue={actual}
        disabled={pendiente}
        onChange={(e) => {
          const clave = e.target.value;
          startTransition(async () => {
            await cambiarTema(clave);
            router.refresh();
          });
        }}
        className="entrada"
        aria-label="Tema visual"
      >
        {temas.map((t) => (
          <option key={t.clave} value={t.clave}>
            {t.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
