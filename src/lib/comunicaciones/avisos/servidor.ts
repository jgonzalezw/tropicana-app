/**
 * R20 · E4b/E5 — prepara y registra el aviso de una reserva confirmada (N09/N10).
 * Solo servidor. NO es una acción del servidor (sin "use server"): la llaman las
 * acciones de `particulares`, que ya validaron el acceso a la operación.
 *
 *  - Lee con el cliente de servicio (`a`): un profesor de alcance propio no ve
 *    contactos, consentimientos ni asignaciones por RLS.
 *  - REGISTRA con la sesión de quien opera (`sb`): las funciones de la 0074
 *    verifican de nuevo, en la base, el acceso a la operación original.
 *  - Un aviso por evento exacto + destinatario + canal (clave idempotente). Un
 *    reintento opera sobre el MISMO registro y con la MISMA versión seleccionada.
 *  - Mientras la asignación esté en `legado` no se registra nada: devuelve `null`
 *    y el aviso sale como siempre (sin falso historial).
 *  - Un fallo no se disfraza de ausencia: queda como `fallido` con su motivo. El
 *    respaldo (texto anterior) solo existe para un fallo del contenido oficial.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigir, exigirUno } from "../../datos";
import { decidirResolucion, type FilaVersion } from "../contenidos/resolver";
import { evaluarContactabilidad, type Contactabilidad, type RegistroConsentimiento, type TextoPolitica } from "../contactabilidad";
import { variablesReserva, type EntradaReserva } from "../predeterminados/reserva";
import { renderizarVersion } from "./render";
import type { AccionAviso, TipoAccionAviso } from "./estado";
import type { AvisoRegistrable, CasoAvisoReserva, EventoAviso, MotivoFallo, RegistroAviso } from "./tipos";

export const FUENTE_EVENTO_RESERVA = "reservas_historial";
const VARIANTE = "unica";
const CANAL = "whatsapp";
const USO: Record<CasoAvisoReserva, string> = {
  N09: "reserva.confirmada.alumno",
  N10: "reserva.confirmada.profesor",
};

export type Deps = {
  /** Cliente de servicio: solo lecturas. */
  a: SupabaseClient;
  /** Cliente con la sesión de quien opera: registra (la base verifica el acceso). */
  sb: SupabaseClient;
  esAdmin: boolean;
};

export type Destinatario = { contactoId: number; nombre: string; whatsapp: string | null };

type FilaAviso = {
  id: number;
  caso: string;
  contacto_id: number;
  destino: string | null;
  texto: string | null;
  estado: "preparado" | "bloqueado" | "cancelado" | "fallido";
  motivo_fallo: MotivoFallo | null;
  respaldo: boolean;
  creado_en: string;
  version_id: number | null;
  contactabilidad: Contactabilidad;
};

type FilaVersionLeida = FilaVersion & { numero: number; etiqueta: string | null };

// ── Lecturas ────────────────────────────────────────────────────────────────

export async function leerContactabilidad(a: SupabaseClient, contactoId: number): Promise<Contactabilidad> {
  const c = exigirUno(await a.from("contactos").select("no_contactar").eq("id", contactoId).maybeSingle(), `el contacto ${contactoId}`) as
    | { no_contactar: boolean }
    | null;
  if (!c) throw new Error(`No existe el contacto ${contactoId}`);
  const vigentes = exigir(
    await a.from("consentimientos_vigentes").select("finalidad, otorgado, medio, version_politica, creado_en").eq("contacto_id", contactoId),
    "los consentimientos"
  ) as RegistroConsentimiento[];
  const textos = exigir(await a.from("politicas_texto").select("version, finalidad, texto"), "los textos de consentimiento") as TextoPolitica[];
  return evaluarContactabilidad({ noContactar: c.no_contactar, vigentes, textos, finalidad: "servicio", canal: "whatsapp" });
}

async function leerVersion(a: SupabaseClient, versionId: number): Promise<FilaVersionLeida | null> {
  return exigirUno(
    await a.from("contenido_versiones").select("id, contenido_id, estado, cuerpo, asunto, esquema, hash, numero, etiqueta").eq("id", versionId).maybeSingle(),
    `la versión ${versionId}`
  ) as FilaVersionLeida | null;
}

