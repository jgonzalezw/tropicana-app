-- =====================================================================
-- TROPICANA - 0053: vender un plan de particulares (C3, hito H2)
-- ---------------------------------------------------------------------
-- PARA QUE. Segundo hito del plan de C3: la plantilla de H1 (0052) se
-- puede vender. Decisiones de Javier (25/09) para este hito:
--   1. El pase de H1 se acumula con este: 0052 y 0053 van juntas.
--   2. La primera reserva es REAL: ocupa sala y profesor, validada, con
--      el estado 'reservada' que ya existe (H3 trae los 7 estados).
--   3. Agenda fija: el calendario completo se genera al vender.
--
-- HALLAZGO que obliga a tocar reservas_sala ya en H2 (no se podia dejar
-- para H3 como decia el plan original): reservas_sala_check exige
-- paquete_particular_id cuando tipo='particular', y H2 elimina
-- paquetes_particular. Sin membresia_id la primera reserva no tiene de
-- donde colgar. Medido antes de tocar nada: 0 filas en paquetes_particular,
-- alquileres_sala y comisiones_devengadas.paquete_particular_id/
-- reservas_sala.paquete_particular_id (las 7 reservas de dev son bloqueos).
--
-- Idempotente y ADITIVO, salvo el drop de paquetes_particular (medido en
-- 0 filas antes de escribir esta migracion, en dev y controlado de nuevo
-- contra produccion antes del pase).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MEMBRESIAS - titular como contacto (regla de negocio 21) y foto de
--    la venta particular. curso_id pasa a nullable: una membresia de
--    particulares no tiene curso, tiene horas.
-- ---------------------------------------------------------------------
alter table public.membresias
  add column if not exists contacto_id bigint references public.contactos(id) on delete restrict;

update public.membresias m
set contacto_id = a.contacto_id
from public.alumnos a
where a.id = m.alumno_id and m.contacto_id is null;

do $$
begin
  if exists (select 1 from public.membresias where contacto_id is null) then
    raise exception 'Quedaron membresias sin contacto_id despues del backfill: revisar alumnos huerfanos antes de continuar.';
  end if;
end $$;

alter table public.membresias alter column contacto_id set not null;
create index if not exists membresias_contacto_idx on public.membresias(contacto_id);

alter table public.membresias alter column curso_id drop not null;

alter table public.membresias
  add column if not exists horas_contratadas numeric(5,2) check (horas_contratadas is null or horas_contratadas > 0);
alter table public.membresias
  add column if not exists tarifa_particular_id bigint references public.tarifas_particular(id) on delete set null;
alter table public.membresias
  add column if not exists profesor_id bigint references public.profesores(id) on delete restrict;
-- Snapshot de la forma de pago al profesor (regla de negocio 12: editar el
-- plan o al profesor despues no reescribe lo ya vendido).
alter table public.membresias
  add column if not exists forma_pago_profesor text
    check (forma_pago_profesor is null or forma_pago_profesor in ('fee_hora', 'pct_margen', 'monto_fijo'));
alter table public.membresias
  add column if not exists pago_pct_margen numeric(5,2)
    check (pago_pct_margen is null or pago_pct_margen between 0 and 100);
alter table public.membresias
  add column if not exists pago_descuenta_sala boolean not null default false;
alter table public.membresias
  add column if not exists pago_monto_fijo numeric(10,2)
    check (pago_monto_fijo is null or pago_monto_fijo >= 0);
alter table public.membresias
  add column if not exists fee_hora_aplicado numeric(10,2)
    check (fee_hora_aplicado is null or fee_hora_aplicado >= 0);

create index if not exists membresias_profesor_idx on public.membresias(profesor_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'membresias_curso_o_horas') then
    alter table public.membresias add constraint membresias_curso_o_horas
      check (curso_id is not null or horas_contratadas is not null);
  end if;
end $$;

