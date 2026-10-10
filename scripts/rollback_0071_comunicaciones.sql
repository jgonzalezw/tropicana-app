-- Rollback de la 0071 y la 0072 (R20 E4a). SOLO DEV: en produccion no hay reversion
-- destructiva una vez que haya datos.
-- ABORTA si hay CUALQUIER trabajo editorial de usuarios: una version que no este en
-- borrador, que no sea predeterminada, creada por una persona o con datos de
-- aprobacion/publicacion/retiro; cualquier fila de historial; una asignacion con
-- version o fuera de legado. Solo se revierte lo que dejo la migracion, sin tocar.
do $$
declare
  n integer;
begin
  if to_regclass('public.contenido_versiones') is not null then
    select count(*) into n from public.contenido_versiones
     where estado <> 'borrador' or origen <> 'predeterminado' or creado_por is not null
        or aprobado_en is not null or publicado_en is not null or retirado_en is not null;
    if n > 0 then raise exception 'Rollback 0071 abortado: % version(es) con trabajo editorial', n; end if;
  end if;
  if to_regclass('public.contenido_usos_historial') is not null then
    select count(*) into n from public.contenido_usos_historial;
    if n > 0 then raise exception 'Rollback 0071 abortado: % fila(s) de historial', n; end if;
  end if;
  if to_regclass('public.contenido_usos') is not null then
    select count(*) into n from public.contenido_usos where version_id is not null or modo <> 'legado';
    if n > 0 then raise exception 'Rollback 0071 abortado: % asignacion(es) liberada(s)', n; end if;
  end if;
end;
$$;

-- Orden: las dos funciones publicas (dependen del tipo de fila de las tablas), las tablas
-- (con sus triggers) y, al final, las funciones de los triggers.
drop function if exists public.liberar_contenido(text, text, text, bigint, text, text, text, text);
drop function if exists public.cambiar_estado_version(bigint, text, text, text, text, text);
drop table if exists public.contenido_usos_historial;
drop table if exists public.contenido_usos;
drop table if exists public.contenido_versiones;
drop table if exists public.contenidos;
drop function if exists public.contenidos_guardia();
drop function if exists public.contenido_versiones_guardia();
drop function if exists public.contenido_usos_guardia();
drop function if exists public.contenido_usos_historial_solo_insert();
notify pgrst, 'reload schema';
