-- =====================================================================
-- TROPICANA - 0061: la venta de alquiler de sala (C3, hito H7, tanda 2)
-- ---------------------------------------------------------------------
-- QUE HACE
-- --------
-- 1. `membresias` pasa a poder ser de un alquiler:
--      - `alumno_id` deja de ser obligatorio. El titular de un alquiler es un
--        CONTACTO (regla 21) y NO adquiere el rol alumno: queda fuera del
--        padron. Un check garantiza que solo un alquiler (que lleva su
--        categoria aplicada) puede quedar sin alumno.
--      - la categoria del cliente (regla 24): `categoria_propuesta` (lo que
--        deduce el sistema), `categoria_aplicada` (la que se uso para precio),
--        `categoria_motivo` (por que se propuso) y `categoria_glosa`
--        (obligatoria si la persona la cambio a mano, lo que solo es posible
--        con el parametro `alquiler_categoria_modo` en 'editable').
--      - la foto del paquete (regla 12): tramo de personas, cuantas eran y la
--        ruta de la tabla que dio el precio.
-- 2. Se elimina `alquileres_sala` (0035): era un camino de venta SIN plan,
--    justo lo que la regla 22 prohibe, y nunca tuvo un solo insert (0 filas en
--    las dos bases, verificado antes de borrar). La reserva de un alquiler
--    cuelga ahora de su membresia, igual que la de una particular
--    (`reservas_sala.alquiler_id` se va y el check de "cuelga de UNA sola
--    cosa" se reescribe).
--
-- Idempotente: correrla dos veces no cambia nada la segunda vez.
-- =====================================================================

-- 1. Membresias de alquiler ------------------------------------------------

alter table public.membresias
  add column if not exists categoria_propuesta text,
  add column if not exists categoria_aplicada  text,
  add column if not exists categoria_motivo    text,
  add column if not exists categoria_glosa     text,
  add column if not exists alquiler_personas   integer,
  add column if not exists alquiler_tamano     text,
  add column if not exists alquiler_ruta       text;

alter table public.membresias alter column alumno_id drop not null;

alter table public.membresias drop constraint if exists membresias_alumno_o_alquiler;
alter table public.membresias add constraint membresias_alumno_o_alquiler
  check (alumno_id is not null or categoria_aplicada is not null);

alter table public.membresias drop constraint if exists membresias_categoria_valida;
alter table public.membresias add constraint membresias_categoria_valida
  check (
    (categoria_aplicada  is null or categoria_aplicada  in ('alumno', 'profesor_tropicana', 'profesor_externo', 'tercero'))
    and
    (categoria_propuesta is null or categoria_propuesta in ('alumno', 'profesor_tropicana', 'profesor_externo', 'tercero'))
  );

-- Cambiar la categoria a mano exige glosa (regla 24, modo 'editable').
alter table public.membresias drop constraint if exists membresias_categoria_glosa;
alter table public.membresias add constraint membresias_categoria_glosa
  check (
    categoria_aplicada is null
    or categoria_propuesta is null
    or categoria_aplicada = categoria_propuesta
    or nullif(btrim(categoria_glosa), '') is not null
  );

alter table public.membresias drop constraint if exists membresias_alquiler_personas_check;
alter table public.membresias add constraint membresias_alquiler_personas_check
  check (alquiler_personas is null or alquiler_personas >= 1);

-- 2. Fuera `alquileres_sala` ----------------------------------------------

do $$
begin
  if to_regclass('public.alquileres_sala') is not null then
    if (select count(*) from public.alquileres_sala) > 0 then
      raise exception 'alquileres_sala tiene filas: no se borra. Revisar antes de seguir.';
    end if;
  end if;
end $$;

alter table public.reservas_sala drop constraint if exists reservas_sala_check;
drop index if exists public.reservas_sala_alquiler_idx;
alter table public.reservas_sala drop constraint if exists reservas_sala_alquiler_id_fkey;
alter table public.reservas_sala drop column if exists alquiler_id;

alter table public.reservas_sala add constraint reservas_sala_check
  check (
    (tipo in ('particular', 'alquiler') and membresia_id is not null and plan_id is null and motivo is null)
    or (tipo = 'taller'   and plan_id is not null and membresia_id is null and motivo is null)
    or (tipo = 'bloqueo'  and membresia_id is null and plan_id is null and motivo is not null)
  );

drop table if exists public.alquileres_sala;

notify pgrst, 'reload schema';
