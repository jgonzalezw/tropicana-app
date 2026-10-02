"use server";

/**
 * Contactos en una venta ("Ventas y contactos con el mismo comportamiento",
 * Javier, 2026-10-01). Buscar, detectar duplicados, crear, completar el rol y
 * editar un contacto desde cualquier flujo de venta — el mismo camino para el
 * titular de un curso, una particular o un alquiler.
 *
 * Todo lo que toca a una persona u organización vive acá, una sola vez
 * (regla 21): los flujos de venta no escriben contactos por su cuenta.
 *
 * Lee con el cliente admin porque el select de `contactos` exige el permiso
 * del módulo contactos y quien vende no necesariamente lo tiene; lo que
 * habilita cada lectura/escritura es el permiso del módulo desde el que se
 * vende (`modulo`) o el de `contactos`.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { tienePermiso } from "@/lib/sesion";
import {
  compararContactosPorApellido,
  documentoComparable,
  nombreCompleto,
  normalizarWhatsapp,
  urlChatWhatsapp,
} from "@/lib/contactos";
import { soloDigitos } from "@/lib/texto";
import { nivelesDe } from "@/lib/matrizMinimos";
import {
  contextoAlta,
  faltantesAlta,
  rolDe,
  textoFaltaAlta,
  type ContactoResumen,
} from "@/lib/contactoVenta";
import type {
  ConsentimientoVigente,
  ContactoRed,
  ContextoMinimo,
  DatosContactoExtra,
  MatrizMinimo,
  ModuloClave,
  TipoContacto,
} from "@/lib/tipos";
import { guardarDatosExtra } from "./acciones";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

function admin(): Admin {
  const a = createAdminClient();
  if (!a) throw new Error("Falta configurar la clave service_role en el servidor.");
  return a;
}

/** Los módulos desde los que se vende o se da de alta gente: nada más habilita estas acciones. */
const MODULOS_VENTA: ModuloClave[] = ["alquileres", "particulares", "inscripciones", "alumnos", "profesores", "contactos"];
/** La organización existe solo donde el flujo la permite (alquileres; servicios especiales, más adelante). */
const MODULOS_CON_ORGANIZACION: ModuloClave[] = ["alquileres"];

async function habilitado(modulo: ModuloClave, accion: "ver" | "crear"): Promise<boolean> {
  if (!MODULOS_VENTA.includes(modulo)) return false;
  return (await tienePermiso(modulo, accion)) || (await tienePermiso("contactos", accion));
}

type FilaContacto = {
  id: number;
  tipo: TipoContacto;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  whatsapp: string | null;
  no_contactar: boolean;
};
const COLUMNAS = "id, tipo, nombre, apellido, razon_social, whatsapp, no_contactar";

async function resumir(a: Admin, filas: FilaContacto[]): Promise<ContactoResumen[]> {
  if (!filas.length) return [];
  const ids = filas.map((f) => f.id);
  const [{ data: als }, { data: pros }] = await Promise.all([
    a.from("alumnos").select("contacto_id").in("contacto_id", ids),
    a.from("profesores").select("contacto_id").in("contacto_id", ids),
  ]);
  const esAlumno = new Set(((als as { contacto_id: number }[]) ?? []).map((x) => x.contacto_id));
  const esProfesor = new Set(((pros as { contacto_id: number }[]) ?? []).map((x) => x.contacto_id));
  return [...filas]
    .sort((x, y) => compararContactosPorApellido(x, y))
    .map<ContactoResumen>((f) => ({
      id: f.id,
      tipo: f.tipo,
      nombre: nombreCompleto(f),
      whatsapp: f.whatsapp,
      rol: rolDe(esAlumno.has(f.id), esProfesor.has(f.id)),
      noContactar: f.no_contactar,
    }));
}

// ── Buscar ────────────────────────────────────────────────────────────────

