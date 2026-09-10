-- =====================================================================
-- TROPICANA - habilitar una liquidacion de PRUEBA en dev (2026-09-10)
-- ---------------------------------------------------------------------
-- SOLO PARA tropicana-dev. Contexto: Liquidaciones solo devenga membresias
-- con estado='completada', plan_id no nulo, fecha_fin no nula y <= el
-- ULTIMO DIA DEL MES ANTERIOR al de hoy ("mes vencido", ver finMesVencidoISO
-- en liquidaciones/acciones.ts). Revisado en dev el 2026-09-10:
--   - Los alumnos de prueba (Aguilar, Vargas, Rodriguez, Delgadillo, Rubin,
--     etc.) YA tienen sus cuotas pagadas (no falta plata) -- el bloqueo real
--     es que ninguna membresia llego a las N clases (estado sigue 'activa').
--   - Ademas, esas membresias vienen del seed scripts/setup_dev_full.sql,
--     que a proposito NO calcula fecha_fin (ver su comentario ahi). Aunque
--     se completen las N clases, sin fecha_fin nunca van a aparecer en
--     Liquidaciones.
--   - El seed scripts/seed_demo_liquidacion.sql SI sirve, pero pone
--     fecha_fin = current_date (hoy): si lo corres cualquier dia que no sea
--     el ultimo del mes vencido, tampoco va a aparecer todavia.
--
-- Esta script no reemplaza esos seeds: los complementa. Dos bloques
-- independientes, corre el que te sirva (o los dos):
--
--   BLOQUE A: corrige la fecha_fin del seed generico (Demo Alumno) para que
--             caiga dentro del mes vencido -- correlo DESPUES de
--             seed_demo_liquidacion.sql.
--   BLOQUE B: completa una membresia REAL de prueba (Vargas, Marilyn -
--             Salsa y Bachata Inicial, plan N=8, ya pagada) simulando que
--             llego a sus 8 clases -- sin insertar 8 sesiones falsas, al
--             mismo nivel de "simulado" que ya usa seed_demo_liquidacion.sql
--             para su unica clase.
--
-- Ambos son re-corribles (vuelven a fijar los mismos valores, no duplican).
-- =====================================================================

-- ---------------------------------------------------------------------
-- BLOQUE A: backdatear el seed generico de Demo Alumno al mes vencido.
-- ---------------------------------------------------------------------
do $$
declare
  v_insc bigint;
  v_fecha_fin date := (date_trunc('month', current_date - interval '1 month')::date + 19);
begin
  select i.id into v_insc
  from public.inscripciones i
  join public.alumnos a on a.id = i.alumno_id
  where a.nombre = 'Demo' and a.apellido = 'Alumno'
  limit 1;

  if v_insc is null then
    raise notice 'BLOQUE A: no encontre la membresia de Demo Alumno -- corre primero scripts/seed_demo_liquidacion.sql';
  else
    update public.inscripciones set fecha_fin = v_fecha_fin where id = v_insc;
    raise notice 'BLOQUE A: membresia % (Demo Alumno) con fecha_fin=% -- ya deberia aparecer en Liquidaciones', v_insc, v_fecha_fin;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- BLOQUE B: completar una membresia real de prueba (Vargas, Marilyn).
-- ---------------------------------------------------------------------
do $$
declare
  v_insc bigint;
  v_fecha_fin date := (date_trunc('month', current_date - interval '1 month')::date + 19);
begin
  select i.id into v_insc
  from public.inscripciones i
  join public.alumnos a on a.id = i.alumno_id
  join public.cursos c on c.id = i.curso_id
  where a.nombre = 'Marilyn' and a.apellido = 'Vargas'
    and c.nombre = 'Salsa y Bachata Inicial'
    and i.estado = 'activa'
  limit 1;

  if v_insc is null then
    raise notice 'BLOQUE B: no encontre una membresia activa de Marilyn Vargas en Salsa y Bachata Inicial (ya se corrio antes, o cambio el dato de prueba)';
  else
    update public.inscripciones
      set clases_hechas = clases_plan,
          estado = 'completada',
          fecha_fin = v_fecha_fin,
          actualizado_en = now()
      where id = v_insc;
    raise notice 'BLOQUE B: membresia % (Marilyn Vargas) marcada completada, fecha_fin=% -- ya deberia aparecer en Liquidaciones', v_insc, v_fecha_fin;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- LIMPIEZA (correr manualmente si queres deshacer el BLOQUE B):
-- ---------------------------------------------------------------------
-- update public.inscripciones i set clases_hechas = 4, estado = 'activa', fecha_fin = null
--   from public.alumnos a, public.cursos c
--   where i.alumno_id = a.id and i.curso_id = c.id
--   and a.nombre = 'Marilyn' and a.apellido = 'Vargas' and c.nombre = 'Salsa y Bachata Inicial';
-- =====================================================================
