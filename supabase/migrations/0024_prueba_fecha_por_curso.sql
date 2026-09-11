-- =====================================================================
-- TROPICANA - 0024: la clase de prueba elige una fecha POR CURSO
-- ---------------------------------------------------------------------
-- EL PROBLEMA (Javier, 2026-09-11, probando la prueba de 2 cursos)
--
--   "No me queda claro como registraria pruebas pasadas si los cursos no
--    tuvieran clases coincidentes en el mismo dia de la fecha."
--
-- Tenia razon. Una membresia guarda UNA `fecha_inicio`, y el fin de ciclo
-- se calcula caminando el calendario desde ahi. Para una membresia regular
-- eso alcanza: el ciclo es un periodo continuo y el alumno va a todas las
-- clases de sus cursos. Una prueba no: es **una clase suelta en cada curso**,
-- y esas clases caen en dias distintos. Con una sola fecha, el segundo curso
-- quedaba donde el calendario lo dejara — y para una prueba PASADA podia
-- quedar en el futuro, que es un absurdo.
--
-- LA DECISION (Javier): pedir una fecha por curso.
--
-- POR QUE UNA COLUMNA Y NO REUSAR `dias`
--
-- Se podria haber guardado el dia de la semana de la clase elegida en `dias`
-- y dejar que el motor camine hasta la primera ocurrencia. No sirve: un dia
-- de la semana se repite, y si el vendedor elige la clase del lunes 21 (no la
-- del lunes 14), el motor aterrizaria en el 14. La fecha elegida es un HECHO,
-- no algo derivable: va guardada.
--
-- `dias` se conserva con los dias reales del curso, no con el de la clase
-- elegida: es lo que le permite al motor correr la prueba a la clase
-- siguiente si la elegida se suspende (regla de negocio 4).
--
-- Es aditiva: `fecha` es NULL en toda membresia regular, que sigue
-- funcionando por `fecha_inicio` + `dias` como hasta ahora.
-- =====================================================================

alter table public.inscripcion_cursos
  add column if not exists fecha date;

comment on column public.inscripcion_cursos.fecha is
  'Solo para membresias de prueba: la fecha exacta de la unica clase de ese '
  'curso, elegida al vender. NULL en una membresia regular, donde las clases '
  'salen de fecha_inicio + dias. Se guarda porque un dia de la semana se '
  'repite y la clase elegida puede no ser la primera ocurrencia.';

-- Backfill de las pruebas ya vendidas con el modelo de una sola fecha: su
-- clase de cada curso es la primera del curso desde el inicio de la
-- membresia que no este suspendida. Es exactamente lo que el motor venia
-- calculando, asi que el dato no cambia: solo se hace explicito.
with dias_prueba as (
  select ic.id as ic_id,
         (select min(d.dia)
            from (
              select gs::date as dia
                from generate_series(i.fecha_inicio,
                                     i.fecha_inicio + interval '120 days',
                                     interval '1 day') gs
            ) d
           where extract(isodow from d.dia)::int = any(ic.dias)
             and not exists (select 1 from public.sesiones s
                              where s.curso_id = ic.curso_id
                                and s.fecha = d.dia
                                and s.estado = 'suspendida')
         ) as fecha_clase
    from public.inscripcion_cursos ic
    join public.inscripciones i on i.id = ic.inscripcion_id
   where i.es_prueba
     and ic.fecha is null
     and ic.dias is not null
     and array_length(ic.dias, 1) > 0
)
update public.inscripcion_cursos ic
   set fecha = dp.fecha_clase
  from dias_prueba dp
 where ic.id = dp.ic_id
   and dp.fecha_clase is not null;

-- La fecha_inicio de una prueba pasa a ser la de su PRIMERA clase. Antes era
-- la fecha de la venta, que para una prueba no significa nada: la membresia
-- dura exactamente lo que sus clases. Se salta cualquier membresia ya
-- devengada (regla de negocio 5: una fecha ya liquidada no se mueve sola).
update public.inscripciones i
   set fecha_inicio = f.primera,
       fecha_fin = f.ultima,
       actualizado_en = now()
  from (
    select ic.inscripcion_id, min(ic.fecha) as primera, max(ic.fecha) as ultima
      from public.inscripcion_cursos ic
     where ic.fecha is not null
     group by ic.inscripcion_id
  ) f
 where i.id = f.inscripcion_id
   and i.es_prueba
   and (i.fecha_inicio is distinct from f.primera or i.fecha_fin is distinct from f.ultima)
   and not exists (select 1 from public.comisiones_devengadas cd
                    where cd.membresia_id = i.id);

notify pgrst, 'reload schema';
