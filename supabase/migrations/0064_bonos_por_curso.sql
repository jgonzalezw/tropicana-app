-- 0064 -- Bono de tolerancia por curso (I-003, D35; Javier, 2026-10-08).
--
-- Hasta hoy el bono era un entero de la membresía (`bono_generado` /
-- `bono_redimido`). Ahora es de un CURSO: cada curso se evalúa aparte (una
-- falta sin licencia en A anula solo el bono de A), con el tope de tolerancia
-- por curso, vence en la renovación bonificada de su curso y se aplica en
-- cualquier plan que incluya ese curso.
--
--   * `membresia_bonos`: un bono pendiente o consumido por (membresía, curso).
--       - `aplicado` null            = pendiente.
--       - `aplicado` = 'clases'      = sumó clases a `redimido_en_membresia_id`.
--       - `aplicado` = 'ilimitado'   = se consumió sin efecto en un ilimitado.
--       - `aplicado` = 'historico'   = estaba redimido antes de esta migración
--                                      y no se sabe dónde.
--   * `membresias.bono_generado` queda como RESUMEN (suma de sus bonos).
--     `bono_redimido` deja de leerse (queda en la tabla como legado).
--   * Respaldo: `bono_previo_0064` guarda el antes de cada membresía tocada.
--
-- Backfill con la asistencia real, por el curso de cada sesión. `vence` = la
-- siguiente clase de ese curso después del fin de ciclo guardado, saltando las
-- suspendidas. Idempotente: no pisa lo que ya existe.

create table if not exists public.bono_previo_0064 as
select id as membresia_id, bono_generado, bono_redimido
from public.membresias
where bono_generado is not null and bono_generado > 0
   or coalesce(bono_redimido, false);

create table if not exists public.membresia_bonos (
  id                       bigint generated always as identity primary key,
  membresia_id             bigint not null references public.membresias(id) on delete cascade,
  curso_id                 bigint not null references public.cursos(id) on delete restrict,
  clases                   int    not null check (clases > 0),
  vence                    date,
  aplicado                 text   check (aplicado in ('clases', 'ilimitado', 'historico')),
  redimido_en_membresia_id bigint references public.membresias(id) on delete set null,
  creado_en                timestamptz not null default now(),
  unique (membresia_id, curso_id)
);
create index if not exists membresia_bonos_memb_idx on public.membresia_bonos(membresia_id);
create index if not exists membresia_bonos_destino_idx on public.membresia_bonos(redimido_en_membresia_id);

comment on table public.membresia_bonos is
  'Bono de tolerancia por curso (D35). Pendiente si `aplicado` es null. `vence` = renovación bonificada de su curso.';

alter table public.membresia_bonos enable row level security;
drop policy if exists membresia_bonos_select on public.membresia_bonos;
create policy membresia_bonos_select on public.membresia_bonos
  for select to authenticated using (true);
drop policy if exists membresia_bonos_admin_write on public.membresia_bonos;
create policy membresia_bonos_admin_write on public.membresia_bonos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Backfill: faltas dictadas por membresía y curso. Una prueba no genera bono.
with faltas as (
  select a.membresia_id, s.curso_id,
         count(*) filter (where a.con_licencia)     as con_lic,
         count(*) filter (where not a.con_licencia) as sin_lic
  from public.asistencias a
  join public.sesiones s on s.id = a.sesion_id and s.estado = 'dictada'
  where a.estado = 'ausente'
  group by a.membresia_id, s.curso_id
),
calc as (
  select f.membresia_id, f.curso_id,
         case when f.sin_lic > 0 then 0
              else least(f.con_lic, greatest(0, coalesce(
                     m.tolerancia_faltas, p.tolerancia_faltas,
                     (select nullif(valor, '')::int from public.parametros where clave = 'faltas_toleradas'), 0))) end as clases,
         m.fecha_fin, m.bono_redimido
  from faltas f
  join public.membresias m on m.id = f.membresia_id
  join public.planes p on p.id = m.plan_id
  where m.plan_id is not null and m.clases_plan is not null
    and coalesce(m.es_prueba, false) = false
)
insert into public.membresia_bonos (membresia_id, curso_id, clases, vence, aplicado)
select c.membresia_id, c.curso_id, c.clases,
       (select d::date
          from generate_series(c.fecha_fin + 1, c.fecha_fin + 120, interval '1 day') d
          join public.membresia_cursos mc on mc.membresia_id = c.membresia_id and mc.curso_id = c.curso_id
         where extract(isodow from d)::int = any(mc.dias)
           and not exists (select 1 from public.sesiones x
                            where x.curso_id = c.curso_id and x.fecha = d::date and x.estado = 'suspendida')
         order by d limit 1),
       case when coalesce(c.bono_redimido, false) then 'historico' end
from calc c
where c.clases > 0
on conflict (membresia_id, curso_id) do nothing;

-- El resumen de cada membresía sale de sus bonos por curso.
update public.membresias m
   set bono_generado = coalesce((select sum(b.clases) from public.membresia_bonos b where b.membresia_id = m.id), 0)
 where m.plan_id is not null and m.clases_plan is not null and coalesce(m.es_prueba, false) = false
   and (m.bono_generado is distinct from coalesce((select sum(b.clases) from public.membresia_bonos b where b.membresia_id = m.id), 0));

notify pgrst, 'reload schema';
