-- =====================================================================
-- TROPICANA - prueba de la 0071/0072/0073 (R20 E4a). SOLO DEV.
-- ---------------------------------------------------------------------
-- Prueba con roles reales (anon, authenticated no administrador y
-- authenticated Administrador) los triggers, los permisos y las funciones de
-- contenidos. Corre TODO dentro de una transaccion que se DESCARTA al final
-- (termina con una excepcion cuyo mensaje trae los resultados): no deja
-- ninguna asignacion activada, ninguna version aprobada ni historial.
-- Pegar en el SQL Editor de tropicana-dev. Resultado esperado: toda linea
-- empieza con OK y la ultima dice «0 FALLOS».
-- Solo ASCII.
-- =====================================================================

-- Ejecuta p_sql como el rol dado (con el usuario p_uid) y espera un error que contenga p_patron
-- (o, si p_patron es null, espera que NO falle). Devuelve 'OK ...' o 'FALLO ...'.
create or replace function pg_temp.prueba(p_nombre text, p_rol text, p_uid uuid, p_sql text, p_patron text)
returns text
language plpgsql
as $$
declare
  v_msg text;
  v_fallo boolean := false;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_rol)::text, true);
    perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
    if p_rol <> 'postgres' then execute 'set local role ' || p_rol; end if;
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

do $$
declare
  r text[] := '{}';
  adm uuid;
  noadm uuid;
  v9 bigint;  h9 text;  c9 bigint;
  v10 bigint; h10 text;
  n_hist int;
  fallos int;
  x text;
