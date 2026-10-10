-- =====================================================================
-- TROPICANA - 0071: contenidos de comunicaciones (R20 E4a, estructura)
-- ---------------------------------------------------------------------
-- PARA QUE. Los textos de los avisos viven hoy en el codigo
-- (src/lib/comunicaciones/predeterminados). E4a instala la base para que un
-- texto tenga versiones, estados editoriales y una asignacion a cada punto de
-- la operacion, SIN conectar nada: todo nace en `legado` y la operacion sigue
-- usando el codigo. Conectar es E5.
--
-- QUE INSTALA (propuesta docs/relevamientos/2026-10-10-r20-propuesta-e4.md):
--   contenidos, contenido_versiones, contenido_usos (asignaciones por uso,
--   variante y canal) y contenido_usos_historial; sus triggers de
--   inmutabilidad; las funciones cambiar_estado_version y liberar_contenido.
--
-- QUE NO HACE. No importa ningun texto (lo hace la 0072, generada desde el
-- codigo), no aprueba, no publica, no libera, no toca ninguna tabla existente.
--
-- PERMISOS (D-E4a-1/2/3). Solo el Administrador aprueba, publica y libera.
-- Nadie tiene escritura directa sobre las cuatro tablas: se escribe por las
-- funciones, que son security definer, verifican es_admin() adentro y no se
-- ejecutan como anon. La marca interna `tropicana.liberando` NO autoriza nada:
-- solo evita que un update ajeno a la funcion pase por descuido. El historial
-- editorial es permanente (los actores no se pueden borrar de perfiles).
--
-- VUELTA ATRAS (solo dev): scripts/rollback_0071_comunicaciones.sql; aborta
-- si hay cualquier trabajo editorial de usuarios.
--
-- Solo ASCII en los comentarios.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------
create table if not exists public.contenidos (
  id          bigint generated always as identity primary key,
  clave       text not null unique,
  caso        text not null check (caso ~ '^N[0-9]{2}$'),
  variante    text not null check (variante ~ '^[a-z][a-z_]*$'),
  canal       text not null check (canal in ('whatsapp', 'email')),
  tipo        text not null check (tipo in ('aviso', 'documento', 'politica')),
  finalidad   text not null check (finalidad in ('servicio', 'comercial')),
  nombre      text not null check (btrim(nombre) <> ''),
  descripcion text,
  creado_en   timestamptz not null default now(),
  check (clave = caso || '.' || variante || '.' || canal),
  unique (id, variante, canal)
);
comment on table public.contenidos is
  'Un texto de comunicacion: una fila por (caso, variante, canal). Nunca se borra. Sus versiones estan en contenido_versiones.';

create table if not exists public.contenido_versiones (
  id            bigint generated always as identity primary key,
  contenido_id  bigint not null references public.contenidos(id) on delete restrict,
  numero        integer not null check (numero > 0),
  cuerpo        text not null check (cuerpo <> ''),
  asunto        text,
  esquema       jsonb not null,
  hash          text not null check (hash ~ '^[0-9a-f]{64}$'),
  origen        text not null check (origen in ('predeterminado', 'editado')),
  estado        text not null default 'borrador'
                  check (estado in ('borrador', 'en_revision', 'aprobado', 'publicado', 'retirado')),
  etiqueta      text,
  url_oficial   text,
  aprobado_en   timestamptz,
  aprobado_por  uuid references public.perfiles(id) on delete no action,
  publicado_en  timestamptz,
  publicado_por uuid references public.perfiles(id) on delete no action,
  retirado_en   timestamptz,
  retirado_por  uuid references public.perfiles(id) on delete no action,
  retirado_motivo text,
  creado_en     timestamptz not null default now(),
  creado_por    uuid references public.perfiles(id) on delete no action,
  unique (contenido_id, hash),
  unique (contenido_id, numero),
  unique (contenido_id, id),
  -- Cada estado trae sus datos, y solo los suyos.
  check ((estado in ('borrador', 'en_revision')) = (aprobado_en is null and aprobado_por is null)),
  check (case when estado = 'publicado'
              then publicado_en is not null and publicado_por is not null and btrim(coalesce(etiqueta, '')) <> ''
              when estado = 'retirado' then true
              else publicado_en is null and publicado_por is null end),
  check ((estado = 'retirado') = (retirado_en is not null and retirado_por is not null and btrim(coalesce(retirado_motivo, '')) <> '')
         and (estado = 'retirado' or (retirado_en is null and retirado_por is null and retirado_motivo is null)))
);
comment on table public.contenido_versiones is
  'Versiones de un contenido. Desde aprobado no cambian cuerpo, asunto, esquema ni hash; retirado es final. El hash lo calcula el codigo (src/lib/comunicaciones/contenidos/hash.ts).';

