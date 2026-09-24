-- =====================================================================
-- TROPICANA - ROLLBACK de 0048_contactos.sql (C3-0a.1)
-- ---------------------------------------------------------------------
-- NO es una migracion mas: no vive en supabase/migrations/ ni se corre
-- en el flujo normal de pases. Se guarda lista para el dia del pase de
-- C3-0a.1 a produccion, por si aparece un problema y hay que volver
-- atras.
--
-- POR QUE ESTE ROLLBACK NO ES SIMETRICO COMO EL DE LA 0047. La 0047 solo
-- renombraba: deshacerla era otro renombre, sin perdida posible. La 0048
-- es distinta -- crea `contactos` como la fuente de verdad nueva y, desde
-- que se aplico, el codigo (crearAlumno, crearProfesor, actualizarAlumno,
-- etc.) SOLO escribe ahi. Cualquier alumno o profesor dado de alta o
-- editado DESPUES de la 0048 tiene sus columnas viejas
-- (alumnos.nombre/apellido/whatsapp/tutor_*, profesores.nombre/apellido/
-- whatsapp, cursos.linea, profesores.especialidades,
-- tarifas_particular.estilo/paquetes_particular.estilo como texto libre)
-- VACIAS o desactualizadas. Por eso este script no es un renombre: es un
-- RESINCRONIZADO -- copia hacia las columnas viejas todo lo que hoy vive
-- en `contactos` y las tablas nuevas, para TODAS las filas (no solo las
-- que existian antes de la 0048), y recien despues borra lo nuevo.
--
-- QUE SE PIERDE, A PROPOSITO Y MEDIDO (ningun dato de negocio se pierde,
-- pero una transformacion de la 0048 no es perfectamente reversible):
--   1. Texto exacto de `cursos.linea` / `tarifas_particular.estilo` /
--      `paquetes_particular.estilo` / `profesores.especialidades` para
--      filas CREADAS DESPUES de la 0048: se reconstruye desde
--      `estilos.nombre` (el catalogo), no caracter a caracter como estaba
--      escrito a mano. Para las filas de ANTES de la 0048 se usa el
--      respaldo exacto (`cursos_linea_previo_0048`,
--      `tarifas_estilo_previo_0048`) -- salvo `profesores.especialidades`,
--      que nunca tuvo respaldo (`profesores_previo_0048` no guarda esa
--      columna): su reconstruccion puede quedar en otro ORDEN que el
--      original (mismos valores, orden distinto -- cosmetico).
--   2. Los catalogos que la 0048 sembro (`sexo`, `tipo_relacion`,
--      `finalidad_consentimiento`, `medio_consentimiento`, los valores
--      nuevos de `canal_captacion`) NO se borran. Mismo criterio que
--      `refresh-dev.mjs` con catalogos y parametros: son aditivos y
--      quedan, aunque no los lea nadie -- borrarlos arriesga llevarse
--      valores que YA existian en produccion antes de la 0048 (el propio
--      comentario de la 0048 dice que 9 de las 10 opciones nuevas de
--      canal_captacion "son reales de produccion").
--   `canal_captacion` y `whatsapp`/`tutor_whatsapp` (alumnos y profesores)
--   SI se restauran exactos para las filas de antes de la 0048, pisando con
--   el respaldo -- ver la correccion del 2026-09-24 mas abajo.
--
-- QUE SI SE DESHACE POR COMPLETO: las tablas nuevas (contactos y las 16
-- que cuelgan de ella), `alumnos.contacto_id` / `profesores.contacto_id`
-- y sus NOT NULL/UNIQUE, los NOT NULL viejos de nombre/apellido, los
-- indices unicos viejos, `alquileres_sala` vuelve a sus 3 caminos
-- (0 filas medidas en dev y produccion: no hay nada que reconstruir mas
-- que la forma), `pagos.contacto_id`, `cursos.estilo`,
-- `profesor_estilos`, `estilos`, las funciones y politicas RLS nuevas, y
-- los permisos/visibilidad de los 4 modulos nuevos.
--
-- PROBADO DE PUNTA A PUNTA en dev el 2026-09-24: se aplico el rollback
-- sobre dev (que ya tenia la 0048 aplicada), se comparo el esquema por hash
-- contra produccion (que nunca tuvo la 0048) -- **identico**
-- (`f77cb07573ef5630d784beffdca522aa`) -- y se compararon fila por fila
-- `alumnos`/`profesores` restaurados contra el dato real de produccion.
-- Esa comparacion encontro los dos bugs de datos que este script ya tiene
-- corregidos (ver el comentario junto al UPDATE de abajo): el formato de
-- whatsapp (quedaba con +591 en vez del crudo original) y el nulificado de
-- tutor_nombre/tutor_whatsapp cuando el tutor tambien es alumno (produccion
-- prueba que las dos cosas conviven). Se volvio a aplicar la 0048 despues
-- para dejar dev como estaba; `tsc`, `npm test` (43/43) y
-- `control_migracion.sql` limpios.
--
-- CUANDO USARLO. Solo si, despues de correr la 0048 en produccion, algo
-- sale mal ANTES o DESPUES del deploy del codigo nuevo. Se corre este
-- script y, en el mismo momento, se vuelve el codigo de Vercel al deploy
-- anterior (Deployments -> el commit antes del pase -> Promote). Las dos
-- partes se revierten juntas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. PERMISOS Y VISIBILIDAD DE LOS MODULOS NUEVOS (reverso de la 0048 §16)
-- ---------------------------------------------------------------------
delete from public.rol_visibilidad where modulo = 'contactos';
delete from public.rol_permisos where modulo in ('contactos', 'contactos_privados', 'solicitudes', 'enlaces_captacion');


