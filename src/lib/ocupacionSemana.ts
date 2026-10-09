/**
 * Ocupación de una semana para la hoja de franjas, armada en el navegador.
 *
 * El servidor entrega dos cosas: los datos fijos de la membresía (`BaseFranjas`:
 * horarios, cursos, reglas, saldo) una sola vez por apertura, y las reservas y
 * clases suspendidas de un rango de fechas (`SemanaFranjas`). De ahí, esta pieza
 * pura arma el contexto de cualquier día (`contextoDelDia`) y las franjas
 * (`armarDatosFranjas`) sin volver al servidor. Es la misma ocupación que usa
 * `validarFranja` al guardar (`bloquesDelContexto`): la hoja solo muestra lo que
 * el servidor va a validar, y el servidor valida de nuevo al guardar.
 */

import {
  ocupacionDelDia,
  ventanasDelDia,
  type BloqueOcupado,
  type CursoOcupa,
  type ExcepcionHorario,
  type FranjaPatron,
  type ReservaSalaOcupa,
} from "./sala.ts";
import { ocupaAhora, ocupacionDeProfesor } from "./reservas.ts";
import { sumarDiasISO } from "./calendarioCiclo.ts";
import { marcaDia, type DatosFranjas, type DiaSemana, type SalaDelDia } from "./franjasReserva.ts";

export type ReservaConEstado = ReservaSalaOcupa & { estado: string; solicitada_hasta: string | null };

export type ContextoValidacion = {
  /** `null` cuando la sala es externa — no se valida su horario ni choque. */
  salaId: number | null;
  incrementoMin: number;
  minimoMin: number;
  patronSala: FranjaPatron[];
  excepcionesSala: ExcepcionHorario[];
  cursosSala: CursoOcupa[];
  reservasSala: ReservaConEstado[];
  suspendidasSala: Set<number>;
  cursosProfesor: CursoOcupa[];
  reservasProfesor: ReservaConEstado[];
  suspendidasProfesor: Set<number>;
};

/** Filtra las reservas ya traídas (sin los estados que liberan) a las que de
 *  verdad ocupan AHORA — descarta una Solicitada vencida (regla de negocio 4:
 *  se calcula al leer, no se guarda paso a paso). */
function ocupandoAhora<T extends { tipo: ReservaSalaOcupa["tipo"]; estado: string; solicitada_hasta: string | null }>(
  reservas: T[],
  ahora: Date
): T[] {
  // El tipo real de cada fila: un bloqueo ocupa con estado `reservada`, que
  // para una particular no ocupa. Con el tipo fijo el bloqueo se descartaba y
  // el choque lo frenaba recién la base (23P01), con un mensaje genérico.
  return reservas.filter((r) => ocupaAhora({ tipo: r.tipo, estado: r.estado, solicitadaHasta: r.solicitada_hasta }, ahora));
}

/**
 * Lo que ocupa la sala y el profesor esa fecha, con lo que ocupa AHORA (una
 * Solicitada vencida y una clase suspendida no ocupan). Lo usan `validarFranja`
 * (al guardar) y la grilla de franjas de la hoja «Nueva reserva»: la misma
 * ocupación en los dos, sin reglas aparte.
 */
export function bloquesDelContexto(
  ctx: ContextoValidacion,
  fecha: string,
  ahora: Date,
  esExterna = false,
  /** Cómo se lee el motivo de un bloqueo (catálogo `motivo_bloqueo_sala`). */
  etiquetaMotivo?: (valor: string) => string
): { ocupadosSala: BloqueOcupado[]; ocupadosProfesor: BloqueOcupado[] } {
  const ocupadosSala =
    esExterna || ctx.salaId == null
      ? []
      : ocupacionDelDia(ctx.cursosSala, ocupandoAhora(ctx.reservasSala, ahora), fecha, ctx.suspendidasSala, ctx.salaId, etiquetaMotivo);
  const ocupadosProfesor = ocupacionDeProfesor(ctx.cursosProfesor, fecha, ctx.suspendidasProfesor, ocupandoAhora(ctx.reservasProfesor, ahora), etiquetaMotivo);
  return { ocupadosSala, ocupadosProfesor };
}

// ── Lo que viaja del servidor al navegador ─────────────────────────────────

export type SalaBase = {
  id: number;
  nombre: string;
  patron: FranjaPatron[];
  excepciones: ExcepcionHorario[];
  /** Los cursos activos que se dictan en esta sala. */
  cursos: CursoOcupa[];
};

/** Los datos que no cambian mientras la hoja está abierta. */
export type BaseFranjas = {
  incrementoMin: number;
  minimoMin: number;
  /** Lo que queda para pedir al abrir la hoja. */
  disponibleMin: number;
  fechaInicio: string;
  fechaFin: string;
  profesorId: number | null;
  /** Primer nombre del profesor, para «Natalia da …». */
  profesorNombre: string | null;
  /** Solo las salas que el plan permite. */
  salas: SalaBase[];
  cursosProfesor: CursoOcupa[];
  /** valor → etiqueta de `motivo_bloqueo_sala`. */
  etiquetasBloqueo: Record<string, string>;
  /** valor → etiqueta de `motivo_excepcion_horario`. */
  etiquetasExcepcion: Record<string, string>;
};

export type ReservaDeSemana = ReservaConEstado & { sala_id: number | null; profesor_id: number | null; fecha: string };

/** Las reservas que no liberan y las clases suspendidas de un rango de fechas. */
export type SemanaFranjas = {
  desde: string;
  hasta: string;
  reservas: ReservaDeSemana[];
  suspendidas: { curso_id: number; fecha: string }[];
};

// ── Armado ─────────────────────────────────────────────────────────────────

