-- =====================================================================
-- 0074 - R20 E4b: registro de avisos (y E5: primer caso conectado, N09-N10)
-- ---------------------------------------------------------------------
-- Instala el REGISTRO de lo que se prepara para mandar por WhatsApp:
--   avisos            un aviso por evento exacto + destinatario + canal
--   aviso_acciones    de solo agregar: abierto, copiado, declaracion de envio
--                     y su rectificacion, autorizacion y uso del respaldo
--   contactos.whatsapp_revision / email_revision (sube con cada cambio)
--   finalidad_consentimiento: servicio, comercial, todas (sin tocar las v1)
-- No cambia ningun aviso por si sola: solo se registra un aviso de una
-- asignacion (uso, variante, canal) que Javier libero en modo 'modulo'.
-- No toca consentimientos ni no_contactar.
-- Reversion de la instalacion (solo dev): scripts/rollback_0074_avisos.sql.
-- Solo ASCII.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FINALIDADES DE CONSENTIMIENTO (catalogo; las filas v1 'contacto' quedan)
-- ---------------------------------------------------------------------
insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden)
select c.id, v.valor, v.etiqueta, v.orden
from public.catalogos c
cross join (values
  ('servicio', 'Avisos de servicio (membresias, reservas, clases, pagos)', 2),
  ('comercial', 'Avisos comerciales (promociones, ofertas, cursos nuevos)', 3),
  ('todas', 'Todas las finalidades (negativa general)', 4)
) as v(valor, etiqueta, orden)
where c.clave = 'finalidad_consentimiento'
on conflict (catalogo_id, valor) do nothing;


-- ---------------------------------------------------------------------
-- 2. REVISION DEL DESTINO (A -> B -> A da revision 3, no «igual»)
-- ---------------------------------------------------------------------
alter table public.contactos
  add column if not exists whatsapp_revision integer not null default 1,
  add column if not exists email_revision integer not null default 1;

create or replace function public.contactos_revision_destino()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.whatsapp is distinct from old.whatsapp then
    new.whatsapp_revision := old.whatsapp_revision + 1;
  else
    new.whatsapp_revision := old.whatsapp_revision;
  end if;
  if new.email is distinct from old.email then
    new.email_revision := old.email_revision + 1;
  else
    new.email_revision := old.email_revision;
  end if;
  return new;
end;
$$;
drop trigger if exists contactos_revision_destino on public.contactos;
create trigger contactos_revision_destino
  before update on public.contactos
  for each row execute function public.contactos_revision_destino();
revoke execute on function public.contactos_revision_destino() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. TABLAS
-- ---------------------------------------------------------------------
-- Un aviso por evento exacto + destinatario + canal. El contenido seleccionado
-- (version_id) queda fijado al crearlo: reintentar nunca lo cambia.
create table if not exists public.avisos (
  id               bigint generated always as identity primary key,
  clave            text not null unique,
  fuente_evento    text not null,
  id_evento        text not null,
  caso             text not null,
  variante         text not null,
  canal            text not null check (canal in ('whatsapp', 'email')),
  asignacion_id    bigint not null references public.contenido_usos(id),
  origen           text not null check (origen in ('legado', 'modulo')),
  version_id       bigint references public.contenido_versiones(id),
  membresia_id     bigint not null references public.membresias(id),
  contacto_id      bigint not null references public.contactos(id),
  destino          text,
  destino_revision integer,
  texto            text,
  texto_usado      text,
  respaldo         boolean not null default false,
  finalidad        text not null check (finalidad in ('servicio', 'comercial')),
  contactabilidad  jsonb not null,
  estado           text not null check (estado in ('preparado', 'bloqueado', 'cancelado', 'fallido')),
  motivo_fallo     text check (motivo_fallo in ('contenido', 'variable_faltante', 'destinatario', 'contactabilidad')),
  creado_por       uuid references public.perfiles(id) on delete set null,
  creado_en        timestamptz not null default now(),
  check ((origen = 'modulo') = (version_id is not null)),
  check ((estado = 'fallido') = (motivo_fallo is not null)),
  check (estado <> 'preparado' or texto is not null),
  check (not respaldo or (estado = 'preparado' and origen = 'modulo'))
);
create index if not exists avisos_membresia_idx on public.avisos (membresia_id);
create index if not exists avisos_contacto_idx on public.avisos (contacto_id);

