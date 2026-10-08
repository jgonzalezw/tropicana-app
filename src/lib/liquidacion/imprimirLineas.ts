/**
 * Las tablas estándar de una liquidación, en HTML para imprimir (L-01 §5): las
 * mismas columnas, el mismo orden y los mismos textos que las de pantalla
 * (`components/liquidacion/TablasLineas.tsx`). Las usan el retiro y la
 * pre-liquidación; el flujo solo elige el rótulo del monto y si muestra «Ya
 * liquidado». Sin DOM: se puede fijar con pruebas.
 */

import { gs } from "../inscripcion.ts";
import { leyendaCriterios, siglaCriterio } from "./criterios.ts";
import {
  cantidad,
  montoOGuion,
  textoBonoAplicado,
  textoCiclo,
  textoReparto,
  textoYaLiquidado,
} from "./formatoLiquidacion.ts";
import type { LineaParticular, LineaRegular } from "./lineas.ts";

export const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const sub = (t: string, nw = false) => `<br><span class="small muted${nw ? " nw" : ""}">${esc(t)}</span>`;

/** Las cuatro celdas de la cuenta del alumno, iguales en toda tabla. */
export const celdasCuenta = (c: { precio: number; descuento: number; pagado: number; saldo: number }) =>
  `<td class="r">${gs(c.precio)}</td><td class="r">${montoOGuion(c.descuento)}</td><td class="r">${gs(c.pagado)}</td><td class="r">${montoOGuion(c.saldo)}</td>`;

export const leyenda = (criterios: (number | null)[]) => {
  const t = leyendaCriterios(criterios);
  return t ? `<p class="small muted">${esc(t)}</p>` : "";
};

type Opciones = { etiquetaMonto?: string; conYaLiquidado?: boolean };

/** Estilo de las tablas estándar (se pega en el `<style>` del documento). */
export const ESTILO_TABLAS = `
  .t { width: 100%; border-collapse: collapse; margin: 6px 0; }
  .t th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1.5px solid #111; padding: 3px 4px; }
  .t tr.grupo th { border-bottom: 1px solid #888; font-size: 8.5px; color: #444; }
  .t td { border-top: 1px solid #bbb; padding: 4px; vertical-align: top; }
  .t.g { font-size: 10.5px; } .t th.r, .t td.r { text-align: right; } .t th.c { text-align: center; }
  .nw { white-space: nowrap; } .muted { color: #444; } .small { font-size: 10.5px; } .b { font-weight: 700; } .r { text-align: right; } .c { text-align: center; }`;

export function tablaRegularesHTML(lineas: LineaRegular[], o: Opciones = {}): string {
  const etiqueta = o.etiquetaMonto ?? "Este cierre";
  const ya = o.conYaLiquidado !== false;
  return `<table class="t g"><thead>
        <tr class="grupo"><th></th><th colspan="4" class="c">Cuenta del alumno</th><th colspan="${ya ? 7 : 6}" class="c">Liquidación</th></tr>
        <tr><th>Alumno</th><th class="r">Precio</th><th class="r">Desc.</th><th class="r">Pagado</th><th class="r">Saldo</th><th>Clases</th><th>Bono</th><th class="r">Base</th><th class="r">%</th><th class="r">A la fecha</th>${ya ? '<th class="r">Ya liquidado</th>' : ""}<th class="r">${esc(etiqueta)}</th></tr>
      </thead><tbody>${lineas
        .map(
          (l) =>
            `<tr><td>${esc(l.alumno)}${sub(`${l.curso} · ${siglaCriterio(l.criterio)} · ${textoCiclo(l.inicio, l.fin)}`, true)}</td>${celdasCuenta(l.cuenta)}<td>${l.soloLiquidado ? "—" : `${l.clases}/${l.clasesDelCurso}`}</td><td>${textoBonoAplicado(l.bonoAplicado)}</td><td class="r">${gs(l.base)}${l.reparto ? sub(textoReparto(l), true) : ""}</td><td class="r">${l.pct}%</td><td class="r">${gs(l.aLaFecha)}</td>${ya ? `<td class="r">${textoYaLiquidado(l)}</td>` : ""}<td class="r b">${montoOGuion(l.monto)}</td></tr>`
        )
        .join("")}</tbody></table>${leyenda(lineas.map((l) => l.criterio))}`;
}

export function tablaParticularesHTML(lineas: LineaParticular[], o: Opciones = {}): string {
  const etiqueta = o.etiquetaMonto ?? "Este cierre";
  const ya = o.conYaLiquidado !== false;
  return `<table class="t g"><thead>
        <tr class="grupo"><th></th><th colspan="4" class="c">Cuenta del alumno</th><th colspan="${ya ? 5 : 4}" class="c">Liquidación</th></tr>
        <tr><th>Alumno</th><th class="r">Precio</th><th class="r">Desc.</th><th class="r">Pagado</th><th class="r">Saldo</th><th>Horas</th><th>Forma de pago</th><th class="r">A la fecha</th>${ya ? '<th class="r">Ya liquidado</th>' : ""}<th class="r">${esc(etiqueta)}</th></tr>
      </thead><tbody>${lineas
        .map(
          (l) =>
            `<tr><td>${esc(l.alumno)}${sub(`Clase particular · ${siglaCriterio(l.criterio)} · ${textoCiclo(l.inicio, l.fin)}`, true)}</td>${celdasCuenta(l.cuenta)}<td class="nw">${cantidad(l.horasDadas)} de ${cantidad(l.horasContratadas)} h</td><td>${esc(l.forma.replace("_", " "))}</td><td class="r">${gs(l.aLaFecha)}</td>${ya ? `<td class="r">${textoYaLiquidado(l)}</td>` : ""}<td class="r b">${montoOGuion(l.monto)}</td></tr>`
        )
        .join("")}</tbody></table>${leyenda(lineas.map((l) => l.criterio))}`;
}
