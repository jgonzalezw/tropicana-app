-- =====================================================================
-- TROPICANA - 0057: "Permite sala externa" como opción del plan particular
-- ---------------------------------------------------------------------
-- PARA QUE. Javier probó H2/H3 en dev y encontró que una membresía vendida
-- con sala propia no tenía forma de registrar, ni después ofrecer en
-- Reprogramar, el lugar externo (por ejemplo el salón de una boda). Y que
-- hoy CUALQUIER plan particular puede vender con sala externa, sin que sea
-- una decisión del plan.
--
-- Se agrega `planes.permite_sala_externa`, mismo patrón que
-- `registra_acompanantes` (0052). Arranca en `false` para todos los planes
-- existentes -- Javier confirmó que ninguna membresía de producción usa
-- sala externa hoy, así que no hay nada que migrar ni corregir en datos.
--
-- Los dos planes de boda que sí necesitan la opción se activan A MANO desde
-- Planes después de este pase (recordatorio en docs/ESTADO.md y en el
-- mensaje de cierre) -- no se identifican por nombre acá para no adivinar
-- cuáles son con una condición frágil en SQL.
--
-- Idempotente y ADITIVO: ningún dato de dominio se toca.
-- =====================================================================

alter table public.planes
  add column if not exists permite_sala_externa boolean not null default false;

comment on column public.planes.permite_sala_externa is
  'Solo aplica a tipo_servicio=particular: si el plan permite vender u ofrecer sala externa (con nombre descriptivo por membresía). Default false: ningún plan existente la tenía como decisión propia.';

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0057
-- =====================================================================
