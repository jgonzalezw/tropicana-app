/**
 * La sala: quién la ocupa, cuándo, y cuánto cuesta.
 *
 * **Dos preguntas distintas que viven juntas porque se hacen juntas.** Al
 * vender una particular o un alquiler hay que saber (a) si la sala está libre
 * en ese rango y (b) cuánto cuesta esa sala, que sale de la matriz del bloque E
 * de *Precios y paquetes*.
 *
 * **La ocupación tiene dos fuentes y una sola de ellas es una tabla.** Las
 * reservas —particulares, alquileres y bloqueos internos (D7)— son filas de
 * `reservas_sala`, y ahí la base garantiza el no-solapamiento con una
 * restricción `exclude`. Las clases de cursos regulares **no tienen fila**: se
 * calculan desde el curso (`dias_semana` + `hora` + `duracion_min`), su
 * vigencia (0033) y las sesiones suspendidas. Guardar el mismo hecho en dos
 * lugares es la confusión más cara de este proyecto; el calendario del curso ya
 * es la fuente de verdad de cuándo hay clase.
 *
 * Por eso el chequeo contra cursos regulares vive acá, en código, y el chequeo
 * entre reservas vive en la base: cada uno donde está el dato.
 */

import { diaIso } from "./inscripcion.ts";
import { aHora, aMinutos, etiquetaDuracion, seSolapan } from "./horarios.ts";
import { enVigencia, type VigenciaCurso } from "./vigencia.ts";
import type { TipoProfesor } from "./tipos.ts";

/**
 * Las cuatro categorías con las que se entra a la matriz de sala. Son los
 * valores del catálogo `categoria_comprador`, que existe desde la 0001 con
 * exactamente este propósito — no se inventa una grafía nueva para el mismo
 * concepto (glosario de `docs/REGLAS.md`).
 */
export type CategoriaSala =
  | "alumno"
  | "profesor_tropicana"
  | "profesor_externo"
  | "tercero";

export type ClaveTamano = "individual" | "pareja" | "grupo";

export type TamanoSala = {
  clave: ClaveTamano;
  etiqueta: string;
  max_personas: number;
  orden: number;
};

/**
 * Una celda de la matriz del bloque E. `precio: null` = sin tarifa cargada.
 *
 * `sala_id: null` es la tarifa **general**, la que vale para todas las salas —
 * el caso normal, porque hoy las dos salas cuestan lo mismo. Una fila con sala
 * **manda sobre la general** para esa sala (0037), y existe para no obligar a
 * cargar la matriz entera dos veces cuando dice lo mismo.
 */
export type TarifaSala = {
  sala_id: number | null;
  categoria: CategoriaSala;
  tamano: ClaveTamano;
  horas: number;
  precio: number | null;
};

export const ETIQUETA_CATEGORIA: Record<CategoriaSala, string> = {
  alumno: "Alumno",
  profesor_tropicana: "Profesor Tropicana",
  profesor_externo: "Profesor Externo",
  tercero: "Tercero",
};

/**
 * Con qué categoría entra un profesor a la matriz.
 *
 * `profesores.tipo` dice 'activo' | 'externo' (0005) y el catálogo de
 * categorías dice 'profesor_tropicana' | 'profesor_externo' (0001). Son dos
 * vocabularios preexistentes para el mismo hecho; la traducción vive en un
 * solo lugar —acá— en vez de repetirse en cada pantalla.
 */
export function categoriaSalaDeProfesor(tipo: TipoProfesor): CategoriaSala {
  return tipo === "externo" ? "profesor_externo" : "profesor_tropicana";
}

/**
 * El primer tamaño cuyo máximo alcanza a la cantidad de personas (E.3 del
 * handoff: 1 → Individual, 2 → Pareja, 5 → Grupo). Si nadie alcanza —más gente
 * que el máximo del grupo— devuelve `null`: no hay tamaño que la cubra, y eso
 * se dice, no se estira el más grande.
 */
export function tamanoPorPersonas(
  tamanos: TamanoSala[],
  personas: number
): TamanoSala | null {
  return (
    [...tamanos]
      .sort((a, b) => a.max_personas - b.max_personas)
      .find((t) => personas <= t.max_personas) ?? null
  );
}

export type CostoSala =
  | { precio: number; ruta: string }
  | { precio: null; ruta: string; motivo: string };