-- Acompanantes ya no es exclusivo de la prueba: un particular con
-- registra_acompanantes tambien los usa (definiciones-v2 7.4). Se
-- reconoce el caso particular por curso_id is null (lo exige el check de
-- arriba), sin necesidad de leer el plan.
alter table public.membresias drop constraint if exists membresias_acompanantes_valido;
alter table public.membresias add constraint membresias_acompanantes_valido
  check (acompanantes >= 0 and (acompanantes = 0 or es_prueba or curso_id is null));

-- ---------------------------------------------------------------------
-- 2. MEMBRESIA_ASISTENTES - asistentes con identidad (regla 21), solo
--    cuando el plan los registra (planes.registra_acompanantes). No
--    toman asistencia individual (7.4): la sesion se da por dictada para
--    el grupo entero.
-- ---------------------------------------------------------------------
create table if not exists public.membresia_asistentes (
  id           bigint generated always as identity primary key,
  membresia_id bigint not null references public.membresias(id) on delete cascade,
  contacto_id  bigint not null references public.contactos(id) on delete restrict,
  creado_en    timestamptz not null default now(),
  unique (membresia_id, contacto_id)
);
create index if not exists membresia_asistentes_membresia_idx on public.membresia_asistentes(membresia_id);

alter table public.membresia_asistentes enable row level security;
drop policy if exists membresia_asistentes_select on public.membresia_asistentes;
create policy membresia_asistentes_select on public.membresia_asistentes for select to authenticated using (true);
drop policy if exists membresia_asistentes_admin_write on public.membresia_asistentes;
create policy membresia_asistentes_admin_write on public.membresia_asistentes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------
-- 3. SALAS - sala externa generica (definiciones-v2 seccion 9): existe
--    UNA, sin validacion de ocupacion; al vender se le pone un nombre
--    descriptivo por membresia (membresia_salas, abajo).
-- ---------------------------------------------------------------------
alter table public.salas
  add column if not exists es_externa boolean not null default false;
alter table public.salas
  add column if not exists capacidad int check (capacidad is null or capacidad > 0);

insert into public.salas (nombre, activa, es_externa, orden)
select 'Sala externa (genérica)', true, true, 900
where not exists (select 1 from public.salas where es_externa);

create index if not exists salas_externa_idx on public.salas(es_externa);

-- ---------------------------------------------------------------------
-- 4. MEMBRESIA_SALAS - que salas usa una membresia particular, con el
--    nombre descriptivo cuando la sala es externa (obligatorio en ese
--    caso: por trigger, porque el check de columna no puede mirar otra
--    tabla).
-- ---------------------------------------------------------------------
create table if not exists public.membresia_salas (
  id                 bigint generated always as identity primary key,
  membresia_id       bigint not null references public.membresias(id) on delete cascade,
  sala_id            bigint not null references public.salas(id) on delete restrict,
  nombre_descriptivo text,
  creado_en          timestamptz not null default now(),
  unique (membresia_id, sala_id)
);
create index if not exists membresia_salas_membresia_idx on public.membresia_salas(membresia_id);

create or replace function public.membresia_salas_exige_nombre_externa()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (select 1 from public.salas s where s.id = new.sala_id and s.es_externa)
     and (new.nombre_descriptivo is null or btrim(new.nombre_descriptivo) = '') then
    raise exception 'Una sala externa necesita un nombre descriptivo para la membresía (ej. "Salón X — Hotel Y").';
  end if;
  return new;
end;
$$;

drop trigger if exists membresia_salas_exige_nombre_externa_trg on public.membresia_salas;
create trigger membresia_salas_exige_nombre_externa_trg
  before insert or update on public.membresia_salas
  for each row execute function public.membresia_salas_exige_nombre_externa();

