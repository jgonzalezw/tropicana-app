"use client";

/**
 * Vender un plan de alquiler de sala (C3, hito H7).
 *
 * Armada con las piezas comunes de venta (`components/venta`, `components/
 * contacto`): el mismo esqueleto de pasos, titular, agenda con revisión
 * automática, cobro, barra con el primer faltante y confirmación que usan
 * todas las ventas. Lo intrínseco del alquiler: el titular puede ser una
 * **organización** (con NIT) y **no adquiere el rol alumno**; el precio
 * **sale de la tabla** de Precios y paquetes (categoría × tamaño × horas); la
 * categoría la propone el sistema y dice por qué (regla 24).
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatearHoras, horaAlineada } from "@/lib/horarios";
import { gs, isoFecha } from "@/lib/inscripcion";
import { costoDeSala, tamanoPorPersonas, type CategoriaSala, type TamanoSala, type TarifaSala } from "@/lib/sala";
import { faltaParaAlquiler } from "@/lib/ventaAlquiler";
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
import type { SalaVenta } from "./VenderParticular";
import {
  categoriaPropuestaDe,
  previsualizarAlquiler,
  venderAlquiler,
  type EntradaAgendaAlquiler,
  type EntradaAlquiler,
} from "./accionesAlquiler";

export type PlanAlquiler = {
  id: number;
  nombre: string;
  reservaModalidad: "fija" | "flexible" | null;
  salasModo: "todas" | "solo";
  permiteSalaExterna: boolean;
  vigenciaDias: number | null;
};
export type PaqueteHoras = { id: number; horas: number };

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base w-full";

type Cerrada = { datos: { etiqueta: string; valor: string }[]; avisos: AvisoVenta[] };

export default function VenderAlquiler({
  planes,
  paquetes,
  tarifas,
  tamanos,
  etiquetasCategoria,
  modoCategoria,
  salas,
  salaIdsPorPlan,
  medios,
  diasCompromiso,
  incrementoMin,
  minimoMin,
  matriz,
  listas,
  puedeVerPrivados,
}: {
  planes: PlanAlquiler[];
  paquetes: PaqueteHoras[];
  tarifas: TarifaSala[];
  tamanos: TamanoSala[];
  etiquetasCategoria: Record<CategoriaSala, string>;
  modoCategoria: "automatica" | "editable";
  salas: SalaVenta[];
  salaIdsPorPlan: Record<number, number[]>;
  medios: string[];
  diasCompromiso: number;
  incrementoMin: number;
  minimoMin: number;
  matriz: MatrizMinimo[];
  listas: ListasContacto;
  puedeVerPrivados: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [titularId, setTitularId] = useState<number | null>(null);
  const [titularNombre, setTitularNombre] = useState("");
  const [propuesta, setPropuesta] = useState<{ categoria: CategoriaSala; motivo: string } | null>(null);
  const [categoria, setCategoria] = useState<CategoriaSala | null>(null);
  const [glosaCategoria, setGlosaCategoria] = useState("");
  const [plan, setPlan] = useState<PlanAlquiler | null>(null);
  const [personas, setPersonas] = useState("1");
  const [paqueteId, setPaqueteId] = useState<number | null>(null);
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

  async function elegirTitular(id: number, nombre: string) {
    if (id === titularId) return; // la tarjeta vuelve a avisar al cargar su detalle
    setTitularId(id);
    setTitularNombre(nombre);
    setError(null);
    setPropuesta(null);
    setCategoria(null);
    setGlosaCategoria("");
    const r = await categoriaPropuestaDe(id);
    if (r.error || !r.categoria) {
      setError(r.error ?? "No se pudo proponer la categoría.");
      return;
    }
    setPropuesta({ categoria: r.categoria, motivo: r.motivo ?? "" });
    setCategoria(r.categoria);
  }

  function reiniciar() {
    setTitularId(null);
    setTitularNombre("");
    setPropuesta(null);
    setCategoria(null);
    setGlosaCategoria("");
    setPlan(null);
    setPaqueteId(null);
    setPersonas("1");
    setAgenda(agendaInicial);
    setAgendaListo(false);
    setCobro(null);
    setFechaCompromiso("");
    setError(null);
  }

  function elegirPlan(p: PlanAlquiler) {
    setPlan(p);
    setPaqueteId(null);
    setAgenda({ ...agendaInicial, fechaInicio: agenda.fechaInicio });
    setAgendaListo(false);
    setCobro(null);
    setError(null);
  }

  const personasN = Math.max(0, Math.trunc(Number(personas) || 0));
  const tamano = tamanoPorPersonas(tamanos, personasN);
  const salasPropias = salas
    .filter((s) => !s.esExterna && s.activa)
    .filter((s) => !plan || plan.salasModo === "todas" || (salaIdsPorPlan[plan.id] ?? []).includes(s.id))
    .map((s) => ({ id: s.id, nombre: s.nombre }));

  // Precio de cada paquete con lo elegido hasta ahora — se lee de la tabla.
  const precioDe = (horas: number): { precio: number | null; motivo?: string } => {
    if (!categoria || !tamano) return { precio: null, motivo: "Elegí la categoría y la cantidad de personas." };
    const r = costoDeSala(tarifas, categoria, tamano, horas, agenda.salaTipo === "propia" ? agenda.salaId : null, (c) => etiquetasCategoria[c]);
    return r.precio == null ? { precio: null, motivo: r.motivo } : { precio: r.precio };
  };
  const paquete = paquetes.find((p) => p.id === paqueteId) ?? null;
  const precio = paquete ? precioDe(paquete.horas).precio : null;
  const esFija = plan?.reservaModalidad === "fija";
  const faltaSaldo = cobro ? cobro.saldo > 0 : false;

  const faltaPara = faltaParaAlquiler({
    contactoId: titularId,
    planId: plan?.id ?? null,
    horasPaqueteId: paqueteId,
    personas: personasN,
    categoria,
    categoriaPropuesta: propuesta?.categoria ?? null,
    categoriaGlosa: glosaCategoria,
    salaTipo: agenda.salaTipo,
    salaId: agenda.salaId,
    nombreExterna: agenda.nombreExterna,
    fechaInicio: agenda.fechaInicio,
    esFija,
    diasSemana: agenda.diasSemana,
    hora: agenda.hora,
    horaAlineada: !!agenda.hora && horaAlineada(agenda.hora, incrementoMin),
    duracionMin: agenda.duracionMin,
  });

  function entradaDe(v: AgendaValor): EntradaAgendaAlquiler | null {
    if (titularId == null || !plan || paqueteId == null || !categoria) return null;
    return {
      contactoId: titularId,
      planId: plan.id,
      horasPaqueteId: paqueteId,
      personas: personasN,
      categoria,
      ...(categoria !== propuesta?.categoria ? { categoriaGlosa: glosaCategoria.trim() } : {}),
      sala:
        v.salaTipo === "propia"
          ? { tipo: "propia", salaId: v.salaId! }
          : { tipo: "externa", nombreDescriptivo: v.nombreExterna.trim() },
      fechaInicio: v.fechaInicio,
      agenda: esFija
        ? { modalidad: "fija", diasSemana: v.diasSemana, hora: v.hora, duracionMin: v.duracionMin }
        : { modalidad: "flexible", hora: v.hora, duracionMin: v.duracionMin },
    };
  }

  async function revisar(v: AgendaValor): Promise<ResultadoRevision> {
    const e = entradaDe(v);
    if (!e) return { error: "Faltan datos de la venta para revisar la agenda." };
    return previsualizarAlquiler(e);
  }

  const faltaTexto: string | null = faltaPara
    ? faltaPara
    : precio == null
      ? "un precio en la tabla de alquiler"
      : !agendaListo
        ? "una agenda disponible (revisión de la sala)"
        : cobro && !cobro.valido
          ? "revisar el cobro"
          : null;

  function confirmar() {
    setError(null);
    const e = entradaDe(agenda);
    if (!e || precio == null || faltaTexto) return setError(`Falta ${faltaTexto ?? "completar la venta"}.`);
    const entrada: EntradaAlquiler = {
      ...e,
      cobro: cobroParaServidor(cobro, precio, fechaCompromisoEfectiva(fechaCompromiso, diasCompromiso)),
    };
    const resumenLocal = [
      { etiqueta: "Titular", valor: titularNombre },
      { etiqueta: "Plan", valor: plan?.nombre ?? "" },
      { etiqueta: "Horas", valor: paquete ? `${formatearHoras(paquete.horas)} h` : "" },
      { etiqueta: "Categoría", valor: categoria ? etiquetasCategoria[categoria] : "" },
      { etiqueta: "Total", valor: gs(precio) },
    ];
    startTransition(async () => {
      const res = await venderAlquiler(entrada);
      if (res.error) return setError(res.error);
      setCerrada({
        datos: [...resumenLocal, { etiqueta: "Registro", valor: res.resumen ?? "Alquiler registrado." }],
        avisos: res.aviso ? [res.aviso] : [],
      });
      reiniciar();
      router.refresh();
    });
  }

  if (planes.length === 0)
    return (
      <div className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-6">
        <p className="text-base">Todavía no hay ningún plan de alquiler de sala para vender.</p>
        <p className="text-sm text-[var(--texto-tenue)] mt-1">Se crean en Planes → Alquiler de salas.</p>
      </div>
    );

  if (cerrada)
    return <ConfirmacionVenta titulo="Alquiler registrado" datos={cerrada.datos} avisos={cerrada.avisos} onNueva={() => setCerrada(null)} />;

  const titularListo = titularId != null && !!propuesta;
  const planListo = titularListo && !!plan;
  const paqueteListo = planListo && !!paquete && precio != null;

  return (
    <div className="space-y-4">
      {/* 1 · Titular */}
      <BloqueVenta numero={1} titulo="Titular" estado="activo">
        <TitularVenta
          modulo="alquileres"
          matriz={matriz}
          listas={listas}
          puedeVerPrivados={puedeVerPrivados}
          permiteOrganizacion
          rolQueAdquiere={null}
          titularId={titularId}
          onElegido={(c) => {
            if (c) void elegirTitular(c.id, c.nombre);
            else reiniciar();
          }}
        />
      </BloqueVenta>

      {/* 2 · Plan */}
      <BloqueVenta
        numero={2}
        titulo="Plan de alquiler"
        estado={!titularListo ? "bloqueado" : plan ? "completo" : "activo"}
        bloqueo="Primero elegí el titular."
        resumen={
          plan && (
            <p className="text-base">
              <span className="font-medium">{plan.nombre}</span>{" "}
              <span className="text-sm text-[var(--texto-tenue)]">
                · agenda {plan.reservaModalidad === "fija" ? "fija" : "flexible"}
                {plan.vigenciaDias ? ` · vigencia ${plan.vigenciaDias} días` : ""}
              </span>
            </p>
          )
        }
        onCambiar={() => {
          setPlan(null);
          setPaqueteId(null);
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
              className="w-full text-left px-4 py-3 rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)]"
            >
              <div className="text-base font-medium">{p.nombre}</div>
              <div className="text-sm text-[var(--texto-tenue)]">
                agenda {p.reservaModalidad === "fija" ? "fija" : "flexible"}
                {p.vigenciaDias ? ` · vigencia ${p.vigenciaDias} días` : ""}
              </div>
            </button>
          ))}
        </div>
      </BloqueVenta>

      {/* 3 · Categoría, personas y horas */}
      <BloqueVenta
        numero={3}
        titulo="Categoría, personas y horas"
        estado={!planListo ? "bloqueado" : paqueteListo ? "completo" : "activo"}
        bloqueo="Primero elegí el plan."
        resumen={
          paquete &&
          categoria &&
          precio != null && (
            <div className="space-y-2">
              <p className="text-base">
                <span className="font-medium">{formatearHoras(paquete.horas)} h</span> · {etiquetasCategoria[categoria]} · {personasN} personas ·{" "}
                <span className="tabular-nums">{gs(precio)}</span>
              </p>
              {propuesta && categoria !== propuesta.categoria && (
                <label className="block">
                  <span className="block text-sm text-[var(--texto-tenue)] mb-1">
                    Glosa del cambio de categoría (quién lo autoriza, por qué) — propuesta original: {etiquetasCategoria[propuesta.categoria]}
                  </span>
                  <input value={glosaCategoria} onChange={(e) => setGlosaCategoria(e.target.value)} className={control} />
                </label>
              )}
            </div>
          )
        }
        onCambiar={() => {
          setPaqueteId(null);
          setAgendaListo(false);
          setCobro(null);
        }}
      >
        {propuesta && categoria && (
          <div className="space-y-4">
            <div>
              <span className="block text-base font-medium mb-1.5">Categoría del cliente</span>
              <p className="text-sm text-[var(--texto-tenue)] mb-1.5">
                Propuesta: {etiquetasCategoria[propuesta.categoria]}. {propuesta.motivo}
              </p>
              {modoCategoria === "editable" ? (
                <>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaSala)} className={control}>
                    {(Object.keys(etiquetasCategoria) as CategoriaSala[]).map((c) => (
                      <option key={c} value={c}>
                        {etiquetasCategoria[c]}
                        {c === propuesta.categoria ? " (propuesta)" : ""}
                      </option>
                    ))}
                  </select>
                  {categoria !== propuesta.categoria && (
                    <label className="block mt-2">
                      <span className="block text-sm text-[var(--texto-tenue)] mb-1">
                        Glosa del cambio (quién lo autoriza, por qué) — la venta guarda también la propuesta original
                      </span>
                      <input value={glosaCategoria} onChange={(e) => setGlosaCategoria(e.target.value)} className={control} />
                    </label>
                  )}
                </>
              ) : (
                <p className="text-base">
                  {etiquetasCategoria[categoria]}{" "}
                  <span className="text-sm text-[var(--texto-tenue)]">— la fija el sistema (política de la academia: automática).</span>
                </p>
              )}
            </div>

            <label className="block max-w-[260px]">
              <span className="block text-base font-medium mb-1.5">¿Cuántas personas?</span>
              <input value={personas} onChange={(e) => setPersonas(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="entrada" />
              <span className="block text-sm text-[var(--texto-tenue)] mt-1.5">
                {tamano ? `Tamaño: ${tamano.etiqueta} (hasta ${tamano.max_personas}).` : "Más personas de las que cubre el tamaño más grande."}
              </span>
            </label>

            <div>
              <span className="block text-base font-medium mb-1.5">Paquete de horas</span>
              {paquetes.length === 0 ? (
                <p className="text-sm text-[var(--peligro)]">No hay paquetes de horas cargados. Se cargan en Precios y paquetes → Alquiler.</p>
              ) : (
                <div className="space-y-2">
                  {paquetes.map((p) => {
                    const r = precioDe(p.horas);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={r.precio == null}
                        onClick={() => {
                          setPaqueteId(p.id);
                          setAgendaListo(false);
                        }}
                        title={r.precio == null ? r.motivo : undefined}
                        className="w-full text-left px-4 py-2.5 rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] flex items-baseline justify-between gap-3 disabled:opacity-50"
                      >
                        <span>{formatearHoras(p.horas)} h</span>
                        <span className="tabular-nums">{r.precio == null ? "sin precio cargado" : gs(r.precio)}</span>
                      </button>
                    );
                  })}
                  {tamano && paquetes.every((p) => precioDe(p.horas).precio == null) && (
                    <p className="text-sm text-[var(--peligro)]">
                      Ninguna celda de {etiquetasCategoria[categoria]} × {tamano.etiqueta} tiene precio. Se carga en{" "}
                      <a href="/precios" target="_blank" rel="noreferrer" className="underline">
                        Precios y paquetes
                      </a>
                      .
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </BloqueVenta>

      {/* 4 · Sala y horario */}
      <BloqueVenta numero={4} titulo="Sala y horario" estado={paqueteListo ? "activo" : "bloqueado"} bloqueo="Primero elegí el paquete de horas.">
        {plan && paquete && (
          <AgendaReservas
            valor={agenda}
            onChange={setAgenda}
            onEstado={(e) => setAgendaListo(e.listo)}
            salasPropias={salasPropias}
            permiteExterna={plan.permiteSalaExterna}
            esFija={!!esFija}
            horasPaquete={paquete.horas}
            incrementoMin={incrementoMin}
            minimoMin={minimoMin}
            revisar={revisar}
            firmaExtra={`${plan.id}:${paquete.id}:${personasN}:${categoria}`}
          />
        )}
      </BloqueVenta>

      {/* 5 · Cobro */}
      <BloqueVenta numero={5} titulo="Cobro" estado={paqueteListo && agendaListo ? "activo" : "bloqueado"} bloqueo="Primero dejá la agenda disponible.">
        {plan && paquete && precio != null && (
          <>
            <Cobro
              sujeto={titularNombre}
              detalle={`${plan.nombre} · ${formatearHoras(paquete.horas)} h`}
              referencia={precio}
              referenciaLabel="Precio del paquete"
              politica="descuento"
              direccion="cobro"
              medios={medios}
              permitirSinCobro
              cuentaId={`alquiler:${plan.id}:${paquete.id}:${agenda.fechaInicio}`}
              onChange={setCobro}
            />
            {faltaSaldo && <FechaCompromiso valor={fechaCompromiso} diasCompromiso={diasCompromiso} onChange={setFechaCompromiso} />}
          </>
        )}
      </BloqueVenta>

      <BarraVenta falta={faltaTexto} total={precio != null ? gs(precio) : null} pendiente={pendiente} error={error} onConfirmar={confirmar} />
    </div>
  );
}
