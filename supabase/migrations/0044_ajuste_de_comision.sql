-- =====================================================================
-- TROPICANA - 0044: el ajuste de comision (delta de recalculo)
-- ---------------------------------------------------------------------
-- PARA QUE. Las clases solo afectan CONTADORES (Javier, 2026-09-18). La
-- plata sale de las membresias completadas (agotadas) y cobradas al 100%;
-- el conteo de clases es apenas el insumo del prorrateo al liquidar.
--
-- Cuando una clase se registra tarde, se corrige o se suspende, el
-- recalculo de esa membresia puede dar un monto devengado distinto al que
-- se liquido en su momento. Lo ya PAGADO es inmutable -- no se reescribe
-- nunca -- pero la diferencia hay que compensarla con el profesor: pagarle
-- lo que falto o descontarle lo que sobro. Eso es el AJUSTE.
--
-- Lo que NO cambia: lo liquidado por OTRAS membresias que compartieron la
-- misma clase. Cada venta se reparte sola, con su propia plata.
--
-- EL PROBLEMA QUE ESTA MIGRACION DESTRABA. El motor no emitia el delta
-- por una razon tecnica, no de criterio: el indice unico
-- `comisiones_devengadas_membresia_curso_profesor_uniq` (0029) impide una
-- segunda fila para la misma (membresia, curso, profesor). Con el indice
-- asi, la unica salida habria sido reescribir la fila original -- justo lo
-- que la regla 12 prohibe. Por eso el codigo se limitaba a saltearla.
--
-- QUE HACE
--  1. `tipo` admite 'ajuste' (hoy solo 'comision' y 'referido').
--  2. El indice unico pasa a ser PARCIAL: solo sobre `tipo = 'comision'`.
--     La comision original sigue siendo unica por (membresia, curso,
--     profesor) -- no se puede duplicar -- y los ajustes quedan libres,
--     porque puede haber mas de uno a lo largo del tiempo.
--  3. `ajusta_comision_id`: a que comision corrige este ajuste. Es la
--     traza, y es lo que le permite al comprobante explicar de donde sale.
--
-- POR QUE EL AJUSTE VA ACA Y NO EN `descuentos_liquidacion`. Un ajuste es
-- una comision que cambio, no un concepto distinto: se calcula sobre la
-- misma base, con el mismo %, y el comprobante lo tiene que mostrar junto
-- a la comision que corrige. `descuentos_liquidacion` es otra cosa -- el
-- costo de un reemplazante o una multa (regla 20a) -- y ademas exige
-- `monto > 0` (0032). `comisiones_devengadas.monto` y `.base` no tienen
-- check de signo, asi que el ajuste viaja firmado: positivo si hay que
-- pagarle mas, negativo si hay que descontarle.
--
-- Aditiva e idempotente. No toca ninguna fila existente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. `tipo` admite 'ajuste'.
-- ---------------------------------------------------------------------
alter table public.comisiones_devengadas
  drop constraint if exists comisiones_devengadas_tipo_check;
alter table public.comisiones_devengadas
  add constraint comisiones_devengadas_tipo_check
  check (tipo in ('comision', 'referido', 'ajuste'));

-- ---------------------------------------------------------------------
-- 2. La unicidad pasa a ser solo de la comision original.
--    Sin esto no puede existir una segunda fila para la misma
--    (membresia, curso, profesor), que es exactamente lo que un ajuste
--    necesita ser.
-- ---------------------------------------------------------------------
drop index if exists public.comisiones_devengadas_membresia_curso_profesor_uniq;
create unique index if not exists comisiones_devengadas_membresia_curso_profesor_uniq
  on public.comisiones_devengadas (membresia_id, coalesce(curso_id, (0)::bigint), profesor_id)
  where (membresia_id is not null and tipo = 'comision');

-- ---------------------------------------------------------------------
-- 3. La traza: a que comision corrige este ajuste.
--    `on delete cascade`: si la comision original se revierte (solo pasa
--    con liquidaciones abiertas, `revertirDevengosAbiertos`), sus ajustes
--    no tienen sentido sin ella.
-- ---------------------------------------------------------------------
alter table public.comisiones_devengadas
  add column if not exists ajusta_comision_id bigint
    references public.comisiones_devengadas(id) on delete cascade;

create index if not exists comisiones_devengadas_ajusta_idx
  on public.comisiones_devengadas(ajusta_comision_id)
  where ajusta_comision_id is not null;

comment on column public.comisiones_devengadas.ajusta_comision_id is
  'Solo en filas tipo=ajuste: la comision original que este ajuste corrige. El ajuste entra como complemento en la liquidacion del periodo de esa comision; lo pagado no se reescribe.';

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0044
-- =====================================================================
