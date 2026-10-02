"use client";

/**
 * Inscribir a un plan regular (rearmada en E3 de "Ventas y contactos con el
 * mismo comportamiento").
 *
 * Usa las piezas comunes de venta (`components/venta`, `components/contacto`):
 * el mismo esqueleto de pasos, titular, cobro, barra con el primer faltante y
 * confirmación con WhatsApp que usan todas las ventas. Lo intrínseco de la
 * inscripción: el titular es una **persona** (o un menor con su tutor) que
 * **adquiere el rol alumno** al comprar; los **cursos y días** que toma; las
 * **próximas clases** como fecha de inicio (o las ya dictadas, si es
 * retroactiva); el **bono de tolerancia** y el **crédito de la clase de
 * prueba** del mismo plan.
 */

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ListasContacto, MatrizMinimo } from "@/lib/tipos";
import Cobro, { type PayloadCobro } from "@/components/Cobro";
import Toggle from "@/components/Toggle";
import TitularVenta from "@/components/contacto/TitularVenta";
import BloqueVenta from "@/components/venta/BloqueVenta";
import BarraVenta from "@/components/venta/BarraVenta";
import ConfirmacionVenta, { type AvisoVenta } from "@/components/venta/ConfirmacionVenta";
import FechaCompromiso, { fechaCompromisoEfectiva } from "@/components/venta/FechaCompromiso";
import { cobroParaServidor } from "@/lib/venta/cobro";
import { faltaParaInscripcion } from "@/lib/venta/faltantes";
import { enVigencia } from "@/lib/vigencia";
import { DIAS_LARGOS, diaIso, fechaClaseN, fechaLarga, gs, isoFecha, proximasClases } from "@/lib/inscripcion";
import { etiquetaDias } from "@/components/entidades/EntidadCurso";
import { inscribirYCobrar } from "./acciones";

export type CursoPlan = {
  id: number;
  nombre: string;
  dias_semana: number[];
  hora: string | null;
  /** Precio de la prueba por alumno. `null` = este curso no se puede probar. */
  precioPrueba: number | null;
  /** Vigencia del curso (0033): ninguna fecha de inicio puede caer fuera de ella. */
  vigente_desde?: string | null;
  vigente_hasta?: string | null;
};
export type PlanVenta = {
  id: number;
  nombre: string;
  cantidadClases: number | null;
  precio: number;
  ilimitado: boolean;
  cicloDias: number | null;
  /** Si el plan se ofrece como clase de prueba. */
  aceptaPrueba: boolean;
  /** En cuántos cursos distintos se puede probar. */
  pruebaCursosMax: number;
  cursos: CursoPlan[];
};

type Cerrada = { datos: { etiqueta: string; valor: string }[]; avisos: AvisoVenta[] };
type CreditoPrueba = { monto: number; fecha: string; personas: number; pagado: number };

