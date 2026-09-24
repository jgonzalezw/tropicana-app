-- =====================================================================
-- TROPICANA - 0048: contactos (C3-0a.1)
-- ---------------------------------------------------------------------
-- PARA QUE. Hoy `alumnos` y `profesores` guardan cada uno su propio
-- nombre/apellido/whatsapp, con la unicidad del numero repetida en las
-- dos tablas. Un tercero que alquila la sala hoy es solo un texto, y un
-- tutor tambien lo es en la mayoria de los casos. C3 (particulares y
-- alquiler) no tiene a quien colgarle la venta sin agregar un cuarto
-- camino. `contactos` es una persona con un solo registro; `alumnos` y
-- `profesores` pasan a ser EXTENSIONES DE ROL que apuntan a su contacto.
--
-- De paso cierra D12 (los estilos pasan a catalogo, no a un parametro de
-- texto) y deja listo el modelo de consentimiento, la matriz de minimos
-- por contexto y las dos tablas de captacion (C3-0b), todavia sin
-- pantalla.
--
-- QUE NO HACE. No borra ninguna columna vieja: `alumnos.nombre`,
-- `apellido`, `whatsapp`, `tutor_*`, `referido_por_alumno_id`,
-- `canal_captacion`, `profesores.especialidades` y `cursos.linea`
-- quedan, marcadas OBSOLETA, hasta la 0049 (pase siguiente a este, con
-- el codigo nuevo ya publicado). Ningun consentimiento se registra: no
-- hay ninguno que registrar retroactivamente.
--
-- TRANSICION. NO es aditiva pura: agrega tablas y columnas, pero dos
-- columnas nuevas (`alumnos.contacto_id`, `profesores.contacto_id`)
-- terminan NOT NULL, y `nombre`/`apellido` de las dos tablas dejan de
-- serlo. El codigo nuevo (que crea el contacto antes que el rol) tiene
-- que estar publicado para poder insertar. Se aplica en una ventana sin
-- operacion, igual que la 0047 (D1), y con el mismo mecanismo de vuelta
-- atras: `scripts/rollback_0048_contactos.sql`, probado en dev por hash
-- contra el esquema pre-0048 de produccion.
--
-- MEDIDO ANTES DE ESCRIBIRLA (regla de calidad 3, contra dev y contra
-- produccion, 2026-09-23/24): 0 fusiones alumno-profesor, 0 alumnos
-- repetidos. 2 WhatsApp fuera de formato (9 y 11 digitos) que NO se
-- tocan solos. Un alumno menor (Sebastian Vivancos) tenia, en su propia
-- ficha, el mismo WhatsApp que sus hermanos anotan como el de su tutora
-- Jessica Galvis (telefono de familia, cargado por error tambien en el
-- campo del menor -- confirmado por Javier contra el dato real de
-- produccion, 2026-09-24). El numero es de la tutora, no del menor: el
-- relleno crea los tutores ANTES que los alumnos, asi el numero de
-- familia siempre queda del lado del adulto, y cualquier alumno cuyo
-- WhatsApp ya sea de otro contacto se crea sin numero, con el choque en
-- el reporte -- sin inventar de quien es en los casos que no se pueden
-- resolver por orden. Una tutora de texto (Natalia Salek, 77311069) es,
-- nombre y numero identicos, la misma persona que la profesora Natalia
-- Salek: se fusiona en un solo contacto, sin reporte de choque porque el
-- nombre coincide.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CONTACTOS
-- ---------------------------------------------------------------------
create table if not exists public.contactos (
  id                    bigint generated always as identity primary key,
  tipo                  text not null default 'persona'
                          check (tipo in ('persona', 'organizacion')),
  nombre                text,
  apellido              text,
  razon_social          text,
  sexo                  text,                 -- catalogo 'sexo'
  whatsapp              text,                 -- E.164, '+591...'
  telefono_alt          text,
  email                 text,
  canal_captacion       text,                 -- catalogo 'canal_captacion'
  fecha_primer_contacto timestamptz not null default now(),
  no_contactar          boolean not null default false,
  anonimizado_en        timestamptz,
  activo                boolean not null default true,
  creado_por            uuid references public.perfiles(id) on delete set null,
  creado_en             timestamptz not null default now(),
  actualizado_por       uuid references public.perfiles(id) on delete set null,
  actualizado_en        timestamptz not null default now(),
  check (
    (tipo = 'persona' and nombre is not null) or
    (tipo = 'organizacion' and razon_social is not null)
  )
);

create unique index if not exists contactos_whatsapp_uk
  on public.contactos (whatsapp)
  where whatsapp is not null and whatsapp <> '' and anonimizado_en is null;

comment on table public.contactos is
  'Una persona u organizacion, un solo registro. alumnos/profesores son extensiones de rol que apuntan aca (contacto_id).';

