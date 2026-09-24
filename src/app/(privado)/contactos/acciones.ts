"use server";

/**
 * Contactos (C3-0a.1) — el punto único donde se crea o reusa una persona.
 * `alumnos`/`profesores` son extensiones de rol: sus acciones de alta
 * (`crearAlumno`, `crearProfesor`, `crearAlumnoDesdeInscripcion`) llaman a
 * `crearOReusarContactoPersona` antes de insertar su propia fila, en vez de
 * escribir nombre/apellido/whatsapp por su cuenta. Así la validación y la
 * normalización del WhatsApp quedan en un solo lugar (antes estaba
 * duplicada entre `alumnos/acciones.ts` e `inscribir/acciones.ts`).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizarWhatsapp, normalizarRed, validarDocumento, documentoNormalizado } from "@/lib/contactos";
import { tienePermiso, obtenerPerfilActual } from "@/lib/sesion";
import { exigir } from "@/lib/datos";
import { nivelesDe, faltantes } from "@/lib/matrizMinimos";
import type {
  CampoMinimo,
  Contacto,
  ContactoRed,
  ConsentimientoVigente,
  ContextoMinimo,
  DatosContactoExtra,
  ListasContacto,
  MatrizMinimo,
  RedSocial,
  TipoDocumento,
} from "@/lib/tipos";
import { ETIQUETA_CAMPO_MINIMO } from "@/lib/tipos";

function admin() {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

function mapearErrorContacto(e: { code?: string; message?: string }): string {
  if (e.code === "23505") return "Ese WhatsApp ya es de otro contacto.";
  return e.message ?? "No se pudo guardar el contacto.";
}

type ResultadoContacto = { contacto?: Contacto; error?: string };

/**
 * Crea un contacto tipo persona, o reusa uno existente si su WhatsApp
 * normalizado ya está cargado (regla de negocio: un contacto, un WhatsApp).
 * `reusarSiExiste=false` fuerza a crear uno nuevo aunque el número ya
 * exista — el `insert` entonces falla con el 23505 de siempre y el
 * llamador decide (es el caso de "es otra persona" en la ficha).
 */
export async function crearOReusarContactoPersona(datos: {
  nombre: string;
  apellido?: string | null;
  whatsapp?: string | null;
  canal_captacion?: string | null;
  email?: string | null;
  sexo?: string | null;
  reusarSiExiste?: boolean;
}): Promise<ResultadoContacto> {
  const wa = normalizarWhatsapp(datos.whatsapp);

  if (datos.reusarSiExiste !== false && wa) {
    const { data: existente } = await admin().from("contactos").select("*").eq("whatsapp", wa).maybeSingle();
    if (existente) return { contacto: existente as Contacto };
  }

  const { data, error } = await admin()
    .from("contactos")
    .insert({
      tipo: "persona",
      nombre: datos.nombre.trim(),
      apellido: datos.apellido?.trim() || null,
      whatsapp: wa,
      canal_captacion: datos.canal_captacion ?? null,
      email: datos.email?.trim() || null,
      sexo: datos.sexo || null,
    })
    .select("*")
    .single();
  if (error) return { error: mapearErrorContacto(error) };
  return { contacto: data as Contacto };
}

export async function actualizarContactoPersona(
  id: number,
  datos: {
    nombre: string;
    apellido?: string | null;
    whatsapp?: string | null;
    canal_captacion?: string | null;
    email?: string | null;
    sexo?: string | null;
  }
): Promise<{ error?: string }> {
  const wa = normalizarWhatsapp(datos.whatsapp);
  const { error } = await admin()
    .from("contactos")
    .update({
      nombre: datos.nombre.trim(),
      apellido: datos.apellido?.trim() || null,
      whatsapp: wa,
      canal_captacion: datos.canal_captacion ?? null,
      email: datos.email?.trim() || null,
      sexo: datos.sexo || null,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: mapearErrorContacto(error) };
  return {};
}

/**
 * Resuelve el tutor de un menor a partir de lo que cargó la ficha: si ya
 * eligió un contacto existente (`tutorContactoId`), lo reusa tal cual; si
 * no, busca por WhatsApp normalizado y si tampoco existe crea uno nuevo.
 * Nunca "adivina" fusionando por nombre — eso quedó para el relleno de la
 * 0048, que sí tenía casos medidos para justificarlo.
 */
export async function resolverTutor(datos: {
  tutorContactoId: number | null;
  tutorNombre: string;
  tutorWhatsapp: string;
}): Promise<ResultadoContacto> {
  if (datos.tutorContactoId) {
    const { data, error } = await admin().from("contactos").select("*").eq("id", datos.tutorContactoId).maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "El contacto elegido como tutor ya no existe." };
    return { contacto: data as Contacto };
  }
  return crearOReusarContactoPersona({
    nombre: datos.tutorNombre.trim() || "Tutor sin nombre",
    whatsapp: datos.tutorWhatsapp,
  });
}

