"use client";

import { gs, rotuloDiasMembresia } from "@/lib/inscripcion";
import { formatearHoras } from "@/lib/horarios";
import { ETIQUETA_ESTADO_RESERVA, type EstadoReserva } from "@/lib/reservas";
import type { EstadoCuenta, MembresiaCuenta } from "@/lib/tipos";

/**
 * El estado de cuenta como documento para dar o mandar. Mismo camino que el
 * comprobante de liquidación y el recibo de caja: una ventana nueva con un
 * documento autónomo, sin el shell de la app, y la impresión disparada ahí.
 */
export default function ImprimirCuenta({ datos }: { datos: EstadoCuenta }) {
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
    <button
      onClick={imprimir}
      className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]"
    >
      Imprimir / Guardar PDF
    </button>
  );
}

// ── Documento de impresión autónomo ──────────────────────────────────────

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
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : iso;
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

const h = (min: number) => formatearHoras(min / 60);

/** Consumo y faltas de una membresía, en una línea. */
function resumenMembresia(m: MembresiaCuenta): string {
  const partes: string[] = [];
  partes.push(
    m.horas
      ? `${h(m.horas.disponibleMin)} h de ${h(m.horas.contratadasMin)} h disponibles`
      : m.progreso
      ? `${m.progreso.hechas}/${m.progreso.total} clases`
      : m.restantes != null
      ? `${m.restantes} ${m.restantes === 1 ? "clase" : "clases"} por usar`
      : "Sin límite de clases"
  );
  if (m.faltasSinLicencia > 0) partes.push(`${m.faltasSinLicencia} falta(s) sin licencia`);
  if (m.faltasConLicencia > 0) partes.push(`${m.faltasConLicencia} falta(s) con licencia`);
  if (m.bono > 0) partes.push(`${m.bono} de bono de tolerancia por usar`);
  if (m.bono > 0 && m.renovacionBonificada)
    partes.push(`renovar hasta el ${fechaCorta(m.renovacionBonificada)} para no perderlo`);
  return partes.join(" · ");
}