-- Normaliza un WhatsApp a formato internacional boliviano. 8 digitos ->
-- +591 + eso. Ya con 591 adelante (11 digitos) -> se antepone el +.
-- Cualquier otro formato de puros digitos (los 2 casos raros medidos) se
-- deja sin normalizar: el control 23 los señala para que una persona
-- decida. Pero si la persona ya escribio el "+" a mano -corrigiendo un
-- numero extranjero, como Manuel Aguilar (+34...)-, ese "+" es una
-- decision explicita y se respeta.
create or replace function public.normalizar_whatsapp(texto text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  t text := trim(coalesce(texto, ''));
  d text := regexp_replace(t, '\D', '', 'g');
begin
  if d = '' then return null; end if;
  if length(d) = 8 then return '+591' || d; end if;
  if length(d) = 11 and left(d, 3) = '591' then return '+' || d; end if;
  if left(t, 1) = '+' then return '+' || d; end if;
  return d;
end;
$$;

create table if not exists public.contactos_revision_0048 (
  id        bigint generated always as identity primary key,
  caso      text not null,
  detalle   text not null,
  creado_en timestamptz not null default now()
);
alter table public.contactos_revision_0048 enable row level security;
drop policy if exists contactos_revision_0048_select on public.contactos_revision_0048;
create policy contactos_revision_0048_select on public.contactos_revision_0048
  for select to authenticated using (true);


-- ---------------------------------------------------------------------
-- 2. DOCUMENTO, REDES, RELACIONES, DATOS PRIVADOS
-- ---------------------------------------------------------------------
create table if not exists public.tipos_documento (
  clave  text primary key,
  nombre text not null,
  patron text,          -- regex de validacion; null = sin formato fijo
  orden  int not null default 0,
  activo boolean not null default true
);
insert into public.tipos_documento (clave, nombre, patron, orden) values
  ('ci',             'Cedula de identidad', '^[0-9]{5,10}$',    1),
  ('ci_extranjero',  'CI extranjero',       null,               2),
  ('pasaporte',      'Pasaporte',           '^[A-Za-z0-9]{5,15}$', 3),
  ('nit',            'NIT',                 '^[0-9]{5,15}$',    4)
on conflict (clave) do nothing;

create table if not exists public.contactos_privados (
  contacto_id      bigint primary key references public.contactos(id) on delete cascade,
  tipo_documento   text references public.tipos_documento(clave),
  pais_emisor      text not null default 'BO',
  numero           text,
  complemento      text,
  expedido         text,
  fecha_nacimiento date,
  actualizado_en   timestamptz not null default now()
);
create unique index if not exists contactos_privados_documento_uk
  on public.contactos_privados (
    tipo_documento, pais_emisor,
    upper(regexp_replace(numero, '\s', '', 'g')),
    coalesce(upper(complemento), '')
  )
  where tipo_documento is not null and numero is not null and numero <> '';

create table if not exists public.redes_sociales (
  clave      text primary key,
  nombre     text not null,
  patron_url text,
  orden      int not null default 0,
  activo     boolean not null default true
);
insert into public.redes_sociales (clave, nombre, orden) values
  ('instagram', 'Instagram', 1),
  ('facebook',  'Facebook',  2),
  ('tiktok',    'TikTok',    3),
  ('whatsapp',  'WhatsApp',  4)
on conflict (clave) do nothing;

create table if not exists public.contacto_redes (
  id          bigint generated always as identity primary key,
  contacto_id bigint not null references public.contactos(id) on delete cascade,
  red         text not null references public.redes_sociales(clave),
  usuario     text not null,
  creado_en   timestamptz not null default now(),
  unique (contacto_id, red)
);

-- 'desde' es tutor_de/referido_por/trabaja_en/contacto_emergencia de
-- 'hacia'. Ej.: tutor tutor_de menor; alumno referido_por quien lo trajo.
create table if not exists public.contacto_relaciones (
  id          bigint generated always as identity primary key,
  desde_id    bigint not null references public.contactos(id) on delete cascade,
  hacia_id    bigint not null references public.contactos(id) on delete cascade,
  tipo        text not null check (tipo in ('tutor_de', 'referido_por', 'trabaja_en', 'contacto_emergencia')),
  desde_fecha date not null default current_date,
  creado_en   timestamptz not null default now(),
  check (desde_id <> hacia_id),
  unique (desde_id, hacia_id, tipo)
);
create index if not exists contacto_relaciones_hacia_idx on public.contacto_relaciones(hacia_id);


-- ---------------------------------------------------------------------
-- 3. CONSENTIMIENTO
-- ---------------------------------------------------------------------
create table if not exists public.politicas_texto (
  version       text not null,
  finalidad     text not null,     -- catalogo 'finalidad_consentimiento'
  texto         text not null,
  vigente_desde date not null default current_date,
  primary key (version, finalidad)
);
insert into public.politicas_texto (version, finalidad, texto) values
  ('v1', 'contacto',
   'Tropicana guarda tu nombre, WhatsApp y los datos que nos compartas para '
   || 'gestionar tu inscripcion, tus clases y tus pagos, y para avisarte por '
   || 'WhatsApp sobre tus clases, vencimientos y novedades de la academia. '
   || 'No compartimos tus datos con terceros. Podes pedir en cualquier '
   || 'momento que dejemos de contactarte o que borremos tus datos.')
on conflict (version, finalidad) do nothing;

create table if not exists public.consentimientos (
  id               bigint generated always as identity primary key,
  contacto_id      bigint not null references public.contactos(id) on delete cascade,
  finalidad        text not null,   -- catalogo 'finalidad_consentimiento'
  medio            text not null,   -- catalogo 'medio_consentimiento'
  otorgado         boolean not null,
  version_politica text,
  registrado_por   uuid references public.perfiles(id) on delete set null,
  creado_en        timestamptz not null default now()
);
create index if not exists consentimientos_contacto_idx
  on public.consentimientos (contacto_id, finalidad, creado_en desc);

-- De solo agregar: un consentimiento es un hecho que paso, no se corrige.
create or replace function public.consentimientos_solo_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'consentimientos es de solo agregar: no se edita ni se borra';
end;
$$;
drop trigger if exists consentimientos_no_update on public.consentimientos;
create trigger consentimientos_no_update
  before update or delete on public.consentimientos
  for each row execute function public.consentimientos_solo_insert();

create or replace view public.consentimientos_vigentes
with (security_invoker = true) as
select distinct on (contacto_id, finalidad) *
from public.consentimientos
order by contacto_id, finalidad, creado_en desc;


-- ---------------------------------------------------------------------
-- 4. MATRIZ DE MINIMOS POR CONTEXTO
--    O = obligatorio, V = visible opcional, - = oculto. Editable desde
--    Administracion en C3-0a.2; hoy solo la siembra y la consultan las
--    acciones del servidor.
-- ---------------------------------------------------------------------
create table if not exists public.matriz_minimos (
  contexto text not null,
  campo    text not null,
  nivel    text not null check (nivel in ('O', 'V', '-')),
  primary key (contexto, campo)
);

insert into public.matriz_minimos (contexto, campo, nivel) values
  -- nombre
  ('prospecto','nombre','O'), ('prueba','nombre','O'), ('alumno_adulto','nombre','O'),
  ('alumno_menor','nombre','O'), ('profesor','nombre','O'), ('tercero_persona','nombre','O'),
  ('tercero_org','nombre','-'), ('proveedor','nombre','O'), ('form_publico','nombre','O'),
  -- apellido
  ('prospecto','apellido','V'), ('prueba','apellido','O'), ('alumno_adulto','apellido','O'),
  ('alumno_menor','apellido','O'), ('profesor','apellido','O'), ('tercero_persona','apellido','V'),
  ('tercero_org','apellido','-'), ('proveedor','apellido','V'), ('form_publico','apellido','V'),
  -- razon_social
  ('prospecto','razon_social','-'), ('prueba','razon_social','-'), ('alumno_adulto','razon_social','-'),
  ('alumno_menor','razon_social','-'), ('profesor','razon_social','-'), ('tercero_persona','razon_social','-'),
  ('tercero_org','razon_social','O'), ('proveedor','razon_social','O'), ('form_publico','razon_social','-'),
  -- whatsapp (prospecto y form_publico: whatsapp o red social, ver red_social)
  ('prospecto','whatsapp','O'), ('prueba','whatsapp','O'), ('alumno_adulto','whatsapp','O'),
  ('alumno_menor','whatsapp','-'), ('profesor','whatsapp','O'), ('tercero_persona','whatsapp','O'),
  ('tercero_org','whatsapp','O'), ('proveedor','whatsapp','O'), ('form_publico','whatsapp','O'),
  -- red_social
  ('prospecto','red_social','O'), ('prueba','red_social','V'), ('alumno_adulto','red_social','V'),
  ('alumno_menor','red_social','-'), ('profesor','red_social','V'), ('tercero_persona','red_social','V'),
  ('tercero_org','red_social','V'), ('proveedor','red_social','-'), ('form_publico','red_social','V'),
  -- es_menor
  ('prospecto','es_menor','-'), ('prueba','es_menor','V'), ('alumno_adulto','es_menor','O'),
  ('alumno_menor','es_menor','O'), ('profesor','es_menor','-'), ('tercero_persona','es_menor','-'),
  ('tercero_org','es_menor','-'), ('proveedor','es_menor','-'), ('form_publico','es_menor','O'),
  -- tutor
  ('prospecto','tutor','-'), ('prueba','tutor','-'), ('alumno_adulto','tutor','-'),
  ('alumno_menor','tutor','O'), ('profesor','tutor','-'), ('tercero_persona','tutor','-'),
  ('tercero_org','tutor','-'), ('proveedor','tutor','-'), ('form_publico','tutor','O'),
  -- tipo_profesor
  ('prospecto','tipo_profesor','-'), ('prueba','tipo_profesor','-'), ('alumno_adulto','tipo_profesor','-'),
  ('alumno_menor','tipo_profesor','-'), ('profesor','tipo_profesor','O'), ('tercero_persona','tipo_profesor','-'),
  ('tercero_org','tipo_profesor','-'), ('proveedor','tipo_profesor','-'), ('form_publico','tipo_profesor','-'),
  -- canal_captacion (form_publico lo llena el enlace, no se pregunta)
  ('prospecto','canal_captacion','V'), ('prueba','canal_captacion','V'), ('alumno_adulto','canal_captacion','V'),
  ('alumno_menor','canal_captacion','V'), ('profesor','canal_captacion','-'), ('tercero_persona','canal_captacion','-'),
  ('tercero_org','canal_captacion','-'), ('proveedor','canal_captacion','-'), ('form_publico','canal_captacion','-'),
  -- interes
  ('prospecto','interes','V'), ('prueba','interes','V'), ('alumno_adulto','interes','V'),
  ('alumno_menor','interes','V'), ('profesor','interes','-'), ('tercero_persona','interes','-'),
  ('tercero_org','interes','-'), ('proveedor','interes','-'), ('form_publico','interes','O'),
  -- consentimiento
  ('prospecto','consentimiento','V'), ('prueba','consentimiento','V'), ('alumno_adulto','consentimiento','V'),
  ('alumno_menor','consentimiento','V'), ('profesor','consentimiento','V'), ('tercero_persona','consentimiento','V'),
  ('tercero_org','consentimiento','V'), ('proveedor','consentimiento','-'), ('form_publico','consentimiento','O'),
  -- email, documento, facturacion, nacimiento: ocultos en todo contexto hoy
  ('prospecto','email','-'), ('prueba','email','-'), ('alumno_adulto','email','-'),
  ('alumno_menor','email','-'), ('profesor','email','-'), ('tercero_persona','email','-'),
  ('tercero_org','email','-'), ('proveedor','email','-'), ('form_publico','email','-'),
  ('prospecto','documento','-'), ('prueba','documento','-'), ('alumno_adulto','documento','-'),
  ('alumno_menor','documento','-'), ('profesor','documento','-'), ('tercero_persona','documento','-'),
  ('tercero_org','documento','-'), ('proveedor','documento','-'), ('form_publico','documento','-'),
  ('prospecto','facturacion','-'), ('prueba','facturacion','-'), ('alumno_adulto','facturacion','-'),
  ('alumno_menor','facturacion','-'), ('profesor','facturacion','-'), ('tercero_persona','facturacion','-'),
  ('tercero_org','facturacion','-'), ('proveedor','facturacion','-'), ('form_publico','facturacion','-'),
  ('prospecto','nacimiento','-'), ('prueba','nacimiento','-'), ('alumno_adulto','nacimiento','-'),
  ('alumno_menor','nacimiento','-'), ('profesor','nacimiento','-'), ('tercero_persona','nacimiento','-'),
  ('tercero_org','nacimiento','-'), ('proveedor','nacimiento','-'), ('form_publico','nacimiento','-')
on conflict (contexto, campo) do nothing;


-- ---------------------------------------------------------------------
-- 5. ESTILOS (D12)
-- ---------------------------------------------------------------------
create table if not exists public.estilos (
  clave  text primary key,
  nombre text not null,
  orden  int not null default 0,
  activo boolean not null default true
);

create table if not exists public.profesor_estilos (
  profesor_id bigint not null references public.profesores(id) on delete cascade,
  estilo      text not null references public.estilos(clave),
  primary key (profesor_id, estilo)
);


-- ---------------------------------------------------------------------
-- 6. CAPTACION (C3-0b la usa; nace vacia y sin pantalla en este pase)
-- ---------------------------------------------------------------------
create table if not exists public.enlaces_captacion (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('campana', 'referido', 'personal')),
  token       text not null unique,
  contacto_id bigint references public.contactos(id) on delete set null,
  nombre      text,
  vence_en    timestamptz,
  activo      boolean not null default true,
  creado_por  uuid references public.perfiles(id) on delete set null,
  creado_en   timestamptz not null default now()
);

