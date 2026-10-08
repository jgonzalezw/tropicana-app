-- =====================================================================
-- TROPICANA - 0066: la liquidacion de un retiro guarda su fecha efectiva
-- ---------------------------------------------------------------------
-- Javier (2026-10-08): a la liquidacion de retiro le falta la fecha "hasta"
-- del calculo, que es la fecha efectiva del retiro (ultimo dia a cargo).
-- Hasta hoy la liquidacion solo guardaba `periodo` (el primer dia del mes) y
-- la fecha de corte quedaba suelta en el texto de cada comision de cierre y en
-- `asignaciones.hasta`.
--
-- `liquidaciones.retiro_hasta`: NULL = liquidacion normal (mes vencido); con
-- fecha = incluye el cierre de un retiro y esa fecha es la efectiva. No toca
-- `periodo` (sigue siendo la llave: una liquidacion por profesor y mes).
-- `retirar_profesor` la escribe con el mismo corte con que cierra las
-- asignaciones, asi que no puede discrepar. Se rellena lo ya retirado desde el
-- "corte dd/mm" que el cierre dejo en `comisiones_devengadas.origen`.
-- =====================================================================

alter table public.liquidaciones add column if not exists retiro_hasta date;

comment on column public.liquidaciones.retiro_hasta is
  'Fecha efectiva del retiro del profesor (ultimo dia a cargo, inclusive) cuando la liquidacion incluye su cierre de cuentas. NULL = liquidacion normal.';

-- Relleno de los retiros ya hechos (antes de esta migracion).
update public.liquidaciones l
   set retiro_hasta = x.corte
  from (
    select d.liquidacion_id,
           max(to_date(substring(d.origen from 'corte ([0-9]{2}/[0-9]{2})') || '/' || extract(year from l2.periodo)::int, 'DD/MM/YYYY')) as corte
      from public.comisiones_devengadas d
      join public.liquidaciones l2 on l2.id = d.liquidacion_id
     where d.tipo = 'cierre' and d.origen ~ 'corte [0-9]{2}/[0-9]{2}'
     group by d.liquidacion_id
  ) x
 where l.id = x.liquidacion_id and l.retiro_hasta is null;

create or replace function public.retirar_profesor(p jsonb)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_prof     bigint := (p->>'profesor_id')::bigint;
  v_corte    date   := (p->>'corte')::date;
  v_periodo  date;
  v_liq      bigint;
  v_item     jsonb;
  v_sust     jsonb;
  v_com      bigint;
  v_n_asig   int := 0;
  v_n_lineas int := 0;
  v_dev      numeric;
  v_pag      numeric;
  v_des      numeric;
  v_neto     numeric;
