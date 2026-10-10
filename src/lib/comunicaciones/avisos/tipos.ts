/**
 * R20 · E4b/E5 — lo que el servidor le entrega a la pantalla sobre un aviso
 * registrado (S05). Sin imports de servidor: lo usan componentes de cliente.
 */
import type { Contactabilidad } from "../contactabilidad.ts";
import type { AccionAviso } from "./estado.ts";

export type CasoAvisoReserva = "N09" | "N10";
export type MotivoFallo = "contenido" | "variable_faltante" | "destinatario" | "contactabilidad";

/** De qué evento sale el aviso: la fila de `reservas_historial` que dejó la confirmación. */
export type EventoAviso = { membresiaId: number; historialId: number };

export type RegistroAviso = {
  caso: CasoAvisoReserva;
  evento: EventoAviso;
  /** `null` si el registro no se pudo guardar (el texto se conserva; se reintenta). */
  avisoId: number | null;
  /** Cuándo se preparó (instante del registro). */
  creadoEn: string | null;
  estado: "preparado" | "bloqueado" | "fallido";
  motivoFallo: MotivoFallo | null;
  /** Lo que falló, en palabras de quien opera. */
  detalle: string | null;
  /** Se pudo preparar el aviso pero no guardarlo. */
  errorRegistro: string | null;
  /** La versión oficial seleccionada para ESTE aviso. */
  origen: { numero: number | null; etiqueta: string | null; liberadaEn: string | null; respaldo: boolean };
  contactabilidad: Contactabilidad | null;
  acciones: AccionAviso[];
  /** Quién puede usar el texto anterior ahora (solo si el contenido oficial falló). */
  respaldo: "no_aplica" | "admin" | "autorizado" | "necesita_admin";
};

/** Un aviso para una persona: el mismo `{nombre, whatsapp, mensaje}` de siempre, más su registro. */
export type AvisoRegistrable = {
  nombre: string;
  whatsapp: string | null;
  mensaje: string;
  registro?: RegistroAviso;
};
