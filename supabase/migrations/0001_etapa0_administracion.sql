-- =====================================================================
-- TROPICANA — Etapa 0: Administración (usuarios, roles, permisos, parámetros)
-- =====================================================================
-- Ejecutar este archivo completo en Supabase → SQL Editor → New query.
-- Es idempotente en lo posible: usa "if not exists" y "on conflict".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ROLES
-- ---------------------------------------------------------------------
create table if not exists public.roles (
  id          bigint generated always as identity primary key,
  clave       text not null unique,          -- 'administrador', 'profesor'
  nombre      text not null,                 -- 'Administrador', 'Profesor'
  descripcion text,
  es_sistema  boolean not null default false, -- roles base que no se pueden borrar
  creado_en   timestamptz not null default now()
);

insert into public.roles (clave, nombre, descripcion, es_sistema) values
  ('administrador', 'Administrador', 'Acceso completo a la operación y la configuración.', true),
  ('profesor',      'Profesor',      'Toma asistencia y consulta sus clases y liquidaciones.', true)
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 2. PERFILES  (una fila por cuenta de acceso de Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text,
  apellido   text,
  whatsapp   text,
  rol_id     bigint not null references public.roles(id),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists perfiles_rol_id_idx on public.perfiles(rol_id);

-- ---------------------------------------------------------------------
-- 3. PERMISOS por módulo y acción (matriz configurable por rol)
-- ---------------------------------------------------------------------
create table if not exists public.rol_permisos (
  id        bigint generated always as identity primary key,
  rol_id    bigint not null references public.roles(id) on delete cascade,
  modulo    text not null,   -- 'alumnos', 'profesores', 'cursos', ...
  accion    text not null,   -- 'ver', 'crear', 'editar', 'eliminar'
  permitido boolean not null default false,
  unique (rol_id, modulo, accion)
);

create index if not exists rol_permisos_rol_id_idx on public.rol_permisos(rol_id);

-- ---------------------------------------------------------------------
-- 4. PARÁMETROS operativos (clave/valor tipado)
-- ---------------------------------------------------------------------
create table if not exists public.parametros (
  clave       text primary key,     -- 'moneda_simbolo', 'tolerancia_faltas', ...
  valor       text not null,
  tipo        text not null default 'texto', -- 'texto' | 'numero' | 'booleano'
  nombre      text not null,        -- etiqueta legible en el panel
  descripcion text,
  grupo       text not null default 'General',
  actualizado_en timestamptz not null default now()
);

insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('moneda_simbolo',            'Bs.', 'texto',   'Símbolo de moneda',            'Símbolo que se muestra junto a los montos.', 'Moneda'),
  ('moneda_nombre',             'Boliviano', 'texto', 'Nombre de la moneda',       'Nombre completo de la moneda operativa.', 'Moneda'),
  ('tolerancia_faltas',         '1',   'numero',  'Faltas con tolerancia',        'Cantidad de faltas por ciclo que generan una clase de reposición.', 'Asistencia'),
  ('mayoria_edad',              '18',  'numero',  'Mayoría de edad',              'Edad a partir de la cual el alumno no requiere tutor.', 'Alumnos'),
  ('vencimiento_paquete_meses', '3',   'numero',  'Vencimiento de paquetes (meses)', 'Meses desde la compra tras los cuales vencen las horas de un paquete de clases particulares.', 'Clases Particulares'),
  ('rezago_liquidacion_meses',  '1',   'numero',  'Rezago de liquidación (meses)', 'Meses de rezago para pagar la liquidación de un profesor a mes vencido.', 'Liquidación')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 5. CATÁLOGOS parametrizables (estructura genérica editable desde la app)
-- ---------------------------------------------------------------------
create table if not exists public.catalogos (
  id          bigint generated always as identity primary key,
  clave       text not null unique,   -- 'canal_captacion', 'categoria_comprador', ...
  nombre      text not null,          -- 'Canal de captación'
  descripcion text,
  es_sistema  boolean not null default false
);

create table if not exists public.catalogo_valores (
  id          bigint generated always as identity primary key,
  catalogo_id bigint not null references public.catalogos(id) on delete cascade,
  valor       text not null,          -- clave interna, ej. 'redes_sociales'
  etiqueta    text not null,          -- texto visible, ej. 'Redes Sociales'
  orden       int not null default 0,
  activo      boolean not null default true,
  unique (catalogo_id, valor)
);

create index if not exists catalogo_valores_catalogo_id_idx on public.catalogo_valores(catalogo_id);

-- Catálogos base
insert into public.catalogos (clave, nombre, descripcion, es_sistema) values
  ('canal_captacion',     'Canal de captación',      'Cómo conoció el alumno la escuela.', true),
  ('categoria_comprador', 'Categoría de comprador',  'Categoría para tarifas de paquetes y alquiler de sala.', true),
  ('motivo_cobro',        'Motivos de cobro',        'Motivos disponibles al registrar un cobro en Caja.', true),
  ('motivo_pago',         'Motivos de pago',         'Motivos disponibles al registrar un pago en Caja.', true),
  ('unidad_medida',       'Unidades de medida',      'Unidades para productos de inventario.', true),
  ('familia_producto',    'Familias de producto',    'Categorías o familias de productos de inventario.', true)
on conflict (clave) do nothing;

-- Valores iniciales de cada catálogo
insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden)
select c.id, v.valor, v.etiqueta, v.orden
from public.catalogos c
join (values
  ('canal_captacion', 'redes_sociales', 'Redes Sociales', 1),
  ('canal_captacion', 'recomendacion',  'Recomendación',   2),
  ('canal_captacion', 'volante',        'Volante',          3),
  ('canal_captacion', 'otro',           'Otro',             9),
  ('categoria_comprador', 'alumno',            'Alumno',            1),
  ('categoria_comprador', 'profesor_tropicana','Profesor Tropicana',2),
  ('categoria_comprador', 'profesor_externo',  'Profesor Externo',  3),
  ('categoria_comprador', 'tercero',           'Tercero',           4),
  ('motivo_cobro', 'inscripcion',       'Inscripción',        1),
  ('motivo_cobro', 'mensualidad',       'Mensualidad',        2),
  ('motivo_cobro', 'venta_paquete',     'Venta de paquete',   3),
  ('motivo_cobro', 'venta_producto',    'Venta de producto',  4),
  ('motivo_cobro', 'otro',              'Otro',               9),
  ('motivo_pago', 'comision_profesor',  'Comisión a profesor',1),
  ('motivo_pago', 'otro_pago_profesor', 'Otros pagos a profesor',2),
  ('motivo_pago', 'gasto_costo_fijo',   'Gasto o costo fijo', 3),
  ('motivo_pago', 'pago_proveedor',     'Pago a proveedor',   4),
  ('motivo_pago', 'otro',               'Otro',               9),
  ('unidad_medida', 'unidad', 'Unidad', 1),
  ('unidad_medida', 'caja',   'Caja',   2),
  ('unidad_medida', 'litro',  'Litro',  3),
  ('familia_producto', 'bebidas',     'Bebidas',      1),
  ('familia_producto', 'alimentos',   'Alimentos',    2),
  ('familia_producto', 'accesorios',  'Accesorios',   3)
) as v(catalogo_clave, valor, etiqueta, orden) on v.catalogo_clave = c.clave
on conflict (catalogo_id, valor) do nothing;

