-- SOLO DEV (hyhijzuomqpylcmrzdvw). Deja dos membresías multicurso (Salsa + Bachata)
-- listas para liquidar en el período de septiembre, para probar el prorrateo
-- (carril L-01). Un refresh de dev las pisa: se vuelve a correr si hace falta.
-- 35: completada, con sus clases registradas  -> entra con reparto entre cursos.
-- 36: completada; si le faltan clases por registrar, queda esperando (regla 17).
update membresias set estado = 'completada', fecha_fin = '2026-09-28' where id in (35, 36);
