-- 0063 -- Retiro de un profesor, todo o nada (I-005, D34; Javier, 2026-10-07).
--
-- Retirar a un profesor hace cuatro cosas que no pueden quedar a medias:
--   1. cerrar todas sus asignaciones abiertas (`hasta` = último día a cargo),
--   2. dejar, si se eligió, un sustituto desde el día siguiente,
--   3. devengar su cierre de cuentas (`tipo = 'cierre'`, pago a cuenta) en la
--      liquidación del mes del corte, con sus ítems y los totales recalculados,
--   4. inactivarlo.
-- Hasta hoy eso eran llamadas sueltas desde la aplicación con un deshacer
-- manual si algo fallaba (`desasignar`). Acá es una sola función: si cualquier
-- paso falla, la transacción entera se revierte y no queda nada escrito.
--
-- La función NO calcula plata: recibe las líneas ya calculadas por el motor
-- (TypeScript) y solo las escribe, después de validar contra la base que el
-- profesor está activo y que cada asignación sigue abierta y es suya. El
-- servidor vuelve a calcular antes de llamarla; la pantalla nunca la llama.
--
-- Solo la ejecuta el servidor (service_role). Idempotente. No toca datos.
--
-- `p` = {
--   "profesor_id": 7, "corte": "2026-10-31",
--   "asignaciones": [{"id": 5, "curso_id": 2,
--                     "sustituto": null | {"profesor_id": 8, "pct_ingresos": 40, "pct_referido": 0}}],
--   "lineas": [{"membresia_id": 1, "curso_id": 2 | null, "plan_id": null | 3, "criterio": 2,
--               "base": 100, "monto": 50, "reparto": null | [...], "detalle_particular": null | {...},
--               "origen": "texto", "descripcion": "texto"}]
-- }

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
           actualizado_en = now()
     where id = v_liq;
  end if;

  -- 4. Inactivarlo.
  update public.profesores set activo = false where id = v_prof;

  return jsonb_build_object('liquidacion_id', v_liq, 'asignaciones', v_n_asig, 'lineas', v_n_lineas);
end;
$$;

comment on function public.retirar_profesor(jsonb) is
  'Retiro de un profesor, todo o nada (I-005, D34): cierra sus asignaciones, deja sustitutos, devenga el cierre de cuentas y lo inactiva. Escribe lo que recibe; el cálculo es del motor (TypeScript). Solo service_role.';

revoke all on function public.retirar_profesor(jsonb) from public, anon, authenticated;
grant execute on function public.retirar_profesor(jsonb) to service_role;

notify pgrst, 'reload schema';
