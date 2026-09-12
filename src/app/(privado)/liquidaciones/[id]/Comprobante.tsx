"use client";

import { useState } from "react";
import Link from "next/link";
import { gs } from "@/lib/inscripcion";

export type ItemComprobante = {
  alumno: string;
  curso: string;
  plan: string;
  tipoServicio: string;
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
  /** Parte de lo cobrado que le tocó a ESTE curso (prorrata). */
  parte: number;
  /** Es una clase de prueba, no un ciclo regular. */
  esPrueba: boolean;
  /** Personas cubiertas: 1, salvo prueba grupal. */
  personas: number;
  /** Reparto entre los cursos del plan. Vacío = un solo curso, nada que repartir. */
  reparto: {
    cursoId: number; curso: string; clases: number; precioClase: number;
    /** Número intermedio (clases × valor de clase). No se muestra: no es plata. */
    peso: number;
    /** La plata de este curso. Las partes suman lo cobrado. */
    parte?: number;
    /** Presente solo si el curso lo dictó más de un profesor (0029). */
    profesores?: { profesorId: number; profesor: string; clases: number; parte: number }[];
    /** Clases que ese día no tenían titular: las dio un suplente (regla 19). */
    sinAsignar?: number;
  }[];
  pesoTotal: number;
  pesoCurso: number;
  clasesCurso: number | null;
  /** El curso de esta comisión: identifica su línea en el reparto. */
  cursoId: number | null;
  /** El profesor de esta comisión: identifica su sub-línea si el curso se repartió. */
  profesorId: number;
};

/**
 * Qué se cuenta como "clase" del ciclo. Va escrito en el comprobante porque es
 * la pregunta que se hace el profesor al mirar el número, y la respuesta no se
 * deduce de la tabla: son las del calendario, menos las suspendidas (regla de
 * negocio 10). Una falta no descuenta — la clase ocurrió.
 */
const LEYENDA_CLASES =
  "Clases = las del calendario del ciclo, menos las suspendidas.";

/** El reparto, para el papel. Mismo criterio que en pantalla, otro formato. */
function repartoHTML(it: ItemComprobante, modo: "completo" | "compacto"): string {
  const esc2 = (t: string) => t.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m]!);
  if (modo === "compacto") {
    const linea = it.reparto
      .map(
        (r) =>
          `${esc2(r.curso)} ${r.peso === 0 ? "no dictó" : gs(parteDe(it, r))}` +
          (r.profesores?.length
            ? ` (${r.profesores.map((pr) => `${esc2(pr.profesor)} ${pr.clases}`).join(" / ")})`
            : "")
      )
      .join(" · ");
    return `<div class="small muted">Reparto: ${linea} (suman ${gs(it.cobrado)})</div>`;
  }
  const encabezado = `<tr class="muted">
      <th style="text-align:left">Curso</th>
      <th style="text-align:right">Clases</th>
      <th style="text-align:right">Valor de 1 clase</th>
      <th style="text-align:right">Le toca</th>
      <th style="text-align:right">%</th>
      <th></th></tr>`;
  const filas = it.reparto
    .map((r) => {
      const esEste = r.cursoId === it.cursoId;
      const pct = it.pesoTotal > 0 ? Math.round((r.peso / it.pesoTotal) * 100) : 0;
      const sub = (r.profesores ?? [])
        .map(
          (pr) => `<tr class="muted"><td style="padding-left:10px">&mdash; ${esc2(pr.profesor)}</td>
            <td style="text-align:right">${pr.clases}</td><td></td>
            <td style="text-align:right">${gs(pr.parte)}</td><td></td>
            <td style="text-align:right">${pr.profesorId === it.profesorId ? "usted" : ""}</td></tr>`
        )
        .join("");
      const supl = (r.sinAsignar ?? 0) > 0 && r.cursoId === it.cursoId
        ? `<tr class="muted"><td style="padding-left:10px"><i>&mdash; dictadas con reemplazo</i></td>
           <td style="text-align:right">${r.sinAsignar}</td><td></td>
           <td style="text-align:right">queda en la academia</td><td></td>
           <td style="text-align:right">Tropicana</td></tr>`
        : "";
      return `<tr${esEste ? ' class="b"' : ' class="muted"'}>
        <td>${esc2(r.curso)}</td>
        <td style="text-align:right">${r.clases === 0 ? "ninguna" : r.clases}</td>
        <td style="text-align:right">${gs(r.precioClase)}</td>
        <td style="text-align:right">${gs(parteDe(it, r))}</td>
        <td style="text-align:right">${pct}%</td>
        <td style="text-align:right">${esEste ? "este curso" : ""}</td></tr>${supl}${sub}`;
    })
    .join("") +
    `<tr><td colspan="3" style="border-top:1px solid #ddd">Suma de las partes = lo cobrado</td>
      <td class="b" style="text-align:right;border-top:1px solid #ddd">${gs(it.cobrado)}</td>
      <td style="text-align:right;border-top:1px solid #ddd">100%</td><td style="border-top:1px solid #ddd"></td></tr>`;
  return `<div class="small" style="margin-top:6px;border-top:1px solid #ddd;padding-top:4px">
      <div class="k">Como se reparte lo cobrado entre los cursos del plan</div>
      <div class="muted">De los ${gs(it.cobrado)} cobrados, cada curso se lleva
        lo proporcional a <b>sus clases &times; el valor de una clase suya</b>.
        ${esc2(LEYENDA_CLASES)}</div>
      <table style="width:100%;font-size:11px">${encabezado}${filas}</table>
    </div>`;
}

