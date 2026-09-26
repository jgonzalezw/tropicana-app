-- =====================================================================
-- TROPICANA - 0055: cierres de sala sobre reservas (C3, hito H4)
-- ---------------------------------------------------------------------
-- PARA QUE. Cuarto hito de C3: cierra el lado reservas de C5 (ROADMAP R1)
-- y el revertido al borrar una excepcion (ROADMAP R22). Hoy un cierre de
-- sala (Administracion -> Sala) solo mira clases de cursos; una reserva de
-- particular/alquiler confirmada que cae dentro de un cierre no se toca, y
-- un bloqueo que choca con una reserva se rechaza en vez de ofrecer
-- suspenderla. Borrar una excepcion tampoco revierte nada.
--
-- Decisiones de Javier (2026-09-26):
--   1. Revertir una reserva suspendida crea una reserva NUEVA (Confirmada)
--      en la misma franja, ligada a la suspendida -- Suspendida sigue
--      siendo un estado final (definiciones-v2 8.2, sin tocar).
--   2. Cancelar un bloqueo que suspendio reservas ofrece el mismo revertido
--      que borrar una excepcion.
--   3. El horario reducido (una apertura especial con menos horas que deja
--      una reserva o una clase afuera) entra en el mismo alcance que un
--      cierre completo.
--
-- Ademas corrige un hallazgo de la 0054 (anotado en DECISIONES.md): el
-- trigger de historial de reservas es AFTER, asi que su limpieza de las
-- columnas "cambio_*" no hace nada -- quedan pegadas en la fila para
-- siempre. El UPDATE pasa a BEFORE (ahi la fila ya existe, la limpieza
-- puede modificar NEW de verdad); el INSERT se queda en AFTER a proposito
-- -- en un BEFORE INSERT `new.id` ya tiene valor, pero la fila todavia no
-- esta en la tabla, y el insert en reservas_historial (que tiene FK a
-- reservas_sala) fallaria por esa fila que todavia no existe. Se separan en
-- dos triggers -- reservas_sala_historial_ins_trg (AFTER INSERT) y
-- reservas_sala_historial_upd_trg (BEFORE UPDATE) -- que llaman a la misma
-- funcion. Medido en dev (26/09): el primer intento (un solo trigger BEFORE
-- INSERT OR UPDATE) rompio crearReserva/revertirSuspension con
-- "violates foreign key constraint reservas_historial_reserva_id_fkey".
--
-- Idempotente y ADITIVO: ningun dato se borra ni se reescribe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Vinculo de "quien causo esta suspension" -- para poder revertir SOLO
--    lo que causo la excepcion o el bloqueo que se borra/cancela, nunca
--    una suspension de otro origen que coincida en fecha por casualidad.
-- ---------------------------------------------------------------------
alter table public.sesiones
  add column if not exists excepcion_id bigint references public.sala_horario_excepciones(id) on delete set null;
create index if not exists sesiones_excepcion_idx on public.sesiones(excepcion_id) where excepcion_id is not null;

alter table public.reservas_sala
  add column if not exists suspendida_por_excepcion_id bigint references public.sala_horario_excepciones(id) on delete set null;
alter table public.reservas_sala
  add column if not exists suspendida_por_bloqueo_id bigint references public.reservas_sala(id) on delete set null;
-- La reserva NUEVA que revierte a una suspendida apunta a la que reemplaza
-- (decision 1: revertir crea una reserva nueva, nunca reabre la vieja).
alter table public.reservas_sala
  add column if not exists revierte_reserva_id bigint references public.reservas_sala(id) on delete set null;

create index if not exists reservas_sala_susp_excepcion_idx on public.reservas_sala(suspendida_por_excepcion_id) where suspendida_por_excepcion_id is not null;
create index if not exists reservas_sala_susp_bloqueo_idx on public.reservas_sala(suspendida_por_bloqueo_id) where suspendida_por_bloqueo_id is not null;
create index if not exists reservas_sala_revierte_idx on public.reservas_sala(revierte_reserva_id) where revierte_reserva_id is not null;

-- ---------------------------------------------------------------------
-- 2. CATALOGO 'motivo_suspension_reserva': dos motivos nuevos para cuando
--    Tropicana suspende por un cierre de sala o por un bloqueo, no por una
--    decision puntual sobre esa reserva (calidad 6 y 7: nace en migracion).
-- ---------------------------------------------------------------------
insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden)
select c.id, v.valor, v.etiqueta, v.orden
from public.catalogos c
cross join (values
  ('cierre_sala',  'Cierre de sala',  4),
  ('bloqueo_sala', 'Bloqueo de sala', 5)
) as v(valor, etiqueta, orden)
where c.clave = 'motivo_suspension_reserva'
on conflict (catalogo_id, valor) do nothing;

-- ---------------------------------------------------------------------
-- 3. Trigger de historial: se separa en dos (hallazgo de la 0054 + lo
--    medido arriba). La funcion no cambia, solo cuando corre cada evento.
-- ---------------------------------------------------------------------
drop trigger if exists reservas_sala_historial_trg on public.reservas_sala;

create trigger reservas_sala_historial_ins_trg
  after insert on public.reservas_sala
  for each row execute function public.reservas_sala_historial();

create trigger reservas_sala_historial_upd_trg
  before update on public.reservas_sala
  for each row execute function public.reservas_sala_historial();

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0055
-- =====================================================================