/**
 * Busca entre TODOS los contactos —cualquier rol— por nombre, razón social,
 * WhatsApp y, si el rol puede ver datos privados, por documento. Un error de
 * lectura se devuelve como error: nunca se disfraza de "sin resultados"
 * (regla de calidad 1).
 */
export async function buscarContactos(
  q: string,
  opciones: { modulo: ModuloClave; soloPersonas?: boolean }
): Promise<{ contactos: ContactoResumen[]; error?: string }> {
  if (!(await habilitado(opciones.modulo, "crear")) && !(await habilitado(opciones.modulo, "ver")))
    return { contactos: [], error: "No tenés permiso para buscar contactos." };
  const texto = q.trim().replace(/[%,()]/g, " ");
  if (texto.length < 2) return { contactos: [] };
  const a = admin();
  const patron = `%${texto}%`;
  const condiciones = [`nombre.ilike.${patron}`, `apellido.ilike.${patron}`, `razon_social.ilike.${patron}`];
  const digitos = soloDigitos(texto);
  if (digitos.length >= 3) condiciones.push(`whatsapp.ilike.%${digitos}%`);

  if (digitos.length >= 3 || /[a-z0-9]{3,}/i.test(texto)) {
    if (await tienePermiso("contactos_privados", "ver")) {
      const doc = documentoComparable(texto);
      if (doc.length >= 3) {
        const { data: porDoc, error: errDoc } = await a
          .from("contactos_privados")
          .select("contacto_id")
          .ilike("numero", `%${doc}%`)
          .limit(20);
        if (errDoc) return { contactos: [], error: `No se pudo buscar: ${errDoc.message}` };
        const ids = ((porDoc as { contacto_id: number }[]) ?? []).map((x) => x.contacto_id);
        if (ids.length) condiciones.push(`id.in.(${ids.join(",")})`);
      }
    }
  }

  let consulta = a
    .from("contactos")
    .select(COLUMNAS)
    .eq("activo", true)
    .is("anonimizado_en", null)
    .or(condiciones.join(","))
    .limit(30);
  if (opciones.soloPersonas) consulta = consulta.eq("tipo", "persona");
  const { data, error } = await consulta;
  if (error) return { contactos: [], error: `No se pudo buscar: ${error.message}` };
  return { contactos: await resumir(a, (data ?? []) as FilaContacto[]) };
}

/**
 * ¿Ya existe un contacto con ese WhatsApp o ese documento? Mira todos los
 * roles: un profesor, un alumno o un solo contacto cuentan igual (nunca se
 * rechaza con un error genérico, se ofrece usarlo).
 */
export async function buscarDuplicado(d: {
  modulo: ModuloClave;
  whatsapp?: string | null;
  documento?: { tipo_documento: string; numero: string; complemento?: string | null } | null;
  excluirId?: number | null;
}): Promise<{ porWhatsapp: ContactoResumen | null; porDocumento: ContactoResumen | null; error?: string }> {
  const vacio = { porWhatsapp: null, porDocumento: null };
  if (!(await habilitado(d.modulo, "crear")) && !(await habilitado(d.modulo, "ver")))
    return { ...vacio, error: "No tenés permiso para buscar contactos." };
  const a = admin();
  let porWhatsapp: ContactoResumen | null = null;
  let porDocumento: ContactoResumen | null = null;

  const wa = normalizarWhatsapp(d.whatsapp);
  if (wa) {
    let c = a.from("contactos").select(COLUMNAS).eq("whatsapp", wa).is("anonimizado_en", null);
    if (d.excluirId) c = c.neq("id", d.excluirId);
    const { data, error } = await c.limit(1);
    if (error) return { ...vacio, error: `No se pudo revisar el WhatsApp: ${error.message}` };
    porWhatsapp = (await resumir(a, (data ?? []) as FilaContacto[]))[0] ?? null;
  }

  const num = documentoComparable(d.documento?.numero);
  if (d.documento && num && (await tienePermiso("contactos_privados", "ver"))) {
    const { data, error } = await a
      .from("contactos_privados")
      .select("contacto_id, numero, complemento")
      .eq("tipo_documento", d.documento.tipo_documento)
      .ilike("numero", num)
      .limit(5);
    if (error) return { porWhatsapp, porDocumento, error: `No se pudo revisar el documento: ${error.message}` };
    const comp = documentoComparable(d.documento.complemento);
    const hit = ((data as { contacto_id: number; complemento: string | null }[]) ?? []).find(
      (x) => documentoComparable(x.complemento) === comp && x.contacto_id !== (d.excluirId ?? -1)
    );
    if (hit) {
      const { data: filas } = await a.from("contactos").select(COLUMNAS).eq("id", hit.contacto_id).limit(1);
      porDocumento = (await resumir(a, (filas ?? []) as FilaContacto[]))[0] ?? null;
    }
  }
  return { porWhatsapp, porDocumento };
}

