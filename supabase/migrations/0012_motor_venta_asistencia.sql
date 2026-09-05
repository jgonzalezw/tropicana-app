-- =====================================================================
-- TROPICANA - 0012: soporte de esquema para 1B (venta + asistencia motor)
-- ---------------------------------------------------------------------
-- Aditivo e idempotente. No cambia datos existentes salvo el backfill de
-- planes.modalidad (etiqueta), que solo rellena filas nulas.
--
-- Agrega:
--   1. planes.modalidad     - etiqueta de la modalidad comercial del plan
--                             ('mensual','medio_mes','clase','semana','otro').
--                             Permite ubicar sin ambiguedad "el Plan Regular
--                             (mensual) del curso" en la venta.
--   2. inscripciones.clases_hechas  - contador de clases realizadas (1B.2).
--   3. inscripciones.bono_generado  - bono del ciclo por faltas con licencia,
--                             se consume en la renovacion (Paso 2).
--   4. asistencias.con_licencia     - marca de "falta con licencia" (1B.2).
--   5. parametro dias_compromiso_pago - tope de dias desde hoy para la
--                             fecha de compromiso de pago del saldo.
--
-- Solo ASCII en los comentarios.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. planes.modalidad (etiqueta comercial). Backfill por el nombre que
--    pusieron 0011 (Plan Regular) y el fix de datos (Plan Medio Mes).
-- ---------------------------------------------------------------------
alter table public.planes
  add column if not exists modalidad text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planes_modalidad_check'
  ) then
    alter table public.planes
      add constraint planes_modalidad_check
      check (modalidad is null or modalidad in
        ('mensual', 'medio_mes', 'clase', 'semana', 'otro'));
  end if;
end $$;

update public.planes
  set modalidad = 'mensual'
  where modalidad is null
    and tipo_servicio = 'curso_regular'
    and nombre like 'Plan Regular %';

update public.planes
  set modalidad = 'medio_mes'
  where modalidad is null
    and nombre like 'Plan Medio Mes %';

-- ---------------------------------------------------------------------
-- 2-3. Contador y bono en la membresia (inscripciones).
-- ---------------------------------------------------------------------
alter table public.inscripciones
  add column if not exists clases_hechas int not null default 0;   -- clases dictadas contadas hacia clases_plan
alter table public.inscripciones
  add column if not exists bono_generado int not null default 0;   -- faltas con licencia del ciclo (tope tolerancia); se usa al renovar

-- ---------------------------------------------------------------------
-- 4. asistencias.con_licencia (falta justificada -> genera bono).
-- ---------------------------------------------------------------------
alter table public.asistencias
  add column if not exists con_licencia boolean not null default false;

-- ---------------------------------------------------------------------
-- 5. Parametro: tope de dias para la fecha de compromiso de pago.
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('dias_compromiso_pago', '30', 'numero', 'Dias maximos de compromiso de pago',
   'Cuando queda saldo, la fecha de compromiso de pago no puede superar hoy mas esta cantidad de dias.', 'Cobros')
on conflict (clave) do nothing;

-- =====================================================================
-- FIN 0012
-- =====================================================================
