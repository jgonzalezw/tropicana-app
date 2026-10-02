"use client";

/**
 * Disponibilidad de sala — pantalla operativa (2026-09-17).
 *
 * Muestra TODAS las salas activas a la vez, mirando la misma fecha: Javier
 * pidió explícitamente no tener que elegir una sala por vez para algo que se
 * mira todos los días — "ver las actividades y disponibilidad de las salas...
 * es totalmente cotidiano". El selector de fecha vive acá, una sola vez;
 * cada sala es una tarjeta independiente (`ClienteDisponibilidadSala`).
 */

import { useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ClienteDisponibilidadSala from "./ClienteDisponibilidadSala";
import AgendamientosExternos from "./AgendamientosExternos";
import { consultarAgendaDia } from "./acciones";
import { resumirAgenda, type FiltroAgenda, type SlotSala } from "@/lib/slotSala";

// La vista de trabajo (y con ella la gestión de reservas y la asistencia) se baja
// solo cuando alguien toca "Gestionar": la agenda no la necesita para pintarse.
const VistaGestion = dynamic(() => import("./VistaGestion"), {
  loading: () => <p className="text-base text-[var(--texto-tenue)]">Cargando…</p>,
});

const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base";

export default function ClientePanelSala({
  salas,
  motivos,
  motivosSuspension,
  opcionesDuracionMin,
  incrementoMin,
  minimoMin,
  puedeEditar,
}: {
  salas: { id: number; nombre: string }[];
  motivos: { valor: string; etiqueta: string }[];
  /** H4: para el panel de gestión de una reserva (`GestionReserva`). */
  motivosSuspension: { valor: string; etiqueta: string }[];
  opcionesDuracionMin: number[];
  incrementoMin: number;
  minimoMin: number;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  // La fecha y el slot gestionado viven en la URL: Atrás vuelve a la agenda y
  // refrescar no pierde dónde se estaba.
  const fechaUrl = params.get("fecha");
  const claveGestion = params.get("gestionar");
  const [fecha, setFecha] = useState(fechaUrl && ISO_FECHA.test(fechaUrl) ? fechaUrl : hoyISO());
  const [agenda, setAgenda] = useState<Awaited<ReturnType<typeof consultarAgendaDia>> | null>(null);
  const [cargando, startCarga] = useTransition();
  // Cuándo se leyó la agenda: "por cerrar" se mide contra ese momento.
  const [ahora, setAhora] = useState(() => new Date());
  const [filtro, setFiltro] = useState<FiltroAgenda>("todo");
  // El último slot gestionado: se resalta en la agenda al volver, y se conserva
  // si la acción lo sacó de ella (una reserva suspendida ya no figura en el día).
  const [ultimoSlot, setUltimoSlot] = useState<SlotSala | null>(null);
  // Dónde estaba el scroll de la agenda, para devolverlo al volver.
  const scrollAgenda = useRef<number | null>(null);
  // La vista se abrió con un push desde la agenda (Atrás vuelve); si se cargó
  // directo por URL no hay a dónde volver y se reemplaza.
  const abiertaDesdeAgenda = useRef(false);
  const salaIds = salas.map((s) => s.id);
  const claveSalas = salaIds.join(",");

  // Una sola lectura para todas las tarjetas y la lista externa.
  function recargar() {
    startCarga(async () => {
      const a = await consultarAgendaDia(salaIds, fecha);
      setAgenda(a);
      setAhora(new Date());
    });
  }

  function urlAgenda(f: string, gestionar?: string): string {
    const q = new URLSearchParams({ fecha: f });
    if (gestionar) q.set("gestionar", gestionar);
    return `${ruta}?${q.toString()}`;
  }

  // Cambiar de fecha es un cambio menor de la agenda: reemplaza, no suma historial.
  function cambiarFecha(f: string) {
    setFecha(f);
    if (f && ISO_FECHA.test(f)) router.replace(urlAgenda(f), { scroll: false });
  }

  // Abrir la vista de trabajo suma una entrada al historial: Atrás vuelve a la agenda.
  function abrirGestion(sl: SlotSala) {
    scrollAgenda.current = window.scrollY;
    abiertaDesdeAgenda.current = true;
    setUltimoSlot(sl);
    router.push(urlAgenda(fecha, sl.clave), { scroll: false });
  }

  function volverALaAgenda() {
    if (abiertaDesdeAgenda.current) {
      abiertaDesdeAgenda.current = false;
      router.back();
    } else {
      router.replace(urlAgenda(fecha), { scroll: false });
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, claveSalas]);

  const todos = agenda
    ? [...Object.values(agenda.salas).flatMap((d) => d.slots), ...agenda.externos.reservas.map((r) => r.slot)]
    : [];
  const resumen = resumirAgenda(todos, ahora);

  // El slot de la vista: el de la agenda recién leída (datos frescos) o, si la
  // acción lo sacó del día, el último que se tenía.
  const enAgenda = claveGestion ? (todos.find((s) => s.clave === claveGestion) ?? null) : null;
  if (enAgenda && enAgenda !== ultimoSlot) setUltimoSlot(enAgenda);
  const slotVista = claveGestion ? (enAgenda ?? (ultimoSlot?.clave === claveGestion ? ultimoSlot : null)) : null;

  // Al volver a la agenda se devuelve el scroll donde estaba.
  const enVista = !!claveGestion;
  useEffect(() => {
    if (enVista || scrollAgenda.current == null) return;
    const y = scrollAgenda.current;
    scrollAgenda.current = null;
    window.scrollTo({ top: y });
  }, [enVista]);

  if (salas.length === 0) {
    return (
      <p className="text-base text-[var(--texto-tenue)]">
        Todavía no hay ninguna sala activa cargada. Se carga en Administración → Sala y horarios.
      </p>
    );
  }

  if (claveGestion) {
    if (!slotVista) {
      // Cargando la agenda (se entró por URL directa) o el slot ya no está en ese día.
      return agenda && !cargando ? (
        <div className="space-y-4">
          <p className="text-base">Esa clase o reserva ya no figura en la agenda de este día.</p>
          <button type="button" onClick={volverALaAgenda} className="text-base text-[var(--primario)] underline">
            ← Volver a la agenda
          </button>
        </div>
      ) : (
        <p className="text-base text-[var(--texto-tenue)]">Cargando…</p>
      );
    }
    return (
      <VistaGestion
        key={slotVista.clave}
        slot={slotVista}
        salasPropias={salas}
        motivosSuspension={motivosSuspension}
        incrementoMin={incrementoMin}
        minimoMin={minimoMin}
        onVolver={volverALaAgenda}
        onCambio={recargar}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-base font-medium">Fecha</span>
        <input type="date" value={fecha} onChange={(e) => cambiarFecha(e.target.value)} className={control} />
      </div>

      {agenda && (
        <div className="flex items-center gap-3 flex-wrap" role="group" aria-label="Pendientes de la agenda">
          <BotonResumen
            activo={filtro === "solicitudes"}
            vacio={resumen.solicitudes === 0}
            onClick={() => setFiltro(filtro === "solicitudes" ? "todo" : "solicitudes")}
          >
            ⏳ {resumen.solicitudes} {resumen.solicitudes === 1 ? "solicitud por responder" : "solicitudes por responder"}
            {resumen.urgentes > 0 && ` (${resumen.urgentes} urgente${resumen.urgentes === 1 ? "" : "s"})`}
          </BotonResumen>
          <BotonResumen
            activo={filtro === "por_cerrar"}
            vacio={resumen.porCerrar === 0}
            onClick={() => setFiltro(filtro === "por_cerrar" ? "todo" : "por_cerrar")}
          >
            ✔ {resumen.porCerrar} {resumen.porCerrar === 1 ? "clase por cerrar" : "clases por cerrar"}
          </BotonResumen>
          {filtro !== "todo" && (
            <button onClick={() => setFiltro("todo")} className="text-sm text-[var(--primario)] hover:underline">
              Ver todo
            </button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {salas.map((s) => (
          <ClienteDisponibilidadSala
            key={s.id}
            salaId={s.id}
            salaNombre={s.nombre}
            fecha={fecha}
            datos={agenda?.salas[s.id] ?? null}
            cargando={cargando}
            onRecargar={recargar}
            motivos={motivos}
            opcionesDuracionMin={opcionesDuracionMin}
            puedeEditar={puedeEditar}
            ahora={ahora}
            filtro={filtro}
            enfocadoClave={ultimoSlot?.clave ?? null}
            onGestionar={abrirGestion}
          />
        ))}
      </div>

      {/* Aparte de las salas propias, no una más en el selector (Javier,
          2026-09-27): una reserva en un lugar externo no tiene horario propio
          ni se bloquea. */}
      <AgendamientosExternos
        datos={agenda?.externos ?? null}
        cargando={cargando}
        ahora={ahora}
        filtro={filtro}
        enfocadoClave={ultimoSlot?.clave ?? null}
        onGestionar={abrirGestion}
      />
    </div>
  );
}

function BotonResumen({
  activo,
  vacio,
  onClick,
  children,
}: {
  activo: boolean;
  vacio: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`px-4 py-2 text-base font-semibold rounded-full border ${
        activo
          ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)]"
          : vacio
            ? "border-[var(--borde)] text-[var(--texto-tenue)]"
            : "border-[var(--advertencia-texto)] bg-[var(--advertencia-fill)] text-[var(--advertencia-texto)]"
      }`}
    >
      {children}
    </button>
  );
}
