-- =====================================================================
-- TROPICANA - 0020: los motivos de caja pasan a nombrar la OPERACION
-- ---------------------------------------------------------------------
-- POR QUE (Javier, 2026-09-10)
-- ----------------------------
-- El catalogo de motivos de cobro mezclaba dos cosas distintas: el tipo de
-- operacion que origina la deuda (una membresia, un alquiler) y el momento
-- en que se cobra (inscripcion, mensualidad). Para la caja el momento no
-- hace diferencia; lo que importa es de que operacion viene la plata:
--
--   Membresia, Clase particular, Clase de prueba, Alquiler, Taller,
--   Venta de producto, y aparte Ajuste y Otro, que no vienen de ninguna
--   operacion y solo mueven la caja.
--
-- QUE HACE
-- --------
-- 1. Reemplaza los valores del catalogo `motivo_cobro` por ese conjunto.
-- 2. Agrega `ajuste` tambien a `motivo_pago` (un ajuste puede ir para los
--    dos lados).
-- 3. Remapea los `pagos.motivo` ya asentados al nuevo esquema, para que las
--    listas y los recibos viejos no queden hablando otro idioma. No toca
--    ningun monto.
--
-- Idempotente: correrla dos veces no cambia nada la segunda vez.
-- =====================================================================

-- 1. Motivos de cobro: el conjunto nuevo.
insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden, activo)
select c.id, v.valor, v.etiqueta, v.orden, true
from public.catalogos c
cross join (values
  ('membresia',        'Membresía',          1),
  ('clase_particular', 'Clase particular',   2),
  ('clase_prueba',     'Clase de prueba',    3),
  ('alquiler',         'Alquiler de sala',   4),
  ('taller',           'Taller',             5),
  ('venta_producto',   'Venta de producto',  6),
  ('ajuste',           'Ajuste de caja',     8),
  ('otro',             'Otro',               9)
) as v(valor, etiqueta, orden)
where c.clave = 'motivo_cobro'
on conflict (catalogo_id, valor) do update
  set etiqueta = excluded.etiqueta, orden = excluded.orden, activo = true;

-- Los que ya no aplican salen del selector.
delete from public.catalogo_valores cv
using public.catalogos c
where cv.catalogo_id = c.id
  and c.clave = 'motivo_cobro'
  and cv.valor in ('inscripcion', 'mensualidad', 'venta_paquete', 'alquiler_de_sala', 'cuota');

-- 2. Un ajuste tambien puede ser de salida.
insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden, activo)
select c.id, 'ajuste', 'Ajuste de caja', 8, true
from public.catalogos c
where c.clave = 'motivo_pago'
on conflict (catalogo_id, valor) do update
  set etiqueta = excluded.etiqueta, orden = excluded.orden, activo = true;

-- 3. Antes de renombrar nada, se guarda el motivo anterior de cada pago: es
--    un dato de plata ya asentada y el remapeo de abajo no es reversible por
--    si solo (inscripcion y cuota caen las dos en membresia).
create table if not exists public.pagos_motivo_previo_0020 (
  pago_id bigint primary key references public.pagos(id) on delete cascade,
  motivo_anterior text,
  guardado_en timestamptz not null default now()
);

insert into public.pagos_motivo_previo_0020 (pago_id, motivo_anterior)
select id, motivo from public.pagos
where motivo in ('inscripcion', 'mensualidad', 'cuota', 'venta_paquete',
                 'alquiler_de_sala', 'particular')
on conflict (pago_id) do nothing;

-- Para revertir:
--   update public.pagos p set motivo = b.motivo_anterior
--   from public.pagos_motivo_previo_0020 b where b.pago_id = p.id;

-- 4. Lo ya asentado, al idioma nuevo. Todo lo que era un momento del cobro
--    de una membresia (inscripcion, mensualidad, cuota, paquete) es hoy,
--    simplemente, una membresia.
update public.pagos
set motivo = 'membresia'
where motivo in ('inscripcion', 'mensualidad', 'cuota', 'venta_paquete');

update public.pagos
set motivo = 'alquiler'
where motivo = 'alquiler_de_sala';

update public.pagos
set motivo = 'clase_particular'
where motivo in ('particular', 'clase_particular');
