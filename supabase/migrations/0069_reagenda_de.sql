-- ---------------------------------------------------------------------
-- 0069 · Reagendar una reserva «Por reagendar» o suspendida (I-012, fase 2)
--
-- Reagendar y Suspendida siguen siendo estados finales (definiciones-v2 8.2):
-- lo que sigue es una reserva NUEVA que queda ligada a la original. Esa nueva
-- guarda `reagenda_de` = id de la original. Es distinta de `revierte_reserva_id`
-- (0055), que es «la misma franja, de nuevo» y solo desde una suspendida.
-- Una reserva se reagenda una sola vez (índice único parcial).
--
-- Aditiva e idempotente: no toca datos ni la restricción de no solapamiento.
--
-- Reversa (la columna nace vacía):
--   drop index if exists public.reservas_sala_reagenda_de_uq;
--   alter table public.reservas_sala drop column if exists reagenda_de;
-- ---------------------------------------------------------------------
alter table public.reservas_sala
  add column if not exists reagenda_de bigint references public.reservas_sala(id) on delete set null;

create unique index if not exists reservas_sala_reagenda_de_uq
  on public.reservas_sala(reagenda_de)
  where reagenda_de is not null;

notify pgrst, 'reload schema';
