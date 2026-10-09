/**
 * La lista única de membresías (I-012, fase 0): qué es cada una, en qué punto
 * está y cómo se filtra. Pieza **pura** (sin base): la lectura vive en
 * `membresiasLectura.ts`, y la pantalla de la fase 1b solo dibuja lo que esto
 * devuelve.
 *
 * Definiciones (las del mockup de Design, 2026-10-08; la tabla `membresias`
 * no tiene `tipo` ni estado «renovada», así que se deducen):
 * - **Tipo**: alquiler = tiene `categoria_aplicada`; prueba = `es_prueba`
 *   (su plan es un regular, regla 11: `planes.tipo_servicio` no la distingue);
 *   particular = sin curso; el resto, regular.
 * - **Renovada**: otra membresía la encadena (`membresia_anterior_id`) o existe
 *   una posterior del mismo titular y mismo plan. Una **extensión** (H6) suma
 *   horas a la misma membresía: nunca es una renovación. Una conversión de
 *   prueba tampoco.
 * - **Histórica**: ya no está activa (`completada` o `baja`). Agotarse no es
 *   cerrarse (glosario): el uso se lee del consumo real, no del estado.
 * - **Por vencer**: regular activa, no renovada, de un ciclo de más de una
 *   clase (una preventa o clase suelta no se renueva) y con una o ninguna por dar.
 * - **Con deuda**: saldo de sus cuotas > 0.
 * - **Solicitudes**: alguna reserva Solicitada todavía vigente.
 */

import { coincideBusqueda } from "./contactos.ts";
import { textoMenor, type ContactoResumen } from "./contactoVenta.ts";
import { compararPorApellido } from "./texto.ts";
import { solicitudVigente } from "./reservas.ts";
import type { Contacto } from "./tipos.ts";

export type TipoMembresia = "regular" | "prueba" | "particular" | "alquiler";

export const TIPOS_MEMBRESIA: readonly TipoMembresia[] = ["regular", "prueba", "particular", "alquiler"];

/** Qué muestra la lista por defecto es `activas`; `todas` no filtra por estado. */
export type FiltroEstadoMembresia = "activas" | "por_vencer" | "con_deuda" | "solicitudes" | "historicas" | "todas";

export type FiltroMembresias = {
  tipo?: TipoMembresia | "todas";
  estado?: FiltroEstadoMembresia;
  q?: string;
};

/** Lo mínimo de una membresía para saber de qué tipo es. */
export type EntradaTipo = {
  esPrueba: boolean;
  cursoId: number | null;
  categoriaAplicada: string | null;
};

export function tipoDeMembresia(m: EntradaTipo): TipoMembresia {
  if (m.categoriaAplicada != null) return "alquiler";
  if (m.esPrueba) return "prueba";
  if (m.cursoId == null) return "particular";
  return "regular";
}

// ── Renovación ──────────────────────────────────────────────────────────

export type EntradaCiclo = EntradaTipo & {
  id: number;
  alumnoId: number | null;
  /** Titular cuando no es alumno (alquiler a una institución). */
  contactoId: number | null;
  planId: number | null;
  anteriorId: number | null;
  fechaInicio: string;
};

const mismoTitular = (a: EntradaCiclo, b: EntradaCiclo) =>
  a.alumnoId != null ? a.alumnoId === b.alumnoId : a.contactoId != null && a.contactoId === b.contactoId && b.alumnoId == null;

/**
 * El id de la membresía que renueva a `m`, o `null`. Primero el encadenado
 * explícito; si no, la posterior más cercana del mismo titular y plan. Una
 * prueba no se renueva: su sucesora es una conversión.
 */
export function siguienteCiclo(m: EntradaCiclo, todas: EntradaCiclo[]): number | null {
  const encadenada = todas.find((t) => t.anteriorId === m.id && t.id !== m.id);
  if (encadenada) return encadenada.id;
  if (m.esPrueba || m.planId == null) return null;
  const posteriores = todas
    .filter(
      (t) =>
        t.id !== m.id &&
        !t.esPrueba &&
        t.planId === m.planId &&
        mismoTitular(m, t) &&
        t.fechaInicio > m.fechaInicio
    )
    .sort((a, b) => (a.fechaInicio === b.fechaInicio ? a.id - b.id : a.fechaInicio < b.fechaInicio ? -1 : 1));
  return posteriores[0]?.id ?? null;
}

// ── Uso del ciclo ───────────────────────────────────────────────────────

export type EntradaUso = {
  tipo: TipoMembresia;
  /** Regular/prueba: el avance de Asistencia (`avanceAlCorte`, `leerAvancesAlCorte`). */
  avance: { hechas: number; total: number | null } | null;
  /** Particular/alquiler: minutos del saldo de horas (`saldoMembresia`). */
  horas: { contratadasMin: number; consumidasMin: number } | null;
};

export type UsoDelCiclo = { hechas: number; total: number | null; unidad: "clases" | "h" };

