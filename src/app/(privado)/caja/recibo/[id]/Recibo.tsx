"use client";

import Link from "next/link";
import { gs } from "@/lib/inscripcion";
import { etiquetaMotivo } from "@/lib/caja";

export type DatosRecibo = {
  id: number;
  direccion: "ingreso" | "egreso";
  motivo: string | null;
  titular: string | null;
  whatsapp: string | null;
  servicio: string | null;
  curso: string | null;
  periodo: string | null;
  monto: number;
  descuento: number;
  descuentoMotivo: string | null;
  medio: string | null;
  glosa: string | null;
  fechaRegistro: string;
  fechaEfectiva: string | null;
  /** Solo si el movimiento se imputó a una cuota. */
  saldoAnterior: number | null;
  saldoResultante: number | null;
  fechaCompromiso: string | null;
  registradoPor: string | null;
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

function periodoLargo(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : iso;
}

/** El concepto en una línea: de qué fue este movimiento. */
function concepto(d: DatosRecibo): string {
  return [etiquetaMotivo(d.motivo ?? "otro"), d.servicio, d.curso].filter(Boolean).join(" · ");
}

export default function Recibo({ datos }: { datos: DatosRecibo }) {
  const entra = datos.direccion === "ingreso";
  const titulo = entra ? "Recibo de cobro" : "Recibo de pago";
  const quien = entra ? "Recibimos de" : "Pagamos a";
  const total = datos.monto + datos.descuento;
  // La fecha efectiva solo se muestra aparte cuando difiere del registro:
  // si coinciden, decirlo dos veces confunde más de lo que aclara.
  const fechaRegistroISO = datos.fechaRegistro.slice(0, 10);
  const huboRetroactivo = !!datos.fechaEfectiva && datos.fechaEfectiva !== fechaRegistroISO;

  function imprimir() {
    const win = window.open("", "_blank", "width=800,height=1000");
    if (!win) return;
    win.document.write(construirHTMLImpresion(datos));
    win.document.close();
    win.focus();
    win.onload = () => {
      win.print();
    };
    setTimeout(() => {
      try {
        win.print();
      } catch {
        /* noop */
      }
    }, 300);
  }

  return (
    <div className="p-6 sm:p-10 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <Link href="/caja" className="text-[var(--primario)] text-base">
          ← Volver a Caja
        </Link>
        <button
          onClick={imprimir}
          className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl titulo">{titulo}</h1>
            <div className="text-sm text-[var(--texto-tenue)] mt-1">Tropicana · N° {datos.id}</div>
          </div>
          <div className="text-right text-sm text-[var(--texto-tenue)]">
            <div>Fecha: {fechaCorta(datos.fechaEfectiva ?? datos.fechaRegistro)}</div>
            {huboRetroactivo && <div>Registrado el {fechaCorta(datos.fechaRegistro)}</div>}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-sm text-[var(--texto-tenue)]">{quien}</div>
          <div className="font-semibold text-lg">{datos.titular ?? "—"}</div>
          {datos.whatsapp && (
            <div className="text-sm text-[var(--texto-tenue)]">{datos.whatsapp}</div>
          )}
        </div>

        <div className="mb-6">
          <div className="text-sm text-[var(--texto-tenue)]">Concepto</div>
          <div className="text-base">{concepto(datos)}</div>
          {datos.periodo && (
            <div className="text-sm text-[var(--texto-tenue)]">
              Período {periodoLargo(datos.periodo)}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--borde)] pt-3 space-y-1">
          {datos.saldoAnterior != null && (
            <Fila etiqueta="Deuda antes de este movimiento" valor={gs(datos.saldoAnterior)} />
          )}
          <Fila etiqueta={entra ? "Monto cobrado" : "Monto pagado"} valor={gs(datos.monto)} />
          {datos.descuento > 0 && (
            <Fila
              etiqueta={`Descuento${datos.descuentoMotivo ? ` (${datos.descuentoMotivo})` : ""}`}
              valor={`− ${gs(datos.descuento)}`}
            />
          )}
          {datos.descuento > 0 && <Fila etiqueta="Total aplicado a la deuda" valor={gs(total)} />}
          {datos.medio && <Fila etiqueta="Medio de pago" valor={datos.medio} />}
        </div>

        {datos.saldoResultante != null && (
          <div className="flex justify-between items-baseline border-t-2 border-[var(--borde)] mt-3 pt-3">
            <span className="titulo text-lg">
              {datos.saldoResultante > 0 ? "Saldo pendiente" : "Saldo"}
            </span>
            <span className="titulo text-2xl">{gs(datos.saldoResultante)}</span>
          </div>
        )}

        {datos.saldoResultante != null && datos.saldoResultante > 0 && datos.fechaCompromiso && (
          <p className="text-sm text-[var(--texto-tenue)] mt-2">
            Comprometido para el {fechaCorta(datos.fechaCompromiso)}.
          </p>
        )}
        {datos.saldoResultante === 0 && (
          <p className="text-sm text-[var(--exito-texto)] mt-2">Cuenta saldada.</p>
        )}

        {datos.glosa && (
          <div className="mt-6">
            <div className="text-sm text-[var(--texto-tenue)]">Detalle</div>
            <p className="text-sm">{datos.glosa}</p>
          </div>
        )}

        <div className="mt-8 flex items-end justify-between gap-8 text-sm text-[var(--texto-tenue)]">
          <div>{datos.registradoPor ? `Registrado por ${datos.registradoPor}` : ""}</div>
          <div className="border-t border-[var(--texto-tenue)] pt-2 text-center min-w-[180px]">
            {entra ? "Recibí conforme" : "Firma de quien recibe"}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <span className="text-[var(--texto-tenue)]">{etiqueta}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

// ── Documento de impresión autónomo (sin app shell, una sola página) ──────

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function fila(etiqueta: string, valor: string): string {
  return `<div class="row"><span class="muted">${esc(etiqueta)}</span><span>${esc(valor)}</span></div>`;
}

function construirHTMLImpresion(d: DatosRecibo): string {
  const entra = d.direccion === "ingreso";
  const titulo = entra ? "Recibo de cobro" : "Recibo de pago";
  const total = d.monto + d.descuento;
  const fechaRegistroISO = d.fechaRegistro.slice(0, 10);
  const huboRetroactivo = !!d.fechaEfectiva && d.fechaEfectiva !== fechaRegistroISO;

  const cuenta = [
    d.saldoAnterior != null ? fila("Deuda antes de este movimiento", gs(d.saldoAnterior)) : "",
    fila(entra ? "Monto cobrado" : "Monto pagado", gs(d.monto)),
    d.descuento > 0
      ? fila(`Descuento${d.descuentoMotivo ? ` (${d.descuentoMotivo})` : ""}`, `- ${gs(d.descuento)}`)
      : "",
    d.descuento > 0 ? fila("Total aplicado a la deuda", gs(total)) : "",
    d.medio ? fila("Medio de pago", d.medio) : "",
  ].join("");

  const saldo =
    d.saldoResultante != null
      ? `<div class="saldo"><span class="b">${
          d.saldoResultante > 0 ? "Saldo pendiente" : "Saldo"
        }</span><span class="big">${gs(d.saldoResultante)}</span></div>` +
        (d.saldoResultante > 0 && d.fechaCompromiso
          ? `<div class="muted small">Comprometido para el ${fechaCorta(d.fechaCompromiso)}.</div>`
          : "") +
        (d.saldoResultante === 0 ? `<div class="muted small">Cuenta saldada.</div>` : "")
      : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>${titulo} N° ${d.id}</title>
    <style>
      @page { margin: 14mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { font: 13px/1.45 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111; }
      .doc { max-width: 620px; margin: 0 auto; padding: 18px; }
      h1 { font-size: 20px; margin: 0; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
      .muted { color: #666; }
      .small { font-size: 11px; }
      .b { font-weight: 700; }
      .r { text-align: right; }
      .bloque { margin-bottom: 16px; }
      .row { display: flex; justify-content: space-between; gap: 16px; padding: 3px 0; }
      .cuenta { border-top: 1px solid #ddd; padding-top: 8px; }
      .saldo { display: flex; justify-content: space-between; align-items: baseline;
               border-top: 2px solid #ccc; margin-top: 10px; padding-top: 10px; }
      .saldo .big { font-size: 22px; font-weight: 700; }
      .pie { display: flex; justify-content: space-between; align-items: flex-end;
             gap: 40px; margin-top: 48px; color: #666; }
      .firma { border-top: 1px solid #999; padding-top: 6px; text-align: center; min-width: 200px; }
    </style></head>
    <body><div class="doc">
      <div class="head">
        <div><h1>${titulo}</h1><div class="muted small">Tropicana &middot; N&deg; ${d.id}</div></div>
        <div class="r muted small">
          <div>Fecha: ${fechaCorta(d.fechaEfectiva ?? d.fechaRegistro)}</div>
          ${huboRetroactivo ? `<div>Registrado el ${fechaCorta(d.fechaRegistro)}</div>` : ""}
        </div>
      </div>
      <div class="bloque">
        <div class="muted small">${entra ? "Recibimos de" : "Pagamos a"}</div>
        <div class="b">${esc(d.titular ?? "—")}</div>
        ${d.whatsapp ? `<div class="muted small">${esc(d.whatsapp)}</div>` : ""}
      </div>
      <div class="bloque">
        <div class="muted small">Concepto</div>
        <div>${esc(concepto(d))}</div>
        ${d.periodo ? `<div class="muted small">Per&iacute;odo ${periodoLargo(d.periodo)}</div>` : ""}
      </div>
      <div class="cuenta">${cuenta}</div>
      ${saldo}
      ${d.glosa ? `<div class="bloque" style="margin-top:16px"><div class="muted small">Detalle</div><div class="small">${esc(d.glosa)}</div></div>` : ""}
      <div class="pie">
        <div class="small">${d.registradoPor ? `Registrado por ${esc(d.registradoPor)}` : ""}</div>
        <div class="firma small">${entra ? "Recib&iacute; conforme" : "Firma de quien recibe"}</div>
      </div>
    </div></body></html>`;
}
