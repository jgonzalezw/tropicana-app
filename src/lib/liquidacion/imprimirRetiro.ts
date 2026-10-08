/**
 * El HTML impreso de la simulación del retiro de un profesor (A4 apaisado),
 * como string: se abre en una ventana aparte, sin app shell ni botones. Papel
 * blanco y tinta negra, igual que la pre-liquidación impresa: nunca una foto de
 * la pantalla.
 *
 * `incluirLiquidacion: false` esconde **solo** la liquidación del profesor que
 * se retira (líneas, totales y lo que habla de su plata) y deja las membresías
 * de sus cursos: es la hoja que se le da al profesor nuevo.
 *
 * Sin DOM: se puede fijar con pruebas.
 */

import { gs } from "../inscripcion.ts";
import { fechaCorta, fechaHora } from "./formatoPre.ts";
import { leyendaCriterios, siglaCriterio } from "./criterios.ts";
import {
  avanceEnDosLineas, cantidad, montoOGuion, textoBonoAplicado, textoBonoGenerado, textoCiclo, textoYaLiquidado,
} from "./formatoRetiro.ts";
import type { VistaRetiro } from "./retiro.ts";

const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const sub = (t: string, nw = false) => `<br><span class="small muted${nw ? " nw" : ""}">${esc(t)}</span>`;

/** Las cuatro celdas de la cuenta del alumno, iguales en toda tabla. */
const celdasCuenta = (c: { precio: number; descuento: number; pagado: number; saldo: number }) =>
  `<td class="r">${gs(c.precio)}</td><td class="r">${montoOGuion(c.descuento)}</td><td class="r">${gs(c.pagado)}</td><td class="r">${montoOGuion(c.saldo)}</td>`;

