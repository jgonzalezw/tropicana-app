-- =====================================================================
-- TROPICANA - prueba de la 0074 (R20 E4b/E5: registro de avisos). SOLO DEV.
-- ---------------------------------------------------------------------
-- Prueba con roles reales (anon, authenticated: Administrador, Gerente,
-- Asistente, Profesor de alcance propio) los permisos, las guardias y las
-- funciones de avisos. Corre TODO dentro de una transaccion que se DESCARTA al
-- final (termina con una excepcion cuyo mensaje trae los resultados): no deja
-- ningun aviso ni accion.
-- Pegar en el SQL Editor de tropicana-dev. Resultado esperado: toda linea
-- empieza con OK y la ultima dice «0 FALLOS».
-- Solo ASCII.
-- =====================================================================

create or replace function pg_temp.pon_rol(p_rol text, p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_rol)::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  if p_rol <> 'postgres' then execute 'set local role ' || p_rol; end if;
end $$;

-- Espera un error que contenga p_patron (o, si es null, que NO falle).
create or replace function pg_temp.prueba(p_nombre text, p_rol text, p_uid uuid, p_sql text, p_patron text)
returns text
language plpgsql
as $$
declare
  v_msg text;
  v_fallo boolean := false;
begin
  begin
    perform pg_temp.pon_rol(p_rol, p_uid);
    execute p_sql;
  exception when others then
    v_fallo := true;
    v_msg := sqlerrm;
  end;
  reset role;
  if p_patron is null then
    if v_fallo then return 'FALLO ' || p_nombre || ': fallo y no debia: ' || v_msg; end if;
    return 'OK    ' || p_nombre;
  end if;
  if not v_fallo then return 'FALLO ' || p_nombre || ': no fallo y debia fallar con «' || p_patron || '»'; end if;
  if v_msg not ilike '%' || p_patron || '%' then
    return 'FALLO ' || p_nombre || ': fallo con otro mensaje: ' || v_msg;
  end if;
  return 'OK    ' || p_nombre;
end;
$$;

-- Ejecuta p_sql (devuelve un escalar) y lo guarda como variable de la prueba.
create or replace function pg_temp.guardar(p_var text, p_rol text, p_uid uuid, p_sql text) returns void language plpgsql as $$
declare v text;
begin
  perform pg_temp.pon_rol(p_rol, p_uid);
  execute p_sql into v;
  reset role;
  perform set_config('t.' || p_var, v, true);
end $$;

do $$
declare
  r text[] := '{}';
  adm uuid; ger uuid; asi uuid; pro uuid;
  m_part bigint; m_alq bigint; c_alu bigint; c_pro bigint;
  w_alu text; w_pro text;
  x text; fallos int;
  cont jsonb := '{"estado":"pendiente","bloquea":false,"advertencia":null,"registro":null}'::jsonb;
  base text;
