-- =====================================================================
-- TROPICANA - 0054: reservas con los 7 estados (C3, hito H3)
-- ---------------------------------------------------------------------
-- PARA QUE. Tercer hito del plan de C3: las reservas que crea H2 (venta de
-- particulares) quedan en 'reservada' sin forma de reprogramarse, sus-
-- penderse ni marcarse ausente/realizada. Este hito trae los 7 estados de
-- la regla de negocio 23 (Solicitada, Confirmada, Reprogramada, Reagendar,
-- Suspendida, Ausente, Realizada), el historial auditable de cada cambio
-- y el saldo de horas calculado sobre esos estados.
--
-- Decisiones de Javier para H3 (26/09):
--   1. El formulario puede "Confirmar directo" (valida y descuenta en un
--      paso) o "Solicitar" (ocupa 24 h sin descontar, para cuando todavia
--      se coordinan recursos).
--   2. El saldo disponible para pedir cuenta las Solicitadas vigentes,
--      para no dejar pedir mas horas de las que quedan.
--
-- Idempotente y ADITIVO: ningun dato se borra. Las 21 filas 'particular'
-- en 'reservada' (medido en dev, 26/09) pasan a 'confirmada' -- es el
-- mismo hecho (la sala y el profesor estan ocupados, la clase esta
-- descontada), solo cambia el nombre del estado. Los bloqueos conservan
-- 'reservada'/'cancelada': H3 no les agrega los 7 estados, viven aparte
-- (D7, ya cerrado).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PARAMETRO nuevo (calidad 7: nace en migracion, no a mano en dev).
--    'reserva_cancelacion_plazo_horas' y 'categoria_gracia_dias' ya
--    existen desde la 0052.
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('reserva_solicitud_validez_horas', '24', 'numero', 'Validez de una Solicitada (horas)',
   'Una reserva Solicitada ocupa sala y profesor hasta esta cantidad de horas desde que se crea; si nadie la confirma antes, se libera sola (definiciones-v2 + decision de Javier, 25/09).',
   'Clases Particulares')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- 2. RESERVAS_SALA - XOR de la decision 5 (membresia / plan / bloqueo),
--    columnas de Solicitada y de "ultimo cambio" para que el trigger de
--    historial (paso 4) sepa que anotar sin que cada accion escriba el
--    historial a mano.
-- ---------------------------------------------------------------------
alter table public.reservas_sala
  add column if not exists plan_id bigint references public.planes(id) on delete restrict;
alter table public.reservas_sala
  add column if not exists solicitada_hasta timestamptz;

-- Columnas de trabajo para el trigger de historial: la accion que hace el
-- update completa estas cuatro antes de escribir, y el trigger las lee y
-- las limpia. No son un dato de negocio de la reserva -- son la forma en
-- que el codigo le entrega el "por que" de ESTE cambio al trigger, sin
-- que el trigger tenga que adivinarlo comparando filas.
alter table public.reservas_sala
  add column if not exists cambio_motivo text;
alter table public.reservas_sala
  add column if not exists cambio_glosa text;
alter table public.reservas_sala
  add column if not exists cambio_fuera_de_plazo boolean not null default false;
alter table public.reservas_sala
  add column if not exists actualizado_por uuid references public.perfiles(id) on delete set null;

alter table public.reservas_sala drop constraint if exists reservas_sala_tipo_check;
alter table public.reservas_sala add constraint reservas_sala_tipo_check
  check (tipo in ('particular', 'alquiler', 'taller', 'bloqueo'));

alter table public.reservas_sala drop constraint if exists reservas_sala_check;
alter table public.reservas_sala add constraint reservas_sala_check check (
  (tipo = 'particular' and membresia_id is not null and alquiler_id is null and plan_id is null and motivo is null) or
  (tipo = 'alquiler'   and alquiler_id is not null and membresia_id is null and plan_id is null and motivo is null) or
  (tipo = 'taller'     and plan_id is not null and membresia_id is null and alquiler_id is null and motivo is null) or
  (tipo = 'bloqueo'    and membresia_id is null and alquiler_id is null and plan_id is null and motivo is not null)
);

-- Los bloqueos siguen con su par 'reservada'/'cancelada' (D7, sin tocar);
-- particular/alquiler/taller pasan a los 7 de la regla de negocio 23. El
-- viejo check ('reservada','dictada','cancelada') se saca ANTES de este
-- update, porque 'confirmada' todavia no es un valor valido para el.
alter table public.reservas_sala drop constraint if exists reservas_sala_estado_check;