create table if not exists public.contenido_usos (
  id            bigint generated always as identity primary key,
  uso           text not null check (uso ~ '^[a-z][a-z_.]*$'),
  variante      text not null,
  canal         text not null,
  contenido_id  bigint not null,
  version_id    bigint,
  modo          text not null default 'legado' check (modo in ('legado', 'modulo')),
  actualizado_en timestamptz not null default now(),
  unique (uso, variante, canal),
  unique (contenido_id),
  -- La asignacion no puede apuntar a otro contenido, ni liberar una version ajena.
  foreign key (contenido_id, variante, canal) references public.contenidos(id, variante, canal) on delete restrict,
  foreign key (contenido_id, version_id) references public.contenido_versiones(contenido_id, id) on delete restrict,
  check (modo <> 'modulo' or version_id is not null)
);
comment on table public.contenido_usos is
  'Asignacion de un contenido a un punto de la operacion (uso, variante, canal). Nace en modo legado. Solo liberar_contenido() la cambia.';

create table if not exists public.contenido_usos_historial (
  id             bigint generated always as identity primary key,
  uso_id         bigint not null references public.contenido_usos(id) on delete restrict,
  de_version     bigint references public.contenido_versiones(id) on delete restrict,
  a_version      bigint references public.contenido_versiones(id) on delete restrict,
  de_modo        text not null check (de_modo in ('legado', 'modulo')),
  a_modo         text not null check (a_modo in ('legado', 'modulo')),
  motivo         text not null check (btrim(motivo) <> ''),
  hash_aprobado  text,
  aprobacion_ref text not null check (btrim(aprobacion_ref) <> ''),
  actor          uuid not null references public.perfiles(id) on delete no action,
  creado_en      timestamptz not null default now(),
  check (a_version is null or hash_aprobado is not null)
);
comment on table public.contenido_usos_historial is
  'Cada liberacion o vuelta a legado, con quien la hizo y que aprobacion la respalda. Solo se agrega; permanente (D-E4a-3).';

create index if not exists contenido_versiones_contenido_idx on public.contenido_versiones (contenido_id);
create index if not exists contenido_usos_version_idx on public.contenido_usos (version_id) where version_id is not null;
create index if not exists contenido_usos_historial_uso_idx on public.contenido_usos_historial (uso_id);


-- ---------------------------------------------------------------------
-- 2. GUARDIAS (triggers)
-- ---------------------------------------------------------------------

-- 2.1 contenidos: nunca se borra; su identidad no cambia si una version fue aprobada.
create or replace function public.contenidos_guardia()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'contenidos: un contenido no se borra';
  end if;
  if (new.clave, new.caso, new.variante, new.canal, new.tipo, new.finalidad)
       is distinct from (old.clave, old.caso, old.variante, old.canal, old.tipo, old.finalidad)
     and exists (select 1 from public.contenido_versiones v
                  where v.contenido_id = old.id and v.estado in ('aprobado', 'publicado', 'retirado')) then
    raise exception 'contenidos: la identidad de un contenido con versiones aprobadas no cambia';
  end if;
  return new;
end;
$$;
drop trigger if exists contenidos_guardia on public.contenidos;
create trigger contenidos_guardia
  before update or delete on public.contenidos
  for each row execute function public.contenidos_guardia();

