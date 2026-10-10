-- =====================================================================
-- TROPICANA - los controles 55-62 detectan inconsistencias (R20 E4a). SOLO DEV.
-- Generado a partir de scripts/control_migracion.sql (cada control, textual).
-- Todo corre en una transaccion que se DESCARTA al final (la ultima excepcion trae
-- los resultados): no deja nada. Primero, linea base (todos en 0); luego se
-- corrompe a proposito, con los triggers apagados, y cada control debe dar > 0.
-- Solo ASCII.
-- =====================================================================
create or replace function pg_temp.c55() returns bigint language sql as $f$
select n::bigint from (
select '55. asignacion con version liberada sin la fila de historial correspondiente (misma version, modo y hash)' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.contenido_usos u
 where u.version_id is not null
   and not exists (
     select 1 from public.contenido_usos_historial h
      where h.id = (select max(h2.id) from public.contenido_usos_historial h2 where h2.uso_id = u.id)
        and h.a_version = u.version_id and h.a_modo = u.modo
        and h.hash_aprobado = (select v.hash from public.contenido_versiones v where v.id = u.version_id))
) q
$f$;
create or replace function pg_temp.c56() returns bigint language sql as $f$
select n::bigint from (
select '56. asignacion liberada con una version que no esta publicada' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.contenido_usos u
  join public.contenido_versiones v on v.id = u.version_id
 where v.estado <> 'publicado'
) q
$f$;
create or replace function pg_temp.c57() returns bigint language sql as $f$
select n::bigint from (
select '57. version con estados y datos de cada paso (aprobado/publicado/retirado) que no coinciden' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.contenido_versiones v
 where (v.estado = 'publicado' and (v.publicado_en is null or v.publicado_por is null))
    or (v.estado in ('aprobado', 'publicado') and (v.aprobado_en is null or v.aprobado_por is null))
    or (v.estado = 'retirado' and (v.retirado_en is null or v.retirado_por is null or v.retirado_motivo is null))
    or (v.estado = 'retirado' and v.publicado_en is not null and v.aprobado_en is null)
    or (v.estado in ('borrador', 'en_revision') and (v.aprobado_en is not null or v.publicado_en is not null or v.retirado_en is not null))
) q
$f$;
create or replace function pg_temp.c58() returns bigint language sql as $f$
select n::bigint from (
with faltas as (
  select (select count(*) from public.contenidos c
           where c.canal = 'whatsapp'
             and (not exists (select 1 from public.contenido_versiones v where v.contenido_id = c.id and v.origen = 'predeterminado')
               or not exists (select 1 from public.contenido_usos u where u.contenido_id = c.id)))
         + (select count(*) from generate_series(1, 21) g
             where not exists (select 1 from public.contenidos c where c.caso = 'N' || lpad(g::text, 2, '0'))) as n
)
select '58. contenido de WhatsApp sin version predeterminada o sin asignacion, o caso N01-N21 sin contenido' as control,
       n, case when n = 0 then 'OK' else 'REVISAR' end as estado
  from faltas
) q
$f$;
create or replace function pg_temp.c59() returns bigint language sql as $f$
select n::bigint from (
select '59. asignacion en modo modulo (no hay conexion autorizada: E5)' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.contenido_usos where modo = 'modulo'
) q
$f$;
create or replace function pg_temp.c60() returns bigint language sql as $f$
select n::bigint from (
with malos as (
  select (select count(*) from (values ('anon'), ('authenticated')) a(ro),
                 (values ('public.contenidos'), ('public.contenido_versiones'), ('public.contenido_usos'), ('public.contenido_usos_historial'), ('public.contenido_versiones_historial')) b(t),
                 (values ('insert'), ('update'), ('delete'), ('truncate')) c(p)
           where has_table_privilege(a.ro, b.t, c.p))
         + (select count(*) from pg_proc p
             where p.oid in ('public.liberar_contenido(text,text,text,bigint,text,text,text,text)'::regprocedure,
                             'public.cambiar_estado_version(bigint,text,text,text,text,text)'::regprocedure)
               and (has_function_privilege('anon', p.oid, 'execute')
                 or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                             where a.grantee = 0 and a.privilege_type = 'EXECUTE'))) as n
)
select '60. permisos efectivos: escritura directa para anon/authenticated o execute de las funciones para anon/public' as control,
       n, case when n = 0 then 'OK' else 'REVISAR' end as estado
  from malos
) q
$f$;
create or replace function pg_temp.c61() returns bigint language sql as $f$
select n::bigint from (
select '61. version fuera de borrador sin su paso en el historial editorial (0073)' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.contenido_versiones v
 where v.estado <> 'borrador'
   and not exists (select 1 from public.contenido_versiones_historial h where h.version_id = v.id and h.a_estado = v.estado)
) q
$f$;
create or replace function pg_temp.c62() returns bigint language sql as $f$
select n::bigint from (
select '62. version cuyo ultimo paso del historial no es su estado actual (0073)' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.contenido_versiones v
 where exists (select 1 from public.contenido_versiones_historial h where h.version_id = v.id)
   and (select h.a_estado from public.contenido_versiones_historial h where h.version_id = v.id order by h.id desc limit 1) <> v.estado
) q
$f$;