-- El 26/09 (H2) las creo directo en 'reservada'. Pasan a 'confirmada': el
-- hecho no cambia (sala y profesor ocupados, hora descontada), solo el
-- nombre del estado se alinea con los 7 de esta migracion. Tiene que
-- correr con el check viejo ya afuera y el nuevo todavia sin poner.
update public.reservas_sala set estado = 'confirmada' where tipo <> 'bloqueo' and estado = 'reservada';

alter table public.reservas_sala add constraint reservas_sala_estado_check check (
  (tipo = 'bloqueo' and estado in ('reservada', 'cancelada')) or
  (tipo <> 'bloqueo' and estado in (
    'solicitada', 'confirmada', 'reprogramada', 'reagendar',
    'suspendida', 'ausente', 'realizada'
  ))
);

-- Una Solicitada tiene que tener hasta cuando vale; ningun otro estado la
-- necesita (se calcula al leer, no se arrastra despues de confirmarse).
alter table public.reservas_sala drop constraint if exists reservas_sala_solicitada_hasta_check;
alter table public.reservas_sala add constraint reservas_sala_solicitada_hasta_check check (
  (estado = 'solicitada') = (solicitada_hasta is not null)
);

create index if not exists reservas_sala_plan_idx on public.reservas_sala(plan_id);
create index if not exists reservas_sala_solicitada_hasta_idx on public.reservas_sala(solicitada_hasta) where estado = 'solicitada';

-- ---------------------------------------------------------------------
-- 3. EXCLUDE - se restringe a los estados que de verdad ocupan la sala.
--    'solicitada' NO entra: una Solicitada vigente ocupa por codigo (se
--    valida al crear la siguiente), no por la base -- dos Solicitadas
--    sobre la misma franja son un conflicto a resolver por las personas,
--    no un error de base, y la vigencia se calcula (no se guarda paso a
--    paso, como el fin de ciclo). 'reagendar' y 'suspendida' liberan el
--    recurso: tampoco ocupan.
-- ---------------------------------------------------------------------
alter table public.reservas_sala drop constraint if exists reservas_sala_no_choque;
alter table public.reservas_sala add constraint reservas_sala_no_choque
  exclude using gist (sala_id with =, rango with &&)
  where (
    ocupa_sala and (
      (tipo = 'bloqueo' and estado = 'reservada') or
      (tipo <> 'bloqueo' and estado in ('confirmada', 'reprogramada', 'ausente', 'realizada'))
    )
  );

-- ---------------------------------------------------------------------
-- 4. RESERVAS_HISTORIAL - de solo agregar (como consentimientos): un
--    cambio de reserva es un hecho que paso, nunca se edita ni se borra.
--    Una fila por cambio, con el antes y el despues completos (no solo el
--    estado): reprogramar cambia fecha/hora/sala, no solo el estado.
-- ---------------------------------------------------------------------
create table if not exists public.reservas_historial (
  id                bigint generated always as identity primary key,
  reserva_id        bigint not null references public.reservas_sala(id) on delete cascade,
  estado_anterior   text,
  estado_nuevo      text not null,
  sala_id_anterior  bigint references public.salas(id) on delete set null,
  sala_id_nuevo     bigint references public.salas(id) on delete set null,
  fecha_anterior    date,
  fecha_nueva       date not null,
  hora_anterior     time,
  hora_nueva        time not null,
  duracion_anterior integer,
  duracion_nueva    integer not null,
  motivo            text,
  glosa             text,
  fuera_de_plazo    boolean not null default false,
  actualizado_por   uuid references public.perfiles(id) on delete set null,
  creado_en         timestamptz not null default now()
);
create index if not exists reservas_historial_reserva_idx on public.reservas_historial(reserva_id, creado_en);

alter table public.reservas_historial enable row level security;
drop policy if exists reservas_historial_select on public.reservas_historial;
create policy reservas_historial_select on public.reservas_historial for select to authenticated using (true);
-- Sin policy de insert/update/delete para authenticated: solo el trigger
-- (security definer, ver abajo) escribe. service_role la salta igual.

create or replace function public.reservas_historial_solo_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'reservas_historial es de solo agregar: un cambio de reserva no se edita ni se borra.';
end;
$$;

drop trigger if exists reservas_historial_no_update on public.reservas_historial;
create trigger reservas_historial_no_update
  before update or delete on public.reservas_historial
  for each row execute function public.reservas_historial_solo_insert();

