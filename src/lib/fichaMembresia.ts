import type { FichaMembresia, PagoFicha } from "./membresiasLectura.ts";
import type { ReservaConHistorial } from "../app/(privado)/particulares/acciones.ts";
import { ETIQUETA_ESTADO_RESERVA, solicitudVigente, type EstadoReserva } from "./reservas.ts";
import { formatearHoras } from "./horarios.ts";
import { gs } from "./inscripcion.ts";

/**
 * La regla de la ficha de una membresía (I-012, fase 1b): qué dicen los
 * indicadores, los avisos y el historial. Pura y sin base de datos, para
 * probarla; los componentes solo la dibujan. Nada se calcula de nuevo: se
 * arma con lo que ya salió de `membresiasLectura` y de `obtenerMembresia`.
 * Ningún plazo va escrito acá: lo que depende de un parámetro llega ya
 * resuelto (por ejemplo, `solicitada_hasta` se fijó al crear la reserva).
 */

export type TonoIndicador = "exito" | "peligro" | "acento";
export type IndicadorFicha = { etiqueta: string; valor: string; sub?: string; tono?: TonoIndicador; progreso?: number };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «8 oct 2026» desde una fecha ISO (solo calendario, sin zona horaria). */
export function fechaTexto(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

const horasTexto = (h: number) => `${formatearHoras(h)} h`;

/** La cuota más antigua con saldo: la que vence primero (sin vencimiento, al final). */
export function cuotaMasAntiguaConSaldo(cuotas: FichaMembresia["cuenta"]["cuotas"]) {
  return cuotas
    .filter((c) => c.saldo > 0)
    .sort((a, b) => (a.vencimiento ?? "9999") < (b.vencimiento ?? "9999") ? -1 : (a.vencimiento ?? "9999") > (b.vencimiento ?? "9999") ? 1 : a.id - b.id)[0];
}

export function indicadoresDe(f: FichaMembresia): IndicadorFicha[] {
  const { fila, cuenta } = f;
  const { uso } = fila;

  // 1 · Uso del ciclo
  let usoInd: IndicadorFicha;
  if (uso.unidad === "h") {
    const dispMin = cuenta.horas?.disponibleMin ?? 0;
    usoInd = {
      etiqueta: "Uso del ciclo",
      valor: uso.total != null ? `${formatearHoras(uso.hechas)} de ${horasTexto(uso.total)}` : horasTexto(uso.hechas),
      sub: `Disponible para pedir ${horasTexto(dispMin / 60)}`,
      progreso: uso.total ? Math.min(100, (uso.hechas / uso.total) * 100) : undefined,
    };
  } else {
    const resta = uso.total != null ? Math.max(0, uso.total - uso.hechas) : null;
    const bono = cuenta.bono > 0 ? ` · +${cuenta.bono} de bono al renovar` : "";
    usoInd = {
      etiqueta: "Uso del ciclo",
      valor: uso.total != null ? `${uso.hechas} de ${uso.total} clases` : `${uso.hechas} clases`,
      sub: (resta == null ? "Sin tope de clases" : resta === 0 ? "Agotada" : resta === 1 ? "Queda 1 clase" : `Quedan ${resta} clases`) + bono,
      progreso: uso.total ? Math.min(100, (uso.hechas / uso.total) * 100) : undefined,
    };
  }

  // 2 · Ciclo (fin real o estimado; nunca un plazo escrito fijo)
  const cicloInd: IndicadorFicha = {
    etiqueta: "Ciclo",
    valor: cuenta.fechaFin ? fechaTexto(cuenta.fechaFin) : "—",
    sub: `Desde ${fechaTexto(fila.fechaInicio)}${cuenta.fechaFin ? (cuenta.fechaFinEstimada ? " · fin estimado" : "") : " · termina con la última clase"}`,
  };

  // 3 · Saldo
  const pendiente = cuotaMasAntiguaConSaldo([...cuenta.cuotas]);
  const saldoInd: IndicadorFicha = {
    etiqueta: "Saldo",
    valor: gs(cuenta.saldo),
    sub: pendiente ? (pendiente.vencimiento ? `Vence ${fechaTexto(pendiente.vencimiento)}` : "Sin vencimiento") : "Cuotas pagadas",
    tono: cuenta.saldo > 0 ? "peligro" : undefined,
  };
  return [usoInd, cicloInd, saldoInd];
}

// ── Avisos ──────────────────────────────────────────────────────────────

export type AvisoFicha = { clave: string; titulo: string; sub: string };

const inicioDe = (r: Pick<ReservaConHistorial, "fecha" | "hora">) => new Date(`${r.fecha}T${r.hora}`);
const finDe = (r: Pick<ReservaConHistorial, "fecha" | "hora" | "duracion_min">) =>
  new Date(inicioDe(r).getTime() + r.duracion_min * 60_000);

/** Los avisos que se pueden calcular con datos existentes; sin botones (los trae cada fase). */
export function avisosDe(f: FichaMembresia, reservas: ReservaConHistorial[] | null, ahora: Date): AvisoFicha[] {
  const out: AvisoFicha[] = [];
  const { fila, cuenta } = f;

  if (fila.porVencer && fila.uso.total != null) {
    const resta = Math.max(0, fila.uso.total - fila.uso.hechas);
    out.push({ clave: "por-vencer", titulo: resta === 1 ? "Queda 1 clase" : `Quedan ${resta} clases`, sub: "Corresponde ofrecer la renovación" });
  }
  for (const r of reservas ?? []) {
    if (r.estado === "solicitada" && solicitudVigente(r.solicitada_hasta, ahora))
      out.push({
        clave: `solicitada-${r.id}`,
        titulo: "Reserva solicitada por vencer",
        sub: `${fechaTexto(r.fecha)} ${r.hora.slice(0, 5)} · vence ${r.solicitada_hasta ? new Date(r.solicitada_hasta).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz" }) : "—"}`,
      });
  }
  for (const r of reservas ?? []) {
    if ((r.estado === "confirmada" || r.estado === "reprogramada") && finDe(r) <= ahora)
      out.push({
        clave: `por-cerrar-${r.id}`,
        titulo: "Reserva por cerrar",
        sub: `${fechaTexto(r.fecha)} ${r.hora.slice(0, 5)} · ya pasó la hora: falta marcarla realizada o ausente`,
      });
  }
  if (cuenta.saldo > 0) {
    const p = cuotaMasAntiguaConSaldo([...cuenta.cuotas]);
    out.push({ clave: "saldo", titulo: `Saldo ${gs(cuenta.saldo)}`, sub: p?.vencimiento ? `Vence ${fechaTexto(p.vencimiento)}` : "Sin vencimiento" });
  }
  return out;
}

// ── Historial derivado ──────────────────────────────────────────────────

export type EventoHistorial = {
  clave: string;
  /** ISO (fecha o fecha-hora): ordena. */
  fecha: string;
  titulo: string;
  sub?: string;
  etiqueta: "Venta" | "Pago" | "Descuento" | "Licencia" | "Sustituto" | "Reserva" | "Renovación";
};

const etiquetaReserva = (estado: string) => ETIQUETA_ESTADO_RESERVA[estado as EstadoReserva] ?? estado;

function eventosDePago(p: PagoFicha): EventoHistorial[] {
  const base: EventoHistorial[] = [
    {
      clave: `pago-${p.id}`,
      fecha: p.fecha,
      titulo: `Pago ${gs(p.monto)}`,
      sub: p.medio ?? undefined,
      etiqueta: "Pago",
    },
  ];
  if (p.descuento > 0)
    base.push({
      clave: `desc-${p.id}`,
      fecha: p.fecha,
      titulo: `Descuento ${gs(p.descuento)}`,
      sub: p.descuentoMotivo ?? undefined,
      etiqueta: "Descuento",
    });
  return base;
}

/**
 * Línea de tiempo con lo que ya está registrado: la venta, los pagos, las
 * licencias y sustitutos, el historial de cada reserva y la renovación. No es
 * el registro de eventos de la membresía (nace con las fases 5–7).
 */
export function historialDe(f: FichaMembresia, reservas: ReservaConHistorial[] | null): EventoHistorial[] {
  const out: EventoHistorial[] = [
    {
      clave: "venta",
      fecha: f.fila.fechaInicio,
      titulo: f.fila.cicloNumero && f.fila.cicloNumero > 1 ? `Ciclo ${f.fila.cicloNumero}: ${f.fila.planNombre}` : `Venta: ${f.fila.planNombre}`,
      etiqueta: "Venta",
    },
  ];
  for (const p of f.pagos) out.push(...eventosDePago(p));
  for (const c of f.clases) {
    if (c.estadoSesion !== "dictada") continue;
    if (!c.presente && c.conLicencia)
      out.push({ clave: `lic-${c.sesionId}`, fecha: c.fecha, titulo: "Licencia registrada", sub: c.cursoNombre, etiqueta: "Licencia" });
    if (c.sustituto)
      out.push({
        clave: `sus-${c.sesionId}`, fecha: c.fecha, titulo: "Clase dictada por sustituto",
        sub: [c.cursoNombre, c.profesorNombre].filter(Boolean).join(" · "), etiqueta: "Sustituto",
      });
  }
  for (const r of reservas ?? [])
    for (const [i, h] of r.historial.entries())
      out.push({
        clave: `res-${r.id}-${i}`,
        fecha: h.creado_en,
        titulo: `Reserva ${fechaTexto(h.fecha_nueva)} ${h.hora_nueva.slice(0, 5)}: ${etiquetaReserva(h.estado_nuevo)}`,
        sub: [h.motivo, h.glosa, h.fuera_de_plazo ? "Fuera de plazo" : null].filter(Boolean).join(" · ") || undefined,
        etiqueta: "Reserva",
      });
  if (f.fila.siguienteId != null)
    out.push({ clave: "renovada", fecha: f.cuenta.fechaFin ?? f.fila.fechaInicio, titulo: "Renovada en un ciclo siguiente", etiqueta: "Renovación" });
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.clave < b.clave ? 1 : -1));
}

