"use client";

/**
 * Una reserva en la ficha de Membresías (spec visual v3): fila compacta con el
 * estado en pastilla y un chevron; las acciones aparecen solo con la fila
 * abierta. La lógica (qué acciones aplican, los formularios y las llamadas al
 * servidor) es la de `useGestionReserva`, la misma de `GestionReserva`; acá solo
 * se dibuja. Textos del mockup donde la acción coincide, y los reales donde no
 * hay equivalente («Rechazar solicitud», «No se presentó»).
 */

import AvisoWhatsapp from "@/components/AvisoWhatsapp";
import {
  efectoDestino,
  etiquetaPrimaria,
  fechaHoraCompleta,
  useGestionReserva,
  type Resultado,
} from "@/components/useGestionReserva";
import { fechaTexto } from "@/lib/fichaMembresia";
import { formatearHoras } from "@/lib/horarios";
import { ETIQUETA_ESTADO_RESERVA, pastillaDeReserva, textoCancelarAPedido, type EstadoReserva } from "@/lib/reservas";
import type { ReservaConHistorial } from "@/app/(privado)/particulares/acciones";
import { Chip } from "./Chip";

/** Orden de los botones, como en el mockup. */
const ORDEN: EstadoReserva[] = ["confirmada", "realizada", "ausente", "reprogramada", "suspendida", "reagendar"];

function textoAccion(destino: EstadoReserva, actual: EstadoReserva, tipo: "particular" | "alquiler", cancelar: string): string {
  switch (destino) {
    case "confirmada":
      return "Confirmar";
    case "realizada":
      return "Marcar realizada";
    case "ausente":
      return tipo === "alquiler" ? "No se presentó" : "Marcar ausente";
    case "reprogramada":
      return "Reprogramar";
    case "suspendida":
      return actual === "solicitada" ? "Rechazar solicitud" : "Suspender…";
    case "reagendar":
      return actual === "solicitada" ? "Cancelar solicitud" : cancelar;
    default:
      return ETIQUETA_ESTADO_RESERVA[destino];
  }
}

/** «2026-10-05T01:00:00Z» → «Dom 4 oct» en hora de Bolivia (el día no se corre por la zona). */
function fechaDeEvento(iso: string): string {
  const dia = new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });
  return fechaTexto(dia);
}

function ResultadoFila({ r }: { r: Resultado }) {
  return (
    <div className="n-res__resultado">
      {r.error && (
        <p className="n-error" role="alert">
          {r.error}
        </p>
      )}
      {r.mensaje && <p className="n-ok">{r.mensaje}</p>}
      <div className="n-wa">
        {r.avisoAlumno && <AvisoWhatsapp nombre={r.avisoAlumno.nombre} whatsapp={r.avisoAlumno.whatsapp} mensaje={r.avisoAlumno.mensaje} />}
        {r.avisoProfesor && <AvisoWhatsapp nombre={r.avisoProfesor.nombre} whatsapp={r.avisoProfesor.whatsapp} mensaje={r.avisoProfesor.mensaje} />}
      </div>
    </div>
  );
}

