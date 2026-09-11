-- =====================================================================
-- TROPICANA - control de las migraciones 0016 y 0017
-- ---------------------------------------------------------------------
-- Solo LEE: no modifica nada. Se puede correr en dev o en produccion,
-- antes y despues de aplicar las migraciones, para comparar.
--
-- Pegar en el SQL Editor de Supabase del proyecto que se quiera revisar.
-- Todos los controles tienen que dar 0 / OK despues de 0016 y 0017.
--
-- Solo ASCII.
-- =====================================================================

select control, valor, case when ok then 'OK' else 'REVISAR' end as resultado from (
  -- 0016: la fecha de fin es lo que habilita liquidar la membresia.
  select 1 as n, 'Membresias de plan sin fecha de fin' as control,
         count(*)::text as valor, count(*) = 0 as ok
    from inscripciones where plan_id is not null and fecha_fin is null
  union all
  -- 0016: un ciclo no puede terminar antes de empezar.
  select 2, 'Ciclos que terminan antes de empezar',
         count(*)::text, count(*) = 0
    from inscripciones where fecha_fin is not null and fecha_fin < fecha_inicio
  union all
  -- 0016: el contador "X de N" tiene que coincidir con las presencias reales.
  select 3, 'Contadores de clases desactualizados',
         count(*)::text, count(*) = 0
    from inscripciones i where i.clases_plan is not null and i.estado <> 'baja'
      and i.clases_hechas <> (select count(*) from asistencias a join sesiones s on s.id = a.sesion_id
                               where a.inscripcion_id = i.id and a.estado = 'presente' and s.estado = 'dictada')
  union all
  -- Politica de tolerancia: una falta sin licencia deja el ciclo sin bono.
  select 4, 'Bono acreditado pese a tener falta sin licencia',
         count(*)::text, count(*) = 0
    from inscripciones i where i.bono_generado > 0
      and exists (select 1 from asistencias a join sesiones s on s.id = a.sesion_id
                   where a.inscripcion_id = i.id and a.estado = 'ausente'
                     and not a.con_licencia and s.estado = 'dictada')
  union all
  -- 0017: nada de plata cobrada fuera de una cuota.
  select 5, 'Cobros sin cuota (plata colgada)',
         count(*)::text, count(*) = 0
    from pagos where tipo = 'cobro' and cuota_id is null and inscripcion_id is not null
  union all
  -- 0017: todo lo vendido tiene su cuota.
  select 6, 'Membresias sin ninguna cuota',
         count(*)::text, count(*) = 0
    from inscripciones i where i.estado <> 'baja'
      and not exists (select 1 from cuotas cu where cu.inscripcion_id = i.id)
  union all
  -- 0017: el estado de la cuota refleja lo efectivamente cobrado.
  select 7, 'Estado de cuota que no coincide con lo cobrado',
         count(*)::text, count(*) = 0
    from cuotas cu where cu.estado <> (
      case when greatest(0, cu.monto_devengado - cu.descuento_adelanto) = 0
                or coalesce((select sum(p.monto + p.descuento) from pagos p
                              where p.cuota_id = cu.id and p.tipo = 'cobro'), 0)
                   >= greatest(0, cu.monto_devengado - cu.descuento_adelanto) then 'pagada'
           when coalesce((select sum(p.monto + p.descuento) from pagos p
                           where p.cuota_id = cu.id and p.tipo = 'cobro'), 0) > 0 then 'parcial'
           else 'pendiente' end)
  union all
  -- Regla base del modelo: una membresia se cierra cuando el ciclo se agoto Y
  -- esta cobrada. Agotada con saldo sigue 'activa'; sin agotar no puede estar
  -- 'completada'. No aplica a las ilimitadas (cierran por fecha, no por conteo).
  select 8, 'Membresias cuyo estado no sigue la regla (agotada + cobrada)',
         count(*)::text, count(*) = 0
    from (
      select i.id, i.estado,
             case when case when i.clases_plan is not null
                            then (select count(*) from asistencias a join sesiones s on s.id = a.sesion_id
                                   where a.inscripcion_id = i.id and s.estado = 'dictada') >= i.clases_plan
                            else (select count(*) from asistencias a join sesiones s on s.id = a.sesion_id
                                   where a.inscripcion_id = i.id and a.estado = 'presente'
                                     and s.estado = 'dictada') >= i.clases_total end
                       and coalesce((select sum(greatest(0, cu.monto_devengado - cu.descuento_adelanto
                              - coalesce((select sum(p.monto + p.descuento) from pagos p
                                           where p.cuota_id = cu.id and p.tipo = 'cobro'), 0)))
                             from cuotas cu where cu.inscripcion_id = i.id), 0) <= 0
                  then 'completada' else 'activa' end as objetivo
        from inscripciones i
       where i.estado <> 'baja'
         and (i.clases_plan is not null or i.clases_total is not null)
    ) r where r.estado <> r.objetivo
) t order by n;

