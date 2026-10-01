"use client";

/**
 * Vender un plan de alquiler de sala (C3, hito H7, tanda 2).
 *
 * El titular es un **contacto** (regla 21): se busca entre todos los contactos
 * y **no adquiere el rol alumno**. El alta de un titular nuevo (persona u
 * organización, con NIT) es la tanda 3; por ahora se elige uno existente.
 *
 * El precio **sale de la tabla** de Precios y paquetes (categoría × tamaño ×
 * horas): no se escribe a mano. La categoría la propone el sistema y dice por
 * qué (regla 24); cambiarla depende del parámetro `alquiler_categoria_modo`.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { opcionesDuracionReserva, etiquetaDuracion, formatearHoras, horaAlineada } from "@/lib/horarios";
import { gs, isoFecha } from "@/lib/inscripcion";
import { costoDeSala, tamanoPorPersonas, type CategoriaSala, type TamanoSala, type TarifaSala } from "@/lib/sala";
import { faltaParaAlquiler } from "@/lib/ventaAlquiler";
import AvisoWhatsapp from "@/components/AvisoWhatsapp";
import Cobro, { type PayloadCobro } from "@/components/Cobro";
import type { SalaVenta } from "./VenderParticular";
import {
  buscarContactosTitular,
  categoriaPropuestaDe,
  previsualizarAlquiler,
  venderAlquiler,
  type ContactoTitular,
  type EntradaAgendaAlquiler,
  type EntradaAlquiler,
  type ResultadoPreviewAlquiler,
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
const DIAS = [
  { n: 1, label: "Lun" },
  { n: 2, label: "Mar" },
  { n: 3, label: "Mié" },
  { n: 4, label: "Jue" },
  { n: 5, label: "Vie" },
  { n: 6, label: "Sáb" },
  { n: 7, label: "Dom" },
];
const DIAS_ABREV = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const ETIQUETA_ROL: Record<ContactoTitular["rol"], string> = {
  alumno: "Alumno",
  profesor: "Profesor",
  alumno_profesor: "Alumno y profesor",
  contacto: "Solo contacto",
};

function diaCorto(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00`);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  return `${DIAS_ABREV[dow]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [verificando, startVerificacion] = useTransition();

  const [busqueda, setBusqueda] = useState("");
  const [encontrados, setEncontrados] = useState<ContactoTitular[]>([]);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [titular, setTitular] = useState<ContactoTitular | null>(null);
  const [propuesta, setPropuesta] = useState<{ categoria: CategoriaSala; motivo: string } | null>(null);
  const [categoria, setCategoria] = useState<CategoriaSala | null>(null);
  const [glosaCategoria, setGlosaCategoria] = useState("");
  const [plan, setPlan] = useState<PlanAlquiler | null>(null);
  const [personas, setPersonas] = useState("1");
  const [paqueteId, setPaqueteId] = useState<number | null>(null);
  const [salaTipo, setSalaTipo] = useState<"propia" | "externa">("propia");
  const [salaId, setSalaId] = useState<number | null>(null);
  const [nombreExterna, setNombreExterna] = useState("");
  const hoy = useMemo(() => new Date(), []);
  const [fechaInicio, setFechaInicio] = useState(isoFecha(hoy));
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const duraciones = useMemo(() => opcionesDuracionReserva(minimoMin), [minimoMin]);
  const [hora, setHora] = useState("18:00");
  const [duracionMin, setDuracionMin] = useState(duraciones[0] ?? 60);
  const [cobro, setCobro] = useState<PayloadCobro | null>(null);
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  const [aviso, setAviso] = useState<{ resumen: string; aviso?: { nombre: string; whatsapp: string | null; mensaje: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResultadoPreviewAlquiler | null>(null);
  const [previewFirma, setPreviewFirma] = useState<string | null>(null);

  const maxCompromiso = useMemo(() => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    d.setDate(d.getDate() + Math.max(1, diasCompromiso));
    return d;
  }, [hoy, diasCompromiso]);

  // Búsqueda del titular (con una pausa corta para no consultar por cada tecla).
  useEffect(() => {
    if (titular) return;
    const q = busqueda.trim();
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      const r = await buscarContactosTitular(q);
      setEncontrados(r.contactos);
      setErrorBusqueda(r.error ?? null);
    }, 250);
    return () => clearTimeout(t);
  }, [busqueda, titular]);

  async function elegirTitular(c: ContactoTitular) {
    setTitular(c);
    setError(null);
    setAviso(null);
    setPropuesta(null);
    setCategoria(null);
    setGlosaCategoria("");
    const r = await categoriaPropuestaDe(c.id);
    if (r.error || !r.categoria) {
      setError(r.error ?? "No se pudo proponer la categoría.");
      return;
    }
    setPropuesta({ categoria: r.categoria, motivo: r.motivo ?? "" });
    setCategoria(r.categoria);
  }

  function limpiarTitular() {
    setTitular(null);
    setPropuesta(null);
    setCategoria(null);
    setGlosaCategoria("");
    setBusqueda("");
    setEncontrados([]);
  }

  function elegirPlan(p: PlanAlquiler) {
    setPlan(p);
    setSalaId(null);
    setSalaTipo("propia");
    setDiasSemana([]);
    setCobro(null);
    setError(null);
  }

  const personasN = Math.max(0, Math.trunc(Number(personas) || 0));
  const tamano = tamanoPorPersonas(tamanos, personasN);
  const salasPropias = salas
    .filter((s) => !s.esExterna && s.activa)
    .filter((s) => !plan || plan.salasModo === "todas" || (salaIdsPorPlan[plan.id] ?? []).includes(s.id));

  // Precio de cada paquete con lo elegido hasta ahora — se lee de la tabla.
  const precioDe = (horas: number): { precio: number | null; motivo?: string } => {
    if (!categoria || !tamano) return { precio: null, motivo: "Elegí la categoría y la cantidad de personas." };
    const r = costoDeSala(tarifas, categoria, tamano, horas, salaTipo === "propia" ? salaId : null, (c) => etiquetasCategoria[c]);
    return r.precio == null ? { precio: null, motivo: r.motivo } : { precio: r.precio };
  };
  const paquete = paquetes.find((p) => p.id === paqueteId) ?? null;
  const precio = paquete ? precioDe(paquete.horas).precio : null;

  const esFija = plan?.reservaModalidad === "fija";
  const horaOk = !!hora && horaAlineada(hora, incrementoMin);
  const salaCompleta = salaTipo === "propia" ? !!salaId : nombreExterna.trim().length > 0;

  const faltaPara = faltaParaAlquiler({
    contactoId: titular?.id ?? null,
    planId: plan?.id ?? null,
    horasPaqueteId: paqueteId,
    personas: personasN,
    categoria,
    categoriaPropuesta: propuesta?.categoria ?? null,
    categoriaGlosa: glosaCategoria,
    salaTipo,
    salaId,
    nombreExterna,
    fechaInicio,
    esFija,
    diasSemana,
    hora,
    horaAlineada: horaOk,
    duracionMin,
  });

  const entradaAgenda: EntradaAgendaAlquiler | null =
    !faltaPara && titular && plan && paqueteId != null && categoria && precio != null
      ? {
          contactoId: titular.id,
          planId: plan.id,
          horasPaqueteId: paqueteId,
          personas: personasN,
          categoria,
          ...(categoria !== propuesta?.categoria ? { categoriaGlosa: glosaCategoria.trim() } : {}),
          sala:
            salaTipo === "propia"
              ? { tipo: "propia", salaId: salaId! }
              : { tipo: "externa", nombreDescriptivo: nombreExterna.trim() },
          fechaInicio,
          agenda: esFija ? { modalidad: "fija", diasSemana, hora, duracionMin } : { modalidad: "flexible", hora, duracionMin },
        }
      : null;
  // La glosa va en la firma sin su texto: escribirla no invalida la revisión de disponibilidad.
  const firmaAgenda = entradaAgenda ? JSON.stringify({ ...entradaAgenda, categoriaGlosa: undefined }) : null;
  const previewVigente = !!preview && !preview.error && previewFirma === firmaAgenda;
  const faltaSaldo = cobro ? cobro.saldo > 0 : false;
  const fechaCompromisoEfectiva = fechaCompromiso || isoFecha(maxCompromiso);

  function revisarDisponibilidad() {
    if (!entradaAgenda) return;
    const firma = firmaAgenda;
    startVerificacion(async () => {
      const res = await previsualizarAlquiler(entradaAgenda);
      setPreview(res);
      setPreviewFirma(firma);
    });
  }

  const puedeVender =
    !faltaPara &&
    precio != null &&
    previewVigente &&
    !!preview?.todasOk &&
    (!cobro || cobro.valido) &&
    (!faltaSaldo || !!fechaCompromisoEfectiva) &&
    !pendiente;

  const faltaTexto: string | null = faltaPara
    ? faltaPara
    : precio == null
      ? "un precio en la tabla de alquiler"
      : !previewVigente
        ? 'revisar la disponibilidad ("Revisar disponibilidad", abajo)'
        : !preview?.todasOk
          ? "resolver los choques que muestra la revisión"
          : cobro && !cobro.valido
            ? "revisar el cobro"
            : null;

  function confirmar() {
    setError(null);
    setAviso(null);
    if (!entradaAgenda || precio == null) return setError(`Falta ${faltaTexto ?? "completar la venta"}.`);
    if (!puedeVender) return setError(`Falta ${faltaTexto ?? "completar la venta"}.`);
    const entrada: EntradaAlquiler = {
      ...entradaAgenda,
      cobro: {
        modo: cobro?.modo ?? "sin",
        monto: cobro ? cobro.total - cobro.saldo : 0,
        medio: cobro?.medio ?? null,
        notaMedio: cobro?.notaMedio ?? "",
        ajuste: cobro?.ajuste ?? 0,
        ajusteMotivo: cobro?.ajusteMotivo ?? "",
        total: precio,
        saldo: cobro?.saldo ?? precio,
        fechaCompromiso: faltaSaldo ? fechaCompromisoEfectiva : null,
      },
    };
    startTransition(async () => {
      const res = await venderAlquiler(entrada);
      if (res.error) return setError(res.error);
      setAviso({ resumen: res.resumen ?? "Alquiler registrado.", aviso: res.aviso });
      limpiarTitular();
      setPlan(null);
      setPaqueteId(null);
      setPersonas("1");
      setSalaId(null);
      setNombreExterna("");
      setDiasSemana([]);
      setCobro(null);
      setPreview(null);
      setPreviewFirma(null);
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

  const tarjeta = "rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5";

  return (
    <div className="space-y-4">
      {aviso && (
        <div className="rounded-[var(--radio-panel)] bg-[var(--exito-fill)] text-[var(--exito-texto)] p-4 text-base space-y-3">
          <p>{aviso.resumen}</p>
          {aviso.aviso && <AvisoWhatsapp nombre={aviso.aviso.nombre} whatsapp={aviso.aviso.whatsapp} mensaje={aviso.aviso.mensaje} />}
        </div>
      )}

      {/* 1 · Titular */}
      <section className={tarjeta}>
        <h2 className="titulo text-xl mb-3">Titular</h2>
        {titular ? (
          <div className="rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold">{titular.nombre}</div>
              <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
                {ETIQUETA_ROL[titular.rol]} · {titular.whatsapp || "sin WhatsApp"}
              </div>
              {propuesta && (
                <div className="text-sm mt-2">
                  <span className="font-medium">Categoría propuesta: {etiquetasCategoria[propuesta.categoria]}.</span>{" "}
                  <span className="text-[var(--texto-tenue)]">{propuesta.motivo}</span>
                </div>
              )}
            </div>
            <button type="button" onClick={limpiarTitular} className="text-[var(--primario)] text-base shrink-0">
              Cambiar
            </button>
          </div>
        ) : (
          <div>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscá por nombre, apellido, empresa o WhatsApp"
              className={control}
              aria-label="Buscar titular"
            />
            {busqueda.trim().length >= 2 && errorBusqueda && <p className="text-[var(--peligro)] text-sm mt-2">{errorBusqueda}</p>}
            {busqueda.trim().length >= 2 && !errorBusqueda && encontrados.length === 0 && (
              <p className="text-sm text-[var(--texto-tenue)] mt-2">
                No hay ningún contacto con ese dato. El alta de un titular nuevo (persona u organización) llega en la próxima etapa.
              </p>
            )}
            {busqueda.trim().length >= 2 && encontrados.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {encontrados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => elegirTitular(c)}
                      className="w-full text-left px-4 py-2.5 rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] flex items-baseline justify-between gap-3"
                    >
                      <span>{c.nombre}</span>
                      <span className="text-sm text-[var(--texto-tenue)]">{ETIQUETA_ROL[c.rol]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* 2 · Plan */}
      {titular && propuesta && (
        <section className={tarjeta}>
          <h2 className="titulo text-xl mb-3">Plan de alquiler</h2>
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
                  agenda {p.reservaModalidad === "fija" ? "fija" : "flexible"}
                  {p.vigenciaDias ? ` · vigencia ${p.vigenciaDias} días` : ""}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 3 · Categoría, personas y horas */}
      {plan && categoria && propuesta && (
        <section className={`${tarjeta} space-y-4`}>
          <h2 className="titulo text-xl">Categoría, personas y horas</h2>

          <div>
            <span className="block text-base font-medium mb-1.5">Categoría del cliente</span>
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
                      onClick={() => setPaqueteId(p.id)}
                      title={r.precio == null ? r.motivo : undefined}
                      className={`w-full text-left px-4 py-2.5 rounded-[var(--radio-control)] border flex items-baseline justify-between gap-3 disabled:opacity-50 ${
                        paqueteId === p.id ? "border-[var(--primario)] bg-[var(--fondo-elevado)]" : "border-[var(--borde)] hover:border-[var(--primario)]"
                      }`}
                    >
                      <span>{formatearHoras(p.horas)} h</span>
                      <span className="tabular-nums">{r.precio == null ? "sin precio cargado" : gs(r.precio)}</span>
                    </button>
                  );
                })}
                {tamano && categoria && paquetes.every((p) => precioDe(p.horas).precio == null) && (
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
        </section>
      )}

      {/* 4 · Sala y horario */}
      {plan && paquete && precio != null && (
        <section className={`${tarjeta} space-y-4`}>
          <h2 className="titulo text-xl">Sala y horario</h2>

          <div>
            <span className="block text-base font-medium mb-1.5">Sala</span>
            <div className="flex gap-2 mb-2">
              {(["propia", "externa"] as const)
                .filter((t) => t === "propia" || plan.permiteSalaExterna)
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSalaTipo(t)}
                    className={`px-3 py-1.5 text-sm rounded-[var(--radio-control)] border ${
                      salaTipo === t ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)]" : "border-[var(--borde)]"
                    }`}
                  >
                    {t === "propia" ? "En Tropicana" : "Ubicación externa"}
                  </button>
                ))}
            </div>
            {salaTipo === "propia" ? (
              salasPropias.length === 0 ? (
                <p className="text-sm text-[var(--peligro)]">Este plan no tiene ninguna sala propia permitida.</p>
              ) : (
                <select value={salaId ?? ""} onChange={(e) => setSalaId(Number(e.target.value) || null)} className={control}>
                  <option value="">Elegí…</option>
                  {salasPropias.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              )
            ) : (
              <input
                value={nombreExterna}
                onChange={(e) => setNombreExterna(e.target.value)}
                placeholder='Ej. "Salón Conquistador — Hotel Los Tajibos" (no se valida su ocupación)'
                className={control}
              />
            )}
          </div>

          {salaCompleta && (
            <>
              <p className="text-sm text-[var(--texto-tenue)]">
                {esFija
                  ? `Se reservan todas las franjas que cubran las ${formatearHoras(paquete.horas)} h, en los días elegidos, desde la fecha de inicio.`
                  : "Se reserva la primera franja. El resto se coordina después."}
              </p>
              <label className="block max-w-[200px]">
                <span className="block text-sm text-[var(--texto-tenue)] mb-1">Fecha de inicio</span>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={control} />
              </label>
              {esFija && (
                <div>
                  <span className="block text-sm text-[var(--texto-tenue)] mb-1">Días</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {DIAS.map((d) => (
                      <button
                        key={d.n}
                        type="button"
                        onClick={() => setDiasSemana((prev) => (prev.includes(d.n) ? prev.filter((x) => x !== d.n) : [...prev, d.n].sort()))}
                        className={`px-3 py-1.5 text-sm rounded-[var(--radio-control)] border ${
                          diasSemana.includes(d.n) ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)]" : "border-[var(--borde)]"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 flex-wrap">
                <label className="block max-w-[140px]">
                  <span className="block text-sm text-[var(--texto-tenue)] mb-1">Hora</span>
                  <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={control} />
                </label>
                <label className="block max-w-[180px]">
                  <span className="block text-sm text-[var(--texto-tenue)] mb-1">Duración</span>
                  <select value={duracionMin} onChange={(e) => setDuracionMin(Number(e.target.value))} className={control}>
                    {duraciones.map((d) => (
                      <option key={d} value={d}>
                        {etiquetaDuracion(d)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {entradaAgenda && (
                <div className="pt-3 border-t border-[var(--borde)]">
                  <button
                    type="button"
                    onClick={revisarDisponibilidad}
                    disabled={verificando}
                    className="px-4 py-2 text-sm font-medium rounded-[var(--radio-control)] border border-[var(--primario)] text-[var(--primario)] hover:bg-[var(--fondo-elevado)] disabled:opacity-40"
                  >
                    {verificando ? "Revisando…" : "Revisar disponibilidad"}
                  </button>
                  {preview?.error && previewFirma === firmaAgenda && <p className="text-[var(--peligro)] text-sm mt-2">{preview.error}</p>}
                  {!previewVigente && !verificando && !(preview?.error && previewFirma === firmaAgenda) && (
                    <p className="text-sm text-[var(--texto-tenue)] mt-2">Todavía no se revisó esta agenda contra la disponibilidad real de la sala.</p>
                  )}
                  {previewVigente && preview?.sesiones && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-sm font-medium">
                        {preview.sesiones.length === 1 ? "1 reserva" : `${preview.sesiones.length} reservas`}
                        {preview.horas ? ` para ${formatearHoras(preview.horas)} h` : ""}:
                      </p>
                      <ul className="space-y-1">
                        {preview.sesiones.map((s, i) => (
                          <li key={i} className={`text-sm flex items-start gap-2 ${s.ok ? "" : "text-[var(--peligro)]"}`}>
                            <span className="shrink-0">{s.ok ? "✓" : "✗"}</span>
                            <span>
                              {diaCorto(s.fecha)} {s.hora.slice(0, 5)} ({etiquetaDuracion(s.duracionMin)}){!s.ok && s.motivo ? ` — ${s.motivo}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {!!preview.leftoverMin && (
                        <p className="text-sm text-[var(--texto-tenue)]">
                          Quedan {formatearHoras(preview.leftoverMin / 60)} h del paquete sin agendar en esta venta. Se coordinan después.
                        </p>
                      )}
                      {preview.todasOk ? (
                        <p className="text-sm text-[var(--exito-texto)]">Toda la agenda está disponible.</p>
                      ) : (
                        <p className="text-sm text-[var(--peligro)]">
                          Hay franjas que chocan con la sala o el horario. Cambiá el día, la hora o la sala y volvé a revisar — en{" "}
                          <a href="/sala" target="_blank" rel="noreferrer" className="underline">
                            Disponibilidad de sala
                          </a>{" "}
                          se ve qué la ocupa.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* 5 · Cobro */}
      {entradaAgenda && precio != null && paquete && (
        <section className={tarjeta}>
          <h2 className="titulo text-xl mb-3">Cobro</h2>
          <Cobro
            sujeto={titular?.nombre}
            detalle={`${plan?.nombre} · ${formatearHoras(paquete.horas)} h`}
            referencia={precio}
            referenciaLabel="Precio del paquete"
            politica="descuento"
            direccion="cobro"
            medios={medios}
            permitirSinCobro
            cuentaId={`alquiler:${plan?.id}:${paquete.id}:${fechaInicio}`}
            onChange={setCobro}
          />
          {faltaSaldo && (
            <div className="pt-3 mt-3 border-t border-[var(--borde)]">
              <label className="text-sm text-[var(--texto-tenue)] block mb-1.5">Fecha de compromiso de pago del saldo</label>
              <input
                type="date"
                value={fechaCompromisoEfectiva}
                min={isoFecha(hoy)}
                max={isoFecha(maxCompromiso)}
                onChange={(e) => setFechaCompromiso(e.target.value)}
                className="entrada max-w-[200px]"
              />
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="text-[var(--peligro)] text-base" role="alert">
          {error}
        </p>
      )}

      {plan && (
        <div>
          <button
            onClick={confirmar}
            disabled={!puedeVender}
            className="w-full px-5 py-3 text-lg font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
          >
            {pendiente ? "Guardando…" : precio != null ? `Vender · ${gs(precio)}` : "Vender"}
          </button>
          {!puedeVender && !pendiente && faltaTexto && (
            <p className="text-sm text-[var(--texto-tenue)] mt-1.5">Falta {faltaTexto} para poder vender.</p>
          )}
        </div>
      )}
    </div>
  );
}