create table if not exists public.aviso_acciones (
  id           bigint generated always as identity primary key,
  aviso_id     bigint not null references public.avisos(id),
  tipo         text not null check (tipo in (
                 'abierto_whatsapp', 'copiado', 'reintento',
                 'respaldo_autorizado', 'respaldo_usado',
                 'declarado_enviado', 'declaracion_rectificada')),
  naturaleza   text not null check (naturaleza in ('operativa', 'autorizacion', 'declaracion_operador')),
  actor        uuid references public.perfiles(id) on delete set null,
  creado_en    timestamptz not null default now(),
  destino      text,
  texto        text,
  motivo       text,
  rectifica_id bigint references public.aviso_acciones(id),
  check ((tipo = 'declaracion_rectificada') = (rectifica_id is not null)),
  check ((tipo in ('declarado_enviado', 'declaracion_rectificada')) = (naturaleza = 'declaracion_operador')),
  check ((tipo = 'respaldo_autorizado') = (naturaleza = 'autorizacion'))
);
create index if not exists aviso_acciones_aviso_idx on public.aviso_acciones (aviso_id, id);
-- Una declaracion se rectifica una sola vez; un aviso se autoriza para el respaldo una sola vez.
create unique index if not exists aviso_acciones_una_rectificacion
  on public.aviso_acciones (rectifica_id) where tipo = 'declaracion_rectificada';
create unique index if not exists aviso_acciones_una_autorizacion
  on public.aviso_acciones (aviso_id) where tipo = 'respaldo_autorizado';
create unique index if not exists aviso_acciones_un_respaldo
  on public.aviso_acciones (aviso_id) where tipo = 'respaldo_usado';


-- ---------------------------------------------------------------------
-- 4. GUARDIAS (solo agregar; el aviso solo cambia por las funciones)
-- ---------------------------------------------------------------------
create or replace function public.avisos_guardia()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'avisos: un aviso no se borra';
  end if;
  if coalesce(current_setting('tropicana.avisos', true), 'off') <> 'on' then
    raise exception 'avisos: solo las funciones de registro modifican un aviso';
  end if;
  -- Lo que fija el aviso (y su contenido seleccionado) no cambia nunca.
  if (new.id, new.clave, new.fuente_evento, new.id_evento, new.caso, new.variante, new.canal,
      new.asignacion_id, new.origen, new.version_id, new.membresia_id, new.contacto_id,
      new.finalidad, new.creado_por, new.creado_en)
     is distinct from
     (old.id, old.clave, old.fuente_evento, old.id_evento, old.caso, old.variante, old.canal,
      old.asignacion_id, old.origen, old.version_id, old.membresia_id, old.contacto_id,
      old.finalidad, old.creado_por, old.creado_en) then
    raise exception 'avisos: el evento, el destinatario y el contenido seleccionado no cambian';
  end if;
  if old.estado = 'preparado' and old.texto is not null and new.texto is distinct from old.texto then
    raise exception 'avisos: un texto ya preparado no cambia';
  end if;
  return new;
end;
$$;
drop trigger if exists avisos_guardia on public.avisos;
create trigger avisos_guardia
  before update or delete on public.avisos
  for each row execute function public.avisos_guardia();

create or replace function public.aviso_acciones_solo_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'aviso_acciones es de solo agregar: no se edita ni se borra';
end;
$$;
drop trigger if exists aviso_acciones_no_update on public.aviso_acciones;
create trigger aviso_acciones_no_update
  before update or delete on public.aviso_acciones
  for each row execute function public.aviso_acciones_solo_insert();