/**
 * El costo de sala para una combinación categoría × tamaño × horas.
 *
 * **La falta es un estado diseñado, no un cero** (N39/N34 del handoff, y la
 * regla de calidad 1). Si la matriz no tiene fila para esas horas, o la celda
 * está vacía, se devuelve `precio: null` **con el motivo escrito**: la venta se
 * puede cobrar igual, pero el paquete de sala queda sin precio y no se liquida.
 * Sustituir por 0 haría que una tarifa sin cargar parezca una sala gratis.
 *
 * `ruta` es la coordenada resuelta ("Profesor Tropicana × Pareja × 4 h") para
 * que quien vende pueda **verificar** la búsqueda en vez de confiar en ella.
 */
export function costoDeSala(
  tarifas: TarifaSala[],
  categoria: CategoriaSala,
  tamano: TamanoSala,
  horas: number,
  /** En qué sala. Si esa sala tiene tarifa propia, manda sobre la general. */
  salaId?: number | null
): CostoSala {
  const ruta = `Alquiler de sala → ${ETIQUETA_CATEGORIA[categoria]} × ${tamano.etiqueta} (hasta ${tamano.max_personas}) × ${horas} h`;

  const coincideCoordenada = (t: TarifaSala) =>
    t.categoria === categoria &&
    t.tamano === tamano.clave &&
    Number(t.horas) === Number(horas);

  // Lo específico gana a lo general: primero la tarifa propia de la sala, y si
  // no hay, la que vale para todas. El orden es la regla entera.
  const fila =
    (salaId != null
      ? tarifas.find((t) => t.sala_id === salaId && coincideCoordenada(t))
      : undefined) ?? tarifas.find((t) => t.sala_id == null && coincideCoordenada(t));

  if (!fila)
    return {
      precio: null,
      ruta,
      motivo: `Falta el paquete de ${horas} h en la tabla de alquiler de sala. Sin esa fila, la sala de esta venta no se puede valorizar.`,
    };

  if (fila.precio == null)
    return {
      precio: null,
      ruta,
      motivo: `La celda ${ETIQUETA_CATEGORIA[categoria]} × ${tamano.etiqueta} × ${horas} h está vacía en la tabla de alquiler de sala. Vacío no es cero: cargá el precio para poder liquidarla.`,
    };

  return { precio: Number(fila.precio), ruta };
}

// ── Ocupación ────────────────────────────────────────────────────────────

export type TipoOcupacion = "curso" | "particular" | "alquiler" | "bloqueo";

/** Un rango de la sala que ya está tomado, con por qué y para quién. */
export type BloqueOcupado = {
  tipo: TipoOcupacion;
  /** `HH:MM` de inicio. */
  hora: string;
  duracionMin: number;
  /** Qué es: el nombre del curso, el alumno de la particular, el motivo. */
  etiqueta: string;
  /** Para quién / de quién: el profesor, el comprador. `null` si no aplica. */
  detalle: string | null;
};

/** Lo mínimo que hay que leer de un curso para saber si ocupa la sala. */
export type CursoOcupa = VigenciaCurso & {
  id: number;
  nombre: string;
  dias_semana: number[] | null;
  hora: string | null;
  duracion_min: number | null;
  /** En qué sala se dicta (0037). `null` = sin asignar. */
  sala_id: number | null;
};

/**
 * Las clases de cursos regulares que ocupan **una sala** una fecha dada.
 *
 * Cuenta una clase cuando el curso corre ese día de la semana **y** la fecha
 * cae dentro de su vigencia. Una sesión **suspendida** no ocupa: la clase no se
 * dictó, la sala estaba libre (regla de negocio 19 — una suspensión libera la
 * sala aunque corra el ciclo del alumno).
 *
 * **Se pregunta por sala** desde que hay más de una (0037): un curso ocupa la
 * sala donde se dicta, no todas. Un curso **sin sala asignada no ocupa ninguna**
 * —bloquear la equivocada sería peor que no bloquear— y la pantalla de Cursos lo
 * muestra como lo que es: un dato que falta cargar.
 *
 * Un curso sin hora cargada tampoco genera bloque: no se sabe qué rango ocupa, y
 * no es algo que se pueda suponer.
 */