/** El contenido seleccionado: valida que la versión sea publicada, del contenido y que su texto reproduzca su hash. */
async function contenidoSeleccionado(a: SupabaseClient, usoClave: string, asignacionId: number, versionId: number): Promise<FilaVersionLeida> {
  const version = await leerVersion(a, versionId);
  decidirResolucion(usoClave, { id: asignacionId, modo: "modulo", contenido_id: version?.contenido_id ?? -1, version_id: versionId }, version);
  return version as FilaVersionLeida;
}

async function liberadaEn(a: SupabaseClient, asignacionId: number, versionId: number): Promise<string | null> {
  const r = exigir(
    await a
      .from("contenido_usos_historial")
      .select("creado_en")
      .eq("uso_id", asignacionId)
      .eq("a_version", versionId)
      .order("id", { ascending: false })
      .limit(1),
    "el historial de la liberación"
  ) as { creado_en: string }[];
  return r[0]?.creado_en ?? null;
}

export async function leerAcciones(deps: Deps, avisoId: number): Promise<AccionAviso[]> {
  const { data, error } = await deps.sb.rpc("acciones_de_aviso", { p_aviso_id: avisoId });
  if (error) throw new Error(`No se pudo leer el historial del aviso: ${error.message}`);
  const filas = (data ?? []) as {
    id: number;
    tipo: TipoAccionAviso;
    actor: string | null;
    creado_en: string;
    motivo: string | null;
    rectifica_id: number | null;
  }[];
  const ids = [...new Set(filas.map((f) => f.actor).filter((x): x is string => !!x))];
  const nombres = new Map<string, string>();
  if (ids.length) {
    const perfiles = exigir(await deps.a.from("perfiles").select("id, nombre, apellido").in("id", ids), "los usuarios del historial") as {
      id: string;
      nombre: string | null;
      apellido: string | null;
    }[];
    for (const p of perfiles) nombres.set(p.id, `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim() || "Usuario");
  }
  return filas.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    actor: f.actor ? (nombres.get(f.actor) ?? "Usuario") : null,
    actorId: f.actor,
    creadoEn: f.creado_en,
    motivo: f.motivo,
    rectificaId: f.rectifica_id,
  }));
}

/** Los avisos de un evento (la base filtra por el acceso a la operación). */
async function leerAvisosDeEvento(deps: Deps, ev: EventoAviso): Promise<FilaAviso[]> {
  const { data, error } = await deps.sb.rpc("leer_avisos_de_evento", {
    p_membresia_id: ev.membresiaId,
    p_fuente_evento: FUENTE_EVENTO_RESERVA,
    p_id_evento: String(ev.historialId),
  });
  if (error) throw new Error(`No se pudieron leer los avisos del evento: ${error.message}`);
  return (data ?? []) as FilaAviso[];
}

// ── Armado del registro para la pantalla ────────────────────────────────────

async function registroDe(deps: Deps, caso: CasoAvisoReserva, ev: EventoAviso, fila: FilaAviso | null, extra: Partial<RegistroAviso> = {}): Promise<RegistroAviso> {
  let numero: number | null = null;
  let etiqueta: string | null = null;
  let liberada: string | null = null;
  if (fila?.version_id) {
    const v = await leerVersion(deps.a, fila.version_id);
    numero = v?.numero ?? null;
    etiqueta = v?.etiqueta ?? null;
    const u = exigirUno(
      await deps.a.from("contenido_usos").select("id").eq("uso", USO[caso]).eq("variante", VARIANTE).eq("canal", CANAL).maybeSingle(),
      "la asignación"
    ) as { id: number } | null;
    if (u) liberada = await liberadaEn(deps.a, u.id, fila.version_id);
  }
  const acciones = fila ? await leerAcciones(deps, fila.id) : [];
  const falloContenido = fila?.estado === "fallido" && fila.motivo_fallo === "contenido";
  const respaldo: RegistroAviso["respaldo"] = !falloContenido
    ? "no_aplica"
    : deps.esAdmin
      ? "admin"
      : acciones.some((x) => x.tipo === "respaldo_autorizado")
        ? "autorizado"
        : "necesita_admin";
  return {
    caso,
    evento: ev,
    avisoId: fila?.id ?? null,
    creadoEn: fila?.creado_en ?? null,
    estado: fila ? (fila.estado === "cancelado" ? "fallido" : fila.estado) : "fallido",
    motivoFallo: fila?.motivo_fallo ?? null,
    detalle: null,
    errorRegistro: null,
    origen: { numero, etiqueta, liberadaEn: liberada, respaldo: fila?.respaldo ?? false },
    contactabilidad: fila?.contactabilidad ?? null,
    acciones,
    respaldo,
    ...extra,
  };
}

/** El aviso que se muestra: el texto es el del registro (nunca se vuelve a armar). */
async function avisoDeFila(deps: Deps, caso: CasoAvisoReserva, ev: EventoAviso, fila: FilaAviso, nombre: string): Promise<AvisoRegistrable> {
  return {
    nombre,
    whatsapp: fila.destino,
    mensaje: fila.texto ?? "",
    registro: await registroDe(deps, caso, ev, fila),
  };
}

/** El aviso del evento SOLO si es de ese evento y caso (un cliente no puede mezclar el texto de uno con el aviso de otro). */
export async function avisoDelEvento(deps: Deps, caso: CasoAvisoReserva, ev: EventoAviso, avisoId: number): Promise<boolean> {
  return (await leerAvisosDeEvento(deps, ev)).some((f) => f.caso === caso && f.id === avisoId);
}

/** Lo que la pantalla necesita después de una acción: el aviso tal como quedó. */
export async function refrescarAviso(deps: Deps, caso: CasoAvisoReserva, ev: EventoAviso, nombre: string): Promise<AvisoRegistrable | null> {
  const filas = (await leerAvisosDeEvento(deps, ev)).filter((f) => f.caso === caso);
  const fila = filas[filas.length - 1];
  return fila ? avisoDeFila(deps, caso, ev, fila, nombre) : null;
}

// ── Preparar y registrar ────────────────────────────────────────────────────

export type EntradaPreparar = {
  caso: CasoAvisoReserva;
  evento: EventoAviso;
  /** A quién va. `null` = no se pudo determinar (fallo visible, sin respaldo). */
  destinatario: Destinatario | null;
  nombreDestinatario: string;
  entrada: EntradaReserva;
  /** Reintentar un aviso `fallido` ya registrado. */
  reintentar?: boolean;
};

function sinRegistro(e: EntradaPreparar, motivo: MotivoFallo, detalle: string, texto = "", whatsapp: string | null = null): AvisoRegistrable {
  return {
    nombre: e.nombreDestinatario,
    whatsapp,
    mensaje: texto,
    registro: {
      caso: e.caso,
      evento: e.evento,
      avisoId: null,
      creadoEn: null,
      estado: "fallido",
      motivoFallo: motivo,
      detalle,
      errorRegistro: null,
      origen: { numero: null, etiqueta: null, liberadaEn: null, respaldo: false },
      contactabilidad: null,
      acciones: [],
      respaldo: "no_aplica",
    },
  };
}

/** Un error inesperado al preparar el aviso: visible, sin respaldo, y la operación ya confirmada no se toca. */
export function falloInesperado(e: Pick<EntradaPreparar, "caso" | "evento" | "nombreDestinatario">, detalle: string): AvisoRegistrable {
  return sinRegistro({ ...e, destinatario: null, entrada: undefined as never }, "contenido", detalle);
}

type Preparado = {
  estado: "preparado" | "bloqueado" | "fallido";
  motivo: MotivoFallo | null;
  detalle: string | null;
  texto: string | null;
  contactabilidad: Contactabilidad;
};

/** Decide el estado del aviso: contactabilidad primero (un bloqueo no necesita texto), luego el contenido. */
async function armar(deps: Deps, e: EntradaPreparar, contactoId: number, asignacionId: number, versionId: number): Promise<Preparado> {
  const vacia: Contactabilidad = { estado: "pendiente", bloquea: false, advertencia: null, registro: null };
  let contactabilidad: Contactabilidad;
  try {
    contactabilidad = await leerContactabilidad(deps.a, contactoId);
  } catch (err) {
    return { estado: "fallido", motivo: "contactabilidad", detalle: (err as Error).message, texto: null, contactabilidad: vacia };
  }
  if (contactabilidad.bloquea) return { estado: "bloqueado", motivo: null, detalle: contactabilidad.advertencia, texto: null, contactabilidad };

  let version: FilaVersionLeida;
  try {
    version = await contenidoSeleccionado(deps.a, USO[e.caso], asignacionId, versionId);
  } catch (err) {
    return { estado: "fallido", motivo: "contenido", detalle: (err as Error).message, texto: null, contactabilidad };
  }
  const r = renderizarVersion(version, variablesReserva(e.entrada));
  if (!r.ok) return { estado: "fallido", motivo: r.motivo, detalle: r.detalle, texto: null, contactabilidad };
  return { estado: "preparado", motivo: null, detalle: null, texto: r.texto, contactabilidad };
}

/**
 * Prepara (y registra) el aviso de un evento. `null` = la asignación está en
 * `legado`: no se registra y el aviso sigue como siempre.
 */
export async function prepararAviso(deps: Deps, e: EntradaPreparar): Promise<AvisoRegistrable | null> {
  const usoClave = `${USO[e.caso]}/${VARIANTE}/${CANAL}`;
  const asig = exigirUno(
    await deps.a.from("contenido_usos").select("id, modo, contenido_id, version_id").eq("uso", USO[e.caso]).eq("variante", VARIANTE).eq("canal", CANAL).maybeSingle(),
    `la asignación de contenido ${usoClave}`
  ) as { id: number; modo: "legado" | "modulo"; contenido_id: number; version_id: number | null } | null;
  if (!asig) return sinRegistro(e, "contenido", `No existe la asignación de contenido ${usoClave}.`);
  if (asig.modo === "legado") return null;
  if (asig.version_id === null) return sinRegistro(e, "contenido", `La asignación ${usoClave} está en modo módulo sin versión liberada.`);

  // Un fallo de destinatario no se esquiva con respaldo: se muestra y la operación sigue.
  if (!e.destinatario) return sinRegistro(e, "destinatario", "No se pudo determinar a quién avisar. Revisá los datos del alumno o del profesor.");
  const dest = e.destinatario;

  // Idempotencia: el aviso de este evento y destinatario ya puede existir.
  const existentes = (await leerAvisosDeEvento(deps, e.evento)).filter((f) => f.caso === e.caso && f.contacto_id === dest.contactoId);
  const existente = existentes[existentes.length - 1] ?? null;
  if (existente && !(e.reintentar && existente.estado === "fallido")) return avisoDeFila(deps, e.caso, e.evento, existente, e.nombreDestinatario);

  // El contenido es el SELECCIONADO al crear el aviso: un reintento no lo cambia.
  const versionId = existente?.version_id ?? asig.version_id;
  const p = await armar(deps, e, dest.contactoId, asig.id, versionId);

  const conservado = { texto: p.texto ?? "", whatsapp: dest.whatsapp };
  if (existente) {
    const { data, error } = await deps.sb.rpc("reintentar_aviso", {
      p_aviso_id: existente.id,
      p_destino: dest.whatsapp,
      p_texto: p.texto,
      p_contactabilidad: p.contactabilidad,
      p_estado: p.estado,
      p_motivo_fallo: p.motivo,
    });
    if (error) return conErrorDeRegistro(deps, e, p, conservado, error.message, existente);
    return avisoDeFila(deps, e.caso, e.evento, data as FilaAviso, e.nombreDestinatario).then((r) => ({ ...r, registro: { ...r.registro!, detalle: p.detalle } }));
  }
  const { data, error } = await deps.sb.rpc("registrar_aviso", {
    p_uso: USO[e.caso],
    p_variante: VARIANTE,
    p_canal: CANAL,
    p_caso: e.caso,
    p_fuente_evento: FUENTE_EVENTO_RESERVA,
    p_id_evento: String(e.evento.historialId),
    p_membresia_id: e.evento.membresiaId,
    p_contacto_id: dest.contactoId,
    p_destino: dest.whatsapp,
    p_texto: p.texto,
    p_contactabilidad: p.contactabilidad,
    p_estado: p.estado,
    p_motivo_fallo: p.motivo,
  });
  if (error) return conErrorDeRegistro(deps, e, p, conservado, error.message, null);
  const r = await avisoDeFila(deps, e.caso, e.evento, data as FilaAviso, e.nombreDestinatario);
  return { ...r, registro: { ...r.registro!, detalle: p.detalle } };
}

/** El registro falló pero el texto oficial ya estaba armado: se conserva y se reintenta con la misma clave. */
function conErrorDeRegistro(
  _deps: Deps,
  e: EntradaPreparar,
  p: Preparado,
  conservado: { texto: string; whatsapp: string | null },
  mensaje: string,
  existente: FilaAviso | null
): AvisoRegistrable {
  const base = sinRegistro(e, p.motivo ?? "contenido", p.detalle ?? "", conservado.texto, conservado.whatsapp);
  return {
    ...base,
    registro: {
      ...base.registro!,
      avisoId: existente?.id ?? null,
      estado: p.estado,
      motivoFallo: p.motivo,
      contactabilidad: p.contactabilidad,
      errorRegistro: `No se pudo registrar el aviso: ${mensaje}`,
    },
  };
}
