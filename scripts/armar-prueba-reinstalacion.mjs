// R20 E4a — arma, SIN conectarse a nada, el SQL de la prueba de instalacion, reversion y
// reinstalacion de los contenidos (0071/0072/0073). SOLO DEV.
//
// Uso:  node scripts/armar-prueba-reinstalacion.mjs > prueba-reinstalacion.sql
// y pegar el resultado en el SQL Editor de tropicana-dev (o ejecutarlo con la herramienta SQL).
//
// Todo corre en UNA transaccion que se DESCARTA: la ultima instruccion es una excepcion que trae los
// resultados. Parte A: cada tipo de trabajo editorial hace que el rollback ABORTE (nada se borra).
// Parte B: con el estado limpio (24 borradores, 24 asignaciones en legado) se guarda una huella de los
// datos y de la estructura, se revierte, se reinstalan 0071, 0072 y 0073 (los archivos reales, textuales)
// y se comparan estructura y datos. No se usa ninguna copia de los datos para reponerlos.
import { readFileSync } from "node:fs";

const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const rollback = leer("scripts/rollback_0071_comunicaciones.sql");
const m0071 = leer("supabase/migrations/0071_comunicaciones_contenidos.sql");
const m0072 = leer("supabase/migrations/0072_comunicaciones_predeterminados_inicial.sql");
const m0073 = leer("supabase/migrations/0073_comunicaciones_historial_versiones.sql");

// La guarda es el primer bloque do $$ ... $$; del rollback; el resto son los drops.
const ini = rollback.indexOf("do $$");
const fin = rollback.indexOf("\n$$;", ini);
if (ini < 0 || fin < 0) throw new Error("No encuentro la guarda del rollback");
const cuerpoGuarda = rollback.slice(ini + "do $$".length, fin);
const drops = rollback.slice(fin + "\n$$;".length);

const FIRMA = `
create temp table firma (momento text, k text, v text);
create or replace function pg_temp.firma_de(p_momento text) returns void language sql as $f$
insert into firma
select p_momento, k, v from (
  select 'col' as k, c.table_name || '.' || c.column_name || ':' || c.data_type || ':' || c.is_nullable || ':' || coalesce(c.column_default, '') || ':' || c.is_identity as v
    from information_schema.columns c where c.table_schema = 'public' and c.table_name like 'contenido%'
  union all
  select 'con', t.relname || ':' || x.conname || ':' || pg_get_constraintdef(x.oid)
    from pg_constraint x join pg_class t on t.oid = x.conrelid where t.relnamespace = 'public'::regnamespace and t.relname like 'contenido%'
  union all
  select 'trg', t.relname || ':' || g.tgname || ':' || pg_get_triggerdef(g.oid)
    from pg_trigger g join pg_class t on t.oid = g.tgrelid where not g.tgisinternal and t.relnamespace = 'public'::regnamespace and t.relname like 'contenido%'
  union all
  select 'fn', p.proname || ':' || md5(regexp_replace(pg_get_functiondef(p.oid), '(--[^\\n]*)|\\s+', '', 'g')) || ':' || coalesce(p.proacl::text, '')
    from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'contenido%' or p.proname in ('cambiar_estado_version', 'liberar_contenido'))
  union all
  select 'pol', tablename || ':' || policyname || ':' || cmd || ':' || roles::text || ':' || coalesce(qual, '')
    from pg_policies where schemaname = 'public' and tablename like 'contenido%'
  union all
  select 'acl', c.relname || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text || ':' || coalesce(obj_description(c.oid), '')
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname like 'contenido%'
  union all
  select 'idx', indexdef from pg_indexes where schemaname = 'public' and tablename like 'contenido%'
) s
$f$;
create or replace function pg_temp.firma_datos() returns text language sql as $f$
select md5(coalesce((select string_agg(clave || '|' || caso || '|' || variante || '|' || canal || '|' || tipo || '|' || finalidad || '|' || nombre || '|' || coalesce(descripcion, ''), E'\\n' order by clave) from public.contenidos), '') ||
  coalesce((select string_agg(c.clave || '|' || v.numero || '|' || v.hash || '|' || v.origen || '|' || v.estado || '|' || v.cuerpo || '|' || coalesce(v.asunto, '') || '|' || v.esquema::text, E'\\n' order by c.clave, v.numero)
              from public.contenido_versiones v join public.contenidos c on c.id = v.contenido_id), '') ||
  coalesce((select string_agg(u.uso || '|' || u.variante || '|' || u.canal || '|' || c.clave || '|' || u.modo || '|' || coalesce(u.version_id::text, ''), E'\\n' order by u.uso, u.variante, u.canal)
              from public.contenido_usos u join public.contenidos c on c.id = u.contenido_id), ''))
$f$;
`;

