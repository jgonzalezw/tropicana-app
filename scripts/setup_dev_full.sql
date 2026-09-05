-- =====================================================================
-- TROPICANA - setup completo de una base NUEVA (ej. tropicana-dev).
-- Concatenacion en orden de las migraciones 0001..0012.
-- Pegar TODO en Supabase -> SQL Editor -> New query -> Run (una vez).
-- Idempotente: se puede re-correr sin romper. Solo ASCII en este encabezado.
-- Generado desde supabase/migrations/ (no editar a mano).
-- =====================================================================

-- ============================ 0001_etapa0_administracion.sql ============================
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

-- ============================ 0002_modulo_usuarios.sql ============================
-- =====================================================================
-- TROPICANA — 0002: módulo de permisos "usuarios" (independiente de
-- "administracion"), para que un rol pueda gestionar usuarios sin tener
-- acceso a roles, parámetros ni catálogos.
-- Ejecutar en Supabase → SQL Editor → New query.
-- =====================================================================

-- El Administrador tiene todas las acciones del nuevo módulo.
insert into public.rol_permisos (rol_id, modulo, accion, permitido)
select r.id, 'usuarios', a.accion, true
from public.roles r
cross join (values ('ver'),('crear'),('editar'),('eliminar')) as a(accion)
where r.clave = 'administrador'
on conflict (rol_id, modulo, accion) do nothing;

-- Nota: para que un rol Gerente ya existente tome el módulo Usuarios,
-- volvé a aplicarle la plantilla "Gerente (gestión)" desde la app
-- (Administración → Roles y permisos). Un solo clic.

-- ============================ 0003_temas.sql ============================
-- =====================================================================
-- TROPICANA — 0003: catálogo de TEMAS visuales + preferencia por usuario
-- ---------------------------------------------------------------------
-- Un tema es un juego de valores de estilo (tokens) sobre UNA misma
-- estructura de pantalla. El catálogo es ampliable por datos: sumar una
-- variante = insertar una fila acá (o desde un futuro editor), sin tocar
-- código. La preferencia de tema es POR USUARIO (columna perfiles.tema).
--
-- Ejecutar este archivo completo en Supabase → SQL Editor → New query.
-- Es idempotente: usa "if not exists" y "on conflict".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLA DE TEMAS  (una fila por tema; sus tokens en JSON)
-- ---------------------------------------------------------------------
create table if not exists public.temas (
  clave       text primary key,          -- 'tropicana', 'tropicana_alto_contraste'
  nombre      text not null,             -- etiqueta visible en el selector
  descripcion text,
  es_sistema  boolean not null default false,
  orden       int not null default 0,
  activo      boolean not null default true,
  -- Mapa de custom properties CSS: { "--fondo": "#1c1815", ... }
  tokens      jsonb not null default '{}'::jsonb,
  creado_en   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. TEMAS BASE
--    Los valores reflejan docs/design/README.md (Design Tokens) para el
--    tema estándar; la variante de alta accesibilidad sólo redefine los
--    tokens que cambia (el resto se hereda del tema base en CSS).
-- ---------------------------------------------------------------------
insert into public.temas (clave, nombre, descripcion, es_sistema, orden, tokens) values
  (
    'tropicana',
    'Tropicana estándar',
    'Tema oscuro de marca, cálido y redondeado.',
    true, 1,
    '{
      "--fondo": "#1c1815",
      "--fondo-panel": "#272220",
      "--fondo-elevado": "#302a25",
      "--borde": "rgba(244, 235, 221, 0.16)",
      "--texto": "#f4ebdd",
      "--texto-tenue": "#c8bbaa",
      "--primario": "#e08b4f",
      "--primario-hover": "#f6a06b",
      "--primario-activo": "#b2622d",
      "--primario-texto": "#1c1815",
      "--exito": "#a8bb88",
      "--exito-fill": "#3a4726",
      "--exito-texto": "#dcebc4",
      "--peligro": "#ffc0a0",
      "--peligro-fill": "#6b3714",
      "--peligro-texto": "#ffd3b5",
      "--advertencia": "#f6a06b",
      "--radio-tarjeta": "28px",
      "--radio-panel": "20px",
      "--radio-control": "999px",
      "--radio-chico": "18px",
      "--fuente-base": "17px",
      "--foco-grosor": "2px",
      "--borde-grosor": "1px",
      "--sombra": "none"
    }'::jsonb
  ),
  (
    'tropicana_alto_contraste',
    'Tropicana alta accesibilidad',
    'Variante para baja visión: más contraste, fuentes más grandes y foco/bordes marcados.',
    true, 2,
    '{
      "--fondo": "#141110",
      "--fondo-panel": "#221d1a",
      "--fondo-elevado": "#2c2621",
      "--borde": "rgba(253, 246, 234, 0.42)",
      "--texto": "#fdf7ec",
      "--texto-tenue": "#e6dccb",
      "--primario": "#ef9a5b",
      "--primario-hover": "#ffb27d",
      "--primario-activo": "#c56a30",
      "--primario-texto": "#141110",
      "--exito": "#b9cc98",
      "--exito-fill": "#46552f",
      "--exito-texto": "#e7f2ce",
      "--peligro": "#ffccb0",
      "--peligro-fill": "#85431a",
      "--peligro-texto": "#ffe0cc",
      "--fuente-base": "20px",
      "--foco-grosor": "4px",
      "--borde-grosor": "2px"
    }'::jsonb
  )
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 3. PREFERENCIA DE TEMA POR USUARIO
--    Columna en perfiles, con default al tema estándar y FK al catálogo.
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists tema text not null default 'tropicana';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'perfiles_tema_fkey'
      and table_schema = 'public' and table_name = 'perfiles'
  ) then
    alter table public.perfiles
      add constraint perfiles_tema_fkey
      foreign key (tema) references public.temas(clave)
      on update cascade on delete set default;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--    Lectura: cualquier autenticado (necesario para pintar la UI y el
--    selector). Escritura del catálogo: sólo administradores.
--    (El cambio de tema propio ya lo permite la política existente
--     perfiles_update_self, que deja al usuario editar su propia fila.)
-- ---------------------------------------------------------------------
alter table public.temas enable row level security;

