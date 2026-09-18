-- =====================================================================
-- TROPICANA - 0046: el reemplazante cobra por clase, y se le paga en Caja
-- ---------------------------------------------------------------------
-- EL HUECO (D19 / R4). Al registrar una clase dictada por un suplente se
-- guarda `sesiones.reemplazo_costo` -- lo que se le paga por esa clase
-- (regla de negocio 20: el suplente NO cobra por liquidacion, cobra por
-- tarifa). Al titular se le descuenta ese monto en SU liquidacion, pero la
-- contrapartida no existia: lo que hay que pagarle al suplente no aparecia
-- en ninguna lista, y habia que acordarse de pagarlo a mano.
--
-- QUE HACE.
--   1. `pagos.sesion_id`: a que clase corresponde un pago al reemplazante.
--      Sin esto no hay forma de saber que clases ya se pagaron y cuales no
--      (un pago a cuenta se reparte entre las clases, de la mas vieja a la
--      mas nueva). Es un campo NUEVO hacia `sesiones`, no hacia
--      `inscripciones`: la regla de nombres de la membresia no aplica.
--   2. El motivo `pago_reemplazante` en el catalogo `motivo_pago` (regla de
--      negocio 13 y de calidad 7: el codigo lo lee, asi que nace en una
--      migracion, no cargado a mano).
--
-- No modifica ninguna fila existente. Idempotente.
-- =====================================================================

alter table public.pagos
  add column if not exists sesion_id bigint references public.sesiones(id) on delete set null;

comment on column public.pagos.sesion_id is
  'Clase que este pago salda, cuando es un pago al reemplazante '
  '(motivo pago_reemplazante). NULL en cualquier otro pago.';

create index if not exists pagos_sesion_idx on public.pagos (sesion_id) where sesion_id is not null;

insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden, activo)
select c.id, 'pago_reemplazante', 'Pago a reemplazante', 3, true
  from public.catalogos c
 where c.clave = 'motivo_pago'
   and not exists (select 1 from public.catalogo_valores cv
                    where cv.catalogo_id = c.id and cv.valor = 'pago_reemplazante');

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0046
-- =====================================================================