export default function FilaReserva({
  reserva,
  tipo,
  disponibleMin,
  fechaInicioMembresia,
  fechaFinMembresia,
  salasPropias,
  salaExternaDeLaMembresia,
  motivosSuspension,
  incrementoMin,
  minimoMin,
  puedeEditar,
  plazoCancelacionHoras,
  ahora,
  abierta,
  onToggle,
  onCambio,
  onReprogramar,
}: {
  reserva: ReservaConHistorial;
  tipo: "particular" | "alquiler";
  disponibleMin: number;
  fechaInicioMembresia: string;
  fechaFinMembresia: string;
  salasPropias: { id: number; nombre: string }[];
  salaExternaDeLaMembresia?: { salaId: number; nombre: string } | null;
  motivosSuspension: { valor: string; etiqueta: string }[];
  incrementoMin: number;
  minimoMin: number;
  puedeEditar: boolean;
  /** Parámetro `reserva_cancelacion_plazo_horas`: decide si «Cancelar a pedido» devuelve o consume la hora. */
  plazoCancelacionHoras: number;
  /** Instante de la página (ISO), el mismo en el servidor y el cliente. */
  ahora: string;
  abierta: boolean;
  onToggle: () => void;
  onCambio: () => void;
  /** Si viene, «Reprogramar» lo llama en vez de abrir el formulario de la fila (la ficha abre la hoja de franjas). */
  onReprogramar?: () => void;
}) {
  const g = useGestionReserva({
    reserva,
    tipo,
    disponibleMin,
    salasPropias,
    salaExternaDeLaMembresia,
    incrementoMin,
    minimoMin,
    onCambio,
  });
  const ahoraD = new Date(ahora);
  const pastilla = pastillaDeReserva(reserva, ahoraD);
  const ultimo = reserva.historial[reserva.historial.length - 1];
  const sub = ultimo
    ? `${ETIQUETA_ESTADO_RESERVA[ultimo.estado_nuevo as EstadoReserva] ?? ultimo.estado_nuevo} · ${fechaDeEvento(ultimo.creado_en)}${ultimo.motivo ? ` · ${ultimo.motivo}` : ""}`
    : "";
  const cancelar = textoCancelarAPedido(ahoraD, new Date(`${reserva.fecha}T${reserva.hora}`), plazoCancelacionHoras);
  const acciones = ORDEN.filter((d) => reserva.transicionesPermitidas.includes(d));
  const sugerida: EstadoReserva | null = reserva.estado === "solicitada" ? "confirmada" : pastilla.porCerrar ? "realizada" : null;
  const ocupado = g.pendiente;

  return (
    <div className="n-res" data-testid="fila-reserva" data-estado={reserva.estado} data-abierta={abierta ? "true" : undefined}>
      <button type="button" className="n-res__fila" aria-expanded={abierta} onClick={onToggle}>
        <span className="n-res__fecha">{fechaTexto(reserva.fecha, ahoraD)}</span>
        <span className="n-res__centro">
          <span className="n-res__titulo">
            {reserva.hora.slice(0, 5)} · {formatearHoras(reserva.duracion_min / 60)} h · {reserva.salaNombre}
          </span>
          {sub && <span className="n-res__sub">{sub}</span>}
        </span>
        <Chip tono={pastilla.tono}>{pastilla.texto}</Chip>
        <span className="n-res__chevron" aria-hidden="true">
          {abierta ? "▲" : "▼"}
        </span>
      </button>

      {abierta && (
        <div className="n-res__panel">
          {reserva.estado === "solicitada" && reserva.solicitada_hasta && reserva.ocupaAhora && (
            <p className="n-res__nota">Ocupa la sala hasta {fechaHoraCompleta(reserva.solicitada_hasta)}; después se libera sola.</p>
          )}
          {reserva.esCortesia && (
            <p className="n-res__nota">
              <b>Cortesía</b> — no devenga ni descuenta horas.{reserva.cortesiaMotivo ? ` Motivo: ${reserva.cortesiaMotivo}` : ""}
            </p>
          )}

          {puedeEditar && !g.accion && !g.abrirCortesia && (
            <div className="n-res__botones">
              {acciones.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="n-res__boton"
                  data-primario={d === sugerida ? "true" : undefined}
                  disabled={ocupado}
                  onClick={() => {
                    g.setResultado(null);
                    if (d === "reprogramada") (onReprogramar ?? g.abrirReprogramar)();
                    else g.setAccion(d);
                  }}
                >
                  {textoAccion(d, reserva.estado, tipo, cancelar)}
                </button>
              ))}
              {(reserva.permiteCortesia || reserva.esCortesia) &&
                (reserva.esCortesia ? (
                  <button type="button" className="n-res__boton" disabled={ocupado} onClick={() => g.guardarCortesia(null)}>
                    Quitar cortesía
                  </button>
                ) : (
                  <button type="button" className="n-res__boton" disabled={ocupado} onClick={() => g.setAbrirCortesia(true)}>
                    Cortesía
                  </button>
                ))}
            </div>
          )}
          {puedeEditar && !g.accion && !g.abrirCortesia && acciones.length === 0 && !reserva.permiteCortesia && !reserva.esCortesia && (
            <span className="n-res__nota">Estado final: no tiene más acciones.</span>
          )}

          {puedeEditar && g.accion === "reprogramada" && (
            <div className="n-res__form">
              <label className="n-campo">
                <span>Nueva fecha</span>
                <input type="date" value={g.rFecha} min={fechaInicioMembresia} max={fechaFinMembresia} onChange={(e) => g.setRFecha(e.target.value)} />
              </label>
              <label className="n-campo">
                <span>Hora</span>
                <input type="time" value={g.rHora} onChange={(e) => g.setRHora(e.target.value)} />
              </label>
              <label className="n-campo">
                <span>Duración</span>
                <select value={g.rDuracion} onChange={(e) => g.setRDuracion(Number(e.target.value))}>
                  {g.opcionesDur.map((d) => (
                    <option key={d} value={d}>
                      {formatearHoras(d / 60)} h
                    </option>
                  ))}
                </select>
              </label>
              <label className="n-campo">
                <span>Sala</span>
                <select value={g.rSalaId ?? ""} onChange={(e) => g.setRSalaId(Number(e.target.value))}>
                  {g.salasReprogramar.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="n-res__boton" data-primario="true" disabled={ocupado || !!g.faltaReprogramar} onClick={g.confirmarReprogramar}>
                Guardar
              </button>
              <button type="button" className="n-res__boton" disabled={ocupado} onClick={() => g.setAccion(null)}>
                Volver
              </button>
              {g.faltaReprogramar && <span className="n-res__falta">{g.faltaReprogramar}</span>}
            </div>
          )}

          {puedeEditar && g.accion === "suspendida" && (
            <div className="n-res__form n-res__form--col">
              <p className="n-res__nota">{efectoDestino("suspendida", reserva.estado)}</p>
              <div className="n-res__motivos">
                <span className="n-res__nota">Motivo</span>
                {motivosSuspension.map((m) => (
                  <button
                    key={m.valor}
                    type="button"
                    className="n-res__motivo"
                    aria-pressed={g.motivoSuspension === m.valor}
                    onClick={() => g.setMotivoSuspension(m.valor)}
                  >
                    {m.etiqueta}
                  </button>
                ))}
              </div>
              <div className="n-res__botones">
                <button
                  type="button"
                  className="n-res__boton"
                  data-peligro="true"
                  disabled={ocupado || !g.motivoSuspension}
                  onClick={() => g.transicionar("suspendida", { motivo: g.motivoSuspension })}
                >
                  {reserva.estado === "solicitada" ? "Rechazar solicitud" : "Suspender y devolver la hora"}
                </button>
                <button type="button" className="n-res__boton" disabled={ocupado} onClick={() => g.setAccion(null)}>
                  Volver
                </button>
                {!g.motivoSuspension && <span className="n-res__falta">Elegí un motivo</span>}
              </div>
            </div>
          )}

          {puedeEditar && g.accion && g.accion !== "suspendida" && g.accion !== "reprogramada" && (
            <div className="n-res__form n-res__form--col">
              <p className="n-res__nota">{efectoDestino(g.accion, reserva.estado)}</p>
              <div className="n-res__botones">
                <button
                  type="button"
                  className="n-res__boton"
                  data-primario={g.accion === "reagendar" ? undefined : "true"}
                  data-peligro={g.accion === "reagendar" ? "true" : undefined}
                  disabled={ocupado}
                  onClick={() => g.transicionar(g.accion!)}
                >
                  {etiquetaPrimaria(g.accion, reserva.estado, tipo)}
                </button>
                <button type="button" className="n-res__boton" disabled={ocupado} onClick={() => g.setAccion(null)}>
                  Volver
                </button>
              </div>
            </div>
          )}

          {puedeEditar && g.abrirCortesia && !g.accion && (
            <div className="n-res__form n-res__form--col">
              <label className="n-campo n-campo--ancho">
                <span>Motivo de la cortesía (quién la otorga, por qué)</span>
                <input value={g.motivoCortesia} onChange={(e) => g.setMotivoCortesia(e.target.value)} />
              </label>
              <div className="n-res__botones">
                <button
                  type="button"
                  className="n-res__boton"
                  data-primario="true"
                  disabled={ocupado || !g.motivoCortesia.trim()}
                  onClick={() => g.guardarCortesia(g.motivoCortesia)}
                >
                  Guardar cortesía
                </button>
                <button
                  type="button"
                  className="n-res__boton"
                  disabled={ocupado}
                  onClick={() => {
                    g.setAbrirCortesia(false);
                    g.setMotivoCortesia("");
                  }}
                >
                  Volver
                </button>
              </div>
            </div>
          )}

          {g.resultado && <ResultadoFila r={g.resultado} />}

          {reserva.historial.length > 0 && (
            <ul className="n-res__historial" aria-label="Historial de la reserva">
              {reserva.historial.map((h, i) => (
                <li key={i}>
                  {fechaHoraCompleta(h.creado_en)} — {ETIQUETA_ESTADO_RESERVA[h.estado_nuevo as EstadoReserva] ?? h.estado_nuevo} (
                  {fechaTexto(h.fecha_nueva, ahoraD)} {h.hora_nueva.slice(0, 5)}){h.motivo ? ` · ${h.motivo}` : ""}
                  {h.fuera_de_plazo ? " · fuera de plazo" : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