export function ocupacionDeCursos(
  cursos: CursoOcupa[],
  fechaISO: string,
  /** Claves `cursoId` de las sesiones suspendidas **de esa fecha**. */
  cursosSuspendidos: Set<number>,
  /** Qué sala se está mirando. Omitirlo cuenta todas — solo útil con una sala. */
  salaId?: number | null
): BloqueOcupado[] {
  const dia = diaIso(new Date(fechaISO + "T00:00:00"));

  return cursos
    .filter((c) => (c.dias_semana ?? []).includes(dia))
    .filter((c) => (salaId == null ? true : c.sala_id === salaId))
    .filter((c) => enVigencia(c, fechaISO))
    .filter((c) => !cursosSuspendidos.has(c.id))
    .filter((c) => aMinutos(c.hora) != null && Number(c.duracion_min) > 0)
    .map((c) => ({
      tipo: "curso" as const,
      hora: c.hora!.slice(0, 5),
      duracionMin: Number(c.duracion_min),
      etiqueta: c.nombre,
      detalle: `Clase regular · ${etiquetaDuracion(c.duracion_min)}`,
    }));
}

/**
 * Los bloques que se pisan con el rango pedido.
 *
 * Devuelve la lista, no un booleano: quien pregunta necesita **decir con qué
 * choca**. "La sala está ocupada" manda a buscar el problema a ciegas; "choca
 * con Salsa Inicial, 19:00 → 20:00" se resuelve solo.
 */
export function choquesCon(
  ocupados: BloqueOcupado[],
  hora: string,
  duracionMin: number
): BloqueOcupado[] {
  return ocupados.filter((b) => seSolapan(hora, duracionMin, b.hora, b.duracionMin));
}

// ── El horario base: cuándo la sala está abierta (C1) ────────────────────

/**
 * El lienzo del motor de disponibilidad. **Dos piezas distintas**, y no se
 * mezclan (Javier, 2026-09-12):
 *
 * - **El patrón** — la regla semanal recurrente. Una franja por fila, así un
 *   día con corte al mediodía son dos franjas y no necesita un caso especial.
 * - **Las excepciones** — por fecha. Un feriado que cierra, o un día que abre
 *   distinto. Un feriado **no** es un bloqueo cargado a mano: es una excepción
 *   del horario, y por eso vive acá y no en `reservas_sala`.
 *
 * **Vacío significa cerrado, no abierto.** Un día sin franjas está cerrado, y
 * una sala sin horario cargado no se puede reservar. El default contrario
 * —"si no se cargó, está abierto"— produce justo el problema que esto viene a
 * evitar: la sala vendible a cualquier hora porque nadie la configuró.
 */

export type FranjaPatron = { dia_semana: number; desde: string; hasta: string };

/**
 * Una excepción cubre un **rango de fechas** (0037): "vacaciones del 24/12 al
 * 5/1" es un hecho, no trece. Un día suelto es un rango de un día
 * (`fecha === hasta_fecha`), así que no hay dos formas de expresar lo mismo.
 */
export type ExcepcionHorario = {
  fecha: string;
  hasta_fecha: string;
  cerrado: boolean;
  desde: string | null;
  hasta: string | null;
  motivo: string | null;
  glosa: string | null;
};

export type Ventana = { desde: string; hasta: string };

const DIAS_PLURAL: Record<number, string> = {
  1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves",
  5: "viernes", 6: "sábados", 7: "domingos",
};

/** `HH:MM` limpio, para comparar y para mostrar. */
const hhmm = (t: string) => t.slice(0, 5);

/**
 * Las ventanas en que la sala abre esa fecha, y de dónde salen.
 *
 * Una excepción **reemplaza** al patrón ese día: si el 25/12 está marcado como
 * feriado, no importa que el patrón diga que los jueves abre.
 */
export function ventanasDelDia(
  patron: FranjaPatron[],
  excepciones: ExcepcionHorario[],
  fechaISO: string
): { ventanas: Ventana[]; excepcion: ExcepcionHorario | null } {
  const f = fechaISO.slice(0, 10);
  // La fecha cae dentro del rango, con los dos extremos incluidos. La base
  // garantiza que dos excepciones de la misma sala no se pisen, así que como
  // mucho hay una que la cubra.
  const exc =
    excepciones.find(
      (e) => e.fecha.slice(0, 10) <= f && f <= e.hasta_fecha.slice(0, 10)
    ) ?? null;

  if (exc) {
    if (exc.cerrado) return { ventanas: [], excepcion: exc };
    return {
      ventanas: [{ desde: hhmm(exc.desde!), hasta: hhmm(exc.hasta!) }],
      excepcion: exc,
    };
  }

  const dia = diaIso(new Date(f + "T00:00:00"));
  const ventanas = patron
    .filter((p) => p.dia_semana === dia)
    .map((p) => ({ desde: hhmm(p.desde), hasta: hhmm(p.hasta) }))
    .sort((a, b) => (aMinutos(a.desde) ?? 0) - (aMinutos(b.desde) ?? 0));

  return { ventanas, excepcion: null };
}

