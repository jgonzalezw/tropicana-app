/**
 * La grilla de franjas de «+ Nueva reserva» (hoja de la ficha de Membresías).
 *
 * Funciones puras, sin acceso a datos: reciben lo que ya calcula el servidor
 * con la **misma lógica que valida al guardar** (`ventanasDelDia`,
 * `ocupacionDelDia`, `ocupacionDeProfesor`; las Solicitadas vencidas y las
 * clases suspendidas llegan ya liberadas) y arman qué se ve y qué se puede
 * elegir. No hay reglas de negocio nuevas acá: la regla de la duración es
 * `validarTiempoReserva` (mínimo `duracion_minima_curso_min`, pasos de
 * `tiempos_incremento_min`) y el servidor vuelve a validar al guardar.
 */

import { aHora, aMinutos } from "./horarios.ts";
import type { BloqueOcupado, ExcepcionHorario, TipoOcupacion, Ventana } from "./sala.ts";

export type EstadoFranja = "libre" | "ocupada" | "profesor" | "pasada";

/** Una franja del día: un intervalo de `incrementoMin` dentro del horario de la sala. */
export type Franja = {
  /** Minutos desde las 00:00. */
  inicio: number;
  hora: string;
  estado: EstadoFranja;
  /** Qué la ocupa (curso, reserva, bloqueo o lo que hace el profesor). */
  etiqueta: string | null;
  tipo: TipoOcupacion | null;
};

export type EntradaFranjas = {
  ventanas: Ventana[];
  ocupadosSala: BloqueOcupado[];
  ocupadosProfesor: BloqueOcupado[];
  incrementoMin: number;
  /** Las franjas que empiezan antes de este minuto ya pasaron (solo si la fecha es hoy). */
  pasadasAntesDeMin: number | null;
};

const solapa = (inicio: number, paso: number, b: BloqueOcupado) => {
  const ini = aMinutos(b.hora) ?? 0;
  return inicio < ini + b.duracionMin && inicio + paso > ini;
};

/** Las franjas del día, en orden. Solo entran las que caben enteras en una ventana. */
export function armarFranjas(e: EntradaFranjas): Franja[] {
  const paso = Math.max(1, e.incrementoMin);
  const out: Franja[] = [];
  for (const v of e.ventanas) {
    const desde = aMinutos(v.desde) ?? 0;
    const hasta = aMinutos(v.hasta) ?? 0;
    for (let m = desde; m + paso <= hasta; m += paso) {
      const pasada = e.pasadasAntesDeMin != null && m < e.pasadasAntesDeMin;
      const sala = e.ocupadosSala.find((b) => solapa(m, paso, b));
      const prof = e.ocupadosProfesor.find((b) => solapa(m, paso, b));
      let estado: EstadoFranja = "libre";
      let etiqueta: string | null = null;
      let tipo: TipoOcupacion | null = null;
      // Mismo orden que el mockup: pasada, ocupada (sala), profesor, libre.
      if (pasada) estado = "pasada";
      else if (sala) {
        estado = "ocupada";
        etiqueta = sala.etiqueta;
        tipo = sala.tipo;
      } else if (prof) {
        estado = "profesor";
        etiqueta = prof.etiqueta;
        tipo = prof.tipo;
      }
      out.push({ inicio: m, hora: aHora(m), estado, etiqueta, tipo });
    }
  }
  return out;
}

/** El mínimo que de verdad rige: nunca menos que un intervalo (`MIN = max(intervalo, mínimo)`). */
export function minimoEfectivo(incrementoMin: number, minimoMin: number): number {
  return Math.max(Math.max(1, incrementoMin), minimoMin);
}

export type Reglas = {
  incrementoMin: number;
  minimoMin: number;
  /** Lo que queda para pedir del paquete, en minutos. */
  disponibleMin: number;
};

export type Seleccion = { ini: number; fin: number } | null;

const pasoDe = (r: Reglas) => Math.max(1, r.incrementoMin);

/** ¿Todas las franjas de `[desde, hasta)` existen, seguidas, y están libres? */
export function bloqueLibre(franjas: Franja[], desde: number, hasta: number, paso: number): boolean {
  const porInicio = new Map(franjas.map((f) => [f.inicio, f]));
  for (let x = desde; x < hasta; x += paso) {
    const f = porInicio.get(x);
    if (!f || f.estado !== "libre") return false;
  }
  return hasta > desde;
}

