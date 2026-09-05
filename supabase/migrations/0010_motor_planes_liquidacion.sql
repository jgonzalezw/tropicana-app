-- =====================================================================
-- TROPICANA - 0010: motor de planes/membresias + liquidacion (sub-hito 1A)
-- ---------------------------------------------------------------------
-- Reencuadre a "todo es un PLAN": un plan (config) se vende como MEMBRESIA
-- (instancia con contador y calendario) que se usa en SESIONES. Alcance de
-- este sub-hito: Plan Regular (1 curso) + liquidacion criterio (1).
--
-- Este archivo NO renombra 'inscripciones' (el rename cosmetico a
-- 'membresias' se hace en la pasada de alineacion, paso 6). Aca se
-- GENERALIZA 'inscripciones' como la membresia.
--
-- Lo que agrega:
--   1. planes            - configuracion vendible (Plan Regular).
--   2. inscripciones     - columnas de membresia (plan_id, clases_plan,
--                          bono_arrastrado, tolerancia_faltas, ciclo_numero,
--                          membresia_anterior_id, fecha_fin) + estado
--                          'completada'.
--   3. cuotas            - fecha_compromiso (fecha maxima de compromiso de
--                          pago del saldo, para notificar vencimientos).
--   4. cursos            - cupo (atributo de la clase; las membresias lo colman).
--   5. comisiones_devengadas / liquidaciones / liquidacion_items.
--   6. pagos.liquidacion_id (gancho: ata el pago al profesor a su liquidacion).
--   7. parametro periodicidad_liquidacion.
--
-- Fuera de este sub-hito (van en 1B/1C por codigo, no en el esquema):
--   - re-apuntar el corrimiento (0009) a membresia.fecha_fin + contador.
--   - registrar "falta con licencia" y el bono generado en el ciclo.
--   - venta del Plan Regular, conteo de clases realizadas y el calculo de
--     la liquidacion criterio (1).
--
-- Ejecutar en Supabase -> SQL Editor -> New query. Idempotente y ADITIVO.
-- Solo ASCII en los comentarios (evita errores de pegado en Supabase).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PLANES - configuracion de lo que se vende (seccion 2 del motor).
--    Alcance 1A: tipo_servicio 'curso_regular' sobre 1 curso. Multi-curso
--    y otros tipos (particular, alquiler, prueba) = pasos posteriores.
-- ---------------------------------------------------------------------
create table if not exists public.planes (
  id                   bigint generated always as identity primary key,
  nombre               text not null,
  tipo_servicio        text not null default 'curso_regular'
                         check (tipo_servicio in
                           ('curso_regular', 'taller', 'particular', 'alquiler', 'prueba')),
  curso_id             bigint references public.cursos(id) on delete restrict,
  cantidad_clases      int,                 -- N de clases del ciclo (fijo)
  precio               numeric(10,2) not null default 0,  -- tarifa por ciclo, snapshot al vender
  criterio_liquidacion int not null default 1
                         check (criterio_liquidacion between 1 and 4),
  -- Faltas con licencia toleradas por ciclo. null = usa el parametro del
  -- sistema 'faltas_toleradas'; se puede fijar por plan.
  tolerancia_faltas    int,
  renovable            boolean not null default true,
  activo               boolean not null default true,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);
create index if not exists planes_curso_idx on public.planes(curso_id);
create index if not exists planes_tipo_idx on public.planes(tipo_servicio);

-- ---------------------------------------------------------------------
-- 2. INSCRIPCIONES = MEMBRESIA. Se generalizan sus columnas.
--    Ya tiene: alumno_id, curso_id, modalidad, fecha_inicio, estado,
--    clases_total, dias_elegidos, precio_aplicado, creado_en.
-- ---------------------------------------------------------------------
alter table public.inscripciones
  add column if not exists plan_id bigint references public.planes(id) on delete restrict;
alter table public.inscripciones
  add column if not exists clases_plan int;           -- N del ciclo = plan.cantidad_clases + bono arrastrado
alter table public.inscripciones
  add column if not exists bono_arrastrado int not null default 0;  -- bono de tolerancia heredado del ciclo anterior
alter table public.inscripciones
  add column if not exists tolerancia_faltas int;     -- snapshot del plan al vender (null = parametro del sistema)
alter table public.inscripciones
  add column if not exists ciclo_numero int not null default 1;
alter table public.inscripciones
  add column if not exists membresia_anterior_id bigint
    references public.inscripciones(id) on delete set null;  -- continuidad (renovacion)
alter table public.inscripciones
  add column if not exists fecha_fin date;             -- ultima clase prevista por calendario; base de "por vencer"

create index if not exists inscripciones_plan_idx on public.inscripciones(plan_id);
create index if not exists inscripciones_anterior_idx on public.inscripciones(membresia_anterior_id);

-- estado: agregar 'completada' (membresia con contador = clases_plan).
-- Se reemplaza el check existente (cualquiera que mencione 'estado').
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.inscripciones'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado%'
  loop
    execute format('alter table public.inscripciones drop constraint %I;', c.conname);
  end loop;
  alter table public.inscripciones
    add constraint inscripciones_estado_check
    check (estado in ('activa', 'completada', 'baja'));
end $$;