/**
 * Cuánto lleva consumido el ciclo. En clases, el avance que ya calcula
 * Asistencia (en un plan de N cuentan las dictadas, falta incluida; en un
 * paquete, las presentes): acá no se vuelve a calcular. En horas, lo reservado
 * y lo dado.
 */
export function usoDelCiclo(e: EntradaUso): UsoDelCiclo {
  if (e.tipo === "particular" || e.tipo === "alquiler") {
    const h = e.horas;
    return { hechas: h ? h.consumidasMin / 60 : 0, total: h ? h.contratadasMin / 60 : null, unidad: "h" };
  }
  return { hechas: e.avance?.hechas ?? 0, total: e.avance?.total ?? null, unidad: "clases" };
}

// ── Banderas y chip ─────────────────────────────────────────────────────

export type EntradaBanderas = {
  tipo: TipoMembresia;
  estado: string;
  uso: UsoDelCiclo;
  renovada: boolean;
  /** Σ del saldo de sus cuotas. */
  saldo: number;
  reservas: { estado: string; solicitadaHasta: string | null }[];
};

export type Banderas = {
  historica: boolean;
  porVencer: boolean;
  conDeuda: boolean;
  solicitudes: boolean;
};

export function banderas(e: EntradaBanderas, ahora: Date): Banderas {
  const activa = e.estado === "activa";
  const porDar = e.uso.total != null ? e.uso.total - e.uso.hechas : null;
  return {
    historica: !activa,
    porVencer: e.tipo === "regular" && activa && !e.renovada && e.uso.total != null && e.uso.total > 1 && porDar != null && porDar <= 1,
    conDeuda: e.saldo > 0,
    solicitudes: e.reservas.some((r) => r.estado === "solicitada" && solicitudVigente(r.solicitadaHasta, ahora)),
  };
}

export type ClaveChip = "baja" | "renovada" | "solicitud" | "deuda" | "por_vencer" | "completada" | "activa";

/** El estado que se muestra en la fila: la primera que aplica, en este orden. */
export function chipEstado(e: { estado: string; renovada: boolean } & Banderas): { clave: ClaveChip; texto: string } {
  if (e.estado === "baja") return { clave: "baja", texto: "De baja" };
  if (e.renovada) return { clave: "renovada", texto: "Renovada" };
  if (e.solicitudes) return { clave: "solicitud", texto: "Solicitud pendiente" };
  if (e.conDeuda) return { clave: "deuda", texto: "Con deuda" };
  if (e.porVencer) return { clave: "por_vencer", texto: "Por vencer" };
  if (e.estado === "completada") return { clave: "completada", texto: "Completada" };
  return { clave: "activa", texto: "Activa" };
}

/**
 * ¿Este acceso puede ver una membresía de este tipo? Con alcance propio, un
 * profesor ve solo sus particulares. Pura: la regla vive acá y se prueba
 * sin base de datos.
 */
export function membresiaVisible(
  a: { tipos: ReadonlySet<TipoMembresia>; profesorIdPropio: number | null; cursosPropios?: ReadonlySet<number> | null },
  m: { tipo: TipoMembresia; profesorId: number | null; cursoIds?: readonly number[] }
): boolean {
  if (!a.tipos.has(m.tipo)) return false;
  if (m.tipo === "particular" && a.profesorIdPropio != null && m.profesorId !== a.profesorIdPropio) return false;
  // Con contactos en alcance propio, una regular o prueba solo si alguno de sus cursos es del profesor
  // (la misma regla con la que la base le muestra el nombre del titular).
  if ((m.tipo === "regular" || m.tipo === "prueba") && a.cursosPropios && !(m.cursoIds ?? []).some((c) => a.cursosPropios!.has(c))) return false;
  return true;
}

// ── La fila y el filtro ─────────────────────────────────────────────────

export type FilaMembresia = Banderas & {
  id: number;
  tipo: TipoMembresia;
  estado: string;
  chip: { clave: ClaveChip; texto: string };
  /** Alumno, o titular del alquiler (una persona o una organización). */
  titular: Pick<Contacto, "tipo" | "nombre" | "apellido" | "razon_social" | "whatsapp">;
  titularNombre: string;
  alumnoId: number | null;
  contactoId: number | null;
  /** El titular es un alumno menor de edad (se muestra y se busca por su tutor). */
  esMenor: boolean;
  /** Su tutor (`contacto_relaciones` tipo `tutor_de`), tal como lo muestran Alumnos e Inscripción. */
  tutor: ContactoResumen["tutor"];
  planId: number | null;
  planNombre: string;
  /** Estilo del plan (Salsa, Bachata…): se busca por él. */
  estilo: string | null;
  /** Los cursos que toca (varios en una multi-curso); vacío en particular y alquiler. */
  cursos: string[];
  /** El profesor de la particular, o el titular de cada curso por asignación (regla 20). */
  profesorNombre: string | null;
  /** WhatsApp del profesor de la particular (para avisarle, como al alumno); `null` si no tiene. */
  profesorWhatsapp?: string | null;
  profesoresCurso: string[];
  fechaInicio: string;
  fechaFin: string | null;
  cicloNumero: number | null;
  anteriorId: number | null;
  siguienteId: number | null;
  uso: UsoDelCiclo;
  saldo: number;
  solicitudesVigentes: number;
};

