-- =====================================================================
-- TROPICANA - 0058: Liquidación de clases particulares (C3, H5)
-- ---------------------------------------------------------------------
-- PARA QUE. H1-H4 ya venden particulares y las reservan con los 7 estados,
-- pero el motor de liquidación (`liquidaciones/acciones.ts` + `motor.ts`)
-- solo conoce cursos regulares: una particular nunca llega a
-- `estado='completada'` (nada la pasa) y aunque llegara, su `curso_id` nulo
-- se leería como "devengado entero" de una fila vieja pre-multi-curso.
--
-- Esta migración solo agrega columnas y catálogo -- el cálculo (criterios
-- 1/2/3, las tres formas de pago, cortesía) vive en código nuevo
-- (`src/lib/liquidacion/particulares.ts`), sin base de datos, con sus
-- propias pruebas. Detalle completo de las decisiones de Javier en
-- `docs/DECISIONES.md`, fila "H5 — liquidación de particulares".
--
-- Idempotente y ADITIVO. Antes de aplicar en producción, medir de nuevo
-- cuántas particulares (pct_margen + descuenta_sala) no tienen foto de
-- costo de sala -- en dev dio 4 de 13 (test data), en producción 0 de 3.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PARÁMETRO -- `particular_vencida_modo` (decisión 4 de Javier).
--    Cómo pagan `pct_margen`/`monto_fijo` cuando una particular se completa
--    por VENCIMIENTO con horas sin usar ("lo no usado se pierde"). No
--    aplica a `fee_hora`, que siempre paga solo lo dado. Es política de la
--    academia, no una constante de código (regla de negocio 13).
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo, opciones)
select 'particular_vencida_modo', 'proporcional', 'texto',
       'Pago al vencer con horas sin usar',
       'Una membresía de particulares que vence con horas contratadas sin usar '
       '("lo no usado se pierde") se da por completada al vencer. "Proporcional" '
       'paga pct_margen/monto_fijo según las horas realmente dadas (realizada + '
       'ausente); "completo" paga el 100% igual, porque la academia ya cobró '
       'todo el paquete. fee_hora nunca cambia con este parámetro: siempre paga '
       'solo las horas dadas.',
       'Liquidación',
       '[{"valor":"proporcional","etiqueta":"Proporcional a lo dado"},
         {"valor":"completo","etiqueta":"Completo (100%)"}]'::jsonb
where not exists (select 1 from public.parametros where clave = 'particular_vencida_modo');

-- ---------------------------------------------------------------------
-- 2. MEMBRESIAS -- foto del costo de sala y del criterio al vender
--    (regla 12: editar el plan o la matriz de precios después no debe
--    mover cómo se liquida una particular ya vendida).
-- ---------------------------------------------------------------------
alter table public.membresias
  add column if not exists costo_sala_aplicado numeric(10,2)
    check (costo_sala_aplicado is null or costo_sala_aplicado >= 0),
  add column if not exists costo_sala_ruta text,
  add column if not exists criterio_liquidacion smallint
    check (criterio_liquidacion is null or criterio_liquidacion between 1 and 5),
  add column if not exists es_cortesia boolean not null default false;

comment on column public.membresias.costo_sala_aplicado is
  'Snapshot (H5): costo de sala calculado UNA VEZ al vender con la matriz de Precios, para la forma de pago pct_margen con pago_descuenta_sala. Sala externa = 0. Null si el plan no descuenta sala.';
comment on column public.membresias.costo_sala_ruta is
  'La coordenada legible del costo de sala ("Profesor Tropicana × Pareja × 4 h"), para auditar desde el comprobante sin recalcular.';
comment on column public.membresias.criterio_liquidacion is
  'Snapshot (H5) de planes.criterio_liquidacion al vender. Solo se usa en membresías sin curso (particulares); las de curso regular siguen leyendo el criterio del plan en vivo.';
comment on column public.membresias.es_cortesia is
  'Membresía TODA de cortesía (H5): precio_aplicado=0, no devenga nada, y cada reserva que se crea bajo ella nace en reservas_sala.es_cortesia=true. Solo se puede vender bajo un plan con permite_cortesia=true (se valida en servidor).';

-- Backfill: las particulares ya vendidas heredan el criterio de su plan tal
-- como está HOY. Es la única vez que se copia: de acá en más viaja con la
-- membresía, no con el plan.
update public.membresias m
set criterio_liquidacion = p.criterio_liquidacion
from public.planes p
where p.id = m.plan_id
  and m.curso_id is null
  and m.criterio_liquidacion is null;

-- Coherencia del costo de sala. NOT VALID a propósito: en dev hay filas de
-- prueba (pct_margen+descuenta_sala sin foto) anteriores a este hito; la
-- migración no las corrige a ciegas con un valor inventado. NOT VALID igual
-- protege toda escritura nueva desde ahora -- solo no valida las filas viejas.
alter table public.membresias
  drop constraint if exists membresias_costo_sala_coherente;
