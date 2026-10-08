-- I-010 -- Corrección de producción: el bono de Raquel López (Javier, 2026-10-08).
-- Se corre con OK explícito.
--
-- Raquel (alumno 30) y Lucas Campero (alumno 29) fueron juntos a Salsa y Bachata
-- Inicial y faltaron con licencia a las mismas clases, pero la asistencia de Raquel
-- se tipeó mal (membresía 21):
--   * sesión 63 (2026-09-14): figura ausente sin licencia; Lucas estuvo presente.
--   * sesión 71 (2026-09-16): figura ausente sin licencia; Lucas faltó CON licencia.
-- Con una falta sin licencia el curso no genera bono (regla 6). Este script copia el
-- patrón de Lucas a Raquel y le otorga el bono que le falta en la membresía nueva 62
-- (CR - TU RITMO 4, inicio 2026-10-07), como en I-003 para Lucas (63).
--
-- Todo o nada (un solo bloque), idempotente:
--   1. verifica alumno, membresías, estado, patrón de Lucas, vigencia del bono;
--   2. guarda el antes en `resp_i010_previo` (para el rollback);
--   3. corrige las asistencias 121 y 143;
--   4. crea el bono (curso 1, aplicado='clases', destino 62) y recuenta la 21;
--   5. recalcula la 62: clases (N + bono) y fin de ciclo (plan base en todos los
--      cursos y el bono solo en los días de su curso, saltando suspendidas).
-- No toca cuotas ni comisiones. Rollback: `scripts/rollback_corregir_bono_i010.sql`.

create table if not exists public.resp_i010_previo (
  id        bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  tipo      text   not null check (tipo in ('asistencia', 'membresia', 'bono')),
  fila_id   bigint not null,
  antes     jsonb
);

do $$
declare
  o public.membresias; d public.membresias; l public.membresias;
  a121 public.asistencias; a143 public.asistencias;
  l63 public.asistencias; l71 public.asistencias;
  curso constant bigint := 1;
  bono_id bigint; clases_bono int; vence date; inicio date;
  n_base int; fin0 date; fin_b date; fin date; hechas int;