-- 2.2 versiones: nacen en borrador, avanzan solo por la tabla de transiciones,
-- y desde aprobado no cambian lo que las determina.
--   borrador -> en_revision ; en_revision -> borrador | aprobado ;
--   aprobado -> publicado | retirado ; publicado -> retirado ; retirado -> (nada)
create or replace function public.contenido_versiones_guardia()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_canal text;
begin
  if tg_op = 'DELETE' then
    if old.estado in ('aprobado', 'publicado', 'retirado') then
      raise exception 'contenido_versiones: una version % no se borra', old.estado;
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.estado <> 'borrador' then
      raise exception 'contenido_versiones: una version nace en borrador (no %)', new.estado;
    end if;
    select canal into v_canal from public.contenidos where id = new.contenido_id;
    if v_canal = 'email' and btrim(coalesce(new.asunto, '')) = '' then
      raise exception 'contenido_versiones: el email lleva asunto';
    end if;
    if v_canal = 'whatsapp' and new.asunto is not null then
      raise exception 'contenido_versiones: WhatsApp no lleva asunto';
    end if;
    return new;
  end if;

  -- UPDATE
  if (new.id, new.contenido_id, new.numero) is distinct from (old.id, old.contenido_id, old.numero) then
    raise exception 'contenido_versiones: id, contenido y numero no cambian';
  end if;

  if old.estado = 'retirado' then
    raise exception 'contenido_versiones: una version retirada es final';
  end if;

  if old.estado in ('aprobado', 'publicado')
     and (new.cuerpo, new.asunto, new.esquema, new.hash, new.origen, new.creado_en, new.creado_por,
          new.aprobado_en, new.aprobado_por)
         is distinct from
         (old.cuerpo, old.asunto, old.esquema, old.hash, old.origen, old.creado_en, old.creado_por,
          old.aprobado_en, old.aprobado_por) then
    raise exception 'contenido_versiones: desde aprobado no cambian cuerpo, asunto, esquema, hash ni aprobacion';
  end if;

  if old.estado = 'publicado'
     and (new.etiqueta, new.url_oficial, new.publicado_en, new.publicado_por)
         is distinct from (old.etiqueta, old.url_oficial, old.publicado_en, old.publicado_por) then
    raise exception 'contenido_versiones: desde publicado no cambian etiqueta, url ni publicacion';
  end if;

  if new.estado is distinct from old.estado then
    if not ((old.estado, new.estado) in (
             ('borrador', 'en_revision'), ('en_revision', 'borrador'), ('en_revision', 'aprobado'),
             ('aprobado', 'publicado'), ('aprobado', 'retirado'), ('publicado', 'retirado'))) then
      raise exception 'contenido_versiones: transicion invalida % -> %', old.estado, new.estado;
    end if;
    -- Una version no se retira mientras alguna asignacion la tenga (en cualquier modo).
    if new.estado = 'retirado' and exists (select 1 from public.contenido_usos u where u.version_id = old.id) then
      raise exception 'contenido_versiones: la version % esta asignada a un uso; liberar otra o volver a legado antes de retirarla', old.id;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists contenido_versiones_guardia on public.contenido_versiones;
create trigger contenido_versiones_guardia
  before insert or update or delete on public.contenido_versiones
  for each row execute function public.contenido_versiones_guardia();

-- 2.3 usos: nacen en legado; solo cambian por liberar_contenido(); nunca se borran.
create or replace function public.contenido_usos_guardia()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'contenido_usos: una asignacion no se borra';
  end if;
  if tg_op = 'INSERT' then
    if new.modo <> 'legado' or new.version_id is not null then
      raise exception 'contenido_usos: una asignacion nace en legado y sin version';
    end if;
    return new;
  end if;
  if coalesce(current_setting('tropicana.liberando', true), 'off') <> 'on' then
    raise exception 'contenido_usos: solo liberar_contenido() modifica una asignacion';
  end if;
  if (new.id, new.uso, new.variante, new.canal, new.contenido_id)
       is distinct from (old.id, old.uso, old.variante, old.canal, old.contenido_id) then
    raise exception 'contenido_usos: uso, variante, canal y contenido no cambian';
  end if;
  return new;
end;
$$;
drop trigger if exists contenido_usos_guardia on public.contenido_usos;
create trigger contenido_usos_guardia
  before insert or update or delete on public.contenido_usos
  for each row execute function public.contenido_usos_guardia();

-- 2.4 historial: solo se agrega.
create or replace function public.contenido_usos_historial_solo_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'contenido_usos_historial es de solo agregar: no se edita ni se borra';
end;
$$;
drop trigger if exists contenido_usos_historial_no_update on public.contenido_usos_historial;
create trigger contenido_usos_historial_no_update
  before update or delete on public.contenido_usos_historial
  for each row execute function public.contenido_usos_historial_solo_insert();


-- ---------------------------------------------------------------------
-- 3. FUNCIONES (unica puerta de escritura; verifican es_admin() adentro)
-- ---------------------------------------------------------------------

-- 3.1 Cambia el estado editorial de una version. La tabla de transiciones
-- valida el trigger; esta funcion pone el actor y la fecha de cada paso.
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
begin
  if not public.es_admin() then
    raise exception 'Solo el Administrador cambia el estado de una version' using errcode = '42501';
  end if;
  select * into v from public.contenido_versiones where id = p_version_id for update;
  if not found then
    raise exception 'La version % no existe', p_version_id;
  end if;

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
  return v;
end;
$$;