export type ResultadoHorario = { ok: true } | { ok: false; motivo: string };

/**
 * ¿Entra este rango dentro del horario de la sala?
 *
 * Tiene que caber **entero dentro de una sola ventana**: una reserva que
 * empieza antes del corte del mediodía y termina después no es válida, porque
 * en el medio la sala está cerrada.
 *
 * Cuando no entra **dice por qué y dónde se arregla**. Un "no se puede" a secas
 * manda a buscar el problema donde no está (regla de calidad 1 y 5).
 */
export function dentroDelHorario(
  patron: FranjaPatron[],
  excepciones: ExcepcionHorario[],
  fechaISO: string,
  hora: string,
  duracionMin: number,
  /** Cómo se lee el motivo de la excepción, del catálogo. */
  etiquetaMotivo?: (valor: string) => string
): ResultadoHorario {
  const ini = aMinutos(hora);
  if (ini == null || !(duracionMin > 0))
    return { ok: false, motivo: "La hora o la duración de la reserva no son válidas." };
  const fin = ini + duracionMin;

  // Sin horario cargado la sala no se reserva, y se dice dónde cargarlo: si
  // callara, "todavía no lo configuré" y "algo se rompió" se verían igual.
  if (patron.length === 0 && excepciones.length === 0)
    return {
      ok: false,
      motivo:
        "Todavía no está cargado el horario de la sala, así que no se puede reservar nada. " +
        "Se carga en Administración → Sala y horarios.",
    };

  const { ventanas, excepcion } = ventanasDelDia(patron, excepciones, fechaISO);

  if (excepcion && excepcion.cerrado) {
    const etiqueta = excepcion.motivo
      ? etiquetaMotivo?.(excepcion.motivo) ?? excepcion.motivo
      : null;
    const detalle = [etiqueta, excepcion.glosa].filter(Boolean).join(" · ");
    return {
      ok: false,
      motivo: `El ${fechaISO.slice(0, 10)} la sala no abre${detalle ? ` (${detalle})` : ""}.`,
    };
  }

  if (ventanas.length === 0) {
    const dia = diaIso(new Date(fechaISO.slice(0, 10) + "T00:00:00"));
    return { ok: false, motivo: `La sala no abre los ${DIAS_PLURAL[dia]}.` };
  }

  const entra = ventanas.some((v) => {
    const vi = aMinutos(v.desde);
    const vf = aMinutos(v.hasta);
    return vi != null && vf != null && ini >= vi && fin <= vf;
  });
  if (entra) return { ok: true };

  const abre = ventanas.map((v) => `${v.desde}–${v.hasta}`).join(" y ");
  const pedido = `${aHora(ini)}–${aHora(fin)}`;
  return {
    ok: false,
    motivo:
      ventanas.length > 1
        ? `La sala abre ${abre} y la reserva pedida (${pedido}) no entra en ninguna de las dos franjas.`
        : `La sala abre ${abre} y la reserva pedida (${pedido}) queda fuera.`,
  };
}

/** "08:00–12:00 y 15:00–22:00", o "cerrado" — para mostrar un día de un vistazo. */
export function describirVentanas(ventanas: Ventana[]): string {
  if (ventanas.length === 0) return "cerrado";
  return ventanas.map((v) => `${v.desde}–${v.hasta}`).join(" y ");
}

/**
 * ¿Una excepción de este conjunto toca esta franja, y cómo? (H4, C3).
 *
 * Dos formas de afectar: un **cierre** (la excepción no abre ese día, la
 * franja entera queda afuera) o un **horario reducido** (la excepción abre,
 * pero con menos horas que las que la franja necesita — un feriado de medio
 * día que deja una reserva de la tarde fuera de la ventana nueva).
 *
 * Si ninguna excepción del conjunto cubre esa fecha, no hay impacto: esto
 * responde "¿te toca ESTA excepción?", no "¿la sala está abierta hoy?" (para
 * eso está `dentroDelHorario`, que además mira el patrón semanal).
 */
