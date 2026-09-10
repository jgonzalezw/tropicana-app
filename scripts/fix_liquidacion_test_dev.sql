-- =====================================================================
-- TROPICANA - corregir el caso de prueba incoherente en dev (2026-09-10)
-- ---------------------------------------------------------------------
-- SOLO PARA tropicana-dev.
--
-- Que paso: la primera version de este script (misma fecha) forzo la
-- elegibilidad de una membresia real (Vargas, Marilyn - Salsa y Bachata
-- Inicial) para poder probar Liquidaciones, moviendo solo fecha_fin hacia
-- atras. Resultado: un ciclo que terminaba ANTES de empezar
-- (02/09/2026 -> 20/08/2026), visible asi en el comprobante. Ademas esa
-- membresia tenia 100% de descuento ("paquete boda"), o sea base cobrada
-- = 0, con lo cual devengaba una comision de Bs 0: no servia como prueba.
--
-- Este script deshace aquello, con el minimo impacto posible:
--   1. Borra el item y la comision devengada de esa membresia (Bs 0).
--      NO toca la comision real de la liquidacion (Rayza / Tropicoreografico).
--   2. Devuelve la membresia a su estado real: activa, sin fecha_fin,
--      contador segun sus presentes reales.
--   3. Recalcula los totales de las liquidaciones afectadas, con el mismo
--      criterio que recomputarTotales en liquidaciones/acciones.ts
--      (devengado = suma de items; pagado = suma de pagos tipo 'pago';
--       neto = devengado - pagado; estado abierta/cerrada/pagada).
--
-- La restriccion de base que impide repetir el error esta en la migracion
-- 0016_inscripciones_fechas_coherentes.sql.
--
-- Re-corrible: si ya se corrio, no encuentra nada que borrar y no cambia
-- nada. Solo ASCII.
-- =====================================================================

do $$
declare
  v_insc      bigint;
  v_presentes int;
  v_liq       bigint;
  v_borradas  int := 0;
begin
  select i.id into v_insc
  from public.inscripciones i
  join public.alumnos a on a.id = i.alumno_id
  join public.cursos c on c.id = i.curso_id
  where a.nombre = 'Marilyn' and a.apellido = 'Vargas'
    and c.nombre = 'Salsa y Bachata Inicial'
  limit 1;

  if v_insc is null then
    raise notice 'No hay membresia de Marilyn Vargas en este entorno: nada que corregir';
    return;
  end if;

  -- 1. Sacar su devengo de la liquidacion (guardando a que liquidacion iba).
  select li.liquidacion_id into v_liq
  from public.liquidacion_items li
  where li.membresia_id = v_insc
  limit 1;

  delete from public.liquidacion_items where membresia_id = v_insc;
  get diagnostics v_borradas = row_count;
  delete from public.comisiones_devengadas where membresia_id = v_insc;

  -- 2. Devolver la membresia a su estado real.
  select count(*) into v_presentes
  from public.asistencias
  where inscripcion_id = v_insc and estado = 'presente';

  update public.inscripciones
    set estado = 'activa',
        clases_hechas = v_presentes,
        fecha_fin = null,
        actualizado_en = now()
    where id = v_insc;

  -- 3. Recalcular la liquidacion que quedo tocada.
  if v_liq is not null then
    update public.liquidaciones l
      set total_devengado = coalesce((select sum(li.monto) from public.liquidacion_items li where li.liquidacion_id = l.id), 0),
          total_pagado    = coalesce((select sum(p.monto)  from public.pagos p            where p.liquidacion_id = l.id and p.tipo = 'pago'), 0)
      where l.id = v_liq;
    update public.liquidaciones l
      set neto = l.total_devengado - l.total_pagado,
          estado = case
                     when l.total_pagado <= 0 then 'abierta'
                     when l.total_devengado - l.total_pagado <= 0 then 'pagada'
                     else 'cerrada'
                   end
      where l.id = v_liq;
    raise notice 'Liquidacion % recalculada (se le quitaron % item(s) de la membresia %)', v_liq, v_borradas, v_insc;
  end if;

  raise notice 'Membresia % de Marilyn Vargas revertida: activa, fecha_fin=null, clases_hechas=%', v_insc, v_presentes;
end $$;
