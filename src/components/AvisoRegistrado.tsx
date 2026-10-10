"use client";

/**
 * R20 · E5 · S05 — el aviso de una reserva confirmada cuando sale del módulo de
 * comunicaciones (handoff de Claude Design, entrega 1, rev. 2.1).
 *
 * Igual que `AvisoWhatsapp`: «Enviar por WhatsApp» (la app primero, `wa.me` de
 * respaldo) y «Copiar texto» en un clic, sin pasos obligatorios nuevos. Suma:
 *  - la pastilla de origen (oficial, con su versión);
 *  - el estado Preparado → Abierto / Copiado → Declarado enviado. Abrir WhatsApp
 *    NUNCA se muestra como enviado: «Marcar como enviado» es una declaración
 *    opcional del operador, que no se borra (se rectifica con otra entrada);
 *  - el historial de acciones del aviso;
 *  - los estados de falla: consentimiento, rechazo, destino, dato faltante,
 *    error al preparar (reintentar con el MISMO contenido; el texto anterior es
 *    otra acción, explícita y autorizada) y error de registro.
 * Cada aviso (N09, N10) es independiente: lo de uno no cambia al otro.
 */

import { useState, useTransition } from "react";
import { urlChatWhatsapp, urlAppWhatsapp } from "@/lib/contactos";
import { abrirWhatsapp } from "@/lib/whatsappCliente";
import {
  registrarAccionAviso,
  reintentarAvisoReserva,
  usarRespaldoAvisoReserva,
  type RespuestaAviso,
} from "@/app/(privado)/particulares/acciones";
import {
  declaracionVigente,
  estadoVisible,
  ETIQUETA_ACCION,
  ETIQUETA_ESTADO_VISIBLE,
  type TipoAccionAviso,
} from "@/lib/comunicaciones/avisos/estado";
import type { AvisoRegistrable, RegistroAviso } from "@/lib/comunicaciones/avisos/tipos";

const botonPrimario =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] font-medium hover:opacity-90";
const botonTenue =
  "px-3 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-50";
const pastilla = "text-xs px-2 py-0.5 rounded-full border border-[var(--borde)] text-[var(--texto-tenue)]";

const FORMATO_HORA = new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const FORMATO_DIA = new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", day: "2-digit", month: "2-digit" });
const FORMATO_DIA_ANIO = new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", day: "2-digit", month: "2-digit", year: "numeric" });
const hora = (iso: string) => FORMATO_HORA.format(new Date(iso));
const dia = (iso: string) => FORMATO_DIA.format(new Date(iso));
const diaAnio = (iso: string) => FORMATO_DIA_ANIO.format(new Date(iso));

const SUBTITULO: Record<RegistroAviso["caso"], string> = {
  N09: "Alumno, tutor o titular · N09",
  N10: "Profesor de la clase · N10",
};

function PastillaOrigen({ origen }: { origen: RegistroAviso["origen"] }) {
  if (origen.respaldo)
    return <span className={`${pastilla} text-[var(--advertencia,var(--texto-tenue))]`}>Respaldo autorizado · texto heredado</span>;
  const version = origen.numero != null ? `Oficial v${origen.numero}` : "Oficial";
  const cuando = origen.liberadaEn ? ` · liberada el ${dia(origen.liberadaEn)}` : "";
  return (
    <span className={`${pastilla} text-[var(--exito)]`} title={origen.etiqueta ?? undefined}>
      {version}
      {cuando}
    </span>
  );
}