do $$
declare
  r text[] := '{}';
  adm uuid;
  v9 bigint; h9 text; c9 bigint; v10 bigint;
  k text;
  n bigint;
  fallos int;
begin
  select p.id into adm from public.perfiles p join public.roles ro on ro.id = p.rol_id
   where ro.clave = 'administrador' and p.activo order by p.id limit 1;
  select v.id, v.hash, v.contenido_id into v9, h9, c9 from public.contenido_versiones v join public.contenidos c on c.id = v.contenido_id where c.clave = 'N09.unica.whatsapp';
  select v.id into v10 from public.contenido_versiones v join public.contenidos c on c.id = v.contenido_id where c.clave = 'N10.unica.whatsapp';

  -- linea base: todos en 0 (nada liberado, nada fuera de borrador)
  foreach k in array array['55','56','57','58','59','60','61','62'] loop
    execute format('select pg_temp.c%s()', k) into n;
    r := r || case when n = 0 then 'OK    base: control ' || k || ' = 0' else 'FALLO base: control ' || k || ' = ' || n end;
  end loop;

  -- corrupcion deliberada (sin triggers; sin los CHECK que protegen el control 57)
  set local session_replication_role = replica;
  -- 55, 56, 59: asignacion en modulo con una version no publicada y sin historial
  update public.contenido_usos set modo = 'modulo', version_id = v9 where uso = 'reserva.confirmada.alumno';
  -- 61, 62: una version en revision sin paso en el historial; otra con historial que no coincide
  update public.contenido_versiones set estado = 'en_revision' where id = v10;
  insert into public.contenido_versiones_historial (version_id, de_estado, a_estado, actor) values (v9, 'borrador', 'en_revision', adm);
  -- 57: sin los CHECK, un borrador con datos de retiro
  for k in select conname::text from pg_constraint where conrelid = 'public.contenido_versiones'::regclass and contype = 'c' loop
    execute format('alter table public.contenido_versiones drop constraint %I', k);
  end loop;
  update public.contenido_versiones set retirado_en = now() where id = (select min(id) from public.contenido_versiones where id not in (v9, v10));
  -- 58: una predeterminada que falta
  delete from public.contenido_versiones where id = (select max(id) from public.contenido_versiones where id not in (v9, v10));
  -- 60: escritura directa para authenticated
  grant insert on public.contenidos to authenticated;
  set local session_replication_role = origin;

  foreach k in array array['55','56','57','58','59','60','61','62'] loop
    execute format('select pg_temp.c%s()', k) into n;
    r := r || case when n > 0 then 'OK    detecta: control ' || k || ' = ' || n else 'FALLO no detecta: control ' || k end;
  end loop;

  fallos := (select count(*) from unnest(r) t where t like 'FALLO%');
  r := r || (fallos || ' FALLOS de ' || array_length(r, 1) || ' pruebas');
  raise exception '%', 'RESULTADOS' || chr(10) || array_to_string(r, chr(10));
end;
$$;