export async function vincularTutor(tutorContactoId: number, hijoContactoId: number): Promise<{ error?: string }> {
  const { error } = await admin()
    .from("contacto_relaciones")
    .upsert(
      { desde_id: tutorContactoId, hacia_id: hijoContactoId, tipo: "tutor_de" },
      { onConflict: "desde_id,hacia_id,tipo", ignoreDuplicates: true }
    );
  if (error) return { error: error.message };
  return {};
}

/**
 * Redes sociales del contacto (C3-0a.3): reemplaza el set completo, igual
 * criterio que `guardarEstilos` de profesores — más simple que diffear, y el
 * volumen (unas pocas filas por contacto) no lo justifica.
 */
export async function guardarRedes(
  contactoId: number,
  redes: { red: string; usuario: string }[]
): Promise<{ error?: string }> {
  const a = admin();
  const { error: errDel } = await a.from("contacto_redes").delete().eq("contacto_id", contactoId);
  if (errDel) return { error: errDel.message };

  const limpias = redes
    .map((r) => ({ red: r.red, usuario: normalizarRed(r.red, r.usuario) }))
    .filter((r) => r.usuario);
  if (limpias.length === 0) return {};

  const { error } = await a
    .from("contacto_redes")
    .insert(limpias.map((r) => ({ contacto_id: contactoId, red: r.red, usuario: r.usuario })));
  if (error) {
    if (error.code === "23505") return { error: "Esa red ya está cargada para este contacto." };
    return { error: error.message };
  }
  return {};
}

/**
 * Documento y fecha de nacimiento del contacto (`contactos_privados`, datos
 * sensibles — módulo propio `contactos_privados`, ver glosario "Extensión de
 * rol"). Comparten una sola fila; como son campos independientes en la
 * matriz (uno puede ser `O` y el otro `-`), se fusiona con lo que ya había
 * en vez de pisarlo — guardar solo la fecha de nacimiento no puede borrar un
 * documento cargado antes, y viceversa. Valida el documento contra el
 * patrón del tipo elegido (regla de calidad 6: la lista la sirve el dato).
 * Solo quien tiene el permiso puede escribir acá — si la matriz pide el
 * documento pero el rol no tiene el permiso, la pantalla lo explica (regla
 * de calidad 5) y esta acción de todos modos lo exige del lado servidor.
 */
export async function guardarPrivados(
  contactoId: number,
  datos: {
    documento: { tipo_documento: string; numero: string; complemento: string | null; expedido: string | null } | null;
    fecha_nacimiento: string | null;
  }
): Promise<{ error?: string }> {
  if (!datos.documento && !datos.fecha_nacimiento) return {};
  if (!(await tienePermiso("contactos_privados", "editar")))
    return { error: "No tenés permiso para cargar datos privados." };

  const a = admin();

  const { data: tipos, error: errTipos } = await a.from("tipos_documento").select("clave, patron");
  if (errTipos) return { error: `No se pudieron leer los tipos de documento: ${errTipos.message}` };
  const norm = documentoNormalizado(datos.documento, (tipos ?? []).map((t) => t.clave as string));
  if (norm.error) return { error: norm.error };
  const doc = norm.documento;
  if (doc) {
    const patron = (tipos ?? []).find((t) => t.clave === doc.tipo_documento)?.patron ?? null;
    if (!validarDocumento(patron, doc.numero))
      return { error: "El número de documento no tiene el formato de ese tipo." };
  }

  const { data: existente } = await a
    .from("contactos_privados")
    .select("*")
    .eq("contacto_id", contactoId)
    .maybeSingle();
  const prev = existente as {
    tipo_documento: string | null;
    numero: string | null;
    complemento: string | null;
    expedido: string | null;
    fecha_nacimiento: string | null;
  } | null;

  if (!doc && !datos.fecha_nacimiento && !prev) return {};

  // `datos.documento` presente = el formulario mostró el campo: su valor
  // manda, y vacío quiere decir "sin documento". Ausente = no se tocó.
  const tocado = datos.documento !== null && datos.documento !== undefined;
  const { error } = await a.from("contactos_privados").upsert(
    {
      contacto_id: contactoId,
      tipo_documento: tocado ? (doc?.tipo_documento ?? null) : (prev?.tipo_documento ?? null),
      numero: tocado ? (doc?.numero ?? null) : (prev?.numero ?? null),
      complemento: tocado ? (doc?.complemento ?? null) : (prev?.complemento ?? null),
      expedido: tocado ? (doc?.expedido ?? null) : (prev?.expedido ?? null),
      fecha_nacimiento: datos.fecha_nacimiento ?? prev?.fecha_nacimiento ?? null,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "contacto_id" }
  );
  if (error) {
    if (error.code === "23505") return { error: "Ese documento ya es de otro contacto." };
    return { error: error.message };
  }
  return {};
}