/** ¿Entra el mínimo desde esta franja (por ocupación, cierre o saldo)? */
export function entraElMinimo(franjas: Franja[], r: Reglas, desde: number): boolean {
  const min = minimoEfectivo(r.incrementoMin, r.minimoMin);
  return min <= r.disponibleMin && bloqueLibre(franjas, desde, desde + min, pasoDe(r));
}

/** Cómo se ve y qué hace cada franja, ya resuelto (la hoja solo lo pinta). */
export type FranjaVista = Franja & {
  /** El texto del medio. */
  texto: string;
  /** El texto de la derecha. */
  derecha: string;
  /** `title` con el motivo cuando no se puede elegir. */
  titulo: string;
  habilitada: boolean;
  /** Para el color: libre · elegida · ocupada · profesor · pasada · bloqueada. */
  aspecto: "libre" | "elegida" | "ocupada" | "profesor" | "pasada" | "bloqueada";
};

export const fh = (min: number) => (Math.round(min / 6) / 10).toLocaleString("es") + " h";

const DERECHA: Record<TipoOcupacion, string> = { curso: "Curso", particular: "Reserva", alquiler: "Reserva", bloqueo: "Bloqueo" };

export function vistaFranjas(franjas: Franja[], r: Reglas, sel: Seleccion): FranjaVista[] {
  const paso = pasoDe(r);
  const min = minimoEfectivo(r.incrementoMin, r.minimoMin);
  return franjas.map((f) => {
    const m = f.inicio;
    const enRango = sel != null && m >= sel.ini && m < sel.fin;
    let v: FranjaVista = { ...f, texto: "Libre", derecha: "", titulo: "", habilitada: true, aspecto: "libre" };
    if (f.estado === "pasada") v = { ...v, texto: "Pasada", titulo: "Ya pasó", habilitada: false, aspecto: "pasada" };
    else if (f.estado === "ocupada")
      v = {
        ...v,
        texto: f.etiqueta ?? "Ocupada",
        derecha: f.tipo ? DERECHA[f.tipo] : "",
        titulo: `Ocupada: ${f.etiqueta ?? ""}`.trim(),
        habilitada: false,
        aspecto: "ocupada",
      };
    else if (f.estado === "profesor")
      v = { ...v, texto: f.etiqueta ?? "Profesor ocupado", derecha: "Profesor", titulo: "El profesor está ocupado", habilitada: false, aspecto: "profesor" };
    else if (sel == null && !entraElMinimo(franjas, r, m))
      v = {
        ...v,
        texto: `No entra el mínimo de ${fh(min)}`,
        titulo: min > r.disponibleMin ? `Te quedan ${fh(r.disponibleMin)} para pedir` : `Desde acá no hay ${fh(min)} libres seguidas`,
        habilitada: false,
        aspecto: "bloqueada",
      };
    else if (sel != null && m >= sel.fin && m + paso - sel.ini > r.disponibleMin)
      v = { ...v, texto: "Supera lo disponible para pedir", titulo: `Te quedan ${fh(r.disponibleMin)} para pedir`, habilitada: false, aspecto: "bloqueada" };

    if (enRango) v = { ...v, texto: sel!.ini === m ? "Inicio" : "Elegida", derecha: `${aHora(m)}–${aHora(m + paso)}`, habilitada: true, aspecto: "elegida", titulo: "" };
    else if (v.habilitada && sel != null && m === sel.fin) v = { ...v, texto: `+ sumar ${paso} min` };
    return v;
  });
}

/**
 * Un clic en la franja que empieza en `m`. Devuelve la selección nueva y, si el
 * clic no se puede, el aviso (la hoja lo muestra; la selección queda igual).
 *
 * - Sin selección: marca el inicio con el **mínimo** (no con un intervalo).
 * - En el inicio: deshace.
 * - Dentro del rango: lo acorta hasta ahí, nunca por debajo del mínimo.
 * - En la franja siguiente: suma un intervalo.
 * - Más lejos: extiende hasta ahí si todo el tramo está libre y entra en lo
 *   disponible; si no, empieza de nuevo ahí si desde ahí entra el mínimo.
 */