-- ---------------------------------------------------------------------
-- 5. ACCESO A LA OPERACION ORIGINAL (el mismo criterio que autorizarSobre,
--    particulares/acciones.ts): permiso del modulo que corresponde al tipo de
--    membresia + alcance "propio" por rol_visibilidad.
-- ---------------------------------------------------------------------
create or replace function public.puede_operar_membresia_reserva(p_membresia_id bigint, p_accion text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m record;
  v_modulo text;
begin
  select id, profesor_id, categoria_aplicada into m
    from public.membresias where id = p_membresia_id and curso_id is null;
  if not found then
    return false;
  end if;
  v_modulo := case when m.categoria_aplicada is not null then 'alquileres' else 'particulares' end;
  if not public.tiene_permiso(v_modulo, p_accion) then
    return false;
  end if;
  if public.alcance_de(v_modulo) = 'propio' then
    -- El alcance propio del alquiler todavia no existe: falla cerrado (como el servidor).
    if v_modulo = 'alquileres' then
      return false;
    end if;
    return m.profesor_id is not null and m.profesor_id = public.profesor_actual_id();
  end if;
  return true;
end;
$$;

-- Quien puede producir o registrar el aviso: crear o editar sobre la operacion.
create or replace function public.puede_registrar_aviso(p_membresia_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.puede_operar_membresia_reserva(p_membresia_id, 'crear')
      or public.puede_operar_membresia_reserva(p_membresia_id, 'editar');
$$;


-- ---------------------------------------------------------------------
-- 6. FUNCIONES (unica puerta de escritura; con la sesion de quien opera)
-- ---------------------------------------------------------------------

-- 6.1 Registra el aviso de un evento. Idempotente por clave: un reintento
-- devuelve el mismo registro (con el mismo contenido seleccionado).
create or replace function public.registrar_aviso(
  p_uso             text,
  p_variante        text,
  p_canal           text,
  p_caso            text,
  p_fuente_evento   text,
  p_id_evento       text,
  p_membresia_id    bigint,
  p_contacto_id     bigint,
  p_destino         text,
  p_texto           text,
  p_contactabilidad jsonb,
  p_estado          text,
  p_motivo_fallo    text default null
)
returns public.avisos
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.contenido_usos;
  c public.contenidos;
  ct public.contactos;
  v_clave text;
  a public.avisos;
begin
  if not public.puede_registrar_aviso(p_membresia_id) then
    raise exception 'No tenes acceso a la operacion de este aviso' using errcode = '42501';
  end if;
  if p_estado not in ('preparado', 'bloqueado', 'fallido') then
    raise exception 'Estado de aviso no valido: %', p_estado;
  end if;
  select * into u from public.contenido_usos
   where uso = p_uso and variante = p_variante and canal = p_canal;
  if not found then
    raise exception 'No existe la asignacion (%, %, %)', p_uso, p_variante, p_canal;
  end if;
  if u.modo <> 'modulo' or u.version_id is null then
    raise exception 'La asignacion (%, %, %) esta en legado: no se registra', p_uso, p_variante, p_canal;
  end if;
  select * into c from public.contenidos where id = u.contenido_id;
  if c.caso <> p_caso then
    raise exception 'El caso % no es el de la asignacion (%)', p_caso, c.caso;
  end if;
  if not exists (select 1 from public.contenido_versiones v
                  where v.id = u.version_id and v.estado = 'publicado') then
    raise exception 'La version liberada de la asignacion no esta publicada';
  end if;
  select * into ct from public.contactos where id = p_contacto_id;
  if not found then
    raise exception 'El contacto % no existe', p_contacto_id;
  end if;
  if p_destino is distinct from (case when p_canal = 'whatsapp' then ct.whatsapp else ct.email end) then
    raise exception 'El destino no es el del contacto';
  end if;

  v_clave := p_fuente_evento || ':' || p_id_evento || ':' || p_caso || ':' || p_variante || ':' || p_contacto_id || ':' || p_canal;
  insert into public.avisos
    (clave, fuente_evento, id_evento, caso, variante, canal, asignacion_id, origen, version_id,
     membresia_id, contacto_id, destino, destino_revision, texto, finalidad, contactabilidad,
     estado, motivo_fallo, creado_por)
  values
    (v_clave, p_fuente_evento, p_id_evento, p_caso, p_variante, p_canal, u.id, 'modulo', u.version_id,
     p_membresia_id, p_contacto_id, p_destino,
     case when p_canal = 'whatsapp' then ct.whatsapp_revision else ct.email_revision end,
     p_texto, c.finalidad, p_contactabilidad, p_estado, p_motivo_fallo, auth.uid())
  on conflict (clave) do nothing
  returning * into a;
  if not found then
    select * into a from public.avisos where clave = v_clave;
  end if;
  return a;
end;
$$;

-- 6.2 Reintenta un aviso que fallo al prepararse: mismo registro, mismo
-- contenido seleccionado (version_id no se toca). Deja la accion 'reintento'.
create or replace function public.reintentar_aviso(
  p_aviso_id        bigint,
  p_destino         text,
  p_texto           text,
  p_contactabilidad jsonb,
  p_estado          text,
  p_motivo_fallo    text default null
)
returns public.avisos
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.avisos;
  ct public.contactos;
begin
  select * into a from public.avisos where id = p_aviso_id for update;
  if not found then
    raise exception 'El aviso % no existe', p_aviso_id;
  end if;
  if not public.puede_registrar_aviso(a.membresia_id) then
    raise exception 'No tenes acceso a la operacion de este aviso' using errcode = '42501';
  end if;
  if a.estado <> 'fallido' then
    raise exception 'Solo se reintenta un aviso que fallo al prepararse';
  end if;
  if p_estado not in ('preparado', 'bloqueado', 'fallido') then
    raise exception 'Estado de aviso no valido: %', p_estado;
  end if;
  select * into ct from public.contactos where id = a.contacto_id;
  if p_destino is distinct from (case when a.canal = 'whatsapp' then ct.whatsapp else ct.email end) then
    raise exception 'El destino no es el del contacto';
  end if;
  perform set_config('tropicana.avisos', 'on', true);
  update public.avisos
     set destino = p_destino,
         destino_revision = case when canal = 'whatsapp' then ct.whatsapp_revision else ct.email_revision end,
         texto = p_texto, contactabilidad = p_contactabilidad, estado = p_estado, motivo_fallo = p_motivo_fallo
   where id = a.id
  returning * into a;
  perform set_config('tropicana.avisos', 'off', true);
  insert into public.aviso_acciones (aviso_id, tipo, naturaleza, actor)
  values (a.id, 'reintento', 'operativa', auth.uid());
  return a;
end;
$$;

-- 6.3 Acciones del aviso (abierto, copiado, declaracion, rectificacion,
-- autorizacion del respaldo). Siempre verifica el acceso a la operacion original.
create or replace function public.registrar_aviso_accion(
  p_aviso_id     bigint,
  p_tipo         text,
  p_motivo       text default null,
  p_rectifica_id bigint default null
)
returns public.aviso_acciones
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.avisos;
  r public.aviso_acciones;
  d public.aviso_acciones;
begin
  select * into a from public.avisos where id = p_aviso_id;
  if not found then
    raise exception 'El aviso % no existe', p_aviso_id;
  end if;
  if not public.puede_registrar_aviso(a.membresia_id) then
    raise exception 'No tenes acceso a la operacion de este aviso' using errcode = '42501';
  end if;

  if p_tipo in ('abierto_whatsapp', 'copiado') then
    if a.estado <> 'preparado' then
      raise exception 'Solo un aviso preparado se abre o se copia';
    end if;
    insert into public.aviso_acciones (aviso_id, tipo, naturaleza, actor, destino, texto)
    values (a.id, p_tipo, 'operativa', auth.uid(), a.destino, a.texto)
    returning * into r;

  elsif p_tipo = 'declarado_enviado' then
    if a.estado <> 'preparado' then
      raise exception 'Solo un aviso preparado se declara enviado';
    end if;
    if exists (select 1 from public.aviso_acciones x
                where x.aviso_id = a.id and x.tipo = 'declarado_enviado'
                  and not exists (select 1 from public.aviso_acciones y
                                   where y.tipo = 'declaracion_rectificada' and y.rectifica_id = x.id)) then
      raise exception 'Ya hay una declaracion de envio vigente: se rectifica, no se repite';
    end if;
    insert into public.aviso_acciones (aviso_id, tipo, naturaleza, actor, destino, texto)
    values (a.id, p_tipo, 'declaracion_operador', auth.uid(), a.destino, a.texto)
    returning * into r;

  elsif p_tipo = 'declaracion_rectificada' then
    select * into d from public.aviso_acciones where id = p_rectifica_id;
    if not found or d.aviso_id <> a.id or d.tipo <> 'declarado_enviado' then
      raise exception 'Solo se rectifica una declaracion de envio de este aviso';
    end if;
    if exists (select 1 from public.aviso_acciones y
                where y.tipo = 'declaracion_rectificada' and y.rectifica_id = d.id) then
      raise exception 'Esa declaracion ya fue rectificada';
    end if;
    if d.actor is distinct from auth.uid() and not public.es_admin() then
      raise exception 'Solo quien declaro el envio o el Administrador lo rectifica' using errcode = '42501';
    end if;
    insert into public.aviso_acciones (aviso_id, tipo, naturaleza, actor, destino, texto, motivo, rectifica_id)
    values (a.id, p_tipo, 'declaracion_operador', auth.uid(), a.destino, a.texto, p_motivo, d.id)
    returning * into r;

  elsif p_tipo = 'respaldo_autorizado' then
    if not public.es_admin() then
      raise exception 'Solo el Administrador autoriza el respaldo' using errcode = '42501';
    end if;
    if a.estado <> 'fallido' or a.motivo_fallo is distinct from 'contenido' then
      raise exception 'El respaldo solo corresponde a un fallo del contenido oficial: un fallo de destinatario, de contactabilidad o un dato faltante no se esquiva';
    end if;
    if btrim(coalesce(p_motivo, '')) = '' then
      raise exception 'Autorizar el respaldo exige un motivo';
    end if;
    insert into public.aviso_acciones (aviso_id, tipo, naturaleza, actor, motivo)
    values (a.id, p_tipo, 'autorizacion', auth.uid(), p_motivo)
    returning * into r;

  else
    raise exception 'Accion no valida: %', p_tipo;
  end if;
  return r;
end;
$$;

-- 6.4 Usa el texto anterior (heredado) para un aviso cuyo contenido oficial
-- fallo, con la autorizacion del Administrador para ESE aviso. Nunca es
-- automatico: es una accion explicita. El contenido seleccionado no cambia.
create or replace function public.usar_respaldo_aviso(
  p_aviso_id bigint,
  p_texto    text
)
returns public.avisos
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.avisos;
begin
  select * into a from public.avisos where id = p_aviso_id for update;
  if not found then
    raise exception 'El aviso % no existe', p_aviso_id;
  end if;
  if not public.puede_registrar_aviso(a.membresia_id) then
    raise exception 'No tenes acceso a la operacion de este aviso' using errcode = '42501';
  end if;
  if a.estado <> 'fallido' or a.motivo_fallo is distinct from 'contenido' then
    raise exception 'El respaldo solo corresponde a un fallo del contenido oficial';
  end if;
  if not exists (select 1 from public.aviso_acciones x where x.aviso_id = a.id and x.tipo = 'respaldo_autorizado') then
    raise exception 'El respaldo necesita la autorizacion del Administrador para este aviso';
  end if;
  if btrim(coalesce(p_texto, '')) = '' then
    raise exception 'Falta el texto anterior';
  end if;
  perform set_config('tropicana.avisos', 'on', true);
  update public.avisos
     set texto = p_texto, estado = 'preparado', motivo_fallo = null, respaldo = true
   where id = a.id
  returning * into a;
  perform set_config('tropicana.avisos', 'off', true);
  insert into public.aviso_acciones (aviso_id, tipo, naturaleza, actor, texto)
  values (a.id, 'respaldo_usado', 'operativa', auth.uid(), p_texto);
  return a;
end;
$$;

-- 6.5 Lectura de un aviso y de su historial, con el mismo acceso que la operacion.
create or replace function public.leer_avisos_de_evento(p_membresia_id bigint, p_fuente_evento text, p_id_evento text)
returns setof public.avisos
language sql
stable
security definer
set search_path = public
as $$
  select * from public.avisos a
   where a.membresia_id = p_membresia_id and a.fuente_evento = p_fuente_evento and a.id_evento = p_id_evento
     and public.puede_operar_membresia_reserva(a.membresia_id, 'ver')
   order by a.id;
$$;

create or replace function public.acciones_de_aviso(p_aviso_id bigint)
returns setof public.aviso_acciones
language sql
stable
security definer
set search_path = public
as $$
  select x.* from public.aviso_acciones x
    join public.avisos a on a.id = x.aviso_id
   where a.id = p_aviso_id and public.puede_operar_membresia_reserva(a.membresia_id, 'ver')
   order by x.id;
$$;


-- ---------------------------------------------------------------------
-- 7. PERMISOS EFECTIVOS Y RLS
-- ---------------------------------------------------------------------
alter table public.avisos enable row level security;
alter table public.aviso_acciones enable row level security;
drop policy if exists avisos_select on public.avisos;
create policy avisos_select on public.avisos for select to authenticated using (public.es_admin());
drop policy if exists aviso_acciones_select on public.aviso_acciones;
create policy aviso_acciones_select on public.aviso_acciones for select to authenticated using (public.es_admin());

revoke all on table public.avisos, public.aviso_acciones from public, anon, authenticated;
grant select on table public.avisos, public.aviso_acciones to authenticated;

revoke execute on function public.puede_operar_membresia_reserva(bigint, text) from public, anon;
revoke execute on function public.puede_registrar_aviso(bigint) from public, anon;
revoke execute on function public.registrar_aviso(text, text, text, text, text, text, bigint, bigint, text, text, jsonb, text, text) from public, anon;
revoke execute on function public.reintentar_aviso(bigint, text, text, jsonb, text, text) from public, anon;
revoke execute on function public.registrar_aviso_accion(bigint, text, text, bigint) from public, anon;
revoke execute on function public.usar_respaldo_aviso(bigint, text) from public, anon;
revoke execute on function public.leer_avisos_de_evento(bigint, text, text) from public, anon;
revoke execute on function public.acciones_de_aviso(bigint) from public, anon;
grant execute on function public.puede_operar_membresia_reserva(bigint, text) to authenticated;
grant execute on function public.puede_registrar_aviso(bigint) to authenticated;
grant execute on function public.registrar_aviso(text, text, text, text, text, text, bigint, bigint, text, text, jsonb, text, text) to authenticated;
grant execute on function public.reintentar_aviso(bigint, text, text, jsonb, text, text) to authenticated;
grant execute on function public.registrar_aviso_accion(bigint, text, text, bigint) to authenticated;
grant execute on function public.usar_respaldo_aviso(bigint, text) to authenticated;
grant execute on function public.leer_avisos_de_evento(bigint, text, text) to authenticated;
grant execute on function public.acciones_de_aviso(bigint) to authenticated;
-- Las funciones de los triggers no se llaman a mano.
revoke execute on function public.avisos_guardia() from public, anon, authenticated;
revoke execute on function public.aviso_acciones_solo_insert() from public, anon, authenticated;

notify pgrst, 'reload schema';
