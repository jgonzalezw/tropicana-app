-- =====================================================================
-- TROPICANA — 0007: Etapa 1, toma de asistencia
-- ---------------------------------------------------------------------
-- Una SESIÓN es una clase dictada (curso + fecha). Cada ASISTENCIA marca
-- a un alumno presente/ausente en esa sesión. En modalidades parciales,
-- cada "presente" consume una clase del paquete (se cuenta desde acá).
--
-- Fuera de alcance por ahora (fase posterior): tolerancias/reposiciones,
-- clases de prueba en la lista, y la comisión por clase (0008).
--
-- Ejecutar en Supabase → SQL Editor → New query. Idempotente y ADITIVO.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SESIONES — una clase dictada (curso + fecha). Única por curso+fecha.
-- ---------------------------------------------------------------------
create table if not exists public.sesiones (
  id             bigint generated always as identity primary key,
  curso_id       bigint not null references public.cursos(id) on delete cascade,
  fecha          date not null default current_date,
  -- Titular vigente al momento de registrar (se toma de asignaciones; puede
  -- ser null si el curso no tiene titular asignado). Congela quién dictó.
  profesor_id    bigint references public.profesores(id) on delete set null,
  registrado_por uuid references public.perfiles(id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (curso_id, fecha)
);
create index if not exists sesiones_curso_idx on public.sesiones(curso_id);
create index if not exists sesiones_fecha_idx on public.sesiones(fecha);

-- ---------------------------------------------------------------------
-- 2. ASISTENCIAS — un alumno marcado en una sesión. Única por sesión+alumno.
--    inscripcion_id permite consumir el paquete parcial correcto.
-- ---------------------------------------------------------------------
create table if not exists public.asistencias (
  id             bigint generated always as identity primary key,
  sesion_id      bigint not null references public.sesiones(id) on delete cascade,
  alumno_id      bigint not null references public.alumnos(id) on delete cascade,
  inscripcion_id bigint references public.inscripciones(id) on delete set null,
  estado         text not null check (estado in ('presente', 'ausente')),
  creado_en      timestamptz not null default now(),
  unique (sesion_id, alumno_id)
);
create index if not exists asistencias_sesion_idx on public.asistencias(sesion_id);
create index if not exists asistencias_alumno_idx on public.asistencias(alumno_id);
create index if not exists asistencias_inscripcion_idx on public.asistencias(inscripcion_id);

-- ---------------------------------------------------------------------
-- 3. PARÁMETROS de asistencia (no hardcode)
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('faltas_toleradas', '2', 'numero', 'Faltas toleradas por mes',
   'Cuántas faltas mensuales se toleran antes de avisar "sin tolerancia" en la toma de asistencia.', 'Asistencia'),
  ('mostrar_deuda', 'true', 'booleano', 'Mostrar deuda en asistencia',
   'Si se muestra la deuda del alumno junto a su nombre al tomar asistencia.', 'Asistencia')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (lectura autenticados; escritura directa admin)
--    Los operativos escriben por server actions con service_role.
-- ---------------------------------------------------------------------
alter table public.sesiones    enable row level security;
alter table public.asistencias enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sesiones','asistencias'] loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I;', t, t);
    execute format('create policy %I_admin_write on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin());', t, t);
  end loop;
end $$;

-- =====================================================================
-- FIN 0007
-- =====================================================================
