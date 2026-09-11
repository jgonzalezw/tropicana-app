"use client";

import { useState } from "react";
import type { Alumno } from "@/lib/tipos";
import ClienteInscribir, { type PlanVenta } from "./ClienteInscribir";
import VenderPrueba from "./VenderPrueba";

type Canal = { valor: string; etiqueta: string };
type Modo = "inscripcion" | "prueba";

/**
 * Las dos formas de vender un plan: la inscripción normal y la clase de
 * prueba. Comparten pantalla porque son el mismo mostrador y el mismo plan —
 * la prueba es la puerta de entrada al producto, no un producto aparte.
 *
 * Se separan en dos componentes en vez de un formulario con ramas: la
 * inscripción ya es larga, y las dos ventas piden cosas distintas (la prueba
 * no tiene días, ni bono, ni ciclo; tiene acompañantes y precio por curso).
 */
export default function ClienteVentas(props: {
  alumnos: Alumno[];
  planes: PlanVenta[];
  diasCompromiso: number;
  medios: string[];
  canales: Canal[];
  cursosPorAlumno: Record<number, string[]>;
  deudaPorAlumno: Record<number, number>;
  planesActivosPorAlumno: Record<number, number[]>;
  bonoPorAlumnoPlan: Record<number, Record<number, number>>;
}) {
  const [modo, setModo] = useState<Modo>("inscripcion");
  const hayPrueba = props.planes.some(
    (p) => p.aceptaPrueba && p.cursos.some((c) => (c.precioPrueba ?? 0) > 0)
  );

  return (
    <div>
      {hayPrueba && (
        <div className="px-6 sm:px-8 pt-6">
          <div className="flex gap-2 max-w-md">
            {(
              [
                ["inscripcion", "Inscripción"],
                ["prueba", "Clase de prueba"],
              ] as [Modo, string][]
            ).map(([m, etiqueta]) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={`flex-1 px-4 py-2.5 text-base rounded-[var(--radio-control)] border ${
                  modo === m
                    ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                    : "border-[var(--borde)] hover:border-[var(--primario)]"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
      )}

      {modo === "inscripcion" ? (
        <ClienteInscribir {...props} />
      ) : (
        <div className="p-6 sm:p-8 max-w-3xl">
          <VenderPrueba
            alumnos={props.alumnos}
            planes={props.planes}
            diasCompromiso={props.diasCompromiso}
            medios={props.medios}
            canales={props.canales}
          />
        </div>
      )}
    </div>
  );
}