export function impactoDeExcepcion(
  fecha: string,
  hora: string,
  duracionMin: number,
  excepciones: ExcepcionHorario[]
): { afectada: boolean; motivo: "cierre" | "horario_reducido" | null } {
  const { ventanas, excepcion } = ventanasDelDia([], excepciones, fecha);
  if (!excepcion) return { afectada: false, motivo: null };
  if (excepcion.cerrado) return { afectada: true, motivo: "cierre" };

  const ini = aMinutos(hora);
  if (ini == null || !(duracionMin > 0)) return { afectada: true, motivo: "horario_reducido" };
  const fin = ini + duracionMin;
  const cabe = ventanas.some((v) => {
    const vi = aMinutos(v.desde);
    const vf = aMinutos(v.hasta);
    return vi != null && vf != null && ini >= vi && fin <= vf;
  });
  return cabe ? { afectada: false, motivo: null } : { afectada: true, motivo: "horario_reducido" };
}

/** Lo mínimo de una fila de `reservas_sala` para saber que ocupa la sala (C2). */
export type ReservaSalaOcupa = {
  id: number;
  tipo: TipoOcupacion;
  hora: string;
  duracion_min: number;
  motivo: string | null;
  glosa: string | null;
  /** Solo para `tipo: 'particular'` (H2, 26/09): el ticket de color ya dice
   *  que es una clase particular, así que acá no se repite — se muestra a
   *  quién y con quién. */
  alumnoNombre?: string | null;
  profesorNombre?: string | null;
  estilo?: string | null;
};

/**
 * Las reservas reales (particular/alquiler/bloqueo) de `reservas_sala` como
 * bloques ocupados, con el mismo tipo `BloqueOcupado` que ya usan los cursos.
 *
 * `tipo: 'alquiler'` todavía no tiene comprador que leer (H7). `particular`
 * sí, desde H2: el JOIN que arma cada fila (nombre del alumno, del profesor,
 * el estilo) lo hace quien llama, acá solo se ordena en `etiqueta`/`detalle`.
 */
export function ocupacionDeReservas(
  reservas: ReservaSalaOcupa[],
  /** Cómo se lee el motivo del catálogo `motivo_bloqueo_sala`. */
  etiquetaMotivo?: (valor: string) => string
): BloqueOcupado[] {
  return reservas.map((r) => ({
    tipo: r.tipo,
    hora: r.hora.slice(0, 5),
    duracionMin: r.duracion_min,
    etiqueta:
      r.tipo === "bloqueo"
        ? etiquetaMotivo?.(r.motivo ?? "") ?? r.motivo ?? "Bloqueo"
        : r.tipo === "particular"
          ? r.alumnoNombre || "Clase particular"
          : "Alquiler de sala",
    detalle:
      r.tipo === "particular" ? [r.profesorNombre, r.estilo].filter(Boolean).join(" · ") || null : r.glosa,
  }));
}

/**
 * Todo lo que ocupa una sala una fecha dada: cursos regulares + reservas
 * reales, en una sola lista ordenada por hora. Es la lista textual que pide
 * Javier para C2 — no reemplaza `ocupacionDeCursos`, la combina con
 * `ocupacionDeReservas`.
 */
export function ocupacionDelDia(
  cursos: CursoOcupa[],
  reservas: ReservaSalaOcupa[],
  fechaISO: string,
  cursosSuspendidos: Set<number>,
  salaId: number,
  etiquetaMotivo?: (valor: string) => string
): BloqueOcupado[] {
  const deCursos = ocupacionDeCursos(cursos, fechaISO, cursosSuspendidos, salaId);
  const deReservas = ocupacionDeReservas(reservas, etiquetaMotivo);
  return [...deCursos, ...deReservas].sort(
    (a, b) => (aMinutos(a.hora) ?? 0) - (aMinutos(b.hora) ?? 0)
  );
}

export type Tramo = { desde: string; hasta: string };

/**
 * Los huecos libres dentro de las ventanas de apertura, descontando lo
 * ocupado. Un bloque que empieza antes de la ventana o termina después se
 * recorta a la ventana — lo que importa acá es qué queda libre para reservar,
 * no el bloque completo.
 */