export function clicEnFranja(franjas: Franja[], r: Reglas, sel: Seleccion, m: number): { sel: Seleccion; aviso: string | null } {
  const paso = pasoDe(r);
  const min = minimoEfectivo(r.incrementoMin, r.minimoMin);
  const f = franjas.find((x) => x.inicio === m);
  if (!f) return { sel, aviso: "No disponible" };
  const vistas = vistaFranjas(franjas, r, sel);
  const v = vistas.find((x) => x.inicio === m)!;
  if (!v.habilitada && v.aspecto !== "elegida") return { sel, aviso: v.titulo || "No disponible" };

  if (sel == null) return { sel: { ini: m, fin: m + min }, aviso: null };
  if (m === sel.ini) return { sel: null, aviso: null };
  if (m >= sel.ini && m < sel.fin) {
    // Tocar el último bloque de lo elegido lo suelta; tocar uno anterior acorta.
    const fin = Math.max(sel.ini + min, m + paso);
    return { sel: fin === sel.fin ? null : { ini: sel.ini, fin }, aviso: null };
  }
  if (m === sel.fin) return { sel: { ini: sel.ini, fin: m + paso }, aviso: null };
  if (m > sel.fin && bloqueLibre(franjas, sel.fin, m + paso, paso) && m + paso - sel.ini <= r.disponibleMin)
    return { sel: { ini: sel.ini, fin: m + paso }, aviso: null };
  if (entraElMinimo(franjas, r, m)) return { sel: { ini: m, fin: m + min }, aviso: null };
  return { sel, aviso: `Desde ${aHora(m)} no hay ${fh(min)} libres seguidas` };
}

/** ¿El rango elegido se puede pedir? (Lo ven los botones; el servidor valida de nuevo.) */
export function seleccionValida(franjas: Franja[], r: Reglas, sel: Seleccion): sel is NonNullable<Seleccion> {
  if (!sel) return false;
  const duracion = sel.fin - sel.ini;
  return duracion >= minimoEfectivo(r.incrementoMin, r.minimoMin) && duracion <= r.disponibleMin && bloqueLibre(franjas, sel.ini, sel.fin, pasoDe(r));
}

// ── la fecha y las salas ─────────────────────────────────────────────────

export type MarcaDia = "" | "Cerrada" | "Reducido" | "Fuera vig.";

/** La marca del chip de un día: cerrada, horario reducido por una excepción o fuera de la vigencia. */
export function marcaDia(e: { ventanas: Ventana[]; excepcion: ExcepcionHorario | null; fueraDeVigencia: boolean }): MarcaDia {
  if (e.fueraDeVigencia) return "Fuera vig.";
  if (e.ventanas.length === 0) return "Cerrada";
  if (e.excepcion) return "Reducido";
  return "";
}

/** «2,5 h libres» o «cerrada»: lo que se muestra bajo el nombre de la sala. */
export function horasLibresTexto(franjas: Franja[], incrementoMin: number): string {
  if (franjas.length === 0) return "cerrada";
  const libres = franjas.filter((f) => f.estado === "libre").length;
  return `${fh(libres * Math.max(1, incrementoMin))} libres`;
}

/** «Abierta 14:00–22:00 · mínimo 1 h, luego de a 30 min» (con el motivo si hay excepción). */
export function lineaDeHorario(e: { ventanas: Ventana[]; excepcionMotivo: string | null; incrementoMin: number; minimoMin: number }): string {
  if (e.ventanas.length === 0) return "";
  const rangos = e.ventanas.map((v) => `${v.desde}–${v.hasta}`).join(" y ");
  const min = minimoEfectivo(e.incrementoMin, e.minimoMin);
  return `Abierta ${rangos}${e.excepcionMotivo ? ` · ${e.excepcionMotivo}` : ""} · mínimo ${fh(min)}, luego de a ${e.incrementoMin} min`;
}

// ── lo que devuelve el servidor (`consultarFranjasReserva`) ───────────────

export type SalaDelDia = { id: number; nombre: string; ventanas: Ventana[]; ocupadosSala: BloqueOcupado[] };
export type DiaSemana = { fecha: string; marca: MarcaDia; motivo: string | null };

export type DatosFranjas = {
  incrementoMin: number;
  minimoMin: number;
  /** Lo que queda para pedir, recién leído (cambia después de cada reserva). */
  disponibleMin: number;
  /** Las salas que el plan permite, cada una con su día (para «2,5 h libres»). */
  salas: SalaDelDia[];
  /** Motivo de la excepción de horario de la sala elegida ese día, si la hay. */
  excepcionMotivo: string | null;
  ocupadosProfesor: BloqueOcupado[];
  /** Los 7 días de la semana pedida, para las marcas de los chips. */
  dias: DiaSemana[];
  /** Si el día está cerrado: la próxima fecha abierta dentro de la vigencia. */
  proxima: string | null;
};
