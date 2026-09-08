-- =====================================================================
-- TROPICANA - 0015: bono de tolerancia redimido (renovacion)
-- ---------------------------------------------------------------------
-- Aditivo e idempotente. No cambia datos existentes.
--
-- Agrega:
--   inscripciones.bono_redimido - marca de que el bono de tolerancia del
--       ciclo (inscripciones.bono_generado, faltas con licencia) ya fue
--       aplicado a una membresia nueva al reinscribir/renovar. Evita
--       redimir dos veces el mismo bono. Default false.
--
-- Solo ASCII en los comentarios.
-- =====================================================================

alter table public.inscripciones
  add column if not exists bono_redimido boolean not null default false;
