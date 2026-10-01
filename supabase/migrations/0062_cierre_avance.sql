-- 0062 -- Cierre de cuentas de un profesor que se retira (Javier, 2026-10-01).
--
-- Al desasignar a un profesor se puede liquidar de inmediato el avance que
-- ganó hasta la fecha de corte, como PAGO A CUENTA de la liquidación final
-- (excepción a la regla 8, criterio 1). Se devenga como `tipo = 'cierre'`:
--   * el motor lo suma como "ya devengado", así que la liquidación final
--     emite solo la diferencia (regla 16);
--   * `revertirDevengosAbiertos` no lo toca: un cierre no se recrea solo
--     al registrar una clase, porque el criterio 1 todavía no corresponde.
-- Idempotente. No modifica ningún dato.

alter table public.comisiones_devengadas
  drop constraint if exists comisiones_devengadas_tipo_check;
alter table public.comisiones_devengadas
  add constraint comisiones_devengadas_tipo_check
  check (tipo in ('comision', 'referido', 'ajuste', 'avance', 'cierre'));

comment on column public.comisiones_devengadas.tipo is
  '`avance` (solo criterio 2): incremento por avance, va al período que se está liquidando (excepción a la regla 16). `cierre`: avance al corte de un profesor que se retira, pago a cuenta de la liquidación final (regla 8, excepción); no se revierte solo. `ajuste`: reabre el período de la comisión original.';

notify pgrst, 'reload schema';
