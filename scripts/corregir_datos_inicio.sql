-- =============================================================================
-- Tropicana — depuración de los datos de inicio (septiembre 2026)
--
-- Corrige, ANTES de la primera liquidación de producción:
--   1. asignaciones.desde de tres cursos que empezaron a dar clase antes de la
--      fecha con que se cargó su titular (las clases anteriores quedaban sin
--      titular, y por la regla 10 "una clase sin nadie asignado no se paga").
--   2. Tres membresías de Zumba del 08/09 (Bs 30, las tres asistieron) que
--      eran en realidad clases de prueba del plan regular de Zumba y quedaron
--      cargadas sin plan, sin criterio de liquidación y sin marca de prueba.
--
-- Decisiones de Javier (2026-10-01):
--   * Asignaciones: Bachata Conexión -> 11/08, Heels -> 29/08, Ladies -> 29/08
--     (la primera sesión real de cada curso).
--   * Membresías: son clase de prueba del "Plan Regular - Zumba" del 08/09.
--     Se completan como una prueba cargada por la venta (es_prueba, 1 clase,
--     fecha de fin, curso con su fecha); cobro, estado y asistencia no se tocan.
--
-- Se identifica todo por clave natural (curso/plan por nombre, membresía por
-- alumno + fecha + curso), no por id: los ids de producción pueden no
-- coincidir con los de dev.
--
-- APLICADO el 2026-10-01 en dev y en producción (con el OK de Javier). Deja de
-- servir tal cual: sus guardas buscan lo que ya está corregido y abortan.
--
-- USO: el script es una sola transacción. Termina en ROLLBACK (ensayo en
-- seco) mientras la última línea diga `rollback`; para aplicar de verdad se
-- cambia por `commit`. Deja el respaldo en *_previo_datos_inicio y un reporte
-- antes/después. Si algo no cuadra, aborta con un error y no cambia nada.
-- =============================================================================

begin;

-- Respaldo (falla si el script ya corrió: no se pisa un respaldo anterior).
create table public.asignaciones_previo_datos_inicio as
  select * from public.asignaciones;
create table public.membresias_previo_datos_inicio as
  select * from public.membresias;

-- ---------------------------------------------------------------------------
-- 1. Asignaciones: desde = primera sesión real del curso
-- ---------------------------------------------------------------------------
create temp table _fix_asig on commit drop as
select a.id,
       c.nombre as curso,
       a.desde as desde_antes,
       (select min(s.fecha) from public.sesiones s where s.curso_id = a.curso_id) as desde_nuevo
from public.asignaciones a
join public.cursos c on c.id = a.curso_id
where a.hasta is null
  and c.nombre in ('Bachata Conexión', 'Heels', 'Ladies');

do $$
declare n int; malos int;
begin
  select count(*), count(*) filter (where desde_nuevo is null or desde_nuevo >= desde_antes)
    into n, malos from _fix_asig;
  if n <> 3 then
    raise exception 'Se esperaban 3 asignaciones vigentes (Bachata Conexión, Heels, Ladies) y hay %', n;
  end if;
  if malos > 0 then
    raise exception 'Hay asignaciones sin una primera sesión anterior a su desde actual: nada que adelantar';
  end if;
end $$;

update public.asignaciones a
   set desde = f.desde_nuevo
  from _fix_asig f
 where a.id = f.id;

-- ---------------------------------------------------------------------------
-- 2. Membresías de Zumba del 08/09 sin plan
-- ---------------------------------------------------------------------------
create table public.membresia_cursos_previo_datos_inicio as
  select * from public.membresia_cursos;

create temp table _fix_mem on commit drop as
select m.id, m.alumno_id, m.curso_id, m.fecha_inicio, m.precio_aplicado, m.clases_total, m.estado
from public.membresias m
join public.cursos c on c.id = m.curso_id
where c.nombre = 'Zumba'
  and m.plan_id is null
  and m.fecha_inicio = date '2026-09-08'
  and m.modalidad = 'clase';