begin
  select p.id into adm from public.perfiles p join public.roles ro on ro.id = p.rol_id
   where ro.clave = 'administrador' and p.activo order by p.id limit 1;
  select p.id into noadm from public.perfiles p join public.roles ro on ro.id = p.rol_id
   where ro.clave <> 'administrador' and p.activo order by p.id limit 1;
  if adm is null or noadm is null then raise exception 'Falta un administrador o un no administrador activo en dev'; end if;

  select v.id, v.hash, v.contenido_id into v9, h9, c9 from public.contenido_versiones v join public.contenidos c on c.id = v.contenido_id where c.clave = 'N09.unica.whatsapp';
  select v.id, v.hash into v10, h10 from public.contenido_versiones v join public.contenidos c on c.id = v.contenido_id where c.clave = 'N10.unica.whatsapp';

  -- ---- permisos efectivos ----
  r := r || case when exists (select 1
                  from (values ('anon'), ('authenticated')) a(ro),
                       (values ('public.contenidos'), ('public.contenido_versiones'), ('public.contenido_usos'), ('public.contenido_usos_historial')) b(t),
                       (values ('insert'), ('update'), ('delete'), ('truncate')) c(p)
                 where has_table_privilege(a.ro, b.t, c.p))
                 then 'FALLO permisos: anon o authenticated con escritura en las 4 tablas'
                 else 'OK    permisos: anon y authenticated sin escritura en las 4 tablas' end;
  r := r || case when not has_function_privilege('anon', 'public.liberar_contenido(text,text,text,bigint,text,text,text,text)', 'execute')
                  and not has_function_privilege('anon', 'public.cambiar_estado_version(bigint,text,text,text,text,text)', 'execute')
                  and has_function_privilege('authenticated', 'public.liberar_contenido(text,text,text,bigint,text,text,text,text)', 'execute')
                 then 'OK    permisos: las funciones no son para anon y si para authenticated'
                 else 'FALLO permisos: execute de las funciones' end;

  -- ---- anon y no administrador ----
  r := r || pg_temp.prueba('anon no lee contenidos', 'anon', null, 'select 1 from public.contenidos', 'permission denied');
  r := r || pg_temp.prueba('anon no libera', 'anon', null,
    'select public.liberar_contenido(''venta.recibo.alumno'',''unica'',''whatsapp'',null,''legado'',''x'',null,''x'')', 'permission denied');
  r := r || pg_temp.prueba('no administrador no ve filas', 'authenticated', noadm,
    'do $q$ begin if (select count(*) from public.contenidos) <> 0 then raise exception ''ve filas''; end if; end $q$', null);
  r := r || pg_temp.prueba('no administrador no cambia estado', 'authenticated', noadm,
    format('select public.cambiar_estado_version(%s, ''en_revision'')', v9), 'Solo el Administrador');
  r := r || pg_temp.prueba('no administrador no libera', 'authenticated', noadm,
    'select public.liberar_contenido(''venta.recibo.alumno'',''unica'',''whatsapp'',null,''legado'',''x'',null,''x'')', 'Solo el Administrador');

  -- ---- escritura directa (administrador incluido) ----
  r := r || pg_temp.prueba('admin no inserta directo en contenidos', 'authenticated', adm,
    'insert into public.contenidos (clave,caso,variante,canal,tipo,finalidad,nombre) values (''N99.unica.whatsapp'',''N99'',''unica'',''whatsapp'',''aviso'',''servicio'',''x'')', 'permission denied');
  r := r || pg_temp.prueba('admin no actualiza directo una version', 'authenticated', adm,
    format('update public.contenido_versiones set estado = ''aprobado'' where id = %s', v9), 'permission denied');
  r := r || pg_temp.prueba('admin no actualiza directo una asignacion', 'authenticated', adm,
    'update public.contenido_usos set modo = ''modulo''', 'permission denied');
  r := r || pg_temp.prueba('admin no inserta historial', 'authenticated', adm,
    'insert into public.contenido_usos_historial (uso_id,de_modo,a_modo,motivo,aprobacion_ref,actor) values (1,''legado'',''legado'',''x'',''x'',''' || adm || ''')', 'permission denied');
  r := r || pg_temp.prueba('admin lee', 'authenticated', adm,
    'do $q$ begin if (select count(*) from public.contenidos) <> 24 then raise exception ''no ve las 24''; end if; end $q$', null);

  -- ---- la marca interna no autoriza: ni siquiera el dueno actualiza una asignacion sin la funcion ----
  r := r || pg_temp.prueba('update directo de una asignacion (dueno)', 'postgres', null,
    'update public.contenido_usos set modo = ''legado''', 'solo liberar_contenido');
  r := r || pg_temp.prueba('delete de una asignacion', 'postgres', null, 'delete from public.contenido_usos', 'no se borra');

  -- ---- transiciones editoriales (funcion, como administrador) ----
  r := r || pg_temp.prueba('borrador -> aprobado (salto)', 'authenticated', adm,
    format('select public.cambiar_estado_version(%s, ''aprobado'', %L)', v9, h9), 'transicion invalida');
  r := r || pg_temp.prueba('borrador -> en_revision', 'authenticated', adm, format('select public.cambiar_estado_version(%s, ''en_revision'')', v9), null);
  r := r || pg_temp.prueba('en_revision -> borrador (vuelta)', 'authenticated', adm, format('select public.cambiar_estado_version(%s, ''borrador'')', v9), null);
  r := r || pg_temp.prueba('borrador -> en_revision (otra vez)', 'authenticated', adm, format('select public.cambiar_estado_version(%s, ''en_revision'')', v9), null);
  r := r || pg_temp.prueba('aprobar con un hash distinto al visto', 'authenticated', adm,
    format('select public.cambiar_estado_version(%s, ''aprobado'', %L)', v9, repeat('0', 64)), 'no es el de la version');
  r := r || pg_temp.prueba('aprobar con el hash visto', 'authenticated', adm, format('select public.cambiar_estado_version(%s, ''aprobado'', %L)', v9, h9), null);
  r := r || case when (select aprobado_por from public.contenido_versiones where id = v9) = adm then 'OK    aprobar deja al actor y la fecha' else 'FALLO aprobar no dejo al actor' end;

  -- ---- inmutabilidad desde aprobado ----
  r := r || pg_temp.prueba('aprobado: no cambia el cuerpo', 'postgres', null, format('update public.contenido_versiones set cuerpo = ''x'' where id = %s', v9), 'desde aprobado');
  r := r || pg_temp.prueba('aprobado: no cambia el hash', 'postgres', null, format('update public.contenido_versiones set hash = %L where id = %s', repeat('1', 64), v9), 'desde aprobado');
  r := r || pg_temp.prueba('aprobado: no cambia el esquema', 'postgres', null, format('update public.contenido_versiones set esquema = ''{}''::jsonb where id = %s', v9), 'desde aprobado');
  r := r || pg_temp.prueba('aprobado: no cambia quien aprobo', 'postgres', null, format('update public.contenido_versiones set aprobado_por = %L where id = %s', noadm, v9), 'desde aprobado');
  r := r || pg_temp.prueba('aprobado -> borrador (vuelta)', 'postgres', null, format('update public.contenido_versiones set estado = ''borrador'' where id = %s', v9), 'transicion invalida');
  r := r || pg_temp.prueba('aprobado: no se borra', 'postgres', null, format('delete from public.contenido_versiones where id = %s', v9), 'no se borra');
  r := r || pg_temp.prueba('contenido con version aprobada: no cambia su identidad', 'postgres', null,
    format('update public.contenidos set variante = ''otra'', clave = caso || ''.otra.'' || canal where id = %s', c9), 'identidad');
  r := r || pg_temp.prueba('un contenido no se borra', 'postgres', null, format('delete from public.contenidos where id = %s', c9), 'no se borra');

  -- ---- publicar y liberar ----
  r := r || pg_temp.prueba('liberar una version aprobada (no publicada)', 'authenticated', adm,
    format('select public.liberar_contenido(''reserva.confirmada.alumno'',''unica'',''whatsapp'',%s,''modulo'',''prueba'',%L,''prueba'')', v9, h9), 'no publicado');
  r := r || pg_temp.prueba('publicar sin etiqueta', 'authenticated', adm, format('select public.cambiar_estado_version(%s, ''publicado'', %L)', v9, h9), 'etiqueta');
  r := r || pg_temp.prueba('publicar', 'authenticated', adm, format('select public.cambiar_estado_version(%s, ''publicado'', %L, null, ''v1-prueba'')', v9, h9), null);
  r := r || case when (select count(*) from public.contenido_usos where modo = 'modulo') = 0 then 'OK    publicar no libera ningun uso' else 'FALLO publicar libero algo' end;
  r := r || pg_temp.prueba('publicado: no cambia la etiqueta', 'postgres', null, format('update public.contenido_versiones set etiqueta = ''otra'' where id = %s', v9), 'desde publicado');
  r := r || pg_temp.prueba('publicado: no cambia el cuerpo', 'postgres', null, format('update public.contenido_versiones set cuerpo = ''x'' where id = %s', v9), 'desde aprobado');

  r := r || pg_temp.prueba('liberar con hash distinto', 'authenticated', adm,
    format('select public.liberar_contenido(''reserva.confirmada.alumno'',''unica'',''whatsapp'',%s,''modulo'',''prueba'',%L,''prueba'')', v9, repeat('0', 64)), 'no es el de la version');
  r := r || pg_temp.prueba('liberar una version de otro contenido', 'authenticated', adm,
    format('select public.liberar_contenido(''reserva.confirmada.alumno'',''unica'',''whatsapp'',%s,''modulo'',''prueba'',%L,''prueba'')', v10, h10), 'no es del contenido');
  r := r || pg_temp.prueba('liberar sin motivo', 'authenticated', adm,
    format('select public.liberar_contenido(''reserva.confirmada.alumno'',''unica'',''whatsapp'',%s,''modulo'','' '',%L,''prueba'')', v9, h9), 'motivo');
  r := r || pg_temp.prueba('modo modulo sin version', 'authenticated', adm,
    'select public.liberar_contenido(''reserva.confirmada.alumno'',''unica'',''whatsapp'',null,''modulo'',''prueba'',null,''prueba'')', 'exige una version');
  r := r || pg_temp.prueba('asignacion inexistente', 'authenticated', adm,
    format('select public.liberar_contenido(''no.existe'',''unica'',''whatsapp'',%s,''modulo'',''prueba'',%L,''prueba'')', v9, h9), 'No existe la asignacion');

  -- atomicidad: si el historial falla, la asignacion no cambia
  execute 'create or replace function pg_temp.rompe() returns trigger language plpgsql as $f$ begin raise exception ''historial roto a proposito''; end $f$';
  execute 'create trigger zz_rompe before insert on public.contenido_usos_historial for each row execute function pg_temp.rompe()';
  n_hist := (select count(*) from public.contenido_usos_historial);
  r := r || pg_temp.prueba('liberacion con el historial roto falla', 'authenticated', adm,
    format('select public.liberar_contenido(''reserva.confirmada.alumno'',''unica'',''whatsapp'',%s,''modulo'',''prueba'',%L,''prueba'')', v9, h9), 'roto a proposito');
  r := r || case when (select modo from public.contenido_usos where uso = 'reserva.confirmada.alumno') = 'legado'
                  and (select version_id from public.contenido_usos where uso = 'reserva.confirmada.alumno') is null
                  and (select count(*) from public.contenido_usos_historial) = n_hist
                 then 'OK    una liberacion que falla no deja cambio ni historial' else 'FALLO la liberacion fallida dejo rastro' end;
  execute 'drop trigger zz_rompe on public.contenido_usos_historial';

  r := r || pg_temp.prueba('liberar (modulo)', 'authenticated', adm,
    format('select public.liberar_contenido(''reserva.confirmada.alumno'',''unica'',''whatsapp'',%s,''modulo'',''prueba'',%L,''prueba de E4a'')', v9, h9), null);
  r := r || case when (select count(*) from public.contenido_usos_historial h join public.contenido_usos u on u.id = h.uso_id
                        where u.uso = 'reserva.confirmada.alumno' and h.a_version = v9 and h.hash_aprobado = h9 and h.a_modo = 'modulo'
                          and h.de_modo = 'legado' and h.actor = adm and h.aprobacion_ref = 'prueba de E4a') = 1
                 then 'OK    liberar deja su historial (version, hash, modos, actor, referencia)' else 'FALLO historial de la liberacion' end;

  -- no se retira lo que esta asignado
  r := r || pg_temp.prueba('retirar una version asignada', 'authenticated', adm,
    format('select public.cambiar_estado_version(%s, ''retirado'', null, ''prueba'')', v9), 'asignada a un uso');
  r := r || pg_temp.prueba('volver a legado sin version', 'authenticated', adm,
    'select public.liberar_contenido(''reserva.confirmada.alumno'',''unica'',''whatsapp'',null,''legado'',''vuelta'',null,''prueba de E4a'')', null);
  r := r || case when (select count(*) from public.contenido_usos_historial h join public.contenido_usos u on u.id = h.uso_id
                        where u.uso = 'reserva.confirmada.alumno' and h.de_version = v9 and h.a_version is null and h.a_modo = 'legado') = 1
                 then 'OK    volver a legado deja su historial' else 'FALLO historial de la vuelta a legado' end;
  r := r || pg_temp.prueba('retirar sin motivo', 'authenticated', adm, format('select public.cambiar_estado_version(%s, ''retirado'')', v9), 'motivo');
  r := r || pg_temp.prueba('retirar una version ya sin asignar', 'authenticated', adm, format('select public.cambiar_estado_version(%s, ''retirado'', null, ''prueba'')', v9), null);
  r := r || pg_temp.prueba('retirado es final', 'postgres', null, format('update public.contenido_versiones set etiqueta = ''x'' where id = %s', v9), 'es final');
  r := r || pg_temp.prueba('liberar una version retirada', 'authenticated', adm,
    format('select public.liberar_contenido(''reserva.confirmada.alumno'',''unica'',''whatsapp'',%s,''modulo'',''prueba'',%L,''prueba'')', v9, h9), 'no publicado');

  -- historial de solo agregar, y versiones nuevas nacen en borrador
  r := r || pg_temp.prueba('el historial no se edita', 'postgres', null, 'update public.contenido_usos_historial set motivo = ''x''', 'solo agregar');
  r := r || pg_temp.prueba('el historial no se borra', 'postgres', null, 'delete from public.contenido_usos_historial', 'solo agregar');
  r := r || pg_temp.prueba('una version no nace publicada', 'postgres', null,
    format('insert into public.contenido_versiones (contenido_id,numero,cuerpo,esquema,hash,origen,estado,etiqueta,publicado_en,publicado_por,aprobado_en,aprobado_por) values (%s,9,''x'',''{}''::jsonb,%L,''editado'',''publicado'',''e'',now(),%L,now(),%L)', c9, repeat('2', 64), adm, adm), 'nace en borrador');
  r := r || pg_temp.prueba('WhatsApp no lleva asunto', 'postgres', null,
    format('insert into public.contenido_versiones (contenido_id,numero,cuerpo,asunto,esquema,hash,origen) values (%s,9,''x'',''a'',''{}''::jsonb,%L,''editado'')', c9, repeat('3', 64)), 'no lleva asunto');

  -- ---- 0073: historial editorial de versiones ----
  r := r || pg_temp.prueba('enviar a revision', 'authenticated', adm, format('select public.cambiar_estado_version(%s, ''en_revision'')', v10), null);
  r := r || pg_temp.prueba('volver a borrador', 'authenticated', adm, format('select public.cambiar_estado_version(%s, ''borrador'', null, ''falta corregir un dato'')', v10), null);
  r := r || case when (select count(*) from public.contenido_versiones_historial
                        where version_id = v10 and de_estado = 'borrador' and a_estado = 'en_revision' and actor = adm
                          and creado_en > now() - interval '1 minute') = 1
                  and (select count(*) from public.contenido_versiones_historial
                        where version_id = v10 and de_estado = 'en_revision' and a_estado = 'borrador' and actor = adm
                          and motivo = 'falta corregir un dato' and creado_en > now() - interval '1 minute') = 1
                 then 'OK    el retorno de en_revision a borrador deja actor, fecha y motivo' else 'FALLO historial de versiones: retorno a borrador' end;
  r := r || case when (select count(*) from public.contenido_versiones_historial where version_id = v9) >= 1
                  and not exists (select 1 from public.contenido_versiones x where x.estado <> 'borrador'
                                   and not exists (select 1 from public.contenido_versiones_historial h where h.version_id = x.id and h.a_estado = x.estado))
                 then 'OK    todo estado distinto de borrador tiene su paso en el historial' else 'FALLO versiones sin su paso en el historial' end;
  r := r || pg_temp.prueba('el historial de versiones no se edita', 'postgres', null, 'update public.contenido_versiones_historial set motivo = ''x''', 'solo agregar');
  r := r || pg_temp.prueba('el historial de versiones no se borra', 'postgres', null, 'delete from public.contenido_versiones_historial', 'solo agregar');
  r := r || pg_temp.prueba('no administrador no ve el historial de versiones', 'authenticated', noadm,
    'do $q$ begin if (select count(*) from public.contenido_versiones_historial) <> 0 then raise exception ''ve filas''; end if; end $q$', null);
  r := r || pg_temp.prueba('authenticated no escribe el historial de versiones', 'authenticated', adm,
    format('insert into public.contenido_versiones_historial (version_id,de_estado,a_estado,actor) values (%s,''borrador'',''en_revision'',%L)', v10, adm), 'permission denied');
  -- atomicidad: si el historial de versiones falla, el estado no cambia
  execute 'create trigger zz_rompe2 before insert on public.contenido_versiones_historial for each row execute function pg_temp.rompe()';
  r := r || pg_temp.prueba('cambio de estado con el historial roto falla', 'authenticated', adm, format('select public.cambiar_estado_version(%s, ''en_revision'')', v10), 'roto a proposito');
  r := r || case when (select estado from public.contenido_versiones where id = v10) = 'borrador'
                 then 'OK    un cambio de estado que falla no deja cambio' else 'FALLO el cambio fallido dejo rastro' end;
  execute 'drop trigger zz_rompe2 on public.contenido_versiones_historial';

  -- ---- email y asunto: modelados (no se importan plantillas de email) ----
  insert into public.contenidos (clave, caso, variante, canal, tipo, finalidad, nombre)
  values ('N98.prueba.email', 'N98', 'prueba', 'email', 'aviso', 'servicio', 'Prueba email');
  r := r || pg_temp.prueba('email sin asunto', 'postgres', null,
    format('insert into public.contenido_versiones (contenido_id,numero,cuerpo,esquema,hash,origen) values (%s,1,''x'',''{}''::jsonb,%L,''editado'')',
           (select id from public.contenidos where clave = 'N98.prueba.email'), repeat('4', 64)), 'email lleva asunto');
  r := r || pg_temp.prueba('email con asunto', 'postgres', null,
    format('insert into public.contenido_versiones (contenido_id,numero,cuerpo,asunto,esquema,hash,origen) values (%s,1,''x'',''Asunto'',''{}''::jsonb,%L,''editado'')',
           (select id from public.contenidos where clave = 'N98.prueba.email'), repeat('4', 64)), null);
  r := r || pg_temp.prueba('el email pasa a revision', 'postgres', null,
    format('update public.contenido_versiones set estado=''en_revision'' where contenido_id = %s', (select id from public.contenidos where clave = 'N98.prueba.email')), null);
  r := r || pg_temp.prueba('aprobar el email', 'postgres', null,
    format('update public.contenido_versiones set estado=''aprobado'', aprobado_en=now(), aprobado_por=%L where contenido_id = %s', adm, (select id from public.contenidos where clave = 'N98.prueba.email')), null);
  r := r || pg_temp.prueba('cambiar el asunto despues de aprobar', 'postgres', null,
    format('update public.contenido_versiones set asunto=''Otro'' where contenido_id = %s', (select id from public.contenidos where clave = 'N98.prueba.email')), 'desde aprobado');

  -- fin: cuantos fallaron
  fallos := (select count(*) from unnest(r) t where t like 'FALLO%');
  r := r || (fallos || ' FALLOS de ' || array_length(r, 1) || ' pruebas');
  -- La transaccion se descarta: el mensaje trae los resultados.
  raise exception E'RESULTADOS\n%', array_to_string(r, E'\n');
end;
$$;
