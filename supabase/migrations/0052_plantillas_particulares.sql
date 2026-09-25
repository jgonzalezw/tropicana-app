-- =====================================================================
-- TROPICANA - 0052: plantillas de plan de particulares (C3, hito H1)
-- ---------------------------------------------------------------------
-- PARA QUE. Primer hito del plan de C3 (docs/relevamientos/
-- 2026-09-25-C3-plan-construccion.md): abre la pantalla de Planes a
-- tipo_servicio='particular'. Todo lo que la venta (H2) va a personalizar
-- queda configurable ACA, en la plantilla: estilo/tramos (via
-- tarifas_particular, que no se toca), vigencia del paquete, modalidad de
-- reserva (A fija / B flexible, definiciones-v2 7.5), salas permitidas,
-- forma de pago al profesor (definiciones-v2 seccion 3), criterio de
-- liquidacion (ahora 1-5, con el 4 y 5 reservados a taller), reglas de
-- extension (definiciones-v2 7.3) y la politica de asistentes de un grupo
-- (definiciones-v2 7.4: no afecta liquidacion, es solo si se registran).
--
-- "horas y tramos desde tarifas_particular": esa tabla (0035) YA es el
-- catalogo de paquetes por estilo (nombre/horas/precio) y no se duplica.
-- La plantilla solo fija el ESTILO; que tramos ofrece se resuelve leyendo
-- tarifas_particular por ese estilo (H2, sin tabla nueva).
--
-- fee_hora vive en el PROFESOR (definiciones-v2 3a: "el valor del fee vive
-- en el profesor"), igual que ya vive alli tarifa_reemplazo. Por eso
-- profesores.comision_particular_pct (0035) queda OBSOLETA: nunca tuvo uso
-- en src/ (medido antes de esta migracion) y la reemplaza el trio
-- fee_hora (profesor) + forma_pago_profesor/pago_* (plan).
--
-- Parametros nuevos: se siembran ahora, aunque H3/H7 los empiecen a leer,
-- para que nadie los cargue a mano en dev mas adelante (calidad 7).
-- vencimiento_paquete_meses YA EXISTE (0048, grupo "Clases Particulares",
-- sin uso en src/): es la vigencia default que pedia el hito, no se crea
-- una segunda (glosario: un concepto, un nombre).
--
-- Idempotente y ADITIVO.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PLANES - columnas de la plantilla de particulares.
--    Todas nullable/con default neutro: no tocan un plan curso_regular.
-- ---------------------------------------------------------------------
alter table public.planes
  add column if not exists estilo text references public.estilos(clave);
alter table public.planes
  add column if not exists vigencia_dias int check (vigencia_dias is null or vigencia_dias > 0);
alter table public.planes
  add column if not exists reserva_modalidad text
    check (reserva_modalidad is null or reserva_modalidad in ('fija', 'flexible'));
alter table public.planes
  add column if not exists salas_modo text not null default 'todas'
    check (salas_modo in ('todas', 'solo'));
alter table public.planes
  add column if not exists forma_pago_profesor text
    check (forma_pago_profesor is null or forma_pago_profesor in ('fee_hora', 'pct_margen', 'monto_fijo'));
alter table public.planes
  add column if not exists pago_pct_margen numeric(5,2)
    check (pago_pct_margen is null or pago_pct_margen between 0 and 100);
alter table public.planes
  add column if not exists pago_descuenta_sala boolean not null default false;
alter table public.planes
  add column if not exists pago_monto_fijo numeric(10,2)
    check (pago_monto_fijo is null or pago_monto_fijo >= 0);
alter table public.planes
  add column if not exists extension_modo text not null default 'lista'
    check (extension_modo in ('lista', 'recargo'));
alter table public.planes
  add column if not exists extension_recargo_pct numeric(5,2)
    check (extension_recargo_pct is null or extension_recargo_pct between 0 and 100);
alter table public.planes
  add column if not exists registra_acompanantes boolean not null default false;

create index if not exists planes_estilo_idx on public.planes(estilo);

-- Coherencia entre modo de pago y su dato: cada modo exige el campo que
-- realmente usa (calidad 1: un dato a medio cargar no puede pasar por bueno).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'planes_forma_pago_coherente') then
    alter table public.planes add constraint planes_forma_pago_coherente check (
      forma_pago_profesor is null
      or forma_pago_profesor = 'fee_hora'
      or (forma_pago_profesor = 'pct_margen' and pago_pct_margen is not null)
      or (forma_pago_profesor = 'monto_fijo' and pago_monto_fijo is not null)
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'planes_extension_coherente') then
    alter table public.planes add constraint planes_extension_coherente check (
      extension_modo = 'lista' or extension_recargo_pct is not null
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. CRITERIO DE LIQUIDACION 1-5 (definiciones-v2 seccion 6): el 4 y el 5
--    son solo de taller. Se ensancha el check existente (1-4) y se agrega
--    el que ata 4/5 a tipo_servicio='taller'.
-- ---------------------------------------------------------------------
alter table public.planes drop constraint if exists planes_criterio_liquidacion_check;
alter table public.planes add constraint planes_criterio_liquidacion_check
  check (criterio_liquidacion between 1 and 5);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'planes_criterio_taller_check') then
    alter table public.planes add constraint planes_criterio_taller_check
      check (criterio_liquidacion not in (4, 5) or tipo_servicio = 'taller');
  end if;