-- ---------------------------------------------------------------------
-- 6. FUNCIÓN AUXILIAR: ¿el usuario actual es administrador?
-- ---------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.perfiles p
    join public.roles r on r.id = p.rol_id
    where p.id = auth.uid()
      and p.activo = true
      and r.clave = 'administrador'
  );
$$;

-- ---------------------------------------------------------------------
-- 7. TRIGGER: crear el perfil automáticamente cuando se crea una cuenta
--    El PRIMER usuario del sistema queda como Administrador; el resto,
--    como Profesor (el admin luego les cambia el rol desde la app).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol_id bigint;
  v_hay_perfiles boolean;
begin
  select exists(select 1 from public.perfiles) into v_hay_perfiles;

  if v_hay_perfiles then
    select id into v_rol_id from public.roles where clave = 'profesor';
  else
    select id into v_rol_id from public.roles where clave = 'administrador';
  end if;

  insert into public.perfiles (id, nombre, apellido, whatsapp, rol_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    coalesce(new.raw_user_meta_data->>'whatsapp', new.phone, ''),
    v_rol_id
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 8. PERMISOS BASE de los roles del sistema
-- ---------------------------------------------------------------------
-- Administrador: todo permitido en todos los módulos.
insert into public.rol_permisos (rol_id, modulo, accion, permitido)
select r.id, m.modulo, a.accion, true
from public.roles r
cross join (values
  ('alumnos'),('profesores'),('cursos'),('inscripciones'),('asistencia'),
  ('pagos'),('comisiones'),('costos'),('particulares'),('inventario'),
  ('caja'),('dashboard'),('administracion')
) as m(modulo)
cross join (values ('ver'),('crear'),('editar'),('eliminar')) as a(accion)
where r.clave = 'administrador'
on conflict (rol_id, modulo, accion) do nothing;

-- Profesor: ver dashboard y su asistencia; tomar/editar asistencia.
insert into public.rol_permisos (rol_id, modulo, accion, permitido)
select r.id, x.modulo, x.accion, x.permitido
from public.roles r
join (values
  ('dashboard',  'ver',    true),
  ('asistencia', 'ver',    true),
  ('asistencia', 'crear',  true),
  ('asistencia', 'editar', true),
  ('comisiones', 'ver',    true)
) as x(modulo, accion, permitido) on true
where r.clave = 'profesor'
on conflict (rol_id, modulo, accion) do nothing;

-- ---------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.roles            enable row level security;
alter table public.perfiles         enable row level security;
alter table public.rol_permisos     enable row level security;
alter table public.parametros       enable row level security;
alter table public.catalogos        enable row level security;
alter table public.catalogo_valores enable row level security;

-- Lectura: cualquier usuario autenticado.
-- Escritura: solo administradores (o el propio perfil, en perfiles).

-- ROLES
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated using (true);
drop policy if exists roles_admin_write on public.roles;
create policy roles_admin_write on public.roles
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- PERFILES
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated using (true);
drop policy if exists perfiles_update_self on public.perfiles;
create policy perfiles_update_self on public.perfiles
  for update to authenticated
  using (id = auth.uid() or public.es_admin())
  with check (id = auth.uid() or public.es_admin());
drop policy if exists perfiles_admin_all on public.perfiles;
create policy perfiles_admin_all on public.perfiles
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- ROL_PERMISOS
drop policy if exists rol_permisos_select on public.rol_permisos;
create policy rol_permisos_select on public.rol_permisos
  for select to authenticated using (true);
drop policy if exists rol_permisos_admin_write on public.rol_permisos;
create policy rol_permisos_admin_write on public.rol_permisos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- PARAMETROS
drop policy if exists parametros_select on public.parametros;
create policy parametros_select on public.parametros
  for select to authenticated using (true);
drop policy if exists parametros_admin_write on public.parametros;
create policy parametros_admin_write on public.parametros
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- CATALOGOS
drop policy if exists catalogos_select on public.catalogos;
create policy catalogos_select on public.catalogos
  for select to authenticated using (true);
drop policy if exists catalogos_admin_write on public.catalogos;
create policy catalogos_admin_write on public.catalogos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- CATALOGO_VALORES
drop policy if exists catalogo_valores_select on public.catalogo_valores;
create policy catalogo_valores_select on public.catalogo_valores
  for select to authenticated using (true);
drop policy if exists catalogo_valores_admin_write on public.catalogo_valores;
create policy catalogo_valores_admin_write on public.catalogo_valores
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- FIN Etapa 0
-- =====================================================================