alter table public.membresias
  add constraint membresias_costo_sala_coherente
  check (
    forma_pago_profesor is distinct from 'pct_margen'
    or not pago_descuenta_sala
    or costo_sala_aplicado is not null
  ) not valid;

alter table public.membresias
  drop constraint if exists membresias_cortesia_precio_cero;
alter table public.membresias
  add constraint membresias_cortesia_precio_cero
  check (not es_cortesia or precio_aplicado = 0);

-- ---------------------------------------------------------------------
-- 3. PLANES -- gate único de cortesía (decisión 6 de Javier).
--    Sin esto en true, un plan no ofrece NINGUNA de las dos formas de
--    otorgar cortesía (ni reserva suelta en una membresía pagada, ni
--    membresía entera de cortesía). Mismo patrón que permite_sala_externa
--    (0057) y registra_acompanantes (0052).
-- ---------------------------------------------------------------------
alter table public.planes
  add column if not exists permite_cortesia boolean not null default false;

comment on column public.planes.permite_cortesia is
  'Solo aplica a tipo_servicio=particular: si el plan permite otorgar cortesías -- una reserva suelta de cortesía en una membresía pagada, o vender una membresía entera de cortesía (precio 0). Default false: ningún plan existente la tenía como decisión propia.';

-- ---------------------------------------------------------------------
-- 4. RESERVAS_SALA -- fuente de verdad única de la cortesía por reserva.
--    Tanto la cortesía ad-hoc como la de una membresía toda-cortesía
--    terminan seteando este campo: la lógica de saldo (`saldoMembresia`) y
--    de liquidación (`particulares.ts`) solo miran acá.
-- ---------------------------------------------------------------------
alter table public.reservas_sala
  add column if not exists es_cortesia boolean not null default false,
  add column if not exists cortesia_motivo text;

comment on column public.reservas_sala.es_cortesia is
  'H5: no devenga comisión para nadie ni descuenta el saldo de horas de la membresía (saldoMembresia la excluye). Sigue ocupando sala y profesor igual que cualquier reserva.';
comment on column public.reservas_sala.cortesia_motivo is
  'Glosa obligatoria cuando es_cortesia=true (quién la otorgó, por qué) -- mismo patrón que el motivo de suspensión o de reemplazo (regla de negocio 19/20).';

alter table public.reservas_sala
  drop constraint if exists reservas_cortesia_motivo_obligatorio;
alter table public.reservas_sala
  add constraint reservas_cortesia_motivo_obligatorio
  check (not es_cortesia or cortesia_motivo is not null);

-- ---------------------------------------------------------------------
-- 5. COMISIONES_DEVENGADAS -- convención para particulares.
--    curso_id se deja NULL (como hoy) y la comisión se distingue por
--    membresias.curso_id, NUNCA por curso_id IS NULL solo (una fila vieja
--    pre-multi-curso también lo tiene nulo). plan_id se escribe por
--    primera vez. criterio ya admite 1-5 desde 0052.
-- ---------------------------------------------------------------------
alter table public.comisiones_devengadas
  drop constraint if exists comisiones_devengadas_tipo_check;
alter table public.comisiones_devengadas
  add constraint comisiones_devengadas_tipo_check
  check (tipo in ('comision', 'referido', 'ajuste', 'avance'));

comment on column public.comisiones_devengadas.tipo is
  '`avance` (H5, solo criterio 2): el incremento de una particular por avance, va SIEMPRE al período que se está liquidando -- excepción explícita a la regla 16, ver docs/DECISIONES.md. Distinto de `ajuste`, que sí reabre el período de la comisión original.';
comment on column public.comisiones_devengadas.curso_id is
  'NULL = particular (ver membresias.curso_id) o fila vieja anterior a multi-curso -- se distinguen por membresias.curso_id, nunca por este campo solo.';

alter table public.comisiones_devengadas
  add column if not exists detalle_particular jsonb;

comment on column public.comisiones_devengadas.detalle_particular is
  'Foto del cálculo de una comisión de particular (H5): mismo patrón que `reparto` para cursos regulares -- el comprobante la lee, no recalcula (regla 12).';

alter table public.comisiones_devengadas
  drop constraint if exists comisiones_avance_solo_criterio2;
alter table public.comisiones_devengadas
  add constraint comisiones_avance_solo_criterio2
  check (tipo <> 'avance' or (criterio = 2 and curso_id is null));

alter table public.comisiones_devengadas
  drop constraint if exists comisiones_detalle_particular_solo_sin_curso;
alter table public.comisiones_devengadas
  add constraint comisiones_detalle_particular_solo_sin_curso
  check (detalle_particular is null or curso_id is null);

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0058
-- =====================================================================
