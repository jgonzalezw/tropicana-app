-- =====================================================================
-- TROPICANA - 0037: la segunda sala, y las excepciones por rango
-- ---------------------------------------------------------------------
-- POR QUE AHORA Y NO DESPUES. Tropicana habilito una segunda sala en la
-- misma sede (Javier, 2026-09-12). D20 ya habia evitado lo caro -el
-- modelo nacio para N salas- pero quedaba un agujero: `cursos` no decia
-- en que sala se dicta.
--
-- Eso no es "mas trabajo despues": es que DESPUES YA NO SE PUEDE SABER.
-- En cuanto se dicte en la sala nueva sin registrarlo, no hay forma de
-- reconstruir en que sala estuvo la clase del martes pasado -y esa es
-- justamente la informacion que decide si la sala esta libre-. Hoy el
-- backfill es trivial y sin ambiguedad: los 9 cursos activos estaban en
-- la unica sala que existia.
--
-- Medido antes de escribir esto (dev, 2026-09-12): 0 excepciones, 0
-- reservas, 0 precios de alquiler cargados, 9 cursos activos todos con
-- hora. Todo lo que encareceria este cambio esta en cero, asi que es el
-- momento exacto.
--
-- LA SEGUNDA SALA NO SE CREA ACA. Su nombre es un dato de negocio, no
-- configuracion tecnica: lo carga Javier desde la pantalla, igual que los
-- precios y el horario. Inventarle un nombre seria adivinar.
--
-- Idempotente y ADITIVO.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LAS SALAS TIENEN ORDEN DE PREFERENCIA.
--    No son dos salas pares. Javier (2026-09-12): "la idea siempre es
--    vender los espacios disponibles de la sala principal (default) y a
--    menos que este ocupada ofrecer la alterna".
--
--    Por eso el orden es un dato y no una convencion: es lo que despues
--    le permite al motor de disponibilidad ofrecer la alterna en vez de
--    contestar "ocupado". Sin el, elegir cual proponer seria arbitrario.
-- ---------------------------------------------------------------------
alter table public.salas
  add column if not exists orden int;

update public.salas set orden = id where orden is null;

alter table public.salas
  alter column orden set default 100,
  alter column orden set not null;

comment on column public.salas.orden is
  'Preferencia de venta: la de menor orden es la que se ofrece primero. '
  'La alterna se propone cuando la principal esta ocupada.';

-- ---------------------------------------------------------------------
-- 2. UN CURSO SE DICTA EN UNA SALA.
--    Es el agujero que esta migracion viene a cerrar. `ocupacionDeCursos`
--    calcula que clases ocupan la sala una fecha dada; sin esta columna
--    no sabe cual, y con dos salas bloquearia las dos.
--
--    Nullable a proposito: un curso sin sala asignada no bloquea ninguna,
--    y eso es mejor que bloquear la equivocada. La pantalla lo muestra
--    como lo que es -falta cargarlo- en vez de elegir una por default
--    (regla de calidad 5: una capacidad que falta se explica, no se
--    adivina).
-- ---------------------------------------------------------------------
alter table public.cursos
  add column if not exists sala_id bigint references public.salas(id) on delete set null;

-- Backfill: hasta hoy habia una sola sala, asi que no hay nada que
-- decidir. Solo toca los cursos sin sala, para que re-correrla no pise
-- una asignacion hecha despues a mano.
update public.cursos c
   set sala_id = (select s.id from public.salas s order by s.orden, s.id limit 1)
 where c.sala_id is null;

create index if not exists cursos_sala_idx on public.cursos(sala_id);

comment on column public.cursos.sala_id is
  'En que sala se dicta. De aca sale que clases ocupan cada sala: sin '
  'este dato no se puede saber si la sala esta libre. NULL = sin asignar, '
  'y un curso sin sala no bloquea ninguna.';

