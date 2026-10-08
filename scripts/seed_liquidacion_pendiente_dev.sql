-- SOLO DEV: dos membresías completadas que terminan en septiembre, para probar
-- el detalle del paso previo a generar la liquidación (L-01 §5).
update membresias set fecha_fin = '2026-09-30' where id in (20, 21);
