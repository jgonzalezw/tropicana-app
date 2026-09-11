-- =====================================================================
-- TROPICANA - 0027: un profesor puede devengar DOS cursos de la misma venta
-- ---------------------------------------------------------------------
-- `comisiones_devengadas` traia UNIQUE (membresia_id, tipo, profesor_id):
-- una comision por membresia y por profesor. Era cierto cuando la comision
-- se calculaba por membresia entera.
--
-- La regla de negocio 10 lo derogo: la comision es de un profesor POR CURSO.
-- Si un profesor dicta dos cursos del mismo plan y el alumno fue a los dos,
-- le corresponden DOS comisiones de esa venta, una por cada curso — y esa
-- restriccion las rechazaba con "duplicate key value".
--
-- El reemplazo correcto ya existe desde 0025:
--   comisiones_devengadas_membresia_curso_uniq  (membresia_id, curso_id)
-- que es la regla que si vale: una membresia no devenga dos veces por el
-- mismo curso. Esa es la que hace idempotente el calculo.
--
-- Se baja la vieja. No se pierde ninguna proteccion: lo que impedia de
-- verdad (devengar dos veces lo mismo) lo sigue impidiendo el indice de
-- 0025, con el curso incluido.
-- =====================================================================

alter table public.comisiones_devengadas
  drop constraint if exists comisiones_devengadas_membresia_id_tipo_profesor_id_key;

notify pgrst, 'reload schema';