export function tramosLibres(ventanas: Ventana[], ocupados: BloqueOcupado[]): Tramo[] {
  const libres: Tramo[] = [];
  for (const v of ventanas) {
    const finVentana = aMinutos(v.hasta) ?? 0;
    let cursor = aMinutos(v.desde) ?? 0;
    const dentro = ocupados
      .map((o) => {
        const ini = aMinutos(o.hora) ?? 0;
        return { ini, fin: ini + o.duracionMin };
      })
      .filter((o) => o.ini < finVentana && o.fin > cursor)
      .sort((a, b) => a.ini - b.ini);
    for (const o of dentro) {
      if (o.ini > cursor) libres.push({ desde: aHora(cursor), hasta: aHora(Math.min(o.ini, finVentana)) });
      cursor = Math.max(cursor, o.fin);
    }
    if (cursor < finVentana) libres.push({ desde: aHora(cursor), hasta: aHora(finVentana) });
  }
  return libres;
}

/** "09:00–11:00 y 12:30–20:00", o "sin huecos libres" — el resto del día de un vistazo. */
export function describirTramos(tramos: Tramo[]): string {
  if (!tramos.length) return "sin huecos libres";
  return tramos.map((t) => `${t.desde}–${t.hasta}`).join(" y ");
}

/** "Salsa Inicial (19:00 → 20:00)" — para nombrar el choque en un mensaje. */
export function describirBloque(b: BloqueOcupado): string {
  const ini = aMinutos(b.hora) ?? 0;
  const fin = ini + b.duracionMin;
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `${b.etiqueta} (${hhmm(ini)} → ${hhmm(fin)})`;
}

// ── Impacto de un cierre de sala sobre clases regulares (C5, alcance acotado) ─

/**
 * Lo mínimo de una membresía para saber si cubre un curso una fecha: cuándo
 * empezó y cuándo termina (`null` = sigue corriendo).
 */
export type MembresiaCobertura = {
  alumno_id: number;
  curso_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
};

export type ClaseAfectada = {
  cursoId: number;
  cursoNombre: string;
  fecha: string;
  alumnosActivos: number;
  motivoImpacto: "cierre" | "horario_reducido";
};

/**
 * Qué clases regulares con **membresía activa** caen dentro de las excepciones
 * que se están por guardar, fecha por fecha — cierre completo **u horario
 * reducido** que deja la clase afuera de la ventana nueva (H4, decisión de
 * Javier 2026-09-26: entra el mismo alcance para los dos casos).
 *
 * **Alcance acotado a propósito** (Javier, 2026-09-16): se pregunta contra
 * membresías activas que de verdad toman esa clase, no contra el calendario
 * crudo del curso — una clase sin nadie inscripto vigente no genera nada que
 * confirmar (regla de negocio 18, aplicada acá al calendario de sala en vez de
 * a la asistencia).
 *
 * Una clase **ya suspendida** esa fecha no se repite: ya no ocupa, y ya se le
 * avisó a quien corresponda la primera vez.
 */
export function clasesAfectadasPorExcepciones(
  cursos: CursoOcupa[],
  membresias: MembresiaCobertura[],
  excepciones: ExcepcionHorario[],
  fechaDesde: string,
  fechaHasta: string,
  /** Claves `"cursoId|fecha"` de sesiones ya suspendidas. */
  yaSuspendidas: Set<string>
): ClaseAfectada[] {
  const afectadas: ClaseAfectada[] = [];
  const porCurso = new Map<number, MembresiaCobertura[]>();
  for (const m of membresias) {
    const l = porCurso.get(m.curso_id) ?? [];
    l.push(m);
    porCurso.set(m.curso_id, l);
  }

  for (const d = parseISO(fechaDesde); fmtISO(d) <= fechaHasta; d.setDate(d.getDate() + 1)) {
    const fecha = fmtISO(d);
    const dia = diaIso(d);
    for (const c of cursos) {
      if (!(c.dias_semana ?? []).includes(dia)) continue;
      if (!enVigencia(c, fecha)) continue;
      if (yaSuspendidas.has(`${c.id}|${fecha}`)) continue;
      if (aMinutos(c.hora) == null || !(Number(c.duracion_min) > 0)) continue;

      const impacto = impactoDeExcepcion(fecha, c.hora!, Number(c.duracion_min), excepciones);
      if (!impacto.afectada) continue;

      const cubren = (porCurso.get(c.id) ?? []).filter(
        (m) => m.fecha_inicio <= fecha && (m.fecha_fin == null || m.fecha_fin >= fecha)
      );
      if (!cubren.length) continue;

      afectadas.push({
        cursoId: c.id,
        cursoNombre: c.nombre,
        fecha,
        alumnosActivos: new Set(cubren.map((m) => m.alumno_id)).size,
        motivoImpacto: impacto.motivo!,
      });
    }
  }
  return afectadas;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
