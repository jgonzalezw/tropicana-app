"use client";

import Link from "next/link";
import { gs } from "@/lib/inscripcion";

export type ItemComprobante = {
  alumno: string;
  curso: string;
  cicloInicio: string | null;
  cicloFin: string | null;
  clasesPlan: number | null;
  clasesHechas: number | null;
  corrimientos: number;
  valorTotal: number;
  descuento: number;
  motivo: string;
  cobrado: number;
  pct: number;
  monto: number;
};

export type DatosComprobante = {
  id: number;
  profesor: string;
  whatsapp: string | null;
  periodo: string;
  periodicidad: string;
  estado: string;
  totalDevengado: number;
  totalPagado: number;
  neto: number;
  creadoEn: string;
  items: ItemComprobante[];
  pagos: { fecha: string; monto: number; medio: string; concepto: string }[];
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function periodoLargo(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MESES[Number(m[2]) - 1]} ${m[1]}`;
}

export default function Comprobante({ datos }: { datos: DatosComprobante }) {
  const neto = Math.max(0, datos.totalDevengado - datos.totalPagado);
  return (
    <div className="p-6 sm:p-10 max-w-3xl mx-auto">
      {/* Aísla la impresión: solo el documento, no el app shell. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #comprobante-doc, #comprobante-doc * { visibility: visible !important; }
          #comprobante-doc { position: absolute; left: 0; top: 0; width: 100%; margin: 0; }
        }
      `}</style>

      {/* Barra de acciones (no se imprime) */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Link href="/liquidaciones" className="text-[var(--primario)] text-base">
          ← Volver
        </Link>
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* Documento */}
      <div id="comprobante-doc" className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 sm:p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl titulo">Comprobante de liquidación</h1>
            <div className="text-sm text-[var(--texto-tenue)] mt-1">Tropicana · N° {datos.id}</div>
          </div>
          <div className="text-right text-sm text-[var(--texto-tenue)]">Emitido: {fechaCorta(new Date().toISOString())}</div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <div className="text-[var(--texto-tenue)]">Profesor</div>
            <div className="font-semibold text-base">{datos.profesor}</div>
            {datos.whatsapp && <div className="text-[var(--texto-tenue)]">{datos.whatsapp}</div>}
          </div>
          <div className="text-right">
            <div className="text-[var(--texto-tenue)]">Período liquidado</div>
            <div className="font-semibold text-base">{periodoLargo(datos.periodo)}</div>
            <div className="text-[var(--texto-tenue)] text-xs">({datos.periodicidad} vencido)</div>
          </div>
        </div>

        {/* Detalle por membresía */}
        <div className="text-sm text-[var(--texto-tenue)] mb-2">Detalle de comisiones</div>
        <div className="space-y-3 mb-4">
          {datos.items.map((it, i) => (
            <div key={i} className="border border-[var(--borde)] rounded-[var(--radio-chico)] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-semibold">{it.alumno}</div>
                <div className="text-sm text-[var(--texto-tenue)]">{it.curso}</div>
              </div>
              <div className="text-xs text-[var(--texto-tenue)] mt-0.5">
                Ciclo {fechaCorta(it.cicloInicio)} → {fechaCorta(it.cicloFin)} ·{" "}
                {it.clasesHechas ?? "—"}/{it.clasesPlan ?? "—"} clases · corrimientos: {it.corrimientos}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 mt-2 text-sm">
                <Cifra etiqueta="Valor total" valor={gs(it.valorTotal)} />
                <Cifra
                  etiqueta={`Descuento${it.motivo ? ` (${it.motivo})` : ""}`}
                  valor={it.descuento > 0 ? `− ${gs(it.descuento)}` : gs(0)}
                />
                <Cifra etiqueta="Cobrado" valor={gs(it.cobrado)} />
                <Cifra etiqueta={`Comisión (${it.pct}%)`} valor={gs(it.monto)} fuerte />
              </div>
            </div>
          ))}
          {datos.items.length === 0 && (
            <div className="text-[var(--texto-tenue)] text-sm">Sin ítems.</div>
          )}
        </div>

        <div className="flex justify-between items-baseline border-t border-[var(--borde)] pt-2 mb-4">
          <span className="text-sm text-[var(--texto-tenue)]">Total devengado</span>
          <span className="font-semibold text-lg">{gs(datos.totalDevengado)}</span>
        </div>

        {/* Pagos previos con concepto/fecha/monto */}
        {datos.pagos.length > 0 && (
          <div className="mb-4">
            <div className="text-sm text-[var(--texto-tenue)] mb-1">Pagos ya realizados</div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[var(--texto-tenue)] border-b border-[var(--borde)]">
                  <th className="py-1 font-medium">Concepto</th>
                  <th className="py-1 font-medium">Fecha</th>
                  <th className="py-1 font-medium">Medio</th>
                  <th className="py-1 font-medium text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {datos.pagos.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--borde)]">
                    <td className="py-1">{p.concepto}</td>
                    <td className="py-1">{fechaCorta(p.fecha)}</td>
                    <td className="py-1 text-[var(--texto-tenue)]">{p.medio}</td>
                    <td className="py-1 text-right">{gs(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totales */}
        <div className="border-t-2 border-[var(--borde)] pt-3 space-y-1">
          <Fila etiqueta="Total devengado" valor={gs(datos.totalDevengado)} />
          <Fila etiqueta="Total pagado" valor={gs(datos.totalPagado)} />
          <div className="flex justify-between items-baseline pt-2">
            <span className="titulo text-lg">Neto a pagar</span>
            <span className="titulo text-2xl">{gs(neto)}</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8 text-sm text-[var(--texto-tenue)]">
          <div className="border-t border-[var(--texto-tenue)] pt-2 text-center">Firma profesor</div>
          <div className="border-t border-[var(--texto-tenue)] pt-2 text-center">Firma academia</div>
        </div>
      </div>
    </div>
  );
}

function Cifra({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div>
      <div className="text-xs text-[var(--texto-tenue)]">{etiqueta}</div>
      <div className={fuerte ? "font-bold" : ""}>{valor}</div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--texto-tenue)]">{etiqueta}</span>
      <span>{valor}</span>
    </div>
  );
}
