/**
 * R20 · E4b — contactabilidad de un contacto para un aviso (plan v2 §3).
 * UNA sola definición (calidad 10): el servidor la usa para decidir si un aviso
 * se prepara o no, y la prueba unitaria la fija. Es pura: lo que lee de la base
 * (`no_contactar`, consentimientos vigentes, textos de política) llega como dato.
 *
 * Reglas (aprobadas por Javier, 2026-10-10):
 *  - `no_contactar=true` = negativa explícita general: el aviso NO se prepara.
 *  - `no_contactar=false` NUNCA se lee como consentimiento.
 *  - El alcance de un registro lo dan el registro y SU TEXTO de consentimiento
 *    (`politicas_texto`), no el `medio`. Si el texto no identifica el canal, no
 *    se le atribuye: queda «canal no identificado» o, en un rechazo, «ambiguo».
 *  - Los registros v1 (`finalidad='contacto'`, texto mixto) conservan su
 *    procedencia: un otorgado respalda servicio solo por el canal que su texto
 *    nombra; un rechazo v1 es AMBIGUO (advertencia, queda para revisión, el
 *    aviso se prepara). No se reinterpretan ni se amplían.
 *  - Solo bloquea un rechazo explícito de alcance conocido: `todas`, o
 *    `servicio` cuyo texto identifica el canal. La operación de negocio sigue.
 */

export type FinalidadAviso = "servicio" | "comercial";
export type CanalAviso = "whatsapp" | "email";

/** Una fila de `consentimientos_vigentes` (el vigente por contacto y finalidad). */
export type RegistroConsentimiento = {
  finalidad: string;
  otorgado: boolean;
  medio: string;
  version_politica: string | null;
  creado_en: string;
};
export type TextoPolitica = { version: string; finalidad: string; texto: string };

export type EstadoContactabilidad =
  | "registrado"
  | "registrado_canal_no_identificado"
  | "pendiente"
  | "rechazo_explicito"
  | "rechazo_ambiguo"
  | "no_contactar";

export type Contactabilidad = {
  estado: EstadoContactabilidad;
  /** `true` = el aviso no se prepara (la operación sigue). */
  bloquea: boolean;
  /** Advertencia interna (no bloquea) o explicación del bloqueo. */
  advertencia: string | null;
  /** El registro que decidió (su procedencia), si lo hubo. */
  registro: { finalidad: string; otorgado: boolean; medio: string; version: string | null; fecha: string } | null;
};

const CANAL_EN_TEXTO: Record<CanalAviso, RegExp> = {
  whatsapp: /whats\s?app/i,
  email: /e-?mail|correo/i,
};

const ETIQUETA_CANAL: Record<CanalAviso, string> = { whatsapp: "WhatsApp", email: "email" };

/** ¿El texto del consentimiento nombra el canal? `null` = no hay texto: no se sabe. */
function textoNombraCanal(texto: string | undefined, canal: CanalAviso): boolean | null {
  if (texto === undefined) return null;
  return CANAL_EN_TEXTO[canal].test(texto);
}

function procedenciaDe(r: RegistroConsentimiento): NonNullable<Contactabilidad["registro"]> {
  return { finalidad: r.finalidad, otorgado: r.otorgado, medio: r.medio, version: r.version_politica, fecha: r.creado_en };
}

type Veredicto = Pick<Contactabilidad, "estado"> | null;

/** El veredicto de UN registro para la finalidad y el canal pedidos; `null` = no aplica. */
function veredictoDe(
  r: RegistroConsentimiento,
  finalidad: FinalidadAviso,
  canal: CanalAviso,
  textos: TextoPolitica[]
): Veredicto {
  if (r.finalidad === "todas") return { estado: r.otorgado ? "registrado" : "rechazo_explicito" };

  const mixtoV1 = r.finalidad === "contacto";
  if (!mixtoV1 && r.finalidad !== finalidad) return null;
  if (mixtoV1 && !r.otorgado) return { estado: "rechazo_ambiguo" };
  // Un otorgado v1 respalda servicio, no una finalidad comercial.
  if (mixtoV1 && finalidad !== "servicio") return null;

  const texto = r.version_politica
    ? textos.find((t) => t.version === r.version_politica && t.finalidad === r.finalidad)?.texto
    : undefined;
  const nombra = textoNombraCanal(texto, canal);
  if (nombra === null) return { estado: r.otorgado ? "registrado_canal_no_identificado" : "rechazo_ambiguo" };
  if (!nombra) return null; // su texto habla de otro canal: no aplica a este
  return { estado: r.otorgado ? "registrado" : "rechazo_explicito" };
}

const ADVERTENCIAS: Record<EstadoContactabilidad, (canal: CanalAviso) => string | null> = {
  registrado: () => null,
  registrado_canal_no_identificado: (c) =>
    `Hay un consentimiento registrado, pero no identifica el canal (${ETIQUETA_CANAL[c]}).`,
  pendiente: () => "Sin consentimiento registrado.",
  rechazo_explicito: (c) => `Rechazó recibir avisos por ${ETIQUETA_CANAL[c]}.`,
  rechazo_ambiguo: () => "Rechazó recibir avisos en una versión anterior del consentimiento: el alcance está por revisar.",
  no_contactar: () => "Pidió no ser contactado.",
};

export function evaluarContactabilidad(e: {
  noContactar: boolean;
  /** Los consentimientos vigentes del contacto (cualquier finalidad). */
  vigentes: RegistroConsentimiento[];
  textos: TextoPolitica[];
  finalidad: FinalidadAviso;
  canal: CanalAviso;
}): Contactabilidad {
  const armar = (estado: EstadoContactabilidad, r: RegistroConsentimiento | null): Contactabilidad => ({
    estado,
    bloquea: estado === "rechazo_explicito" || estado === "no_contactar",
    advertencia: ADVERTENCIAS[estado](e.canal),
    registro: r ? procedenciaDe(r) : null,
  });
  if (e.noContactar) return armar("no_contactar", null);

  // El más reciente que aplique decide; uno que no aplica a este canal se salta.
  const ordenados = [...e.vigentes].sort((a, b) => (a.creado_en < b.creado_en ? 1 : a.creado_en > b.creado_en ? -1 : 0));
  for (const r of ordenados) {
    const v = veredictoDe(r, e.finalidad, e.canal, e.textos);
    if (v) return armar(v.estado, r);
  }
  return armar("pendiente", null);
}
