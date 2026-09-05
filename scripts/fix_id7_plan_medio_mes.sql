-- =====================================================================
-- FIX puntual de datos (PRODUCCION) - inscripcion id=7 -> Plan Medio Mes
-- ---------------------------------------------------------------------
-- 0011 solo convirtio las inscripciones 'mensual'. La inscripcion id=7 es
-- 'medio_mes' (alumno activo) y quedo sin plan. Aca se le crea un
-- "Plan Medio Mes - <curso>" y se le asigna.
--
-- Es un fix ESPECIFICO de datos de produccion (referencia id=7), NO una
-- migracion de esquema: por eso vive en scripts/ y NO en supabase/migrations/.
-- Guarda de seguridad: solo actua si id=7 existe Y es 'medio_mes'.
--
-- Regla del N (medio mes): cantidad_clases = clases_total del paquete si esta
-- cargado; si no, (dias elegidos por semana) * 4. Precio = tarifa 'medio_mes'
-- del curso si existe; si no, el precio_aplicado de la inscripcion.
--
-- Idempotente: no duplica el plan ni re-pisa una inscripcion ya asignada.
-- Solo ASCII en los comentarios.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Crear el "Plan Medio Mes - <curso>" a partir de los datos de id=7.
-- ---------------------------------------------------------------------
insert into public.planes
  (nombre, tipo_servicio, curso_id, cantidad_clases, precio,
   criterio_liquidacion, tolerancia_faltas, renovable, activo)
select
  'Plan Medio Mes - ' || c.nombre,
  'curso_regular',
  c.id,
  coalesce(i.clases_total, nullif(array_length(i.dias_elegidos, 1), 0) * 4),
  coalesce(
    (select t.precio from public.curso_tarifas t
      where t.curso_id = c.id and t.modalidad = 'medio_mes'),
    i.precio_aplicado
  ),
  1,
  null,
  true,
  true
from public.inscripciones i
join public.cursos c on c.id = i.curso_id
where i.id = 7
  and i.modalidad = 'medio_mes'
  and not exists (
    select 1 from public.planes p
    where p.curso_id = c.id
      and p.nombre = 'Plan Medio Mes - ' || c.nombre
  );

-- ---------------------------------------------------------------------
-- 2. Asignar la inscripcion id=7 a ese plan (solo si sigue sin plan).
-- ---------------------------------------------------------------------
update public.inscripciones i
set plan_id     = p.id,
    clases_plan = coalesce(i.clases_plan, p.cantidad_clases)
from public.planes p, public.cursos c
where i.id = 7
  and i.modalidad = 'medio_mes'
  and c.id = i.curso_id
  and p.curso_id = c.id
  and p.nombre = 'Plan Medio Mes - ' || c.nombre
  and i.plan_id is null;

-- =====================================================================
-- FIN fix id=7
-- =====================================================================