create table if not exists public.solicitudes_contacto (
  id           bigint generated always as identity primary key,
  origen       text not null check (origen in ('enlace_campana', 'enlace_referido', 'enlace_personal')),
  enlace_id    bigint references public.enlaces_captacion(id) on delete set null,
  contacto_id  bigint references public.contactos(id) on delete set null,
  nombre       text,
  apellido     text,
  whatsapp     text,
  email        text,
  datos        jsonb not null default '{}'::jsonb,
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'convalidada', 'descartada')),
  ip_hash      text,
  creado_en    timestamptz not null default now(),
  resuelto_por uuid references public.perfiles(id) on delete set null,
  resuelto_en  timestamptz
);


-- ---------------------------------------------------------------------
-- 7. CATALOGOS (idempotente, on conflict do nothing)
-- ---------------------------------------------------------------------
insert into public.catalogos (clave, nombre, es_sistema)
select v.clave, v.nombre, true
from (values
  ('sexo', 'Sexo'),
  ('tipo_relacion', 'Tipo de relacion entre contactos'),
  ('finalidad_consentimiento', 'Finalidad del consentimiento'),
  ('medio_consentimiento', 'Medio por el que se otorgo el consentimiento')
) as v(clave, nombre)
where not exists (select 1 from public.catalogos c where c.clave = v.clave);

insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden)
select c.id, v.valor, v.etiqueta, v.orden
from public.catalogos c
cross join (values ('femenino', 'Femenino', 1), ('masculino', 'Masculino', 2), ('otro', 'Otro', 3)) as v(valor, etiqueta, orden)
where c.clave = 'sexo'
on conflict (catalogo_id, valor) do nothing;

insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden)
select c.id, v.valor, v.etiqueta, v.orden
from public.catalogos c
cross join (values
  ('tutor_de', 'Tutor de', 1), ('referido_por', 'Referido por', 2),
  ('trabaja_en', 'Trabaja en', 3), ('contacto_emergencia', 'Contacto de emergencia', 4)
) as v(valor, etiqueta, orden)
where c.clave = 'tipo_relacion'
on conflict (catalogo_id, valor) do nothing;

insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden)
select c.id, v.valor, v.etiqueta, v.orden
from public.catalogos c
cross join (values ('contacto', 'Datos de contacto y WhatsApp', 1)) as v(valor, etiqueta, orden)
where c.clave = 'finalidad_consentimiento'
on conflict (catalogo_id, valor) do nothing;

insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden)
select c.id, v.valor, v.etiqueta, v.orden
from public.catalogos c
cross join (values ('presencial', 'Presencial', 1), ('whatsapp', 'WhatsApp', 2), ('formulario', 'Formulario web', 3)) as v(valor, etiqueta, orden)
where c.clave = 'medio_consentimiento'
on conflict (catalogo_id, valor) do nothing;

-- canal_captacion: las 9 opciones reales de produccion, mas 'referencias'
-- (boca a boca, sin persona detras -- distinto de 'referido', que es una
-- relacion con alguien con nombre). Se agregan las que falten; las que ya
-- estaban (por venir de produccion via refresh) no se duplican.
insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden)
select c.id, v.valor, v.etiqueta, v.orden
from public.catalogos c
cross join (values
  ('tiktok', 'TikTok', 1), ('instagram', 'Instagram', 2), ('facebook', 'Facebook', 3),
  ('referencias', 'Referencias (boca a boca)', 4), ('whatsapp', 'Whatsapp', 9),
  ('referido', 'Referido', 10), ('letrero', 'Letrero', 11), ('otro', 'Otro', 12),
  ('telegram', 'Telegram', 13), ('recurrente', 'Recurrente', 14)
) as v(valor, etiqueta, orden)
where c.clave = 'canal_captacion'
on conflict (catalogo_id, valor) do nothing;

-- Deuda propia de dev (medida el 2026-09-24): 'redes_sociales', 'recomendacion'
-- y 'volante' no existen en produccion. Se desactiva 'redes_sociales' (ya
-- cubierto por 'facebook'/'instagram'/'tiktok'), y los alumnos que las
-- usaban se remapean mas abajo, en el relleno.
update public.catalogo_valores cv set activo = false
from public.catalogos c
where c.id = cv.catalogo_id and c.clave = 'canal_captacion' and cv.valor = 'redes_sociales';


-- ---------------------------------------------------------------------
-- 8. ALUMNOS / PROFESORES: contacto_id (nullable por ahora, se cierra
--    al final de esta migracion una vez relleno)
-- ---------------------------------------------------------------------
alter table public.alumnos add column if not exists contacto_id bigint references public.contactos(id);
alter table public.profesores add column if not exists contacto_id bigint references public.contactos(id);


-- ---------------------------------------------------------------------
-- 9. ESTILOS EN CURSOS / TARIFAS / PAQUETES
-- ---------------------------------------------------------------------
create table if not exists public.cursos_linea_previo_0048 (
  curso_id bigint primary key,
  linea_anterior text,
  guardado_en timestamptz not null default now()
);
alter table public.cursos_linea_previo_0048 enable row level security;
drop policy if exists cursos_linea_previo_0048_select on public.cursos_linea_previo_0048;
create policy cursos_linea_previo_0048_select on public.cursos_linea_previo_0048
  for select to authenticated using (true);
insert into public.cursos_linea_previo_0048 (curso_id, linea_anterior)
select id, linea from public.cursos where linea is not null
on conflict (curso_id) do nothing;