-- Los días que dicta el curso, tomados de una clase de prueba ya cargada del
-- mismo plan y curso (así no se escriben a mano).
create temp table _dias_zumba on commit drop as
select mc.dias
from public.membresia_cursos mc
join public.membresias m on m.id = mc.membresia_id
join public.planes pl on pl.id = m.plan_id
join public.cursos c on c.id = mc.curso_id
where m.es_prueba and pl.nombre = 'Plan Regular - Zumba' and c.nombre = 'Zumba'
limit 1;

do $$
declare n int; p int; d int;
begin
  select count(*) into n from _fix_mem;
  if n <> 3 then
    raise exception 'Se esperaban 3 membresías de Zumba sin plan del 08/09 y hay %', n;
  end if;
  select count(*) into p from public.planes where nombre = 'Plan Regular - Zumba';
  if p <> 1 then
    raise exception 'Se esperaba 1 plan "Plan Regular - Zumba" y hay %', p;
  end if;
  select count(*) into d from _dias_zumba where dias is not null;
  if d <> 1 then
    raise exception 'No hay una clase de prueba de Zumba cargada de donde tomar los días';
  end if;
end $$;

-- Clase de prueba del plan regular de Zumba, como las que carga la venta:
-- 1 clase (clases_plan), sin tolerancia, fecha de fin = su única clase.
-- Cobro, estado y asistencia ya estaban bien y no se tocan.
update public.membresias m
   set plan_id = pl.id,
       criterio_liquidacion = pl.criterio_liquidacion,
       es_prueba = true,
       clases_plan = 1,
       clases_total = null,
       tolerancia_faltas = 0,
       fecha_fin = m.fecha_inicio
  from public.planes pl
 where pl.nombre = 'Plan Regular - Zumba'
   and m.id in (select id from _fix_mem);

insert into public.membresia_cursos (membresia_id, curso_id, dias, fecha)
select f.id, f.curso_id, (select dias from _dias_zumba), f.fecha_inicio
from _fix_mem f;

-- ---------------------------------------------------------------------------
-- Reporte antes / después
-- ---------------------------------------------------------------------------
select 'asignacion' as tipo, f.id, f.curso as detalle,
       f.desde_antes::text as antes, a.desde::text as despues
from _fix_asig f join public.asignaciones a on a.id = f.id
union all
select 'membresia', m.id,
       'alumno ' || m.alumno_id || ' · Bs ' || m.precio_aplicado || ' · ' || m.estado,
       'plan=' || coalesce(p.plan_id::text, 'null') || ' criterio=' || coalesce(p.criterio_liquidacion::text, 'null')
         || ' prueba=' || p.es_prueba || ' clases_plan=' || coalesce(p.clases_plan::text, 'null')
         || ' fin=' || coalesce(p.fecha_fin::text, 'null'),
       'plan=' || coalesce(m.plan_id::text, 'null') || ' criterio=' || coalesce(m.criterio_liquidacion::text, 'null')
         || ' prueba=' || m.es_prueba || ' clases_plan=' || coalesce(m.clases_plan::text, 'null')
         || ' fin=' || coalesce(m.fecha_fin::text, 'null')
from public.membresias m
join public.membresias_previo_datos_inicio p on p.id = m.id
where m.id in (select id from _fix_mem)
order by 1, 2;

-- Nada más cambió: filas distintas respecto del respaldo (debe dar 3, 3 y 3).
select
  (select count(*) from public.asignaciones a
     join public.asignaciones_previo_datos_inicio p using (id)
    where a.* is distinct from p.*) as asignaciones_cambiadas,
  (select count(*) from public.membresias m
     join public.membresias_previo_datos_inicio p using (id)
    where m.* is distinct from p.*) as membresias_cambiadas,
  (select count(*) from public.membresia_cursos mc
    where not exists (select 1 from public.membresia_cursos_previo_datos_inicio p where p.id = mc.id)
  ) as membresia_cursos_nuevos;

rollback;  -- ensayo en seco. Para aplicar de verdad: cambiar por `commit;`