export default function ClienteInscribir({
  planes,
  diasCompromiso,
  medios,
  cursosPorContacto,
  deudaPorContacto,
  planesActivosPorContacto,
  bonoPorContactoPlan,
  suspendidas,
  creditoPruebaPorContactoPlan,
  matriz,
  listasContacto,
  puedeVerPrivados,
}: {
  planes: PlanVenta[];
  diasCompromiso: number;
  medios: string[];
  cursosPorContacto: Record<number, string[]>;
  deudaPorContacto: Record<number, number>;
  planesActivosPorContacto: Record<number, number[]>;
  bonoPorContactoPlan: Record<number, Record<number, number>>;
  /** Claves `cursoId|YYYY-MM-DD` de clases suspendidas: no son clase. */
  suspendidas: string[];
  /** Crédito de una clase de prueba sin convertir, por contacto y plan. */
  creditoPruebaPorContactoPlan: Record<number, Record<number, CreditoPrueba>>;
  matriz: MatrizMinimo[];
  listasContacto: ListasContacto;
  puedeVerPrivados: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [titularId, setTitularId] = useState<number | null>(null);
  const [titularNombre, setTitularNombre] = useState("");
  const [plan, setPlan] = useState<PlanVenta | null>(null);
  const [diasPorCurso, setDiasPorCurso] = useState<Record<number, number[]>>({});
  const [fechaIdx, setFechaIdx] = useState(0);
  const [retroActivo, setRetroActivo] = useState(false);
  const [cobro, setCobro] = useState<PayloadCobro | null>(null);
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  const [cerrada, setCerrada] = useState<Cerrada | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hoy = useMemo(() => new Date(), []);

  const ilimitado = plan?.ilimitado ?? false;
  const N = ilimitado ? null : (plan?.cantidadClases ?? null);
  const precioPlan = plan?.precio ?? 0;
  // Bono de tolerancia pendiente del titular para este plan (solo planes con N).
  const bono = !ilimitado && titularId != null && plan ? (bonoPorContactoPlan[titularId]?.[plan.id] ?? 0) : 0;
  // Crédito de la clase de prueba de este mismo plan (regla 11). Se muestra acá,
  // antes de cobrar, pero el servidor lo vuelve a calcular al vender: la
  // pantalla propone, el servidor decide.
  const credito = titularId != null && plan ? (creditoPruebaPorContactoPlan[titularId]?.[plan.id] ?? null) : null;
  const creditoPrueba = credito ? Math.min(credito.monto, precioPlan) : 0;
  // El precio del plan NO cambia: el crédito se deduce de lo que hay que cobrar,
  // como un descuento con su motivo (Javier).
  const total = precioPlan;
  const Nefectivo = N != null ? N + bono : null;

  // Lista con repetición: una entrada por (curso, día) elegido.
  const diasConteo = useMemo(() => {
    if (!plan) return [];
    const out: number[] = [];
    for (const c of plan.cursos) for (const d of diasPorCurso[c.id] ?? []) out.push(d);
    return out;
  }, [plan, diasPorCurso]);

  const unionDias = useMemo(() => Array.from(new Set(diasConteo)).sort(), [diasConteo]);
  const susp = useMemo(() => new Set(suspendidas), [suspendidas]);
  /**
   * ¿Ese día hay clase de alguno de los cursos elegidos, no está suspendida y el
   * curso estaba vigente? Fuera de su vigencia (desde / baja) el curso no se
   * dicta: ninguna fecha de inicio puede caer ahí (el servidor también lo valida).
   */
  const hayClaseReal = useCallback(
    (d: Date) => {
      const dia = diaIso(d);
      const iso = isoFecha(d);
      const elegidos = Object.entries(diasPorCurso).filter(([, dias]) => dias.length > 0);
      // El servidor exige que TODOS los cursos elegidos estén vigentes al empezar.
      const todosVigentes = elegidos.every(([cid]) => enVigencia(plan?.cursos.find((c) => c.id === Number(cid)), iso));
      return todosVigentes && elegidos.some(([cid, dias]) => dias.includes(dia) && !susp.has(`${cid}|${iso}`));
    },
    [diasPorCurso, susp, plan]
  );

  // Fechas de inicio ofrecidas. Hacia adelante, las próximas 3 clases; hacia
  // atrás (inscripción retroactiva), las últimas 6 que YA se dictaron. Un campo
  // de fecha libre dejaba elegir un día en que el curso no se dicta, o una
  // clase suspendida, y la membresía arrancaba en un día que no existe.
  const fechas = useMemo(() => {
    if (!plan) return [] as Date[];
    if (!retroActivo) return proximasClases(unionDias, 12, hoy).filter(hayClaseReal).slice(0, 3);
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    desde.setDate(desde.getDate() - 60);
    return proximasClases(unionDias, 40, desde)
      .filter((d) => isoFecha(d) <= isoFecha(hoy) && hayClaseReal(d))
      .slice(-6)
      .reverse();
  }, [plan, unionDias, hoy, retroActivo, hayClaseReal]);
  const fechaSel = fechas[Math.min(fechaIdx, Math.max(0, fechas.length - 1))] ?? null;
  const fechaFin = !fechaSel
    ? null
    : ilimitado
      ? plan?.cicloDias
        ? sumarDias(fechaSel, plan.cicloDias)
        : null
      : Nefectivo
        ? fechaClaseN(diasConteo, fechaSel, Nefectivo)
        : null;

  const saldoActual = cobro ? cobro.saldo : total;
  const pideCompromiso = total > 0 && saldoActual > 0;

  const yaTiene = titularId != null && !!plan && (planesActivosPorContacto[titularId] ?? []).includes(plan.id);
  const planCompleto = !!plan && (ilimitado ? !!plan.cicloDias : !!N && N > 0);

  const faltaPara = faltaParaInscripcion({
    contactoId: titularId,
    planId: plan?.id ?? null,
    planCompleto,
    yaTiene,
    diasElegidos: diasConteo.length,
    fechaInicio: fechaSel ? isoFecha(fechaSel) : null,
  });
  const faltaTexto = faltaPara ?? (cobro && !cobro.valido ? "revisar el cobro (monto, medio de pago o motivo del descuento)" : null);

  function reiniciar() {
    setTitularId(null);
    setTitularNombre("");
    setPlan(null);
    setDiasPorCurso({});
    setFechaIdx(0);
    setRetroActivo(false);
    setCobro(null);
    setFechaCompromiso("");
    setError(null);
  }
  // Cambiar de alumno reinicia TODO lo que viene después: una venta a medias no
  // puede quedar lista para guardarse sobre la persona equivocada.
  function elegirTitular(id: number, nombre: string) {
    if (id === titularId) return; // la tarjeta vuelve a avisar al cargar su detalle
    reiniciar();
    setTitularId(id);
    setTitularNombre(nombre);
  }

  function elegirPlan(p: PlanVenta) {
    setPlan(p);
    // Por defecto, todos los días de cada curso.
    const init: Record<number, number[]> = {};
    for (const c of p.cursos) init[c.id] = [...c.dias_semana];
    setDiasPorCurso(init);
    setFechaIdx(0);
    setRetroActivo(false);
    setCobro(null);
    setFechaCompromiso("");
    setError(null);
  }
  function toggleDia(cursoId: number, dia: number) {
    setDiasPorCurso((prev) => {
      const actual = prev[cursoId] ?? [];
      const next = actual.includes(dia) ? actual.filter((d) => d !== dia) : [...actual, dia].sort();
      return { ...prev, [cursoId]: next };
    });
    setFechaIdx(0);
  }

  function confirmar() {
    setError(null);
    if (faltaTexto || titularId == null || !plan || !fechaSel) return setError(`Falta ${faltaTexto ?? "completar la venta"}.`);
    const diasPorCursoOut = plan.cursos
      .map((cu) => ({ cursoId: cu.id, dias: diasPorCurso[cu.id] ?? [] }))
      .filter((x) => x.dias.length > 0);
    // El plan ya viene en `res.datos`: acá solo va lo que el servidor no devuelve.
    const resumenLocal = [{ etiqueta: "Alumno", valor: titularNombre }];
    startTransition(async () => {
      const res = await inscribirYCobrar({
        contactoId: titularId,
        planId: plan.id,
        fechaInicio: isoFecha(fechaSel),
        diasPorCurso: diasPorCursoOut,
        cobro: cobroParaServidor(cobro, total, fechaCompromisoEfectiva(fechaCompromiso, diasCompromiso)),
      });
      if (res.error) return setError(res.error);
      setCerrada({
        datos: [...resumenLocal, ...(res.datos ?? [])],
        avisos: res.avisoAlumno ? [res.avisoAlumno] : [],
      });
      reiniciar();
      router.refresh();
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (cerrada) return <ConfirmacionVenta titulo="Inscripción registrada" datos={cerrada.datos} avisos={cerrada.avisos} onNueva={() => setCerrada(null)} />;

  if (planes.length === 0)
    return (
      <div className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-6">
        <p className="text-base">No hay planes activos para inscribir.</p>
        <p className="text-sm text-[var(--texto-tenue)] mt-1">Cargá uno en Gestión → Planes.</p>
      </div>
    );

  const titularListo = titularId != null;
  const planListo = titularListo && !!plan;
  const cobroListo = planListo && diasConteo.length > 0 && !!fechaSel;
  const cursosActuales = titularId != null ? (cursosPorContacto[titularId] ?? []) : [];

  return (
    <div className="space-y-4">
      {/* 1 · Alumno */}
      <BloqueVenta numero={1} titulo="Alumno" estado="activo">
        <TitularVenta
          modulo="inscripciones"
          matriz={matriz}
          listas={listasContacto}
          puedeVerPrivados={puedeVerPrivados}
          permiteOrganizacion={false}
          rolQueAdquiere="alumno"
          permiteMenor
          titularId={titularId}
          onElegido={(c) => {
            if (c) elegirTitular(c.id, c.nombre);
            else reiniciar();
          }}
        />
        {titularListo && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Mini etiqueta="Deuda anterior" valor={gs(deudaPorContacto[titularId] ?? 0)} />
            <Mini etiqueta="Ya inscripto en" valor={cursosActuales.length ? cursosActuales.join(" · ") : "Ningún curso todavía"} />
          </div>
        )}
      </BloqueVenta>

      {/* 2 · Plan */}
      <BloqueVenta
        numero={2}
        titulo="Plan"
        estado={!titularListo ? "bloqueado" : plan ? "completo" : "activo"}
        bloqueo="Primero elegí el alumno."
        resumen={
          plan && (
            <div className="space-y-2">
              <p className="text-base">
                <span className="font-medium">{plan.nombre}</span>{" "}
                <span className="text-sm text-[var(--texto-tenue)]">
                  · {ilimitado ? "ilimitado" : N ? `${N} clases` : "sin cantidad de clases"} · {gs(plan.precio)}
                </span>
              </p>
              {yaTiene && (
                <div className="rounded-[var(--radio-panel)] border border-[var(--primario)] bg-[var(--accent-100)] px-4 py-3 text-sm text-[var(--peligro-texto)]">
                  Este alumno ya tiene una membresía activa de este plan. La renovación se hará desde su membresía
                  (próximamente); acá no se duplica.
                </div>
              )}
            </div>
          )
        }
        onCambiar={() => {
          setPlan(null);
          setDiasPorCurso({});
          setFechaIdx(0);
          setRetroActivo(false);
          setCobro(null);
        }}
      >
        <div className="space-y-2">
          {planes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegirPlan(p)}
              className="w-full flex items-center gap-3 text-left rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] border border-[var(--borde)] px-4 py-3 hover:border-[var(--primario)]"
            >
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold">{p.nombre}</div>
                <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
                  {p.cursos.map((c) => c.nombre).join(" · ")}
                  {p.ilimitado ? " · ilimitado" : p.cantidadClases ? ` · ${p.cantidadClases} clases` : ""}
                </div>
              </div>
              <div className="text-base font-bold shrink-0">{gs(p.precio)}</div>
            </button>
          ))}
        </div>
      </BloqueVenta>

      {/* 3 · Días y fecha de inicio (se queda abierto: la persona los ajusta hasta cobrar) */}
      <BloqueVenta numero={3} titulo="Días y fecha de inicio" estado={planListo ? "activo" : "bloqueado"} bloqueo="Primero elegí el plan.">
        {plan && (
          <div className="space-y-4">
            {plan.cursos.map((c) => (
              <div key={c.id}>
                <div className="text-sm text-[var(--texto-tenue)] mb-1.5">
                  {c.nombre}
                  {c.hora ? ` · ${c.hora.slice(0, 5)}` : ""} — qué días toma
                </div>
                {c.dias_semana.length === 0 ? (
                  <div className="text-sm text-[var(--peligro-texto)]">Este curso no tiene días cargados (revisá el curso).</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {c.dias_semana.map((d) => {
                      const on = (diasPorCurso[c.id] ?? []).includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDia(c.id, d)}
                          className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
                            on
                              ? "bg-[var(--exito-fill)] text-[var(--exito-texto)] border-[var(--exito)] font-medium"
                              : "bg-[var(--fondo-panel)] text-[var(--texto-tenue)] border-[var(--borde)] hover:border-[var(--primario)]"
                          }`}
                        >
                          {on ? "✓ " : ""}
                          {DIAS_LARGOS[d]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            <div className="text-sm text-[var(--texto-tenue)]">
              {diasConteo.length > 0
                ? `${diasConteo.length} ${diasConteo.length === 1 ? "clase" : "clases"} por semana · ${etiquetaDias(unionDias)}`
                : "Elegí al menos un día."}
            </div>

            <div>
              <div className="text-sm text-[var(--texto-tenue)] mb-1.5">Empieza a tomar clases</div>
              <div className="flex flex-wrap gap-2">
                {fechas.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFechaIdx(i)}
                    className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
                      fechaIdx === i
                        ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                        : "border-[var(--borde)] hover:border-[var(--primario)]"
                    }`}
                  >
                    {esHoy(f, hoy) ? "hoy " : ""}
                    {fechaLarga(f)}
                  </button>
                ))}
                {fechas.length === 0 && (
                  <span className="text-sm text-[var(--texto-tenue)]">
                    {retroActivo
                      ? "No hay clases dictadas en los últimos dos meses para esos días."
                      : diasConteo.length > 0
                        ? "No hay próximas clases dentro de la vigencia de esos cursos (revisá sus fechas de activación y baja en Cursos)."
                        : "Elegí días para ver fechas de inicio."}
                  </span>
                )}
              </div>
              {retroActivo && (
                <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
                  Clases que ya se dictaron. Se usa para reconstruir un ciclo cuyo registro se omitió en su momento.
                </p>
              )}

              <div className="mt-3">
                <Toggle
                  checked={retroActivo}
                  onChange={(v) => {
                    setRetroActivo(v);
                    setFechaIdx(0);
                    setError(null);
                  }}
                  label="Fecha retroactiva"
                  descripcion="Para registrar una inscripción pasada que se omitió, con su fecha real."
                />
              </div>

              {creditoPrueba > 0 && credito && (
                <div className="mt-3 rounded-[var(--radio-panel)] border border-[var(--exito)] bg-[var(--exito-fill)] text-[var(--exito-texto)] px-4 py-2.5 text-sm">
                  Se le acredita su <strong>clase de prueba</strong> del {fechaLarga(new Date(credito.fecha + "T00:00:00"))}: {gs(creditoPrueba)} sobre{" "}
                  {gs(precioPlan)}. A cobrar <strong>{gs(precioPlan - creditoPrueba)}</strong>.
                  {credito.personas > 1 && (
                    <>
                      {" "}
                      Es <strong>su parte</strong> de {gs(credito.pagado)} que pagaron {credito.personas} personas: al resto del grupo le queda la suya hasta la
                      misma fecha.
                    </>
                  )}
                </div>
              )}

              {bono > 0 && (
                <div className="mt-3 rounded-[var(--radio-panel)] border border-[var(--exito)] bg-[var(--exito-fill)] text-[var(--exito-texto)] px-4 py-2.5 text-sm">
                  Se aplicará bono de tolerancia: <strong>+{bono} {bono === 1 ? "clase" : "clases"}</strong> por falta{bono === 1 ? "" : "s"} con licencia del ciclo
                  anterior. El nuevo ciclo es de <strong>{Nefectivo} clases</strong> (incluye la clase de tolerancia).
                </div>
              )}

              <div className="text-sm text-[var(--texto-tenue)] mt-2">
                {retroActivo && !fechaSel
                  ? "Elegí la fecha real de inicio."
                  : ilimitado
                    ? `Membresía ilimitada.${fechaFin ? ` Termina el ${fechaLarga(fechaFin)}.` : ""}`
                    : Nefectivo
                      ? `Membresía de ${Nefectivo} clases${bono > 0 ? ` (${N} + ${bono} bono)` : ""}.${fechaFin ? ` Termina aprox. el ${fechaLarga(fechaFin)}.` : ""}`
                      : "El plan no tiene N de clases cargado."}
              </div>
            </div>
          </div>
        )}
      </BloqueVenta>

      {/* 4 · Cobro */}
      <BloqueVenta numero={4} titulo="Cobro del ciclo" estado={cobroListo ? "activo" : "bloqueado"} bloqueo="Primero elegí los días y la fecha de inicio.">
        {plan && (
          <>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-base text-[var(--texto-tenue)]">
                {plan.nombre}
                {ilimitado ? " · ilimitado" : N ? ` · ${N} clases` : ""}
              </span>
              <span className="ml-auto titulo text-2xl">{gs(total)}</span>
            </div>
            <Cobro
              sujeto={titularNombre}
              detalle={plan.nombre}
              referencia={total}
              referenciaLabel="Precio del plan"
              credito={
                creditoPrueba > 0 && credito
                  ? {
                      monto: creditoPrueba,
                      motivo:
                        `Crédito de su clase de prueba del ${fechaLarga(new Date(credito.fecha + "T00:00:00"))}` +
                        (credito.personas > 1 ? ` (su parte de ${gs(credito.pagado)} entre ${credito.personas} personas)` : ""),
                    }
                  : null
              }
              politica="descuento"
              direccion="cobro"
              medios={medios}
              cuentaId={`${titularId ?? 0}·${plan.id}·${fechaIdx}·${plan.cursos.map((c) => (diasPorCurso[c.id] ?? []).join("")).join("-")}`}
              onChange={(p) => {
                setCobro(p);
                setError(null);
              }}
            />
            {pideCompromiso && <FechaCompromiso valor={fechaCompromiso} diasCompromiso={diasCompromiso} onChange={setFechaCompromiso} />}
          </>
        )}
      </BloqueVenta>

      <BarraVenta falta={faltaTexto} total={plan ? gs(total) : null} etiqueta="Inscribir" pendiente={pendiente} error={error} onConfirmar={confirmar} />
    </div>
  );
}

function sumarDias(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

function esHoy(d: Date, hoy: Date): boolean {
  return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();
}

function Mini({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-[var(--radio-chico)] bg-[var(--fondo-panel)] border border-[var(--borde)] px-3 py-2">
      <div className="text-xs text-[var(--texto-tenue)]">{etiqueta}</div>
      <div className="text-sm font-semibold mt-0.5 leading-tight">{valor}</div>
    </div>
  );
}