export default function AvisoRegistrado({ aviso }: { aviso: AvisoRegistrable & { registro: RegistroAviso } }) {
  const [actual, setActual] = useState<AvisoRegistrable & { registro: RegistroAviso }>(aviso);
  const [copiado, setCopiado] = useState(false);
  const [historial, setHistorial] = useState(false);
  const [aviso_, setAviso] = useState<string | null>(null);
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendiente, empezar] = useTransition();

  const r = actual.registro;
  const url = urlChatWhatsapp(actual.whatsapp, actual.mensaje);
  const urlApp = urlAppWhatsapp(actual.whatsapp, actual.mensaje);
  const estado = estadoVisible(r.acciones);
  const vigente = declaracionVigente(r.acciones);

  function aplicar(res: RespuestaAviso, mantenerError?: string) {
    if (res.aviso?.registro) setActual({ ...actual, ...res.aviso, nombre: actual.nombre, registro: res.aviso.registro });
    setAviso(res.error ?? mantenerError ?? null);
  }

  /** Registra una acción. Un fallo del registro se avisa, pero el botón funciona igual. */
  function registrar(tipo: Extract<TipoAccionAviso, "abierto_whatsapp" | "copiado" | "declarado_enviado" | "declaracion_rectificada">, extra?: { rectificaId?: number }) {
    if (r.avisoId == null) return;
    const avisoId = r.avisoId;
    empezar(async () => {
      try {
        const res = await registrarAccionAviso({ caso: r.caso, evento: r.evento, avisoId, tipo, ...extra });
        aplicar(res, res.error ? `No se pudo registrar la acción: ${res.error}` : undefined);
      } catch {
        setAviso("No se pudo registrar la acción (sin conexión). El botón funcionó igual.");
      }
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(actual.mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin HTTPS o sin permiso: el texto sigue visible para seleccionarlo a mano.
    }
    registrar("copiado");
  }

  function reintentar() {
    empezar(async () => {
      try {
        aplicar(await reintentarAvisoReserva({ caso: r.caso, evento: r.evento }));
      } catch {
        setAviso("No se pudo reintentar (sin conexión).");
      }
    });
  }

  function usarRespaldo() {
    if (r.avisoId == null) return;
    const avisoId = r.avisoId;
    empezar(async () => {
      try {
        aplicar(await usarRespaldoAvisoReserva({ caso: r.caso, evento: r.evento, avisoId, motivo }));
        setPidiendoMotivo(false);
      } catch {
        setAviso("No se pudo usar el texto anterior (sin conexión).");
      }
    });
  }

  const contenedor = "rounded-[var(--radio-panel)] border border-[var(--borde)] p-3 flex flex-col gap-2";
  const cabecera = (
    <div className="flex items-start justify-between gap-2 flex-wrap">
      <div>
        <div className="font-medium">Aviso para {actual.nombre || "—"}</div>
        <div className="text-xs text-[var(--texto-tenue)]">{SUBTITULO[r.caso]}</div>
      </div>
      <PastillaOrigen origen={r.origen} />
    </div>
  );

  // ── Rechazo explícito: el aviso no se prepara; la reserva sigue confirmada. ──
  if (r.estado === "bloqueado") {
    const c = r.contactabilidad;
    return (
      <div className={contenedor} data-testid={`aviso-${r.caso}`} data-estado="bloqueado">
        {cabecera}
        <div className="rounded-[var(--radio-control)] border border-[var(--peligro)] p-2 text-sm" role="alert">
          <p className="font-medium">{actual.nombre || "El contacto"}: {c?.estado === "no_contactar" ? "pidió no ser contactado" : "rechazó recibir avisos de servicio por WhatsApp"}</p>
          {c?.registro && (
            <p className="mt-1">
              Registrado el {diaAnio(c.registro.fecha)}, medio: {c.registro.medio}. Alcance: avisos de servicio · WhatsApp.
            </p>
          )}
          <p className="mt-1">Este aviso no se prepara. La reserva quedó confirmada.</p>
        </div>
      </div>
    );
  }

  // ── Fallo al preparar: se explica y se ofrece reintentar con el MISMO contenido. ──
  if (r.estado === "fallido") {
    const sinDestino = r.motivoFallo === "destinatario";
    const faltante = r.motivoFallo === "variable_faltante";
    const que = sinDestino
      ? r.detalle
      : faltante
        ? `Falta un dato para armar el aviso (${r.detalle}). Completalo en la reserva y volvé a prepararlo con el mismo contenido.`
        : r.motivoFallo === "contactabilidad"
          ? `No se pudo comprobar el consentimiento: ${r.detalle}.`
          : `No se pudo preparar el aviso con el contenido seleccionado (${r.origen.numero != null ? `Oficial v${r.origen.numero}` : "Oficial"}): ${r.detalle}. La reserva quedó confirmada.`;
    return (
      <div className={contenedor} data-testid={`aviso-${r.caso}`} data-estado="fallido">
        {cabecera}
        <p className="text-sm text-[var(--peligro)]" role="alert">{que}</p>
        <div className="flex gap-2 flex-wrap">
          {!sinDestino && (
            <button type="button" onClick={reintentar} disabled={pendiente} className={botonTenue}>
              {faltante ? "Preparar de nuevo con el mismo contenido" : "Reintentar con el mismo contenido"}
            </button>
          )}
          {r.respaldo !== "no_aplica" && r.avisoId != null && (
            r.respaldo === "necesita_admin" ? (
              <span className="text-xs text-[var(--texto-tenue)] self-center">
                El texto anterior necesita la autorización de un Administrador para este aviso.
              </span>
            ) : pidiendoMotivo || r.respaldo === "autorizado" ? (
              <span className="flex gap-2 items-center flex-wrap">
                {r.respaldo === "admin" && (
                  <input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Motivo (queda registrado)"
                    aria-label="Motivo del respaldo"
                    className="px-2 py-1 text-sm rounded-[var(--radio-control)] border border-[var(--borde)] bg-transparent"
                  />
                )}
                <button type="button" onClick={usarRespaldo} disabled={pendiente || (r.respaldo === "admin" && !motivo.trim())} className={botonTenue}>
                  Confirmar: usar el texto anterior
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setPidiendoMotivo(true)} disabled={pendiente} className={`${botonTenue} border-dashed`}>
                Usar el texto anterior (respaldo autorizado)
              </button>
            )
          )}
        </div>
        {aviso_ && <p className="text-xs text-[var(--peligro)]" role="alert">{aviso_}</p>}
      </div>
    );
  }

  // ── Preparado ──
  const c = r.contactabilidad;
  const advertencia = c && !c.bloquea ? c.advertencia : null;
  return (
    <div className={contenedor} data-testid={`aviso-${r.caso}`} data-estado={estado}>
      {cabecera}
      {advertencia && (
        <p className="text-xs text-[var(--advertencia,var(--texto-tenue))]" data-testid="aviso-advertencia">
          ● {advertencia} Es un aviso de servicio y se puede enviar igual. Solo lo ves vos.
        </p>
      )}
      {r.errorRegistro && (
        <div className="rounded-[var(--radio-control)] border border-[var(--peligro)] p-2 text-sm" role="alert">
          <p>{r.errorRegistro}</p>
          <p className="mt-1">El texto está listo: podés enviarlo igual. El registro se reintenta con la misma clave.</p>
          <button type="button" onClick={reintentar} disabled={pendiente} className={`${botonTenue} mt-2`}>
            Reintentar el registro
          </button>
        </div>
      )}
      <p className="text-sm whitespace-pre-wrap" data-testid="aviso-texto">{actual.mensaje}</p>
      {!url && (
        <p className="text-xs text-[var(--texto-tenue)]">
          Sin WhatsApp en formato internacional (+591…): no se puede armar el link. Se corrige en la ficha del contacto; «Copiar texto» sigue activo.
        </p>
      )}
      <div className="flex gap-2 items-center flex-wrap">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={botonPrimario}
            onClick={(e) => {
              e.preventDefault();
              abrirWhatsapp(urlApp, url);
              registrar("abierto_whatsapp");
            }}
          >
            Enviar por WhatsApp
          </a>
        ) : (
          <span className={`${botonPrimario} opacity-40 pointer-events-none`} aria-disabled="true">
            Enviar por WhatsApp
          </span>
        )}
        <button type="button" onClick={copiar} className={botonTenue}>
          {copiado ? "Copiado ✓" : "Copiar texto"}
        </button>
        <span className={pastilla} data-testid="aviso-estado">{ETIQUETA_ESTADO_VISIBLE[estado]}</span>
      </div>

      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-[var(--texto-tenue)]">
        {r.creadoEn && <span>Preparado {hora(r.creadoEn)}</span>}
        {r.acciones
          .filter((a) => a.tipo !== "reintento")
          .map((a) => (
            <span key={a.id}>
              {ETIQUETA_ACCION[a.tipo].split(" por el operador")[0]} {hora(a.creadoEn)}
            </span>
          ))}
        {r.avisoId != null && !vigente && estado !== "declarado" && (
          <button type="button" className="underline" disabled={pendiente} onClick={() => registrar("declarado_enviado")}>
            Marcar como enviado
          </button>
        )}
        {vigente && (
          <button type="button" className="underline" disabled={pendiente} onClick={() => registrar("declaracion_rectificada", { rectificaId: vigente.id })}>
            Rectificar: no se envió
          </button>
        )}
        <button type="button" className="underline ml-auto" onClick={() => setHistorial((x) => !x)} aria-expanded={historial}>
          Historial
        </button>
      </div>
      {vigente && (
        <p className="text-xs text-[var(--texto-tenue)]">
          Declarado enviado por {vigente.actor ?? "un usuario"} a las {hora(vigente.creadoEn)}. Es una declaración del operador, no una confirmación del proveedor.
        </p>
      )}
      {historial && (
        <ol className="text-xs border-t border-[var(--borde)] pt-2 flex flex-col gap-1" data-testid="aviso-historial">
          {r.creadoEn && (
            <li>
              {hora(r.creadoEn)} · <strong>Preparado</strong> · por el sistema · {r.origen.respaldo ? "texto anterior (respaldo)" : `contenido oficial${r.origen.numero != null ? ` v${r.origen.numero}` : ""}`}
            </li>
          )}
          {r.acciones.map((a) => (
            <li key={a.id}>
              {hora(a.creadoEn)} · <strong>{ETIQUETA_ACCION[a.tipo]}</strong>
              {a.actor ? ` · ${a.actor}` : ""}
              {a.motivo ? ` · ${a.motivo}` : ""}
              {a.tipo === "declarado_enviado" && " · no es confirmación del proveedor"}
            </li>
          ))}
        </ol>
      )}
      {aviso_ && <p className="text-xs text-[var(--peligro)]" role="alert">{aviso_}</p>}
    </div>
  );
}