-- ---------------------------------------------------------------------
-- 3. CUOTAS - cobro por ciclo. Se agrega la fecha de compromiso de pago.
--    (El "cobro por ciclo" = una cuota por membresia/ciclo; lo arma el
--    codigo de venta en 1B. El esquema de cuotas/pagos no cambia mas.)
--    fecha_compromiso: fecha maxima para pagar el saldo pendiente, usada
--    para notificar vencimientos (matiz 3). 'vencimiento' se conserva.
-- ---------------------------------------------------------------------
alter table public.cuotas
  add column if not exists fecha_compromiso date;

-- ---------------------------------------------------------------------
-- 4. CURSOS - cupo de la clase (atributo). Las membresias colman el cupo;
--    la reserva/choques es Etapa 2, pero el cupo se modela desde ya.
-- ---------------------------------------------------------------------
alter table public.cursos
  add column if not exists cupo int;

-- ---------------------------------------------------------------------
-- 5. COMISIONES DEVENGADAS - lo que la academia le debe al profesor.
--    Una fila por (membresia, tipo, profesor). Criterio (1): se devenga
--    cuando la membresia esta cobrada (saldo 0) Y completada; base = lo
--    cobrado de la membresia; monto = pct congelado (asignaciones) x base.
--    'referido' queda como item gancho (D3).
-- ---------------------------------------------------------------------
create table if not exists public.comisiones_devengadas (
  id             bigint generated always as identity primary key,
  profesor_id    bigint not null references public.profesores(id) on delete restrict,
  plan_id        bigint references public.planes(id) on delete set null,
  membresia_id   bigint references public.inscripciones(id) on delete cascade,
  criterio       int not null default 1 check (criterio between 1 and 4),
  periodo        date,                      -- periodo de liquidacion al que cae (1er dia)
  tipo           text not null default 'comision' check (tipo in ('comision', 'referido')),
  base           numeric(10,2) not null default 0,   -- lo cobrado que da origen
  monto          numeric(10,2) not null default 0,   -- comision resultante
  origen         text,                      -- traza legible del calculo
  liquidacion_id bigint,                    -- se setea al incluirlo en una liquidacion (FK en seccion 6)
  creado_en      timestamptz not null default now(),
  unique (membresia_id, tipo, profesor_id)
);
create index if not exists comisiones_profesor_idx on public.comisiones_devengadas(profesor_id);
create index if not exists comisiones_membresia_idx on public.comisiones_devengadas(membresia_id);
create index if not exists comisiones_periodo_idx on public.comisiones_devengadas(periodo);

-- ---------------------------------------------------------------------
-- 6. LIQUIDACIONES - corte por profesor y periodo. neto = devengado - pagado.
--    Los pagos al profesor ya existen como pagos.tipo='pago'.
-- ---------------------------------------------------------------------
create table if not exists public.liquidaciones (
  id              bigint generated always as identity primary key,
  profesor_id     bigint not null references public.profesores(id) on delete restrict,
  periodo         date not null,             -- 1er dia del periodo liquidado
  periodicidad    text not null default 'mes'
                    check (periodicidad in ('semana', 'mes', 'membresia')),
  estado          text not null default 'abierta'
                    check (estado in ('abierta', 'cerrada', 'pagada')),
  total_devengado numeric(10,2) not null default 0,
  total_pagado    numeric(10,2) not null default 0,
  neto            numeric(10,2) not null default 0,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (profesor_id, periodo, periodicidad)
);
create index if not exists liquidaciones_profesor_idx on public.liquidaciones(profesor_id);
create index if not exists liquidaciones_periodo_idx on public.liquidaciones(periodo);

create table if not exists public.liquidacion_items (
  id             bigint generated always as identity primary key,
  liquidacion_id bigint not null references public.liquidaciones(id) on delete cascade,
  comision_id    bigint references public.comisiones_devengadas(id) on delete set null,
  membresia_id   bigint references public.inscripciones(id) on delete set null,
  descripcion    text,
  monto          numeric(10,2) not null default 0,
  creado_en      timestamptz not null default now()
);
create index if not exists liquidacion_items_liq_idx on public.liquidacion_items(liquidacion_id);

-- FK diferida de comisiones_devengadas.liquidacion_id -> liquidaciones(id).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'comisiones_devengadas_liquidacion_fk'
  ) then
    alter table public.comisiones_devengadas
      add constraint comisiones_devengadas_liquidacion_fk
      foreign key (liquidacion_id) references public.liquidaciones(id) on delete set null;
  end if;
end $$;

-- pagos.liquidacion_id - ata el pago al profesor a su liquidacion (gancho 1C).
alter table public.pagos
  add column if not exists liquidacion_id bigint references public.liquidaciones(id) on delete set null;
create index if not exists pagos_liquidacion_idx on public.pagos(liquidacion_id);

-- ---------------------------------------------------------------------
-- 7. PARAMETRO - periodicidad de liquidacion (D4).
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('periodicidad_liquidacion', 'mes', 'texto', 'Periodicidad de liquidacion',
   'Cada cuanto se cierra la liquidacion del profesor: semana (vencida), mes (vencido) o membresia (al completarse). Valores: semana, mes, membresia.', 'Comisiones')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (lectura autenticados; escritura directa admin).
--    Los operativos escriben por server actions con service_role.
-- ---------------------------------------------------------------------
alter table public.planes                enable row level security;
alter table public.comisiones_devengadas enable row level security;
alter table public.liquidaciones         enable row level security;
alter table public.liquidacion_items     enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'planes','comisiones_devengadas','liquidaciones','liquidacion_items'
  ] loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I;', t, t);
    execute format('create policy %I_admin_write on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin());', t, t);
  end loop;
end $$;

-- =====================================================================
-- FIN 0010
-- =====================================================================