const salida = `-- Generado por scripts/armar-prueba-reinstalacion.mjs. SOLO DEV. Termina con una excepcion: no deja nada.
create temp table res (n serial, t text);
create or replace function pg_temp.guarda() returns void language plpgsql as $g$${cuerpoGuarda}
$g$;
${FIRMA}
-- ===== PARTE A: el trabajo editorial hace que el rollback ABORTE =====
do $$
declare
  r text;
  v1 bigint; c1 bigint; u1 bigint; adm uuid;
begin
  select id, contenido_id into v1, c1 from public.contenido_versiones order by id limit 1;
  select id into u1 from public.contenido_usos where contenido_id = c1;
  select p.id into adm from public.perfiles p join public.roles ro on ro.id = p.rol_id where ro.clave = 'administrador' and p.activo order by p.id limit 1;

  begin perform pg_temp.guarda(); r := 'OK    estado limpio: la guarda deja pasar el rollback';
  exception when others then r := 'FALLO estado limpio: la guarda aborto: ' || sqlerrm; end;
  insert into res(t) values (r);

  -- A1: una version fuera de borrador
  begin
    update public.contenido_versiones set estado = 'en_revision' where id = v1;
    begin perform pg_temp.guarda(); r := 'FALLO A1: no aborto con una version en revision';
    exception when others then r := case when sqlerrm like 'Rollback 0071 abortado%' then 'OK    A1: aborta con una version en revision' else 'FALLO A1: ' || sqlerrm end; end;
    raise exception 'deshacer';
  exception when others then if sqlerrm <> 'deshacer' then r := 'FALLO A1: ' || sqlerrm; end if; end;
  insert into res(t) values (r);

  -- A2: una version creada por una persona
  begin
    insert into public.contenido_versiones (contenido_id, numero, cuerpo, esquema, hash, origen, creado_por)
    values (c1, 99, 'x', '{}'::jsonb, repeat('7', 64), 'editado', adm);
    begin perform pg_temp.guarda(); r := 'FALLO A2: no aborto con una version editada';
    exception when others then r := case when sqlerrm like 'Rollback 0071 abortado%' then 'OK    A2: aborta con una version editada por una persona' else 'FALLO A2: ' || sqlerrm end; end;
    raise exception 'deshacer';
  exception when others then if sqlerrm <> 'deshacer' then r := 'FALLO A2: ' || sqlerrm; end if; end;
  insert into res(t) values (r);

  -- A3: una fila del historial editorial de versiones (0073)
  begin
    insert into public.contenido_versiones_historial (version_id, de_estado, a_estado, actor) values (v1, 'borrador', 'en_revision', adm);
    begin perform pg_temp.guarda(); r := 'FALLO A3: no aborto con historial de versiones';
    exception when others then r := case when sqlerrm like 'Rollback 0073 abortado%' then 'OK    A3: aborta con historial editorial de versiones' else 'FALLO A3: ' || sqlerrm end; end;
    raise exception 'deshacer';
  exception when others then if sqlerrm <> 'deshacer' then r := 'FALLO A3: ' || sqlerrm; end if; end;
  insert into res(t) values (r);

  -- A4: una fila del historial de liberaciones
  begin
    insert into public.contenido_usos_historial (uso_id, de_modo, a_modo, motivo, aprobacion_ref, actor) values (u1, 'legado', 'legado', 'x', 'x', adm);
    begin perform pg_temp.guarda(); r := 'FALLO A4: no aborto con historial de liberaciones';
    exception when others then r := case when sqlerrm like 'Rollback 0071 abortado%' then 'OK    A4: aborta con historial de liberaciones' else 'FALLO A4: ' || sqlerrm end; end;
    raise exception 'deshacer';
  exception when others then if sqlerrm <> 'deshacer' then r := 'FALLO A4: ' || sqlerrm; end if; end;
  insert into res(t) values (r);

  -- A5: una asignacion liberada
  begin
    perform set_config('tropicana.liberando', 'on', true);
    update public.contenido_usos set modo = 'modulo', version_id = v1 where id = u1;
    perform set_config('tropicana.liberando', 'off', true);
    begin perform pg_temp.guarda(); r := 'FALLO A5: no aborto con una asignacion liberada';
    exception when others then r := case when sqlerrm like 'Rollback 0071 abortado%' then 'OK    A5: aborta con una asignacion liberada' else 'FALLO A5: ' || sqlerrm end; end;
    raise exception 'deshacer';
  exception when others then if sqlerrm <> 'deshacer' then r := 'FALLO A5: ' || sqlerrm; end if; end;
  insert into res(t) values (r);

  -- tras todo eso, nada cambio
  insert into res(t) values (case when (select count(*) from public.contenido_versiones where estado <> 'borrador' or origen <> 'predeterminado') = 0
                                   and (select count(*) from public.contenido_usos where modo <> 'legado' or version_id is not null) = 0
                                   and (select count(*) from public.contenido_versiones_historial) = 0
                                   and (select count(*) from public.contenido_usos_historial) = 0
                                  then 'OK    A: las comprobaciones no dejaron nada' else 'FALLO A: quedo algo' end);
end;
$$;

-- ===== PARTE B: revertir y reinstalar con el estado limpio =====
select pg_temp.firma_de('antes');
create temp table dato_antes as select pg_temp.firma_datos() as h;

-- reversion (el script de rollback, textual, menos su guarda: la guarda ya se probo arriba)
${drops}
insert into res(t) select case when to_regclass('public.contenidos') is null and to_regclass('public.contenido_versiones') is null
                                 and to_regclass('public.contenido_usos') is null and to_regclass('public.contenido_usos_historial') is null
                                 and to_regclass('public.contenido_versiones_historial') is null
                                 and not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'contenido%' or proname in ('cambiar_estado_version', 'liberar_contenido')))
                                then 'OK    B: tras el rollback no queda tabla ni funcion' else 'FALLO B: el rollback dejo objetos' end;

-- reinstalacion: 0071 y 0073 textuales
${m0071}
${m0073}

-- 0072 real (archivo textual): importa los 24 predeterminados
${m0072}

select pg_temp.firma_de('despues');
insert into res(t) select case when (select count(*) from firma where momento = 'antes') = (select count(*) from firma where momento = 'despues')
                                and not exists (select 1 from (select k, v from firma where momento = 'antes' except select k, v from firma where momento = 'despues') d)
                                and not exists (select 1 from (select k, v from firma where momento = 'despues' except select k, v from firma where momento = 'antes') d)
                               then 'OK    B: la estructura reinstalada es identica a la de antes (' || (select count(*) from firma where momento = 'antes') || ' elementos)'
                               else 'FALLO B: la estructura difiere: ' || coalesce((select string_agg(k || ' ' || left(v, 80), ' // ') from (select k, v from firma where momento = 'antes' except select k, v from firma where momento = 'despues') d), '') end;
insert into res(t) select case when pg_temp.firma_datos() = (select h from dato_antes) then 'OK    B: los datos reinstalados son identicos a los de antes (24 contenidos, 24 versiones, 24 asignaciones)' else 'FALLO B: los datos difieren' end;
insert into res(t) select case when (select count(*) from public.contenidos) = 24 and (select count(*) from public.contenido_versiones where estado = 'borrador' and origen = 'predeterminado') = 24
                                and (select count(*) from public.contenido_usos where modo = 'legado' and version_id is null) = 24
                               then 'OK    B: 24 borradores y 24 asignaciones en legado' else 'FALLO B: conteos' end;

do $$
declare r text; fallos int;
begin
  select string_agg(t, E'\\n' order by n) into r from res;
  select count(*) into fallos from res where t like 'FALLO%';
  raise exception '%', 'RESULTADOS' || chr(10) || r || chr(10) || fallos || ' FALLOS de ' || (select count(*) from res) || ' pruebas';
end;
$$;
`;
process.stdout.write(salida);
