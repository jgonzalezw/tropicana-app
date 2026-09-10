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
-- Detalle, por si algun control da REVISAR:
-- ---------------------------------------------------------------------
-- select id, alumno_id, curso_id, estado, fecha_inicio, fecha_fin,
--        clases_plan, clases_hechas, bono_generado
--   from inscripciones where plan_id is not null order by id;
--
-- select cu.id, cu.inscripcion_id, cu.periodo, cu.monto_devengado, cu.estado,
--        coalesce((select sum(p.monto) from pagos p where p.cuota_id = cu.id and p.tipo='cobro'), 0) as cobrado
--   from cuotas cu order by cu.inscripcion_id;
