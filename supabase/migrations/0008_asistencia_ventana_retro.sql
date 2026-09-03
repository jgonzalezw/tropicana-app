-- =====================================================================
-- TROPICANA — 0008: parámetro de ventana retroactiva de asistencia
-- ---------------------------------------------------------------------
-- Cuántas semanas hacia atrás se permite cargar asistencia (además de hoy).
-- Nunca a futuro. El pasado, solo con permiso asistencia.editar.
--
-- Ejecutar en Supabase → SQL Editor → New query. Idempotente y ADITIVO.
-- =====================================================================

insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('asistencia_semanas_retro', '2', 'numero', 'Semanas para cargar asistencia atrasada',
   'Cuántas semanas hacia atrás se puede registrar asistencia (además de hoy). Nunca se permite a futuro.', 'Asistencia')
on conflict (clave) do nothing;

-- =====================================================================
-- FIN 0008
-- =====================================================================
