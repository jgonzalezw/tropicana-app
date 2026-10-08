-- I-003 -- Corrección de producción: el bono que dos alumnos no recibieron
-- (Javier, 2026-10-08). Se corre DESPUÉS de la migración 0064 y con OK explícito.
--
-- Manuel Aguilar y Jorge Vilca renovaron Bachata Conexión el 2026-10-01 con un plan
-- NUEVO (CR - TU RITMO 8) que incluye el mismo curso, y el bono de su membresía
-- anterior no se aplicó porque el motor viejo solo lo daba al renovar el MISMO plan.
--   * Manuel:  bono de la membresía 4 -> nueva membresía 59 (inicio 2026-10-01).
--              Tenía 2 faltas con licencia y el plan admite 1: el bono es 1.
--   * Jorge:   bono de la membresía 16 -> nueva membresía 56. Se inscribió el
--              2026-10-06 pero asistió el 2026-10-01 sin membresía: la 56 pasa a
--              empezar el 2026-10-01 y esa clase (sesión 123) se registra en ella.
--              El bono de Jorge vence el 2026-10-01: sin esta fecha ya no se aplica.
--
--   * Lucas:   bono de la membresía 20 (Salsa y Bachata Inicial) -> nueva membresía 63
--              (plan CR - TU RITMO 4, inicio 2026-10-07). El bono vence el 2026-10-07,
--              el mismo día en que empieza la 63: llega a tiempo.
--
-- Qué hace por cada caso (todo o nada: es un solo bloque):
--   1. verifica (alumno, estado, bono pendiente del curso, vigencia, sesión);
--   2. guarda el antes en `bono_correccion_i003_previo` (para el rollback);
--   3. marca el bono como aplicado (`aplicado='clases'`, destino) y el legado
--      `bono_redimido` de la membresía de origen;
--   4. si corresponde, registra la asistencia presente de la sesión;
--   5. recalcula la membresía destino: clases (N + bono), inicio, fin de ciclo
--      (el plan base en todos sus cursos y el bono solo en los días de su curso,
--      saltando suspendidas) y clases hechas.
-- No toca cuotas (el plazo de pago no es el fin de ciclo) ni comisiones.
-- Idempotente: si el bono ya se aplicó, avisa y sigue. Rollback:
-- `scripts/rollback_corregir_bonos_i003.sql`.

create table if not exists public.bono_correccion_i003_previo (
  id               bigint generated always as identity primary key,
  creado_en        timestamptz not null default now(),
  origen           bigint not null,
  destino          bigint not null,
  destino_antes    jsonb  not null,
  bono_id          bigint not null,
  asistencia_creada bigint
);

do $$
declare
  c record; o record; d record; b record; s record;
  inicio date; n_base int; fin0 date; fin_b date; fin date; hechas int; asis_id bigint;