// ── Crear ─────────────────────────────────────────────────────────────────

export type EntradaCrearContacto = {
  modulo: ModuloClave;
  tipo: TipoContacto;
  nombre: string;
  apellido: string;
  razonSocial: string;
  whatsapp: string;
  extra: DatosContactoExtra;
  /** Solo organizaciones: la persona que atiende por la empresa (existente o nueva). */
  personaContacto?: { contactoId: number } | { nombre: string; whatsapp: string } | null;
  /** Rol que el contacto adquiere al crearse (la venta de un curso o una particular hace alumno al titular). */
  rol?: "alumno" | null;
};

export type ResultadoCrearContacto = {
  contacto?: ContactoResumen;
  /** Chocó con un contacto que ya existe: se ofrece usarlo, no se creó nada. */
  duplicado?: { por: "whatsapp" | "documento"; contacto: ContactoResumen };
  error?: string;
};

async function leerMatriz(a: Admin): Promise<{ matriz?: MatrizMinimo[]; error?: string }> {
  const { data, error } = await a.from("matriz_minimos").select("*");
  if (error) return { error: `No se pudo leer la matriz de mínimos: ${error.message}` };
  return { matriz: (data as MatrizMinimo[]) ?? [] };
}

/**
 * El contacto que ya existe puede no ser alumno todavía: la venta de un curso
 * o una particular le agrega el rol, sin pedir ni duplicar ningún dato.
 */
export async function asegurarRolAlumno(contactoId: number): Promise<{ alumnoId?: number; error?: string }> {
  const a = admin();
  const { data: existente, error: errLeer } = await a.from("alumnos").select("id").eq("contacto_id", contactoId).maybeSingle();
  if (errLeer) return { error: errLeer.message };
  if (existente) return { alumnoId: (existente as { id: number }).id };
  const { data, error } = await a
    .from("alumnos")
    .insert({ contacto_id: contactoId, es_menor: false })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { alumnoId: (data as { id: number }).id };
}