/**
 * Consentimiento (C3-0a.3): `consentimientos` es de solo agregar (trigger
 * `consentimientos_no_update`, 0048) — un consentimiento es un hecho que
 * pasó, nunca se edita. Por eso esto SOLO inserta, y solo si lo que se
 * cargó difiere de lo vigente: guardar sin tocarlo no debe dejar una fila
 * idéntica repetida cada vez que se reabre la ficha.
 */
export async function registrarConsentimiento(
  contactoId: number,
  datos: { otorgado: boolean; medio: string } | null
): Promise<{ error?: string }> {
  if (!datos) return {};
  const a = admin();

  const { data: vigente } = await a
    .from("consentimientos_vigentes")
    .select("otorgado, medio")
    .eq("contacto_id", contactoId)
    .eq("finalidad", "contacto")
    .maybeSingle();
  if (vigente && vigente.otorgado === datos.otorgado && vigente.medio === datos.medio) return {};

  const { data: politica } = await a
    .from("politicas_texto")
    .select("version")
    .eq("finalidad", "contacto")
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();

  const perfil = await obtenerPerfilActual();
  const { error } = await a.from("consentimientos").insert({
    contacto_id: contactoId,
    finalidad: "contacto",
    medio: datos.medio,
    otorgado: datos.otorgado,
    version_politica: politica?.version ?? null,
    registrado_por: perfil?.id ?? null,
  });
  if (error) return { error: error.message };
  return {};
}

/** Guarda los tres campos "extra" de un contacto en un solo llamado — lo usan las 5 acciones de alta/edición. */
export async function guardarDatosExtra(
  contactoId: number,
  extra: DatosContactoExtra
): Promise<{ error?: string }> {
  const r1 = await guardarRedes(contactoId, extra.redes);
  if (r1.error) return r1;
  const r2 = await guardarPrivados(contactoId, { documento: extra.documento, fecha_nacimiento: extra.fecha_nacimiento });
  if (r2.error) return r2;
  const r3 = await registrarConsentimiento(contactoId, extra.consentimiento);
  if (r3.error) return r3;
  return {};
}

