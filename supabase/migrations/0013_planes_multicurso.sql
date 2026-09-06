-- =====================================================================
-- TROPICANA - 0013: planes multi-curso + dias de la membresia por curso
-- ---------------------------------------------------------------------
-- Reencuadre del flujo de venta a "plan-primero": un PLAN puede dar acceso a
-- VARIOS cursos. Al vender, el alumno elige que dias toma en cada curso del
-- plan; la membresia se completa al llegar a N clases (plan.cantidad_clases).
--
-- Agrega (aditivo e idempotente):
--   1. plan_cursos        - relacion plan <-> cursos (muchos a muchos).
--                           Backfill desde planes.curso_id (planes de 1 curso).
--   2. inscripcion_cursos - por cada curso de la membresia, los dias elegidos
--                           (1=lun..7=dom). La union arma el calendario semanal.
--                           Backfill de las membresias existentes.
--
-- planes.curso_id se conserva (el curso "principal" de los planes de un curso);
-- la fuente de verdad de los cursos de un plan pasa a ser plan_cursos.
-- inscripciones.curso_id se conserva (curso principal de la membresia).
--
-- Ejecutar en Supabase -> SQL Editor. Solo ASCII en comentarios.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PLAN_CURSOS - que cursos incluye cada plan.
-- ---------------------------------------------------------------------
create table if not exists public.plan_cursos (
  id        bigint generated always as identity primary key,
  plan_id   bigint not null references public.planes(id) on delete cascade,
  curso_id  bigint not null references public.cursos(id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (plan_id, curso_id)
);
create index if not exists plan_cursos_plan_idx on public.plan_cursos(plan_id);
create index if not exists plan_cursos_curso_idx on public.plan_cursos(curso_id);

-- Backfill: cada plan con curso_id pasa a tener su fila en plan_cursos.
insert into public.plan_cursos (plan_id, curso_id)
select p.id, p.curso_id
from public.planes p
where p.curso_id is not null
  and not exists (
    select 1 from public.plan_cursos pc
    where pc.plan_id = p.id and pc.curso_id = p.curso_id
  );

-- ---------------------------------------------------------------------
-- 2. INSCRIPCION_CURSOS - dias elegidos por curso en la membresia.
--    1=lun .. 7=dom. La suma de clases de estos dias se cuenta hasta
--    clases_plan (N del plan).
-- ---------------------------------------------------------------------
create table if not exists public.inscripcion_cursos (
  id             bigint generated always as identity primary key,
  inscripcion_id bigint not null references public.inscripciones(id) on delete cascade,
  curso_id       bigint not null references public.cursos(id) on delete restrict,
  dias           int[] not null default '{}',
  creado_en      timestamptz not null default now(),
  unique (inscripcion_id, curso_id)
);
create index if not exists inscripcion_cursos_insc_idx on public.inscripcion_cursos(inscripcion_id);

-- Backfill: cada membresia (inscripcion con plan) toma su curso y sus dias
-- (los dias elegidos si los tenia, si no los dias del curso).
insert into public.inscripcion_cursos (inscripcion_id, curso_id, dias)
select i.id, i.curso_id,
       coalesce(nullif(i.dias_elegidos, '{}'), c.dias_semana, '{}')
from public.inscripciones i
join public.cursos c on c.id = i.curso_id
where i.plan_id is not null
  and not exists (
    select 1 from public.inscripcion_cursos ic
    where ic.inscripcion_id = i.id and ic.curso_id = i.curso_id
  );

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY.
-- ---------------------------------------------------------------------
alter table public.plan_cursos        enable row level security;
alter table public.inscripcion_cursos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['plan_cursos', 'inscripcion_cursos'] loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I;', t, t);
    execute format('create policy %I_admin_write on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin());', t, t);
  end loop;
end $$;

-- =====================================================================
-- FIN 0013
-- =====================================================================