-- ---------------------------------------------------------------------
-- 1. RESINCRONIZAR ALUMNOS: nombre/apellido/whatsapp/canal_captacion
--    desde `contactos`, para TODAS las filas (no solo las de antes de la
--    0048 -- un alumno dado de alta despues nunca tuvo estas columnas
--    escritas).
--
--    CORREGIDO tras probar el script de punta a punta en dev (2026-09-24)
--    y comparar el resultado, fila por fila, contra el dato real de
--    produccion (que nunca tuvo la 0048): dos bugs encontrados.
--    1) `whatsapp`/`tutor_whatsapp` quedaban con el prefijo +591 (formato
--       normalizado de `contactos`) en vez del formato crudo original
--       (produccion: "77644222"; el bug daba "+59177644222"). Mismo numero,
--       string distinto -- y el codigo viejo, si se llega a restaurar de
--       verdad, no espera el prefijo.
--    2) `tutor_nombre`/`tutor_whatsapp` se ponian en null cuando el tutor
--       tambien era alumno (`tutor_alumno_id` reconstruido). Produccion
--       prueba que eso es falso: ids 32/33 (hijas de karola urbari) tienen
--       LAS DOS COSAS a la vez, `tutor_alumno_id` Y `tutor_nombre`/
--       `tutor_whatsapp` -- el dato viejo denormalizaba el nombre aunque
--       hubiera vinculo. Nulificarlo borraba informacion real.
--    La correccion resincroniza TODO desde `contactos`/`contacto_relaciones`
--    (necesario para las filas creadas despues de la 0048, que no tienen
--    respaldo) y despues, para las filas CON respaldo, pisa con el valor
--    exacto de `*_previo_0048` -- la misma logica que ya se usaba para
--    `canal_captacion`, extendida a `whatsapp` y a los campos de tutor.
-- ---------------------------------------------------------------------
update public.alumnos a
   set nombre = c.nombre,
       apellido = coalesce(c.apellido, ''),
       whatsapp = c.whatsapp,
       canal_captacion = c.canal_captacion
  from public.contactos c
 where c.id = a.contacto_id;

-- tutor_alumno_id: si el tutor (contacto_relaciones tipo tutor_de) es EL
-- MISMO contacto de otro alumno, se reconstruye el vinculo alumno-a-alumno
-- de antes. tutor_nombre/tutor_whatsapp se denormalizan SIEMPRE desde el
-- contacto del tutor -- con o sin tutor_alumno_id -- porque asi vivia el
-- dato antes de la 0048 (confirmado contra produccion).
update public.alumnos a
   set tutor_alumno_id = ta.id,
       tutor_nombre = coalesce(nullif(trim(coalesce(tc.nombre, '') || ' ' || coalesce(tc.apellido, '')), ''), 'Tutor sin nombre'),
       tutor_whatsapp = tc.whatsapp
  from public.contacto_relaciones cr
  join public.contactos tc on tc.id = cr.desde_id
  left join public.alumnos ta on ta.contacto_id = cr.desde_id
 where cr.hacia_id = a.contacto_id and cr.tipo = 'tutor_de' and a.es_menor;

-- referido_por_alumno_id (0 filas medidas al escribir la 0048; se deja el
-- mapeo por si deja de estarlo).
update public.alumnos a
   set referido_por_alumno_id = ra.id
  from public.contacto_relaciones cr
  join public.alumnos ra on ra.contacto_id = cr.desde_id
 where cr.hacia_id = a.contacto_id and cr.tipo = 'referido_por';

