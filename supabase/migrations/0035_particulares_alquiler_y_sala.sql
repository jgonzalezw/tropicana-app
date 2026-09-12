-- =====================================================================
-- TROPICANA - 0035: particulares, alquiler de sala y ocupacion de sala
-- ---------------------------------------------------------------------
-- PARA QUE. Arranca el Paso 2D (venta de clases particulares y alquiler
-- de sala) y adelanta la base de datos del Paso 5 (agenda de sala), con
-- el alcance que did Javier el 2026-09-12: "empezamos por el eje de las
-- ventas y contadores... y algun mecanismo de confirmacion de sesiones
-- que luego integramos al eje visual" (la agenda visual mes/semana/dia
-- es Paso 5 y todavia no tiene diseno: queda para despues, sin construir
-- ni modelar mas alla de lo que esta migracion ya deja listo).
--
-- DOS EJES, UN SOLO MODELO DE DATOS (para no re-modelar despues):
--   1. Venta de paquetes de horas (particular/alquiler) + sus contadores.
--   2. Ocupacion de sala: reservas_sala es la fuente unica de choque, hoy
--      usada solo para validar y reservar (sin calendario visual todavia).
--
-- D20 (2026-09-12): el modelo soporta VARIAS salas (`salas`, todo con
-- sala_id) pero esta version opera y muestra UNA sola, porque es la unica
-- que existe hoy. D7 (2026-09-12): la sala se puede bloquear SIN venta
-- (motivo de catalogo) -- por eso reservas_sala admite tipo 'bloqueo' sin
-- dueno comercial.
--
-- LOS CURSOS REGULARES NO SON UNA FILA ACA. Su ocupacion de sala se
-- CALCULA (curso + vigencia + duracion_min + sesiones suspendidas), igual
-- que el fin de ciclo (regla de negocio 4) y la hora de fin (D6): guardar
-- el mismo hecho en dos lugares es la confusion mas cara de este proyecto.
-- El choque contra cursos regulares lo valida el codigo (src/lib), no una
-- fila de esta tabla.
--
-- PRECIOS BASE (bloques D y E de "Precios y paquetes", ya disenados en
-- docs/design/Precios y paquetes.dc.html): esta migracion crea las tablas
-- pero NO carga precios de venta -- son datos de negocio que Natalia/
-- Javier cargan desde la pantalla (regla de calidad 7 sobre lo que SI es
-- config: la dimension nace en la migracion, el precio no se inventa).
--
-- CATEGORIA DE COMPRADOR: se reusa el catalogo `categoria_comprador` que
-- ya existia desde la 0001 ("Categoria para tarifas de paquetes y alquiler
-- de sala") con sus valores alumno / profesor_tropicana / profesor_externo
-- / tercero -- no se inventa una tercera grafia para el mismo concepto
-- (glosario de REGLAS.md). `profesores.tipo` sigue siendo 'activo'/
-- 'externo' (0005); el mapeo activo->profesor_tropicana lo hace el codigo.
--
-- Idempotente y ADITIVO.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. btree_gist -- hace falta para la restriccion de no-choque (abajo).
-- ---------------------------------------------------------------------
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- 1. SALAS (D20: modelo para N, una sola fila hoy).
-- ---------------------------------------------------------------------
create table if not exists public.salas (
  id        bigint generated always as identity primary key,
  nombre    text not null,
  activa    boolean not null default true,
  creado_en timestamptz not null default now()
);

insert into public.salas (nombre)
select 'Sala principal'
where not exists (select 1 from public.salas);

-- ---------------------------------------------------------------------
-- 2. BLOQUE D -- paquetes de clase particular, por estilo.
--    Sin fila de fila = nada que vender; el precio es del PAQUETE, no
--    por persona (N36/N38 del handoff de diseno).
-- ---------------------------------------------------------------------
create table if not exists public.tarifas_particular (
  id             bigint generated always as identity primary key,
  nombre         text not null,                 -- "Paquete 4 horas"
  estilo         text not null,                 -- valor del parametro 'especialidades'
  horas          numeric(4,2) not null check (horas > 0),
  precio         numeric(10,2) not null check (precio >= 0),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists tarifas_particular_estilo_idx on public.tarifas_particular(estilo);

-- ---------------------------------------------------------------------
-- 3. BLOQUE E -- matriz de alquiler de sala (categoria x tamano x horas).
--    Es la UNICA fuente del costo de sala: la lee tanto un alquiler
--    directo como el descuento en la liquidacion de una particular
--    (E.0 del handoff). Celda vacia = "sin tarifa", nunca 0 (regla de
--    calidad 1: un vacio nunca se disfraza de cero).
-- ---------------------------------------------------------------------

-- E.1 -- tamanos fijos, con el maximo de personas editable.
create table if not exists public.sala_tamanos (
  clave        text primary key check (clave in ('individual', 'pareja', 'grupo')),
  etiqueta     text not null,
  max_personas int not null check (max_personas > 0),
  orden        int not null
);
insert into public.sala_tamanos (clave, etiqueta, max_personas, orden) values
  ('individual', 'Individual', 1, 1),
  ('pareja',     'Pareja',     2, 2),
  ('grupo',      'Grupo',      16, 3)
on conflict (clave) do nothing;

-- E.2 -- paquetes de horas: filas compartidas por las 4 categorias.
--    "Agregar un paquete de horas agrega una fila en las cuatro
--    categorias" (handoff E.2) -- por eso son UNA tabla, no una por
--    categoria. El set inicial es una propuesta editable, no un dato de
--    negocio cerrado.
create table if not exists public.sala_horas_paquete (
  id    bigint generated always as identity primary key,
  horas numeric(4,2) not null unique check (horas > 0),
  orden int not null default 0
);
insert into public.sala_horas_paquete (horas, orden)
select v.horas, v.orden
from (values (1::numeric, 1), (2::numeric, 2), (4::numeric, 3), (8::numeric, 4)) as v(horas, orden)
where not exists (select 1 from public.sala_horas_paquete);

-- La matriz. `categoria` usa los mismos valores que el catalogo
-- `categoria_comprador` (0001): alumno / profesor_tropicana /
-- profesor_externo / tercero.
create table if not exists public.sala_tarifas (
  id                bigint generated always as identity primary key,
  categoria         text not null check (categoria in ('alumno', 'profesor_tropicana', 'profesor_externo', 'tercero')),
  tamano            text not null references public.sala_tamanos(clave),
  horas_paquete_id  bigint not null references public.sala_horas_paquete(id) on delete cascade,
  precio            numeric(10,2) check (precio >= 0),   -- NULL = sin tarifa cargada
  actualizado_en    timestamptz not null default now(),
  unique (categoria, tamano, horas_paquete_id)
);

-- ---------------------------------------------------------------------
-- 4. VENTAS -- paquetes de particular y de alquiler, con sus contadores.
--    El costo/precio de sala queda CONGELADO al vender (N39/N40): una
--    tarifa editada despues no cambia lo ya vendido.
-- ---------------------------------------------------------------------
create table if not exists public.paquetes_particular (
  id                    bigint generated always as identity primary key,
  alumno_id             bigint not null references public.alumnos(id) on delete restrict,
  acompanante_id        bigint references public.alumnos(id) on delete restrict,
  profesor_id           bigint not null references public.profesores(id) on delete restrict,
  tarifa_particular_id  bigint references public.tarifas_particular(id) on delete set null,
  -- snapshot: nombre/estilo/horas/precio no cambian si se edita la tarifa despues
  nombre_paquete        text not null,
  estilo                text not null,
  horas_total           numeric(5,2) not null check (horas_total > 0),
  horas_usadas          numeric(5,2) not null default 0 check (horas_usadas >= 0),
  precio                numeric(10,2) not null check (precio >= 0),
  -- costo de sala resuelto contra el bloque E al vender (categoria del
  -- profesor + tamano segun haya acompanante). NULL = sin tarifa cargada:
  -- la venta se cobra igual, pero el paquete de sala no se puede liquidar
  -- (regla de calidad 1, aplicada a N39).
  sala_tamano           text not null references public.sala_tamanos(clave),
  sala_costo_total      numeric(10,2) check (sala_costo_total >= 0),
  -- % de comision del profesor sobre este paquete, snapshot al vender.
  comision_pct          numeric(5,2) check (comision_pct between 0 and 100),
  estado                text not null default 'activo' check (estado in ('activo', 'agotado')),
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  check (horas_usadas <= horas_total)
);
create index if not exists paquetes_particular_alumno_idx on public.paquetes_particular(alumno_id);
create index if not exists paquetes_particular_profesor_idx on public.paquetes_particular(profesor_id);

create table if not exists public.alquileres_sala (
  id                   bigint generated always as identity primary key,
  categoria_comprador  text not null check (categoria_comprador in ('alumno', 'profesor_tropicana', 'profesor_externo', 'tercero')),
  alumno_id            bigint references public.alumnos(id) on delete restrict,
  profesor_id          bigint references public.profesores(id) on delete restrict,
  tercero_nombre       text,
  sala_tamano          text not null references public.sala_tamanos(clave),
  horas_total          numeric(5,2) not null check (horas_total > 0),
  horas_usadas         numeric(5,2) not null default 0 check (horas_usadas >= 0),
  precio               numeric(10,2) not null check (precio >= 0),
  estado               text not null default 'activo' check (estado in ('activo', 'agotado')),
  creado_en            timestamptz not null default now(),
  check (horas_usadas <= horas_total),
  check (
    (categoria_comprador = 'alumno' and alumno_id is not null) or
    (categoria_comprador in ('profesor_tropicana', 'profesor_externo') and profesor_id is not null) or
    (categoria_comprador = 'tercero' and tercero_nombre is not null)
  )
);
create index if not exists alquileres_sala_alumno_idx on public.alquileres_sala(alumno_id);
create index if not exists alquileres_sala_profesor_idx on public.alquileres_sala(profesor_id);

-- ---------------------------------------------------------------------
-- 5. OCUPACION DE SALA -- la fuente unica de choque (D7 + Paso 5).
--    Cada fila es un intervalo que ocupa la sala: una sesion de
--    particular, una de alquiler, o un bloqueo interno sin venta.
--    Los cursos regulares NO tienen fila aca: se calculan (ver arriba).
--
--    `rango` es una columna GENERADA (fecha+hora+duracion -> tstzrange) y
--    la restriccion EXCLUDE garantiza, a nivel de base de datos, que dos
--    reservas activas de la MISMA sala nunca se solapen -- no depende de
--    que el codigo llegue a chequearlo antes de insertar.
-- ---------------------------------------------------------------------
create table if not exists public.reservas_sala (
  id                     bigint generated always as identity primary key,
  sala_id                bigint not null references public.salas(id) on delete restrict,
  tipo                   text not null check (tipo in ('particular', 'alquiler', 'bloqueo')),
  paquete_particular_id  bigint references public.paquetes_particular(id) on delete cascade,
  alquiler_id            bigint references public.alquileres_sala(id) on delete cascade,
  -- catalogo 'motivo_bloqueo_sala' cuando tipo='bloqueo'; null en los otros dos.
  motivo                 text,
  fecha                  date not null,
  hora                   time not null,
  duracion_min           int not null check (duracion_min > 0),
  estado                 text not null default 'reservada' check (estado in ('reservada', 'dictada', 'cancelada')),
  -- `tsrange` (sin zona) y `make_interval`, las dos inmutables: una columna
  -- generada lo exige, y un cast a timestamptz depende del TimeZone de la
  -- sesion. La sala es un lugar fisico con una sola hora local: no hay zona
  -- que resolver.
  rango                  tsrange generated always as (
                           tsrange(
                             (fecha + hora),
                             (fecha + hora) + make_interval(mins => duracion_min),
                             '[)'
                           )
                         ) stored,
  creado_por             uuid references public.perfiles(id) on delete set null,
  creado_en              timestamptz not null default now(),
  check (
    (tipo = 'particular' and paquete_particular_id is not null and alquiler_id is null and motivo is null) or
    (tipo = 'alquiler'   and alquiler_id is not null and paquete_particular_id is null and motivo is null) or
    (tipo = 'bloqueo'    and paquete_particular_id is null and alquiler_id is null and motivo is not null)
  )
);
create index if not exists reservas_sala_fecha_idx on public.reservas_sala(sala_id, fecha);
create index if not exists reservas_sala_paquete_idx on public.reservas_sala(paquete_particular_id);
create index if not exists reservas_sala_alquiler_idx on public.reservas_sala(alquiler_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservas_sala_no_choque') then
    alter table public.reservas_sala
      add constraint reservas_sala_no_choque
      exclude using gist (sala_id with =, rango with &&)
      where (estado <> 'cancelada');
  end if;
end $$;

-- Catalogo de motivos de bloqueo interno (D7: "capacitaciones internas,
-- preparacion de coreografias, mantenimiento, etc.").
insert into public.catalogos (clave, nombre, descripcion, es_sistema)
select 'motivo_bloqueo_sala', 'Motivos de bloqueo de sala',
       'Por que se bloquea la sala sin que haya una venta detras (D7).', true
where not exists (select 1 from public.catalogos where clave = 'motivo_bloqueo_sala');

insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden)
select c.id, v.valor, v.etiqueta, v.orden
from public.catalogos c
cross join (values
  ('capacitacion',    'Capacitación interna',        1),
  ('coreografia',     'Preparación de coreografía',  2),
  ('mantenimiento',   'Mantenimiento',                3),
  ('fuera_de_horario','Fuera de horario de atención', 4),
  ('feriado',         'Feriado',                       5),
  ('otro',            'Otro',                          9)
) as v(valor, etiqueta, orden)
where c.clave = 'motivo_bloqueo_sala'
on conflict (catalogo_id, valor) do nothing;

-- ---------------------------------------------------------------------
-- 6. COMISION DEL PROFESOR POR CLASE PARTICULAR.
--    Es un % propio de la particular (screen 8 del handoff), distinto
--    del % de curso regular (asignaciones.pct_ingresos). Por profesor,
--    no global (regla de negocio 13: sin hardcode); el parametro es el
--    default que propone la ficha, no el que se usa para liquidar --
--    lo que liquida es siempre el valor GUARDADO en el profesor (o, ya
--    vendido, el snapshot en paquetes_particular.comision_pct).
-- ---------------------------------------------------------------------
alter table public.profesores
  add column if not exists comision_particular_pct numeric(5,2) check (comision_particular_pct between 0 and 100);

insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo)
select 'comision_particular_pct_default', '60', 'numero', '% de comisión en particulares (default)',
       'Lo que la ficha de profesor propone para clases particulares. Cada profesor puede tener el suyo.',
       'Comisiones'
where not exists (select 1 from public.parametros where clave = 'comision_particular_pct_default');

-- ---------------------------------------------------------------------
-- 7. Enganche a la liquidacion existente: comisiones_devengadas ya
--    admite membresia_id NULL (0010); se agregan las otras dos fuentes
--    para que una comision de particular entre al MISMO motor de
--    liquidaciones que usan los cursos regulares, en vez de construir
--    uno paralelo.
-- ---------------------------------------------------------------------
alter table public.comisiones_devengadas
  add column if not exists paquete_particular_id bigint references public.paquetes_particular(id) on delete cascade;
alter table public.comisiones_devengadas
  add column if not exists reserva_sala_id bigint references public.reservas_sala(id) on delete cascade;
create index if not exists comisiones_devengadas_paquete_idx on public.comisiones_devengadas(paquete_particular_id);

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY -- mismo patron que el resto del proyecto:
--    lectura a cualquier autenticado, escritura directa solo admin (los
--    operativos escriben por server actions con service_role).
-- ---------------------------------------------------------------------
alter table public.salas               enable row level security;
alter table public.tarifas_particular  enable row level security;
alter table public.sala_tamanos        enable row level security;
alter table public.sala_horas_paquete  enable row level security;
alter table public.sala_tarifas        enable row level security;
alter table public.paquetes_particular enable row level security;
alter table public.alquileres_sala     enable row level security;
alter table public.reservas_sala       enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'salas', 'tarifas_particular', 'sala_tamanos', 'sala_horas_paquete',
    'sala_tarifas', 'paquetes_particular', 'alquileres_sala', 'reservas_sala'
  ] loop
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
-- FIN 0035
-- =====================================================================
