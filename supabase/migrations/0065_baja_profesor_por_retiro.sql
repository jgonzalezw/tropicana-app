-- =====================================================================
-- TROPICANA - 0065: un profesor se da de baja por Retirar (control 48)
-- ---------------------------------------------------------------------
-- El control 48 cuenta profesores inactivos con una asignacion abierta
-- (titular vigente de un curso). Solo se llega ahi desactivando al profesor
-- a mano: eso apaga `activo` y no cierra asignaciones ni hace el cierre de
-- cuentas. `retirar_profesor` (0063) hace todo junto, pero el boton viejo lo
-- esquivaba.
--
-- Esta migracion lo garantiza en la base, no solo en la pantalla:
--   1. no se inactiva un profesor con asignaciones abiertas;
--   2. no se abre una asignacion para un profesor inactivo.
-- `retirar_profesor` cierra las asignaciones antes de inactivar: no choca.
-- Las filas que ya violan (control 48) no se tocan: se corrigen con la
-- pantalla Retirar. Los triggers solo miran lo que cambia.
-- =====================================================================

create or replace function public.profesor_baja_sin_asignaciones()
returns trigger
language plpgsql
as $$
begin
  if new.activo = false and old.activo is distinct from false
     and exists (select 1 from public.asignaciones a where a.profesor_id = new.id and a.hasta is null) then
    raise exception 'El profesor tiene cursos a cargo: se da de baja con Retirar, que cierra sus asignaciones y su cuenta.';
  end if;
  return new;
end;
$$;

drop trigger if exists profesores_baja_trg on public.profesores;
create trigger profesores_baja_trg
  before update of activo on public.profesores
  for each row execute function public.profesor_baja_sin_asignaciones();

create or replace function public.asignacion_a_profesor_activo()
returns trigger
language plpgsql
as $$
begin
  if new.hasta is null
     and exists (select 1 from public.profesores p where p.id = new.profesor_id and p.activo = false) then
    raise exception 'No se asigna un curso a un profesor inactivo.';
  end if;
  return new;
end;
$$;

drop trigger if exists asignaciones_profesor_activo_trg on public.asignaciones;
create trigger asignaciones_profesor_activo_trg
  before insert on public.asignaciones
  for each row execute function public.asignacion_a_profesor_activo();