/**
 * Cuántas **ventas distintas** cerró el profesor en el período.
 *
 * No es la cantidad de líneas: desde el prorrateo, una membresía de varios
 * cursos deja una línea por curso, y un curso repartido entre dos titulares
 * deja dos. Contar líneas daría un número inflado del trabajo real.
 */
function membresiasDelPeriodo(items: ItemComprobante[]): number {
  return new Set(items.map((i) => `${i.alumno}|${i.cicloInicio}|${i.cicloFin}`)).size;
}

/** ¿Esta comisión salió de repartir una venta entre varios cursos? */
function hayReparto(it: ItemComprobante): boolean {
  return it.reparto.length > 1 && it.pesoTotal > 0;
}
/**
 * La parte en plata de una línea del reparto. Lo devengado antes de que se
 * guardara `parte` se deriva del peso — el mismo número, calculado en vez de
 * leído.
 */
function parteDe(it: ItemComprobante, r: ItemComprobante["reparto"][number]): number {
  if (typeof r.parte === "number") return r.parte;
  return it.pesoTotal > 0 ? (it.cobrado * r.peso) / it.pesoTotal : 0;
}

/** Qué porcentaje de la venta pesó este curso. */
function pctPeso(it: ItemComprobante): number {
  return it.pesoTotal > 0 ? Math.round((it.pesoCurso / it.pesoTotal) * 100) : 0;
}

/**
 * De dónde sale la parte de este curso.
 *
 * Existe porque sin esto el comprobante decía "Cobrado Bs. 800 → Comisión 50%
 * → Bs. 400" sobre una venta cuya comisión real era Bs. 100: los Bs. 800 nunca
 * fueron la base de ese profesor. Un número que no se puede verificar no se
 * puede discutir, y una liquidación es justamente algo que se discute.
 *
 * Se muestran TODOS los cursos, incluido el que no dictó: que quede en cero es
 * la regla de negocio 10 a la vista, no un olvido.
 */
