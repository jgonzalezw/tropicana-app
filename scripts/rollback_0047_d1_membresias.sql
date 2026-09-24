-- =====================================================================
-- TROPICANA - ROLLBACK de 0047_d1_membresias.sql
-- ---------------------------------------------------------------------
-- NO es una migracion mas: no vive en supabase/migrations/ ni se corre
-- en el flujo normal de pases. Se guarda lista para el dia del pase de
-- D1 a produccion, por si aparece un problema y hay que volver atras.
--
-- QUE HACE. Deshace exactamente la 0047, en el orden inverso: primero
-- las tablas, despues las columnas, despues los nombres derivados
-- (restricciones, indices, secuencias, politicas). Es simetrica a
-- proposito: cada paso reversa el paso equivalente de la 0047.
--
-- POR QUE ES SEGURA. La 0047 solo renombra -- no borra columnas, no
-- transforma datos, no hace backfill. Revertirla es otro renombre: no
-- se pierde ninguna fila, sea que se haya escrito antes o despues del
-- pase.
--
-- COMO SE VERIFICO (2026-09-24). Los nombres finales de este script se
-- confirmaron contra produccion (`pnvhpbxjbdmbktpwebtx`), que sigue con
-- el esquema pre-D1 intacto: se listaron los 18 restricciones + 9
-- indices sueltos + 2 secuencias + 4 politicas de las 6 tablas, y se
-- verifico que la cadena de renombrado de este script reproduce cada
-- nombre exacto -- incluida la restriccion
-- `inscripciones_membresia_anterior_id_fkey` (que SI contiene
-- "membresia" pero NO debe tocarse como concepto -- ver el glosario de
-- REGLAS.md -- y que el renombrado por substring deja intacta porque
-- "membresia_anterior_id" no matchea ni "membresias" ni "membresia_id"
-- como substring exacto). Probado de punta a punta en dev: aplicar la
-- 0047, correr este rollback, confirmar que los nombres vuelven a ser
-- byte a byte los mismos que en produccion, y volver a aplicar la 0047
-- para dejar dev como estaba.
--
-- CUANDO USARLO. Solo si, despues de correr la 0047 en produccion, algo
-- sale mal ANTES o DESPUES del deploy del codigo nuevo. Se corre este
-- script y, en el mismo momento, se vuelve el codigo de Vercel al
-- deploy anterior (Deployments -> el commit antes del pase -> Promote).
-- Las dos partes se revierten juntas -- igual que se aplican juntas.
-- =====================================================================

-- 1-2. Tablas
alter table if exists public.membresias      rename to inscripciones;
alter table if exists public.membresia_cursos rename to inscripcion_cursos;

-- 3. Columnas
alter table public.asistencias        rename column membresia_id to inscripcion_id;
alter table public.cuotas             rename column membresia_id to inscripcion_id;
alter table public.pagos              rename column membresia_id to inscripcion_id;
alter table public.corrimientos_ciclo rename column membresia_id to inscripcion_id;
alter table public.inscripcion_cursos rename column membresia_id to inscripcion_id;

-- 4. Nombres derivados (mismo mecanismo que la 0047, con los strings
--    invertidos y en el mismo orden: constraints primero -- que de paso
--    renombran el indice que respalda cada restriccion -- despues los
--    indices sueltos que todavia digan "membresi", despues secuencias
--    y politicas RLS).
do $$
declare
  r record;
begin
  -- Restricciones
  for r in
    select conrelid::regclass::text as tabla, conname,
           replace(replace(replace(conname,
             'membresia_cursos', 'inscripcion_cursos'),
             'membresias', 'inscripciones'),
             'membresia_id', 'inscripcion_id') as nuevo
      from pg_constraint
     where connamespace = 'public'::regnamespace
       and conrelid::regclass::text in ('inscripciones','inscripcion_cursos','asistencias',
                                        'cuotas','pagos','corrimientos_ciclo')
       and (conname like '%membresia_cursos%' or conname like '%membresias%'
            or conname like '%membresia_id%')
  loop
    execute format('alter table public.%I rename constraint %I to %I', r.tabla, r.conname, r.nuevo);
  end loop;

  -- Indices sueltos (los que no son de una restriccion -- los que ya
  -- se respaldan solos ya quedaron renombrados por el paso anterior)
  for r in
    select i.indexname,
           replace(replace(replace(replace(i.indexname,
             'membresia_cursos_memb', 'inscripcion_cursos_insc'),
             'membresia_cursos', 'inscripcion_cursos'),
             'membresias', 'inscripciones'),
             'membresia', 'inscripcion') as nuevo
      from pg_indexes i
     where i.schemaname = 'public'
       and i.tablename in ('inscripciones','inscripcion_cursos','asistencias','cuotas',
                           'pagos','corrimientos_ciclo')
       and i.indexname like '%membresi%'
  loop
    execute format('alter index public.%I rename to %I', r.indexname, r.nuevo);
  end loop;

  -- Secuencias de las columnas identity (no figuran en
  -- information_schema.sequences: se buscan en pg_class)
  for r in
    select c.relname,
           replace(replace(c.relname, 'membresia_cursos', 'inscripcion_cursos'),
                   'membresias', 'inscripciones') as nuevo
      from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
       and c.relname like '%membresi%'
  loop
    execute format('alter sequence public.%I rename to %I', r.relname, r.nuevo);
  end loop;

  -- Politicas RLS
  for r in
    select tablename, policyname,
           replace(replace(policyname, 'membresia_cursos', 'inscripcion_cursos'),
                   'membresias', 'inscripciones') as nuevo
      from pg_policies
     where schemaname = 'public'
       and tablename in ('inscripciones','inscripcion_cursos')
       and policyname like '%membresi%'
  loop
    execute format('alter policy %I on public.%I rename to %I', r.policyname, r.tablename, r.nuevo);
  end loop;
end $$;

comment on table public.inscripciones is null;
comment on table public.inscripcion_cursos is null;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN rollback 0047
-- =====================================================================
