-- =====================================================================
-- TROPICANA - 0018: cerrar los paquetes por clase ya consumidos
-- ---------------------------------------------------------------------
-- Idempotente: correrla dos veces no cambia nada. Solo ASCII.
--
-- POR QUE (criterio de Javier, 2026-09-10)
-- ----------------------------------------
-- "Las tres de Zumba deberian quedar completadas." Una venta por clase que ya
-- se uso no sigue vigente: su ciclo termino. Hasta ahora el motor solo cerraba
-- las membresias de PLAN (`recalcularMembresia` se salteaba las que no tienen
-- plan), asi que los paquetes por clase quedaban 'activa' para siempre aunque
-- el alumno ya hubiera usado todas sus clases.
--
-- Estado medido el 2026-09-10 (mismas 3 filas en las dos bases, Zumba 08/09):
--   * produccion: ya estaban en 'completada' -- alguien las cerro a mano ese
--     dia a las 08:43 UTC (era el "hallazgo abierto" de §0ter del ESTADO);
--   * dev: seguian en 'activa'.
--   * en las dos, `clases_hechas` en 0 pese a tener la clase asistida.
-- Esta migracion deja las dos bases iguales y con el contador correcto.
--
-- QUE HACE
-- --------
-- Para cada membresia SIN plan que tenga `clases_total` (paquete por clase) y
-- no este de baja: pone `clases_hechas` = presencias en sesiones DICTADAS, y
-- marca 'completada' si ya consumio las clases compradas. Solo la asistencia
-- consume paquete: una falta no lo gasta, el alumno conserva su clase.
--
-- El codigo hace lo mismo de ahora en mas al guardar asistencia
-- (`recalcularMembresia`), asi que esto no vuelve a acumularse.
-- =====================================================================

with presencias as (
  select i.id,
         count(*) filter (where a.estado = 'presente') as presentes
    from public.inscripciones i
    left join public.asistencias a on a.inscripcion_id = i.id
    left join public.sesiones s on s.id = a.sesion_id and s.estado = 'dictada'
   where i.plan_id is null
     and i.clases_total is not null
     and i.estado <> 'baja'
     and (a.id is null or s.id is not null)
   group by i.id
)
update public.inscripciones i
   set clases_hechas = p.presentes,
       estado = case when p.presentes >= i.clases_total then 'completada' else 'activa' end,
       actualizado_en = now()
  from presencias p
 where i.id = p.id
   and (i.clases_hechas is distinct from p.presentes
     or i.estado is distinct from (case when p.presentes >= i.clases_total then 'completada' else 'activa' end));

-- ── Control posterior ────────────────────────────────────────────────
do $$
declare
  v_mal int;
begin
  select count(*) into v_mal
    from public.inscripciones i
   where i.plan_id is null and i.clases_total is not null and i.estado <> 'baja'
     and i.estado <> (case when (select count(*) from public.asistencias a
                                  join public.sesiones s on s.id = a.sesion_id
                                 where a.inscripcion_id = i.id and a.estado = 'presente'
                                   and s.estado = 'dictada') >= i.clases_total
                           then 'completada' else 'activa' end);
  raise notice 'Paquetes por clase con estado incorrecto: % (deberia ser 0)', v_mal;
end $$;
