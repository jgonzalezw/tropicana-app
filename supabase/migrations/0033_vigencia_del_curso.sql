-- =====================================================================
-- TROPICANA - 0033: el curso tiene fecha de activacion y de baja
-- ---------------------------------------------------------------------
-- DECISION de Javier (2026-09-12): "No lo veo como backlog. Es asi como
-- se debe trabajar." Un curso corre entre dos fechas. El registro de
-- asistencia es exigible SOLO entre ellas: fuera de ellas nunca se pide
-- y nada queda "sin registrar".
--
-- EL PROBLEMA QUE CIERRA. Desde que las clases se cuentan por CALENDARIO
-- menos suspendidas (regla de negocio 10), el calendario de un curso no
-- tiene principio: `dias_semana` dice "martes y jueves" y el conteo los
-- genera hacia atras hasta donde llegue el ciclo, aunque el curso no
-- existiera. Esas clases inventadas pesan en el prorrateo (regla 10) y
-- traban liquidaciones por "sin registrar" (regla 17).
--
-- (El ejemplo que figuraba en DECISIONES.md -"Salsa y Bachata Inicial
-- arranca el 31/08 y el conteo le da 8 clases de agosto"- estaba MAL:
-- el 31/08 es su fecha de CREACION en el sistema; su primera sesion y su
-- primera asignacion son del 03/08. Ese curso si corria en agosto. El
-- agujero es real igual, pero no se demuestra con ese caso.)
--
-- POR QUE DOS CAMPOS Y NO ALCANZA CON `activo`. `activo` es un
-- interruptor sin fecha: dice si el curso se puede vender HOY, y no
-- sirve para preguntar "¿este curso corria el 12 de agosto?", que es lo
-- que el conteo necesita. Son cosas distintas y conviven: `activo`
-- gobierna la venta, la vigencia gobierna el calendario.
--
-- EL BACKFILL ES DELIBERADAMENTE CONSERVADOR. `vigente_desde` se llena
-- con la EVIDENCIA MAS VIEJA de que el curso corria: la primera sesion,
-- la primera asignacion de profesor, la primera membresia que lo toca.
-- El motivo es la regla de negocio 5: una membresia ya devengada no
-- cambia sus fechas ni sus numeros en silencio. Si el backfill pusiera
-- una fecha mas tardia, el conteo de clases de una membresia vieja
-- cambiaria sola y moveria plata ya repartida. Con este criterio
-- **ningun conteo existente cambia**: la migracion no limpia el ruido de
-- agosto, solo crea el campo donde Javier lo corrige.
--
-- `vigente_hasta` NO se backfillea, ni siquiera en los cursos ya
-- inactivos: inventarle una fecha de baja seria justamente el cambio
-- silencioso que la regla 5 prohibe. De ahora en mas, dar de baja un
-- curso desde la pantalla le estampa la fecha de hoy (hacia adelante, no
-- hacia atras).
-- =====================================================================

alter table public.cursos
  add column if not exists vigente_desde date,
  add column if not exists vigente_hasta date;

comment on column public.cursos.vigente_desde is
  'Desde cuando corre el curso. El calendario no genera clases antes de '
  'esta fecha: el conteo del prorrateo (regla 10) y el bloqueo por '
  'sesiones sin registrar (regla 17) la respetan.';
comment on column public.cursos.vigente_hasta is
  'Fecha de baja. NULL = sigue corriendo. Despues de esta fecha no se '
  'genera ninguna clase ni se exige ningun registro.';

-- Evidencia mas vieja de que el curso corria. LEAST ignora los NULL, asi
-- que un curso sin historial cae a su fecha de creacion.
update public.cursos c
   set vigente_desde = least(
         (select min(s.fecha)        from public.sesiones s      where s.curso_id = c.id),
         (select min(a.desde)        from public.asignaciones a  where a.curso_id = c.id),
         (select min(i.fecha_inicio) from public.inscripciones i where i.curso_id = c.id),
         (select min(i.fecha_inicio) from public.inscripcion_cursos ic
                                     join public.inscripciones i on i.id = ic.inscripcion_id
                                    where ic.curso_id = c.id),
         (select min(ic.fecha)       from public.inscripcion_cursos ic where ic.curso_id = c.id),
         c.creado_en::date
       )
 where c.vigente_desde is null;

-- Ya no puede faltar: todo curso corre desde algun dia.
alter table public.cursos
  alter column vigente_desde set default current_date;

update public.cursos set vigente_desde = creado_en::date where vigente_desde is null;

alter table public.cursos
  alter column vigente_desde set not null;

-- Una baja no puede ser anterior a la activacion.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cursos_vigencia_coherente') then
    alter table public.cursos
      add constraint cursos_vigencia_coherente
      check (vigente_hasta is null or vigente_hasta >= vigente_desde);
  end if;
end $$;

notify pgrst, 'reload schema';
