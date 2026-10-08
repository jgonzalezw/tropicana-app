"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gs } from "@/lib/inscripcion";
import type { ResultadoPre } from "@/lib/liquidacion/lecturaPre";
import { TablaParticulares, TablaRegulares } from "@/components/liquidacion/TablasLineas";
import type { ClaseSinRegistrar, InformePre, ProfesorPre } from "@/lib/liquidacion/preliquidacion";
import { construirHTMLPreliquidacion } from "@/lib/liquidacion/imprimirPre";
import {
  conSigno,
  fechaCorta,
  fechaHora,
  LEYENDA_PRE,
  LEYENDA_SIMULACION,
  nombrePeriodoPre,
  notaLiquidez,
  subtituloPre,
  tituloPre,
} from "@/lib/liquidacion/formatoPre";

const BOTON_SECUNDARIO =
  "inline-flex items-center justify-center min-h-[44px] px-5 text-base font-semibold rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]";
const BOTON_PRIMARIO =
  "inline-flex items-center justify-center min-h-[44px] px-5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-50 disabled:cursor-not-allowed";

function Etiqueta({ children, tono }: { children: React.ReactNode; tono: "aviso" | "neutro" }) {
  return (
    <span
      className={`inline-block text-sm font-semibold px-3 py-0.5 rounded-[var(--radio-control)] ${
        tono === "aviso"
          ? "bg-[var(--peligro-fill)] text-[var(--peligro-texto)]"
          : "bg-[var(--fondo-elevado)] text-[var(--texto-tenue)]"
      }`}
    >
      {children}
    </span>
  );
}