export async function crearContacto(d: EntradaCrearContacto): Promise<ResultadoCrearContacto> {
  if (!(await habilitado(d.modulo, "crear"))) return { error: "No tenés permiso para crear contactos." };
  if (d.tipo === "organizacion" && !MODULOS_CON_ORGANIZACION.includes(d.modulo))
    return { error: "Una organización solo se carga como titular de un alquiler o un servicio especial." };

  const a = admin();
  const { matriz, error: errMatriz } = await leerMatriz(a);
  if (errMatriz || !matriz) return { error: errMatriz };
  const niveles = nivelesDe(matriz, contextoAlta(d.tipo, d.rol));
  const falt = textoFaltaAlta(
    faltantesAlta(
      { tipo: d.tipo, nombre: d.nombre, apellido: d.apellido, razonSocial: d.razonSocial, whatsapp: d.whatsapp, extra: d.extra },
      niveles
    ),
    d
  );
  if (falt) return { error: falt };

  // Un duplicado no es un error: se ofrece usar el que ya existe.
  const dup = await buscarDuplicado({ modulo: d.modulo, whatsapp: d.whatsapp, documento: d.extra.documento });
  if (dup.error) return { error: dup.error };
  if (dup.porDocumento) return { duplicado: { por: "documento", contacto: dup.porDocumento } };
  if (dup.porWhatsapp) return { duplicado: { por: "whatsapp", contacto: dup.porWhatsapp } };

  const base =
    d.tipo === "organizacion"
      ? { tipo: "organizacion", razon_social: d.razonSocial.trim(), nombre: null, apellido: null }
      : { tipo: "persona", nombre: d.nombre.trim(), apellido: d.apellido.trim() || null, razon_social: null };
  const { data: creado, error } = await a
    .from("contactos")
    .insert({ ...base, whatsapp: normalizarWhatsapp(d.whatsapp), email: d.extra.email?.trim() || null, sexo: d.extra.sexo || null })
    .select(COLUMNAS)
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Ese WhatsApp ya es de otro contacto. Buscalo y usalo." };
    return { error: error.message };
  }
  const fila = creado as FilaContacto;

  // Si lo que sigue falla, el contacto recién creado no tiene nada colgado:
  // se deshace, así reintentar no choca con su propio WhatsApp (los datos
  // extra se guardaban después y dejaban un contacto huérfano).
  const deshacer = async (mensaje: string): Promise<ResultadoCrearContacto> => {
    await a.from("contactos").delete().eq("id", fila.id);
    return { error: mensaje };
  };

  const errExtra = await guardarDatosExtra(fila.id, d.extra);
  if (errExtra.error) return deshacer(errExtra.error);

  if (d.tipo === "organizacion" && d.personaContacto) {
    const r = await vincularPersonaDeContacto(a, fila.id, d.personaContacto);
    if (r.error) return deshacer(r.error);
  }

  if (d.rol === "alumno") {
    const r = await asegurarRolAlumno(fila.id);
    if (r.error) return deshacer(r.error);
  }

  return { contacto: (await resumir(a, [fila]))[0] };
}

/** Une una persona (existente o nueva) a la organización con la relación «trabaja en». */
async function vincularPersonaDeContacto(
  a: Admin,
  organizacionId: number,
  persona: { contactoId: number } | { nombre: string; whatsapp: string }
): Promise<{ error?: string }> {
  let personaId: number;
  if ("contactoId" in persona) {
    personaId = persona.contactoId;
  } else {
    const wa = normalizarWhatsapp(persona.whatsapp);
    if (!persona.nombre.trim() || soloDigitos(persona.whatsapp).length < 6)
      return { error: "La persona de contacto necesita nombre y WhatsApp." };
    const { data: ya } = wa ? await a.from("contactos").select("id").eq("whatsapp", wa).maybeSingle() : { data: null };
    if (ya) {
      personaId = (ya as { id: number }).id;
    } else {
      const { data, error } = await a
        .from("contactos")
        .insert({ tipo: "persona", nombre: persona.nombre.trim(), whatsapp: wa })
        .select("id")
        .single();
      if (error) return { error: `No se pudo crear la persona de contacto: ${error.message}` };
      personaId = (data as { id: number }).id;
    }
  }
  const { error } = await a
    .from("contacto_relaciones")
    .upsert(
      { desde_id: personaId, hacia_id: organizacionId, tipo: "trabaja_en" },
      { onConflict: "desde_id,hacia_id,tipo", ignoreDuplicates: true }
    );
  return error ? { error: error.message } : {};
}

// ── Detalle (la tarjeta del titular) ─────────────────────────────────────

export type DetalleContactoVenta = {
  resumen: ContactoResumen;
  nombre: string | null;
  apellido: string | null;
  razonSocial: string | null;
  redes: ContactoRed[];
  consentimiento: ConsentimientoVigente | null;
  /** Lo que el formulario de edición necesita para arrancar con los valores de hoy. */
  extra: DatosContactoExtra;
  /** Persona que atiende por una organización (la más reciente), si la hay. */
  personaContacto: ContactoResumen | null;
  /** Si el WhatsApp de la venta se puede ofrecer, y si no, por qué. */
  avisoWhatsapp: { ok: boolean; motivo: string | null };
  puedeEditar: boolean;
};

