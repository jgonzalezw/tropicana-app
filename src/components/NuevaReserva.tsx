"use client";

/**
 * "+ Nueva reserva" de una membresía de horas (particular o alquiler): fecha,
 * hora, duración, dónde y Confirmar directo / Solicitar. Una pieza, dos marcos:
 *
 *  - `marco="pagina"`: el recuadro punteado de siempre, al pie de
 *    `ReservasDeMembresia` (`/particulares/[id]` y `/alquileres/[id]`).
 *  - `marco="hoja"`: dentro de `HojaLateral` en la ficha `/membresias/[id]`,
 *    con las acciones y el motivo de bloqueo en el pie de la hoja.
 *
 * `inicial` deja abrirla con fecha, hora y sala puestas (D32: la grilla de sala
 * de C4 abre la venta/reserva desde un slot). La validación del horario de la
 * sala y sus excepciones es del servidor (`crearReserva`); acá solo la regla de
 * tiempos (`faltaNuevaReserva`, compartida) para deshabilitar y explicar.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatearHoras, opcionesDuracionReserva } from "@/lib/horarios";
import { faltaNuevaReserva } from "@/lib/reservas";
import AvisoWhatsapp from "@/components/AvisoWhatsapp";
import HojaLateral from "@/components/nuevo/HojaLateral";
import { crearReserva } from "@/app/(privado)/particulares/acciones";

const control =
  "px-3 py-2 rounded-[var(--radio-control)] border border-[var(--borde)] bg-[var(--fondo)] text-base w-full";
const botonPrimario =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] font-medium hover:opacity-90 disabled:opacity-40";
const botonTenue =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40";
const etiqueta = "text-sm text-[var(--texto-tenue)] block mb-1";

type Aviso = { nombre: string; whatsapp: string | null; mensaje: string };
export type ResultadoNueva = { error?: string; mensaje?: string; avisoAlumno?: Aviso; avisoProfesor?: Aviso };

export function PanelResultado({ r }: { r: ResultadoNueva }) {
  return (
    <div className="mt-3 space-y-2">
      {r.error && (
        <p className="text-[var(--peligro)]" role="alert">
          {r.error}
        </p>
      )}
      {r.mensaje && <p className="text-[var(--exito)]">{r.mensaje}</p>}
      {r.avisoAlumno && <AvisoWhatsapp nombre={r.avisoAlumno.nombre} whatsapp={r.avisoAlumno.whatsapp} mensaje={r.avisoAlumno.mensaje} />}
      {r.avisoProfesor && (
        <AvisoWhatsapp nombre={r.avisoProfesor.nombre} whatsapp={r.avisoProfesor.whatsapp} mensaje={r.avisoProfesor.mensaje} />
      )}
    </div>
  );
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NuevaReserva({
  membresiaId,
  tipo,
  fechaInicio,
  fechaFin,
  contratadasMin,
  disponibleMin,
  salas,
  tieneExterna,
  nombreExterna,
  incrementoMin,
  minimoMin,
  inicial,
  marco = "pagina",
  onCerrar,
}: {
  membresiaId: number;
  tipo: "particular" | "alquiler";
  fechaInicio: string;
  fechaFin: string;
  contratadasMin: number;
  disponibleMin: number;
  /** Salas propias activas (la externa va aparte). */
  salas: { id: number; nombre: string }[];
  tieneExterna: boolean;
  /** Nombre del lugar externo ya registrado en la membresía, si lo hay. */
  nombreExterna: string | null;
  incrementoMin: number;
  minimoMin: number;
  /** Valores con los que abre (D32: un slot de la agenda). */
  inicial?: { fecha?: string; hora?: string; salaId?: number };
  marco?: "pagina" | "hoja";
  /** Solo en la hoja: cerrarla. */
  onCerrar?: () => void;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<ResultadoNueva | null>(null);
  const [tocada, setTocada] = useState(false);

  // Regla de tiempos de una reserva (26/09): duración en múltiplos del
  // mínimo; el intervalo estándar es para la hora de inicio.
  const todasLasDuraciones = useMemo(() => opcionesDuracionReserva(minimoMin), [minimoMin]);
  const duracionesNueva = todasLasDuraciones.filter((d) => d <= disponibleMin);
  const agotado = duracionesNueva.length === 0;

  const desde = [hoyISO(), fechaInicio].sort()[1];
  const fechaInicial = inicial?.fecha ?? (desde > fechaFin ? fechaFin : desde);
  const [nFecha, setNFecha] = useState(fechaInicial);
  const [nHora, setNHora] = useState(inicial?.hora ?? "18:00");
  const [nDuracionElegida, setNDuracion] = useState(duracionesNueva[0] ?? minimoMin);
  // Si el saldo cambió después de una acción, la duración elegida puede ya
  // no entrar: se usa la primera que sí entra, sin dejar un valor invisible.
  const nDuracion = duracionesNueva.includes(nDuracionElegida) ? nDuracionElegida : (duracionesNueva[0] ?? minimoMin);
  const [nSalaTipo, setNSalaTipo] = useState<"propia" | "externa">("propia");
  const [nSalaId, setNSalaId] = useState<number | null>(inicial?.salaId ?? salas[0]?.id ?? null);
  const [nNombreExterna, setNNombreExterna] = useState(nombreExterna ?? "");

  const falta = faltaNuevaReserva({
    fecha: nFecha,
    hora: nHora,
    duracionMin: nDuracion,
    incrementoMin,
    minimoMin,
    salaTipo: nSalaTipo,
    salaId: nSalaId,
    nombreExterna: nNombreExterna,
  });
  const creada = !!resultado && !resultado.error;

  function crear(accion: "solicitar" | "confirmar") {
    setResultado(null);
    startTransition(async () => {
      const r = await crearReserva({
        membresiaId,
        fecha: nFecha,
        hora: nHora,
        duracionMin: nDuracion,
        sala: nSalaTipo === "externa" ? { tipo: "externa", nombreDescriptivo: nNombreExterna } : { tipo: "propia", salaId: nSalaId! },
        accion,
      });
      setResultado(r);
      if (!r.error) {
        setTocada(false);
        router.refresh();
      }
    });
  }

  const tocar = <T,>(set: (v: T) => void) => (v: T) => {
    setTocada(true);
    set(v);
  };

  const campos = (
    <div className={marco === "hoja" ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 sm:grid-cols-4 gap-3"}>
      <div>
        <label className={etiqueta}>Fecha</label>
        <input
          type="date"
          className={control}
          value={nFecha}
          min={fechaInicio}
          max={fechaFin}
          onChange={(e) => tocar(setNFecha)(e.target.value)}
        />
      </div>
      <div>
        <label className={etiqueta}>Hora de inicio</label>
        <input type="time" className={control} value={nHora} onChange={(e) => tocar(setNHora)(e.target.value)} />
      </div>
      <div>
        <label className={etiqueta}>Duración</label>
        <select className={control} value={nDuracion} onChange={(e) => tocar(setNDuracion)(Number(e.target.value))}>
          {duracionesNueva.map((d) => (
            <option key={d} value={d}>
              {formatearHoras(d / 60)} h
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={etiqueta}>Dónde</label>
        <select className={control} value={nSalaTipo} onChange={(e) => tocar(setNSalaTipo)(e.target.value as "propia" | "externa")}>
          <option value="propia">Sala propia</option>
          {tieneExterna && <option value="externa">Lugar externo</option>}
        </select>
      </div>
      {nSalaTipo === "propia" ? (
        <div>
          <label className={etiqueta}>Sala</label>
          <select className={control} value={nSalaId ?? ""} onChange={(e) => tocar(setNSalaId)(Number(e.target.value))}>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="col-span-2">
          <label className={etiqueta}>Nombre del lugar</label>
          <input
            className={control}
            placeholder="Salón X — Hotel Y"
            value={nNombreExterna}
            onChange={(e) => tocar(setNNombreExterna)(e.target.value)}
          />
        </div>
      )}
    </div>
  );

  // Marco `hoja` (ficha de Membresías): campos del mockup, con la duración y la
  // sala en chips y «Dónde» segmentado. Mismos estados y mismas reglas que arriba.
  const camposHoja = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="n-campo">
          <span>Fecha</span>
          <input type="date" value={nFecha} min={fechaInicio} max={fechaFin} onChange={(e) => tocar(setNFecha)(e.target.value)} />
        </label>
        <label className="n-campo">
          <span>Hora de inicio</span>
          <input type="time" value={nHora} onChange={(e) => tocar(setNHora)(e.target.value)} />
        </label>
      </div>
      <div className="n-campo">
        <span>Duración</span>
        <div className="n-chips-opcion" role="group" aria-label="Duración">
          {duracionesNueva.map((d) => (
            <button key={d} type="button" className="n-chip-opcion" aria-pressed={nDuracion === d} onClick={() => tocar(setNDuracion)(d)}>
              {formatearHoras(d / 60)} h
            </button>
          ))}
        </div>
        <span className="n-res__nota">
          Disponible para pedir: {formatearHoras(disponibleMin / 60)} h. Múltiplos de {formatearHoras(minimoMin / 60)} h.
        </span>
      </div>
      {tieneExterna && (
        <div className="n-campo">
          <span>Dónde</span>
          <div className="n-segmentado" role="group" aria-label="Dónde">
            <button type="button" aria-pressed={nSalaTipo === "propia"} onClick={() => tocar(setNSalaTipo)("propia")}>
              Sala propia
            </button>
            <button type="button" aria-pressed={nSalaTipo === "externa"} onClick={() => tocar(setNSalaTipo)("externa")}>
              Lugar externo
            </button>
          </div>
        </div>
      )}
      {nSalaTipo === "propia" ? (
        <div className="n-campo">
          <span>Sala</span>
          <div className="n-chips-opcion" role="group" aria-label="Sala">
            {salas.map((x) => (
              <button key={x.id} type="button" className="n-chip-opcion" aria-pressed={nSalaId === x.id} onClick={() => tocar(setNSalaId)(x.id)}>
                {x.nombre}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <label className="n-campo">
          <span>Nombre del lugar</span>
          <input placeholder="Salón X — Hotel Y" value={nNombreExterna} onChange={(e) => tocar(setNNombreExterna)(e.target.value)} />
        </label>
      )}
    </div>
  );

  const sinHoras = (
    <p className="text-[var(--texto-tenue)]">
      No quedan horas para reservar: {disponibleMin > 0 ? `quedan ${formatearHoras(disponibleMin / 60)} h, menos que` : "se usó todo"}{" "}
      {disponibleMin > 0 ? `el mínimo de ${formatearHoras(minimoMin / 60)} h por reserva` : `el paquete de ${formatearHoras(contratadasMin / 60)} h`}
      . Una Suspendida o una cancelación a tiempo devuelven horas; sumar horas nuevas es la extensión de membresía (todavía no construida).
    </p>
  );

  if (marco === "hoja") {
    return (
      <HojaLateral
        contexto={tipo === "alquiler" ? "Alquiler" : "Clase particular"}
        titulo="Nueva reserva"
        onCerrar={onCerrar ?? (() => {})}
        sucia={tocada && !creada}
        pie={creada ? undefined : (falta ?? undefined)}
        verCancelar={!creada}
        secundaria={agotado || creada ? undefined : { txt: "Solicitar", onClick: () => crear("solicitar"), bloqueada: pendiente || !!falta }}
        primaria={
          creada
            ? { txt: "Listo", onClick: onCerrar ?? (() => {}) }
            : agotado
              ? undefined
              : { txt: "Confirmar directo", onClick: () => crear("confirmar"), bloqueada: pendiente || !!falta }
        }
      >
        {agotado ? sinHoras : creada ? null : camposHoja}
        {resultado && <PanelResultado r={resultado} />}
      </HojaLateral>
    );
  }

  return (
    // Distinta a propósito de las tarjetas de reserva (Javier, 26/09): es
    // un formulario para agregar, no una reserva más de la lista.
    <section className="rounded-[var(--radio-panel)] border-2 border-dashed border-[var(--primario)] bg-[var(--fondo-panel)] p-4">
      <h2 className="font-medium mb-3 text-[var(--primario)]">+ Nueva reserva</h2>
      {agotado ? (
        sinHoras
      ) : (
        <>
          {campos}
          <div className="mt-3 flex gap-2 flex-wrap items-center">
            <button className={botonPrimario} disabled={pendiente || !!falta} onClick={() => crear("confirmar")}>
              Confirmar directo
            </button>
            <button className={botonTenue} disabled={pendiente || !!falta} onClick={() => crear("solicitar")}>
              Solicitar
            </button>
            {falta && <span className="text-sm text-[var(--texto-tenue)]">{falta}</span>}
          </div>
        </>
      )}
      {resultado && <PanelResultado r={resultado} />}
    </section>
  );
}