begin
  if v_prof is null or v_corte is null then
    raise exception 'Faltan el profesor o la fecha de corte.';
  end if;
  v_periodo := date_trunc('month', v_corte)::date;

  -- Un profesor ya inactivo se puede retirar si quedó con asignaciones abiertas
  -- (se lo inactivó antes de que existiera el retiro): ese es justo el caso de I-005.
  if not exists (select 1 from public.profesores where id = v_prof) then
    raise exception 'El profesor no existe.';
  end if;

  -- 1 y 2. Asignaciones y sustitutos.
  for v_item in select * from jsonb_array_elements(coalesce(p->'asignaciones', '[]'::jsonb)) loop
    update public.asignaciones
       set hasta = v_corte
     where id = (v_item->>'id')::bigint
       and profesor_id = v_prof
       and hasta is null
       and desde <= v_corte;
    if not found then
      raise exception 'La asignación % ya no está abierta, no es de este profesor o empieza después del corte.', v_item->>'id';
    end if;
    v_n_asig := v_n_asig + 1;

    v_sust := v_item->'sustituto';
    if v_sust is not null and jsonb_typeof(v_sust) = 'object' then
      if (v_sust->>'profesor_id')::bigint = v_prof then
        raise exception 'El sustituto no puede ser el mismo profesor.';
      end if;
      insert into public.asignaciones (curso_id, profesor_id, pct_ingresos, pct_referido, desde)
      values ((v_item->>'curso_id')::bigint, (v_sust->>'profesor_id')::bigint,
              (v_sust->>'pct_ingresos')::numeric, coalesce((v_sust->>'pct_referido')::numeric, 0),
              v_corte + 1);
    end if;
  end loop;

  -- 3. El cierre de cuentas.
  if jsonb_array_length(coalesce(p->'lineas', '[]'::jsonb)) > 0 then
    select id into v_liq
      from public.liquidaciones
     where profesor_id = v_prof and periodo = v_periodo and periodicidad = 'mes';
    if v_liq is null then
      insert into public.liquidaciones (profesor_id, periodo, periodicidad, estado)
      values (v_prof, v_periodo, 'mes', 'abierta')
      returning id into v_liq;
    end if;

    for v_item in select * from jsonb_array_elements(p->'lineas') loop
      insert into public.comisiones_devengadas
        (profesor_id, plan_id, membresia_id, curso_id, criterio, periodo, tipo, base, monto,
         reparto, detalle_particular, origen, liquidacion_id)
      values
        (v_prof, nullif(v_item->>'plan_id', '')::bigint, (v_item->>'membresia_id')::bigint,
         nullif(v_item->>'curso_id', '')::bigint, coalesce((v_item->>'criterio')::int, 2), v_periodo,
         'cierre', (v_item->>'base')::numeric, (v_item->>'monto')::numeric,
         case when jsonb_typeof(v_item->'reparto') = 'array' then v_item->'reparto' end,
         case when jsonb_typeof(v_item->'detalle_particular') = 'object' then v_item->'detalle_particular' end,
         v_item->>'origen', v_liq)
      returning id into v_com;

      insert into public.liquidacion_items (liquidacion_id, comision_id, membresia_id, descripcion, monto)
      values (v_liq, v_com, (v_item->>'membresia_id')::bigint, v_item->>'descripcion', (v_item->>'monto')::numeric);
      v_n_lineas := v_n_lineas + 1;
    end loop;

    -- Mismos totales que `recomputarTotales` de la aplicación.
    select coalesce(sum(monto), 0) into v_dev from public.liquidacion_items where liquidacion_id = v_liq;
    select coalesce(sum(monto), 0) into v_pag from public.pagos where tipo = 'pago' and liquidacion_id = v_liq;
    select coalesce(sum(monto), 0) into v_des from public.descuentos_liquidacion where liquidacion_id = v_liq;
    v_neto := v_dev - v_des - v_pag;
    update public.liquidaciones
       set total_devengado = v_dev, total_descuentos = v_des, total_pagado = v_pag, neto = v_neto,
           estado = case when v_pag <= 0 then 'abierta' when v_neto <= 0 then 'pagada' else 'cerrada' end,
           retiro_hasta = greatest(coalesce(retiro_hasta, v_corte), v_corte),
           actualizado_en = now()
     where id = v_liq;
  end if;

  -- 4. Inactivarlo.
  update public.profesores set activo = false where id = v_prof;

  return jsonb_build_object('liquidacion_id', v_liq, 'asignaciones', v_n_asig, 'lineas', v_n_lineas);
end;
$$;


comment on function public.retirar_profesor(jsonb) is
  'Retiro de un profesor, todo o nada (I-005, D34): cierra sus asignaciones, deja sustitutos, devenga el cierre de cuentas (y guarda la fecha efectiva del retiro en la liquidacion, 0066) y lo inactiva. Escribe lo que recibe; el calculo es del motor (TypeScript). Solo service_role.';

revoke all on function public.retirar_profesor(jsonb) from public, anon, authenticated;
grant execute on function public.retirar_profesor(jsonb) to service_role;

notify pgrst, 'reload schema';