begin
  select p.id into adm from public.perfiles p join public.roles ro on ro.id = p.rol_id where ro.clave = 'administrador' and p.activo order by p.id limit 1;
  select p.id into ger from public.perfiles p join public.roles ro on ro.id = p.rol_id where ro.clave = 'gerente' and p.activo order by p.id limit 1;
  select p.id into asi from public.perfiles p join public.roles ro on ro.id = p.rol_id where ro.clave = 'asistente' and p.activo order by p.id limit 1;
  select pr.usuario_id into pro from public.profesores pr join public.perfiles p on p.id = pr.usuario_id join public.roles ro on ro.id = p.rol_id
   where ro.clave = 'profesor' and p.activo order by pr.id limit 1;
  if adm is null or ger is null or asi is null or pro is null then raise exception 'Falta un perfil de prueba en dev (administrador, gerente, asistente o profesor con usuario)'; end if;

  -- Una membresia particular de OTRO profesor que el de la prueba, y una de alquiler.
  select m.id, a.contacto_id, c.whatsapp into m_part, c_alu, w_alu
    from public.membresias m join public.alumnos a on a.id = m.alumno_id join public.contactos c on c.id = a.contacto_id
   where m.curso_id is null and m.categoria_aplicada is null and m.profesor_id is distinct from (select id from public.profesores where usuario_id = pro)
   order by m.id desc limit 1;
  select m.id into m_alq from public.membresias m where m.curso_id is null and m.categoria_aplicada is not null order by m.id desc limit 1;
  select pr.contacto_id, c.whatsapp into c_pro, w_pro
    from public.membresias m join public.profesores pr on pr.id = m.profesor_id join public.contactos c on c.id = pr.contacto_id where m.id = m_part;
  if m_part is null or m_alq is null or c_alu is null or c_pro is null then raise exception 'Faltan datos de prueba en dev (membresia particular, de alquiler, alumno y profesor)'; end if;

  -- ---- permisos efectivos ----
  r := r || case when exists (select 1 from (values ('anon'), ('authenticated')) a(ro), (values ('public.avisos'), ('public.aviso_acciones')) b(t), (values ('insert'), ('update'), ('delete'), ('truncate')) c(p) where has_table_privilege(a.ro, b.t, c.p))
                 then 'FALLO permisos: anon o authenticated con escritura en avisos o aviso_acciones'
                 else 'OK    permisos: anon y authenticated sin escritura en avisos ni aviso_acciones' end;
  r := r || case when not has_function_privilege('anon', 'public.registrar_aviso(text,text,text,text,text,text,bigint,bigint,text,text,jsonb,text,text)', 'execute')
                  and not has_function_privilege('anon', 'public.registrar_aviso_accion(bigint,text,text,bigint)', 'execute')
                  and not has_function_privilege('anon', 'public.usar_respaldo_aviso(bigint,text)', 'execute')
                  and has_function_privilege('authenticated', 'public.registrar_aviso(text,text,text,text,text,text,bigint,bigint,text,text,jsonb,text,text)', 'execute')
                 then 'OK    permisos: las funciones no son para anon y si para authenticated'
                 else 'FALLO permisos: execute de las funciones' end;

  base := 'select (public.registrar_aviso(%L, ''unica'', ''whatsapp'', %L, ''reservas_historial'', %L, %s, %s, %L, %L, %L::jsonb, %L, %L)).id';

  -- ---- acceso a la operacion original ----
  r := r || pg_temp.prueba('anon no registra', 'anon', null,
    format(base, 'reserva.confirmada.alumno', 'N09', 'T0', m_part, c_alu, w_alu, 'x', cont::text, 'preparado', null), 'permission denied');
  r := r || pg_temp.prueba('profesor de alcance propio no registra en una membresia ajena', 'authenticated', pro,
    format(base, 'reserva.confirmada.alumno', 'N09', 'T0', m_part, c_alu, w_alu, 'x', cont::text, 'preparado', null), 'No tenes acceso');
  r := r || pg_temp.prueba('alquiler: el alcance propio falla cerrado (profesor)', 'authenticated', pro,
    format(base, 'reserva.confirmada.alumno', 'N09', 'T0', m_alq, c_alu, w_alu, 'x', cont::text, 'preparado', null), 'No tenes acceso');
  r := r || pg_temp.prueba('destino que no es el del contacto', 'authenticated', adm,
    format(base, 'reserva.confirmada.alumno', 'N09', 'T0', m_part, c_alu, '+59100000000', 'x', cont::text, 'preparado', null), 'destino no es el del contacto');
  r := r || pg_temp.prueba('el caso debe ser el de la asignacion', 'authenticated', adm,
    format(base, 'reserva.confirmada.alumno', 'N10', 'T0', m_part, c_alu, w_alu, 'x', cont::text, 'preparado', null), 'no es el de la asignacion');
  r := r || pg_temp.prueba('una asignacion en legado no se registra', 'authenticated', adm,
    format(base, 'reserva.suspendida.alumno', 'N11', 'T0', m_part, c_alu, w_alu, 'x', cont::text, 'preparado', null), 'esta en legado');

  -- ---- idempotencia: un aviso por evento exacto + destinatario + canal ----
  perform pg_temp.guardar('a1', 'authenticated', adm, format(base, 'reserva.confirmada.alumno', 'N09', 'T1', m_part, c_alu, w_alu, 'texto N09', cont::text, 'preparado', null));
  perform pg_temp.guardar('a1b', 'authenticated', ger, format(base, 'reserva.confirmada.alumno', 'N09', 'T1', m_part, c_alu, w_alu, 'texto N09', cont::text, 'preparado', null));
  r := r || case when current_setting('t.a1') = current_setting('t.a1b') and (select count(*) from public.avisos where id_evento = 'T1' and caso = 'N09') = 1
                 then 'OK    el mismo evento, destinatario y canal da un solo aviso (reintento = mismo registro)'
                 else 'FALLO idempotencia: ' || current_setting('t.a1') || ' / ' || current_setting('t.a1b') end;
  perform pg_temp.guardar('a2', 'authenticated', adm, format(base, 'reserva.confirmada.profesor', 'N10', 'T1', m_part, c_pro, w_pro, 'texto N10', cont::text, 'preparado', null));
  r := r || case when current_setting('t.a1') <> current_setting('t.a2') then 'OK    N09 y N10 del mismo evento son avisos independientes'
                 else 'FALLO N09 y N10 comparten registro' end;
  r := r || case when (select a.version_id from public.avisos a where a.id = current_setting('t.a1')::bigint)
                      = (select u.version_id from public.contenido_usos u where u.uso = 'reserva.confirmada.alumno')
                 then 'OK    el aviso fija la version seleccionada de la asignacion'
                 else 'FALLO la version del aviso no es la de la asignacion' end;

  -- ---- guardias: nadie modifica ni borra un aviso fuera de las funciones ----
  r := r || pg_temp.prueba('update directo de un aviso (admin authenticated)', 'authenticated', adm,
    format('update public.avisos set texto = ''otro'' where id = %s', current_setting('t.a1')), 'permission denied');
  r := r || pg_temp.prueba('update directo de un aviso (dueno de la tabla)', 'postgres', null,
    format('update public.avisos set texto = ''otro'' where id = %s', current_setting('t.a1')), 'solo las funciones');
  r := r || pg_temp.prueba('delete de un aviso', 'postgres', null,
    format('delete from public.avisos where id = %s', current_setting('t.a1')), 'no se borra');
  r := r || pg_temp.prueba('una version seleccionada no cambia', 'postgres', null,
    format('select set_config(''tropicana.avisos'', ''on'', true); update public.avisos set version_id = null, origen = ''legado'' where id = %s', current_setting('t.a1')), 'no cambian');

  -- ---- reintento: solo un aviso fallido; misma version ----
  r := r || pg_temp.prueba('no se reintenta un aviso preparado', 'authenticated', adm,
    format('select public.reintentar_aviso(%s, %L, %L, %L::jsonb, ''preparado'', null)', current_setting('t.a1'), w_alu, 'otro texto', cont::text), 'Solo se reintenta');
  perform pg_temp.guardar('f1', 'authenticated', adm, format(base, 'reserva.confirmada.alumno', 'N09', 'T2', m_part, c_alu, w_alu, null, cont::text, 'fallido', 'contenido'));
  perform pg_temp.guardar('f1v', 'postgres', null, format('select version_id::text from public.avisos where id = %s', current_setting('t.f1')));
  perform pg_temp.guardar('f1r', 'authenticated', ger, format('select (public.reintentar_aviso(%s, %L, %L, %L::jsonb, ''preparado'', null)).version_id::text', current_setting('t.f1'), w_alu, 'texto reintento', cont::text));
  r := r || case when current_setting('t.f1v') = current_setting('t.f1r')
                  and (select estado from public.avisos where id = current_setting('t.f1')::bigint) = 'preparado'
                  and (select count(*) from public.aviso_acciones where aviso_id = current_setting('t.f1')::bigint and tipo = 'reintento') = 1
                 then 'OK    reintentar conserva la version seleccionada, deja la accion y pasa a preparado'
                 else 'FALLO reintento' end;

  -- ---- respaldo: solo tras la autorizacion del Administrador y solo por un fallo del contenido ----
  perform pg_temp.guardar('fv', 'authenticated', adm, format(base, 'reserva.confirmada.alumno', 'N09', 'T3', m_part, c_alu, w_alu, null, cont::text, 'fallido', 'variable_faltante'));
  perform pg_temp.guardar('fc', 'authenticated', adm, format(base, 'reserva.confirmada.alumno', 'N09', 'T4', m_part, c_alu, w_alu, null, cont::text, 'fallido', 'contactabilidad'));
  perform pg_temp.guardar('fk', 'authenticated', adm, format(base, 'reserva.confirmada.alumno', 'N09', 'T5', m_part, c_alu, w_alu, null, cont::text, 'fallido', 'contenido'));
  r := r || pg_temp.prueba('el respaldo no esquiva un dato faltante', 'authenticated', adm,
    format('select public.registrar_aviso_accion(%s, ''respaldo_autorizado'', ''motivo'', null)', current_setting('t.fv')), 'no se esquiva');
  r := r || pg_temp.prueba('el respaldo no esquiva un fallo de contactabilidad', 'authenticated', adm,
    format('select public.registrar_aviso_accion(%s, ''respaldo_autorizado'', ''motivo'', null)', current_setting('t.fc')), 'no se esquiva');
  r := r || pg_temp.prueba('un no administrador no autoriza el respaldo', 'authenticated', ger,
    format('select public.registrar_aviso_accion(%s, ''respaldo_autorizado'', ''motivo'', null)', current_setting('t.fk')), 'Solo el Administrador');
  r := r || pg_temp.prueba('usar el respaldo sin autorizacion', 'authenticated', ger,
    format('select public.usar_respaldo_aviso(%s, ''texto anterior'')', current_setting('t.fk')), 'necesita la autorizacion');
  r := r || pg_temp.prueba('el respaldo exige motivo', 'authenticated', adm,
    format('select public.registrar_aviso_accion(%s, ''respaldo_autorizado'', null, null)', current_setting('t.fk')), 'exige un motivo');
  r := r || pg_temp.prueba('el Administrador autoriza el respaldo de ese aviso', 'authenticated', adm,
    format('select public.registrar_aviso_accion(%s, ''respaldo_autorizado'', ''el contenido oficial falla'', null)', current_setting('t.fk')), null);
  r := r || pg_temp.prueba('quien opera usa el respaldo autorizado', 'authenticated', ger,
    format('select public.usar_respaldo_aviso(%s, ''texto anterior'')', current_setting('t.fk')), null);
  r := r || case when (select respaldo and estado = 'preparado' and texto = 'texto anterior' from public.avisos where id = current_setting('t.fk')::bigint)
                  and (select version_id from public.avisos where id = current_setting('t.fk')::bigint) is not null
                 then 'OK    el respaldo deja el aviso preparado, marcado y con su version seleccionada'
                 else 'FALLO estado tras el respaldo' end;
  r := r || pg_temp.prueba('el respaldo no se usa dos veces', 'authenticated', ger,
    format('select public.usar_respaldo_aviso(%s, ''otra vez'')', current_setting('t.fk')), 'solo corresponde');

  -- ---- acciones, declaracion y rectificacion ----
  r := r || pg_temp.prueba('abrir WhatsApp se registra', 'authenticated', ger,
    format('select public.registrar_aviso_accion(%s, ''abierto_whatsapp'', null, null)', current_setting('t.a1')), null);
  r := r || pg_temp.prueba('no se abre un aviso que no esta preparado', 'authenticated', ger,
    format('select public.registrar_aviso_accion(%s, ''abierto_whatsapp'', null, null)', current_setting('t.fv')), 'Solo un aviso preparado');
  perform pg_temp.guardar('d1', 'authenticated', ger, format('select (public.registrar_aviso_accion(%s, ''declarado_enviado'', null, null)).id', current_setting('t.a1')));
  r := r || pg_temp.prueba('no se repite una declaracion vigente', 'authenticated', ger,
    format('select public.registrar_aviso_accion(%s, ''declarado_enviado'', null, null)', current_setting('t.a1')), 'Ya hay una declaracion');
  r := r || pg_temp.prueba('otro usuario no administrador no rectifica', 'authenticated', asi,
    format('select public.registrar_aviso_accion(%s, ''declaracion_rectificada'', ''x'', %s)', current_setting('t.a1'), current_setting('t.d1')), 'Solo quien declaro');
  r := r || pg_temp.prueba('la rectificacion apunta a una declaracion de ESE aviso', 'authenticated', adm,
    format('select public.registrar_aviso_accion(%s, ''declaracion_rectificada'', ''x'', %s)', current_setting('t.a2'), current_setting('t.d1')), 'de este aviso');
  r := r || pg_temp.prueba('quien declaro rectifica', 'authenticated', ger,
    format('select public.registrar_aviso_accion(%s, ''declaracion_rectificada'', ''no se envio'', %s)', current_setting('t.a1'), current_setting('t.d1')), null);
  r := r || pg_temp.prueba('una declaracion se rectifica una sola vez', 'authenticated', adm,
    format('select public.registrar_aviso_accion(%s, ''declaracion_rectificada'', ''x'', %s)', current_setting('t.a1'), current_setting('t.d1')), 'ya fue rectificada');
  r := r || case when (select count(*) from public.aviso_acciones where aviso_id = current_setting('t.a1')::bigint and tipo in ('declarado_enviado', 'declaracion_rectificada')) = 2
                 then 'OK    la rectificacion agrega una entrada: las dos quedan en el historial'
                 else 'FALLO la declaracion o la rectificacion no quedaron' end;
  r := r || pg_temp.prueba('el historial de acciones no se edita', 'postgres', null,
    format('update public.aviso_acciones set motivo = ''x'' where aviso_id = %s', current_setting('t.a1')), 'solo agregar');
  r := r || pg_temp.prueba('el historial de acciones no se borra', 'postgres', null,
    format('delete from public.aviso_acciones where aviso_id = %s', current_setting('t.a1')), 'solo agregar');
  r := r || pg_temp.prueba('tras rectificar se puede declarar de nuevo', 'authenticated', ger,
    format('select public.registrar_aviso_accion(%s, ''declarado_enviado'', null, null)', current_setting('t.a1')), null);
  r := r || pg_temp.prueba('una accion no valida', 'authenticated', ger,
    format('select public.registrar_aviso_accion(%s, ''enviado'', null, null)', current_setting('t.a1')), 'no valida');
  r := r || pg_temp.prueba('abierto/copiado por quien no tiene acceso a la operacion', 'authenticated', pro,
    format('select public.registrar_aviso_accion(%s, ''copiado'', null, null)', current_setting('t.a1')), 'No tenes acceso');

  -- ---- lectura: sin select directo salvo administrador; las funciones de lectura verifican el acceso ----
  perform pg_temp.pon_rol('authenticated', ger);
  select count(*) into x from public.avisos;
  reset role;
  r := r || case when x::int = 0 then 'OK    un no administrador no lee avisos directo (RLS)' else 'FALLO un no administrador leyo avisos directo' end;
  perform pg_temp.pon_rol('authenticated', ger);
  select count(*) into x from public.leer_avisos_de_evento(m_part, 'reservas_historial', 'T1');
  reset role;
  r := r || case when x::int = 2 then 'OK    quien opera la membresia lee los avisos de su evento' else 'FALLO lectura por evento: ' || x end;
  perform pg_temp.pon_rol('authenticated', pro);
  select count(*) into x from public.leer_avisos_de_evento(m_part, 'reservas_historial', 'T1');
  reset role;
  r := r || case when x::int = 0 then 'OK    un profesor de alcance propio no lee los avisos de una membresia ajena' else 'FALLO lectura ajena: ' || x end;
  perform pg_temp.pon_rol('authenticated', pro);
  select count(*) into x from public.acciones_de_aviso(current_setting('t.a1')::bigint);
  reset role;
  r := r || case when x::int = 0 then 'OK    ni su historial de acciones' else 'FALLO historial ajeno: ' || x end;

  -- ---- la revision del destino sube con cada cambio (A -> B -> A = 3) ----
  perform pg_temp.guardar('rv', 'postgres', null, format('select whatsapp_revision::text from public.contactos where id = %s', c_alu));
  update public.contactos set whatsapp = '+59170000001' where id = c_alu;
  update public.contactos set whatsapp = w_alu where id = c_alu;
  r := r || case when (select whatsapp_revision from public.contactos where id = c_alu) = current_setting('t.rv')::int + 2
                 then 'OK    A -> B -> A suma dos revisiones (no queda «igual»)'
                 else 'FALLO revision del destino' end;
  update public.contactos set nombre = nombre where id = c_alu and nombre is not null;
  r := r || case when (select whatsapp_revision from public.contactos where id = c_alu) = current_setting('t.rv')::int + 2
                 then 'OK    cambiar otro dato no sube la revision' else 'FALLO revision subio sin cambio de destino' end;

  fallos := (select count(*) from unnest(r) z where z like 'FALLO%');
  r := r || (fallos || ' FALLOS');
  -- Descarta todo: la excepcion trae el informe.
  raise exception E'RESULTADOS\n%', array_to_string(r, E'\n');
end $$;