alter table public.membresia_salas enable row level security;
drop policy if exists membresia_salas_select on public.membresia_salas;
create policy membresia_salas_select on public.membresia_salas for select to authenticated using (true);
drop policy if exists membresia_salas_admin_write on public.membresia_salas;
create policy membresia_salas_admin_write on public.membresia_salas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------
-- 5. RESERVAS_SALA - se engancha a la membresia (no al paquete viejo) y
--    suma profesor_id (se trae de H3 para poder validar su choque ya en
--    H2). La sala externa no ocupa: ocupa_sala lo mantiene un trigger
--    desde salas.es_externa (un EXCLUDE no puede mirar otra tabla).
-- ---------------------------------------------------------------------
alter table public.reservas_sala
  add column if not exists membresia_id bigint references public.membresias(id) on delete cascade;
alter table public.reservas_sala
  add column if not exists profesor_id bigint references public.profesores(id) on delete restrict;
alter table public.reservas_sala
  add column if not exists ocupa_sala boolean not null default true;

create index if not exists reservas_sala_membresia_idx on public.reservas_sala(membresia_id);
create index if not exists reservas_sala_profesor_idx on public.reservas_sala(profesor_id);

create or replace function public.reservas_sala_set_ocupa()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  select not s.es_externa into new.ocupa_sala from public.salas s where s.id = new.sala_id;
  return new;
end;
$$;

drop trigger if exists reservas_sala_set_ocupa_trg on public.reservas_sala;
create trigger reservas_sala_set_ocupa_trg
  before insert or update of sala_id on public.reservas_sala
  for each row execute function public.reservas_sala_set_ocupa();

-- Backfill de ocupa_sala para las filas existentes (bloqueos de sala
-- propia: la unica sala externa recien se siembra en el paso 3, asi que
-- hoy todo ocupa).
update public.reservas_sala r
set ocupa_sala = not s.es_externa
from public.salas s
where s.id = r.sala_id;

-- Check: particular <-> membresia_id, alquiler <-> alquiler_id (hasta
-- H7), bloqueo <-> motivo. Reemplaza al que exigia paquete_particular_id.
alter table public.reservas_sala drop constraint if exists reservas_sala_check;
alter table public.reservas_sala add constraint reservas_sala_check check (
  (tipo = 'particular' and membresia_id is not null and alquiler_id is null and motivo is null) or
  (tipo = 'alquiler'   and alquiler_id is not null and membresia_id is null and motivo is null) or
  (tipo = 'bloqueo'    and membresia_id is null and alquiler_id is null and motivo is not null)
);

alter table public.reservas_sala drop constraint if exists reservas_sala_paquete_particular_id_fkey;
drop index if exists public.reservas_sala_paquete_idx;
alter table public.reservas_sala drop column if exists paquete_particular_id;

-- El EXCLUDE pasa a mirar solo lo que realmente ocupa: la sala externa
-- nunca choca consigo misma.
alter table public.reservas_sala drop constraint if exists reservas_sala_no_choque;
alter table public.reservas_sala add constraint reservas_sala_no_choque
  exclude using gist (sala_id with =, rango with &&) where (estado <> 'cancelada' and ocupa_sala);

-- ---------------------------------------------------------------------
-- 6. COMISIONES_DEVENGADAS - se saca paquete_particular_id (0 usos en
--    src/, 0 filas con el dato en dev, medido antes de esta migracion).
-- ---------------------------------------------------------------------
alter table public.comisiones_devengadas drop constraint if exists comisiones_devengadas_paquete_particular_id_fkey;
drop index if exists public.comisiones_devengadas_paquete_idx;
alter table public.comisiones_devengadas drop column if exists paquete_particular_id;

-- ---------------------------------------------------------------------
-- 7. PAQUETES_PARTICULAR - se elimina (0 filas, medido antes de esta
--    migracion en dev; se remide contra produccion antes del pase). Sus
--    politicas RLS se van con la tabla.
-- ---------------------------------------------------------------------
drop table if exists public.paquetes_particular;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0053
-- =====================================================================