-- Trigger sobre reservas_sala: escribe el historial solo, tomando el
-- motivo/glosa/marca de las columnas de "ultimo cambio" que la accion deja
-- cargadas antes de hacer el update. Asi ningun cambio de estado puede
-- olvidarse de dejar rastro -- no depende de que cada accion nueva se
-- acuerde de insertar en reservas_historial por su cuenta.
create or replace function public.reservas_sala_historial()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.reservas_historial (
      reserva_id, estado_anterior, estado_nuevo,
      sala_id_anterior, sala_id_nuevo, fecha_anterior, fecha_nueva,
      hora_anterior, hora_nueva, duracion_anterior, duracion_nueva,
      motivo, glosa, fuera_de_plazo, actualizado_por
    ) values (
      new.id, null, new.estado,
      null, new.sala_id, null, new.fecha,
      null, new.hora, null, new.duracion_min,
      new.cambio_motivo, new.cambio_glosa, new.cambio_fuera_de_plazo, new.creado_por
    );
    return new;
  end if;

  -- UPDATE: solo deja rastro si algo de lo que le importa al historial
  -- cambio de verdad (estado, sala, fecha, hora o duracion). Tocar solo
  -- las columnas de "ultimo cambio" sin mover la reserva no genera fila.
  if new.estado is distinct from old.estado
     or new.sala_id is distinct from old.sala_id
     or new.fecha is distinct from old.fecha
     or new.hora is distinct from old.hora
     or new.duracion_min is distinct from old.duracion_min then
    insert into public.reservas_historial (
      reserva_id, estado_anterior, estado_nuevo,
      sala_id_anterior, sala_id_nuevo, fecha_anterior, fecha_nueva,
      hora_anterior, hora_nueva, duracion_anterior, duracion_nueva,
      motivo, glosa, fuera_de_plazo, actualizado_por
    ) values (
      new.id, old.estado, new.estado,
      old.sala_id, new.sala_id, old.fecha, new.fecha,
      old.hora, new.hora, old.duracion_min, new.duracion_min,
      new.cambio_motivo, new.cambio_glosa, new.cambio_fuera_de_plazo, new.actualizado_por
    );
  end if;

  -- Las columnas de "ultimo cambio" son de un solo uso: se limpian despues
  -- de dejar su rastro, para que el proximo update no las arrastre.
  new.cambio_motivo := null;
  new.cambio_glosa := null;
  new.cambio_fuera_de_plazo := false;

  return new;
end;
$$;

drop trigger if exists reservas_sala_historial_trg on public.reservas_sala;
create trigger reservas_sala_historial_trg
  after insert or update on public.reservas_sala
  for each row execute function public.reservas_sala_historial();

-- Backfill: una fila de "alta" para cada reserva que ya existia, para que
-- ninguna quede sin su primer historial.
insert into public.reservas_historial (
  reserva_id, estado_anterior, estado_nuevo,
  sala_id_anterior, sala_id_nuevo, fecha_anterior, fecha_nueva,
  hora_anterior, hora_nueva, duracion_anterior, duracion_nueva,
  motivo, glosa, fuera_de_plazo, actualizado_por, creado_en
)
select r.id, null, r.estado,
       null, r.sala_id, null, r.fecha,
       null, r.hora, null, r.duracion_min,
       r.motivo, r.glosa, false, r.creado_por, r.creado_en
from public.reservas_sala r
where not exists (select 1 from public.reservas_historial h where h.reserva_id = r.id);

-- ---------------------------------------------------------------------
-- 5. CATALOGO 'motivo_suspension_reserva' (regla de negocio 19 y 23): por
--    que Tropicana suspende una reserva ya confirmada.
-- ---------------------------------------------------------------------
insert into public.catalogos (clave, nombre, descripcion, es_sistema)
select 'motivo_suspension_reserva', 'Motivos de suspensión de una reserva',
       'Por qué Tropicana suspende una reserva particular/alquiler/taller ya confirmada (regla de negocio 19 y 23: el saldo vuelve, y el profesor no cobra una clase que no dictó).', true
where not exists (select 1 from public.catalogos where clave = 'motivo_suspension_reserva');

insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden)
select c.id, v.valor, v.etiqueta, v.orden
from public.catalogos c
cross join (values
  ('profesor_no_disponible', 'Profesor no disponible', 1),
  ('conflicto_operativo',    'Conflicto operativo',     2),
  ('sala_fuera_de_servicio', 'Sala fuera de servicio',  3),
  ('otro',                   'Otro',                    9)
) as v(valor, etiqueta, orden)
where c.clave = 'motivo_suspension_reserva'
on conflict (catalogo_id, valor) do nothing;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0054
-- =====================================================================
