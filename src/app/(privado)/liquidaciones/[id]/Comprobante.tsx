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
  faltasConLic: number;
  faltasSinLic: number;
  corrSuspension: number;
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

/** Resumen de faltas y corrimientos de una linea, lo mas corto posible. */
function detalleFaltas(it: ItemComprobante): string {
  const partes: string[] = [];
  if (it.faltasSinLic > 0)
    partes.push(`${it.faltasSinLic} falta${it.faltasSinLic === 1 ? "" : "s"} sin licencia`);
  if (it.faltasConLic > 0)
    partes.push(
      `${it.faltasConLic} falta${it.faltasConLic === 1 ? "" : "s"} con licencia = ${it.faltasConLic} ` +
        `clase${it.faltasConLic === 1 ? "" : "s"} bono de tolerancia`
    );
  if (it.corrSuspension > 0)
    partes.push(`${it.corrSuspension} corrimiento${it.corrSuspension === 1 ? "" : "s"} por suspensión`);
  return partes.join(" · ");
}

export default function Comprobante({ datos }: { datos: DatosComprobante }) {
  const neto = Math.max(0, datos.totalDevengado - datos.totalPagado);

  // Imprime SOLO el recibo: abre una ventana nueva con un documento limpio
  // (sin app shell) y dispara la impresion. Evita la pagina en blanco que
  // dejaba el truco de visibility sobre el shell.
  function imprimir() {
    const win = window.open("", "_blank", "width=800,height=1000");
    if (!win) return;
    win.document.write(construirHTMLImpresion(datos));
    win.document.close();
    win.focus();
    // Espera al render antes de imprimir.
    win.onload = () => {
      win.print();
    };
    // Fallback por si onload ya paso.
    setTimeout(() => {
      try {
        win.print();
      } catch {
        /* noop */
      }
    }, 300);
  }

  return (
    <div className="p-6 sm:p-10 max-w-3xl mx-auto">
      {/* Barra de acciones */}
      <div className="flex justify-between items-center mb-6">
        <Link href="/liquidaciones" className="text-[var(--primario)] text-base">
          ← Volver
        </Link>
        <button
          onClick={imprimir}
          className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* Documento (vista en pantalla) */}
      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 sm:p-8">
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
          {datos.items.map((it, i) => {
            const faltas = detalleFaltas(it);
            return (
              <div key={i} className="border border-[var(--borde)] rounded-[var(--radio-chico)] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold">{it.alumno}</div>
                  <div className="text-sm text-[var(--texto-tenue)]">{it.curso}</div>
                </div>
                <div className="text-xs text-[var(--texto-tenue)] mt-0.5">
                  Ciclo {fechaCorta(it.cicloInicio)} → {fechaCorta(it.cicloFin)} ·{" "}
                  {it.clasesHechas ?? "—"}/{it.clasesPlan ?? "—"} clases
                  {faltas ? ` · ${faltas}` : ""}
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
            );
          })}
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

// ── Documento de impresión autónomo (sin app shell, una sola página) ──────

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function construirHTMLImpresion(d: DatosComprobante): string {
  const emitido = fechaCorta(new Date().toISOString());
  const filasItems = d.items
    .map((it) => {
      const faltas = detalleFaltas(it);
      const desc = it.descuento > 0 ? `− ${gs(it.descuento)}` : gs(0);
      const descEtq = `Descuento${it.motivo ? ` (${esc(it.motivo)})` : ""}`;
      return `
        <div class="item">
          <div class="item-top">
            <span class="b">${esc(it.alumno)}</span>
            <span class="muted">${esc(it.curso)}</span>
          </div>
          <div class="small muted">
            Ciclo ${fechaCorta(it.cicloInicio)} &rarr; ${fechaCorta(it.cicloFin)} ·
            ${it.clasesHechas ?? "—"}/${it.clasesPlan ?? "—"} clases${faltas ? ` · ${esc(faltas)}` : ""}
          </div>
          <div class="grid">
            <div><div class="k">Valor total</div><div>${gs(it.valorTotal)}</div></div>
            <div><div class="k">${descEtq}</div><div>${desc}</div></div>
            <div><div class="k">Cobrado</div><div>${gs(it.cobrado)}</div></div>
            <div><div class="k">Comisión (${it.pct}%)</div><div class="b">${gs(it.monto)}</div></div>
          </div>
        </div>`;
    })
    .join("");

  const filasPagos = d.pagos.length
    ? `
      <div class="muted small mt8">Pagos ya realizados</div>
      <table>
        <thead><tr><th>Concepto</th><th>Fecha</th><th>Medio</th><th class="r">Monto</th></tr></thead>
        <tbody>
          ${d.pagos
            .map(
              (p) =>
                `<tr><td>${esc(p.concepto)}</td><td>${fechaCorta(p.fecha)}</td><td class="muted">${esc(
                  p.medio
                )}</td><td class="r">${gs(p.monto)}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>`
    : "";

  const neto = Math.max(0, d.totalDevengado - d.totalPagado);

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Comprobante de liquidación N° ${d.id}</title>
    <style>
      @page { margin: 14mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { font: 13px/1.45 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111; }
      .doc { max-width: 720px; margin: 0 auto; padding: 18px; }
      h1 { font-size: 20px; margin: 0; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
      .meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
      .muted { color: #666; }
      .small { font-size: 11px; }
      .b { font-weight: 700; }
      .r { text-align: right; }
      .mt8 { margin-top: 12px; }
      .item { border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
      .item-top { display: flex; justify-content: space-between; gap: 8px; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 12px; margin-top: 8px; font-size: 12px; }
      .k { font-size: 10px; color: #666; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
      th, td { text-align: left; padding: 4px 0; border-bottom: 1px solid #eee; }
      th { color: #666; font-weight: 600; }
      .tot { border-top: 2px solid #ccc; margin-top: 14px; padding-top: 10px; }
      .tot .row { display: flex; justify-content: space-between; }
      .neto { display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px; }
      .neto .big { font-size: 22px; font-weight: 700; }
      .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 44px; color: #666; }
      .firmas div { border-top: 1px solid #999; padding-top: 6px; text-align: center; }
    </style></head>
    <body><div class="doc">
      <div class="head">
        <div><h1>Comprobante de liquidación</h1><div class="muted small">Tropicana · N° ${d.id}</div></div>
        <div class="muted small">Emitido: ${emitido}</div>
      </div>
      <div class="meta">
        <div>
          <div class="muted small">Profesor</div>
          <div class="b">${esc(d.profesor)}</div>
          ${d.whatsapp ? `<div class="muted small">${esc(d.whatsapp)}</div>` : ""}
        </div>
        <div class="r">
          <div class="muted small">Período liquidado</div>
          <div class="b">${periodoLargo(d.periodo)}</div>
          <div class="muted small">(${esc(d.periodicidad)} vencido)</div>
        </div>
      </div>
      <div class="muted small">Detalle de comisiones</div>
      ${filasItems || '<div class="muted small">Sin ítems.</div>'}
      <div class="tot">
        <div class="row"><span class="muted">Total devengado</span><span>${gs(d.totalDevengado)}</span></div>
        ${filasPagos}
        <div class="row mt8"><span class="muted">Total pagado</span><span>${gs(d.totalPagado)}</span></div>
        <div class="neto"><span class="b">Neto a pagar</span><span class="big">${gs(neto)}</span></div>
      </div>
      <div class="firmas"><div>Firma profesor</div><div>Firma academia</div></div>
    </div></body></html>`;
}
