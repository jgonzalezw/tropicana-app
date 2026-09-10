-- =====================================================================
-- TROPICANA - 0022: reparar el fin de ciclo y rellenar corrimientos
-- ---------------------------------------------------------------------
-- Reparacion de datos que acompania a la 0021. Dos defectos arrastrados:
--
--   1. El corrimiento por suspension solo alcanzaba a las membresias que
--      existian en ese momento: una vendida con fecha retroactiva sobre una
--      clase ya suspendida nunca recibia el suyo.
--   2. Aun cuando el corrimiento corria, `inscripciones.fecha_fin` no se
--      actualizaba: el corrimiento movia `cuotas.vencimiento` (etapa 1).
--
-- Recalcula `fecha_fin` como la fecha de la clase N contando solo las clases
-- que ocurren de verdad (una sesion suspendida no consume ciclo), que es la
-- misma regla que `finDeCicloReal` en src/lib/membresias.ts. Escribirla dos
-- veces, en TS y en SQL, es a proposito: sirve de verificacion cruzada.
--
-- NO toca las membresias con comision devengada: la fecha define en que
-- periodo entro la comision (regla 5 de docs/REGLAS.md). Respalda el valor
-- anterior antes de escribir. Idempotente.
--
-- Para revertir:
--   update inscripciones i set fecha_fin = b.fecha_fin_anterior
--   from fin_ciclo_previo_0022 b where b.inscripcion_id = i.id;
-- =====================================================================

create table if not exists public.fin_ciclo_previo_0022 (
  inscripcion_id bigint primary key references public.inscripciones(id) on delete cascade,
  fecha_fin_anterior date,
  guardado_en timestamptz not null default now()
);
-- Respaldo, no dato de la aplicacion: RLS activo y sin policies.
alter table public.fin_ciclo_previo_0022 enable row level security;

-- 1. Respaldo de las que van a cambiar.
with base as (
  select i.id, i.fecha_inicio, i.clases_plan, i.fecha_fin from public.inscripciones i
   where i.estado <> 'baja' and i.clases_plan is not null and i.fecha_inicio is not null),
clases as (
  select b.id as inscripcion_id, d::date as fecha,
         row_number() over (partition by b.id order by d, ic.curso_id) as k
    from base b join public.inscripcion_cursos ic on ic.inscripcion_id = b.id
    join lateral generate_series(b.fecha_inicio, b.fecha_inicio + 400, interval '1 day') d on true
   where extract(isodow from d)::int = any(ic.dias)
     and not exists (select 1 from public.sesiones s where s.curso_id = ic.curso_id
                       and s.fecha = d::date and s.estado = 'suspendida'))
insert into public.fin_ciclo_previo_0022 (inscripcion_id, fecha_fin_anterior)
select b.id, b.fecha_fin
  from base b join clases c on c.inscripcion_id = b.id and c.k = b.clases_plan
 where b.fecha_fin is distinct from c.fecha
on conflict (inscripcion_id) do nothing;

-- 2. El fin de ciclo, a la fecha de la clase N real.
with base as (
  select i.id, i.fecha_inicio, i.clases_plan, i.fecha_fin from public.inscripciones i
   where i.estado <> 'baja' and i.clases_plan is not null and i.fecha_inicio is not null),
clases as (
  select b.id as inscripcion_id, d::date as fecha,
         row_number() over (partition by b.id order by d, ic.curso_id) as k
    from base b join public.inscripcion_cursos ic on ic.inscripcion_id = b.id
    join lateral generate_series(b.fecha_inicio, b.fecha_inicio + 400, interval '1 day') d on true
   where extract(isodow from d)::int = any(ic.dias)
     and not exists (select 1 from public.sesiones s where s.curso_id = ic.curso_id
                       and s.fecha = d::date and s.estado = 'suspendida')),
correcto as (
  select b.id, c.fecha as fin_correcto
    from base b join clases c on c.inscripcion_id = b.id and c.k = b.clases_plan
   where b.fecha_fin is distinct from c.fecha)
update public.inscripciones i
   set fecha_fin = co.fin_correcto, actualizado_en = now()
  from correcto co
 where i.id = co.id
   and not exists (select 1 from public.comisiones_devengadas cd where cd.membresia_id = i.id);

-- 3. Los corrimientos que nunca se registraron (venta retroactiva).
with faltantes as (
  select i.id as inscripcion_id, i.alumno_id, i.fecha_fin, i.fecha_inicio, i.clases_plan,
         s.id as sesion_id, s.fecha as fecha_clase, s.motivo
    from public.inscripciones i
    join public.inscripcion_cursos ic on ic.inscripcion_id = i.id
    join public.sesiones s on s.curso_id = ic.curso_id and s.estado = 'suspendida'
         and s.fecha >= i.fecha_inicio and (i.fecha_fin is null or s.fecha <= i.fecha_fin)
   where i.estado <> 'baja' and i.clases_plan is not null
     and not exists (select 1 from public.corrimientos_ciclo cc
                      where cc.inscripcion_id = i.id and cc.sesion_id = s.id)),
sin_esa as (
  select f.inscripcion_id, f.sesion_id, d::date as fecha,
         row_number() over (partition by f.inscripcion_id, f.sesion_id order by d, ic.curso_id) as k
    from faltantes f join public.inscripcion_cursos ic on ic.inscripcion_id = f.inscripcion_id
    join lateral generate_series(f.fecha_inicio, f.fecha_inicio + 400, interval '1 day') d on true
   where extract(isodow from d)::int = any(ic.dias)
     and not exists (select 1 from public.sesiones s2 where s2.curso_id = ic.curso_id
                       and s2.fecha = d::date and s2.estado = 'suspendida' and s2.id <> f.sesion_id))
insert into public.corrimientos_ciclo
  (inscripcion_id, alumno_id, sesion_id, tipo, fecha_clase, fin_ciclo_anterior, fin_ciclo_nuevo, motivo)
select f.inscripcion_id, f.alumno_id, f.sesion_id, 'suspension', f.fecha_clase,
       se.fecha, f.fecha_fin, f.motivo
  from faltantes f join sin_esa se on se.inscripcion_id = f.inscripcion_id
       and se.sesion_id = f.sesion_id and se.k = f.clases_plan
on conflict (inscripcion_id, sesion_id) do nothing;

-- 4. Las trazas viejas, con el antes/despues en las columnas nuevas.
with objetivo as (
  select cc.id, cc.inscripcion_id, cc.sesion_id, i.fecha_inicio, i.fecha_fin, i.clases_plan
    from public.corrimientos_ciclo cc join public.inscripciones i on i.id = cc.inscripcion_id
   where cc.tipo = 'suspension' and cc.fin_ciclo_nuevo is null
     and i.clases_plan is not null and i.fecha_inicio is not null),
sin_esa as (
  select o.id, d::date as fecha,
         row_number() over (partition by o.id order by d, ic.curso_id) as k
    from objetivo o join public.inscripcion_cursos ic on ic.inscripcion_id = o.inscripcion_id
    join lateral generate_series(o.fecha_inicio, o.fecha_inicio + 400, interval '1 day') d on true
   where extract(isodow from d)::int = any(ic.dias)
     and not exists (select 1 from public.sesiones s2 where s2.curso_id = ic.curso_id
                       and s2.fecha = d::date and s2.estado = 'suspendida' and s2.id <> o.sesion_id))
update public.corrimientos_ciclo cc
   set fin_ciclo_anterior = se.fecha, fin_ciclo_nuevo = o.fecha_fin
  from objetivo o join sin_esa se on se.id = o.id and se.k = o.clases_plan
 where cc.id = o.id;