const leyenda = (criterios: (number | null)[]) => {
  const t = leyendaCriterios(criterios);
  return t ? `<p class="small muted">${esc(t)}</p>` : "";
};

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
    /** `false` = sin la liquidación del profesor que se retira (por defecto, con ella). */
    incluirLiquidacion?: boolean;
  }
): string {
  const final = !!ctx.confirmado;
  const conLiquidacion = ctx.incluirLiquidacion !== false;
  const titulo = !conLiquidacion
    ? `Membresías de los cursos de ${ctx.profesor} al ${fechaCorta(ctx.corte)}`
    : final
      ? `Liquidación por finalización de ${ctx.profesor}`
      : `Retiro de ${ctx.profesor}`;
  const t = v.totales;

  const regulares = v.regulares.length
    ? `<table class="t g"><thead>
        <tr class="grupo"><th></th><th colspan="4" class="c">Cuenta del alumno</th><th colspan="7" class="c">Liquidación</th></tr>
        <tr><th>Alumno</th><th class="r">Precio</th><th class="r">Desc.</th><th class="r">Pagado</th><th class="r">Saldo</th><th>Clases</th><th>Bono</th><th class="r">Base</th><th class="r">%</th><th class="r">A la fecha</th><th class="r">Ya liquidado</th><th class="r">Este cierre</th></tr>
      </thead><tbody>${v.regulares
        .map(
          (l) =>
            `<tr><td>${esc(l.alumno)}${sub(`${l.curso} · ${siglaCriterio(l.criterio)} · ${textoCiclo(l.inicio, l.fin)}`, true)}</td>${celdasCuenta(l.cuenta)}<td>${l.soloLiquidado ? "—" : `${l.clases}/${l.clasesDelCurso}`}</td><td>${textoBonoAplicado(l.bonoAplicado)}</td><td class="r">${gs(l.base)}</td><td class="r">${l.pct}%</td><td class="r">${gs(l.aLaFecha)}</td><td class="r">${textoYaLiquidado(l)}</td><td class="r b">${montoOGuion(l.monto)}</td></tr>`
        )
        .join("")}</tbody></table>${leyenda(v.regulares.map((l) => l.criterio))}`
    : `<p class="small">Nada que devengar por cursos regulares.</p>`;

  const particulares = v.particulares.length
    ? `<table class="t g"><thead>
        <tr class="grupo"><th></th><th colspan="4" class="c">Cuenta del alumno</th><th colspan="5" class="c">Liquidación</th></tr>
        <tr><th>Alumno</th><th class="r">Precio</th><th class="r">Desc.</th><th class="r">Pagado</th><th class="r">Saldo</th><th>Horas</th><th>Forma de pago</th><th class="r">A la fecha</th><th class="r">Ya liquidado</th><th class="r">Este cierre</th></tr>
      </thead><tbody>${v.particulares
        .map(
          (l) =>
            `<tr><td>${esc(l.alumno)}${sub(`Clase particular · ${siglaCriterio(l.criterio)} · ${textoCiclo(l.inicio, l.fin)}`, true)}</td>${celdasCuenta(l.cuenta)}<td class="nw">${cantidad(l.horasDadas)} de ${cantidad(l.horasContratadas)} h</td><td>${esc(l.forma.replace("_", " "))}</td><td class="r">${gs(l.aLaFecha)}</td><td class="r">${textoYaLiquidado(l)}</td><td class="r b">${montoOGuion(l.monto)}</td></tr>`
        )
        .join("")}</tbody></table>${leyenda(v.particulares.map((l) => l.criterio))}`
    : `<p class="small">Nada que devengar por clases particulares.</p>`;

  const inconclusas = v.inconclusas.length
    ? `<table class="t g"><thead>
        <tr class="grupo"><th colspan="5"></th><th colspan="2" class="c">Bono</th><th colspan="4" class="c">Cuenta del alumno</th></tr>
        <tr><th>Alumno</th><th>Tipo</th><th>Cursos / plan</th><th>Ciclo</th><th>Avance</th><th>Aplicado</th><th>Para renovar</th><th class="r">Precio</th><th class="r">Desc.</th><th class="r">Pagado</th><th class="r">Saldo</th></tr>
      </thead><tbody>${v.inconclusas
        .map(
          (m) =>
            `<tr><td>${esc(m.alumno)}</td><td>${m.tipo === "particular" ? "Particular" : "Regular"}</td><td>${esc(m.detalle)}${sub(
              m.plan && m.plan !== m.detalle ? `${m.plan} · ${siglaCriterio(m.criterio)}` : siglaCriterio(m.criterio)
            )}</td><td class="nw">${fechaCorta(m.inicio)}<br>${fechaCorta(m.fin)}</td><td>${esc(avanceEnDosLineas(m).principal)}${sub(avanceEnDosLineas(m).resto)}</td><td>${textoBonoAplicado(m.bonoAplicado)}</td><td>${esc(textoBonoGenerado(m))}</td><td class="r">${gs(m.cuenta.precio)}</td><td class="r">${montoOGuion(m.cuenta.descuento)}</td><td class="r">${gs(m.cuenta.pagado)}</td><td class="r nw">${montoOGuion(m.cuenta.saldo)}${m.cuenta.saldo > 0 ? sub("con saldo") : ""}</td></tr>`
        )
        .join("")}</tbody></table>${leyenda(v.inconclusas.map((m) => m.criterio))}`
    : `<p class="small">No quedan membresías sin terminar.</p>`;

  const lista = (items: string[]) => (items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");

  // Sin la liquidación, tampoco se habla de su cierre de cuentas.
  const acciones = v.acciones.filter((a) => conLiquidacion || a.clave !== "cierre");
  const avisos = conLiquidacion ? [...v.avisos, ...v.avisosLiquidacion] : v.avisos;

  const caja = ctx.confirmado
    ? conLiquidacion
      ? `Retiro confirmado el ${esc(fechaHora(ctx.confirmado.confirmadoEn))}. Las asignaciones quedaron cerradas el ${fechaCorta(ctx.corte)}, el profesor quedó inactivo y su cierre de cuentas quedó devengado${
          ctx.confirmado.liquidacionId != null ? ` en la liquidación N° ${ctx.confirmado.liquidacionId}` : ""
        }. El pago se hace en Caja.`
      : `Retiro confirmado el ${esc(fechaHora(ctx.confirmado.confirmadoEn))}. Las asignaciones quedaron cerradas el ${fechaCorta(ctx.corte)}.`
    : `Simulación: no se guardó nada. Ninguna asignación cambió ni se devengó nada.`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
  @page { size: A4 landscape; margin: 12mm 12mm 14mm;
    @bottom-left { content: "Tropicana · ${titulo.replace(/"/g, "'")} · ${final ? "Documento final" : "Simulación, no se guardó nada"}"; font: 9px sans-serif; color: #444; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 9px sans-serif; color: #444; } }
  * { box-sizing: border-box; }
  body { font: 12px/1.4 "Figtree", system-ui, Arial, sans-serif; color: #111; background: #fff; margin: 0; }
  h1, h2, h3 { font-family: "Montserrat", system-ui, Arial, sans-serif; font-weight: 800; margin: 0 0 6px; }
  h1 { font-size: 24px; } h2 { font-size: 16px; margin-top: 16px; } h3 { font-size: 13px; margin-top: 10px; }
  .nw { white-space: nowrap; } .muted { color: #444; } .small { font-size: 10.5px; } .b { font-weight: 700; } .r { text-align: right; } .c { text-align: center; }
  .caja { border: 2px solid #111; padding: 8px 10px; margin: 10px 0; font-weight: 700; }
  .aviso { border: 1.5px dashed #111; padding: 8px 10px; margin: 8px 0; }
  .t { width: 100%; border-collapse: collapse; margin: 6px 0; }
  .t th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1.5px solid #111; padding: 3px 4px; }
  .t tr.grupo th { border-bottom: 1px solid #888; font-size: 8.5px; color: #444; }
  .t td { border-top: 1px solid #bbb; padding: 4px; vertical-align: top; }
  .t.g { font-size: 10.5px; } .t th.r, .t td.r { text-align: right; } .t th.c { text-align: center; }
  .tot { width: 40%; margin-left: auto; border-collapse: collapse; }
  .tot td { padding: 3px 4px; } .tot td:last-child { text-align: right; }
  .tot .fin td { border-top: 1.5px solid #111; font-weight: 800; font-size: 14px; }
  section { break-inside: avoid; } ul { margin: 4px 0 4px 18px; padding: 0; }
  </style></head><body>
  <p class="muted" style="margin:0">${final && conLiquidacion ? "Liquidaciones" : "Profesores"}</p>
  <h1>${esc(titulo)}</h1>
  <p class="muted">Generado el ${esc(fechaHora(ctx.generadoEn))} · Último día a cargo de ${esc(ctx.profesor)}: ${fechaCorta(ctx.corte)}</p>
  <div class="caja">${caja}</div>
  ${
    !final && v.trabas.length
      ? `<div class="aviso"><b>Hay que resolver antes de confirmar</b>${lista(v.trabas.map((x) => x.texto))}</div>`
      : ""
  }
  <section><h2>${final ? "Qué se hizo al confirmar" : "Qué pasará al confirmar"}</h2>${lista(acciones.map((a) => a.texto))}</section>
  ${
    conLiquidacion
      ? `<section><h2>${final ? "Liquidación devengada" : "Liquidación final"}</h2>
    <h3>Cursos regulares</h3>${regulares}
    <h3>Clases particulares</h3>${particulares}
    <table class="tot">
      <tr><td>Cierre de cuentas (regulares)</td><td>${gs(t.regulares)}</td></tr>
      <tr><td>Cierre de cuentas (particulares)</td><td>${gs(t.particulares)}</td></tr>
      <tr><td class="b">Cierre que se devenga ahora</td><td class="b">${gs(t.cierre)}</td></tr>
      <tr><td>Saldo previo sin pagar${t.saldoDesglose.liquidaciones.length ? ` (N° ${t.saldoDesglose.liquidaciones.join(", ")})` : ""}</td><td>${gs(t.saldoPrevio)}</td></tr>
      <tr class="fin"><td>Total a pagarle</td><td>${gs(t.aPagar)}</td></tr>
    </table>
  </section>`
      : ""
  }
  <section><h2>Membresías activas que quedan inconclusas · ${v.inconclusas.length}</h2>
    <p class="small muted">Una línea por membresía. Siguen con el sustituto o sin titular, según lo elegido; lo que se cobre o dicte después se liquida como ajuste (regla 16).</p>
    ${inconclusas}
  </section>
  ${avisos.length ? `<section><h2>A tener en cuenta</h2>${lista(avisos)}</section>` : ""}
  </body></html>`;
}
