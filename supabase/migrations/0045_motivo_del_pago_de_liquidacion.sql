-- =====================================================================
-- TROPICANA - 0045: el pago de una liquidacion se clasifica en Caja
-- ---------------------------------------------------------------------
-- EL PROBLEMA. `registrarPagoLiquidacion` asentaba el egreso con
-- `motivo = 'liquidacion'`, una clave INVENTADA: no esta en el catalogo
-- `motivo_pago` (0020) ni en `BUCKET_POR_MOTIVO` (src/lib/caja.ts). La
-- consecuencia no era cosmetica -- `bucketDeMotivo()` devolvia null, asi
-- que lo que se le paga a un profesor por su liquidacion no saldaba
-- ninguna deuda y no caia en ningun bucket de Caja. Plata que sale sin
-- clasificar.
--
-- QUE HACE. Remapea esos pagos a `comision_profesor`, que YA EXISTE en
-- el catalogo ("Comision a profesor") y ya mapea al bucket `profesores`
-- con politica `ajuste`. No hace falta inventar un motivo nuevo: el que
-- corresponde estaba desde la 0020.
--
-- Igual que la 0020, se guarda el valor anterior antes de tocarlo: un
-- remapeo de datos que no se puede deshacer no se hace a ciegas.
--
-- Al 2026-09-18: produccion tiene CERO filas asi (nunca liquido nada);
-- dev tiene una. Es una migracion preventiva mas que correctiva -- la
-- primera liquidacion de produccion corre en octubre y va a nacer ya
-- clasificada.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Respaldo del motivo anterior, por si hubiera que volver atras.
--    Mismo patron que `pagos_motivo_previo_0020`.
-- ---------------------------------------------------------------------
create table if not exists public.pagos_motivo_previo_0045 (
  pago_id         bigint primary key,
  motivo_anterior text,
  guardado_en     timestamptz not null default now()
);

alter table public.pagos_motivo_previo_0045 enable row level security;

drop policy if exists pagos_motivo_previo_0045_select on public.pagos_motivo_previo_0045;
create policy pagos_motivo_previo_0045_select on public.pagos_motivo_previo_0045
  for select to authenticated using (true);

insert into public.pagos_motivo_previo_0045 (pago_id, motivo_anterior)
select id, motivo from public.pagos where motivo = 'liquidacion'
on conflict (pago_id) do nothing;

-- ---------------------------------------------------------------------
-- 2. El remapeo.
--    Para volver atras:
--      update public.pagos p set motivo = b.motivo_anterior
--        from public.pagos_motivo_previo_0045 b where b.pago_id = p.id;
-- ---------------------------------------------------------------------
update public.pagos
   set motivo = 'comision_profesor'
 where motivo = 'liquidacion';

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0045
-- =====================================================================