-- Filas de ANTES de la 0048: el respaldo exacto pisa TODO lo resincronizado
-- arriba -- el whatsapp normalizado, el remapeo de canal_captacion
-- (recomendacion/volante) y los campos de tutor reconstruidos -- porque para
-- estas filas ya tenemos el valor original tal cual estaba, sin adivinar.
update public.alumnos a
   set whatsapp = prev.whatsapp,
       tutor_alumno_id = prev.tutor_alumno_id,
       tutor_nombre = prev.tutor_nombre,
       tutor_whatsapp = prev.tutor_whatsapp,
       canal_captacion = prev.canal_captacion
  from public.alumnos_previo_0048 prev
 where prev.alumno_id = a.id;


-- ---------------------------------------------------------------------
-- 2. RESINCRONIZAR PROFESORES
--    Mismo bug 1) de arriba: `whatsapp` via `contactos` queda normalizado
--    con +591. Se corrige igual, pisando con el respaldo exacto para las
--    filas de antes de la 0048.
--    (`especialidades` NO tiene este mismo respaldo -- `profesores_previo_
--    0048` nunca guardo esa columna -- asi que su reconstruccion desde
--    `profesor_estilos` puede quedar en OTRO ORDEN que el original. Mismos
--    valores, orden distinto: cosmetico, no es perdida de dato. Si algun
--    dia importa, hay que agregar la columna al respaldo ANTES de correr la
--    0048 de nuevo -- este rollback no puede inventar un orden que nunca
--    guardo.)
-- ---------------------------------------------------------------------
update public.profesores p
   set nombre = c.nombre,
       apellido = coalesce(c.apellido, ''),
       whatsapp = c.whatsapp
  from public.contactos c
 where c.id = p.contacto_id;

update public.profesores p
   set whatsapp = prev.whatsapp
  from public.profesores_previo_0048 prev
 where prev.profesor_id = p.id;


-- ---------------------------------------------------------------------
-- 3. CIERRE DE ALUMNOS/PROFESORES: NOT NULL viejos, indices unicos
--    viejos, se borra contacto_id (y con la columna, su UNIQUE y su FK).
-- ---------------------------------------------------------------------
alter table public.alumnos alter column nombre set not null;
alter table public.alumnos alter column apellido set not null;
alter table public.alumnos drop constraint if exists alumnos_contacto_id_key;
alter table public.alumnos drop column if exists contacto_id;

create unique index if not exists alumnos_adulto_whatsapp_uk
  on public.alumnos (regexp_replace(whatsapp, '\D', '', 'g'))
  where es_menor = false and whatsapp is not null and whatsapp <> '';
create unique index if not exists alumnos_menor_clave_uk
  on public.alumnos (regexp_replace(tutor_whatsapp, '\D', '', 'g'), lower(nombre))
  where es_menor = true and tutor_whatsapp is not null and tutor_whatsapp <> '';

comment on column public.alumnos.nombre is null;
comment on column public.alumnos.apellido is null;
comment on column public.alumnos.whatsapp is null;
comment on column public.alumnos.tutor_alumno_id is null;
comment on column public.alumnos.tutor_nombre is null;
comment on column public.alumnos.tutor_whatsapp is null;
comment on column public.alumnos.referido_por_alumno_id is null;
comment on column public.alumnos.canal_captacion is null;

alter table public.profesores alter column nombre set not null;
alter table public.profesores alter column apellido set not null;
alter table public.profesores drop constraint if exists profesores_contacto_id_key;
alter table public.profesores drop column if exists contacto_id;

create unique index if not exists profesores_whatsapp_uk
  on public.profesores (regexp_replace(whatsapp, '\D', '', 'g'))
  where whatsapp is not null and whatsapp <> '';

comment on column public.profesores.nombre is null;
comment on column public.profesores.apellido is null;
comment on column public.profesores.whatsapp is null;


-- ---------------------------------------------------------------------
-- 4. ALQUILERES_SALA: vuelve a los 3 caminos (0 filas medidas en dev y
--    en produccion al escribir la 0048 y al escribir este rollback: no
--    hay datos que reconstruir, solo la forma de la tabla).
-- ---------------------------------------------------------------------
alter table public.alquileres_sala add column if not exists alumno_id bigint references public.alumnos(id) on delete restrict;
alter table public.alquileres_sala add column if not exists profesor_id bigint references public.profesores(id) on delete restrict;
alter table public.alquileres_sala add column if not exists tercero_nombre text;
create index if not exists alquileres_sala_alumno_idx on public.alquileres_sala(alumno_id);
create index if not exists alquileres_sala_profesor_idx on public.alquileres_sala(profesor_id);

