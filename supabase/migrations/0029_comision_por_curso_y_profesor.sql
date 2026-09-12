-- =====================================================================
-- TROPICANA - 0029: la comision es de (membresia, curso, PROFESOR)
-- ---------------------------------------------------------------------
-- REGLA (regla de negocio 10, precisada por Javier el 2026-09-12): la
-- comision es de quien DICTO la clase, no de quien figura hoy al frente
-- del curso. Si a mitad de ciclo se cambia el titular en la pantalla de
-- asignaciones, las clases de antes son del anterior y las de despues del
-- nuevo: ese curso deja DOS lineas en la liquidacion, una por profesor,
-- cada una con sus clases y su %.
--
-- El indice unico que habia —(membresia_id, curso_id)— hacia imposible
-- justamente eso: la segunda comision del mismo curso chocaba. Es el
-- mismo tipo de tope que ya se corrigio en 0027, cuando un profesor paso
-- a poder devengar dos cursos de la misma membresia; ahora es al reves,
-- un curso repartido entre dos profesores.
--
-- La llave pasa a ser (membresia_id, curso_id, profesor_id). Sigue
-- impidiendo lo que tiene que impedir: devengar dos veces lo mismo.
--
-- Aditiva y sin perdida: no borra ni reescribe ninguna comision ya
-- devengada (regla de negocio 12). Lo ya liquidado con el criterio viejo
-- queda como esta; el control 20 lo mide.
-- =====================================================================

drop index if exists public.comisiones_devengadas_membresia_curso_uniq;

create unique index if not exists comisiones_devengadas_membresia_curso_profesor_uniq
  on public.comisiones_devengadas (membresia_id, coalesce(curso_id, 0::bigint), profesor_id)
  where membresia_id is not null;

comment on index public.comisiones_devengadas_membresia_curso_profesor_uniq is
  'Una comision por membresia, curso y profesor. El profesor entra en la '
  'llave porque un curso puede repartirse entre dos titulares cuando la '
  'asignacion cambia a mitad de ciclo (regla de negocio 10).';

notify pgrst, 'reload schema';
