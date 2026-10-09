import { createClient } from "@supabase/supabase-js";

/**
 * Una particular de prueba para los e2e de reservas: su propio contacto, alumno,
 * membresía, salas y cuota (2 h por defecto, 60 días desde hoy), copiados de una particular
 * activa de dev que solo se LEE como modelo. Los e2e nunca tocan una membresía
 * real. Solo contra dev y con la llave de servicio.
 *
 * Borrado: `reservas_historial` es de solo agregar (migración 0054; ni el borrado
 * en cascada pasa), así que una membresía que tuvo reservas no se puede borrar
 * desde la API. `retirarMembresiaDePrueba` borra lo que sí se puede y deja el
 * resto marcado (contacto «E2E-PRUEBA», membresía en baja, reservas en
 * «reagendar»); el barrido completo se hace con SQL en dev (ver el informe).
 */

const DEV = "hyhijzuomqpylcmrzdvw";
export const MARCA_PRUEBA = "E2E-PRUEBA";

const cliente = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!llave || !url.includes(DEV)) throw new Error("La membresía de prueba se crea solo contra dev y con la llave de servicio.");
  return createClient(url, llave, { auth: { persistSession: false } });
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const enDias = (n: number) => new Date(Date.now() + n * 86_400_000);

export type MembresiaDePrueba = { membresiaId: number; contactoId: number; alumnoId: number };

export async function crearMembresiaDePrueba(horas = 2): Promise<MembresiaDePrueba | null> {
  const sb = cliente();
  const { data: modelo, error } = await sb
    .from("membresias")
    .select("*")
    .is("curso_id", null)
    .eq("estado", "activa")
    .eq("es_cortesia", false)
    .not("horas_contratadas", "is", null)
    .not("plan_id", "is", null)
    .not("profesor_id", "is", null)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la particular modelo: ${error.message}`);
  if (!modelo) return null;

  const c = await sb.from("contactos").insert({ tipo: "persona", nombre: MARCA_PRUEBA, apellido: `Prueba ${Date.now()}` }).select("id").single();
  if (c.error) throw new Error(`No se pudo crear el contacto de prueba: ${c.error.message}`);
  const al = await sb.from("alumnos").insert({ contacto_id: c.data.id, es_menor: false }).select("id").single();
  if (al.error) throw new Error(`No se pudo crear el alumno de prueba: ${al.error.message}`);

  const { id: _id, creado_en: _c, actualizado_en: _a, ...resto } = modelo as Record<string, unknown>;
  const m = await sb
    .from("membresias")
    .insert({
      ...resto,
      alumno_id: al.data.id,
      contacto_id: c.data.id,
      estado: "activa",
      fecha_inicio: iso(enDias(-1)),
      fecha_fin: iso(enDias(60)),
      horas_contratadas: horas,
      membresia_anterior_id: null,
    })
    .select("id")
    .single();
  if (m.error) throw new Error(`No se pudo crear la membresía de prueba: ${m.error.message}`);

  const salas = await sb.from("membresia_salas").select("sala_id, nombre_descriptivo").eq("membresia_id", modelo.id);
  if (salas.error) throw new Error(salas.error.message);
  if (salas.data.length) {
    const r = await sb.from("membresia_salas").insert(salas.data.map((s) => ({ ...s, membresia_id: m.data.id })));
    if (r.error) throw new Error(`No se pudieron copiar las salas: ${r.error.message}`);
  }
  const q = await sb.from("cuotas").insert({
    membresia_id: m.data.id,
    periodo: iso(enDias(-1)).slice(0, 8) + "01",
    monto_devengado: 480,
    descuento_adelanto: 0,
    vencimiento: iso(enDias(30)),
    estado: "pendiente",
  });
  if (q.error) throw new Error(`No se pudo crear la cuota de prueba: ${q.error.message}`);
  return { membresiaId: m.data.id, contactoId: c.data.id, alumnoId: al.data.id };
}

/** Deja la membresía de prueba fuera de circulación y borra lo que la base permite borrar. */
export async function retirarMembresiaDePrueba(p: MembresiaDePrueba | null) {
  if (!p) return;
  const sb = cliente();
  // Con reservas, el historial de solo agregar impide borrarlas: la membresía queda marcada y sin saldo ocupado.
  const reservas = await sb.from("reservas_sala").delete().eq("membresia_id", p.membresiaId);
  if (reservas.error) {
    await sb.from("reservas_sala").update({ estado: "reagendar", solicitada_hasta: null }).eq("membresia_id", p.membresiaId).neq("estado", "reagendar");
    await sb.from("membresias").update({ estado: "baja" }).eq("id", p.membresiaId);
    return;
  }
  await sb.from("cuotas").delete().eq("membresia_id", p.membresiaId);
  await sb.from("membresia_salas").delete().eq("membresia_id", p.membresiaId);
  const borrada = await sb.from("membresias").delete().eq("id", p.membresiaId);
  if (borrada.error) {
    await sb.from("membresias").update({ estado: "baja" }).eq("id", p.membresiaId);
    return;
  }
  await sb.from("alumnos").delete().eq("id", p.alumnoId);
  await sb.from("contactos").delete().eq("id", p.contactoId);
}