-- 3.2 Asigna una version publicada a una asignacion (uso, variante, canal) y/o
-- cambia su modo. Una sola transaccion: la asignacion y su historial, o nada.
-- Volver a legado: modo = 'legado' (con o sin version).
create or replace function public.liberar_contenido(
  p_uso            text,
  p_variante       text,
  p_canal          text,
  p_version_id     bigint,
  p_modo           text,
  p_motivo         text,
  p_hash_aprobado  text,
  p_aprobacion_ref text
)
returns public.contenido_usos
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.contenido_usos;
  v public.contenido_versiones;
  v_de_version bigint;
  v_de_modo text;
begin
  if not public.es_admin() then
    raise exception 'Solo el Administrador libera contenido' using errcode = '42501';
  end if;
  if p_modo not in ('legado', 'modulo') then
    raise exception 'Modo desconocido: %', p_modo;
  end if;
  if btrim(coalesce(p_motivo, '')) = '' or btrim(coalesce(p_aprobacion_ref, '')) = '' then
    raise exception 'Liberar exige motivo y referencia de la aprobacion';
  end if;

  select * into u from public.contenido_usos
   where uso = p_uso and variante = p_variante and canal = p_canal for update;
  if not found then
    raise exception 'No existe la asignacion (%, %, %)', p_uso, p_variante, p_canal;
  end if;

  if p_version_id is null then
    if p_modo = 'modulo' then
      raise exception 'El modo modulo exige una version';
    end if;
  else
    select * into v from public.contenido_versiones
     where id = p_version_id and contenido_id = u.contenido_id for share;
    if not found then
      raise exception 'La version % no es del contenido de la asignacion', p_version_id;
    end if;
    if v.estado <> 'publicado' then
      raise exception 'La version % esta % y no publicado', v.id, v.estado;
    end if;
    if p_hash_aprobado is distinct from v.hash then
      raise exception 'El hash aprobado (%) no es el de la version (%)', p_hash_aprobado, v.hash;
    end if;
  end if;

  v_de_version := u.version_id;
  v_de_modo := u.modo;
  perform set_config('tropicana.liberando', 'on', true);
  update public.contenido_usos
     set version_id = p_version_id, modo = p_modo, actualizado_en = now()
   where id = u.id
  returning * into u;
  perform set_config('tropicana.liberando', 'off', true);

  insert into public.contenido_usos_historial
    (uso_id, de_version, a_version, de_modo, a_modo, motivo, hash_aprobado, aprobacion_ref, actor)
  values (u.id, v_de_version, p_version_id, v_de_modo, p_modo, p_motivo, v.hash, p_aprobacion_ref, auth.uid());
  return u;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. PERMISOS EFECTIVOS Y RLS
-- ---------------------------------------------------------------------
alter table public.contenidos enable row level security;
alter table public.contenido_versiones enable row level security;
alter table public.contenido_usos enable row level security;
alter table public.contenido_usos_historial enable row level security;

drop policy if exists contenidos_select on public.contenidos;
create policy contenidos_select on public.contenidos for select to authenticated using (public.es_admin());
drop policy if exists contenido_versiones_select on public.contenido_versiones;
create policy contenido_versiones_select on public.contenido_versiones for select to authenticated using (public.es_admin());
drop policy if exists contenido_usos_select on public.contenido_usos;
create policy contenido_usos_select on public.contenido_usos for select to authenticated using (public.es_admin());
drop policy if exists contenido_usos_historial_select on public.contenido_usos_historial;
create policy contenido_usos_historial_select on public.contenido_usos_historial for select to authenticated using (public.es_admin());

-- Sin escritura directa para nadie de la API: solo lectura (filtrada por RLS).
revoke all on table public.contenidos, public.contenido_versiones, public.contenido_usos, public.contenido_usos_historial
  from public, anon, authenticated;
grant select on table public.contenidos, public.contenido_versiones, public.contenido_usos, public.contenido_usos_historial
  to authenticated;

-- Las funciones: sin execute para public ni anon; solo authenticated (y adentro, es_admin()).
revoke execute on function public.cambiar_estado_version(bigint, text, text, text, text, text) from public, anon;
revoke execute on function public.liberar_contenido(text, text, text, bigint, text, text, text, text) from public, anon;
grant execute on function public.cambiar_estado_version(bigint, text, text, text, text, text) to authenticated;
grant execute on function public.liberar_contenido(text, text, text, bigint, text, text, text, text) to authenticated;
-- Las funciones de los triggers no se llaman a mano.
revoke execute on function public.contenidos_guardia() from public, anon, authenticated;
revoke execute on function public.contenido_versiones_guardia() from public, anon, authenticated;
revoke execute on function public.contenido_usos_guardia() from public, anon, authenticated;
revoke execute on function public.contenido_usos_historial_solo_insert() from public, anon, authenticated;

notify pgrst, 'reload schema';
