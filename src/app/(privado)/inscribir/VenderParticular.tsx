"use client";

/**
 * Vender un plan de particulares (C3, hito H2).
 *
 * Mismo patrón que `VenderPrueba.tsx`: un componente autocontenido, con el
 * titular resuelto igual que en cualquier otra venta (`EntidadAlumno` — el
 * rol alumno se adquiere al elegirlo o crearlo, regla de negocio 21) y el
 * paso de `Cobro` compartido.
 *
 * **Lo que se personaliza al vender** (definiciones-v2 §7, H1): el tramo de
 * horas (de `tarifas_particular`, según el estilo de la plantilla), el
 * profesor, la sala —propia o externa— y la primera reserva. Con agenda
 * **fija** se genera el calendario completo (decisión de Javier, 25/09); con
 * **flexible**, solo la primera sesión — el resto se reserva después desde
 * la gestión de reservas (H3, sin construir todavía).
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Alumno, DatosAlumno } from "@/lib/tipos";
import { nombreCompleto } from "@/lib/contactos";
import { opcionesDuracion, etiquetaDuracion } from "@/lib/horarios";
import { gs, isoFecha, fechaLarga } from "@/lib/inscripcion";
import EntidadAlumno from "@/components/entidades/EntidadAlumno";
import AvisoWhatsapp from "@/components/AvisoWhatsapp";
import Cobro, { type PayloadCobro } from "@/components/Cobro";
import type { ListasContacto, MatrizMinimo } from "@/lib/tipos";
import { crearAlumnoDesdeInscripcion, venderParticular, type EntradaParticular } from "./acciones";

export type PlanParticular = {
  id: number;
  nombre: string;
  estilo: string;
  reservaModalidad: "fija" | "flexible" | null;
  salasModo: "todas" | "solo";
  registraAcompanantes: boolean;
  formaPagoProfesor: "fee_hora" | "pct_margen" | "monto_fijo" | null;
};
export type TarifaParticularVenta = { id: number; nombre: string; estilo: string; horas: number; precio: number };
export type ProfesorParticular = { id: number; nombre: string; whatsapp: string | null };
export type SalaVenta = { id: number; nombre: string; esExterna: boolean; activa: boolean };

type Canal = { valor: string; etiqueta: string };

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base w-full";
const DIAS: { n: number; label: string }[] = [
  { n: 1, label: "Lun" },
  { n: 2, label: "Mar" },
  { n: 3, label: "Mié" },
  { n: 4, label: "Jue" },
  { n: 5, label: "Vie" },
  { n: 6, label: "Sáb" },
  { n: 7, label: "Dom" },
];

export default function VenderParticular({
  alumnos,
  planes,
  tarifas,
  profesoresPorEstilo,
  salas,
  salaIdsPorPlan,
  medios,
  canales,
  diasCompromiso,
  incrementoMin,
  minimoMin,
  matriz,
  listasContacto,
  puedeVerPrivados,
}: {
  alumnos: Alumno[];
  planes: PlanParticular[];
  tarifas: TarifaParticularVenta[];
  profesoresPorEstilo: Record<string, ProfesorParticular[]>;
  salas: SalaVenta[];
  salaIdsPorPlan: Record<number, number[]>;
  medios: string[];
  canales: Canal[];
  diasCompromiso: number;
  incrementoMin: number;
  minimoMin: number;
  matriz: MatrizMinimo[];
  listasContacto: ListasContacto;
  puedeVerPrivados: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [remountAlumno, setRemountAlumno] = useState(0);
  const [plan, setPlan] = useState<PlanParticular | null>(null);
  const [tarifaId, setTarifaId] = useState<number | null>(null);
  const [profesorId, setProfesorId] = useState<number | null>(null);
  const [salaTipo, setSalaTipo] = useState<"propia" | "externa">("propia");
  const [salaId, setSalaId] = useState<number | null>(null);
  const [nombreExterna, setNombreExterna] = useState("");
  const [acompanantes, setAcompanantes] = useState("0");
  const hoy = useMemo(() => new Date(), []);
  const [fechaInicio, setFechaInicio] = useState(isoFecha(hoy));
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const duraciones = useMemo(() => opcionesDuracion(incrementoMin, minimoMin), [incrementoMin, minimoMin]);
  const [hora, setHora] = useState("18:00");
  const [duracionMin, setDuracionMin] = useState(duraciones[0] ?? 60);
  const [cobro, setCobro] = useState<PayloadCobro | null>(null);
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  const [aviso, setAviso] = useState<{
    resumen: string;
    avisoAlumno?: { nombre: string; whatsapp: string | null; mensaje: string };
    avisoProfesor?: { nombre: string; whatsapp: string | null; mensaje: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxCompromiso = useMemo(() => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    d.setDate(d.getDate() + Math.max(1, diasCompromiso));
    return d;
  }, [hoy, diasCompromiso]);

  const tarifasDelPlan = plan ? tarifas.filter((t) => t.estilo === plan.estilo) : [];
  const tarifa = tarifasDelPlan.find((t) => t.id === tarifaId) ?? null;
  const profesores = (plan ? profesoresPorEstilo[plan.estilo] : undefined) ?? [];
  const salasPropias = salas
    .filter((s) => !s.esExterna && s.activa)
    .filter((s) => !plan || plan.salasModo === "todas" || (salaIdsPorPlan[plan.id] ?? []).includes(s.id));
  const total = tarifa?.precio ?? 0;

  function elegirAlumno(al: Alumno | null) {
    setAlumno(al);
    setError(null);
    setAviso(null);
  }
  async function guardarAlumnoNuevo(datos: DatosAlumno) {
    const res = await crearAlumnoDesdeInscripcion(datos);
    if (res.alumno) {
      setAlumno(res.alumno);
      setError(null);
    }
    return { error: res.error };
  }

  function elegirPlan(p: PlanParticular) {
    setPlan(p);
    setTarifaId(null);
    setProfesorId(null);
    setSalaId(null);
    setDiasSemana([]);
    setCobro(null);
    setError(null);
  }

  function toggleDia(n: number) {
    setDiasSemana((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort()));
  }

  const personas = 1 + Math.max(0, Math.trunc(Number(acompanantes) || 0));
  const faltaSaldo = cobro ? cobro.saldo > 0 : false;
  const fechaCompromisoEfectiva = fechaCompromiso || isoFecha(maxCompromiso);

  const esFija = plan?.reservaModalidad === "fija";
  const agendaCompleta = esFija ? diasSemana.length > 0 && !!hora && !!duracionMin : !!hora && !!duracionMin;
  const salaCompleta = salaTipo === "propia" ? !!salaId : nombreExterna.trim().length > 0;

  // Todo lo obligatorio, completo: el botón queda deshabilitado hasta acá,
  // no alcanza con que el clic muestre el error después (pedido de Javier,
  // 26/09/2026) — mismas condiciones que valida `confirmar()` al enviar.
  const puedeVender =
    !!alumno &&
    !!plan &&
    !!tarifa &&
    !!profesorId &&
    salaCompleta &&
    !!fechaInicio &&
    agendaCompleta &&
    (!cobro || cobro.valido) &&
    (!faltaSaldo || !!fechaCompromisoEfectiva) &&
    !pendiente;

  // Mismo orden que confirmar(), para que el texto bajo el botón diga
  // exactamente qué falta (regla de calidad 1: nunca un "no se puede" a secas).
  const faltaPara: string | null = !alumno
    ? "el titular"
    : !plan
      ? "la plantilla"
      : !tarifa
        ? "el tramo de horas"
        : !profesorId
          ? "el profesor"
          : !salaCompleta
            ? salaTipo === "propia"
              ? "la sala"
              : "el nombre del lugar"
            : !fechaInicio
              ? "la fecha de inicio"
              : !agendaCompleta
                ? esFija
                  ? "los días, la hora y la duración"
                  : "la hora y la duración de la primera clase"
                : cobro && !cobro.valido
                  ? "revisar el cobro"
                  : faltaSaldo && !fechaCompromisoEfectiva
                    ? "la fecha de compromiso de pago"
                    : null;

  function confirmar() {
    setError(null);
    setAviso(null);
    if (!alumno) return setError("Elegí el alumno titular.");
    if (!plan) return setError("Elegí la plantilla.");
    if (!tarifa) return setError("Elegí el tramo de horas.");
    if (!profesorId) return setError("Elegí el profesor.");
    if (!salaCompleta) return setError(salaTipo === "propia" ? "Elegí la sala." : "Cargá el nombre del lugar.");
    if (!fechaInicio) return setError("Cargá la fecha de inicio.");
    if (!agendaCompleta) return setError(esFija ? "Elegí los días, la hora y la duración." : "Cargá la hora y la duración de la primera clase.");
    if (cobro && !cobro.valido) return setError("Revisá el monto, el medio de pago o el motivo del descuento.");
    if (faltaSaldo && !fechaCompromisoEfectiva) return setError("Cargá la fecha de compromiso de pago.");

    const entrada: EntradaParticular = {
      alumnoId: alumno.id,
      planId: plan.id,
      tarifaParticularId: tarifa.id,
      profesorId,
      sala: salaTipo === "propia" ? { tipo: "propia", salaId: salaId! } : { tipo: "externa", nombreDescriptivo: nombreExterna.trim() },
      acompanantes: personas - 1,
      fechaInicio,
      agenda: esFija ? { modalidad: "fija", diasSemana, hora, duracionMin } : { modalidad: "flexible", hora, duracionMin },
      cobro: {
        modo: cobro?.modo ?? "sin",
        monto: cobro ? cobro.total - cobro.saldo : 0,
        medio: cobro?.medio ?? null,
        notaMedio: cobro?.notaMedio ?? "",
        ajuste: cobro?.ajuste ?? 0,
        ajusteMotivo: cobro?.ajusteMotivo ?? "",
        total,
        saldo: cobro?.saldo ?? total,
        fechaCompromiso: faltaSaldo ? fechaCompromisoEfectiva : null,
      },
    };

    startTransition(async () => {
      const res = await venderParticular(entrada);
      if (res.error) return setError(res.error);
      setAviso({ resumen: res.resumen ?? "Membresía particular registrada.", avisoAlumno: res.avisoAlumno, avisoProfesor: res.avisoProfesor });
      setAlumno(null);
      setRemountAlumno((n) => n + 1);
      setPlan(null);
      setTarifaId(null);
      setProfesorId(null);
      setSalaId(null);
      setNombreExterna("");
      setAcompanantes("0");
      setDiasSemana([]);
      setCobro(null);
      router.refresh();
    });
  }

  if (planes.length === 0)
    return (
      <div className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-6">
        <p className="text-base">Todavía no hay ninguna plantilla de particulares para vender.</p>
        <p className="text-sm text-[var(--texto-tenue)] mt-1">Se crean en Planes → Clases particulares.</p>
      </div>
    );

  return (
    <div className="space-y-4">
      {aviso && (
        <div className="rounded-[var(--radio-panel)] bg-[var(--exito-fill)] text-[var(--exito-texto)] p-4 text-base space-y-3">
          <p>{aviso.resumen}</p>
          {aviso.avisoAlumno && (
            <AvisoWhatsapp nombre={aviso.avisoAlumno.nombre} whatsapp={aviso.avisoAlumno.whatsapp} mensaje={aviso.avisoAlumno.mensaje} />
          )}
          {aviso.avisoProfesor && (
            <AvisoWhatsapp nombre={`Profesor: ${aviso.avisoProfesor.nombre}`} whatsapp={aviso.avisoProfesor.whatsapp} mensaje={aviso.avisoProfesor.mensaje} />
          )}
        </div>
      )}

      {/* 1 · Titular */}
      <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
        <h2 className="titulo text-xl mb-3">Titular</h2>
        {alumno ? (
          <div className="rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold">{nombreCompleto(alumno.contacto)}</div>
              <div className="text-sm text-[var(--texto-tenue)] mt-0.5">
                {alumno.es_menor ? `menor · tutor ${alumno.tutor?.whatsapp || "—"}` : alumno.contacto.whatsapp || "sin WhatsApp"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                elegirAlumno(null);
                setRemountAlumno((n) => n + 1);
              }}
              className="text-[var(--primario)] text-base shrink-0"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <EntidadAlumno
            key={remountAlumno}
            padron={alumnos}
            canales={canales}
            matriz={matriz}
            listasContacto={listasContacto}
            puedeVerPrivados={puedeVerPrivados}
            abrirAlElegir={false}
            onSelect={elegirAlumno}
            onGuardar={guardarAlumnoNuevo}
          />
        )}
      </section>

      {/* 2 · Plantilla y tramo */}
      {alumno && (
        <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
          <h2 className="titulo text-xl mb-3">Plantilla</h2>
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
                      onClick={() => setTarifaId(t.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-[var(--radio-control)] border flex items-baseline justify-between gap-3 ${
                        tarifaId === t.id ? "border-[var(--primario)] bg-[var(--fondo-elevado)]" : "border-[var(--borde)] hover:border-[var(--primario)]"
                      }`}
                    >
                      <span>
                        {t.nombre} · {t.horas} h
                      </span>
                      <span className="tabular-nums">{gs(t.precio)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 3 · Profesor y sala */}
      {plan && tarifa && (
        <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5 space-y-4">
          <h2 className="titulo text-xl">Profesor y sala</h2>

          <div>
            <span className="block text-base font-medium mb-1.5">Profesor</span>
            {profesores.length === 0 ? (
              <p className="text-sm text-[var(--peligro)]">Ningún profesor tiene cargado el estilo &quot;{plan.estilo}&quot;.</p>
            ) : (
              <select value={profesorId ?? ""} onChange={(e) => setProfesorId(Number(e.target.value) || null)} className={control}>
                <option value="">Elegí…</option>
                {profesores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <span className="block text-base font-medium mb-1.5">Sala</span>
            <div className="flex gap-2 mb-2">
              {(["propia", "externa"] as const).map((t) => (
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
                <p className="text-sm text-[var(--peligro)]">Esta plantilla no tiene ninguna sala propia permitida.</p>
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
                placeholder='Ej. "Salón Conquistador — Hotel Los Tajibos"'
                className={control}
              />
            )}
          </div>

          {plan.registraAcompanantes && (
            <label className="block max-w-[260px]">
              <span className="block text-base font-medium mb-1.5">¿Cuántos vienen con el titular?</span>
              <input
                value={acompanantes}
                onChange={(e) => setAcompanantes(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="entrada"
              />
              <span className="block text-sm text-[var(--texto-tenue)] mt-1.5">
                Son {personas} {personas === 1 ? "persona" : "personas"} en total.
              </span>
            </label>
          )}
        </section>
      )}

      {/* 4 · Agenda */}
      {plan && tarifa && profesorId && salaCompleta && (
        <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5 space-y-3">
          <h2 className="titulo text-xl">{esFija ? "Agenda fija" : "Primera clase"}</h2>
          <p className="text-sm text-[var(--texto-tenue)]">
            {esFija
              ? `Se reservan todas las clases que cubran las ${tarifa.horas} h contratadas, en los días elegidos, desde la fecha de inicio.`
              : "Se reserva la primera clase. El resto se coordina después."}
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
                    onClick={() => toggleDia(d.n)}
                    className={`px-3 py-1.5 text-sm rounded-[var(--radio-control)] border ${
                      diasSemana.includes(d.n)
                        ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)]"
                        : "border-[var(--borde)]"
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
        </section>
      )}

      {/* 5 · Cobro */}
      {plan && tarifa && profesorId && salaCompleta && agendaCompleta && (
        <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
          <h2 className="titulo text-xl mb-3">Cobro</h2>
          <Cobro
            sujeto={alumno ? nombreCompleto(alumno.contacto) : undefined}
            detalle={`${plan.nombre} · ${tarifa.horas} h`}
            referencia={total}
            referenciaLabel="Precio del paquete"
            politica="descuento"
            direccion="cobro"
            medios={medios}
            permitirSinCobro
            cuentaId={`particular:${plan.id}:${tarifa.id}:${fechaInicio}`}
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

      {plan && tarifa && (
        <div>
          <button
            onClick={confirmar}
            disabled={!puedeVender}
            className="w-full px-5 py-3 text-lg font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
          >
            {pendiente ? "Guardando…" : `Vender · ${gs(total)}`}
          </button>
          {!puedeVender && !pendiente && faltaPara && (
            <p className="text-sm text-[var(--texto-tenue)] mt-1.5">Falta {faltaPara} para poder vender.</p>
          )}
        </div>
      )}
      {esFija && fechaInicio && diasSemana.length > 0 && (
        <p className="text-xs text-[var(--texto-tenue)]">Primera clase estimada desde el {fechaLarga(new Date(fechaInicio + "T00:00:00"))}.</p>
      )}
    </div>
  );
}