-- ---------------------------------------------------------------------
-- 3. LAS EXCEPCIONES PASAN A SER UN RANGO DE FECHAS.
--    "Vacaciones del 24/12 al 5/1" es UN hecho, no trece. Guardarlo como
--    trece filas parte una decision en pedazos y despues editarla es
--    editar trece cosas.
--
--    Se hace ahora porque hay CERO excepciones cargadas: no migra nada.
--    Despues de que se carguen feriados habria que convertirlos.
--
--    Un dia suelto es un rango de un dia, asi que no se pierde nada.
-- ---------------------------------------------------------------------
alter table public.sala_horario_excepciones
  add column if not exists hasta_fecha date;

-- Lo ya cargado (si algo hubiera) se vuelve un rango de un dia.
update public.sala_horario_excepciones
   set hasta_fecha = fecha
 where hasta_fecha is null;

alter table public.sala_horario_excepciones
  alter column hasta_fecha set not null;

-- `fecha` pasa a ser el inicio del rango. Se conserva el nombre para no
-- romper lo que ya lo lee, y el comentario dice que significa ahora.
comment on column public.sala_horario_excepciones.fecha is
  'Primer dia del rango. Una excepcion de un solo dia tiene fecha = '
  'hasta_fecha.';
comment on column public.sala_horario_excepciones.hasta_fecha is
  'Ultimo dia del rango, inclusive.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sala_horario_excepciones_rango_valido') then
    alter table public.sala_horario_excepciones
      add constraint sala_horario_excepciones_rango_valido
      check (hasta_fecha >= fecha);
  end if;
end $$;

-- El unique por (sala, fecha) ya no alcanza: con rangos, lo que no puede
-- pasar es que DOS excepciones de la misma sala se pisen -si no, una
-- fecha tendria dos horarios distintos y no habria como elegir-.
alter table public.sala_horario_excepciones
  drop constraint if exists sala_horario_excepciones_sala_id_fecha_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sala_horario_excepciones_sin_solape') then
    alter table public.sala_horario_excepciones
      add constraint sala_horario_excepciones_sin_solape
      exclude using gist (
        sala_id with =,
        daterange(fecha, hasta_fecha, '[]') with &&
      );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. LA TARIFA DE ALQUILER PUEDE DIFERENCIARSE POR SALA - Y HOY NO LO
--    HACE.
--    Javier (2026-09-12): "en esencia no hay una valoracion distinta hoy,
--    pero ya que lo propones, puede ser util despues".
--
--    Por eso `sala_id` es NULLABLE con semantica de override:
--      fila con sala_id NULL -> vale para TODAS las salas (el caso de hoy)
--      fila con sala_id      -> manda sobre la general, para esa sala
--
--    Asi se carga UN solo juego de precios ahora y se diferencia el dia
--    que haga falta, sin cargar 48 celdas dos veces para decir lo mismo.
-- ---------------------------------------------------------------------
alter table public.sala_tarifas
  add column if not exists sala_id bigint references public.salas(id) on delete cascade;

-- El unique tenia que incluir la sala: la misma coordenada puede existir
-- una vez general y una vez por sala. Con NULLS NOT DISTINCT, dos filas
-- generales de la misma coordenada siguen chocando -que es lo correcto-.
alter table public.sala_tarifas
  drop constraint if exists sala_tarifas_categoria_tamano_horas_paquete_id_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sala_tarifas_coordenada_uk') then
    alter table public.sala_tarifas
      add constraint sala_tarifas_coordenada_uk
      unique nulls not distinct (sala_id, categoria, tamano, horas_paquete_id);
  end if;
end $$;

comment on column public.sala_tarifas.sala_id is
  'NULL = la tarifa vale para todas las salas (el caso normal). Con sala, '
  'esa fila manda sobre la general para esa sala. Evita cargar la matriz '
  'entera dos veces cuando las salas cuestan lo mismo.';

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0037
-- =====================================================================
