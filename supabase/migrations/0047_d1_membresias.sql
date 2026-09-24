-- =====================================================================
-- TROPICANA - 0047: D1, un concepto un nombre -- la membresia
-- ---------------------------------------------------------------------
-- EL PROBLEMA. La venta de un plan a un alumno se llama "membresia" en el
-- glosario, en los documentos y en la conversacion, pero la base la llamaba
-- `inscripciones`, y la llave a ella se escribia de dos formas:
-- `inscripcion_id` (asistencias, cuotas, pagos, corrimientos_ciclo,
-- inscripcion_cursos) y `membresia_id` (comisiones_devengadas,
-- liquidacion_items). El control 15 daba REVISAR por eso en cada pase.
-- Javier decidio el 2026-09-24 hacerla ahora, antes de C3-0a.1, porque
-- el codigo de contactos toca los mismos archivos y asi se escribe una vez.
--
-- QUE HACE. Solo renombra; no toca ninguna fila.
--   1. inscripciones      -> membresias
--   2. inscripcion_cursos -> membresia_cursos
--   3. inscripcion_id     -> membresia_id  (en las 5 tablas que la tenian)
--   4. Restricciones, indices, secuencias y politicas con el nombre viejo.
--
-- QUE NO HACE.
--   - `fin_ciclo_previo_0022` es un respaldo historico: conserva su columna.
--   - La clave del MODULO de permisos `inscripciones` (rol_permisos) no es la
--     tabla: es la pantalla de venta, y no cambia.
--
-- NO ES ADITIVA: apenas corre, el codigo que busca los nombres viejos falla
-- hasta que se publica el codigo nuevo. En produccion va en una ventana sin
-- operacion, seguida de un solo push.
-- =====================================================================

-- 1-2. Tablas
alter table if exists public.inscripciones      rename to membresias;
alter table if exists public.inscripcion_cursos rename to membresia_cursos;

-- 3. Columnas
alter table public.asistencias        rename column inscripcion_id to membresia_id;
alter table public.cuotas             rename column inscripcion_id to membresia_id;
alter table public.pagos              rename column inscripcion_id to membresia_id;
alter table public.corrimientos_ciclo rename column inscripcion_id to membresia_id;
alter table public.membresia_cursos   rename column inscripcion_id to membresia_id;

-- 4. Nombres derivados (renombrar solo si existe, para que sea re-ejecutable)
do $$
declare
  r record;
begin
  -- Restricciones (renombrar la PK/UNIQUE renombra tambien su indice)
  for r in
    select conrelid::regclass::text as tabla, conname,
           replace(replace(replace(conname,
             'inscripcion_cursos', 'membresia_cursos'),
             'inscripciones', 'membresias'),
             'inscripcion_id', 'membresia_id') as nuevo
      from pg_constraint
     where connamespace = 'public'::regnamespace
       and conrelid::regclass::text in ('membresias','membresia_cursos','asistencias',
                                        'cuotas','pagos','corrimientos_ciclo')
       and (conname like '%inscripcion_cursos%' or conname like '%inscripciones%'
            or conname like '%inscripcion_id%')
  loop
    execute format('alter table public.%I rename constraint %I to %I', r.tabla, r.conname, r.nuevo);
  end loop;

  -- Indices sueltos (los que no son de una restriccion)
  for r in
    select i.indexname,
           replace(replace(replace(replace(i.indexname,
             'inscripcion_cursos_insc', 'membresia_cursos_memb'),
             'inscripcion_cursos', 'membresia_cursos'),
             'inscripciones', 'membresias'),
             'inscripcion', 'membresia') as nuevo
      from pg_indexes i
     where i.schemaname = 'public'
       and i.tablename in ('membresias','membresia_cursos','asistencias','cuotas',
                           'pagos','corrimientos_ciclo')
       and i.indexname like '%inscripci%'
  loop
    execute format('alter index public.%I rename to %I', r.indexname, r.nuevo);
  end loop;

  -- Secuencias de las columnas identity (no figuran en
  -- information_schema.sequences: se buscan en pg_class)
  for r in
    select c.relname,
           replace(replace(c.relname, 'inscripcion_cursos', 'membresia_cursos'),
                   'inscripciones', 'membresias') as nuevo
      from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
       and c.relname like '%inscripci%'
  loop
    execute format('alter sequence public.%I rename to %I', r.relname, r.nuevo);
  end loop;

  -- Politicas RLS
  for r in
    select tablename, policyname,
           replace(replace(policyname, 'inscripcion_cursos', 'membresia_cursos'),
                   'inscripciones', 'membresias') as nuevo
      from pg_policies
     where schemaname = 'public'
       and tablename in ('membresias','membresia_cursos')
       and policyname like '%inscripci%'
  loop
    execute format('alter policy %I on public.%I rename to %I', r.policyname, r.tablename, r.nuevo);
  end loop;
end $$;

comment on table public.membresias is
  'Una venta de plan a un alumno (glosario: Membresia). Cada renovacion es una '
  'fila nueva. Se llamo `inscripciones` hasta la 0047 (D1).';
comment on table public.membresia_cursos is
  'Los cursos que habilita una membresia, con sus dias. Se llamo '
  '`inscripcion_cursos` hasta la 0047 (D1).';

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0047
-- =====================================================================
