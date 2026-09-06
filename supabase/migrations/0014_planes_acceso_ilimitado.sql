-- =====================================================================
-- TROPICANA - 0014: planes - criterio de acceso + limite de clases
-- ---------------------------------------------------------------------
-- Aditivo e idempotente. Agrega al plan (motor):
--   1. acceso_modo       - a que cursos da acceso el plan:
--                          'solo'   -> solo los de plan_cursos (default, lo actual)
--                          'todas'  -> todos los cursos activos (plan_cursos vacio)
--                          'excepto'-> todos menos los de plan_cursos
--   2. clases_ilimitadas - si el plan no tiene tope de clases.
--                          OFF -> usa cantidad_clases (N); fin = ultima clase por
--                                 calendario (se recorre por suspension/tolerancia).
--                          ON  -> sin N; fin = inicio + ciclo_dias.
--   3. ciclo_dias        - duracion del ciclo en dias (solo para ilimitadas).
--
-- tolerancia_faltas (ya existe): numero por plan; 0 = sin tolerancia ni bono;
--   >0 = con tolerancia/bono; null = usa el parametro del sistema.
--
-- Ejecutar en Supabase -> SQL Editor. Solo ASCII en comentarios.
-- =====================================================================

alter table public.planes
  add column if not exists acceso_modo text not null default 'solo';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'planes_acceso_modo_check') then
    alter table public.planes
      add constraint planes_acceso_modo_check
      check (acceso_modo in ('solo', 'todas', 'excepto'));
  end if;
end $$;

alter table public.planes
  add column if not exists clases_ilimitadas boolean not null default false;

alter table public.planes
  add column if not exists ciclo_dias int;

-- =====================================================================
-- FIN 0014
-- =====================================================================
