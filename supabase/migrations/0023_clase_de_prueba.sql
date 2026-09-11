-- =====================================================================
-- TROPICANA - 0023: la clase de prueba, como variante de venta del plan
-- ---------------------------------------------------------------------
-- MODELO (Javier, 2026-09-11, "Modelo de la Clase de Prueba" v1.0 + las
-- precisiones de la conversacion que lo cerro)
-- ---------------------------------------------------------------------
-- La prueba NO es un plan aparte. Es una **membresia preliminar** que cuelga
-- de un plan regular ya existente: el mismo plan genera membresias regulares
-- y membresias de prueba. Por eso `tipo_servicio` sigue siendo
-- 'curso_regular' y NO se usa el valor 'prueba' que el check ya permitia.
--
-- Decisiones que esta migracion materializa:
--
--  1. El plan REGULA la prueba: si la acepta, en cuantos cursos distintos
--     puede probar el prospecto, si el fee se le acredita al convertir, y
--     cuantos dias dura ese beneficio.
--  2. La prueba se vende SIEMPRE con los cursos elegidos en el momento de
--     comprar (no hay ventana abierta tipo ilimitado): asi el monto se
--     conoce al cobrar.
--  3. El precio es por CURSO y por ALUMNO (bloque C del handoff de Precios
--     y paquetes): "una prueba de Heels no vale lo que una de Zumba".
--     Entra como una modalidad mas de `curso_tarifas`, sin tabla nueva.
--  4. Grupo: un titular identificado + N acompanantes SIN nombre, a efectos
--     de calculo y exposicion. Un solo monto por el total. Todos asisten a
--     la MISMA clase: es una sola asistencia por curso, marcada como unidad.
--  5. Conversion: el vinculo prueba -> inscripcion reusa
--     `inscripciones.membresia_anterior_id`, el mismo campo de la renovacion.
--     El fee se acredita como PAGO A CUENTA (no descuento), asi que no hace
--     falta columna: es una fila de `pagos` contra la cuota nueva.
--
-- Aditiva e idempotente. No cambia ninguna fila existente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. El plan regula la prueba
-- ---------------------------------------------------------------------
alter table public.planes
  add column if not exists acepta_prueba      boolean not null default false,
  add column if not exists prueba_cursos_max  integer,
  add column if not exists prueba_acredita    boolean not null default true,
  add column if not exists prueba_plazo_dias  integer;

comment on column public.planes.acepta_prueba is
  'Si este plan se puede ofrecer como clase de prueba.';
comment on column public.planes.prueba_cursos_max is
  'En cuantos cursos DISTINTOS del plan puede probar el prospecto (1 clase en cada uno). Null = 1. La oferta "proba 1 clase en 2 de los 5 cursos" es prueba_cursos_max = 2.';
comment on column public.planes.prueba_acredita is
  'Si al inscribirse dentro del plazo, lo pagado por la prueba se acredita como pago a cuenta de la membresia nueva.';
comment on column public.planes.prueba_plazo_dias is
  'Dias desde la prueba para inscribirse conservando el credito. Null = usa el parametro prueba_plazo_dias.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'planes_prueba_coherente') then
    alter table public.planes add constraint planes_prueba_coherente check (
      (prueba_cursos_max is null or prueba_cursos_max >= 1)
      and (prueba_plazo_dias is null or prueba_plazo_dias >= 0)
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Precio de prueba por curso (bloque C)
--    `curso_tarifas` ya es (curso, modalidad, precio): alcanza con admitir
--    la modalidad nueva.
-- ---------------------------------------------------------------------
alter table public.curso_tarifas drop constraint if exists curso_tarifas_modalidad_check;
alter table public.curso_tarifas add constraint curso_tarifas_modalidad_check
  check (modalidad in ('clase', 'semana', 'medio_mes', 'prueba'));

-- ---------------------------------------------------------------------
-- 3. La membresia sabe si es preliminar, y a cuanta gente cubre
-- ---------------------------------------------------------------------
alter table public.inscripciones
  add column if not exists es_prueba     boolean not null default false,
  add column if not exists acompanantes  integer not null default 0;

comment on column public.inscripciones.es_prueba is
  'Membresia preliminar: el prospecto prueba antes de decidir. Dura 1 clase por curso elegido, no tiene tolerancia, bono ni renovacion.';
comment on column public.inscripciones.acompanantes is
  'Acompanantes SIN identificar que vienen con el titular. Personas cubiertas = 1 + acompanantes. Solo se usa en membresias de prueba.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inscripciones_acompanantes_valido') then
    alter table public.inscripciones add constraint inscripciones_acompanantes_valido check (
      acompanantes >= 0 and (acompanantes = 0 or es_prueba)
    );
  end if;
end $$;

-- El vinculo prueba -> inscripcion reusa membresia_anterior_id. Se documenta
-- porque hasta ahora solo significaba "ciclo anterior de una renovacion".
comment on column public.inscripciones.membresia_anterior_id is
  'De donde viene esta membresia: el ciclo anterior si es una renovacion, o la membresia de PRUEBA si el prospecto se convirtio. Sirve para medir la conversion.';

-- ---------------------------------------------------------------------
-- 4. Plazo por defecto de la academia (el plan puede pisarlo)
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo)
values (
  'prueba_plazo_dias', '7', 'numero',
  'Dias para convertir una prueba',
  'Dias desde la clase de prueba para inscribirse conservando el credito de lo pagado. Un plan puede definir el suyo.',
  'Inscripciones'
)
on conflict (clave) do nothing;
