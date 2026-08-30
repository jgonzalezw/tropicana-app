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