export default function ClientePreliquidacion({ resultado }: { resultado: ResultadoPre }) {
  const router = useRouter();

  function imprimir() {
    if (!resultado.ok) return;
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    win.document.write(construirHTMLPreliquidacion(resultado.informe, resultado.generadoEn));
    win.document.close();
    win.focus();
    win.onload = () => win.print();
    setTimeout(() => {
      try {
        win.print();
      } catch {
        /* noop */
      }
    }, 300);
  }

  const periodo = resultado.ok ? nombrePeriodoPre(resultado.informe) : null;

  return (
    <div className="flex flex-col gap-7">
      {/* Acciones */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/liquidaciones" className={BOTON_SECUNDARIO}>
          ← Volver a Liquidaciones
        </Link>
        <button type="button" onClick={imprimir} disabled={!resultado.ok} className={BOTON_PRIMARIO}>
          Imprimir
        </button>
      </div>

      {/* Encabezado */}
      <div>
        <div className="text-sm text-[var(--texto-tenue)]">Liquidaciones</div>
        <h1 className="text-[28px] sm:text-[38px] mt-1">
          {resultado.ok ? tituloPre(resultado.informe) : "Pre-liquidación"}
        </h1>
        {resultado.ok && (
          <p className="text-base text-[var(--texto-tenue)] mt-2">
            Generado el {fechaHora(resultado.generadoEn)} · {subtituloPre(resultado.informe)}
          </p>
        )}
        <p className="mt-4 px-5 py-3 rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] text-base font-bold">
          {resultado.ok && resultado.informe.simulacion ? LEYENDA_SIMULACION : LEYENDA_PRE}
        </p>
        {resultado.ok && resultado.informe.simulacion && (
          <ul className="mt-3 list-disc pl-6 text-base text-[var(--texto-tenue)]">
            {resultado.informe.simulacion.limites.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>

      {resultado.ok ? <Informe informe={resultado.informe} periodo={periodo!} /> : <Fallo resultado={resultado} onReintentar={() => router.refresh()} />}
    </div>
  );
}

// ── Error: nunca se muestra un informe vacío ante un fallo ──────────────────

function Fallo({
  resultado,
  onReintentar,
}: {
  resultado: Extract<ResultadoPre, { ok: false }>;
  onReintentar: () => void;
}) {
  return (
    <div role="alert" className="rounded-[var(--radio-tarjeta)] bg-[var(--peligro-fill)] text-[var(--peligro-texto)] p-6">
      <h2 className="text-xl">No se pudo armar la pre-liquidación</h2>
      <p className="mt-2 text-base">
        Falló la lectura «{resultado.lecturas.find((l) => l.estado === "fallo")?.nombre ?? "del período"}». No se
        muestra ningún número: con una lectura incompleta, un profesor sin devengo o una sección vacía no
        significarían nada.
      </p>
      <ul className="mt-4 flex flex-col gap-1 text-base">
        {resultado.lecturas.map((l) => (
          <li key={l.nombre} className="flex gap-2">
            <span className="font-bold min-w-[72px]">
              {l.estado === "leido" ? "Leído" : l.estado === "fallo" ? "Falló" : "Sin leer"}
            </span>
            <span>
              {l.nombre}
              {l.detalle ? ` — ${l.detalle}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex gap-3 flex-wrap">
        <button type="button" onClick={onReintentar} className={BOTON_PRIMARIO}>
          Reintentar
        </button>
        <Link href="/liquidaciones" className={BOTON_SECUNDARIO}>
          Volver a Liquidaciones
        </Link>
      </div>
    </div>
  );
}

// ── Informe ──────────────────────────────────────────────────────────────

function Informe({ informe, periodo }: { informe: InformePre; periodo: string }) {
  const r = informe.resumen;
  const vacio = informe.profesores.length === 0;
  return (
    <>
      {informe.existentes.length > 0 && (
        <div className="rounded-[var(--radio-panel)] border border-[var(--advertencia)] bg-[var(--advertencia-fill)] text-[var(--advertencia-texto)] p-5">
          <div className="font-bold text-base">Ya hay una liquidación generada para {periodo.toLowerCase()}.</div>
          {informe.existentes.map((l) => (
            <div key={l.id} className="text-base mt-1">
              {l.profesor} · N° {l.id} · {l.estado} · {gs(l.total)}{" "}
              <Link href={`/liquidaciones/${l.id}`} className="underline font-semibold">
                Ver comprobante
              </Link>
            </div>
          ))}
          <div className="text-sm mt-2">
            Este informe no la incluye ni la modifica: muestra solo lo que todavía no se liquidó.
          </div>
        </div>
      )}

      {vacio && (
        <div className="rounded-[var(--radio-panel)] bg-[var(--exito-fill)] text-[var(--exito-texto)] p-5">
          <div className="font-bold text-lg">No hay nada que liquidar en {periodo.toLowerCase()}.</div>
          <p className="text-base mt-1">
            No hay membresías completadas y cobradas al 100% con el ciclo cerrado dentro del período. No es un error:
            membresías, cobros, asistencia y asignaciones se leyeron completas.
          </p>
        </div>
      )}

      {/* Resumen */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <Cifra etiqueta="Total a devengar" valor={gs(r.total)} nota={`Comisiones ${gs(r.comisiones)} · reemplazos y ajustes ${conSigno(r.extras)}`} />
        <Cifra etiqueta="Profesores con devengo" valor={String(r.profesoresConDevengo)} />
        <Cifra etiqueta="Membresías que entran" valor={String(r.membresiasQueEntran)} nota="Cuenta una vez cada membresía, aunque tenga varios cursos" />
        <Cifra etiqueta="Membresías con excepción" valor={String(r.membresiasConExcepcion)} nota="No entran en esta liquidación" />
      </div>
      {informe.liquidez && (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <Cifra
            etiqueta={`Liquidez a prever al ${fechaCorta(informe.hastaISO)}`}
            valor={gs(informe.liquidez.total)}
            nota={notaLiquidez(informe.liquidez)}
          />
        </div>
      )}

      <Profesores profesores={informe.profesores} periodo={periodo} />
      <Excepciones informe={informe} />
      <Clases informe={informe} />
    </>
  );
}

function Cifra({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] px-5 py-4">
      <div className="text-sm text-[var(--texto-tenue)]">{etiqueta}</div>
      <div className="titulo text-[28px] tabular-nums">{valor}</div>
      {nota && <div className="text-[13px] text-[var(--texto-tenue)] mt-0.5">{nota}</div>}
    </div>
  );
}

// ── Por profesor ─────────────────────────────────────────────────────────

function Profesores({ profesores, periodo }: { profesores: ProfesorPre[]; periodo: string }) {
  const [abiertos, setAbiertos] = useState<Set<number>>(() => new Set(profesores.map((p) => p.profesorId)));
  const todosAbiertos = abiertos.size === profesores.length && profesores.length > 0;
  const alternar = (id: number) =>
    setAbiertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl">Por profesor</h2>
          <p className="text-sm text-[var(--texto-tenue)] mt-1">
            Criterios: <b>C1</b> al completarse la membresía, a período vencido · <b>C2</b> proporcional al avance ·{" "}
            <b>C3</b> al completarse, sin esperar el cierre.
          </p>
        </div>
        {profesores.length > 0 && (
          <button
            type="button"
            className="text-base font-semibold underline min-h-[44px]"
            onClick={() => setAbiertos(todosAbiertos ? new Set() : new Set(profesores.map((p) => p.profesorId)))}
          >
            {todosAbiertos ? "Cerrar todos" : "Abrir todos"}
          </button>
        )}
      </div>

      {profesores.length === 0 && (
        <p className="text-base text-[var(--texto-tenue)]">
          Ningún profesor tiene devengo: no hay membresías completadas y cobradas al 100% con el ciclo cerrado dentro de{" "}
          {periodo.toLowerCase()}.
        </p>
      )}

      {profesores.map((p) => {
        const abierto = abiertos.has(p.profesorId);
        return (
          <div key={p.profesorId} className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)]">
            <button
              type="button"
              aria-expanded={abierto}
              onClick={() => alternar(p.profesorId)}
              className="w-full min-h-[72px] flex items-center gap-4 px-5 py-3 text-left"
            >
              <span className={`transition-transform ${abierto ? "" : "-rotate-90"}`} aria-hidden>
                ▾
              </span>
              <span className="flex-1 min-w-0">
                <span className="titulo block text-xl">{p.nombre}</span>
                <span className="block text-sm text-[var(--texto-tenue)]">
                  {p.membresias} {p.membresias === 1 ? "membresía" : "membresías"} · {p.cursos.join(", ") || "—"}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-sm text-[var(--texto-tenue)]">Neto</span>
                <span className="titulo text-[22px] tabular-nums">{gs(p.neto)}</span>
              </span>
            </button>
            {abierto && <DetalleProfesor p={p} />}
          </div>
        );
      })}
    </section>
  );
}

function DetalleProfesor({ p }: { p: ProfesorPre }) {
  return (
    <div className="px-5 pb-5">
      {p.regulares.length > 0 && (
        <>
          <h3 className="text-base font-semibold mt-1">Cursos regulares</h3>
          <TablaRegulares lineas={p.regulares} etiquetaMonto="Este período" />
        </>
      )}
      {p.particulares.length > 0 && (
        <>
          <h3 className="text-base font-semibold mt-4">Clases particulares</h3>
          <TablaParticulares lineas={p.particulares} etiquetaMonto="Este período" />
        </>
      )}
      {p.regulares.length === 0 && p.particulares.length === 0 && (
        <p className="text-base text-[var(--texto-tenue)]">Sin comisiones en este período.</p>
      )}

      <div className="mt-3 pt-3 border-t border-[var(--borde)] flex flex-col gap-2 text-base">
        <Fila texto={`Comisiones · ${p.membresias} ${p.membresias === 1 ? "membresía" : "membresías"}`} monto={gs(p.subtotal)} />
        {p.extras.length === 0 ? (
          <div className="text-sm text-[var(--texto-tenue)]">Sin descuentos por reemplazo ni ajustes de períodos anteriores.</div>
        ) : (
          p.extras.map((x, i) => (
            <div key={i} className="flex justify-between gap-3">
              <div>
                <div className="font-semibold">{x.titulo}</div>
                <div className="text-[13px] text-[var(--texto-tenue)]">{x.detalle}</div>
              </div>
              <div
                className={`font-semibold tabular-nums whitespace-nowrap ${
                  x.monto < 0 ? "text-[var(--peligro)]" : "text-[var(--exito)]"
                }`}
              >
                {conSigno(x.monto)}
              </div>
            </div>
          ))
        )}
        <div className="flex justify-between gap-3 items-baseline">
          <span className="titulo text-lg">Neto a devengar</span>
          <span className="titulo text-xl tabular-nums">{gs(p.neto)}</span>
        </div>
        {p.aPagar != null && (
          <>
            <Fila texto="Saldo sin pagar de liquidaciones anteriores" monto={gs(p.saldoPrevio ?? 0)} />
            <div className="flex justify-between gap-3 items-baseline">
              <span className="titulo text-lg">A pagar al cierre</span>
              <span className="titulo text-xl tabular-nums">{gs(p.aPagar)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Fila({ texto, monto }: { texto: string; monto: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{texto}</span>
      <span className="tabular-nums font-semibold">{monto}</span>
    </div>
  );
}

// ── Excepciones ──────────────────────────────────────────────────────────

function Excepciones({ informe }: { informe: InformePre }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl">Excepciones</h2>
        <p className="text-sm text-[var(--texto-tenue)] mt-1">
          Lo que no entra en esta liquidación, y por qué. Cada caso lleva a donde se arregla.
        </p>
      </div>
      {informe.excepciones.map((m) => (
        <div key={m.clave} className="rounded-[22px] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-[17px] titulo">{m.titulo}</h3>
            <Etiqueta tono={m.casos.length ? "aviso" : "neutro"}>{m.casos.length ? m.casos.length : "ninguna"}</Etiqueta>
          </div>
          {m.casos.length === 0 ? (
            <p className="text-sm text-[var(--texto-tenue)] mt-2">Ninguna en este período.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {m.casos.map((c, i) => (
                <div key={i} className="rounded-[18px] bg-[var(--fondo-elevado)] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-bold">
                      {c.persona}
                      {c.curso ? <span className="font-normal"> · {c.curso}</span> : null}
                    </div>
                    <div className="text-sm text-[var(--texto-tenue)]">{c.detalle}</div>
                  </div>
                  <Link href={c.href} className="min-h-[44px] inline-flex items-center font-semibold text-[var(--peligro)] whitespace-nowrap">
                    {c.accion} ›
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

// ── Clases sin registrar ─────────────────────────────────────────────────

function Clases({ informe }: { informe: InformePre }) {
  const c = informe.clases;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl">Clases sin registrar</h2>
        <p className="text-sm text-[var(--texto-tenue)] mt-1">
          Por curso y fecha, no por plan ni alumno. Una clase sin registrar solo <b>traba</b> una membresía de 2 o más
          cursos, porque ahí el conteo reparte la plata; en un solo curso no cambia el número.
        </p>
      </div>
      <BloqueClases
        titulo="Vencidas con alumnos esperados"
        bajada="Ya pasaron, tenían alumnos y no tienen asistencia ni suspensión."
        filas={c.vencidas}
        conTraba
        enlace
        vacio="No hay clases vencidas sin registrar con alumnos esperados."
      />
      <BloqueClases
        titulo="De hoy o futuras"
        bajada="Aún no vencidas: se registran cuando se dicten."
        filas={c.proximas}
        conTraba
        vacio="No hay clases de hoy ni futuras pendientes."
      />
      <BloqueClases
        titulo="Días de calendario sin alumnos"
        bajada="Ningún alumno tenía clase ese día: la clase no existe para nadie y no obliga ni al profesor ni a la academia."
        filas={c.sinAlumnos}
        conTraba={false}
        vacio="No hay días de calendario sin alumnos."
      />
    </section>
  );
}

function BloqueClases({
  titulo,
  bajada,
  filas,
  conTraba,
  enlace,
  vacio,
}: {
  titulo: string;
  bajada: string;
  filas: ClaseSinRegistrar[];
  conTraba: boolean;
  enlace?: boolean;
  vacio: string;
}) {
  const [abierto, setAbierto] = useState(false); // cerrados por defecto (N57)
  const cursos = new Set(filas.map((f) => f.cursoId)).size;
  const trabadas = filas.filter((f) => f.traba).length;
  return (
    <div className="rounded-[22px] bg-[var(--fondo-panel)] border border-[var(--borde)]">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className="w-full min-h-[56px] px-5 py-3 flex items-center gap-3 text-left"
      >
        <span className={`transition-transform ${abierto ? "" : "-rotate-90"}`} aria-hidden>
          ▾
        </span>
        <span className="flex-1">
          <span className="font-bold text-base block">{titulo}</span>
          <span className="text-sm text-[var(--texto-tenue)]">
            {filas.length} {filas.length === 1 ? "clase" : "clases"}
            {filas.length ? ` · ${cursos} ${cursos === 1 ? "curso" : "cursos"}` : ""}
          </span>
        </span>
        {conTraba && filas.length > 0 && (
          <Etiqueta tono={trabadas ? "aviso" : "neutro"}>{trabadas ? `${trabadas} traban` : "No traba"}</Etiqueta>
        )}
      </button>
      {abierto && (
        <div className="px-5 pb-4">
          <p className="text-sm text-[var(--texto-tenue)] mb-2">{bajada}</p>
          {filas.length === 0 ? (
            <p className="text-sm">{vacio}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filas.map((f) => (
                <div key={`${f.cursoId}-${f.fecha}`} className="rounded-[18px] bg-[var(--fondo-elevado)] px-4 py-2.5 flex items-center gap-x-4 gap-y-1 flex-wrap">
                  <span className="font-bold tabular-nums">{fechaCorta(f.fecha)}</span>
                  <span>{f.curso}</span>
                  <span className="text-sm text-[var(--texto-tenue)]">
                    {f.alumnosEsperados} {f.alumnosEsperados === 1 ? "alumno esperado" : "alumnos esperados"}
                  </span>
                  {conTraba && <Etiqueta tono={f.traba ? "aviso" : "neutro"}>{f.traba ? "Traba" : "No traba"}</Etiqueta>}
                  <span className="text-sm text-[var(--texto-tenue)] flex-1 min-w-[140px]">{f.motivo}</span>
                  {enlace && (
                    <Link href="/asistencia" className="min-h-[44px] inline-flex items-center font-semibold text-[var(--peligro)] whitespace-nowrap">
                      Registrar en Asistencia ›
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