export async function detalleContactoVenta(
  contactoId: number,
  modulo: ModuloClave
): Promise<{ detalle?: DetalleContactoVenta; error?: string }> {
  if (!(await habilitado(modulo, "crear")) && !(await habilitado(modulo, "ver")))
    return { error: "No tenés permiso para ver este contacto." };
  const a = admin();
  const { data: fila, error } = await a.from("contactos").select(`${COLUMNAS}, email, sexo`).eq("id", contactoId).maybeSingle();
  if (error) return { error: `No se pudo leer el contacto: ${error.message}` };
  if (!fila) return { error: "El contacto ya no existe." };
  const c = fila as FilaContacto & { email: string | null; sexo: string | null };
  const puedeVerPrivados = await tienePermiso("contactos_privados", "ver");

  const [resumen, { data: redes }, { data: consentimiento }, { data: rel }, { data: privados }] = await Promise.all([
    resumir(a, [c]),
    a.from("contacto_redes").select("*").eq("contacto_id", contactoId),
    a
      .from("consentimientos_vigentes")
      .select("*")
      .eq("contacto_id", contactoId)
      .eq("finalidad", "contacto")
      .maybeSingle(),
    c.tipo === "organizacion"
      ? a.from("contacto_relaciones").select("desde_id").eq("hacia_id", contactoId).eq("tipo", "trabaja_en").order("creado_en", { ascending: false }).limit(1)
      : Promise.resolve({ data: null }),
    puedeVerPrivados
      ? a.from("contactos_privados").select("*").eq("contacto_id", contactoId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const priv = privados as {
    tipo_documento: string | null;
    numero: string | null;
    complemento: string | null;
    expedido: string | null;
    fecha_nacimiento: string | null;
  } | null;
  const vigente = (consentimiento as ConsentimientoVigente) ?? null;

  let personaContacto: ContactoResumen | null = null;
  const desde = (rel as { desde_id: number }[] | null)?.[0]?.desde_id;
  if (desde) {
    const { data: p } = await a.from("contactos").select(COLUMNAS).eq("id", desde).maybeSingle();
    if (p) personaContacto = (await resumir(a, [p as FilaContacto]))[0] ?? null;
  }

  // A quién le llega el aviso: a la persona de contacto si la organización la tiene.
  const destino = personaContacto ?? resumen[0];
  let avisoWhatsapp: { ok: boolean; motivo: string | null } = { ok: true, motivo: null };
  if (destino.noContactar)
    avisoWhatsapp = { ok: false, motivo: `${destino.nombre} pidió no ser contactado: el WhatsApp no se ofrece y no se le manda ningún aviso de esta operación.` };
  else if (!urlChatWhatsapp(destino.whatsapp))
    avisoWhatsapp = {
      ok: false,
      motivo: destino.whatsapp
        ? `El WhatsApp de ${destino.nombre} no está en formato internacional (+591…): corregilo para poder abrir el chat.`
        : `${destino.nombre} no tiene WhatsApp cargado.`,
    };

  return {
    detalle: {
      resumen: resumen[0],
      nombre: c.nombre,
      apellido: c.apellido,
      razonSocial: c.razon_social,
      redes: (redes as ContactoRed[]) ?? [],
      consentimiento: vigente,
      extra: {
        email: c.email,
        sexo: c.sexo,
        redes: ((redes as ContactoRed[]) ?? []).map((r) => ({ red: r.red, usuario: r.usuario })),
        documento: priv?.numero
          ? { tipo_documento: priv.tipo_documento ?? "", numero: priv.numero, complemento: priv.complemento, expedido: priv.expedido }
          : null,
        fecha_nacimiento: priv?.fecha_nacimiento ?? null,
        consentimiento: vigente ? { otorgado: vigente.otorgado, medio: vigente.medio } : null,
      },
      personaContacto,
      avisoWhatsapp,
      puedeEditar: await tienePermiso("contactos", "editar"),
    },
  };
}

// ── Editar ────────────────────────────────────────────────────────────────

/** El contexto de la matriz que gobierna a un contacto ya existente, según los roles que tiene. */
async function contextoDeContacto(a: Admin, c: FilaContacto): Promise<ContextoMinimo> {
  if (c.tipo === "organizacion") return "tercero_org";
  const [{ data: al }, { data: pro }] = await Promise.all([
    a.from("alumnos").select("es_menor").eq("contacto_id", c.id).maybeSingle(),
    a.from("profesores").select("id").eq("contacto_id", c.id).maybeSingle(),
  ]);
  if (al) return (al as { es_menor: boolean }).es_menor ? "alumno_menor" : "alumno_adulto";
  if (pro) return "profesor";
  return "tercero_persona";
}

/**
 * Actualiza la identidad compartida de un contacto (nombre, WhatsApp,
 * documento, redes, consentimiento) desde una venta. La identidad es una
 * sola (regla 21), así que editarla exige el permiso del módulo `contactos`,
 * sea cual sea el flujo desde el que se entró.
 */
export async function actualizarContactoVenta(d: {
  modulo: ModuloClave;
  contactoId: number;
  nombre: string;
  apellido: string;
  razonSocial: string;
  whatsapp: string;
  extra: DatosContactoExtra;
}): Promise<ResultadoCrearContacto> {
  if (!(await tienePermiso("contactos", "editar"))) return { error: "No tenés permiso para editar contactos." };
  const a = admin();
  const { data: fila, error: errLeer } = await a.from("contactos").select(COLUMNAS).eq("id", d.contactoId).maybeSingle();
  if (errLeer) return { error: errLeer.message };
  if (!fila) return { error: "El contacto ya no existe." };
  const c = fila as FilaContacto;

  const { matriz, error: errMatriz } = await leerMatriz(a);
  if (errMatriz || !matriz) return { error: errMatriz };
  const niveles = nivelesDe(matriz, await contextoDeContacto(a, c));
  const falt = textoFaltaAlta(
    faltantesAlta(
      { tipo: c.tipo, nombre: d.nombre, apellido: d.apellido, razonSocial: d.razonSocial, whatsapp: d.whatsapp, extra: d.extra },
      niveles
    ),
    c
  );
  if (falt) return { error: falt };

  const dup = await buscarDuplicado({ modulo: d.modulo, whatsapp: d.whatsapp, documento: d.extra.documento, excluirId: d.contactoId });
  if (dup.error) return { error: dup.error };
  if (dup.porDocumento) return { duplicado: { por: "documento", contacto: dup.porDocumento } };
  if (dup.porWhatsapp) return { duplicado: { por: "whatsapp", contacto: dup.porWhatsapp } };

  const cambios =
    c.tipo === "organizacion"
      ? { razon_social: d.razonSocial.trim() }
      : { nombre: d.nombre.trim(), apellido: d.apellido.trim() || null };
  const { error } = await a
    .from("contactos")
    .update({
      ...cambios,
      whatsapp: normalizarWhatsapp(d.whatsapp),
      email: d.extra.email?.trim() || null,
      sexo: d.extra.sexo || null,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", d.contactoId);
  if (error) {
    if (error.code === "23505") return { error: "Ese WhatsApp ya es de otro contacto." };
    return { error: error.message };
  }
  const errExtra = await guardarDatosExtra(d.contactoId, d.extra);
  if (errExtra.error) return { error: errExtra.error };

  const { data: nueva } = await a.from("contactos").select(COLUMNAS).eq("id", d.contactoId).maybeSingle();
  return { contacto: nueva ? (await resumir(a, [nueva as FilaContacto]))[0] : undefined };
}
