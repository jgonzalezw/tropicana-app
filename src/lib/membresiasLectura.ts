import type { createClient } from "@/lib/supabase/server";
import { exigir } from "@/lib/datos";
import { armarMembresiasCuenta, type FilaParaCuenta, type PagoCobroCrudo } from "@/lib/cuentas";
import { leerAvancesAlCorte } from "@/lib/liquidacion/lecturaAvance";
import { nombreCompleto } from "@/lib/contactos";
import { solicitudVigente } from "@/lib/reservas";
import type { MembresiaCuenta } from "@/lib/tipos";
import {
  banderas,
  chipEstado,
  siguienteCiclo,
  tipoDeMembresia,
  usoDelCiclo,
  type EntradaCiclo,
  type FilaMembresia,
  type TipoMembresia,
} from "@/lib/listaMembresias";

/**
 * La lectura de la lista y la ficha unificadas (I-012, fase 0). Solo lee: no
 * cambia ningún dato. Todo fallo de lectura se muestra (`exigir`, calidad 1):
 * una membresía que no se pudo leer no se disfraza de «no hay».
 *
 * Reutiliza lo que ya existe en vez de calcular de nuevo:
 * - la cuenta (cuotas, saldo, bonos, cursos, horas) sale de
 *   `armarMembresiasCuenta`, la misma pieza de la cuenta del alumno;
 * - el avance de las clases, de `leerAvancesAlCorte` (la regla de Asistencia).
 *
 * No es "use server": el permiso y el alcance los resuelve la acción que lo
 * llama (`membresias/acciones.ts`), que decide qué tipos entran acá.
 */

type Lector = Awaited<ReturnType<typeof createClient>>;

export type AccesoMembresias = {
  /** Cliente de la sesión: regulares, pruebas y particulares. */
  sb: Lector;
  /** Cliente admin: solo para alquileres, cuyo titular puede ser un contacto que el rol no ve. */
  admin: Lector | null;
  /** Tipos que el rol puede ver (la acción ya validó el permiso de cada uno). */
  tipos: ReadonlySet<TipoMembresia>;
  /** Si el rol ve solo lo propio en particulares: el profesor. */
  profesorIdPropio: number | null;
};

export type ExtensionMembresia = {
  fecha: string;
  horas: number;
  precioTotal: number;
  modoPrecio: string;
};

export type FichaMembresia = {
  fila: FilaMembresia;
  /** La cuenta de esta membresía: cuotas, saldo, cursos con días, faltas, bonos, horas. */
  cuenta: MembresiaCuenta;
  ciclo: { anteriorId: number | null; siguienteId: number | null };
  /** Vacío hasta que exista `membresia_extensiones` (H6). */
  extensiones: ExtensionMembresia[];
};

type Contacto = { tipo: "persona" | "organizacion"; nombre: string | null; apellido: string | null; razon_social: string | null; whatsapp: string | null };

type FilaBase = FilaParaCuenta & {
  es_prueba: boolean;
  categoria_aplicada: string | null;
  alumno_id: number | null;
  contacto_id: number | null;
  plan_id: number | null;
  membresia_anterior_id: number | null;
  ciclo_numero: number | null;
  profesor_id: number | null;
  alumno: { es_menor: boolean; contacto_id: number; contacto: Contacto | null } | null;
  titular: Contacto | null;
};

const SELECT =
  "id, estado, es_prueba, curso_id, categoria_aplicada, alumno_id, contacto_id, plan_id, membresia_anterior_id, ciclo_numero, " +
  "fecha_inicio, fecha_fin, clases_plan, clases_total, horas_contratadas, profesor_id, " +
  "alumno:alumnos(es_menor, contacto_id, contacto:contactos(tipo, nombre, apellido, razon_social, whatsapp)), " +
  "titular:contactos(tipo, nombre, apellido, razon_social, whatsapp), " +
  "profesor:profesores(contacto:contactos(nombre, apellido)), " +
  "plan:planes(nombre, estilo), curso:cursos(nombre, dias_semana)";

