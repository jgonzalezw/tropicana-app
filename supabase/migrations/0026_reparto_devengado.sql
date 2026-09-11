-- =====================================================================
-- TROPICANA - 0026: el reparto queda guardado con la comision
-- ---------------------------------------------------------------------
-- El comprobante tiene que poder explicar de donde sale el numero: cuanto
-- se cobro por la venta, cuanto peso cada curso y que parte le toco a este.
--
-- POR QUE SE GUARDA Y NO SE RECALCULA. El peso de un curso sale de su
-- tarifa de clase y de cuantas clases dicto. Las dos cosas cambian con el
-- tiempo: se corrige una tarifa, se suspende una clase vieja. Si el
-- comprobante recalculara, el mismo papel mostraria numeros distintos segun
-- cuando se imprime, y no coincidiria con la plata que se pago. Es la regla
-- de negocio 12 (snapshot): lo ya devengado no se reescribe — y para no
-- reescribirlo, hay que haberlo guardado.
--
-- Forma: [{"cursoId":1,"curso":"Salsa","clases":1,"precioClase":50,"peso":50}]
-- Incluye TODOS los cursos del plan, tambien los de otros profesores y los
-- que no dictaron: es lo que le permite al profesor verificar que los pesos
-- suman el total, y ver que un curso quedo en cero porque no dicto.
--
-- Aditiva: NULL en lo devengado antes de 0026 (que se calculo por membresia
-- entera, sin reparto).
-- =====================================================================

alter table public.comisiones_devengadas
  add column if not exists reparto jsonb;

comment on column public.comisiones_devengadas.reparto is
  'Foto del reparto a prorrata al momento de devengar: un elemento por curso '
  'del plan con {cursoId, curso, clases, precioClase, peso}. Se guarda para '
  'que el comprobante explique el numero sin recalcular (regla 12). NULL en '
  'lo devengado antes de 0026.';

notify pgrst, 'reload schema';
