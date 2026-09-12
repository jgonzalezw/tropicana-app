-- =====================================================================
-- TROPICANA - 0036: el horario base de la sala (C1)
-- ---------------------------------------------------------------------
-- QUE ES. El lienzo del motor de disponibilidad: cuando la sala esta
-- abierta. Fuera de el no se puede reservar. Javier (2026-09-12): "es el
-- cimiento del motor de disponibilidad... se define una vez, no dia por
-- dia".
--
-- DOS PIEZAS DISTINTAS, Y NO SE MEZCLAN (Javier: "me remito a la decision
-- previa sobre el patron de horarios y los feriados u otros como
-- excepciones"):
--
--   1. EL PATRON  - la regla semanal recurrente (Lu-Vi 8-22, Sa 9-14...).
--   2. LAS EXCEPCIONES - por FECHA: un feriado que cierra, o un dia que
--      abre distinto. Un feriado NO es un bloqueo que alguien carga a
--      mano: es una excepcion del horario.
--
-- Son dos formas diferentes -un patron se repite, una excepcion es una
-- fecha- y por eso son dos tablas. Meterlas en una sola seria otra vez el
-- mismo hecho con dos significados, que es la confusion mas cara de este
-- proyecto.
--
-- VACIO SIGNIFICA CERRADO, NO ABIERTO (decidido por Javier). Un dia sin
-- franjas esta cerrado, y una sala sin horario cargado no se puede
-- reservar. El default contrario -"si no se cargo, esta abierto"- produce
-- justo el bug que C1 viene a evitar: sala vendible a las 6 de la manana
-- porque alguien se olvido de configurarla. La pantalla lo dice en vez de
-- que se descubra vendiendo (regla de calidad 5).
--
-- POR ESO NO SE SIEMBRA NINGUN HORARIO. El horario de Tropicana es un
-- dato de negocio, no configuracion tecnica: lo carga Javier, igual que
-- los precios de la 0035.
--
-- Idempotente y ADITIVO.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EL PATRON - una fila por FRANJA, no por dia.
--    Un dia sin filas = cerrado. Un dia con dos filas = abre, corta al
--    mediodia y reabre. Sin columna "cerrado" y sin caso especial: la
--    ausencia ya significa cerrado, que es la misma regla de arriba.
--    `dia_semana` usa la convencion ISO 1=lunes..7=domingo, igual que
--    `cursos.dias_semana` -un concepto, una grafia-.
-- ---------------------------------------------------------------------
create table if not exists public.sala_horario_patron (
  id          bigint generated always as identity primary key,
  sala_id     bigint not null references public.salas(id) on delete cascade,
  dia_semana  int not null check (dia_semana between 1 and 7),
  desde       time not null,
  hasta       time not null,
  creado_en   timestamptz not null default now(),
  check (hasta > desde)
);
create index if not exists sala_horario_patron_sala_idx
  on public.sala_horario_patron(sala_id, dia_semana);

-- Dos franjas del mismo dia no se pueden pisar: "abre 8-12 y 10-14" no
-- quiere decir nada. Lo garantiza la base, no el codigo.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sala_horario_patron_sin_solape') then
    alter table public.sala_horario_patron
      add constraint sala_horario_patron_sin_solape
      exclude using gist (
        sala_id with =,
        dia_semana with =,
        int4range(
          (date_part('hour', desde) * 60 + date_part('minute', desde))::int,
          (date_part('hour', hasta) * 60 + date_part('minute', hasta))::int,
          '[)'
        ) with &&
      );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. LAS EXCEPCIONES - por fecha. Reemplazan al patron ese dia.
--    `cerrado = true`  -> ese dia no abre (feriado).
--    `cerrado = false` -> abre en OTRO horario (el 24/12 hasta las 14).
--
--    UNA fila por fecha, a proposito. Un dia excepcional partido en dos
--    ventanas (abre 9-12 y 15-18 solo ese dia) NO se puede expresar, y es
--    deliberado: el corte al mediodia es algo recurrente -vive en el
--    patron, que si admite varias franjas-, mientras que un dia
--    excepcional partido no se dio nunca. Si algun dia hace falta, es una
--    migracion chica; hoy seria complejidad sin caso.
-- ---------------------------------------------------------------------
create table if not exists public.sala_horario_excepciones (
  id          bigint generated always as identity primary key,
  sala_id     bigint not null references public.salas(id) on delete cascade,
  fecha       date not null,
  cerrado     boolean not null default true,
  desde       time,
  hasta       time,
  -- Catalogo `motivo_excepcion_horario`. Clasifica; el detalle va en glosa.
  motivo      text,
  -- Texto libre: cual feriado, quien lo autorizo, por que se cierra.
  glosa       text,
  creado_por  uuid references public.perfiles(id) on delete set null,
  creado_en   timestamptz not null default now(),
  unique (sala_id, fecha),
  check (
    (cerrado and desde is null and hasta is null) or
    (not cerrado and desde is not null and hasta is not null and hasta > desde)
  )
);
create index if not exists sala_horario_excepciones_fecha_idx
  on public.sala_horario_excepciones(sala_id, fecha);

-- ---------------------------------------------------------------------
-- 3. LOS MOTIVOS - dos listas, porque son dos actos distintos.
--    Quien carga un feriado no deberia ver "mantenimiento" entre sus
--    opciones, y quien bloquea la sala no deberia ver "feriado": un
--    feriado no se bloquea a mano, se administra en el horario.
-- ---------------------------------------------------------------------
insert into public.catalogos (clave, nombre, descripcion, es_sistema)
select 'motivo_excepcion_horario', 'Motivos de excepción del horario',
       'Por qué un día concreto no sigue el patrón semanal de la sala.', true
where not exists (select 1 from public.catalogos where clave = 'motivo_excepcion_horario');

insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden)
select c.id, v.valor, v.etiqueta, v.orden
from public.catalogos c
cross join (values
  ('feriado',           'Feriado',                    1),
  ('cierre_especial',   'Cierre especial',            2),
  ('apertura_especial', 'Apertura especial',          3),
  ('vacaciones',        'Vacaciones / receso',        4),
  ('otro',              'Otro',                       9)
) as v(valor, etiqueta, orden)
where c.clave = 'motivo_excepcion_horario'
on conflict (catalogo_id, valor) do nothing;

