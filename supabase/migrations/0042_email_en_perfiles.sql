-- =====================================================================
-- TROPICANA - 0042: el trigger de alta copia el email a perfiles
-- ---------------------------------------------------------------------
-- PARA QUE. `perfiles.email` existe desde la 0001 como columna
-- "denormalizada desde auth.users para buscar por email" (comentario del
-- tipo `Perfil` en src/lib/tipos.ts), pero el trigger `handle_new_user()`
-- nunca la llenaba al crear el perfil -- quedaba siempre en NULL, aunque
-- el email sí estaba en auth.users. Por eso ninguna pantalla podía
-- mostrarlo ni editarlo: el dato nunca llegaba a `perfiles`.
--
-- Javier, 2026-09-17: crea la cuenta de Oscar Nuñez y despues no puede
-- ver con que correo quedo -- el sintoma de este bug.
--
-- QUE HACE
-- 1. Corrige `handle_new_user()` para que copie `new.email` al insertar.
-- 2. Backfill: los perfiles ya creados con email sin copiar se completan
--    leyendo auth.users (no toca ningun otro dato).
--
-- Idempotente y ADITIVA.
-- =====================================================================

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

  insert into public.perfiles (id, nombre, apellido, whatsapp, rol_id, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    coalesce(new.raw_user_meta_data->>'whatsapp', new.phone, ''),
    v_rol_id,
    new.email
  );
  return new;
end;
$$;

-- Backfill de las cuentas ya creadas que quedaron sin email en el perfil.
update public.perfiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null and u.email is not null;

-- =====================================================================
-- FIN 0042
-- =====================================================================
