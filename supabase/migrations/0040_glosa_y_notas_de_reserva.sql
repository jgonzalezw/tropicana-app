-- =====================================================================
-- TROPICANA - 0040: glosa y notas en reservas_sala (C2, agenda de sala)
-- ---------------------------------------------------------------------
-- PARA QUE. La 0035 modelo reservas_sala con tipo/motivo pero sin los dos
-- campos que Javier definio para C1/C2 (DECISIONES.md Sec 1.b, 2026-09-12):
-- "el motivo se elige de una lista y el responsable o la aclaracion van
-- en un campo glosa abierto" + "una reserva lleva notas [...] pueden ser
-- usadas como instrucciones o recomendaciones para el asistente
-- coordinador de la sala". `sala_horario_excepciones` ya tiene su propia
-- `glosa` (0037); esta migracion agrega el mismo concepto a
-- `reservas_sala`, mas `notas`, que no existia en ningun lado.
--
--   glosa -- aclaracion o responsable del motivo elegido (bloqueo).
--            Texto corto, opcional.
--   notas -- instrucciones para quien opera la sala ese dia. Texto
--            libre, opcional, sin relacion con el motivo.
--
-- Los dos NULL por default: sin aclaracion ni instrucciones no se inventa
-- un texto vacio (regla de calidad 1, aplicada a estas dos columnas: NULL
-- es "no cargado", nunca "").
--
-- No hace falta tocar RLS: las politicas de reservas_sala (0035) cubren
-- columnas nuevas sin cambios.
--
-- Idempotente y ADITIVA. No toca ninguna fila existente.
-- =====================================================================

alter table public.reservas_sala
  add column if not exists glosa text;

alter table public.reservas_sala
  add column if not exists notas text;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0040
-- =====================================================================