create table if not exists public.tarifas_estilo_previo_0048 (
  tarifa_id bigint primary key,
  estilo_anterior text not null,
  guardado_en timestamptz not null default now()
);
alter table public.tarifas_estilo_previo_0048 enable row level security;
drop policy if exists tarifas_estilo_previo_0048_select on public.tarifas_estilo_previo_0048;
create policy tarifas_estilo_previo_0048_select on public.tarifas_estilo_previo_0048
  for select to authenticated using (true);
insert into public.tarifas_estilo_previo_0048 (tarifa_id, estilo_anterior)
select id, estilo from public.tarifas_particular
on conflict (tarifa_id) do nothing;

-- Siembra estilos con la union de todo lo que hoy los usa: el parametro
-- (orden de referencia), cursos.linea, profesores.especialidades y
-- tarifas_particular.estilo. clave = minuscula del valor encontrado.
insert into public.estilos (clave, nombre, orden)
select clave, nombre, row_number() over (order by ord_min, clave)
from (
  select lower(v) as clave, min(v) as nombre, min(ord) as ord_min
  from (
    select trim(x) as v, 1 as ord
      from unnest(string_to_array(coalesce((select valor from public.parametros where clave = 'especialidades'), ''), ',')) as x
     where trim(x) <> ''
    union all
    select distinct linea, 2 from public.cursos where linea is not null and trim(linea) <> ''
    union all
    select distinct unnest(especialidades), 2 from public.profesores
    union all
    select distinct estilo, 2 from public.tarifas_particular where estilo is not null and trim(estilo) <> ''
  ) t
  group by lower(v)
) g
on conflict (clave) do nothing;

alter table public.cursos add column if not exists estilo text references public.estilos(clave);
update public.cursos set estilo = lower(linea) where linea is not null and estilo is null;

alter table public.tarifas_particular add column estilo_clave text references public.estilos(clave);
update public.tarifas_particular set estilo_clave = lower(estilo) where estilo_clave is null;
alter table public.tarifas_particular alter column estilo_clave set not null;
alter table public.tarifas_particular drop column estilo;
alter table public.tarifas_particular rename column estilo_clave to estilo;
create index if not exists tarifas_particular_estilo_idx on public.tarifas_particular(estilo);

alter table public.paquetes_particular add column estilo_clave text references public.estilos(clave);
update public.paquetes_particular set estilo_clave = lower(estilo) where estilo_clave is null;
alter table public.paquetes_particular alter column estilo_clave set not null;
alter table public.paquetes_particular drop column estilo;
alter table public.paquetes_particular rename column estilo_clave to estilo;

insert into public.profesor_estilos (profesor_id, estilo)
select p.id, lower(e)
from public.profesores p, unnest(p.especialidades) e
on conflict do nothing;

comment on column public.cursos.linea is 'OBSOLETA desde 0048: usar estilo (FK a estilos.clave). Se borra en la 0049.';
comment on column public.profesores.especialidades is 'OBSOLETA desde 0048: usar profesor_estilos. Se borra en la 0049.';


-- ---------------------------------------------------------------------
-- 10. RELLENO: un contacto por profesor y por alumno, tutores, canal
-- ---------------------------------------------------------------------
create table if not exists public.alumnos_previo_0048 (
  alumno_id bigint primary key,
  nombre text, apellido text, whatsapp text, es_menor boolean,
  tutor_alumno_id bigint, tutor_nombre text, tutor_whatsapp text,
  referido_por_alumno_id bigint, canal_captacion text,
  guardado_en timestamptz not null default now()
);
alter table public.alumnos_previo_0048 enable row level security;
drop policy if exists alumnos_previo_0048_select on public.alumnos_previo_0048;
create policy alumnos_previo_0048_select on public.alumnos_previo_0048
  for select to authenticated using (true);
insert into public.alumnos_previo_0048
  (alumno_id, nombre, apellido, whatsapp, es_menor, tutor_alumno_id, tutor_nombre, tutor_whatsapp, referido_por_alumno_id, canal_captacion)
select id, nombre, apellido, whatsapp, es_menor, tutor_alumno_id, tutor_nombre, tutor_whatsapp, referido_por_alumno_id, canal_captacion
from public.alumnos
on conflict (alumno_id) do nothing;

create table if not exists public.profesores_previo_0048 (
  profesor_id bigint primary key,
  nombre text, apellido text, whatsapp text,
  guardado_en timestamptz not null default now()
);
alter table public.profesores_previo_0048 enable row level security;
drop policy if exists profesores_previo_0048_select on public.profesores_previo_0048;
create policy profesores_previo_0048_select on public.profesores_previo_0048
  for select to authenticated using (true);
insert into public.profesores_previo_0048 (profesor_id, nombre, apellido, whatsapp)
select id, nombre, apellido, whatsapp from public.profesores
on conflict (profesor_id) do nothing;

do $$
declare
  r record;
  v_contacto_id bigint;
  v_wa text;
  v_existente_id bigint;
  v_existente_nombre text;