/** Redes, documento (si hay permiso) y consentimiento vigente de un contacto — para abrir su ficha. */
export async function detalleContacto(contactoId: number): Promise<{
  redes: ContactoRed[];
  documento: { tipo_documento: string; numero: string; complemento: string | null; expedido: string | null } | null;
  fecha_nacimiento: string | null;
  consentimiento: ConsentimientoVigente | null;
}> {
  const supabase = await createClient();
  const puedeVerPrivados = await tienePermiso("contactos_privados", "ver");

  const [{ data: redes }, { data: privados }, { data: consentimiento }] = await Promise.all([
    supabase.from("contacto_redes").select("*").eq("contacto_id", contactoId),
    puedeVerPrivados
      ? supabase.from("contactos_privados").select("*").eq("contacto_id", contactoId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("consentimientos_vigentes")
      .select("*")
      .eq("contacto_id", contactoId)
      .eq("finalidad", "contacto")
      .maybeSingle(),
  ]);

  return {
    redes: (redes as ContactoRed[]) ?? [],
    // Una fila de datos privados con solo la fecha de nacimiento NO tiene
    // documento: devolver uno vacío hacía viajar `tipo_documento = ""`.
    documento: (privados as { numero: string | null } | null)?.numero
      ? {
          tipo_documento: (privados as { tipo_documento: string | null }).tipo_documento ?? "",
          numero: (privados as { numero: string | null }).numero ?? "",
          complemento: (privados as { complemento: string | null }).complemento,
          expedido: (privados as { expedido: string | null }).expedido,
        }
      : null,
    fecha_nacimiento: privados ? (privados as { fecha_nacimiento: string | null }).fecha_nacimiento : null,
    consentimiento: (consentimiento as ConsentimientoVigente) ?? null,
  };
}

/**
 * La matriz de mínimos y los catálogos de apoyo que `CamposContacto`
 * necesita para renderizarse — un solo llamado para las tres pantallas que
 * montan un formulario de contacto (alumnos, profesores, inscribir).
 */
async function valoresDeCatalogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clave: string
): Promise<{ valor: string; etiqueta: string }[]> {
  const { data: catalogo } = await supabase.from("catalogos").select("id").eq("clave", clave).maybeSingle();
  if (!catalogo?.id) return [];
  const { data: valores } = await supabase
    .from("catalogo_valores")
    .select("valor, etiqueta")
    .eq("catalogo_id", catalogo.id)
    .eq("activo", true)
    .order("orden");
  return (valores as { valor: string; etiqueta: string }[]) ?? [];
}

export async function cargarListasContacto(): Promise<{
  matriz: MatrizMinimo[];
  listas: ListasContacto;
  puedeVerPrivados: boolean;
}> {
  const supabase = await createClient();
  const [rMatriz, { data: redes }, { data: tipos }, mediosConsentimiento, sexoOpciones, puedeVerPrivados, { data: politica }] =
    await Promise.all([
      supabase.from("matriz_minimos").select("*"),
      supabase.from("redes_sociales").select("*").eq("activo", true).order("orden"),
      supabase.from("tipos_documento").select("*").eq("activo", true).order("orden"),
      valoresDeCatalogo(supabase, "medio_consentimiento"),
      valoresDeCatalogo(supabase, "sexo"),
      tienePermiso("contactos_privados", "ver"),
      supabase
        .from("politicas_texto")
        .select("texto")
        .eq("finalidad", "contacto")
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  const matriz = exigir<MatrizMinimo[]>(rMatriz, "la matriz de mínimos");

  return {
    matriz,
    listas: {
      redesDisponibles: (redes as RedSocial[]) ?? [],
      tiposDocumento: (tipos as TipoDocumento[]) ?? [],
      mediosConsentimiento,
      sexoOpciones,
      textoPolitica: (politica as { texto: string } | null)?.texto ?? "",
    },
    puedeVerPrivados,
  };
}

/**
 * Rechaza si falta algún campo `O` de la matriz de mínimos para ese
 * contexto (C3-0a.3) — nombre/whatsapp/tutor/es_menor/tipo_profesor no
 * entran acá: esos ya los exige su propia validación de identidad, siempre,
 * pase lo que pase en la matriz (ver `validarIdentidadAlumno`).
 */
export async function validarContraMatriz(
  contexto: ContextoMinimo,
  presente: Partial<Record<CampoMinimo, boolean>>
): Promise<string | null> {
  const { data, error } = await admin().from("matriz_minimos").select("*");
  if (error) return `No se pudo leer la matriz de mínimos: ${error.message}`;
  const niveles = nivelesDe((data as MatrizMinimo[]) ?? [], contexto);
  // whatsapp/tutor/es_menor/tipo_profesor quedan afuera: los exige, siempre,
  // la validación de identidad (`validarIdentidadAlumno`) o el `validar()`
  // de profesores, con un mensaje más específico — nombre SÍ se reporta acá,
  // porque nada más lo exige del lado servidor.
  const falt = faltantes(niveles, presente).filter(
    (c) => c !== "whatsapp" && c !== "tutor" && c !== "es_menor" && c !== "tipo_profesor"
  );
  if (falt.length === 0) return null;
  return `Faltan campos obligatorios: ${falt.map((c) => ETIQUETA_CAMPO_MINIMO[c]).join(", ")}.`;
}
