-- =====================================================================
-- TROPICANA - 0019: fecha efectiva de un pago, distinta de su registro
-- ---------------------------------------------------------------------
-- Aditivo e idempotente. No cambia datos existentes: para todo lo ya
-- cargado, fecha_efectiva queda null, que significa "coincide con fecha".
--
-- POR QUE (Javier, 2026-09-10)
-- ----------------------------
-- Un movimiento de caja puede cargarse hoy pero haber ocurrido antes (el
-- cobro de ayer que recién se asienta). A efectos de arqueo tiene que
-- contar como transacción de HOY (fecha = momento real de carga, ya lo
-- hace `pagos.fecha` con su default `now()`); pero para comunicarse con
-- el interesado y cuadrar el dinero correctamente hace falta poder
-- decir tambien cuándo ocurrió de verdad.
--
-- QUE HACE
-- --------
-- Agrega `pagos.fecha_efectiva date null`. Null = ocurrió el mismo día
-- que se registró (el caso normal, no hace falta cargar nada aparte).
-- El saldo de caja y el orden de "últimos movimientos" siguen leyendo
-- `fecha` (el registro real, para que el arqueo cuadre); la pantalla
-- muestra `fecha_efectiva` cuando está cargada.
-- =====================================================================

alter table public.pagos
  add column if not exists fecha_efectiva date;

comment on column public.pagos.fecha_efectiva is
  'Cuando ocurrio realmente el movimiento, si es distinto del dia en que se registro (pagos.fecha). Null = coincide con el registro. No se usa para el arqueo: eso sigue siendo pagos.fecha.';
