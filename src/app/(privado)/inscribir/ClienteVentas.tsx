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
  /** Claves `cursoId|YYYY-MM-DD` de clases suspendidas: no son clase. */
  suspendidas: string[];
  /** Crédito de una clase de prueba sin convertir, por alumno y plan. */
  creditoPruebaPorAlumnoPlan: Record<number, Record<number, number>>;
}) {
  const { suspendidas } = props;
  const [modo, setModo] = useState<Modo>("inscripcion");

  // Los planes que hoy se pueden vender a prueba: aceptan prueba Y alguno de
  // sus cursos tiene precio de prueba cargado (sin precio no hay qué cobrar).
  const vendibles = props.planes.filter(
    (p) => p.aceptaPrueba && p.cursos.some((c) => (c.precioPrueba ?? 0) > 0)
  );

  // La pestaña se muestra SIEMPRE. Antes se ocultaba cuando no había nada que
  // vender, y eso hacía que "todavía no configuré el precio" y "algo se
  // rompió" se vieran exactamente igual: una pantalla sin la pestaña. Es la
  // regla de calidad 1 aplicada a la interfaz — una capacidad del producto que
  // no está disponible lo dice y explica por qué, no desaparece.
  const faltantes = props.planes
    .filter((p) => p.aceptaPrueba)
    .map((p) => ({
      nombre: p.nombre,
      cursos: p.cursos.filter((c) => (c.precioPrueba ?? 0) <= 0).map((c) => c.nombre),
    }))
    .filter((p) => p.cursos.length > 0);

  return (
    <div>
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

      {modo === "inscripcion" ? (
        <ClienteInscribir {...props} />
      ) : vendibles.length > 0 ? (
        <div className="p-6 sm:p-8 max-w-3xl">
          <VenderPrueba
            alumnos={props.alumnos}
            planes={vendibles}
            diasCompromiso={props.diasCompromiso}
            medios={props.medios}
            canales={props.canales}
            suspendidas={suspendidas}
          />
        </div>
      ) : (
        <div className="p-6 sm:p-8 max-w-3xl">
          <h2 className="text-xl titulo mb-2">Todavía no hay nada que vender a prueba</h2>
          <p className="text-base text-[var(--texto-tenue)] mb-4">
            Para ofrecer una clase de prueba hacen falta las dos cosas: que el plan la
            acepte (en Planes) y que el curso tenga cargado su precio de prueba (en Cursos).
          </p>
          <div className="text-base bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-panel)] p-4">
            {props.planes.every((p) => !p.aceptaPrueba) ? (
              <p>Ningún plan activo tiene habilitada la clase de prueba.</p>
            ) : faltantes.length > 0 ? (
              <>
                <p className="mb-2">Falta el precio de prueba en estos cursos:</p>
                <ul className="list-disc pl-5">
                  {faltantes.map((p) => (
                    <li key={p.nombre}>
                      <span className="font-semibold">{p.nombre}</span>: {p.cursos.join(", ")}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                Hay planes con prueba habilitada, pero ninguno con cursos asociados. Revisá
                los cursos del plan en Planes.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