begin
  -- 1 contacto por profesor. 0 fusiones con alumnos (medido). El
  -- profesor_id ya insertado sirve para la busqueda de tutores por
  -- nombre+whatsapp mas abajo (caso Natalia Salek).
  for r in select * from public.profesores where contacto_id is null loop
    insert into public.contactos (tipo, nombre, apellido, whatsapp, fecha_primer_contacto, creado_en)
    values ('persona', r.nombre, r.apellido, public.normalizar_whatsapp(r.whatsapp), r.creado_en, r.creado_en)
    returning id into v_contacto_id;
    update public.profesores set contacto_id = v_contacto_id where id = r.id;
  end loop;

  -- Tutores solo de texto: se procesan ANTES que los alumnos, a
  -- proposito -- el numero de familia es del tutor, no de un hijo, y el
  -- orden es lo que decide quien se queda con el numero cuando dos
  -- identidades lo comparten. Un contacto por numero de WhatsApp
  -- distinto (varios hermanos comparten tutor). Si ese numero ya es de
  -- un contacto EXISTENTE (un profesor) con un nombre que coincide
  -- (Natalia Salek, profesora y tutora de su hija, nombre y numero
  -- identicos), se reusa ese contacto en vez de duplicar.
  --
  -- CASO MEDIDO Y CORREGIDO (Javier, 2026-09-24, contra el dato real de
  -- produccion): Sebastian Vivancos tenia, en `alumnos.whatsapp`, EL
  -- MISMO numero que sus hermanos anotan como el de su tutora Jessica
  -- Galvis -- no es su numero propio, es un dato mal cargado en el
  -- campo equivocado. Un menor no puede tener como "propio" el mismo
  -- numero que ya es de un tutor: por eso los tutores se crean primero,
  -- y el paso de alumnos (mas abajo) le saca el numero a cualquier
  -- alumno cuyo WhatsApp ya sea de un contacto existente -- sea tutor,
  -- profesor u otro alumno -- sin tener que adivinar caso por caso.
  for r in
    select regexp_replace(coalesce(a.tutor_whatsapp, ''), '\D', '', 'g') as wa_crudo,
           public.normalizar_whatsapp(a.tutor_whatsapp) as wa,
           (array_agg(a.tutor_nombre order by a.id))[1] as tutor_nombre
      from public.alumnos a
     where a.es_menor and a.tutor_alumno_id is null
       and coalesce(a.tutor_whatsapp, '') <> ''
     group by 1, 2
  loop
    v_existente_id := null;
    v_existente_nombre := null;
    select c.id, coalesce(c.nombre, '') || ' ' || coalesce(c.apellido, '')
      into v_existente_id, v_existente_nombre
      from public.contactos c where c.whatsapp = r.wa limit 1;

    if v_existente_id is not null and lower(trim(v_existente_nombre)) = lower(trim(r.tutor_nombre)) then
      insert into public.contactos_revision_0048 (caso, detalle) values (
        'tutor_fusionado_por_nombre_y_whatsapp',
        format('Tutor "%s" (%s) es el mismo contacto #%s (nombre y WhatsApp coinciden).', r.tutor_nombre, r.wa, v_existente_id)
      );
    else
      insert into public.contactos (tipo, nombre, whatsapp, fecha_primer_contacto)
      values ('persona', coalesce(nullif(trim(r.tutor_nombre), ''), 'Tutor sin nombre'), case when v_existente_id is null then r.wa else null end, now())
      returning id into v_contacto_id;
      if v_existente_id is not null then
        insert into public.contactos_revision_0048 (caso, detalle) values (
          'whatsapp_de_tutor_en_uso',
          format('Tutor "%s" (contacto #%s): su WhatsApp %s ya es de otro contacto (#%s, "%s"). Se creo sin numero.', r.tutor_nombre, v_contacto_id, r.wa, v_existente_id, trim(v_existente_nombre))
        );
      end if;
    end if;
  end loop;

  -- 1 contacto por alumno. Corre DESPUES de profesores y tutores de
  -- texto: si el WhatsApp propio de un alumno ya es de un contacto
  -- existente (un tutor -- el caso Sebastian/Jessica Galvis --, un
  -- profesor, u otro alumno), el contacto se crea SIN ese WhatsApp y el
  -- choque queda en el reporte. No se adivina de quien es el numero,
  -- pero el orden ya resuelve el caso mas comun: el numero de familia
  -- es del adulto que lo presta, no del menor.
  for r in select * from public.alumnos where contacto_id is null loop
    v_wa := public.normalizar_whatsapp(r.whatsapp);
    if v_wa is not null and exists (select 1 from public.contactos c where c.whatsapp = v_wa) then
      insert into public.contactos_revision_0048 (caso, detalle) values (
        'whatsapp_propio_en_uso',
        format('Alumno #%s (%s %s): su WhatsApp %s ya es de otro contacto. Se creo sin numero.', r.id, r.nombre, r.apellido, v_wa)
      );
      v_wa := null;
    end if;
    insert into public.contactos (tipo, nombre, apellido, whatsapp, canal_captacion, fecha_primer_contacto, creado_en)
    values (
      'persona', r.nombre, r.apellido, v_wa,
      case r.canal_captacion when 'recomendacion' then 'referido' when 'volante' then 'otro' else r.canal_captacion end,
      r.creado_en, r.creado_en
    )
    returning id into v_contacto_id;
    update public.alumnos set contacto_id = v_contacto_id where id = r.id;
  end loop;

  -- Tutores ya vinculados como alumno: solo la relacion, sin contacto
  -- nuevo. Corre al final porque necesita el contacto de los dos lados
  -- (tutor y alumno) ya creado.
  for r in
    select a.id as alumno_id, a.contacto_id as hijo_contacto_id, t.contacto_id as tutor_contacto_id
      from public.alumnos a join public.alumnos t on t.id = a.tutor_alumno_id
     where a.es_menor and a.tutor_alumno_id is not null
  loop
    insert into public.contacto_relaciones (desde_id, hacia_id, tipo)
    values (r.tutor_contacto_id, r.hijo_contacto_id, 'tutor_de')
    on conflict do nothing;
  end loop;
end $$;

-- Vincula cada menor con el contacto de su tutor de texto (el contacto
-- ya existe: se creo, o se fusiono, en el loop de arriba). Se hace en
-- SQL declarativo, aparte del loop, para no anidar dos loops sobre la
-- misma variable de registro.
--
-- OJO: NO alcanza con buscar solo por WhatsApp. Si el tutor perdio su
-- numero por chocar con un contacto anterior de OTRO nombre (un
-- profesor con un numero distinto al suyo, caso no medido hoy pero
-- posible), buscarlo solo por WhatsApp lo dejaria sin vincular. Por eso
-- se exige que coincida tambien el nombre, y si el tutor quedo sin
-- numero se lo encuentra por nombre entre los contactos sin rol.
insert into public.contacto_relaciones (desde_id, hacia_id, tipo)
select t.tutor_contacto_id, a.contacto_id, 'tutor_de'
from public.alumnos a
join lateral (
  select c.id as tutor_contacto_id
    from public.contactos c
   where (c.whatsapp = public.normalizar_whatsapp(a.tutor_whatsapp)
          and lower(trim(coalesce(c.nombre, '') || ' ' || coalesce(c.apellido, ''))) = lower(trim(a.tutor_nombre)))
      or (c.whatsapp is null
          and lower(trim(c.nombre)) = lower(trim(a.tutor_nombre))
          and not exists (select 1 from public.alumnos x where x.contacto_id = c.id)
          and not exists (select 1 from public.profesores x where x.contacto_id = c.id))
   order by (c.whatsapp is not null) desc, c.id
   limit 1
) t on true
where a.es_menor and a.tutor_alumno_id is null and coalesce(a.tutor_whatsapp, '') <> ''
on conflict do nothing;

