-- =====================================================================
-- TROPICANA - 0011: migracion de datos - inscripciones actuales -> membresias
-- ---------------------------------------------------------------------
-- Convierte los datos que ya existen al modelo del motor (0010), SIN borrar
-- nada. Dos pasos:
--   1. Crea un "Plan Regular - <curso>" por cada curso (un plan por curso).
--   2. Backfill: las inscripciones 'mensual' pasan a ser membresias de ese
--      plan (plan_id, clases_plan, ciclo_numero).
--
-- Reglas de conversion (confirmadas con Javier 2026-09-05):
--   - N (cantidad_clases) = (dias por semana del curso) * 4  -> ciclo mensual
--     estandar. Ej: curso de 3 dias = 12; de 2 dias = 8; de 1 dia = 4.
--     Queda AJUSTABLE por plan despues. Si el curso no tiene dias_semana,
--     cantidad_clases queda NULL (hay que fijarlo a mano; se nota).
--   - precio del plan = cursos.precio_mensual.
--   - tolerancia_faltas = NULL  -> usa el parametro del sistema 'faltas_toleradas'.
--   - criterio_liquidacion = 1 (el activo del Paso 1).
--   - Solo se convierten inscripciones modalidad = 'mensual' (las de
--     clase/semana/medio_mes NO son Plan Regular; se veran en pasos posteriores).
--
-- fecha_fin de la membresia: NO se calcula aca (depende del calendario de
-- sesiones); lo setea/mantiene la logica de asistencia en 1B.
--
-- Ejecutar en Supabase -> SQL Editor -> New query. Idempotente y ADITIVO.
-- Solo ASCII en los comentarios.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Un Plan Regular por curso (idempotente: no duplica si ya existe uno).
-- ---------------------------------------------------------------------
insert into public.planes
  (nombre, tipo_servicio, curso_id, cantidad_clases, precio,
   criterio_liquidacion, tolerancia_faltas, renovable, activo)
select
  'Plan Regular - ' || c.nombre,
  'curso_regular',
  c.id,
  nullif(array_length(c.dias_semana, 1), 0) * 4,   -- N = dias/semana * 4 (NULL si sin dias)
  c.precio_mensual,
  1,
  null,                                            -- usa parametro del sistema (faltas_toleradas)
  true,
  c.activo
from public.cursos c
where not exists (
  select 1 from public.planes p
  where p.curso_id = c.id
    and p.tipo_servicio = 'curso_regular'
);

-- ---------------------------------------------------------------------
-- 2. Backfill de membresias: inscripciones 'mensual' sin plan -> su plan.
--    Solo toca filas con plan_id NULL (idempotente). ciclo_numero ya
--    tiene default 1; clases_plan hereda el N del plan.
-- ---------------------------------------------------------------------
update public.inscripciones i
set plan_id     = p.id,
    clases_plan = coalesce(i.clases_plan, p.cantidad_clases)
from public.planes p
where p.curso_id = i.curso_id
  and p.tipo_servicio = 'curso_regular'
  and i.modalidad = 'mensual'
  and i.plan_id is null;

-- =====================================================================
-- FIN 0011
-- =====================================================================
