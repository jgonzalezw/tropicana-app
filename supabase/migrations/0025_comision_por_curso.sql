-- =====================================================================
-- TROPICANA - 0025: la comision se devenga POR CURSO, no por membresia
-- ---------------------------------------------------------------------
-- REGLA DE NEGOCIO 10: "La comision de un plan multi-curso se reparte a
-- prorrata. Cada profesor cobra sobre SU PARTE de lo efectivamente cobrado,
-- con peso = precio de su curso x clases que ese curso realmente dicto
-- (x personas, en las pruebas). Un curso que no dicto nada no cobra nada.
-- La prueba no es un caso especial: es el caso general con 1 clase por curso."
--
-- Hasta hoy `calcularPendientes` armaba UNA comision por membresia, usando
-- `inscripciones.curso_id` — el curso PRINCIPAL de la venta. Con un plan de
-- cinco cursos, un solo profesor se llevaba el 100% y los otros cuatro no
-- cobraban nada. No es un problema de las clases de prueba: la prorrata no
-- estaba implementada para NINGUN plan multi-curso.
--
-- Para repartir hace falta que lo devengado sepa de que curso es. Eso es
-- todo lo que agrega esta migracion.
--
-- Es aditiva: `curso_id` queda NULL en lo ya devengado, que se generó con el
-- modelo viejo y NO se reescribe (regla de negocio 12, snapshot: editar hoy
-- no reescribe lo ya devengado).
-- =====================================================================

alter table public.comisiones_devengadas
  add column if not exists curso_id bigint references public.cursos(id);

comment on column public.comisiones_devengadas.curso_id is
  'Curso al que corresponde esta parte de la comision. Una membresia de plan '
  'multi-curso devenga UNA fila por curso, a prorrata (regla de negocio 10). '
  'NULL en lo devengado antes de 0025, que se calculo por membresia entera.';

-- Una membresia no puede devengar dos veces por el mismo curso. Es lo que
-- hace idempotente el calculo: si se corre de nuevo, no duplica.
-- Se usa un indice unico (no una constraint) para poder tratar los NULL:
-- coalesce(curso_id, 0) hace que lo viejo (curso_id NULL) siga contando como
-- "esta membresia ya devengo", que es justo lo que se quiere.
create unique index if not exists comisiones_devengadas_membresia_curso_uniq
  on public.comisiones_devengadas (membresia_id, coalesce(curso_id, 0))
  where membresia_id is not null;

notify pgrst, 'reload schema';
