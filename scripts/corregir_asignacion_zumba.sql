-- =============================================================================
-- Tropicana — adelanta la asignación vigente de Zumba a su primera clase real
--
-- Zumba dio clase desde el 18/08, pero su titular figura desde el 31/08: las
-- clases del 18, 20, 25 y 27/08 quedaban sin titular, y una clase sin titular
-- no se le paga a nadie (regla 10). El informe de pre-liquidación las marcó.
--
-- Decisión de Javier (2026-10-01): "se debe corregir igual que las otras
-- correcciones adelantando la fecha de asignación" (misma regla que se aplicó a
-- Bachata Conexión, Heels y Ladies en `corregir_datos_inicio.sql`).
--
-- Busca por nombre de curso, no por id. Una sola transacción: termina en
-- ROLLBACK (ensayo en seco); para aplicar de verdad, cambiar por `commit`.
-- Aborta si no encuentra exactamente lo esperado. Respaldo:
-- `asignaciones_previo_zumba`.
-- =============================================================================

begin;

create table public.asignaciones_previo_zumba as select * from public.asignaciones;

create temp table _fix on commit drop as
select a.id, a.desde as desde_antes,
       (select min(s.fecha) from public.sesiones s where s.curso_id = a.curso_id) as desde_nuevo
from public.asignaciones a
join public.cursos c on c.id = a.curso_id
where c.nombre = 'Zumba' and a.hasta is null;

do $$
declare n int; malos int;
begin
  select count(*), count(*) filter (where desde_nuevo is null or desde_nuevo >= desde_antes)
    into n, malos from _fix;
  if n <> 1 then raise exception 'Se esperaba 1 asignación vigente de Zumba y hay %', n; end if;
  if malos > 0 then raise exception 'Zumba no tiene una primera sesión anterior a su desde actual: nada que adelantar'; end if;
end $$;

update public.asignaciones a set desde = f.desde_nuevo from _fix f where a.id = f.id;

select f.id, f.desde_antes::text as antes, a.desde::text as despues,
       (select count(*) from public.asignaciones a2 join public.asignaciones_previo_zumba p using (id)
         where a2.* is distinct from p.*) as filas_cambiadas
from _fix f join public.asignaciones a on a.id = f.id;

rollback;  -- ensayo en seco. Para aplicar de verdad: cambiar por `commit;`
