/**
 * El HTML impreso de la simulación del retiro de un profesor (A4 vertical),
 * como string: se abre en una ventana aparte, sin app shell ni botones. Papel
 * blanco y tinta negra, igual que la pre-liquidación impresa: nunca una foto de
 * la pantalla.
 *
 * Sin DOM: se puede fijar con pruebas.
 */

import { gs } from "../inscripcion.ts";
import { fechaCorta, fechaHora } from "./formatoPre.ts";
import type { VistaRetiro } from "./retiro.ts";

const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const num = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

export function construirHTMLRetiro(
  v: VistaRetiro,
  ctx: {
    profesor: string;
    corte: string;
    generadoEn: string;
    /**
     * Presente = el retiro ya se confirmó: el mismo informe pasa a ser la
     * **liquidación por finalización**, con los datos finales al momento de
     * confirmar el cierre (los que calculó el servidor al escribir).
     */
    confirmado?: { liquidacionId: number | null; confirmadoEn: string };
  }
): string {
  const final = !!ctx.confirmado;
  const titulo = final ? `Liquidación por finalización de ${ctx.profesor}` : `Retiro de ${ctx.profesor}`;
  const t = v.totales;

  const regulares = v.regulares.length
    ? `<table class="t"><thead><tr><th>Alumno</th><th>Curso</th><th>Clases</th><th class="r">Base</th><th class="r">%</th><th class="r">Monto</th></tr></thead><tbody>${v.regulares
        .map(
          (l) =>
            `<tr><td>${esc(l.alumno)}</td><td>${esc(l.curso)}</td><td>${l.clases}/${l.clasesDelCurso}</td><td class="r">${gs(l.base)}</td><td class="r">${l.pct}%</td><td class="r b">${gs(l.monto)}</td></tr>`
        )
        .join("")}</tbody></table>`
    : `<p class="small">Nada que devengar por cursos regulares.</p>`;

  const particulares = v.particulares.length
    ? `<table class="t"><thead><tr><th>Alumno</th><th>Horas</th><th>Forma de pago</th><th class="r">Cobrado</th><th class="r">Monto</th></tr></thead><tbody>${v.particulares
        .map(
          (l) =>
            `<tr><td>${esc(l.alumno)}</td><td>${num(l.horasDadas)} de ${num(l.horasContratadas)} h</td><td>${esc(l.forma.replace("_", " "))}</td><td class="r">${gs(l.cobrado)}</td><td class="r b">${gs(l.monto)}</td></tr>`
        )
        .join("")}</tbody></table>`
    : `<p class="small">Nada que devengar por clases particulares.</p>`;

  const inconclusas = v.inconclusas.length
    ? `<table class="t g"><thead><tr><th>Alumno</th><th>Tipo</th><th>Cursos / plan</th><th>Inicio</th><th>Fin</th><th>Avance</th><th>Estado</th><th class="r">Saldo</th></tr></thead><tbody>${v.inconclusas
        .map((m) => {
          const avance =
            m.total == null
              ? `${num(m.hechas)} ${m.unidad} (ilimitado)`
              : `${num(m.hechas)} de ${num(m.total)} ${m.unidad} · faltan ${num(Math.max(0, m.total - m.hechas))}`;
          return `<tr><td>${esc(m.alumno)}</td><td>${m.tipo === "particular" ? "Particular" : "Regular"}</td><td>${esc(m.detalle)}${
            m.plan && m.plan !== m.detalle ? `<br><span class="small muted">${esc(m.plan)}</span>` : ""
          }</td><td>${fechaCorta(m.inicio)}</td><td>${fechaCorta(m.fin)}</td><td>${esc(avance)}</td><td>${esc(m.estado)}${
            m.saldo > 0 ? " · con saldo" : " · cobrada"
          }</td><td class="r">${m.saldo > 0 ? gs(m.saldo) : "—"}</td></tr>`;
        })
        .join("")}</tbody></table>`
    : `<p class="small">No quedan membresías sin terminar.</p>`;

  const lista = (items: string[]) => (items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
  @page { size: A4 portrait; margin: 14mm 14mm 16mm;
    @bottom-left { content: "Tropicana · ${titulo.replace(/"/g, "'")} · ${final ? "Documento final" : "Simulación, no se guardó nada"}"; font: 9px sans-serif; color: #444; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 9px sans-serif; color: #444; } }
  * { box-sizing: border-box; }
  body { font: 12px/1.4 "Figtree", system-ui, Arial, sans-serif; color: #111; background: #fff; margin: 0; }
  h1, h2, h3 { font-family: "Montserrat", system-ui, Arial, sans-serif; font-weight: 800; margin: 0 0 6px; }
  h1 { font-size: 24px; } h2 { font-size: 16px; margin-top: 16px; } h3 { font-size: 13px; margin-top: 10px; }
  .muted { color: #444; } .small { font-size: 10.5px; } .b { font-weight: 700; } .r { text-align: right; }
  .caja { border: 2px solid #111; padding: 8px 10px; margin: 10px 0; font-weight: 700; }
  .aviso { border: 1.5px dashed #111; padding: 8px 10px; margin: 8px 0; }
  .t { width: 100%; border-collapse: collapse; margin: 6px 0; }
  .t th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1.5px solid #111; padding: 3px 4px; }
  .t td { border-top: 1px solid #bbb; padding: 4px; vertical-align: top; }
  .t.g { font-size: 10.5px; } .t th.r, .t td.r { text-align: right; }
  .tot { width: 60%; margin-left: auto; border-collapse: collapse; }
  .tot td { padding: 3px 4px; } .tot td:last-child { text-align: right; }
  .tot .fin td { border-top: 1.5px solid #111; font-weight: 800; font-size: 14px; }
  section { break-inside: avoid; } ul { margin: 4px 0 4px 18px; padding: 0; }
  </style></head><body>
  <p class="muted" style="margin:0">${final ? "Liquidaciones" : "Profesores"}</p>
  <h1>${esc(titulo)}</h1>
  <p class="muted">Generado el ${esc(fechaHora(ctx.generadoEn))} · Último día a cargo: ${fechaCorta(ctx.corte)}</p>
  ${
    ctx.confirmado
      ? `<div class="caja">Retiro confirmado el ${esc(fechaHora(ctx.confirmado.confirmadoEn))}. Las asignaciones quedaron cerradas el ${fechaCorta(ctx.corte)}, el profesor quedó inactivo y su cierre de cuentas quedó devengado${
          ctx.confirmado.liquidacionId != null ? ` en la liquidación N° ${ctx.confirmado.liquidacionId}` : ""
        }. El pago se hace en Caja.</div>`
      : `<div class="caja">Simulación: no se guardó nada. Ninguna asignación cambió ni se devengó nada.</div>`
  }
  ${
    !final && v.trabas.length
      ? `<div class="aviso"><b>Hay que resolver antes de confirmar</b>${lista(v.trabas.map((x) => x.texto))}</div>`
      : ""
  }
  <section><h2>${final ? "Qué se hizo al confirmar" : "Qué pasará al confirmar"}</h2>${lista(v.acciones.map((a) => a.texto))}</section>
  <section><h2>${final ? "Liquidación devengada" : "Liquidación final"}</h2>
    <h3>Cursos regulares</h3>${regulares}
    <h3>Clases particulares</h3>${particulares}
    <table class="tot">
      <tr><td>Cierre de cuentas (regulares)</td><td>${gs(t.regulares)}</td></tr>
      <tr><td>Cierre de cuentas (particulares)</td><td>${gs(t.particulares)}</td></tr>
      <tr><td class="b">Cierre que se devenga ahora</td><td class="b">${gs(t.cierre)}</td></tr>
      <tr><td>Saldo previo sin pagar</td><td>${gs(t.saldoPrevio)}</td></tr>
      <tr class="fin"><td>Total a pagarle</td><td>${gs(t.aPagar)}</td></tr>
    </table>
  </section>
  <section><h2>Membresías que quedan inconclusas · ${v.inconclusas.length}</h2>
    <p class="small muted">Una línea por membresía. Siguen con el sustituto o sin titular, según lo elegido; lo que se cobre o dicte después se liquida como ajuste (regla 16).</p>
    ${inconclusas}
  </section>
  ${
    v.quedanAfuera.length
      ? `<section><h2>Quedan afuera del cierre</h2>${lista(v.quedanAfuera.map((x) => x.texto))}</section>`
      : ""
  }
  ${v.avisos.length ? `<section><h2>A tener en cuenta</h2>${lista(v.avisos)}</section>` : ""}
  </body></html>`;
}