drop policy if exists temas_select on public.temas;
create policy temas_select on public.temas
  for select to authenticated using (true);

drop policy if exists temas_admin_write on public.temas;
create policy temas_admin_write on public.temas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- FIN 0003
-- =====================================================================

-- ============================ 0004_usuarios_seguridad.sql ============================
-- =====================================================================
-- TROPICANA — 0004: seguridad de cuentas (bloqueo + intentos fallidos)
-- ---------------------------------------------------------------------
-- Amplía el manejo de contraseñas y estado de cuenta del módulo Usuarios:
--   • Bloqueo de acceso (manual o automático por intentos fallidos),
--     independiente de la baja de la persona (perfiles.activo).
--   • Contador de intentos fallidos de login por usuario.
--   • Denormaliza el email en perfiles, para poder buscar la cuenta por
--     correo ANTES de autenticar (chequear bloqueo y contar intentos).
--   • Umbrales configurables desde Parámetros (no hardcode): aviso (3) y
--     bloqueo (7), independientes entre sí.
--
-- Regla única de acceso (se aplica en el login y en el layout privado):
--     puede iniciar sesión  ⇔  activo = true  AND  bloqueado = false
--
-- Ejecutar este archivo completo en Supabase → SQL Editor → New query.
-- Idempotente: usa "if not exists" y "on conflict".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas de seguridad en perfiles
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists email             text,
  add column if not exists bloqueado         boolean not null default false,
  add column if not exists motivo_bloqueo    text,        -- 'auto' | 'manual' | null
  add column if not exists intentos_fallidos int not null default 0,
  add column if not exists bloqueado_en      timestamptz;

-- Backfill del email desde auth.users (una sola vez).
update public.perfiles p
set    email = u.email
from   auth.users u
where  u.id = p.id
  and  p.email is null;

create index if not exists perfiles_email_idx on public.perfiles(lower(email));

-- ---------------------------------------------------------------------
-- 2. Parámetros configurables (umbral de aviso y de bloqueo)
--    Independientes: el de aviso sólo avisa; el de bloqueo bloquea.
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('login_umbral_aviso',   '3', 'numero', 'Aviso por intentos fallidos',
   'Cantidad de intentos fallidos de login tras la cual el login muestra un aviso suave (no bloquea la cuenta).', 'Seguridad'),
  ('login_umbral_bloqueo', '7', 'numero', 'Bloqueo por intentos fallidos',
   'Cantidad de intentos fallidos de login tras la cual la cuenta se bloquea automáticamente. Un login exitoso antes de llegar reinicia el contador.', 'Seguridad')
on conflict (clave) do nothing;

-- =====================================================================
-- FIN 0004
-- =====================================================================

-- ============================ 0005_etapa1_entidades.sql ============================
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

-- ============================ 0006_etapa1_inscripcion.sql ============================
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

-- ============================ 0007_etapa1_asistencia.sql ============================
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

