-- =====================================================================
-- TROPICANA - 0043: visibilidad de datos por rol y modulo (propio / todo)
-- ---------------------------------------------------------------------
-- PARA QUE. Un rol con permiso a un modulo hoy ve TODAS las filas, no solo
-- las propias: un Profesor en Tomar Asistencia ve todos los cursos, y si se
-- le habilita Liquidaciones veria las de todos (incluso por URL directa);
-- un Asistente en Caja ve/suma los movimientos de todos. Javier (2026-09-17)
-- pidio que el profesor vea "solo datos propios" y que la caja del asistente
-- quede aislada.
--
-- La primera idea era hardcodear "si el rol no es admin/gerente/asistente,
-- filtra a lo propio", pero eso CABLEA las claves de rol en la logica -- y
-- Gerente/Asistente ya venian quedando pegados al sistema. La unica clave
-- cableada hoy es 'administrador'. En vez de agregar mas, se agrega una
-- dimension CONFIGURABLE: el alcance de visibilidad por (rol, modulo).
--
-- QUE HACE
-- 1. Tabla `rol_visibilidad (rol_id, modulo, alcance)`. `alcance` = 'propio'
--    o 'todo'. La AUSENCIA de fila significa 'todo' (retrocompatible: sin
--    esta config, todo se ve como hasta hoy). Es por (rol, modulo), no por
--    accion: no hay distinta visibilidad para ver vs editar.
-- 2. RLS espejo de rol_permisos (lectura a autenticados, escritura admin).
-- 3. Seed de los defaults del producto, por `clave` (es DATO de config, no
--    logica -- mismo criterio que 0038/0041). Solo se siembran restricciones
--    ('propio'); lo demas queda en el default 'todo'.
--
-- Los modulos que consultan esta dimension son un conjunto acotado
-- (asistencia, liquidaciones, caja: los que tienen "dueno" de la fila),
-- definido en el codigo (MODULOS_CON_ALCANCE). Los demas la ignoran.
--
-- Idempotente y ADITIVA.
-- =====================================================================

create table if not exists public.rol_visibilidad (
  rol_id  bigint not null references public.roles(id) on delete cascade,
  modulo  text not null,
  alcance text not null default 'todo' check (alcance in ('propio', 'todo')),
  primary key (rol_id, modulo)
);

alter table public.rol_visibilidad enable row level security;

drop policy if exists rol_visibilidad_select on public.rol_visibilidad;
create policy rol_visibilidad_select on public.rol_visibilidad
  for select to authenticated using (true);
drop policy if exists rol_visibilidad_admin_write on public.rol_visibilidad;
create policy rol_visibilidad_admin_write on public.rol_visibilidad
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Defaults del producto. El Profesor no ve datos que no son propios; el
-- Asistente maneja su propia caja. Todo lo demas queda en 'todo' por default.
insert into public.rol_visibilidad (rol_id, modulo, alcance)
select r.id, v.modulo, 'propio'
from public.roles r
cross join (values
  ('profesor',  'asistencia'),
  ('profesor',  'liquidaciones'),
  ('asistente', 'caja')
) as v(clave, modulo)
where r.clave = v.clave
on conflict (rol_id, modulo) do nothing;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0043
-- =====================================================================