-- referido_por_alumno_id -> relacion (0 filas medidas, se deja el
-- mapeo para que la migracion sea correcta si alguna vez deja de serlo).
insert into public.contacto_relaciones (desde_id, hacia_id, tipo)
select a.contacto_id, r.contacto_id, 'referido_por'
from public.alumnos a join public.alumnos r on r.id = a.referido_por_alumno_id
where a.referido_por_alumno_id is not null
on conflict do nothing;


-- ---------------------------------------------------------------------
-- 11. CIERRE: contacto_id NOT NULL + UNIQUE, se sacan los NOT NULL
--     viejos, se borran las unicidades viejas
-- ---------------------------------------------------------------------
alter table public.alumnos alter column contacto_id set not null;
alter table public.alumnos add constraint alumnos_contacto_id_key unique (contacto_id);
alter table public.alumnos alter column nombre drop not null;
alter table public.alumnos alter column apellido drop not null;

drop index if exists public.alumnos_adulto_whatsapp_uk;
drop index if exists public.alumnos_menor_clave_uk;

comment on column public.alumnos.nombre is 'OBSOLETA desde 0048: usar contactos.nombre (via contacto_id). Se borra en la 0049.';
comment on column public.alumnos.apellido is 'OBSOLETA desde 0048: usar contactos.apellido. Se borra en la 0049.';
comment on column public.alumnos.whatsapp is 'OBSOLETA desde 0048: usar contactos.whatsapp. Se borra en la 0049.';
comment on column public.alumnos.tutor_alumno_id is 'OBSOLETA desde 0048: usar contacto_relaciones tipo tutor_de. Se borra en la 0049.';
comment on column public.alumnos.tutor_nombre is 'OBSOLETA desde 0048: idem.';
comment on column public.alumnos.tutor_whatsapp is 'OBSOLETA desde 0048: idem.';
comment on column public.alumnos.referido_por_alumno_id is 'OBSOLETA desde 0048: usar contacto_relaciones tipo referido_por. Se borra en la 0049.';
comment on column public.alumnos.canal_captacion is 'OBSOLETA desde 0048: usar contactos.canal_captacion. Se borra en la 0049.';

alter table public.profesores alter column contacto_id set not null;
alter table public.profesores add constraint profesores_contacto_id_key unique (contacto_id);
alter table public.profesores alter column nombre drop not null;
alter table public.profesores alter column apellido drop not null;

drop index if exists public.profesores_whatsapp_uk;

comment on column public.profesores.nombre is 'OBSOLETA desde 0048: usar contactos.nombre (via contacto_id). Se borra en la 0049.';
comment on column public.profesores.apellido is 'OBSOLETA desde 0048: usar contactos.apellido. Se borra en la 0049.';
comment on column public.profesores.whatsapp is 'OBSOLETA desde 0048: usar contactos.whatsapp. Se borra en la 0049.';


-- ---------------------------------------------------------------------
-- 12. ALQUILERES_SALA: contacto_id en vez de 3 caminos (0 filas medidas
--     en dev y en produccion, asi que no hay nada que migrar)
-- ---------------------------------------------------------------------
alter table public.alquileres_sala add column if not exists contacto_id bigint references public.contactos(id);
alter table public.alquileres_sala alter column contacto_id set not null;
alter table public.alquileres_sala drop constraint if exists alquileres_sala_check1;
alter table public.alquileres_sala drop constraint if exists alquileres_sala_alumno_id_fkey;
alter table public.alquileres_sala drop constraint if exists alquileres_sala_profesor_id_fkey;
drop index if exists public.alquileres_sala_alumno_idx;
drop index if exists public.alquileres_sala_profesor_idx;
alter table public.alquileres_sala drop column if exists alumno_id;
alter table public.alquileres_sala drop column if exists profesor_id;
alter table public.alquileres_sala drop column if exists tercero_nombre;
create index if not exists alquileres_sala_contacto_idx on public.alquileres_sala(contacto_id);
comment on column public.alquileres_sala.categoria_comprador is 'Snapshot de la categoria al momento de la venta; ya no gobierna a quien pertenece (eso es contacto_id).';


-- ---------------------------------------------------------------------
-- 13. PAGOS: contraparte por contacto (para C3; nada la escribe todavia)
-- ---------------------------------------------------------------------
alter table public.pagos add column if not exists contacto_id bigint references public.contactos(id);


-- ---------------------------------------------------------------------
-- 14. FUNCIONES DE PERMISOS Y VISIBILIDAD (no existia ninguna: hasta
--     ahora tienePermiso/alcanceDe vivian solo en src/lib/sesion.ts)
-- ---------------------------------------------------------------------
create or replace function public.tiene_permiso(p_modulo text, p_accion text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case when r.clave = 'administrador' then true
                else coalesce((
                  select rp.permitido from public.rol_permisos rp
                   where rp.rol_id = p.rol_id and rp.modulo = p_modulo and rp.accion = p_accion
                ), false)
           end
      from public.perfiles p join public.roles r on r.id = p.rol_id
     where p.id = auth.uid() and p.activo = true
  ), false);
$$;

create or replace function public.alcance_de(p_modulo text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case when r.clave = 'administrador' then 'todo'
                else coalesce((
                  select rv.alcance from public.rol_visibilidad rv
                   where rv.rol_id = p.rol_id and rv.modulo = p_modulo
                ), 'todo')
           end
      from public.perfiles p join public.roles r on r.id = p.rol_id
     where p.id = auth.uid() and p.activo = true
  ), 'todo');
$$;

create or replace function public.profesor_actual_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profesores where usuario_id = auth.uid();
$$;

