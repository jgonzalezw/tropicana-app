/**
 * El HTML impreso de la pre-liquidación (A4 vertical), como string: se abre en
 * una ventana aparte, sin app shell ni botones, igual que el comprobante de
 * liquidación. Papel blanco y tinta negra —única desviación del sistema de
 * diseño, a propósito— para que se lea en una impresora en blanco y negro.
 *
 * Sin DOM: se puede fijar con pruebas.
 */

import { gs } from "../inscripcion.ts";
import type { CasoExcepcion, ClaseSinRegistrar, InformePre } from "./preliquidacion.ts";
import {
  conSigno, fechaCorta, fechaHora, LEYENDA_PRE, LEYENDA_SIMULACION, nombrePeriodoPre, notaLiquidez,
  subtituloPre, tituloPre,
} from "./formatoPre.ts";
import { siglaCriterio, textoCriterio } from "./criterios.ts";

const esc = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Dónde se arregla cada caso, con el nombre de la pantalla (no un link: es papel). */
export function pantallaDe(c: CasoExcepcion): string {
  if (c.href === "/precios") return "Precios y paquetes";
  if (c.href === "/planes") return "Planes";
  if (c.href === "/profesores") return "Profesores y asignaciones";
  if (c.href === "/asistencia") return "Asistencia";
  if (c.href === "/caja") return "Caja";
  if (c.href === "/particulares") return "Particulares";
  if (c.href.startsWith("/alumnos/")) return "la cuenta del alumno";
  return c.href;
}

function filaClase(c: ClaseSinRegistrar, conTraba: boolean): string {
  return `<tr>
    <td class="b">${fechaCorta(c.fecha)}</td><td>${esc(c.curso)}</td>
    <td>${c.alumnosEsperados} ${c.alumnosEsperados === 1 ? "alumno esperado" : "alumnos esperados"}</td>
    <td class="b">${conTraba ? (c.traba ? "TRABA" : "NO TRABA") : ""}</td>
    <td>${esc(c.motivo)}</td></tr>`;
}

function bloqueClases(titulo: string, bajada: string, filas: ClaseSinRegistrar[], conTraba: boolean, vacio: string): string {
  const cursos = new Set(filas.map((f) => f.cursoId)).size;
  return `<div class="bloque"><h3>${esc(titulo)} <span class="muted">· ${filas.length} ${filas.length === 1 ? "clase" : "clases"}${
    filas.length ? ` · ${cursos} ${cursos === 1 ? "curso" : "cursos"}` : ""
  }</span></h3><p class="small muted">${esc(bajada)}</p>${
    filas.length
      ? `<table class="t"><tbody>${filas.map((f) => filaClase(f, conTraba)).join("")}</tbody></table>`
      : `<p class="small">${esc(vacio)}</p>`
  }</div>`;
}

