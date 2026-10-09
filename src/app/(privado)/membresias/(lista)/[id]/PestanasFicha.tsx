"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chip } from "@/components/nuevo/Chip";
import FilaReserva from "@/components/nuevo/FilaReserva";
import { nombreVisible } from "@/lib/formato";
import { fechaTexto, montoCorto, type EventoHistorial, type LineaPago } from "@/lib/fichaMembresia";
import type { ClaseFicha } from "@/lib/membresiasLectura";
import { formatearHoras } from "@/lib/horarios";
import type { ReservaConHistorial } from "../../../particulares/acciones";
import { useNuevaReserva } from "./NuevaReservaFicha";

type Pestana = "clases" | "pagos" | "historial";

export type DatosReservas = {
  membresiaId: number;
  tipo: "particular" | "alquiler";
  contratadasMin: number;
  disponibleMin: number;
  fechaInicio: string;
  fechaFin: string;
  salasPropias: { id: number; nombre: string }[];
  salaExterna: { salaId: number; nombre: string } | null;
  /** `permisosReservasFicha`: qué se puede hacer y, si no, por qué. */
  puedeEditar: boolean;
  ofrecerExterna: boolean;
  /** `null` si se puede crear una reserva; si no, el motivo. */
  motivoSinAlta: string | null;
  motivosSuspension: { valor: string; etiqueta: string }[];
  incrementoMin: number;
  minimoMin: number;
  /** Parámetro `reserva_cancelacion_plazo_horas`: «Cancelar a pedido» devuelve la hora dentro del plazo y la consume fuera. */
  plazoCancelacionHoras: number;
  /** Instante en que se armó la página (ISO): el mismo en el servidor y el cliente. */
  ahora: string;
  reservas: ReservaConHistorial[];
};

function chipClase(c: ClaseFicha): { tono: "exito" | "ambar" | "peligro" | "tenue"; texto: string } {
  if (c.estadoSesion !== "dictada") return { tono: "tenue", texto: "No se dictó" };
  if (c.presente) return { tono: "exito", texto: "Presente" };
  return c.conLicencia ? { tono: "ambar", texto: "Licencia" } : { tono: "peligro", texto: "Falta" };
}

/**
 * Clases o Reservas · Pagos · Historial. Las reservas se montan con
 * `GestionReserva` (con el permiso real, fase 2) y arriba van el resumen del
 * saldo y «+ Nueva reserva», que abre la hoja lateral.
 */