alter table public.alquileres_sala add constraint alquileres_sala_check1 check (
  (categoria_comprador = 'alumno' and alumno_id is not null) or
  (categoria_comprador in ('profesor_tropicana', 'profesor_externo') and profesor_id is not null) or
  (categoria_comprador = 'tercero' and tercero_nombre is not null)
);

drop index if exists public.alquileres_sala_contacto_idx;
alter table public.alquileres_sala drop column if exists contacto_id;
comment on column public.alquileres_sala.categoria_comprador is null;


-- ---------------------------------------------------------------------
-- 5. PAGOS: se borra contacto_id (nada la escribia todavia).
-- ---------------------------------------------------------------------
alter table public.pagos drop column if exists contacto_id;


-- ---------------------------------------------------------------------
-- 6. D12: cursos.linea, profesores.especialidades y el texto libre de
--    tarifas_particular.estilo / paquetes_particular.estilo, resincro-
--    nizados desde estilos + profesor_estilos para TODAS las filas, y
--    con el respaldo exacto para las de antes de la 0048.
-- ---------------------------------------------------------------------
update public.cursos c set linea = e.nombre
  from public.estilos e where e.clave = c.estilo;
update public.cursos c set linea = prev.linea_anterior
  from public.cursos_linea_previo_0048 prev
 where prev.curso_id = c.id;
alter table public.cursos drop column if exists estilo;
comment on column public.cursos.linea is null;

update public.profesores p
   set especialidades = coalesce((
     select array_agg(e.nombre order by e.orden)
       from public.profesor_estilos pe join public.estilos e on e.clave = pe.estilo
      where pe.profesor_id = p.id
   ), '{}');
comment on column public.profesores.especialidades is null;

alter table public.tarifas_particular add column estilo_texto text;
update public.tarifas_particular tp set estilo_texto = e.nombre
  from public.estilos e where e.clave = tp.estilo;
update public.tarifas_particular tp set estilo_texto = prev.estilo_anterior
  from public.tarifas_estilo_previo_0048 prev
 where prev.tarifa_id = tp.id;
alter table public.tarifas_particular alter column estilo_texto set not null;
drop index if exists public.tarifas_particular_estilo_idx;
alter table public.tarifas_particular drop column estilo;
alter table public.tarifas_particular rename column estilo_texto to estilo;
create index if not exists tarifas_particular_estilo_idx on public.tarifas_particular(estilo);

alter table public.paquetes_particular add column estilo_texto text;
update public.paquetes_particular pp set estilo_texto = e.nombre
  from public.estilos e where e.clave = pp.estilo;
alter table public.paquetes_particular alter column estilo_texto set not null;
alter table public.paquetes_particular drop column estilo;
alter table public.paquetes_particular rename column estilo_texto to estilo;


-- ---------------------------------------------------------------------
-- 7. TABLAS NUEVAS: se borran, hijas primero. Todo lo que tenian de
--    valor ya quedo copiado en los pasos 1-6.
-- ---------------------------------------------------------------------
drop table if exists public.profesor_estilos;
drop table if exists public.estilos;

drop table if exists public.solicitudes_contacto;
drop table if exists public.enlaces_captacion;
drop table if exists public.matriz_minimos;

drop view if exists public.consentimientos_vigentes;
drop table if exists public.consentimientos;
drop table if exists public.politicas_texto;

drop table if exists public.contacto_relaciones;
drop table if exists public.contacto_redes;
drop table if exists public.redes_sociales;
drop table if exists public.contactos_privados;
drop table if exists public.tipos_documento;

drop table if exists public.contactos_revision_0048;
drop table if exists public.alumnos_previo_0048;
drop table if exists public.profesores_previo_0048;
drop table if exists public.cursos_linea_previo_0048;
drop table if exists public.tarifas_estilo_previo_0048;

drop table if exists public.contactos;


-- ---------------------------------------------------------------------
-- 8. FUNCIONES NUEVAS (ninguna existia antes de la 0048: "no existia
--    ninguna funcion de permisos en SQL" es lo que la 0048 mide en su
--    propio comentario de la seccion 14).
-- ---------------------------------------------------------------------
drop function if exists public.buscar_por_documento(text, text, text);
drop function if exists public.contacto_visible_por_profesor(bigint);
drop function if exists public.profesor_actual_id();
drop function if exists public.alcance_de(text);
drop function if exists public.tiene_permiso(text, text);
drop function if exists public.normalizar_whatsapp(text);
drop function if exists public.consentimientos_solo_insert();

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN rollback 0048
-- =====================================================================