begin
  for c in
    select * from (values
      (4::bigint,  59::bigint, null::date,        null::bigint),   -- Manuel Aguilar
      (16::bigint, 56::bigint, date '2026-10-01', 123::bigint),    -- Jorge Vilca
      (20::bigint, 63::bigint, null::date,        null::bigint)    -- Lucas Campero
    ) as v(origen, destino, inicio, sesion)
  loop
    select * into o from public.membresias where id = c.origen;
    select * into d from public.membresias where id = c.destino;
    if o.id is null or d.id is null then
      raise exception 'Falta la membresía % o la %', c.origen, c.destino;
    end if;
    if o.alumno_id <> d.alumno_id then
      raise exception 'Las membresías % y % no son del mismo alumno', c.origen, c.destino;
    end if;
    if o.estado <> 'completada' then
      raise exception 'La membresía de origen % no está completada (%)', c.origen, o.estado;
    end if;

    -- Bono pendiente de un curso que la nueva membresía incluye.
    select bo.* into b
      from public.membresia_bonos bo
     where bo.membresia_id = o.id and bo.aplicado is null
       and bo.curso_id in (select curso_id from public.membresia_cursos where membresia_id = d.id)
     order by bo.id limit 1;
    if b.id is null then
      if exists (select 1 from public.membresia_bonos where membresia_id = o.id and redimido_en_membresia_id = d.id) then
        raise notice 'Caso %->%: el bono ya estaba aplicado, no se hace nada', c.origen, c.destino;
        continue;
      end if;
      raise exception 'La membresía % no tiene bono pendiente de un curso de la %', c.origen, c.destino;
    end if;

    inicio := coalesce(c.inicio, d.fecha_inicio);
    if b.vence is not null and inicio > b.vence then
      raise exception 'El bono de la membresía % venció el % y el inicio es %', c.origen, b.vence, inicio;
    end if;
    if c.inicio is not null and c.inicio > d.fecha_inicio then
      raise exception 'El inicio nuevo % es posterior al actual %', c.inicio, d.fecha_inicio;
    end if;

    asis_id := null;
    if c.sesion is not null then
      select * into s from public.sesiones where id = c.sesion;
      if s.id is null or s.curso_id <> b.curso_id or s.estado <> 'dictada'
         or s.fecha < inicio or s.fecha >= d.fecha_inicio then
        raise exception 'La sesión % no es una clase dictada del curso % entre % y %', c.sesion, b.curso_id, inicio, d.fecha_inicio;
      end if;
      if exists (select 1 from public.asistencias where sesion_id = s.id and alumno_id = d.alumno_id) then
        raise exception 'El alumno % ya tiene asistencia en la sesión %', d.alumno_id, s.id;
      end if;
    end if;

    -- 1. Respaldo.
    insert into public.bono_correccion_i003_previo (origen, destino, destino_antes, bono_id)
    values (o.id, d.id, to_jsonb(d), b.id);

    -- 2. El bono queda aplicado a la nueva membresía; el legado también.
    update public.membresia_bonos set aplicado = 'clases', redimido_en_membresia_id = d.id where id = b.id;
    update public.membresias set bono_redimido = true where id = o.id;

    -- 3. Asistencia de la clase que se dio sin membresía.
    if c.sesion is not null then
      insert into public.asistencias (sesion_id, alumno_id, membresia_id, estado, con_licencia)
      values (s.id, d.alumno_id, d.id, 'presente', false)
      returning id into asis_id;
      update public.bono_correccion_i003_previo set asistencia_creada = asis_id
       where id = (select max(id) from public.bono_correccion_i003_previo where destino = d.id);
    end if;

    -- 4. Recalculo de la membresía destino.
    n_base := d.clases_plan;
    -- Fin del plan base: se camina en todos los cursos (un día con dos clases cuenta dos).
    select q2.dd into fin0
      from (
        select q.dd, sum(q.cnt) over (order by q.dd) as cum
          from (
            select x::date as dd, count(*) as cnt
              from generate_series(inicio, inicio + 400, interval '1 day') x
              join public.membresia_cursos mc on mc.membresia_id = d.id
               and extract(isodow from x)::int = any(mc.dias)
             where not exists (select 1 from public.sesiones z
                                where z.curso_id = mc.curso_id and z.fecha = x::date and z.estado = 'suspendida')
             group by 1
          ) q
      ) q2
     where q2.cum >= n_base
     order by q2.dd limit 1;
    -- El bono extiende solo las clases de su curso, después del plan base.
    select y.dd into fin_b
      from (
        select x::date as dd
          from generate_series(fin0 + 1, fin0 + 200, interval '1 day') x
          join public.membresia_cursos mc on mc.membresia_id = d.id and mc.curso_id = b.curso_id
           and extract(isodow from x)::int = any(mc.dias)
         where not exists (select 1 from public.sesiones z
                            where z.curso_id = mc.curso_id and z.fecha = x::date and z.estado = 'suspendida')
         order by 1
      ) y
     order by y.dd offset (b.clases - 1) limit 1;
    fin := greatest(fin0, coalesce(fin_b, fin0));

    select count(*) into hechas
      from public.asistencias a join public.sesiones z on z.id = a.sesion_id and z.estado = 'dictada'
     where a.membresia_id = d.id and a.estado = 'presente';

    update public.membresias
       set clases_plan = n_base + b.clases,
           fecha_inicio = inicio,
           fecha_fin = fin,
           clases_hechas = hechas,
           actualizado_en = now()
     where id = d.id;

    raise notice 'Caso %->%: +% clase(s) de bono del curso %, inicio %, fin % (antes %), clases %',
      c.origen, c.destino, b.clases, b.curso_id, inicio, fin, d.fecha_fin, n_base + b.clases;
  end loop;
end $$;
