-- =====================================================================
-- TROPICANA — 0006: Etapa 1, inscripción + cobro
-- ---------------------------------------------------------------------
-- Inscripciones, cuotas (devengado mensual) y el LIBRO DE PAGOS que
-- persiste el paso compartido Cobro. Clases/asistencia → 0007;
-- comisiones/costos/liquidación → 0008.
--
-- Ejecutar en Supabase → SQL Editor → New query. Idempotente y ADITIVO.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. INSCRIPCIONES
--    Mensual: genera cuotas. Parcial (clase/semana/medio_mes): paquete de
--    clases de tamaño fijo, se consume por asistencia; no genera cuota.
-- ---------------------------------------------------------------------
create table if not exists public.inscripciones (
  id             bigint generated always as identity primary key,
  alumno_id      bigint not null references public.alumnos(id) on delete restrict,
  curso_id       bigint not null references public.cursos(id) on delete restrict,
  modalidad      text not null default 'mensual'
                   check (modalidad in ('mensual', 'clase', 'semana', 'medio_mes')),
  fecha_inicio   date not null default current_date,
  estado         text not null default 'activa' check (estado in ('activa', 'baja')),
  clases_total   int,              -- parciales: total del paquete
  dias_elegidos  int[],            -- subconjunto de días del curso (medio mes)
  precio_aplicado numeric(10,2) not null default 0,  -- snapshot al inscribir
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists inscripciones_alumno_idx on public.inscripciones(alumno_id);
create index if not exists inscripciones_curso_idx on public.inscripciones(curso_id);

-- ---------------------------------------------------------------------
-- 2. CUOTAS (devengado mensual)
--    Multi-mes adelantado = N cuotas (una por mes) con el descuento de la
--    tabla B distribuido entre ellas.
-- ---------------------------------------------------------------------
create table if not exists public.cuotas (
  id                 bigint generated always as identity primary key,
  inscripcion_id     bigint not null references public.inscripciones(id) on delete cascade,
  periodo            date not null,                 -- 1er día del mes devengado
  monto_devengado    numeric(10,2) not null,
  descuento_adelanto numeric(10,2) not null default 0,
  vencimiento        date,
  estado             text not null default 'pendiente'
                       check (estado in ('pendiente', 'parcial', 'pagada')),
  creado_en          timestamptz not null default now()
);
create index if not exists cuotas_inscripcion_idx on public.cuotas(inscripcion_id);

-- ---------------------------------------------------------------------
-- 3. PAGOS — libro de movimientos que persiste el paso Cobro
--    (cobros y pagos). La pantalla de Caja lo leerá más adelante.
-- ---------------------------------------------------------------------
create table if not exists public.pagos (
  id               bigint generated always as identity primary key,
  tipo             text not null default 'cobro' check (tipo in ('cobro', 'pago')),
  motivo           text,                              -- 'inscripcion','cuota',… (extensible)
  -- Sujeto (uno de estos, según el motivo):
  alumno_id        bigint references public.alumnos(id) on delete set null,
  profesor_id      bigint references public.profesores(id) on delete set null,
  costo_fijo_id    bigint,                            -- gancho (tabla en 0008)
  -- Referencia liquidada:
  inscripcion_id   bigint references public.inscripciones(id) on delete set null,
  cuota_id         bigint references public.cuotas(id) on delete set null,
  -- Dinero:
  monto            numeric(10,2) not null default 0,
  medio            text,
  descuento        numeric(10,2) not null default 0,
  descuento_motivo text,
  ajuste           numeric(10,2) not null default 0,
  ajuste_motivo    text,
  glosa            text,
  fecha            timestamptz not null default now(),
  registrado_por   uuid references public.perfiles(id) on delete set null,
  creado_en        timestamptz not null default now()
);
create index if not exists pagos_alumno_idx on public.pagos(alumno_id);
create index if not exists pagos_inscripcion_idx on public.pagos(inscripcion_id);
create index if not exists pagos_fecha_idx on public.pagos(fecha);

-- ---------------------------------------------------------------------
-- 4. PARÁMETRO: medios de pago (no hardcode)
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('medios_pago', 'Efectivo,QR / transf.,Otro', 'texto', 'Medios de pago',
   'Lista de medios de pago ofrecidos en el paso de cobro (separados por coma).', 'Caja')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (lectura autenticados; escritura directa admin)
-- ---------------------------------------------------------------------
alter table public.inscripciones enable row level security;
alter table public.cuotas        enable row level security;
alter table public.pagos         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['inscripciones','cuotas','pagos'] loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I;', t, t);
    execute format('create policy %I_admin_write on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin());', t, t);
  end loop;
end $$;

-- =====================================================================
-- FIN 0006
-- =====================================================================