-- `fuera_de_horario` y `feriado` salen de los motivos de BLOQUEO: desde
-- esta migracion los administra el horario base, no una persona cargando
-- un bloqueo. Se borran y no se desactivan porque nunca se usaron -la
-- 0035 es de hoy y `reservas_sala` esta vacia-; desactivarlos dejaria dos
-- valores muertos en una lista que se lee para entender el pasado.
delete from public.catalogo_valores cv
using public.catalogos c
where cv.catalogo_id = c.id
  and c.clave = 'motivo_bloqueo_sala'
  and cv.valor in ('fuera_de_horario', 'feriado')
  and not exists (
    select 1 from public.reservas_sala r where r.motivo = cv.valor
  );

-- ---------------------------------------------------------------------
-- 4. GLOSA Y NOTAS en la reserva (Javier, 2026-09-12).
--    `motivo` clasifica (catalogo), `glosa` aclara o nombra al
--    responsable -"puede ir como glosa", dijo sobre el dueno de una
--    reserva interna-, y `notas` es otra cosa: no es un memo, son
--    "instrucciones o recomendaciones para el asistente coordinador de la
--    sala". Por eso se muestran donde se opera, no en una ficha aparte.
-- ---------------------------------------------------------------------
alter table public.reservas_sala
  add column if not exists glosa text;
alter table public.reservas_sala
  add column if not exists notas text;

comment on column public.reservas_sala.glosa is
  'Texto libre que aclara el motivo o nombra al responsable (p. ej. que '
  'profesor ensaya en una reserva interna). El motivo clasifica; la glosa '
  'explica.';
comment on column public.reservas_sala.notas is
  'Instrucciones o recomendaciones para quien coordina la sala. No es un '
  'memo administrativo: se muestra donde se opera la reserva.';

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY - mismo patron que el resto del proyecto.
-- ---------------------------------------------------------------------
alter table public.sala_horario_patron      enable row level security;
alter table public.sala_horario_excepciones enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sala_horario_patron', 'sala_horario_excepciones'] loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists %I_admin_write on public.%I;', t, t);
    execute format(
      'create policy %I_admin_write on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin());',
      t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0036
-- =====================================================================