// ── Pestaña Pagos ───────────────────────────────────────────────────────

export type LineaPago = {
  clave: string;
  /** ISO; las cuotas sin fecha propia toman el inicio de la membresía. */
  fecha: string;
  titulo: string;
  sub?: string;
  monto: number;
  tono?: "exito" | "ambar" | "tenue";
  /** Solo en un cobro: lleva al recibo. */
  pagoId?: number;
};

/** «2026-10» → «oct 2026»; cualquier otro texto de período se muestra como viene. */
export function periodoTexto(periodo: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(periodo);
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : periodo;
}

/**
 * Lo que se vendió y lo que se pagó, en orden: el precio de cada cuota, su
 * descuento por adelanto, cada cobro y la fecha de compromiso si queda saldo.
 */
export function lineasDePagos(f: FichaMembresia): LineaPago[] {
  const out: LineaPago[] = [];
  const inicio = f.fila.fechaInicio;
  for (const c of f.cuenta.cuotas) {
    out.push({ clave: `cuota-${c.id}`, fecha: inicio, titulo: `Cuota ${periodoTexto(c.periodo)}`, sub: "Precio de la venta", monto: c.devengado });
    if (c.descuentoAdelanto > 0)
      out.push({ clave: `adel-${c.id}`, fecha: inicio, titulo: "Descuento por adelanto", monto: -c.descuentoAdelanto, tono: "tenue" });
    if (c.saldo > 0 && c.fechaCompromiso)
      out.push({ clave: `comp-${c.id}`, fecha: c.fechaCompromiso, titulo: "Compromiso", sub: `Saldo pendiente ${gs(c.saldo)}`, monto: c.saldo, tono: "ambar" });
  }
  for (const p of f.pagos) {
    if (p.descuento > 0)
      out.push({ clave: `desc-${p.id}`, fecha: p.fecha, titulo: "Descuento", sub: p.descuentoMotivo ?? undefined, monto: -p.descuento, tono: "tenue" });
    out.push({ clave: `pago-${p.id}`, fecha: p.fecha, titulo: "Pago", sub: p.medio ?? undefined, monto: p.monto, tono: "exito", pagoId: p.id });
  }
  const orden = (l: LineaPago) => (l.clave.startsWith("cuota") ? 0 : l.clave.startsWith("adel") ? 1 : 2);
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : orden(a) - orden(b) || a.clave.localeCompare(b.clave)));
}