-- Visible por un profesor si es su propio contacto, o el de un alumno
-- con una membresia en un curso donde es o FUE titular (una liquidacion
-- vieja de un curso que ya no dicta sigue mostrando los nombres).
create or replace function public.contacto_visible_por_profesor(p_contacto_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profesores pr
       where pr.usuario_id = auth.uid() and pr.contacto_id = p_contacto_id
    )
    or exists (
      select 1
        from public.profesores pr
        join public.asignaciones asg on asg.profesor_id = pr.id
        join public.membresia_cursos mc on mc.curso_id = asg.curso_id
        join public.membresias m on m.id = mc.membresia_id
        join public.alumnos al on al.id = m.alumno_id
       where pr.usuario_id = auth.uid() and al.contacto_id = p_contacto_id
    );
$$;

-- Devuelve solo el contacto_id si el documento existe; nunca el numero.
create or replace function public.buscar_por_documento(p_tipo text, p_pais text, p_numero text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select cp.contacto_id
    from public.contactos_privados cp
   where cp.tipo_documento = p_tipo
     and cp.pais_emisor = p_pais
     and upper(regexp_replace(cp.numero, '\s', '', 'g')) = upper(regexp_replace(p_numero, '\s', '', 'g'))
   limit 1;
$$;


-- ---------------------------------------------------------------------
-- 15. RLS. Ninguna tabla nueva tiene politica de escritura: se escribe
--     solo desde acciones del servidor con la clave de servicio, que
--     chequean el permiso en la app (R8 -- sin es_admin() nuevo).
--
--     contactos_select NO es el mecanismo del padron de asistencia ni
--     del detalle de una liquidacion: esas pantallas autorizan por curso
--     o por liquidacion y leen completo con la clave de servicio. Esta
--     politica es la barrera para lecturas DIRECTAS a la tabla.
-- ---------------------------------------------------------------------
alter table public.contactos enable row level security;
drop policy if exists contactos_select on public.contactos;
create policy contactos_select on public.contactos
  for select to authenticated using (
    public.es_admin()
    or (public.tiene_permiso('contactos', 'ver') and public.alcance_de('contactos') = 'todo')
    or public.contacto_visible_por_profesor(id)
  );

alter table public.contactos_privados enable row level security;
drop policy if exists contactos_privados_select on public.contactos_privados;
create policy contactos_privados_select on public.contactos_privados
  for select to authenticated using (
    public.es_admin() or public.tiene_permiso('contactos_privados', 'ver')
  );

alter table public.contacto_redes enable row level security;
drop policy if exists contacto_redes_select on public.contacto_redes;
create policy contacto_redes_select on public.contacto_redes
  for select to authenticated using (
    public.es_admin()
    or (public.tiene_permiso('contactos', 'ver') and public.alcance_de('contactos') = 'todo')
    or public.contacto_visible_por_profesor(contacto_id)
  );

alter table public.contacto_relaciones enable row level security;
drop policy if exists contacto_relaciones_select on public.contacto_relaciones;
create policy contacto_relaciones_select on public.contacto_relaciones
  for select to authenticated using (
    public.es_admin()
    or (public.tiene_permiso('contactos', 'ver') and public.alcance_de('contactos') = 'todo')
    or public.contacto_visible_por_profesor(desde_id)
    or public.contacto_visible_por_profesor(hacia_id)
  );

alter table public.consentimientos enable row level security;
drop policy if exists consentimientos_select on public.consentimientos;
create policy consentimientos_select on public.consentimientos
  for select to authenticated using (
    public.es_admin()
    or (public.tiene_permiso('contactos', 'ver') and public.alcance_de('contactos') = 'todo')
    or public.contacto_visible_por_profesor(contacto_id)
  );

-- Catalogos de apoyo: lectura abierta, como el resto de los catalogos.
do $$
declare t text;
begin
  foreach t in array array['tipos_documento', 'redes_sociales', 'politicas_texto', 'matriz_minimos', 'estilos', 'profesor_estilos'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using (true);', t, t);
  end loop;
end $$;

alter table public.solicitudes_contacto enable row level security;
drop policy if exists solicitudes_contacto_select on public.solicitudes_contacto;
create policy solicitudes_contacto_select on public.solicitudes_contacto
  for select to authenticated using (public.es_admin() or public.tiene_permiso('solicitudes', 'ver'));

alter table public.enlaces_captacion enable row level security;
drop policy if exists enlaces_captacion_select on public.enlaces_captacion;
create policy enlaces_captacion_select on public.enlaces_captacion
  for select to authenticated using (public.es_admin() or public.tiene_permiso('enlaces_captacion', 'ver'));


-- ---------------------------------------------------------------------
-- 16. PERMISOS Y VISIBILIDAD EN LA APP
-- ---------------------------------------------------------------------
-- 'contactos' hereda de alumnos+profesores (OR de los dos, por rol y
-- accion): todo rol que hoy ve nombres los sigue viendo igual.
insert into public.rol_permisos (rol_id, modulo, accion, permitido)
select p.rol_id, 'contactos', p.accion, bool_or(p.permitido)
  from public.rol_permisos p
 where p.modulo in ('alumnos', 'profesores')
 group by p.rol_id, p.accion
on conflict (rol_id, modulo, accion) do nothing;

-- 'contactos_privados', 'solicitudes' y 'enlaces_captacion' heredan de
-- alumnos, SIN el rol profesor (los datos privados y la captacion no
-- son suyos).
insert into public.rol_permisos (rol_id, modulo, accion, permitido)
select p.rol_id, m.modulo_nuevo, p.accion, p.permitido
  from public.rol_permisos p
  join public.roles r on r.id = p.rol_id
  cross join (values ('contactos_privados'), ('solicitudes'), ('enlaces_captacion')) as m(modulo_nuevo)
 where p.modulo = 'alumnos' and r.clave <> 'profesor'
on conflict (rol_id, modulo, accion) do nothing;

insert into public.rol_visibilidad (rol_id, modulo, alcance)
select r.id, 'contactos', 'propio' from public.roles r where r.clave = 'profesor'
on conflict (rol_id, modulo) do nothing;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0048
-- =====================================================================