end $$;

alter table public.comisiones_devengadas drop constraint if exists comisiones_devengadas_criterio_check;
alter table public.comisiones_devengadas add constraint comisiones_devengadas_criterio_check
  check (criterio between 1 and 5);

-- ---------------------------------------------------------------------
-- 3. PLAN_SALAS - que salas puede usar el plan cuando salas_modo='solo'
--    (mismo patron que plan_cursos, 0013). Vacio + 'todas' = cualquier
--    sala activa; no hace falta fila para el caso comun de hoy (una sola
--    sala propia).
-- ---------------------------------------------------------------------
create table if not exists public.plan_salas (
  id        bigint generated always as identity primary key,
  plan_id   bigint not null references public.planes(id) on delete cascade,
  sala_id   bigint not null references public.salas(id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (plan_id, sala_id)
);
create index if not exists plan_salas_plan_idx on public.plan_salas(plan_id);
create index if not exists plan_salas_sala_idx on public.plan_salas(sala_id);

alter table public.plan_salas enable row level security;
drop policy if exists plan_salas_select on public.plan_salas;
create policy plan_salas_select on public.plan_salas for select to authenticated using (true);
drop policy if exists plan_salas_admin_write on public.plan_salas;
create policy plan_salas_admin_write on public.plan_salas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------
-- 4. PROFESORES - fee por hora (definiciones-v2 3a). comision_particular_pct
--    queda OBSOLETA: 0 usos en src/ medidos antes de esta migracion.
-- ---------------------------------------------------------------------
alter table public.profesores
  add column if not exists fee_hora numeric(10,2) check (fee_hora is null or fee_hora >= 0);

comment on column public.profesores.comision_particular_pct is
  'OBSOLETA desde 0052 (C3 H1): nunca tuvo uso en src/. La reemplaza fee_hora '
  '(este profesor) + planes.forma_pago_profesor/pago_* (el plan). Se borra en '
  'una migracion futura.';

-- ---------------------------------------------------------------------
-- 5. PARAMETROS nuevos (calidad 7: nacen en migracion, no se cargan a mano).
--    vencimiento_paquete_meses ya existia (0048) sin uso: es la vigencia
--    default que pedia este hito, no se duplica.
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo) values
  ('categoria_gracia_dias', '7', 'numero', 'Días de gracia de categoría',
   'Al cerrar una membresía o un curso, cuántos días conserva la categoría (alumno / profesor de Tropicana) para la tarifa de alquiler de sala (definiciones-v2, sección 2).',
   'Clases Particulares'),
  ('reserva_cancelacion_plazo_horas', '8', 'numero', 'Anticipación mínima para cancelar (horas)',
   'Cancelar una reserva con esta anticipación o más la deja en Reagendar (vuelve al saldo); con menos, se da por consumida (definiciones-v2, sección 8.3).',
   'Clases Particulares')
on conflict (clave) do nothing;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0052
-- =====================================================================