export function construirHTMLPreliquidacion(i: InformePre, generadoEn: string): string {
  const periodo = nombrePeriodoPre(i);
  const titulo = tituloPre(i);
  const r = i.resumen;
  const pie = `Tropicana · ${titulo} · ${i.simulacion ? "Simulación, no es una liquidación" : "Informe preliminar, no es una liquidación"}`;

  const existentes = i.existentes.length
    ? `<div class="aviso"><b>Ya hay una liquidación generada para ${esc(periodo.toLowerCase())}.</b><br>${i.existentes
        .map((l) => `${esc(l.profesor)} · N° ${l.id} · ${esc(l.estado)} · ${gs(l.total)}`)
        .join("<br>")}<br><span class="small">Este informe no la incluye ni la modifica: muestra solo lo que todavía no se liquidó.</span></div>`
    : "";

  const indice = i.profesores.length
    ? `<table class="t"><thead><tr><th>Profesor</th><th class="r">Membresías</th><th class="r">Comisiones</th><th class="r">Reemplazos y ajustes</th><th class="r">Neto</th><th class="r">Hoja</th></tr></thead><tbody>${i.profesores
        .map(
          (p, n) =>
            `<tr><td>${esc(p.nombre)}</td><td class="r">${p.membresias}</td><td class="r">${gs(p.subtotal)}</td><td class="r">${conSigno(
              p.neto - p.subtotal
            )}</td><td class="r b">${gs(p.neto)}</td><td class="r">${n + 1}</td></tr>`
        )
        .join("")}<tr class="tot"><td>Total</td><td class="r">${r.membresiasQueEntran}</td><td class="r">${gs(r.comisiones)}</td><td class="r">${conSigno(
        r.extras
      )}</td><td class="r b">${gs(r.total)}</td><td></td></tr></tbody></table>`
    : `<p>Ningún profesor tiene devengo: no hay membresías completadas y cobradas al 100% con el ciclo cerrado dentro de ${esc(periodo.toLowerCase())}.</p>`;

  const hojas = i.profesores
    .map((p) => {
      const filas = p.lineas
        .map(
          (l) => `<tr>
        <td>${esc(l.alumno)}</td><td>${esc(l.curso)}</td><td>${esc(l.plan)}</td>
        <td title="${esc(textoCriterio(l.criterio))}">${siglaCriterio(l.criterio)}</td>
        <td>${fechaCorta(l.cicloInicio)}<br>${fechaCorta(l.cicloFin)}</td>
        <td class="r">${esc(l.clases)}</td><td class="r">${gs(l.cobrado)}</td>
        <td class="r">${gs(l.base)}${l.notaBase ? `<br><span class="small">${esc(l.notaBase)}</span>` : ""}</td>
        <td class="r">${l.pct == null ? "—" : `${l.pct}%`}</td><td class="r b">${gs(l.comision)}</td></tr>`
        )
        .join("");
      const extras = p.extras.length
        ? p.extras
            .map(
              (x) =>
                `<tr><td colspan="9"><b>${esc(x.titulo)}</b> · <span class="small">${esc(x.detalle)}</span></td><td class="r b">${conSigno(x.monto)}</td></tr>`
            )
            .join("")
        : `<tr><td colspan="10" class="small">Sin descuentos por reemplazo ni ajustes de períodos anteriores.</td></tr>`;
      return `<section class="hoja">
      <h2>${esc(p.nombre)}</h2>
      <p class="muted">${p.membresias} ${p.membresias === 1 ? "membresía" : "membresías"} · ${esc(p.cursos.join(", ") || "—")}</p>
      <table class="t g"><thead><tr><th>Alumno</th><th>Curso(s)</th><th>Plan</th><th>Crit.</th><th>Ciclo</th><th class="r">Clases</th><th class="r">Cobrado</th><th class="r">Base</th><th class="r">%</th><th class="r">Comisión</th></tr></thead>
      <tbody>${filas || `<tr><td colspan="10" class="small">Sin comisiones en este período.</td></tr>`}</tbody>
      <tfoot><tr class="tot"><td colspan="9">Comisiones · ${p.membresias} ${p.membresias === 1 ? "membresía" : "membresías"}</td><td class="r">${gs(p.subtotal)}</td></tr>
      ${extras}<tr class="tot"><td colspan="9">Neto a devengar</td><td class="r">${gs(p.neto)}</td></tr>${
        p.aPagar != null
          ? `<tr><td colspan="9">Saldo sin pagar de liquidaciones anteriores</td><td class="r">${gs(p.saldoPrevio ?? 0)}</td></tr><tr class="tot"><td colspan="9">A pagar al cierre</td><td class="r">${gs(p.aPagar)}</td></tr>`
          : ""
      }</tfoot></table>
      <p class="small muted">Criterios: C1 al completarse (período vencido) · C2 proporcional al avance · C3 al completarse, sin esperar el cierre.</p>
    </section>`;
    })
    .join("");

  const excepciones = i.excepciones
    .map(
      (m) => `<div class="bloque"><h3>${esc(m.titulo)} <span class="muted">· ${m.casos.length ? m.casos.length : "ninguna"}</span></h3>${
        m.casos.length
          ? `<table class="t"><tbody>${m.casos
              .map(
                (c) =>
                  `<tr><td class="b">${esc(c.persona)}${c.curso ? ` · ${esc(c.curso)}` : ""}</td><td>${esc(c.detalle)}</td><td class="small">${
                    c.accion === "Ver membresía" ? "Se mira en" : "Se resuelve en"
                  }: ${esc(pantallaDe(c))}</td></tr>`
              )
              .join("")}</tbody></table>`
          : `<p class="small">Ninguna en este período.</p>`
      }</div>`
    )
    .join("");

  const clases = [
    bloqueClases(
      "Vencidas con alumnos esperados",
      "Clases que ya pasaron, tenían alumnos y no tienen asistencia ni suspensión. Solo traba una membresía de 2 o más cursos: ahí el conteo reparte la plata.",
      i.clases.vencidas, true, "No hay clases vencidas sin registrar con alumnos esperados."
    ),
    bloqueClases("De hoy o futuras", "Aún no vencidas: se registran cuando se dicten.", i.clases.proximas, true, "No hay clases de hoy ni futuras pendientes."),
    bloqueClases(
      "Días de calendario sin alumnos",
      "Ningún alumno tenía clase ese día: la clase no existe para nadie y no obliga ni al profesor ni a la academia.",
      i.clases.sinAlumnos, false, "No hay días de calendario sin alumnos."
    ),
  ].join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
  @page { size: A4 portrait; margin: 14mm 14mm 16mm;
    @bottom-left { content: "${pie.replace(/"/g, "'")}"; font: 9px sans-serif; color: #444; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 9px sans-serif; color: #444; }
    @top-left { content: "${titulo.replace(/"/g, "'")}"; font: 9px sans-serif; color: #444; } }
  @page :first { @top-left { content: none; } }
  * { box-sizing: border-box; }
  body { font: 12px/1.4 "Figtree", system-ui, Arial, sans-serif; color: #111; background: #fff; margin: 0; }
  h1, h2, h3 { font-family: "Montserrat", system-ui, Arial, sans-serif; font-weight: 800; margin: 0 0 6px; }
  h1 { font-size: 24px; } h2 { font-size: 18px; } h3 { font-size: 13px; margin-top: 12px; }
  .muted { color: #444; } .small { font-size: 10.5px; } .b { font-weight: 700; } .r { text-align: right; }
  .caja { border: 2px solid #111; padding: 8px 10px; margin: 10px 0; font-weight: 700; }
  .aviso { border: 1.5px dashed #111; padding: 8px 10px; margin: 10px 0; }
  .cifras { display: flex; gap: 8px; margin: 12px 0; }
  .cifras > div { flex: 1; border: 1px solid #111; padding: 6px 8px; }
  .cifras .n { font-size: 17px; font-weight: 800; font-family: "Montserrat", Arial, sans-serif; }
  .t { width: 100%; border-collapse: collapse; margin: 6px 0; }
  .t th { text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1.5px solid #111; padding: 3px 4px; }
  .t td { border-top: 1px solid #bbb; padding: 4px; vertical-align: top; }
  .t.g { font-size: 10.5px; } .t th.r, .t td.r { text-align: right; }
  .t .tot td { border-top: 1.5px solid #111; font-weight: 800; }
  .hoja { break-before: page; } .bloque { break-inside: avoid; margin-bottom: 8px; } .seccion { break-before: page; }
  </style></head><body>
  <section>
    <p class="muted" style="margin:0">Liquidaciones</p>
    <h1>${esc(titulo)}</h1>
    <p class="muted">Generado el ${esc(fechaHora(generadoEn))} · ${subtituloPre(i)}</p>
    <div class="caja">${esc(i.simulacion ? LEYENDA_SIMULACION : LEYENDA_PRE)}</div>${
      i.simulacion
        ? `<div class="aviso"><b>Límites de la simulación</b><br>${i.simulacion.limites.map(esc).join("<br>")}</div>`
        : ""
    }
    ${existentes}
    <div class="cifras">
      <div><div class="small muted">Total a devengar</div><div class="n">${gs(r.total)}</div><div class="small muted">Comisiones ${gs(r.comisiones)} · reemplazos y ajustes ${conSigno(r.extras)}</div></div>
      <div><div class="small muted">Profesores con devengo</div><div class="n">${r.profesoresConDevengo}</div></div>
      <div><div class="small muted">Membresías que entran</div><div class="n">${r.membresiasQueEntran}</div></div>
      <div><div class="small muted">Membresías con excepción</div><div class="n">${r.membresiasConExcepcion}</div></div>
    </div>${
      i.liquidez
        ? `<div class="cifras"><div><div class="small muted">Liquidez a prever al ${esc(fechaCorta(i.hastaISO))}</div><div class="n">${gs(i.liquidez.total)}</div><div class="small muted">${esc(notaLiquidez(i.liquidez))}</div></div></div>`
        : ""
    }
    <h2>Profesores en este informe</h2>${indice}
    <p class="small muted">Las excepciones y las clases sin registrar están al final del informe.</p>
  </section>
  ${hojas}
  <section class="seccion"><h2>Excepciones</h2><p class="small muted">Lo que no entra en esta liquidación, y por qué.</p>${excepciones}</section>
  <section class="seccion"><h2>Clases sin registrar</h2>${clases}</section>
  </body></html>`;
}