begin
  select * into o from public.membresias where id = 21;
  select * into d from public.membresias where id = 62;
  select * into l from public.membresias where id = 63;
  if o.id is null or d.id is null or l.id is null then
    raise exception 'Faltan las membresías 21, 62 o 63';
  end if;
  if o.alumno_id <> 30 or d.alumno_id <> 30 then
    raise exception 'Las membresías 21 y 62 no son de Raquel (alumno 30)';
  end if;
  if o.estado <> 'completada' then
    raise exception 'La membresía 21 no está completada (%)', o.estado;
  end if;
  if not exists (select 1 from public.membresia_cursos where membresia_id = d.id and curso_id = curso) then
    raise exception 'La membresía 62 no incluye el curso %', curso;
  end if;

  -- Idempotente: si el bono ya está, no hay nada que hacer.
  if exists (select 1 from public.membresia_bonos
              where membresia_id = o.id and curso_id = curso and redimido_en_membresia_id = d.id) then
    raise notice 'I-010: el bono de la membresía 21 ya estaba aplicado a la 62, no se hace nada';
    return;
  end if;
  if exists (select 1 from public.membresia_bonos where membresia_id = o.id and curso_id = curso) then
    raise exception 'La membresía 21 ya tiene un bono del curso % en otro estado', curso;
  end if;

  -- Patrón de Lucas (alumno 29) en las dos sesiones.
  select * into l63 from public.asistencias where sesion_id = 63 and alumno_id = 29;
  select * into l71 from public.asistencias where sesion_id = 71 and alumno_id = 29;
  if l63.id is null or l63.estado <> 'presente' then
    raise exception 'Lucas no figura presente en la sesión 63';
  end if;
  if l71.id is null or l71.estado <> 'ausente' or not l71.con_licencia then
    raise exception 'Lucas no figura ausente con licencia en la sesión 71';
  end if;

  select * into a121 from public.asistencias where id = 121;
  select * into a143 from public.asistencias where id = 143;
  if a121.id is null or a121.sesion_id <> 63 or a121.alumno_id <> 30 or a121.membresia_id <> 21
     or a121.estado <> 'ausente' or a121.con_licencia then
    raise exception 'La asistencia 121 no es la esperada (sesión 63, Raquel, ausente sin licencia)';
  end if;
  if a143.id is null or a143.sesion_id <> 71 or a143.alumno_id <> 30 or a143.membresia_id <> 21
     or a143.estado <> 'ausente' or a143.con_licencia then
    raise exception 'La asistencia 143 no es la esperada (sesión 71, Raquel, ausente sin licencia)';
  end if;

  -- Bono = el de Lucas (mismo plan, misma tolerancia).
  select b.clases, b.vence into clases_bono, vence from public.membresia_bonos b
   where b.membresia_id = 20 and b.curso_id = curso and b.redimido_en_membresia_id = 63 and b.aplicado = 'clases';
  if clases_bono is null then
    raise exception 'No se encontró el bono de Lucas (membresía 20 -> 63) para copiar el criterio';
  end if;
  inicio := d.fecha_inicio;
  if vence is not null and inicio > vence then
    raise exception 'El bono vence el % y la membresía 62 empieza el %', vence, inicio;
  end if;

  -- 1. Respaldo.
  insert into public.resp_i010_previo (tipo, fila_id, antes) values
    ('asistencia', a121.id, to_jsonb(a121)),
    ('asistencia', a143.id, to_jsonb(a143)),
    ('membresia',  o.id,    to_jsonb(o)),
    ('membresia',  d.id,    to_jsonb(d));

  -- 2. Asistencia como la de Lucas.
  update public.asistencias set estado = 'presente', con_licencia = false where id = a121.id;
  update public.asistencias set con_licencia = true where id = a143.id;

  -- 3. Bono aplicado a la 62; la 21 se recuenta.
  insert into public.membresia_bonos (membresia_id, curso_id, clases, vence, aplicado, redimido_en_membresia_id)
  values (o.id, curso, clases_bono, vence, 'clases', d.id)
  returning id into bono_id;
  insert into public.resp_i010_previo (tipo, fila_id) values ('bono', bono_id);

  select count(*) into hechas
    from public.asistencias a join public.sesiones z on z.id = a.sesion_id and z.estado = 'dictada'
   where a.membresia_id = o.id and a.estado = 'presente';
  update public.membresias
     set clases_hechas = hechas, bono_generado = clases_bono, bono_redimido = true, actualizado_en = now()
   where id = o.id;

  -- 4. Recalculo de la membresía destino (mismo cálculo que corregir_bonos_i003.sql).
  n_base := d.clases_plan;
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
  select y.dd into fin_b
    from (
      select x::date as dd
        from generate_series(fin0 + 1, fin0 + 200, interval '1 day') x
        join public.membresia_cursos mc on mc.membresia_id = d.id and mc.curso_id = curso
         and extract(isodow from x)::int = any(mc.dias)
       where not exists (select 1 from public.sesiones z
                          where z.curso_id = mc.curso_id and z.fecha = x::date and z.estado = 'suspendida')
       order by 1
    ) y
   order by y.dd offset (clases_bono - 1) limit 1;
  fin := greatest(fin0, coalesce(fin_b, fin0));

  -- Debe dar lo mismo que la de Lucas (mismo plan, mismo curso, mismo inicio).
  if l.clases_plan <> n_base + clases_bono or l.fecha_fin <> fin then
    raise exception 'La 62 daría % clases y fin %, y la 63 de Lucas tiene % y %',
      n_base + clases_bono, fin, l.clases_plan, l.fecha_fin;
  end if;

  select count(*) into hechas
    from public.asistencias a join public.sesiones z on z.id = a.sesion_id and z.estado = 'dictada'
   where a.membresia_id = d.id and a.estado = 'presente';
  update public.membresias
     set clases_plan = n_base + clases_bono, fecha_fin = fin, clases_hechas = hechas, actualizado_en = now()
   where id = d.id;

  raise notice 'I-010: bono de % clase(s) del curso % -> membresía 62: clases %, fin % (antes %), hechas %',
    clases_bono, curso, n_base + clases_bono, fin, d.fecha_fin, hechas;
end $$;