export default function PestanasFicha({
  clases,
  reservas,
  pagos,
  puedeVerRecibo,
  historial,
}: {
  /** Regular o prueba: sus clases. En horas es `null` y la primera pestaña es «Reservas». */
  clases: ClaseFicha[] | null;
  reservas: DatosReservas | null;
  pagos: LineaPago[];
  puedeVerRecibo: boolean;
  historial: EventoHistorial[];
}) {
  const router = useRouter();
  const nueva = useNuevaReserva();
  const [activa, setActiva] = useState<Pestana>("clases");
  const [abierta, setAbierta] = useState<number | null>(null);
  const primera = reservas ? "Reservas" : "Clases";

  return (
    <div>
      <div className="n-tabs" role="tablist">
        {([["clases", primera], ["pagos", "Pagos"], ["historial", "Historial"]] as [Pestana, string][]).map(([k, t]) => (
          <button key={k} type="button" role="tab" className="n-tab" aria-selected={activa === k} onClick={() => setActiva(k)}>
            {t}
          </button>
        ))}
      </div>

      {activa === "clases" && !reservas && (
        <div className="n-lineas" role="tabpanel" aria-label="Clases">
          {!clases?.length && <p className="n-vacio">Todavía no hay clases registradas.</p>}
          {clases?.map((c) => {
            const chip = chipClase(c);
            return (
              <div key={c.sesionId} className="n-linea">
                <span className="n-linea__fecha">{fechaTexto(c.fecha)}</span>
                <div>
                  <div className="n-linea__titulo">{nombreVisible(c.cursoNombre)}</div>
                  <div className="n-linea__sub">
                    {c.profesorNombre ?? "Sin profesor registrado"}
                    {c.sustituto ? " · sustituto" : ""}
                  </div>
                </div>
                <Chip tono={chip.tono} chico>{chip.texto}</Chip>
              </div>
            );
          })}
        </div>
      )}

      {activa === "clases" && reservas && (
        <div role="tabpanel" aria-label="Reservas" className="flex flex-col">
          <div className="n-res-cab" data-testid="resumen-reservas">
            <div className="n-res-cab__resumen">
              Disponible para pedir {formatearHoras(reservas.disponibleMin / 60)} h de {formatearHoras(reservas.contratadasMin / 60)} h
              {reservas.motivoSinAlta && <small>{reservas.motivoSinAlta}</small>}
            </div>
            <button
              type="button"
              className="n-boton--punteado"
              data-testid="boton-nueva-reserva"
              disabled={!!reservas.motivoSinAlta}
              title={reservas.motivoSinAlta ?? undefined}
              onClick={() => nueva?.abrir()}
            >
              + Nueva reserva
            </button>
          </div>
          {!reservas.reservas.length && <p className="n-vacio">Todavía no hay reservas.</p>}
          {reservas.reservas.map((r) => (
            <FilaReserva
              key={r.id}
              reserva={r}
              tipo={reservas.tipo}
              disponibleMin={reservas.disponibleMin}
              fechaInicioMembresia={reservas.fechaInicio}
              fechaFinMembresia={reservas.fechaFin}
              salasPropias={reservas.salasPropias}
              salaExternaDeLaMembresia={reservas.salaExterna}
              motivosSuspension={reservas.motivosSuspension}
              incrementoMin={reservas.incrementoMin}
              minimoMin={reservas.minimoMin}
              puedeEditar={reservas.puedeEditar}
              plazoCancelacionHoras={reservas.plazoCancelacionHoras}
              ahora={reservas.ahora}
              abierta={abierta === r.id}
              onToggle={() => setAbierta(abierta === r.id ? null : r.id)}
              onCambio={() => router.refresh()}
              onReprogramar={
                nueva
                  ? () =>
                      nueva.reprogramar({
                        id: r.id,
                        fecha: r.fecha,
                        hora: r.hora.slice(0, 5),
                        duracionMin: r.duracion_min,
                        salaId: r.sala_id,
                        salaNombre: r.salaNombre,
                      })
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {activa === "pagos" && (
        <div className="n-lineas" role="tabpanel" aria-label="Pagos">
          {!pagos.length && <p className="n-vacio">Todavía no hay movimientos de plata.</p>}
          {pagos.map((l) => (
            <div key={l.clave} className="n-linea">
              <span className="n-linea__fecha">{fechaTexto(l.fecha)}</span>
              <div>
                <div className="n-linea__titulo" style={l.tono === "tenue" ? { color: "var(--n-fg2)" } : undefined}>{l.titulo}</div>
                {l.sub && <div className="n-linea__sub">{l.sub}</div>}
              </div>
              <div className="n-linea__der">
                {l.pagoId != null &&
                  (puedeVerRecibo ? (
                    <Link href={`/caja/recibo/${l.pagoId}`} className="n-enlace">Ver recibo</Link>
                  ) : (
                    <span className="n-linea__sub" title="Necesitás el permiso de ver Caja">Ver recibo no disponible</span>
                  ))}
                <Chip tono={l.tono ?? "neutro"} chico>{l.monto < 0 ? `− ${montoCorto(-l.monto)}` : montoCorto(l.monto)}</Chip>
              </div>
            </div>
          ))}
        </div>
      )}

      {activa === "historial" && (
        <div className="n-lineas" role="tabpanel" aria-label="Historial">
          {historial.map((e) => (
            <div key={e.clave} className="n-linea">
              <span className="n-linea__fecha">{fechaTexto(e.fecha)}</span>
              <div>
                <div className="n-linea__titulo">{e.titulo}</div>
                {e.sub && <div className="n-linea__sub">{e.sub}</div>}
              </div>
              <Chip tono="tenue" chico>{e.etiqueta}</Chip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
