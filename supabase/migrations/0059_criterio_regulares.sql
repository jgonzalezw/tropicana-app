-- 0059 (Paso 4 de H5): criterios 2 y 3 también para cursos regulares.
--
-- 1. `membresias.criterio_liquidacion` deja de ser solo de las particulares:
--    toda venta guarda la foto del criterio de su plan (regla 12). Backfill de
--    las regulares ya vendidas con el criterio de su plan HOY (única copia).
-- 2. `avance` ya no se limita a particulares: una regular con criterio 2 también
--    devenga por avance (misma excepción a la regla 16). Sigue exigiendo
--    criterio 2.
-- Idempotente.

update public.membresias m
set criterio_liquidacion = p.criterio_liquidacion
from public.planes p
where p.id = m.plan_id
  and m.criterio_liquidacion is null;

comment on column public.membresias.criterio_liquidacion is
  'Snapshot de planes.criterio_liquidacion al vender (particulares desde H5, regulares desde el Paso 4). Es lo que el motor lee; null solo en filas sin plan.';

alter table public.comisiones_devengadas
  drop constraint if exists comisiones_avance_solo_criterio2;
alter table public.comisiones_devengadas
  add constraint comisiones_avance_solo_criterio2
  check (tipo <> 'avance' or criterio = 2);

comment on column public.comisiones_devengadas.tipo is
  '`avance` (solo criterio 2, particulares y regulares): el incremento por avance, va SIEMPRE al período que se está liquidando -- excepción explícita a la regla 16, ver docs/DECISIONES.md. Distinto de `ajuste`, que sí reabre el período de la comisión original.';

notify pgrst, 'reload schema';