function construirHTMLImpresion(d: EstadoCuenta): string {
  const emitido = fechaCorta(new Date().toISOString());
  const totalPagado = d.pagos.reduce((t, p) => t + p.monto, 0);

  const bloques = d.membresias
    .map((m) => {
      const filas = m.cuotas
        .map(
          (c) => `<tr>
            <td>${periodoLargo(c.periodo)}</td>
            <td>${fechaCorta(c.fechaCompromiso ?? c.vencimiento)}</td>
            <td class="r">${gs(c.devengado)}</td>
            <td class="r">${gs(c.cubierto)}</td>
            <td class="r ${c.saldo > 0 ? "b" : "muted"}">${gs(c.saldo)}</td>
          </tr>`
        )
        .join("");
      const cursosTexto = m.cursos.length
        ? m.cursos
            .map((c) =>
              rotuloDiasMembresia(c.dias) ? `${c.nombre} (${rotuloDiasMembresia(c.dias)})` : c.nombre
            )
            .join(" · ")
        : (m.estiloProfesor ?? "Curso sin determinar");
      const finTexto = m.fechaFin
        ? `${fechaCorta(m.fechaFin)}${m.fechaFinEstimada ? " (estimado)" : ""}`
        : "—";
      // Particular/alquiler: cada reserva, una por una — incluida una
      // Suspendida por un cierre de sala (H4).
      const reservasTexto =
        m.reservas && m.reservas.length
          ? `<div class="small muted">${m.reservas
              .map(
                (r) =>
                  `${esc(fechaCorta(r.fecha))} ${esc(r.hora.slice(0, 5))} (${h(r.duracionMin)} h${
                    r.salaNombre ? ` · ${esc(r.salaNombre)}` : ""
                  }) — ${esc(ETIQUETA_ESTADO_RESERVA[r.estado as EstadoReserva] ?? r.estado)}`
              )
              .join("<br>")}</div>`
          : "";
      return `
        <div class="item">
          <div class="item-top">
            <span class="b">${esc(m.plan ?? m.cursos[0]?.nombre ?? "Membresía")}</span>
            <span class="muted small">${esc(m.estado)}</span>
          </div>
          <div class="small muted">${esc(cursosTexto)}</div>
          <div class="small muted">${esc(fechaCorta(m.fechaInicio))} &rarr; ${esc(finTexto)}</div>
          <div class="small muted">${esc(resumenMembresia(m))}</div>
          ${reservasTexto}
          ${
            filas
              ? `<table>
                  <thead><tr>
                    <th>Cuota</th><th>Vence</th>
                    <th class="r">Vale</th><th class="r">Cubierto</th><th class="r">Saldo</th>
                  </tr></thead>
                  <tbody>${filas}</tbody>
                </table>`
              : `<div class="small muted">Sin cuotas.</div>`
          }
        </div>`;
    })
    .join("");

  const filasPagos = d.pagos.length
    ? `<table>
        <thead><tr>
          <th>Fecha</th><th>Concepto</th><th>Membresía</th><th>Medio</th>
          <th class="r">Descuento</th><th class="r">Monto</th>
        </tr></thead>
        <tbody>${d.pagos
          .map(
            (p) => `<tr>
              <td>${fechaCorta(p.fecha)}</td>
              <td>${esc(p.concepto ?? "Pago")}</td>
              <td class="muted">${
                p.membresiaPlan
                  ? esc(`${p.membresiaPlan}${p.membresiaFechaInicio ? ` (desde ${fechaCorta(p.membresiaFechaInicio)})` : ""}`)
                  : "—"
              }</td>
              <td class="muted">${esc(p.monto > 0 ? p.medio ?? "—" : "—")}</td>
              <td class="r">${p.descuento > 0 ? `- ${gs(p.descuento)}` : gs(0)}</td>
              <td class="r">${gs(p.monto)}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table>`
    : `<div class="small muted">Todavía no registró ningún pago.</div>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <title>Estado de cuenta - ${esc(d.alumno.apellido)}, ${esc(d.alumno.nombre)}</title>
    <style>
      @page { margin: 14mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { font: 13px/1.45 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111; }
      .doc { max-width: 720px; margin: 0 auto; padding: 18px; }
      h1 { font-size: 20px; margin: 0; }
      h2 { font-size: 14px; margin: 18px 0 6px; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
      .muted { color: #666; }
      .small { font-size: 11px; }
      .b { font-weight: 700; }
      .r { text-align: right; }
      .deuda { display: flex; justify-content: space-between; align-items: baseline;
               border-top: 2px solid #ccc; border-bottom: 2px solid #ccc;
               padding: 10px 0; margin-bottom: 6px; }
      .deuda .big { font-size: 24px; font-weight: 700; }
      .item { border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
      .item-top { display: flex; justify-content: space-between; gap: 8px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
      th, td { text-align: left; padding: 4px 0; border-bottom: 1px solid #eee; }
      th { color: #666; font-weight: 600; }
      .tot { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 8px;
             border-top: 1px solid #ccc; }
    </style></head>
    <body><div class="doc">
      <div class="head">
        <div>
          <h1>Estado de cuenta</h1>
          <div class="muted small">Tropicana</div>
        </div>
        <div class="r muted small"><div>Emitido: ${emitido}</div></div>
      </div>

      <div class="b" style="font-size:15px">${esc(d.alumno.apellido)}, ${esc(d.alumno.nombre)}</div>

      <div class="deuda">
        <span class="b">Deuda total</span>
        <span class="big">${gs(d.deuda)}</span>
      </div>
      ${d.deuda === 0 ? '<div class="muted small">Est&aacute; al d&iacute;a.</div>' : ""}

      <h2>Membres&iacute;as</h2>
      ${bloques || '<div class="small muted">Todav&iacute;a no compr&oacute; ninguna.</div>'}

      <h2>Pagos</h2>
      ${filasPagos}
      <div class="tot"><span class="muted">Total pagado</span><span class="b">${gs(totalPagado)}</span></div>
    </div></body></html>`;
}
