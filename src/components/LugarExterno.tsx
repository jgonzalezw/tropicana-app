"use client";

/**
 * Lugar externo de una membresía (0057): ver, incluir o editar su nombre, sin
 * importar cómo se vendió (Javier, 26/09). Una pieza para las pantallas
 * actuales (`variante="clasica"`, dentro de `ReservasDeMembresia`) y para la
 * ficha nueva (`variante="nuevo"`, dentro de su tarjeta). Quien la monta decide
 * si el plan permite sala externa; acá solo se muestra y se guarda.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarLugarExterno } from "@/app/(privado)/particulares/acciones";

const clases = {
  clasica: {
    control:
      "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base w-full",
    primario:
      "px-3 py-2 text-sm rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] font-medium hover:opacity-90 disabled:opacity-40",
    tenue:
      "px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40",
    error: "text-[var(--peligro)] mt-2",
    exito: "text-[var(--exito)] mt-2",
  },
  nuevo: {
    control: "n-buscar",
    primario: "n-boton n-boton--primario n-boton--chico",
    tenue: "n-boton n-boton--chico",
    error: "n-error",
    exito: "n-vacio",
  },
} as const;

export default function LugarExterno({
  membresiaId,
  nombre,
  puedeEditar,
  variante = "clasica",
}: {
  membresiaId: number;
  /** Nombre del lugar externo registrado, o `null` si todavía no tiene. */
  nombre: string | null;
  puedeEditar: boolean;
  variante?: "clasica" | "nuevo";
}) {
  const c = clases[variante];
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nombre ?? "");
  const [pendiente, startLugar] = useTransition();
  const [resultado, setResultado] = useState<{ error?: string; mensaje?: string } | null>(null);

  function guardar() {
    const limpio = texto.trim();
    if (!limpio) return setResultado({ error: "Cargá el nombre del lugar." });
    setResultado(null);
    startLugar(async () => {
      const r = await guardarLugarExterno(membresiaId, limpio);
      if (r.error) return setResultado({ error: r.error });
      setResultado({ mensaje: "Lugar guardado." });
      setEditando(false);
      router.refresh();
    });
  }

  return (
    <>
      {!editando ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm">{nombre ?? "Todavía no tiene un lugar externo registrado."}</span>
          {puedeEditar && (
            <button
              type="button"
              className={c.tenue}
              onClick={() => {
                setTexto(nombre ?? "");
                setEditando(true);
              }}
            >
              {nombre ? "Editar" : "Incluir"}
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap items-center">
          <input
            className={c.control}
            style={{ maxWidth: 360 }}
            placeholder='Ej. "Salón Conquistador — Hotel Los Tajibos"'
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <button type="button" className={c.primario} disabled={pendiente} onClick={guardar}>
            Guardar
          </button>
          <button type="button" className={c.tenue} disabled={pendiente} onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </div>
      )}
      {resultado?.error && (
        <p className={c.error} role="alert">
          {resultado.error}
        </p>
      )}
      {resultado?.mensaje && <p className={c.exito}>{resultado.mensaje}</p>}
    </>
  );
}