/**
 * El `ContextoValidacion` de un día, filtrando lo ya cargado. `conProfesor`
 * incluye la agenda del profesor (solo la sala elegida la necesita);
 * `excluirReservaId` saca esa reserva de la sala y del profesor (reprogramar:
 * no puede chocar consigo misma).
 */
export function contextoDelDia(
  base: BaseFranjas,
  semana: SemanaFranjas,
  salaId: number | null,
  fecha: string,
  opciones: { conProfesor?: boolean; excluirReservaId?: number } = {}
): ContextoValidacion {
  const { conProfesor = false, excluirReservaId } = opciones;
  const sala = salaId == null ? null : (base.salas.find((s) => s.id === salaId) ?? null);
  const delDia = semana.reservas.filter((r) => r.fecha === fecha && r.id !== excluirReservaId);
  const suspendidasDelDia = (cursos: CursoOcupa[]) => {
    const ids = new Set(cursos.map((c) => c.id));
    return new Set(semana.suspendidas.filter((s) => s.fecha === fecha && ids.has(s.curso_id)).map((s) => s.curso_id));
  };
  const cursosProfesor = conProfesor ? base.cursosProfesor : [];
  return {
    salaId: sala ? sala.id : null,
    incrementoMin: base.incrementoMin,
    minimoMin: base.minimoMin,
    patronSala: sala?.patron ?? [],
    excepcionesSala: sala?.excepciones ?? [],
    cursosSala: sala?.cursos ?? [],
    reservasSala: sala ? delDia.filter((r) => r.sala_id === sala.id) : [],
    suspendidasSala: sala ? suspendidasDelDia(sala.cursos) : new Set<number>(),
    cursosProfesor,
    reservasProfesor: conProfesor && base.profesorId != null ? delDia.filter((r) => r.profesor_id === base.profesorId) : [],
    suspendidasProfesor: suspendidasDelDia(cursosProfesor),
  };
}

/** Rango que cubre la semana de 7 días y también la fecha pedida. */
export function rangoDeSemana(semanaDesde: string, fecha: string): { desde: string; hasta: string } {
  const fin = sumarDiasISO(semanaDesde, 6);
  return { desde: fecha < semanaDesde ? fecha : semanaDesde, hasta: fecha > fin ? fecha : fin };
}

/**
 * Lo mismo que antes devolvía el servidor por cada día: las salas con su día,
 * la agenda del profesor, las marcas de los 7 días y la próxima fecha abierta.
 */
export function armarDatosFranjas(
  base: BaseFranjas,
  semana: SemanaFranjas,
  e: { salaId: number; fecha: string; semanaDesde: string; ahora: Date; excluirReservaId?: number }
): DatosFranjas {
  const etiquetaMotivo = (v: string) => base.etiquetasBloqueo[v] ?? v;
  const motivoDe = (x: { motivo: string | null; glosa: string | null } | null) =>
    x ? [x.motivo ? (base.etiquetasExcepcion[x.motivo] ?? x.motivo) : null, x.glosa].filter(Boolean).join(" · ") || null : null;

  // La sala elegida lleva también al profesor; las demás, solo su propia ocupación.
  const salas: SalaDelDia[] = base.salas.map((s) => {
    const ctx = contextoDelDia(base, semana, s.id, e.fecha, { excluirReservaId: e.excluirReservaId });
    return {
      id: s.id,
      nombre: s.nombre,
      ventanas: ventanasDelDia(s.patron, s.excepciones, e.fecha).ventanas,
      ocupadosSala: bloquesDelContexto(ctx, e.fecha, e.ahora, false, etiquetaMotivo).ocupadosSala,
    };
  });
  const elegida = base.salas.find((s) => s.id === e.salaId);
  if (!elegida) throw new Error("Esa sala no está entre las que permite el plan.");
  const ctxElegida = contextoDelDia(base, semana, elegida.id, e.fecha, { conProfesor: true, excluirReservaId: e.excluirReservaId });
  const delDia = ventanasDelDia(elegida.patron, elegida.excepciones, e.fecha);

  let ocupadosProfesor = bloquesDelContexto(ctxElegida, e.fecha, e.ahora, false, etiquetaMotivo).ocupadosProfesor;
  if (ocupadosProfesor.length && base.profesorId != null) {
    const nombre = base.profesorNombre || "El profesor";
    ocupadosProfesor = ocupadosProfesor.map((b) => ({ ...b, etiqueta: `${nombre} da ${b.tipo === "curso" ? b.etiqueta : b.etiqueta.toLowerCase()}` }));
  }

  const dias: DiaSemana[] = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDiasISO(e.semanaDesde, i);
    const d = ventanasDelDia(elegida.patron, elegida.excepciones, fecha);
    return {
      fecha,
      marca: marcaDia({ ventanas: d.ventanas, excepcion: d.excepcion, fueraDeVigencia: fecha < base.fechaInicio || fecha > base.fechaFin }),
      motivo: motivoDe(d.excepcion),
    };
  });

  let proxima: string | null = null;
  if (delDia.ventanas.length === 0) {
    for (let f = sumarDiasISO(e.fecha, 1), n = 0; f <= base.fechaFin && n < 400; f = sumarDiasISO(f, 1), n++) {
      if (ventanasDelDia(elegida.patron, elegida.excepciones, f).ventanas.length > 0) {
        proxima = f;
        break;
      }
    }
  }

  return {
    incrementoMin: base.incrementoMin,
    minimoMin: base.minimoMin,
    disponibleMin: base.disponibleMin,
    salas,
    excepcionMotivo: motivoDe(delDia.excepcion),
    ocupadosProfesor,
    dias,
    proxima,
  };
}