-- ---------------------------------------------------------------------
-- 9. FIN DE CICLO COHERENTE CON LAS SUSPENSIONES
--    El fin de ciclo es la fecha de la clase N contando solo las clases que
--    de verdad ocurren: una sesion suspendida no consume ciclo, lo corre.
--    Este control es el que habria detectado el caso Yubinka/Vivancos: una
--    membresia vendida con fecha retroactiva sobre una clase ya suspendida
--    se quedaba con el fin de ciclo proyectado por calendario.
-- ---------------------------------------------------------------------
with base as (
  select i.id, i.fecha_inicio, i.clases_plan, i.fecha_fin
    from inscripciones i
   where i.estado <> 'baja' and i.clases_plan is not null and i.fecha_inicio is not null
),
clases as (
  select b.id as inscripcion_id, d::date as fecha,
         row_number() over (partition by b.id order by d, ic.curso_id) as k
    from base b
    join inscripcion_cursos ic on ic.inscripcion_id = b.id
    join lateral generate_series(b.fecha_inicio, b.fecha_inicio + 400, interval '1 day') d on true
   where extract(isodow from d)::int = any(ic.dias)
     and not exists (select 1 from sesiones s
                      where s.curso_id = ic.curso_id and s.fecha = d::date
                        and s.estado = 'suspendida')
)
select '9. fin de ciclo vs suspensiones' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from base b
  join clases c on c.inscripcion_id = b.id and c.k = b.clases_plan
 where b.fecha_fin is distinct from c.fecha;

-- ---------------------------------------------------------------------
-- 10. SUSPENSIONES SIN TRAZA DE CORRIMIENTO
--     Toda clase suspendida dentro del periodo de una membresia con plan
--     tiene que haber dejado su fila en corrimientos_ciclo. Si falta, la
--     membresia se vendio despues de la suspension (venta retroactiva) y
--     nadie relleno la traza.
-- ---------------------------------------------------------------------
select '10. suspensiones sin corrimiento' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from inscripciones i
  join inscripcion_cursos ic on ic.inscripcion_id = i.id
  join sesiones s on s.curso_id = ic.curso_id and s.estado = 'suspendida'
       and s.fecha >= i.fecha_inicio and (i.fecha_fin is null or s.fecha <= i.fecha_fin)
 where i.estado <> 'baja' and i.clases_plan is not null
   and not exists (select 1 from corrimientos_ciclo cc
                    where cc.inscripcion_id = i.id and cc.sesion_id = s.id);

-- ---------------------------------------------------------------------
-- 11. MEMBRESIA DE PLAN SIN SUS CURSOS DECLARADOS
--     El padron resuelve quien toma cada curso por inscripcion_cursos, no
--     por inscripciones.curso_id (que es solo el curso principal de la
--     venta). Si una membresia de plan no tiene una fila por cada curso al
--     que el plan le da acceso, el alumno queda INVISIBLE en el padron de
--     los cursos que faltan, sin ningun sintoma: simplemente no esta en la
--     lista. Cuenta las membresias vivas a las que les falta alguna.
-- ---------------------------------------------------------------------
with acceso as (
  -- Cursos a los que cada plan da acceso, segun su modo.
  select p.id as plan_id, c.id as curso_id
    from planes p
    join cursos c on c.activo
   where (p.acceso_modo = 'todas')
      or (p.acceso_modo = 'solo'
          and exists (select 1 from plan_cursos pc
                       where pc.plan_id = p.id and pc.curso_id = c.id))
      or (p.acceso_modo = 'excepto'
          and not exists (select 1 from plan_cursos pc
                           where pc.plan_id = p.id and pc.curso_id = c.id))
)
select '11. membresias sin sus cursos declarados' as control,
       count(distinct i.id) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from inscripciones i
  join acceso a on a.plan_id = i.plan_id
 where i.estado <> 'baja'
   and i.plan_id is not null
   -- Solo las que ya usan el mecanismo: las de legado no tienen ninguna fila
   -- y el padron las resuelve por curso_id, como siempre.
   and exists (select 1 from inscripcion_cursos ic where ic.inscripcion_id = i.id)
   -- Una prueba elige sus cursos al comprar: no toma todos los del plan.
   -- Se lee via to_jsonb para que el script corra tambien contra una base
   -- que todavia no tiene la columna (0023 no aplicada): ahi no hay pruebas,
   -- asi que el filtro simplemente no excluye nada.
   and coalesce((to_jsonb(i) ->> 'es_prueba')::boolean, false) = false
   and not exists (select 1 from inscripcion_cursos ic
                    where ic.inscripcion_id = i.id and ic.curso_id = a.curso_id);

-- ---------------------------------------------------------------------
-- 12. ASISTENCIA EN UN CURSO QUE LA MEMBRESIA NO TOMA
--     Al reves del 11: si hay una asistencia cargada contra un curso que
--     la membresia no declara, o en un dia que el alumno no eligio, el
--     padron listo a alguien que no correspondia.
-- ---------------------------------------------------------------------
select '12. asistencias fuera de los cursos de la membresia' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from asistencias asi
  join sesiones s on s.id = asi.sesion_id
  join inscripciones i on i.id = asi.inscripcion_id
 where i.plan_id is not null
   and exists (select 1 from inscripcion_cursos ic where ic.inscripcion_id = i.id)
   and not exists (select 1 from inscripcion_cursos ic
                    where ic.inscripcion_id = i.id
                      and ic.curso_id = s.curso_id
                      and (ic.dias is null or array_length(ic.dias, 1) is null
                           or extract(isodow from s.fecha)::int = any(ic.dias)));

-- ---------------------------------------------------------------------
-- Detalle, por si algun control da REVISAR:
-- ---------------------------------------------------------------------
-- select id, alumno_id, curso_id, estado, fecha_inicio, fecha_fin,
--        clases_plan, clases_hechas, bono_generado
--   from inscripciones where plan_id is not null order by id;
--
-- select cu.id, cu.inscripcion_id, cu.periodo, cu.monto_devengado, cu.estado,
--        coalesce((select sum(p.monto) from pagos p where p.cuota_id = cu.id and p.tipo='cobro'), 0) as cobrado
--   from cuotas cu order by cu.inscripcion_id;