const tipoDe = (r: FilaBase) =>
  tipoDeMembresia({ esPrueba: r.es_prueba, cursoId: r.curso_id, categoriaAplicada: r.categoria_aplicada });

const entradaCiclo = (r: FilaBase): EntradaCiclo => ({
  id: r.id,
  esPrueba: r.es_prueba,
  cursoId: r.curso_id,
  categoriaAplicada: r.categoria_aplicada,
  alumnoId: r.alumno_id,
  contactoId: r.contacto_id,
  planId: r.plan_id,
  anteriorId: r.membresia_anterior_id,
  fechaInicio: r.fecha_inicio,
});

/** Todas las membresías que este acceso puede ver, sin enriquecer (una consulta por lector). */
async function leerBase(a: AccesoMembresias): Promise<{ r: FilaBase; lector: Lector }[]> {
  const grupos: { lector: Lector; alquiler: boolean }[] = [];
  if ([...a.tipos].some((t) => t !== "alquiler")) grupos.push({ lector: a.sb, alquiler: false });
  if (a.tipos.has("alquiler")) {
    if (!a.admin) throw new Error("No se pudo leer los alquileres: falta la clave de servicio.");
    grupos.push({ lector: a.admin, alquiler: true });
  }

  const out: { r: FilaBase; lector: Lector }[] = [];
  for (const g of grupos) {
    let q = g.lector.from("membresias").select(SELECT, { count: "exact" });
    q = g.alquiler ? q.not("categoria_aplicada", "is", null) : q.is("categoria_aplicada", null);
    const raw = await q.order("fecha_inicio", { ascending: false }).order("id", { ascending: false });
    const filas = exigir(raw, "las membresías") as unknown as FilaBase[];
    // El tope de filas de la API corta en silencio: una lista truncada mentiría.
    if (raw.count != null && filas.length < raw.count)
      throw new Error(`No se pudieron cargar las membresías completas (${filas.length} de ${raw.count}).`);
    for (const r of filas) {
      const t = tipoDe(r);
      if (!a.tipos.has(t)) continue;
      if (t === "particular" && a.profesorIdPropio != null && r.profesor_id !== a.profesorIdPropio) continue;
      out.push({ r, lector: g.lector });
    }
  }
  return out;
}

/**
 * Las filas de la lista (o solo la de `id`) con todo lo que la lista y la
 * ficha necesitan. Devuelve también la cuenta de cada una, que la ficha usa.
 */
