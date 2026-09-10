-- =====================================================================
-- TROPICANA - 0016: reparar las membresias migradas (fecha_fin y
--                   contadores) + impedir ciclos con fechas incoherentes
-- ---------------------------------------------------------------------
-- Idempotente: se puede correr varias veces, la segunda no cambia nada.
-- Solo ASCII en los comentarios.
--
-- POR QUE
-- -------
-- La migracion 0011 convirtio las inscripciones 'mensual' en membresias de
-- Plan Regular, pero a proposito NO calculo `fecha_fin` ("depende del
-- calendario del curso"), y nada la completo despues: `recalcularMembresia`
-- (asistencia) actualiza contadores y estado, pero nunca fecha_fin. Lo mismo
-- con `clases_hechas`, que solo se recalcula cuando se guarda asistencia
-- DESPUES del motor: las clases tomadas antes quedaron sin contar.
--
-- Efecto medido en produccion el 2026-09-10 (13 membresias de plan):
--   * 13 de 13 con fecha_fin NULL  -> NINGUNA puede liquidarse jamas:
--     calcularPendientes exige `fecha_fin is not null` y `fecha_fin <= fin
--     del mes vencido`.
--   * 13 de 13 con clases_hechas = 0 pese a tener asistencias 'presente'
--     registradas -> el contador "X de N" siempre muestra 0.
--
-- QUE HACE
-- --------
-- 1. Completa `fecha_fin` donde falta (o quedo incoherente, anterior a
--    `fecha_inicio`), con la MISMA regla que usa la venta en /inscribir:
--    la fecha de la clase N por calendario, contando desde `fecha_inicio`
--    sobre los dias elegidos de la membresia (inscripcion_cursos.dias, y si
--    no hay, los dias del curso). Para planes ilimitados: inicio + ciclo_dias.
--    Las membresias que YA tienen una fecha_fin coherente no se tocan (puede
--    venir corrida por suspensiones).
-- 2. Recalcula `clases_hechas` y `bono_generado` desde las asistencias de
--    sesiones DICTADAS, y `estado` (completada cuando ya ocurrieron N
--    sesiones), con el mismo criterio que `recalcularMembresia`. Incluye la
--    politica de bono vigente: una sola falta SIN licencia en el ciclo deja
--    el bono en 0.
-- 3. Agrega la restriccion que impide que vuelva a entrar un ciclo que
--    termina antes de empezar (fecha_fin < fecha_inicio), venga de donde
--    venga: migracion, script de prueba o codigo.
-- =====================================================================

-- ── 1a. fecha_fin de membresias con N clases ─────────────────────────
with dias_insc as (
  select i.id as insc_id,
         coalesce(
           (select array_agg(distinct d)
              from public.inscripcion_cursos ic, unnest(ic.dias) as d
             where ic.inscripcion_id = i.id and ic.dias is not null),
           c.dias_semana
         ) as dias
    from public.inscripciones i
    left join public.cursos c on c.id = i.curso_id
),
objetivo as (
  select i.id, i.fecha_inicio, i.clases_plan, di.dias
    from public.inscripciones i
    join dias_insc di on di.insc_id = i.id
   where i.plan_id is not null
     and i.clases_plan is not null
     and i.clases_plan > 0
     and i.fecha_inicio is not null
     and di.dias is not null
     and array_length(di.dias, 1) > 0
     and (i.fecha_fin is null or i.fecha_fin < i.fecha_inicio)
),
calculo as (
  select o.id,
         (select g.d::date
            from generate_series(o.fecha_inicio::timestamp,
                                 (o.fecha_inicio + 400)::timestamp,
                                 interval '1 day') as g(d)
           where extract(isodow from g.d)::int = any(o.dias)
           offset o.clases_plan - 1
           limit 1) as fecha_fin_calc
    from objetivo o
)
update public.inscripciones i
   set fecha_fin = c.fecha_fin_calc
  from calculo c
 where i.id = c.id
   and c.fecha_fin_calc is not null;

-- ── 1b. fecha_fin de membresias ilimitadas (ciclo por dias) ──────────
update public.inscripciones i
   set fecha_fin = i.fecha_inicio + p.ciclo_dias
  from public.planes p
 where p.id = i.plan_id
   and i.clases_plan is null
   and p.clases_ilimitadas
   and p.ciclo_dias is not null
   and i.fecha_inicio is not null
   and (i.fecha_fin is null or i.fecha_fin < i.fecha_inicio);

-- ── 2. Contadores y estado desde las asistencias reales ──────────────
with marcas as (
  select a.inscripcion_id, a.estado, a.con_licencia
    from public.asistencias a
    join public.sesiones s on s.id = a.sesion_id
   where s.estado = 'dictada'
),
conteo as (
  select i.id,
         coalesce(sum(case when m.estado = 'presente' then 1 else 0 end), 0) as presentes,
         coalesce(sum(case when m.estado = 'ausente' and m.con_licencia then 1 else 0 end), 0) as con_lic,
         coalesce(sum(case when m.estado = 'ausente' and not m.con_licencia then 1 else 0 end), 0) as sin_lic,
         count(m.inscripcion_id) as dictadas,
         coalesce(
           i.tolerancia_faltas,
           p.tolerancia_faltas,
           (select nullif(valor, '')::int from public.parametros where clave = 'faltas_toleradas'),
           0
         ) as tolerancia,
         i.clases_plan
    from public.inscripciones i
    join public.planes p on p.id = i.plan_id
    left join marcas m on m.inscripcion_id = i.id
   where i.clases_plan is not null
     and i.estado <> 'baja'
   group by i.id, i.tolerancia_faltas, p.tolerancia_faltas, i.clases_plan
)
update public.inscripciones i
   set clases_hechas = c.presentes,
       bono_generado = case when c.sin_lic > 0 then 0
                            else least(c.con_lic, greatest(c.tolerancia, 0)) end,
       estado        = case when c.dictadas >= c.clases_plan then 'completada' else 'activa' end
  from conteo c
 where i.id = c.id
   and (i.clases_hechas is distinct from c.presentes
     or i.bono_generado is distinct from (case when c.sin_lic > 0 then 0
                                               else least(c.con_lic, greatest(c.tolerancia, 0)) end)
     or i.estado is distinct from (case when c.dictadas >= c.clases_plan then 'completada' else 'activa' end));

-- ── 3. Restriccion: un ciclo no puede terminar antes de empezar ──────
do $$
declare
  v_malas int;
begin
  select count(*) into v_malas
  from public.inscripciones
  where fecha_inicio is not null
    and fecha_fin is not null
    and fecha_fin < fecha_inicio;

  if v_malas > 0 then
    raise notice 'ATENCION: quedan % inscripcion(es) con fecha_fin anterior a fecha_inicio (sin dias de clase para recalcular). Revisalas:', v_malas;
    raise notice 'select id, alumno_id, curso_id, fecha_inicio, fecha_fin from public.inscripciones where fecha_fin < fecha_inicio;';
  end if;
end $$;

alter table public.inscripciones
  drop constraint if exists inscripciones_fechas_coherentes;

alter table public.inscripciones
  add constraint inscripciones_fechas_coherentes
  check (fecha_inicio is null or fecha_fin is null or fecha_fin >= fecha_inicio);

-- ── Control posterior sugerido (no lo corre la migracion) ────────────
-- select id, alumno_id, curso_id, fecha_inicio, fecha_fin, clases_plan,
--        clases_hechas, bono_generado, estado
--   from public.inscripciones
--  where plan_id is not null
--  order by id;
