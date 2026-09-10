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

        {/* El desglose de cómo se cubrió la deuda: chico, es el detalle. */}
        <div className="border-t border-[var(--borde)] pt-3 space-y-1">
          {datos.saldoAnterior != null && (
            <Fila etiqueta="Deuda antes de este movimiento" valor={gs(datos.saldoAnterior)} />
          )}
          {datos.descuento > 0 && (
            <>
              <Fila
                etiqueta={`Descuento${datos.descuentoMotivo ? ` (${datos.descuentoMotivo})` : ""}`}
                valor={`− ${gs(datos.descuento)}`}
              />
              <Fila etiqueta="Cubierto por este movimiento" valor={gs(total)} />
            </>
          )}
          {datos.medio && datos.monto > 0 && <Fila etiqueta="Medio de pago" valor={datos.medio} />}
        </div>

        {/* Lo destacado es la plata que se movió de verdad. Puede ser 0: un
            movimiento que se saldó solo con descuento no entra a la caja. */}
        <div className="flex justify-between items-baseline border-t-2 border-[var(--borde)] mt-3 pt-3">
          <span className="titulo text-lg">{entra ? "Total cobrado" : "Total pagado"}</span>
          <span className="titulo text-3xl tabular-nums">{gs(datos.monto)}</span>
        </div>
        {datos.monto === 0 && (
          <p className="text-sm text-[var(--texto-tenue)] mt-1">
            No entró dinero a la caja: la deuda se cubrió con el descuento.
          </p>
        )}

        {datos.saldoResultante != null && (
          <p className="text-base mt-3">
            {datos.saldoResultante > 0 ? (
              <span className="text-[var(--texto-tenue)]">
                Saldo pendiente{" "}
                <span className="tabular-nums font-semibold text-[var(--peligro)]">
                  {gs(datos.saldoResultante)}
                </span>
                {datos.fechaCompromiso
                  ? `, comprometido para el ${fechaCorta(datos.fechaCompromiso)}.`
                  : "."}
              </span>
            ) : (
              <span className="text-[var(--exito-texto)]">Cuenta saldada.</span>
            )}
          </p>
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
    d.descuento > 0
      ? fila(`Descuento${d.descuentoMotivo ? ` (${d.descuentoMotivo})` : ""}`, `- ${gs(d.descuento)}`)
      : "",
    d.descuento > 0 ? fila("Cubierto por este movimiento", gs(total)) : "",
    d.medio && d.monto > 0 ? fila("Medio de pago", d.medio) : "",
  ].join("");

  // Lo destacado es la plata que se movió de verdad, aunque sea 0.
  const totalCaja =
    `<div class="saldo"><span class="b">${
      entra ? "Total cobrado" : "Total pagado"
    }</span><span class="big">${gs(d.monto)}</span></div>` +
    (d.monto === 0
      ? `<div class="muted small">No entr&oacute; dinero a la caja: la deuda se cubri&oacute; con el descuento.</div>`
      : "");

  const saldo =
    d.saldoResultante == null
      ? ""
      : d.saldoResultante > 0
      ? `<div class="pendiente">Saldo pendiente <span class="b">${gs(d.saldoResultante)}</span>${
          d.fechaCompromiso ? `, comprometido para el ${fechaCorta(d.fechaCompromiso)}.` : "."
        }</div>`
      : `<div class="pendiente">Cuenta saldada.</div>`;

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
      .saldo .big { font-size: 24px; font-weight: 700; }
      .pendiente { margin-top: 8px; font-size: 12px; color: #444; }
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
      ${totalCaja}
      ${saldo}
      ${d.glosa ? `<div class="bloque" style="margin-top:16px"><div class="muted small">Detalle</div><div class="small">${esc(d.glosa)}</div></div>` : ""}
      <div class="pie">
        <div class="small">${d.registradoPor ? `Registrado por ${esc(d.registradoPor)}` : ""}</div>
        <div class="firma small">${entra ? "Recib&iacute; conforme" : "Firma de quien recibe"}</div>
      </div>
    </div></body></html>`;
}