-- ============================ 0008_asistencia_ventana_retro.sql ============================
-- =====================================================================
-- TROPICANA — 0008: parámetro de ventana retroactiva de asistencia
-- ---------------------------------------------------------------------
-- Cuántas semanas hacia atrás se permite cargar asistencia (además de hoy).
-- Nunca a futuro. El pasado, solo con permiso asistencia.editar.
--
-- Ejecutar en Supabase → SQL Editor → New query. Idempotente y ADITIVO.
-- =====================================================================

insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('asistencia_semanas_retro', '2', 'numero', 'Semanas para cargar asistencia atrasada',
   'Cuántas semanas hacia atrás se puede registrar asistencia (además de hoy). Nunca se permite a futuro.', 'Asistencia')
on conflict (clave) do nothing;

-- =====================================================================
-- FIN 0008
-- =====================================================================

-- ============================ 0009_etapa1_suspension.sql ============================
-- =====================================================================
-- TROPICANA - 0009: suspension de clase + corrimiento de fin de ciclo
-- ---------------------------------------------------------------------
-- Mecanismo UNICO compartido: "correr el fin de ciclo un dia de clase".
-- Lo disparan dos casos, con la MISMA logica:
--   - falta individual tolerada (el alumno falta y tiene tolerancia),
--   - suspension de clase (la escuela suspende; corre a TODOS los mensuales
--     del curso; nunca gasta la tolerancia personal del alumno).
-- "Fin de ciclo" = vencimiento de la cuota vigente. Correrlo = moverlo a la
-- proxima fecha del patron semanal del curso. Los parciales no llevan cuota:
-- al no marcarse asistencia, no consumen y se difieren solos.
--
-- Ejecutar en Supabase -> SQL Editor -> New query. Idempotente y ADITIVO.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SESIONES: estado (dictada / suspendida) + motivo
-- ---------------------------------------------------------------------
alter table public.sesiones add column if not exists estado text not null default 'dictada';
alter table public.sesiones add column if not exists motivo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sesiones_estado_check') then
    alter table public.sesiones
      add constraint sesiones_estado_check check (estado in ('dictada', 'suspendida'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. CORRIMIENTOS DE FIN DE CICLO - traza del efecto (falta o suspension)
--    Una fila por (inscripcion, sesion): un corrimiento como maximo por
--    alumno por clase, para no aplicar el efecto dos veces.
-- ---------------------------------------------------------------------
create table if not exists public.corrimientos_ciclo (
  id                    bigint generated always as identity primary key,
  inscripcion_id        bigint not null references public.inscripciones(id) on delete cascade,
  alumno_id             bigint not null references public.alumnos(id) on delete cascade,
  cuota_id              bigint references public.cuotas(id) on delete set null,
  sesion_id             bigint references public.sesiones(id) on delete cascade,
  tipo                  text not null check (tipo in ('falta', 'suspension')),
  fecha_clase           date not null,
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

-- ============================ 0010_motor_planes_liquidacion.sql ============================
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

-- ============================ 0011_datos_plan_regular.sql ============================
-- =====================================================================
-- TROPICANA - 0011: migracion de datos - inscripciones actuales -> membresias
-- ---------------------------------------------------------------------
-- Convierte los datos que ya existen al modelo del motor (0010), SIN borrar
-- nada. Dos pasos:
--   1. Crea un "Plan Regular - <curso>" por cada curso (un plan por curso).
--   2. Backfill: las inscripciones 'mensual' pasan a ser membresias de ese
--      plan (plan_id, clases_plan, ciclo_numero).
--
-- Reglas de conversion (confirmadas con Javier 2026-09-05):
--   - N (cantidad_clases) = (dias por semana del curso) * 4  -> ciclo mensual
--     estandar. Ej: curso de 3 dias = 12; de 2 dias = 8; de 1 dia = 4.
--     Queda AJUSTABLE por plan despues. Si el curso no tiene dias_semana,
--     cantidad_clases queda NULL (hay que fijarlo a mano; se nota).
--   - precio del plan = cursos.precio_mensual.
--   - tolerancia_faltas = NULL  -> usa el parametro del sistema 'faltas_toleradas'.
--   - criterio_liquidacion = 1 (el activo del Paso 1).
--   - Solo se convierten inscripciones modalidad = 'mensual' (las de
--     clase/semana/medio_mes NO son Plan Regular; se veran en pasos posteriores).
--
-- fecha_fin de la membresia: NO se calcula aca (depende del calendario de
-- sesiones); lo setea/mantiene la logica de asistencia en 1B.
--
-- Ejecutar en Supabase -> SQL Editor -> New query. Idempotente y ADITIVO.
-- Solo ASCII en los comentarios.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Un Plan Regular por curso (idempotente: no duplica si ya existe uno).
-- ---------------------------------------------------------------------
insert into public.planes
  (nombre, tipo_servicio, curso_id, cantidad_clases, precio,
   criterio_liquidacion, tolerancia_faltas, renovable, activo)
select
  'Plan Regular - ' || c.nombre,
  'curso_regular',
  c.id,
  nullif(array_length(c.dias_semana, 1), 0) * 4,   -- N = dias/semana * 4 (NULL si sin dias)
  c.precio_mensual,
  1,
  null,                                            -- usa parametro del sistema (faltas_toleradas)
  true,
  c.activo
from public.cursos c
where not exists (
  select 1 from public.planes p
  where p.curso_id = c.id
    and p.tipo_servicio = 'curso_regular'
);

-- ---------------------------------------------------------------------
-- 2. Backfill de membresias: inscripciones 'mensual' sin plan -> su plan.
--    Solo toca filas con plan_id NULL (idempotente). ciclo_numero ya
--    tiene default 1; clases_plan hereda el N del plan.
-- ---------------------------------------------------------------------
update public.inscripciones i
set plan_id     = p.id,
    clases_plan = coalesce(i.clases_plan, p.cantidad_clases)
from public.planes p
where p.curso_id = i.curso_id
  and p.tipo_servicio = 'curso_regular'
  and i.modalidad = 'mensual'
  and i.plan_id is null;

-- =====================================================================
-- FIN 0011
-- =====================================================================

-- ============================ 0012_motor_venta_asistencia.sql ============================
-- =====================================================================
-- TROPICANA - 0012: soporte de esquema para 1B (venta + asistencia motor)
-- ---------------------------------------------------------------------
-- Aditivo e idempotente. No cambia datos existentes salvo el backfill de
-- planes.modalidad (etiqueta), que solo rellena filas nulas.
--
-- Agrega:
--   1. planes.modalidad     - etiqueta de la modalidad comercial del plan
--                             ('mensual','medio_mes','clase','semana','otro').
--                             Permite ubicar sin ambiguedad "el Plan Regular
--                             (mensual) del curso" en la venta.
--   2. inscripciones.clases_hechas  - contador de clases realizadas (1B.2).
--   3. inscripciones.bono_generado  - bono del ciclo por faltas con licencia,
--                             se consume en la renovacion (Paso 2).
--   4. asistencias.con_licencia     - marca de "falta con licencia" (1B.2).
--   5. parametro dias_compromiso_pago - tope de dias desde hoy para la
--                             fecha de compromiso de pago del saldo.
--
-- Solo ASCII en los comentarios.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. planes.modalidad (etiqueta comercial). Backfill por el nombre que
--    pusieron 0011 (Plan Regular) y el fix de datos (Plan Medio Mes).
-- ---------------------------------------------------------------------
alter table public.planes
  add column if not exists modalidad text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planes_modalidad_check'
  ) then
    alter table public.planes
      add constraint planes_modalidad_check
      check (modalidad is null or modalidad in
        ('mensual', 'medio_mes', 'clase', 'semana', 'otro'));
  end if;
end $$;

update public.planes
  set modalidad = 'mensual'
  where modalidad is null
    and tipo_servicio = 'curso_regular'
    and nombre like 'Plan Regular %';

update public.planes
  set modalidad = 'medio_mes'
  where modalidad is null
    and nombre like 'Plan Medio Mes %';

-- ---------------------------------------------------------------------
-- 2-3. Contador y bono en la membresia (inscripciones).
-- ---------------------------------------------------------------------
alter table public.inscripciones
  add column if not exists clases_hechas int not null default 0;   -- clases dictadas contadas hacia clases_plan
alter table public.inscripciones
  add column if not exists bono_generado int not null default 0;   -- faltas con licencia del ciclo (tope tolerancia); se usa al renovar

-- ---------------------------------------------------------------------
-- 4. asistencias.con_licencia (falta justificada -> genera bono).
-- ---------------------------------------------------------------------
alter table public.asistencias
  add column if not exists con_licencia boolean not null default false;

-- ---------------------------------------------------------------------
-- 5. Parametro: tope de dias para la fecha de compromiso de pago.
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('dias_compromiso_pago', '30', 'numero', 'Dias maximos de compromiso de pago',
   'Cuando queda saldo, la fecha de compromiso de pago no puede superar hoy mas esta cantidad de dias.', 'Cobros')
on conflict (clave) do nothing;

-- =====================================================================
-- FIN 0012
-- =====================================================================

