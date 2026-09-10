-- =====================================================================
-- TROPICANA - 0017: toda venta tiene su cuota (nada de plata colgada)
-- ---------------------------------------------------------------------
-- Idempotente: correrla dos veces no cambia nada. Solo ASCII.
--
-- POR QUE (criterio de Javier, 2026-09-10)
-- ----------------------------------------
-- "Todo lo que se vende debe cobrarse, y para eso el mecanismo son las
-- cuotas." Antes del motor de planes, la venta de paquetes por clase y de
-- medio mes registraba el cobro SIN crear cuota: el pago quedaba con
-- cuota_id vacio, colgado de la membresia. Consecuencias:
--   * esa plata no aparece en la deuda ni en el estado de cuenta del alumno;
--   * no entra en la base de comision del profesor, porque la liquidacion
--     suma lo cobrado POR CUOTA -> esas membresias liquidaban Bs 0.
-- Medido el 2026-09-10: 4 membresias en produccion y 4 en dev, por un total
-- de Bs 240 (Aguilar/Tropicoreografico Bs 150 y tres clases sueltas de
-- Zumba de Bs 30).
--
-- La venta actual (/inscribir) ya crea siempre la cuota del ciclo, asi que
-- esto NO se repite con ventas nuevas: la migracion cierra el pasado que
-- vino de produccion. La regla queda para el Paso 2 (particulares y
-- alquiler): toda venta nueva crea su cuota.
--
-- QUE HACE
-- --------
-- 1. Crea la cuota faltante de cada membresia que no tenga ninguna. Importe
--    = precio de venta de la membresia (precio_aplicado); si lo ya cobrado
--    fuera mayor, se usa lo cobrado, para no inventar una deuda que no
--    existe. Periodo = mes de inicio; vencimiento = fin del ciclo (o el
--    inicio si no tiene fin).
-- 2. Engancha los pagos sueltos (cobros con cuota_id vacio) a la cuota de su
--    membresia. Solo cuando la membresia tiene exactamente una cuota, para
--    no adivinar a cual de varias corresponde.
-- 3. Recalcula el estado de las cuotas segun lo efectivamente cobrado, con
--    la misma regla que usa la venta: pagada si lo cobrado cubre el importe
--    (o el importe es 0), parcial si algo se cobro, pendiente si no. Se
--    aplica a todas las cuotas: donde ya coincidia no cambia nada.
-- =====================================================================

-- ── 1. Cuota faltante por membresia ──────────────────────────────────
insert into public.cuotas
  (inscripcion_id, periodo, monto_devengado, descuento_adelanto, vencimiento, estado)
select i.id,
       date_trunc('month', i.fecha_inicio)::date,
       greatest(coalesce(i.precio_aplicado, 0), coalesce(pg.cubierto, 0)),
       0,
       coalesce(i.fecha_fin, i.fecha_inicio),
       'pendiente'
  from public.inscripciones i
  left join lateral (
        select sum(p.monto + p.descuento) as cubierto
          from public.pagos p
         where p.inscripcion_id = i.id
           and p.tipo = 'cobro'
           and p.cuota_id is null
       ) pg on true
 where i.estado <> 'baja'
   and i.fecha_inicio is not null
   and not exists (select 1 from public.cuotas cu where cu.inscripcion_id = i.id);

-- ── 2. Enganchar los pagos sueltos a la cuota de su membresia ────────
update public.pagos p
   set cuota_id = cu.id
  from public.cuotas cu
 where cu.inscripcion_id = p.inscripcion_id
   and p.cuota_id is null
   and p.tipo = 'cobro'
   and p.inscripcion_id is not null
   and (select count(*) from public.cuotas c2 where c2.inscripcion_id = p.inscripcion_id) = 1;

-- ── 3. Estado de la cuota segun lo cobrado ───────────────────────────
with cobrado as (
  select cu.id,
         greatest(0, cu.monto_devengado - cu.descuento_adelanto) as referencia,
         coalesce((select sum(p.monto + p.descuento)
                     from public.pagos p
                    where p.cuota_id = cu.id and p.tipo = 'cobro'), 0) as saldado
    from public.cuotas cu
),
nuevo as (
  select id,
         case when referencia = 0 or saldado >= referencia then 'pagada'
              when saldado > 0 then 'parcial'
              else 'pendiente' end as estado
    from cobrado
)
update public.cuotas cu
   set estado = n.estado
  from nuevo n
 where cu.id = n.id
   and cu.estado is distinct from n.estado;

-- ── Control posterior ────────────────────────────────────────────────
do $$
declare
  v_sueltos int;
  v_sin_cuota int;
begin
  select count(*) into v_sueltos
    from public.pagos where tipo = 'cobro' and cuota_id is null and inscripcion_id is not null;
  select count(*) into v_sin_cuota
    from public.inscripciones i
   where i.estado <> 'baja'
     and not exists (select 1 from public.cuotas cu where cu.inscripcion_id = i.id);
  raise notice 'Quedan % cobro(s) sin cuota y % membresia(s) sin cuota (ambos deberian ser 0)', v_sueltos, v_sin_cuota;
end $$;