function Reparto({ it, modo }: { it: ItemComprobante; modo: "completo" | "compacto" }) {
  const suEl = it.reparto.find((r) => r.cursoId === it.cursoId);
  if (modo === "compacto") {
    return (
      <div className="text-xs text-[var(--texto-tenue)] mt-1.5">
        Reparto:{" "}
        {it.reparto
          .map(
            (r) =>
              `${r.curso} ${r.peso === 0 ? "no dictó" : gs(parteDe(it, r))}` +
              (r.profesores?.length
                ? ` (${r.profesores.map((pr) => `${pr.profesor} ${pr.clases}`).join(" / ")})`
                : "")
          )
          .join(" · ")}{" "}
        (suman {gs(it.cobrado)})
      </div>
    );
  }
  return (
    <div className="mt-2 border-t border-[var(--borde)] pt-2">
      <div className="text-xs text-[var(--texto-tenue)] mb-1">
        Cómo se reparte lo cobrado entre los cursos del plan
      </div>
      {/* La cuenta dicha en palabras, arriba de la tabla. Sin esto hay que
          adivinar qué relaciona las columnas, y un número que no se puede
          seguir no se puede discutir — que es para lo que existe el papel. */}
      <p className="text-xs text-[var(--texto-tenue)] mb-1.5">
        De los <span className="font-semibold">{gs(it.cobrado)}</span> cobrados, cada curso se
        lleva lo proporcional a <span className="font-semibold">sus clases × el valor de una
        clase suya</span>. {LEYENDA_CLASES}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[var(--texto-tenue)]">
            <th className="py-0.5 text-left font-normal">Curso</th>
            <th className="py-0.5 text-right font-normal">Clases</th>
            <th className="py-0.5 text-right font-normal">Valor de 1 clase</th>
            <th className="py-0.5 text-right font-normal">Le toca</th>
            <th className="py-0.5 text-right font-normal w-12">%</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {it.reparto.map((r) => {
            const esEste = r === suEl;
            return (
              <tr key={r.cursoId} className={esEste ? "font-semibold" : "text-[var(--texto-tenue)]"}>
                <td className="py-0.5">{r.curso}</td>
                <td className="py-0.5 text-right tabular-nums">
                  {r.clases === 0 ? "ninguna" : r.clases}
                </td>
                <td className="py-0.5 text-right tabular-nums">{gs(r.precioClase)}</td>
                <td className="py-0.5 text-right tabular-nums">{gs(parteDe(it, r))}</td>
                <td className="py-0.5 text-right tabular-nums w-12">
                  {it.pesoTotal > 0 ? Math.round((r.peso / it.pesoTotal) * 100) : 0}%
                </td>
                <td className="py-0.5 text-right whitespace-nowrap">{esEste ? "este curso" : ""}</td>
              </tr>
            );
          })}
          {/* Un curso que dictó más de un profesor: sin abrirlo, la base de la
              comisión parece no coincidir con la parte del curso. Cada
              sub-línea dice cuántas clases puso cada uno y cuánto le tocó. */}
          {/* Clase dictada con reemplazo por causa administrativa: su parte
              queda para Tropicana, de donde sale el costo del reemplazo
              (regla 20b). **Solo se muestra en el curso de ESTE profesor**: al
              resto no le corresponde verlo, es una cuenta interna de la
              academia. Pero en el suyo hay que decirlo, porque si no su base
              no cuadra con la parte del curso y parece un error. Se dice
              neutro: no se expone quién reemplazó ni cuánto se le pagó. */}
          {it.reparto
            .filter((r) => (r.sinAsignar ?? 0) > 0 && r.cursoId === it.cursoId)
            .map((r) => (
              <tr key={`${r.cursoId}-suplente`} className="text-[var(--texto-tenue)] italic">
                <td className="py-0.5 pl-4">— dictadas con reemplazo</td>
                <td className="py-0.5 text-right tabular-nums">{r.sinAsignar}</td>
                <td />
                <td className="py-0.5 text-right">queda en la academia</td>
                <td />
                <td className="py-0.5 text-right whitespace-nowrap">Tropicana</td>
              </tr>
            ))}
          {it.reparto.flatMap((r) =>
            (r.profesores ?? []).map((pr) => (
              <tr
                key={`${r.cursoId}-${pr.profesorId}`}
                className={
                  pr.profesorId === it.profesorId
                    ? "font-semibold"
                    : "text-[var(--texto-tenue)]"
                }
              >
                <td className="py-0.5 pl-4">— {pr.profesor}</td>
                <td className="py-0.5 text-right tabular-nums">{pr.clases}</td>
                <td />
                <td className="py-0.5 text-right tabular-nums">{gs(pr.parte)}</td>
                <td />
                <td className="py-0.5 text-right whitespace-nowrap">
                  {pr.profesorId === it.profesorId ? "usted" : ""}
                </td>
              </tr>
            ))
          )}
          <tr className="border-t border-[var(--borde)]">
            <td className="py-0.5" colSpan={3}>
              Suma de las partes = lo cobrado
            </td>
            <td className="py-0.5 text-right tabular-nums font-semibold">{gs(it.cobrado)}</td>
            <td className="py-0.5 text-right">100%</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

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
  /** Cómo se muestra el reparto a prorrata en pantalla y en el papel. */
  repartoPantalla: "completo" | "compacto";
  repartoImpreso: "completo" | "compacto";
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
  /**
   * Ver el reparto completo o comprimido. Arranca en lo que dice el parámetro
   * y se puede cambiar para mirar — **lo impreso siempre sale como dice el
   * parámetro**, porque el papel es el documento y no debe depender de cómo
   * quedó una pantalla.
   *
   * Es un control segmentado de dos opciones, el mismo gesto que las pestañas
   * de Inscripción / Clase de prueba: dos estados nombrados se leen mejor que
   * un interruptor que hay que adivinar qué prende.
   */
  const [vista, setVista] = useState<"completo" | "compacto">(datos.repartoPantalla);
  const hayAlgunReparto = datos.items.some(hayReparto);
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
          <div className="text-right text-sm text-[var(--texto-tenue)]">
            <div>Liquidado: {fechaCorta(datos.creadoEn)}</div>
            <div>Emitido: {fechaCorta(new Date().toISOString())}</div>
          </div>
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

        {/* Cuántas ventas cerró en el período: es el volumen del trabajo del
            profesor, y estaba solo en la pantalla "Por liquidar". Un
            comprobante que no lo dice obliga a contar las líneas a mano — y
            con el prorrateo, una membresía puede dejar varias líneas. */}
        <div className="text-sm mb-3">
          <span className="text-[var(--texto-tenue)]">Membresías cerradas en el período: </span>
          <span className="font-semibold">{membresiasDelPeriodo(datos.items)}</span>
          {datos.items.length !== membresiasDelPeriodo(datos.items) && (
            <span className="text-[var(--texto-tenue)]">
              {" "}
              ({datos.items.length} líneas de comisión, una por curso)
            </span>
          )}
        </div>

        {/* Detalle por membresía */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-sm text-[var(--texto-tenue)]">Detalle de comisiones</div>
          {hayAlgunReparto && (
            <div className="flex gap-1 print:hidden" role="group" aria-label="Ver el reparto">
              {(
                [
                  ["completo", "Reparto completo"],
                  ["compacto", "Reparto compacto"],
                ] as ["completo" | "compacto", string][]
              ).map(([v, etiqueta]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVista(v)}
                  aria-pressed={vista === v}
                  className={`px-3 py-1 text-sm rounded-[var(--radio-control)] border ${
                    vista === v
                      ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                      : "border-[var(--borde)] hover:border-[var(--primario)]"
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-3 mb-4">
          {datos.items.map((it, i) => {
            const faltas = detalleFaltas(it);
            return (
              <div key={i} className="border border-[var(--borde)] rounded-[var(--radio-chico)] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold">{it.alumno}</div>
                  <div className="text-sm text-[var(--texto-tenue)]">
                    {it.tipoServicio} ·{" "}
                    {it.personas > 1 ? `Grupal, ${it.personas} alumnos` : "Individual"}
                  </div>
                </div>
                <div className="text-xs text-[var(--texto-tenue)] mt-0.5">
                  {it.plan} · {it.curso}
                </div>
                <div className="text-xs text-[var(--texto-tenue)] mt-0.5">
                  Ciclo {fechaCorta(it.cicloInicio)} → {fechaCorta(it.cicloFin)}
                  {hayReparto(it)
                    ? ` · este curso dictó ${it.clasesCurso ?? 0} ${
                        (it.clasesCurso ?? 0) === 1 ? "clase" : "clases"
                      }`
                    : ` · ${it.clasesHechas ?? "—"}/${it.clasesPlan ?? "—"} clases`}
                  {faltas ? ` · ${faltas}` : ""}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 mt-2 text-sm">
                  <Cifra etiqueta="Valor total" valor={gs(it.valorTotal)} />
                  <Cifra
                    etiqueta={`Descuento${it.motivo ? ` (${it.motivo})` : ""}`}
                    valor={it.descuento > 0 ? `− ${gs(it.descuento)}` : gs(0)}
                  />
                  <Cifra etiqueta="Cobrado" valor={gs(it.cobrado)} />
                  {hayReparto(it) && (
                    <Cifra
                      etiqueta={`Parte de este curso (${pctPeso(it)}%)`}
                      valor={gs(it.parte)}
                    />
                  )}
                  <Cifra etiqueta={`Comisión (${it.pct}%)`} valor={gs(it.monto)} fuerte />
                </div>
                {hayReparto(it) && <Reparto it={it} modo={vista} />}
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
            <span class="muted">${esc(it.tipoServicio)} &middot; ${
              it.personas > 1 ? `Grupal, ${it.personas} alumnos` : "Individual"
            }</span>
          </div>
          <div class="small muted">${esc(it.plan)} · ${esc(it.curso)}</div>
          <div class="small muted">
            Ciclo ${fechaCorta(it.cicloInicio)} &rarr; ${fechaCorta(it.cicloFin)} ·
            ${
              hayReparto(it)
                ? `este curso dictó ${it.clasesCurso ?? 0} ${(it.clasesCurso ?? 0) === 1 ? "clase" : "clases"}`
                : `${it.clasesHechas ?? "—"}/${it.clasesPlan ?? "—"} clases`
            }${faltas ? ` · ${esc(faltas)}` : ""}
          </div>
          <div class="grid">
            <div><div class="k">Valor total</div><div>${gs(it.valorTotal)}</div></div>
            <div><div class="k">${descEtq}</div><div>${desc}</div></div>
            <div><div class="k">Cobrado</div><div>${gs(it.cobrado)}</div></div>
            ${
              hayReparto(it)
                ? `<div><div class="k">Parte de este curso (${pctPeso(it)}%)</div><div>${gs(it.parte)}</div></div>`
                : ""
            }
            <div><div class="k">Comisión (${it.pct}%)</div><div class="b">${gs(it.monto)}</div></div>
          </div>
          ${hayReparto(it) ? repartoHTML(it, d.repartoImpreso) : ""}
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
        <div class="r muted small">
          <div>Liquidado: ${fechaCorta(d.creadoEn)}</div>
          <div>Emitido: ${emitido}</div>
        </div>
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
      <div class="small" style="margin-bottom:6px">
        <span class="muted">Membresias cerradas en el periodo: </span><b>${membresiasDelPeriodo(d.items)}</b>${
          d.items.length !== membresiasDelPeriodo(d.items)
            ? ` <span class="muted">(${d.items.length} lineas de comision, una por curso)</span>`
            : ""
        }
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
