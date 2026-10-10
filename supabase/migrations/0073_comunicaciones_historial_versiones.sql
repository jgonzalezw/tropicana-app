-- =====================================================================
-- TROPICANA - 0073: historial editorial de versiones (R20 E4a)
-- ---------------------------------------------------------------------
-- Cada cambio de estado de una version (incluido el retorno de en_revision a
-- borrador, que hasta ahora no dejaba rastro) queda con actor, fecha y motivo.
-- Solo se agrega; permanente (D-E4a-3). Solo ASCII. Aditiva: no toca datos.
-- =====================================================================

create table if not exists public.contenido_versiones_historial (
  id          bigint generated always as identity primary key,
  version_id  bigint not null references public.contenido_versiones(id) on delete restrict,
  de_estado   text not null check (de_estado in ('borrador', 'en_revision', 'aprobado', 'publicado', 'retirado')),
  a_estado    text not null check (a_estado in ('borrador', 'en_revision', 'aprobado', 'publicado', 'retirado')),
  motivo      text,
  actor       uuid not null references public.perfiles(id) on delete no action,
  creado_en   timestamptz not null default now(),
  check (de_estado <> a_estado)
);
comment on table public.contenido_versiones_historial is
  'Cada cambio de estado de una version, con quien lo hizo y cuando. Solo se agrega; permanente (D-E4a-3).';
create index if not exists contenido_versiones_historial_version_idx on public.contenido_versiones_historial (version_id);

create or replace function public.contenido_versiones_historial_solo_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'contenido_versiones_historial es de solo agregar: no se edita ni se borra';
end;
$$;
drop trigger if exists contenido_versiones_historial_no_update on public.contenido_versiones_historial;
create trigger contenido_versiones_historial_no_update
  before update or delete on public.contenido_versiones_historial
  for each row execute function public.contenido_versiones_historial_solo_insert();

alter table public.contenido_versiones_historial enable row level security;
drop policy if exists contenido_versiones_historial_select on public.contenido_versiones_historial;
create policy contenido_versiones_historial_select on public.contenido_versiones_historial
  for select to authenticated using (public.es_admin());
revoke all on table public.contenido_versiones_historial from public, anon, authenticated;
grant select on table public.contenido_versiones_historial to authenticated;
revoke execute on function public.contenido_versiones_historial_solo_insert() from public, anon, authenticated;

-- Misma firma que la 0071: ahora registra cada transicion en el historial, en la
-- misma transaccion que el cambio (los dos, o ninguno).
create or replace function public.cambiar_estado_version(
  p_version_id  bigint,
  p_a_estado    text,
  p_hash_visto  text default null,
  p_motivo      text default null,
  p_etiqueta    text default null,
  p_url_oficial text default null
)
returns public.contenido_versiones
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.contenido_versiones;
  v_de text;
begin
  if not public.es_admin() then
    raise exception 'Solo el Administrador cambia el estado de una version' using errcode = '42501';
  end if;
  select * into v from public.contenido_versiones where id = p_version_id for update;
  if not found then
    raise exception 'La version % no existe', p_version_id;
  end if;
  v_de := v.estado;

  if p_a_estado in ('aprobado', 'publicado') and p_hash_visto is distinct from v.hash then
    raise exception 'El hash que se vio (%) no es el de la version (%)', p_hash_visto, v.hash;
  end if;

  if p_a_estado = 'en_revision' or p_a_estado = 'borrador' then
    update public.contenido_versiones set estado = p_a_estado where id = v.id returning * into v;
  elsif p_a_estado = 'aprobado' then
    update public.contenido_versiones
       set estado = 'aprobado', aprobado_en = now(), aprobado_por = auth.uid()
     where id = v.id returning * into v;
  elsif p_a_estado = 'publicado' then
    if btrim(coalesce(p_etiqueta, '')) = '' then
      raise exception 'Publicar exige una etiqueta';
    end if;
    update public.contenido_versiones
       set estado = 'publicado', publicado_en = now(), publicado_por = auth.uid(),
           etiqueta = p_etiqueta, url_oficial = p_url_oficial
     where id = v.id returning * into v;
  elsif p_a_estado = 'retirado' then
    if btrim(coalesce(p_motivo, '')) = '' then
      raise exception 'Retirar exige un motivo';
    end if;
    update public.contenido_versiones
       set estado = 'retirado', retirado_en = now(), retirado_por = auth.uid(), retirado_motivo = p_motivo
     where id = v.id returning * into v;
  else
    raise exception 'Estado desconocido: %', p_a_estado;
  end if;

  insert into public.contenido_versiones_historial (version_id, de_estado, a_estado, motivo, actor)
  values (v.id, v_de, v.estado, nullif(btrim(coalesce(p_motivo, '')), ''), auth.uid());
  return v;
end;
$$;
revoke execute on function public.cambiar_estado_version(bigint, text, text, text, text, text) from public, anon;
grant execute on function public.cambiar_estado_version(bigint, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
