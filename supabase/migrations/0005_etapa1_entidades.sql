-- =====================================================================
-- TROPICANA — 0005: Etapa 1, entidades base
-- ---------------------------------------------------------------------
-- Profesores, Alumnos, Cursos, tarifas parciales (tabla A), asignaciones
-- profesor×curso con comisiones congeladas, y descuento por meses
-- adelantados (tabla B). Más los parámetros nuevos.
--
-- Inscripciones, cuotas, clases, asistencia → 0006.  Pagos, costos fijos,
-- comisiones devengadas y liquidación → 0007.
--
-- Ejecutar en Supabase → SQL Editor → New query. Idempotente y ADITIVO.
-- Escritura de operativos: por server actions con service_role tras chequear
-- permiso; las políticas RLS dejan lectura a autenticados y escritura directa
-- solo a administradores (defensa en profundidad).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFESORES  (la pantalla viene del handoff de Design; la tabla ya)
-- ---------------------------------------------------------------------
create table if not exists public.profesores (
  id             bigint generated always as identity primary key,
  nombre         text not null,
  apellido       text not null,
  whatsapp       text,
  tipo           text not null default 'activo'
                   check (tipo in ('activo', 'externo')),
  especialidades text[] not null default '{}',   -- estilos de baile (chips)
  -- Vínculo opcional uno-a-uno con una cuenta de login (perfiles = auth user).
  usuario_id     uuid unique references public.perfiles(id) on delete set null,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index if not exists profesores_whatsapp_uk
  on public.profesores (regexp_replace(whatsapp, '\D', '', 'g'))
  where whatsapp is not null and whatsapp <> '';

-- ---------------------------------------------------------------------
-- 2. ALUMNOS  (componente compartido lo construye Code)
--    Identidad: adulto = dígitos(whatsapp propio);
--               menor  = dígitos(whatsapp del tutor) + nombre (sin apellido).
-- ---------------------------------------------------------------------
create table if not exists public.alumnos (
  id                    bigint generated always as identity primary key,
  nombre                text not null,
  apellido              text not null,
  whatsapp              text,                 -- identificador del adulto
  es_menor              boolean not null default false,
  tutor_alumno_id       bigint references public.alumnos(id) on delete set null,
  tutor_nombre          text,
  tutor_whatsapp        text,
  referido_por_alumno_id bigint references public.alumnos(id) on delete set null,
  canal_captacion       text,                 -- valor del catálogo 'canal_captacion'
  activo                boolean not null default true,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);
-- Adulto: único por su propio WhatsApp (normalizado a dígitos).
create unique index if not exists alumnos_adulto_whatsapp_uk
  on public.alumnos (regexp_replace(whatsapp, '\D', '', 'g'))
  where es_menor = false and whatsapp is not null and whatsapp <> '';
-- Menor: único por (WhatsApp del tutor, nombre en minúsculas).
create unique index if not exists alumnos_menor_clave_uk
  on public.alumnos (regexp_replace(tutor_whatsapp, '\D', '', 'g'), lower(nombre))
  where es_menor = true and tutor_whatsapp is not null and tutor_whatsapp <> '';
create index if not exists alumnos_tutor_idx on public.alumnos(tutor_alumno_id);

-- ---------------------------------------------------------------------
-- 3. CURSOS  (el profesor titular vigente sale de asignaciones, no de acá)
-- ---------------------------------------------------------------------
create table if not exists public.cursos (
  id             bigint generated always as identity primary key,
  nombre         text not null,
  linea          text,
  nivel          text,
  dias_semana    int[] not null default '{}',  -- 1=lun … 7=dom, ej. {1,3,5}
  hora           time,
  precio_mensual numeric(10,2) not null default 0,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. TARIFAS PARCIALES POR CURSO — tabla A
--    Sin fila para una modalidad → esa modalidad cae al mensual completo.
-- ---------------------------------------------------------------------
create table if not exists public.curso_tarifas (
  id        bigint generated always as identity primary key,
  curso_id  bigint not null references public.cursos(id) on delete cascade,
  modalidad text not null check (modalidad in ('clase', 'semana', 'medio_mes')),
  precio    numeric(10,2) not null,
  unique (curso_id, modalidad)
);
create index if not exists curso_tarifas_curso_idx on public.curso_tarifas(curso_id);

-- ---------------------------------------------------------------------
-- 5. ASIGNACIONES profesor×curso — comisiones CONGELADAS al confirmar
--    Filas inmutables: reemplazar titular CIERRA la fila (setea hasta),
--    nunca la edita. La liquidación lee el % de la fila que cubrió el mes.
--    Soporta relevos (varias asignaciones en el tiempo).
-- ---------------------------------------------------------------------
create table if not exists public.asignaciones (
  id           bigint generated always as identity primary key,
  curso_id     bigint not null references public.cursos(id) on delete cascade,
  profesor_id  bigint not null references public.profesores(id) on delete restrict,
  pct_ingresos numeric(5,2) not null check (pct_ingresos between 0 and 100),
  pct_referido numeric(5,2) not null default 0 check (pct_referido between 0 and 100),
  desde        date not null default current_date,
  hasta        date,                          -- null = asignación vigente
  creado_en    timestamptz not null default now()
);
-- Un solo titular vigente por curso.
create unique index if not exists asignaciones_curso_vigente_uk
  on public.asignaciones(curso_id) where hasta is null;
create index if not exists asignaciones_profesor_idx on public.asignaciones(profesor_id);

-- ---------------------------------------------------------------------
-- 6. DESCUENTO POR MESES ADELANTADOS — tabla B (cruce EXACTO, sin interpolar)
-- ---------------------------------------------------------------------
create table if not exists public.descuentos_adelanto (
  meses      int primary key check (meses >= 2),
  porcentaje numeric(5,2) not null check (porcentaje between 0 and 100)
);
insert into public.descuentos_adelanto (meses, porcentaje) values
  (2, 5), (3, 10), (6, 15)
on conflict (meses) do nothing;

-- ---------------------------------------------------------------------
-- 7. PARÁMETROS nuevos (no hardcode)
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('medio_mes_factor', '2', 'numero', 'Factor de "medio mes"',
   'Multiplicador del paquete "medio mes": clases = factor × días de clase semanales del curso.', 'Cursos'),
  ('especialidades', 'Salsa,Bachata,Zumba,Urbano,Heels', 'texto', 'Especialidades (estilos)',
   'Lista de estilos de baile ofrecidos como chips en la ficha de profesor y para filtrar titulares.', 'Profesores')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
--    Lectura: cualquier autenticado. Escritura directa: administradores
--    (los operativos escriben por server actions con service_role).
-- ---------------------------------------------------------------------
alter table public.profesores          enable row level security;
alter table public.alumnos             enable row level security;
alter table public.cursos              enable row level security;
alter table public.curso_tarifas       enable row level security;
alter table public.asignaciones        enable row level security;
alter table public.descuentos_adelanto enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'profesores','alumnos','cursos','curso_tarifas','asignaciones','descuentos_adelanto'
  ] loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I;', t, t);
    execute format(
      'create policy %I_admin_write on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin());',
      t, t);
  end loop;
end $$;

-- =====================================================================
-- FIN 0005
-- =====================================================================
