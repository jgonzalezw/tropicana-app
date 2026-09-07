"use client";

import Link from "next/link";
import { gs } from "@/lib/inscripcion";

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
  items: { descripcion: string; monto: number }[];
  pagos: { fecha: string; monto: number; medio: string }[];
};

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Comprobante({ datos }: { datos: DatosComprobante }) {
  const neto = Math.max(0, datos.totalDevengado - datos.totalPagado);
  return (
    <div className="p-6 sm:p-10 max-w-2xl mx-auto">
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
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 sm:p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl titulo">Comprobante de liquidación</h1>
            <div className="text-sm text-[var(--texto-tenue)] mt-1">Tropicana · N° {datos.id}</div>
          </div>
          <div className="text-right text-sm text-[var(--texto-tenue)]">
            Emitido: {fechaCorta(new Date().toISOString())}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <div className="text-[var(--texto-tenue)]">Profesor</div>
            <div className="font-semibold text-base">{datos.profesor}</div>
            {datos.whatsapp && <div className="text-[var(--texto-tenue)]">{datos.whatsapp}</div>}
          </div>
          <div className="text-right">
            <div className="text-[var(--texto-tenue)]">Período</div>
            <div className="font-semibold text-base">
              {datos.periodo} · {datos.periodicidad}
            </div>
          </div>
        </div>

        {/* Detalle de comisiones */}
        <table className="w-full text-left text-sm mb-4">
          <thead>
            <tr className="border-b border-[var(--borde)] text-[var(--texto-tenue)]">
              <th className="py-2 font-medium">Detalle</th>
              <th className="py-2 font-medium text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {datos.items.map((it, i) => (
              <tr key={i} className="border-b border-[var(--borde)]">
                <td className="py-2">{it.descripcion}</td>
                <td className="py-2 text-right">{gs(it.monto)}</td>
              </tr>
            ))}
            {datos.items.length === 0 && (
              <tr>
                <td colSpan={2} className="py-2 text-[var(--texto-tenue)]">
                  Sin ítems.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 text-right">Total devengado</td>
              <td className="py-2 text-right">{gs(datos.totalDevengado)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Pagos */}
        {datos.pagos.length > 0 && (
          <div className="mb-4">
            <div className="text-sm text-[var(--texto-tenue)] mb-1">Pagos realizados</div>
            <table className="w-full text-left text-sm">
              <tbody>
                {datos.pagos.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--borde)]">
                    <td className="py-2">{fechaCorta(p.fecha)}</td>
                    <td className="py-2 text-[var(--texto-tenue)]">{p.medio}</td>
                    <td className="py-2 text-right">{gs(p.monto)}</td>
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

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--texto-tenue)]">{etiqueta}</span>
      <span>{valor}</span>
    </div>
  );
}