export async function leerFilasMembresias(
  a: AccesoMembresias,
  id?: number
): Promise<{ filas: FilaMembresia[]; cuentas: Map<number, MembresiaCuenta> }> {
  const base = await leerBase(a);
  const universo = base.map((b) => entradaCiclo(b.r));
  const elegidas = id == null ? base : base.filter((b) => b.r.id === id);

  const filas: FilaMembresia[] = [];
  const cuentas = new Map<number, MembresiaCuenta>();
  const ahora = new Date();

  // Un lote por lector: el de la sesión y, si hay alquileres, el admin.
  for (const lector of new Set(elegidas.map((e) => e.lector))) {
    const grupo = elegidas.filter((e) => e.lector === lector).map((e) => e.r);
    if (!grupo.length) continue;

    const armado = await armarMembresiasCuenta(lector, grupo, async (cuotaIds) => {
      if (!cuotaIds.length) return [];
      const raw = await lector
        .from("pagos")
        .select("id, cuota_id, fecha, monto, descuento, descuento_motivo, medio, motivo")
        .eq("tipo", "cobro")
        .in("cuota_id", cuotaIds);
      return exigir(raw, "los pagos de las membresías") as unknown as PagoCobroCrudo[];
    });
    for (const c of armado.membresias) cuentas.set(c.id, c);

    const conClases = grupo.filter((r) => {
      const t = tipoDe(r);
      return t === "regular" || t === "prueba";
    });
    const avances = await leerAvancesAlCorte(
      lector,
      conClases.map((r) => ({ id: r.id, clases_plan: r.clases_plan, clases_total: r.clases_total })),
      "9999-12-31"
    );

    const conHoras = grupo.filter((r) => tipoDe(r) === "particular" || tipoDe(r) === "alquiler").map((r) => r.id);
    const reservasPorMembresia = new Map<number, { estado: string; solicitadaHasta: string | null }[]>();
    if (conHoras.length) {
      const raw = await lector.from("reservas_sala").select("membresia_id, estado, solicitada_hasta").in("membresia_id", conHoras);
      for (const r of exigir(raw, "las reservas de las membresías") as unknown as {
        membresia_id: number; estado: string; solicitada_hasta: string | null;
      }[]) {
        const l = reservasPorMembresia.get(r.membresia_id) ?? [];
        l.push({ estado: r.estado, solicitadaHasta: r.solicitada_hasta });
        reservasPorMembresia.set(r.membresia_id, l);
      }
    }

    // El buscador ubica a un menor por el WhatsApp de su tutor, como en Alumnos.
    const menores = grupo.filter((r) => r.alumno?.es_menor).map((r) => r.alumno!.contacto_id);
    const tutores = new Map<number, string | null>();
    if (menores.length) {
      const raw = await lector
        .from("contacto_relaciones")
        .select("hacia_id, tutor:contactos!contacto_relaciones_desde_id_fkey(whatsapp)")
        .eq("tipo", "tutor_de")
        .in("hacia_id", menores);
      for (const r of exigir(raw, "los tutores") as unknown as { hacia_id: number; tutor: { whatsapp: string | null } | null }[])
        tutores.set(r.hacia_id, r.tutor?.whatsapp ?? null);
    }

    for (const r of grupo) {
      const tipo = tipoDe(r);
      const cuenta = cuentas.get(r.id)!;
      const siguienteId = siguienteCiclo(entradaCiclo(r), universo);
      const renovada = siguienteId != null;
      const uso = usoDelCiclo({
        tipo,
        avance: avances.get(r.id) ?? null,
        horas: cuenta.horas,
      });
      const reservas = reservasPorMembresia.get(r.id) ?? [];
      const b = banderas({ tipo, estado: r.estado, uso, renovada, saldo: cuenta.saldo, reservas }, ahora);
      const titular = r.alumno?.contacto ?? r.titular;
      const pc = r.profesor?.contacto;
      filas.push({
        id: r.id,
        tipo,
        estado: r.estado,
        chip: chipEstado({ estado: r.estado, renovada, ...b }),
        titular: titular ?? { tipo: "persona", nombre: null, apellido: null, razon_social: null, whatsapp: null },
        titularNombre: nombreCompleto(titular),
        alumnoId: r.alumno_id,
        contactoId: r.contacto_id,
        tutorWhatsapp: r.alumno?.es_menor ? (tutores.get(r.alumno.contacto_id) ?? null) : null,
        planId: r.plan_id,
        planNombre: r.plan?.nombre ?? "—",
        profesorNombre: pc ? `${pc.nombre ?? ""} ${pc.apellido ?? ""}`.trim() || null : null,
        fechaInicio: r.fecha_inicio,
        fechaFin: cuenta.fechaFin,
        cicloNumero: r.ciclo_numero,
        anteriorId: r.membresia_anterior_id,
        siguienteId,
        uso,
        saldo: cuenta.saldo,
        solicitudesVigentes: reservas.filter((x) => x.estado === "solicitada" && solicitudVigente(x.solicitadaHasta, ahora)).length,
        ...b,
      });
    }
  }
  return { filas, cuentas };
}

/** La ficha de una membresía, o `null` si no existe o este acceso no la ve. */
export async function leerFichaMembresia(a: AccesoMembresias, id: number): Promise<FichaMembresia | null> {
  const { filas, cuentas } = await leerFilasMembresias(a, id);
  const fila = filas[0];
  const cuenta = cuentas.get(id);
  if (!fila || !cuenta) return null;
  return {
    fila,
    cuenta,
    ciclo: { anteriorId: fila.anteriorId, siguienteId: fila.siguienteId },
    extensiones: [],
  };
}