/** Clave de orden de una persona u organización: la razón social cuenta como apellido. */
function ordenDe(t: FilaMembresia["titular"]) {
  return t.tipo === "organizacion" ? { nombre: null, apellido: t.razon_social } : { nombre: t.nombre, apellido: t.apellido };
}

/** Minúsculas y sin acentos: «Márquez» y «marquez» son la misma búsqueda. */
export const sinAcentos = (t: string | null | undefined) =>
  (t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type ContactoBusqueda = Pick<Contacto, "tipo" | "nombre" | "apellido" | "razon_social" | "whatsapp">;
const sinAcentosContacto = (c: ContactoBusqueda): ContactoBusqueda => ({
  ...c,
  nombre: c.nombre == null ? null : sinAcentos(c.nombre),
  apellido: c.apellido == null ? null : sinAcentos(c.apellido),
  razon_social: c.razon_social == null ? null : sinAcentos(c.razon_social),
});

/** Menos de 2 letras no busca: la pantalla lo dice en vez de ignorarlo. */
export const LARGO_MIN_BUSQUEDA = 2;
export function busquedaMuyCorta(q: string | null | undefined): boolean {
  const t = (q ?? "").trim();
  return t.length > 0 && t.length < LARGO_MIN_BUSQUEDA;
}

/**
 * ¿Esta membresía responde a la búsqueda? Reutiliza `coincideBusqueda`, el
 * filtro de Alumnos (nombre; WhatsApp propio y del tutor, con o sin +591,
 * espacios o guiones, desde 3 dígitos), y lo aplica también al **tutor**
 * como persona —su nombre y su WhatsApp ubican al menor— y al texto del
 * plan, el estilo, los cursos y los profesores. Sin acentos ni mayúsculas.
 */
export function coincideMembresia(q: string, m: FilaMembresia): boolean {
  const t = q.trim();
  if (t.length < LARGO_MIN_BUSQUEDA) return true;
  const qf = sinAcentos(t);
  if (coincideBusqueda(qf, { contacto: sinAcentosContacto(m.titular), tutorWhatsapp: m.tutor?.whatsapp })) return true;
  if (m.tutor) {
    const comoPersona: ContactoBusqueda = { tipo: "persona", nombre: sinAcentos(m.tutor.nombre), apellido: null, razon_social: null, whatsapp: m.tutor.whatsapp };
    if (coincideBusqueda(qf, { contacto: comoPersona })) return true;
  }
  return [m.planNombre, m.estilo, m.profesorNombre, ...m.cursos, ...m.profesoresCurso].some((x) => sinAcentos(x).includes(qf));
}

export function filtrarMembresias(filas: FilaMembresia[], f: FiltroMembresias = {}): FilaMembresia[] {
  const tipo = f.tipo ?? "todas";
  const estado = f.estado ?? "activas";
  const q = (f.q ?? "").trim();

  return filas
    .filter((m) => {
      if (tipo !== "todas" && m.tipo !== tipo) return false;
      if (estado === "activas" && m.historica) return false;
      if (estado === "historicas" && !m.historica) return false;
      if (estado === "por_vencer" && !m.porVencer) return false;
      if (estado === "con_deuda" && !m.conDeuda) return false;
      if (estado === "solicitudes" && !m.solicitudes) return false;
      return coincideMembresia(q, m);
    })
    .sort(
      (a, b) =>
        compararPorApellido(ordenDe(a.titular), ordenDe(b.titular)) ||
        (a.fechaInicio === b.fechaInicio ? b.id - a.id : a.fechaInicio < b.fechaInicio ? 1 : -1)
    );
}

/** «Menor · tutor Natalia Salek», igual que en Alumnos e Inscripción; `null` si no es menor. */
export const textoMenorFila = (m: Pick<FilaMembresia, "esMenor" | "tutor">) => textoMenor(m);

/**
 * Cuántas membresías hay en los otros estados que sí se miran de a uno
 * (Activas, Históricas) con el mismo tipo y la misma búsqueda. Sirve para no
 * dejar una lista vacía sin decir dónde están: «Hay 6 en Históricas · Ver».
 */
export function enOtrosEstados(
  filas: FilaMembresia[],
  f: FiltroMembresias
): { estado: "activas" | "historicas"; cantidad: number }[] {
  const actual = f.estado ?? "activas";
  return (["activas", "historicas"] as const)
    .filter((e) => e !== actual)
    .map((e) => ({ estado: e, cantidad: filtrarMembresias(filas, { ...f, estado: e }).length }))
    .filter((x) => x.cantidad > 0);
}
