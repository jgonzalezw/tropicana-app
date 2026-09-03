-- =====================================================================
-- TROPICANA — 0009: suspensión de clase + corrimiento de fin de ciclo
-- ---------------------------------------------------------------------
-- Mecanismo ÚNICO compartido: "correr el fin de ciclo un día de clase".
-- Lo disparan dos casos, con la MISMA lógica:
--   • falta individual tolerada (el alumno falta y tiene tolerancia),
--   • suspensión de clase (la escuela suspende; corre a TODOS los mensuales
--     del curso; nunca gasta la tolerancia personal del alumno).
-- "Fin de ciclo" = vencimiento de la cuota vigente. Correrlo = moverlo a la
-- próxima fecha del patrón semanal del curso. Los parciales no llevan cuota:
-- al no marcarse asistencia, no consumen y se difieren solos.
--
-- Ejecutar en Supabase → SQL Editor → New query. Idempotente y ADITIVO.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SESIONES: estado (dictada / suspendida) + motivo
-- ---------------------------------------------------------------------
alter table public.sesiones add column if not exists estado text not null default 'dictada';
alter table public.sesiones add column if not exists motivo text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sesiones_estado_check'
  ) then
    alter table public.sesiones
      add constraint sesiones_estado_check check (estado in ('dictada', 'suspendida'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. CORRIMIENTOS DE FIN DE CICLO — traza del efecto (falta o suspensión)
--    Una fila por (inscripción, sesión): un corrimiento como máximo por
--    alumno por clase, para no aplicar el efecto dos veces.
-- ---------------------------------------------------------------------
create table if not exists public.corrimientos_ciclo (
  id                    bigint generated always as identity primary key,
  inscripcion_id        bigint not null references public.inscripciones(id) on delete cascade,
  alumno_id             bigint not null references public.alumnos(id) on delete cascade,
  cuota_id              bigint references public.cuotas(id) on delete set null,
  sesion_id             bigint references public.sesiones(id) on delete cascade,
  tipo                  text not null check (tipo in ('falta', 'suspension')),
  fecha_clase           date not null,               -- clase perdida/suspendida
  vencimiento_anterior  date,
  vencimiento_nuevo     date,
  motivo                text,
  registrado_por        uuid references public.perfiles(id) on delete set null,
  creado_en             timestamptz not null default now(),
  unique (inscripcion_id, sesion_id)
);
create index if not exists corrimientos_inscripcion_idx on public.corrimientos_ciclo(inscripcion_id);
create index if not exists corrimientos_sesion_idx on public.corrimientos_ciclo(sesion_id);
create index if not exists corrimientos_alumno_idx on public.corrimientos_ciclo(alumno_id);

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (lectura autenticados; escritura directa admin)
-- ---------------------------------------------------------------------
alter table public.corrimientos_ciclo enable row level security;

do $$
declare t text;
begin
  foreach t in array array['corrimientos_ciclo'] loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I;', t, t);
    execute format('create policy %I_admin_write on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin());', t, t);
  end loop;
end $$;

-- =====================================================================
-- FIN 0009
-- =====================================================================
