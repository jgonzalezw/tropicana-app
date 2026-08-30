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
