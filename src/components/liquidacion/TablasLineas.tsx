"use client";

/**
 * Las tablas estándar de una liquidación (L-01 §5): regulares y particulares.
 * Las usan el retiro, la pre-liquidación, la simulación y Liquidaciones; el
 * flujo solo elige el rótulo del monto y si muestra «Ya liquidado» (calidad 10).
 */

import { gs } from "@/lib/inscripcion";
import type { LineaParticular, LineaRegular } from "@/lib/liquidacion/lineas";
import { leyendaCriterios, siglaCriterio } from "@/lib/liquidacion/criterios";
import {
  cantidad,
  montoOGuion,
  textoBonoAplicado,
  textoCiclo,
  textoYaLiquidado,
} from "@/lib/liquidacion/formatoLiquidacion";

export const TH = "py-2 pr-2 font-medium";
export const THR = `${TH} text-right`;
export const TD = "py-2 pr-2";
export const TDR = `${TD} text-right tabular-nums whitespace-nowrap`;

/** Las siglas que aparecen en una tabla, explicadas debajo. */
export function Leyenda({ criterios }: { criterios: (number | null)[] }) {
  const t = leyendaCriterios(criterios);
  return t ? <p className="mt-2 text-sm text-[var(--texto-tenue)]">{t}</p> : null;
}

type Opciones = {
  /** Rótulo de la última columna: «Este cierre», «Este período»… */
  etiquetaMonto?: string;
  /** Oculta «Ya liquidado» si el flujo no tiene nada liquidado antes. */
  conYaLiquidado?: boolean;
};

/** Alumno + (curso · criterio · ciclo) en dos líneas. */
function CeldaAlumno({
  alumno,
  detalle,
  criterio,
  inicio,
  fin,
}: {
  alumno: string;
  detalle: string;
  criterio: number | null;
  inicio: string | null;
  fin: string | null;
}) {
  return (
    <td className={TD}>
      {alumno}
      <div className="text-[11px] text-[var(--texto-tenue)] whitespace-nowrap">
        {detalle} · {siglaCriterio(criterio)} · {textoCiclo(inicio, fin)}
      </div>
    </td>
  );
}

function CuentaCeldas({ l }: { l: LineaRegular | LineaParticular }) {
  return (
    <>
      <td className={TDR}>{gs(l.cuenta.precio)}</td>
      <td className={TDR}>{montoOGuion(l.cuenta.descuento)}</td>
      <td className={TDR}>{gs(l.cuenta.pagado)}</td>
      <td className={TDR}>{montoOGuion(l.cuenta.saldo)}</td>
    </>
  );
}

export function TablaRegulares({
  lineas,
  etiquetaMonto = "Este cierre",
  conYaLiquidado = true,
}: { lineas: LineaRegular[] } & Opciones) {
  const cols = conYaLiquidado ? 7 : 6;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base">
        <thead>
          <tr className="text-center text-xs text-[var(--texto-tenue)]">
            <th />
            <th colSpan={4} className="font-medium">Cuenta del alumno</th>
            <th colSpan={cols} className="font-medium">Liquidación</th>
          </tr>
          <tr className="text-left text-sm text-[var(--texto-tenue)]">
            <th className={TH}>Alumno</th>
            <th className={THR}>Precio</th>
            <th className={THR}>Desc.</th>
            <th className={THR}>Pagado</th>
            <th className={THR}>Saldo</th>
            <th className={TH}>Clases</th>
            <th className={TH}>Bono</th>
            <th className={THR}>Base</th>
            <th className={THR}>%</th>
            <th className={THR}>A la fecha</th>
            {conYaLiquidado && <th className={THR}>Ya liquidado</th>}
            <th className="py-2 font-medium text-right">{etiquetaMonto}</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={`${l.membresiaId}-${l.curso}`} className="border-t border-[var(--borde)] align-top">
              <CeldaAlumno alumno={l.alumno} detalle={l.curso} criterio={l.criterio} inicio={l.inicio} fin={l.fin} />
              <CuentaCeldas l={l} />
              <td className={`${TD} tabular-nums`}>{l.soloLiquidado ? "—" : `${l.clases}/${l.clasesDelCurso}`}</td>
              <td className={`${TD} tabular-nums`}>{textoBonoAplicado(l.bonoAplicado)}</td>
              <td className={TDR}>{gs(l.base)}</td>
              <td className={TDR}>{l.pct}%</td>
              <td className={TDR}>{gs(l.aLaFecha)}</td>
              {conYaLiquidado && <td className={TDR}>{textoYaLiquidado(l)}</td>}
              <td className="py-2 text-right tabular-nums whitespace-nowrap font-semibold">{montoOGuion(l.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Leyenda criterios={lineas.map((l) => l.criterio)} />
    </div>
  );
}

export function TablaParticulares({
  lineas,
  etiquetaMonto = "Este cierre",
  conYaLiquidado = true,
}: { lineas: LineaParticular[] } & Opciones) {
  const cols = conYaLiquidado ? 5 : 4;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base">
        <thead>
          <tr className="text-center text-xs text-[var(--texto-tenue)]">
            <th />
            <th colSpan={4} className="font-medium">Cuenta del alumno</th>
            <th colSpan={cols} className="font-medium">Liquidación</th>
          </tr>
          <tr className="text-left text-sm text-[var(--texto-tenue)]">
            <th className={TH}>Alumno</th>
            <th className={THR}>Precio</th>
            <th className={THR}>Desc.</th>
            <th className={THR}>Pagado</th>
            <th className={THR}>Saldo</th>
            <th className={TH}>Horas</th>
            <th className={TH}>Forma de pago</th>
            <th className={THR}>A la fecha</th>
            {conYaLiquidado && <th className={THR}>Ya liquidado</th>}
            <th className="py-2 font-medium text-right">{etiquetaMonto}</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={l.membresiaId} className="border-t border-[var(--borde)] align-top">
              <CeldaAlumno alumno={l.alumno} detalle="Clase particular" criterio={l.criterio} inicio={l.inicio} fin={l.fin} />
              <CuentaCeldas l={l} />
              <td className={`${TD} tabular-nums whitespace-nowrap`}>
                {cantidad(l.horasDadas)} de {cantidad(l.horasContratadas)} h
              </td>
              <td className={TD}>{l.forma.replace("_", " ")}</td>
              <td className={TDR}>{gs(l.aLaFecha)}</td>
              {conYaLiquidado && <td className={TDR}>{textoYaLiquidado(l)}</td>}
              <td className="py-2 text-right tabular-nums whitespace-nowrap font-semibold">{montoOGuion(l.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Leyenda criterios={lineas.map((l) => l.criterio)} />
    </div>
  );
}
