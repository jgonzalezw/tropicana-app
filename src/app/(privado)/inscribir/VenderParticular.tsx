"use client";

/**
 * Vender un plan de particulares (C3, hito H2; rearmada en E2 de "Ventas y
 * contactos con el mismo comportamiento").
 *
 * Usa las piezas comunes de venta (`components/venta`, `components/contacto`):
 * el mismo esqueleto de pasos, titular, agenda con revisión automática,
 * cobro, barra con el primer faltante y confirmación que usan todas las
 * ventas. Lo intrínseco de la particular: el titular es una **persona** que
 * **adquiere el rol alumno** al comprar; el **profesor** (la agenda también
 * valida su ocupación); acompañantes si el plan los registra; la
 * **cortesía** si el plan la permite; y dos avisos (al alumno o su tutor, y
 * al profesor).
 *
 * Lo que se personaliza al vender (definiciones-v2 §7, H1): el tramo de horas
 * (de `tarifas_particular`, según el estilo de la plantilla), el profesor, la
 * sala —propia o externa— y la primera reserva. Con agenda **fija** se genera
 * el calendario completo; con **flexible**, solo la primera sesión.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatearHoras, horaAlineada } from "@/lib/horarios";
import { gs, isoFecha } from "@/lib/inscripcion";
import { faltaParaParticular } from "@/lib/venta/faltantes";
import { cobroParaServidor } from "@/lib/venta/cobro";
import type { AgendaValor } from "@/lib/venta/agenda";
import type { ListasContacto, MatrizMinimo } from "@/lib/tipos";
import Cobro, { type PayloadCobro } from "@/components/Cobro";
import TitularVenta from "@/components/contacto/TitularVenta";
import BloqueVenta from "@/components/venta/BloqueVenta";
import BarraVenta from "@/components/venta/BarraVenta";
import AgendaReservas, { type ResultadoRevision } from "@/components/venta/AgendaReservas";
import ConfirmacionVenta, { type AvisoVenta } from "@/components/venta/ConfirmacionVenta";
import FechaCompromiso, { fechaCompromisoEfectiva } from "@/components/venta/FechaCompromiso";
import { venderParticular, previsualizarParticular, type EntradaParticular, type EntradaAgendaParticular } from "./acciones";

export type PlanParticular = {
  id: number;
  nombre: string;
  estilo: string;
  reservaModalidad: "fija" | "flexible" | null;
  salasModo: "todas" | "solo";
  registraAcompanantes: boolean;
  permiteSalaExterna: boolean;
  permiteCortesia: boolean;
  formaPagoProfesor: "fee_hora" | "pct_margen" | "monto_fijo" | null;
};
export type TarifaParticularVenta = { id: number; nombre: string; estilo: string; horas: number; precio: number };
export type ProfesorParticular = { id: number; nombre: string; whatsapp: string | null };
export type SalaVenta = { id: number; nombre: string; esExterna: boolean; activa: boolean };

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base w-full";

type Cerrada = { datos: { etiqueta: string; valor: string }[]; avisos: AvisoVenta[] };

export default function VenderParticular({
  planes,
  tarifas,
  profesoresPorEstilo,
  salas,
  salaIdsPorPlan,
  medios,
  diasCompromiso,
  incrementoMin,
  minimoMin,
  matriz,
  listasContacto,
  puedeVerPrivados,
}: {
  planes: PlanParticular[];
  tarifas: TarifaParticularVenta[];
  profesoresPorEstilo: Record<string, ProfesorParticular[]>;
  salas: SalaVenta[];
  salaIdsPorPlan: Record<number, number[]>;
  medios: string[];
  diasCompromiso: number;
  incrementoMin: number;
  minimoMin: number;
  matriz: MatrizMinimo[];
  listasContacto: ListasContacto;
  puedeVerPrivados: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [titularId, setTitularId] = useState<number | null>(null);
  const [titularNombre, setTitularNombre] = useState("");
  const [plan, setPlan] = useState<PlanParticular | null>(null);
  const [tarifaId, setTarifaId] = useState<number | null>(null);
  const [esCortesia, setEsCortesia] = useState(false);
  const [cortesiaMotivo, setCortesiaMotivo] = useState("");
  const [profesorId, setProfesorId] = useState<number | null>(null);
  const [acompanantes, setAcompanantes] = useState("0");
  const hoy = useMemo(() => new Date(), []);
  const agendaInicial: AgendaValor = {
    salaTipo: "propia",
    salaId: null,
    nombreExterna: "",
    fechaInicio: isoFecha(hoy),
    diasSemana: [],
    hora: "18:00",
    duracionMin: minimoMin,
  };
  const [agenda, setAgenda] = useState<AgendaValor>(agendaInicial);
  const [agendaListo, setAgendaListo] = useState(false);
  const [cobro, setCobro] = useState<PayloadCobro | null>(null);
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  const [cerrada, setCerrada] = useState<Cerrada | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tarifasDelPlan = plan ? tarifas.filter((t) => t.estilo === plan.estilo) : [];
  const tarifa = tarifasDelPlan.find((t) => t.id === tarifaId) ?? null;
  const profesores = (plan ? profesoresPorEstilo[plan.estilo] : undefined) ?? [];
  const profesor = profesores.find((p) => p.id === profesorId) ?? null;
  const salasPropias = salas
    .filter((s) => !s.esExterna && s.activa)
    .filter((s) => !plan || plan.salasModo === "todas" || (salaIdsPorPlan[plan.id] ?? []).includes(s.id))
    .map((s) => ({ id: s.id, nombre: s.nombre }));
  const total = esCortesia ? 0 : (tarifa?.precio ?? 0);
  const personas = 1 + Math.max(0, Math.trunc(Number(acompanantes) || 0));
  const esFija = plan?.reservaModalidad === "fija";
  const faltaSaldo = cobro ? cobro.saldo > 0 : false;

  function elegirTitular(id: number, nombre: string) {
    if (id === titularId) return; // la tarjeta vuelve a avisar al cargar su detalle
    setTitularId(id);
    setTitularNombre(nombre);
    setError(null);
  }

  function reiniciar() {
    setTitularId(null);
    setTitularNombre("");
    setPlan(null);
    setTarifaId(null);
    setEsCortesia(false);
    setCortesiaMotivo("");
    setProfesorId(null);
    setAcompanantes("0");
    setAgenda(agendaInicial);
    setAgendaListo(false);
    setCobro(null);
    setFechaCompromiso("");
    setError(null);
  }

  function elegirPlan(p: PlanParticular) {
    setPlan(p);
    setTarifaId(null);
    setEsCortesia(false);
    setCortesiaMotivo("");
    setProfesorId(null);
    setAcompanantes("0");
    setAgenda({ ...agendaInicial, fechaInicio: agenda.fechaInicio });
    setAgendaListo(false);
    setCobro(null);
    setError(null);
  }

  const faltaPara = faltaParaParticular({
    contactoId: titularId,
    planId: plan?.id ?? null,
    tarifaId,
    profesorId,
    salaTipo: agenda.salaTipo,
    salaId: agenda.salaId,
    nombreExterna: agenda.nombreExterna,
    fechaInicio: agenda.fechaInicio,
    esFija: !!esFija,
    diasSemana: agenda.diasSemana,
    hora: agenda.hora,
    horaAlineada: !!agenda.hora && horaAlineada(agenda.hora, incrementoMin),
    duracionMin: agenda.duracionMin,
    esCortesia,
    cortesiaMotivo,
  });

  const faltaTexto: string | null = faltaPara
    ? faltaPara
    : !agendaListo
      ? "una agenda disponible (revisión de la sala y del profesor)"
      : !esCortesia && cobro && !cobro.valido
        ? "revisar el cobro"
        : null;

  // Lo que manda `venderParticular`, sin el cobro: la revisión de la agenda
  // consulta con esto.
  function entradaDe(v: AgendaValor): EntradaAgendaParticular | null {
    if (titularId == null || !plan || !tarifa || profesorId == null) return null;
    return {
      contactoId: titularId,
      planId: plan.id,
      tarifaParticularId: tarifa.id,
      profesorId,
      sala:
        v.salaTipo === "propia"
          ? {
              tipo: "propia",
              salaId: v.salaId!,
              ...(plan.permiteSalaExterna && v.nombreExterna.trim() ? { lugarExternoOpcional: v.nombreExterna.trim() } : {}),
            }
          : { tipo: "externa", nombreDescriptivo: v.nombreExterna.trim() },
      acompanantes: personas - 1,
      fechaInicio: v.fechaInicio,
      agenda: esFija
        ? { modalidad: "fija", diasSemana: v.diasSemana, hora: v.hora, duracionMin: v.duracionMin }
        : { modalidad: "flexible", hora: v.hora, duracionMin: v.duracionMin },
      // Placeholder estable: que cambie la glosa no invalida la revisión ya hecha.
      ...(esCortesia ? { cortesia: { motivo: "cortesía" } } : {}),
    };
  }

  async function revisar(v: AgendaValor): Promise<ResultadoRevision> {
    const e = entradaDe(v);
    if (!e) return { error: "Faltan datos de la venta para revisar la agenda." };
    const r = await previsualizarParticular(e);
    return { error: r.error, sesiones: r.sesiones, horas: r.horasContratadas, leftoverMin: r.leftoverMin, todasOk: r.todasOk };
  }

  function confirmar() {
    setError(null);
    const e = entradaDe(agenda);
    if (!e || faltaTexto) return setError(`Falta ${faltaTexto ?? "completar la venta"}.`);
    const entrada: EntradaParticular = {
      ...e,
      ...(esCortesia ? { cortesia: { motivo: cortesiaMotivo.trim() } } : {}),
      cobro: esCortesia
        ? { modo: "sin", monto: 0, medio: null, notaMedio: "", ajuste: 0, ajusteMotivo: "", total: 0, saldo: 0, fechaCompromiso: null }
        : cobroParaServidor(cobro, total, fechaCompromisoEfectiva(fechaCompromiso, diasCompromiso)),
    };
    const resumenLocal = [
      { etiqueta: "Titular", valor: titularNombre },
      { etiqueta: "Plan", valor: plan?.nombre ?? "" },
      { etiqueta: "Horas", valor: tarifa ? `${formatearHoras(tarifa.horas)} h` : "" },
      { etiqueta: "Profesor", valor: profesor?.nombre ?? "" },
      { etiqueta: esCortesia ? "Cortesía" : "Total", valor: esCortesia ? "no se cobra" : gs(total) },
    ];
    startTransition(async () => {
      const res = await venderParticular(entrada);
      if (res.error) return setError(res.error);
      const avisos: AvisoVenta[] = [];
      if (res.avisoAlumno) avisos.push(res.avisoAlumno);
      if (res.avisoProfesor) avisos.push({ ...res.avisoProfesor, nombre: `Profesor: ${res.avisoProfesor.nombre}` });
      setCerrada({
        datos: [...resumenLocal, { etiqueta: "Registro", valor: res.resumen ?? "Membresía particular registrada." }],
        avisos,
      });
      reiniciar();
      router.refresh();
    });
  }

  if (planes.length === 0)
    return (
      <div className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-6">
        <p className="text-base">Todavía no hay ningún plan de clases particulares para vender.</p>
        <p className="text-sm text-[var(--texto-tenue)] mt-1">Se crean en Planes → Clases particulares.</p>
      </div>
    );

  if (cerrada)
    return <ConfirmacionVenta titulo="Clase particular registrada" datos={cerrada.datos} avisos={cerrada.avisos} onNueva={() => setCerrada(null)} />;

  const campoAcompanantes = (
    <label className="block max-w-[260px]">
      <span className="block text-base font-medium mb-1.5">¿Cuántos vienen con el titular?</span>
      <input
        value={acompanantes}
        onChange={(e) => {
          setAcompanantes(e.target.value.replace(/\D/g, ""));
          setAgendaListo(false);
        }}
        inputMode="numeric"
        className="entrada"
      />
      <span className="block text-sm text-[var(--texto-tenue)] mt-1.5">
        Son {personas} {personas === 1 ? "persona" : "personas"} en total.
      </span>
    </label>
  );

  const titularListo = titularId != null;
  const planListo = titularListo && !!plan && !!tarifa;
  const profesorListo = planListo && !!profesor;

  return (
    <div className="space-y-4">
      {/* 1 · Titular */}
      <BloqueVenta numero={1} titulo="Titular" estado="activo">
        <TitularVenta
          modulo="particulares"
          matriz={matriz}
          listas={listasContacto}
          puedeVerPrivados={puedeVerPrivados}
          permiteOrganizacion={false}
          rolQueAdquiere="alumno"
          titularId={titularId}
          onElegido={(c) => {
            if (c) elegirTitular(c.id, c.nombre);
            else reiniciar();
          }}
        />
      </BloqueVenta>

      {/* 2 · Plan y tramo de horas */}
      <BloqueVenta
        numero={2}
        titulo="Plan y tramo de horas"
        estado={!titularListo ? "bloqueado" : planListo ? "completo" : "activo"}
        bloqueo="Primero elegí el titular."
        resumen={
          plan &&
          tarifa && (
            <div className="space-y-2">
              <p className="text-base">
                <span className="font-medium">{plan.nombre}</span>{" "}
                <span className="text-sm text-[var(--texto-tenue)]">
                  · {tarifa.nombre} · {formatearHoras(tarifa.horas)} h · {esCortesia ? "cortesía" : gs(tarifa.precio)}
                </span>
              </p>
              {plan.permiteCortesia && (
                <div>
                  <label className="flex items-center gap-2 text-base">
                    <input
                      type="checkbox"
                      checked={esCortesia}
                      onChange={(e) => {
                        setEsCortesia(e.target.checked);
                        setCobro(null);
                      }}
                    />
                    Es una membresía de cortesía (no se cobra, no le devenga nada a nadie)
                  </label>
                  {esCortesia && (
                    <label className="block mt-2">
                      <span className="block text-sm text-[var(--texto-tenue)] mb-1">Motivo de la cortesía (quién la otorga, por qué)</span>
                      <input
                        value={cortesiaMotivo}
                        onChange={(e) => setCortesiaMotivo(e.target.value)}
                        placeholder="Ej. cortesía de bienvenida, autorizada por Javier"
                        className={control}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          )
        }
        onCambiar={() => {
          setPlan(null);
          setTarifaId(null);
          setEsCortesia(false);
          setCortesiaMotivo("");
          setProfesorId(null);
          setAgendaListo(false);
          setCobro(null);
        }}
      >
        <div className="space-y-2">
          {planes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegirPlan(p)}
              className={`w-full text-left px-4 py-3 rounded-[var(--radio-control)] border ${
                plan?.id === p.id ? "border-[var(--primario)] bg-[var(--fondo-elevado)]" : "border-[var(--borde)] hover:border-[var(--primario)]"
              }`}
            >
              <div className="text-base font-medium">{p.nombre}</div>
              <div className="text-sm text-[var(--texto-tenue)]">
                {p.estilo} · agenda {p.reservaModalidad === "fija" ? "fija" : "flexible"}
              </div>
            </button>
          ))}
        </div>
        {plan && (
          <div className="mt-4">
            <span className="block text-base font-medium mb-1.5">Tramo de horas</span>
            {tarifasDelPlan.length === 0 ? (
              <p className="text-sm text-[var(--peligro)]">
                No hay tramos de horas cargados para el estilo &quot;{plan.estilo}&quot;. Se cargan en Precios y paquetes.
              </p>
            ) : (
              <div className="space-y-2">
                {tarifasDelPlan.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTarifaId(t.id);
                      setAgendaListo(false);
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] flex items-baseline justify-between gap-3"
                  >
                    <span>
                      {t.nombre} · {formatearHoras(t.horas)} h
                    </span>
                    <span className="tabular-nums">{gs(t.precio)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </BloqueVenta>

      {/* 3 · Profesor */}
      <BloqueVenta
        numero={3}
        titulo="Profesor"
        estado={!planListo ? "bloqueado" : profesorListo ? "completo" : "activo"}
        bloqueo="Primero elegí el plan y el tramo de horas."
        resumen={
          profesor && (
            <div className="space-y-2">
              <p className="text-base">
                <span className="font-medium">{profesor.nombre}</span>
              </p>
              {plan?.registraAcompanantes && campoAcompanantes}
            </div>
          )
        }
        onCambiar={() => {
          setProfesorId(null);
          setAgendaListo(false);
        }}
      >
        {plan && (
          <div className="space-y-4">
            {profesores.length === 0 ? (
              <p className="text-sm text-[var(--peligro)]">Ningún profesor tiene cargado el estilo &quot;{plan.estilo}&quot;.</p>
            ) : (
              <div className="space-y-2">
                {profesores.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProfesorId(p.id);
                      setAgendaListo(false);
                    }}
                    className="w-full text-left px-4 py-2.5 rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
            {plan.registraAcompanantes && campoAcompanantes}
          </div>
        )}
      </BloqueVenta>

      {/* 4 · Sala y horario */}
      <BloqueVenta numero={4} titulo="Sala y horario" estado={profesorListo ? "activo" : "bloqueado"} bloqueo="Primero elegí el profesor.">
        {plan && tarifa && profesor && (
          <AgendaReservas
            valor={agenda}
            onChange={setAgenda}
            onEstado={(e) => setAgendaListo(e.listo)}
            salasPropias={salasPropias}
            permiteExterna={plan.permiteSalaExterna}
            esFija={!!esFija}
            horasPaquete={tarifa.horas}
            incrementoMin={incrementoMin}
            minimoMin={minimoMin}
            revisar={revisar}
            firmaExtra={`${plan.id}:${tarifa.id}:${profesor.id}:${personas}:${esCortesia}`}
          />
        )}
      </BloqueVenta>

      {/* 5 · Cobro (una membresía de cortesía no cobra nada) */}
      <BloqueVenta
        numero={5}
        titulo="Cobro"
        estado={esCortesia && profesorListo ? "completo" : profesorListo && agendaListo ? "activo" : "bloqueado"}
        bloqueo="Primero dejá la agenda disponible."
        resumen={<p className="text-base">Cortesía: no se cobra ni devenga nada.</p>}
      >
        {plan && tarifa && !esCortesia && (
          <>
            <Cobro
              sujeto={titularNombre}
              detalle={`${plan.nombre} · ${formatearHoras(tarifa.horas)} h`}
              referencia={total}
              referenciaLabel="Precio del paquete"
              politica="descuento"
              direccion="cobro"
              medios={medios}
              permitirSinCobro
              cuentaId={`particular:${plan.id}:${tarifa.id}`}
              onChange={setCobro}
            />
            {faltaSaldo && <FechaCompromiso valor={fechaCompromiso} diasCompromiso={diasCompromiso} onChange={setFechaCompromiso} />}
          </>
        )}
      </BloqueVenta>

      <BarraVenta
        falta={faltaTexto}
        total={esCortesia ? null : tarifa ? gs(total) : null}
        etiqueta={esCortesia ? "Otorgar cortesía" : "Vender"}
        pendiente={pendiente}
        error={error}
        onConfirmar={confirmar}
      />
    </div>
  );
}
