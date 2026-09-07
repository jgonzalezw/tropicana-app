-- =====================================================================
-- TROPICANA - seed de DEMO para probar el circuito de LIQUIDACION (dev)
-- ---------------------------------------------------------------------
-- SOLO PARA tropicana-dev. Deja listo un escenario minimo para probar
-- Liquidaciones de punta a punta:
--   - profesor "Demo Profe" con asignacion 50% en un curso demo
--   - plan "DEMO Plan 1 clase" (N=1) sobre ese curso
--   - alumno "Demo Alumno" con una MEMBRESIA completada + cobrada (Bs 200)
--   - su cuota pagada + una sesion dictada con asistencia
-- Resultado: en la pantalla Liquidaciones, "Demo Profe" aparece por liquidar
-- con devengado = 50% de 200 = 100. Podes Generar -> Pagar -> Comprobante.
--
-- Idempotente: se puede correr varias veces (no duplica). Solo ASCII.
-- Para limpiar la demo, ver el bloque comentado al final.
-- =====================================================================

do $$
declare
  v_prof  bigint;
  v_curso bigint;
  v_plan  bigint;
  v_al    bigint;
  v_insc  bigint;
  v_cuota bigint;
  v_ses   bigint;
  v_precio numeric := 200;
begin
  -- Profesor demo
  select id into v_prof from public.profesores where nombre = 'Demo' and apellido = 'Profe' limit 1;
  if v_prof is null then
    insert into public.profesores (nombre, apellido, tipo)
      values ('Demo', 'Profe', 'activo') returning id into v_prof;
  end if;

  -- Curso demo (1 dia: lunes)
  select id into v_curso from public.cursos where nombre = 'DEMO Salsa Liquidacion' limit 1;
  if v_curso is null then
    insert into public.cursos (nombre, dias_semana, precio_mensual, activo)
      values ('DEMO Salsa Liquidacion', '{1}', v_precio, true) returning id into v_curso;
  end if;

  -- Asignacion vigente (profesor 50%)
  if not exists (select 1 from public.asignaciones where curso_id = v_curso and hasta is null) then
    insert into public.asignaciones (curso_id, profesor_id, pct_ingresos)
      values (v_curso, v_prof, 50);
  end if;

  -- Plan N=1 sobre el curso demo
  select id into v_plan from public.planes where nombre = 'DEMO Plan 1 clase' limit 1;
  if v_plan is null then
    insert into public.planes
      (nombre, tipo_servicio, curso_id, cantidad_clases, precio, criterio_liquidacion, acceso_modo, clases_ilimitadas)
      values ('DEMO Plan 1 clase', 'curso_regular', v_curso, 1, v_precio, 1, 'solo', false)
      returning id into v_plan;
  end if;
  if not exists (select 1 from public.plan_cursos where plan_id = v_plan and curso_id = v_curso) then
    insert into public.plan_cursos (plan_id, curso_id) values (v_plan, v_curso);
  end if;

  -- Alumno demo
  select id into v_al from public.alumnos where nombre = 'Demo' and apellido = 'Alumno' limit 1;
  if v_al is null then
    insert into public.alumnos (nombre, apellido) values ('Demo', 'Alumno') returning id into v_al;
  end if;

  -- Membresia completada
  select id into v_insc from public.inscripciones where alumno_id = v_al and plan_id = v_plan limit 1;
  if v_insc is null then
    insert into public.inscripciones
      (alumno_id, curso_id, modalidad, fecha_inicio, estado, plan_id, clases_plan, clases_hechas, ciclo_numero, precio_aplicado, fecha_fin)
      values (v_al, v_curso, 'mensual', current_date, 'completada', v_plan, 1, 1, 1, v_precio, current_date)
      returning id into v_insc;
    insert into public.inscripcion_cursos (inscripcion_id, curso_id, dias) values (v_insc, v_curso, '{1}');
  end if;

  -- Cuota pagada (cobrada) + pago
  select id into v_cuota from public.cuotas where inscripcion_id = v_insc limit 1;
  if v_cuota is null then
    insert into public.cuotas
      (inscripcion_id, periodo, monto_devengado, descuento_adelanto, vencimiento, fecha_compromiso, estado)
      values (v_insc, date_trunc('month', current_date)::date, v_precio, 0, current_date, null, 'pagada')
      returning id into v_cuota;
    insert into public.pagos (tipo, motivo, alumno_id, inscripcion_id, cuota_id, monto, medio)
      values ('cobro', 'cuota', v_al, v_insc, v_cuota, v_precio, 'Efectivo');
  end if;

  -- Sesion dictada + asistencia (realismo del contador)
  select id into v_ses from public.sesiones where curso_id = v_curso and fecha = current_date limit 1;
  if v_ses is null then
    insert into public.sesiones (curso_id, fecha, estado, profesor_id)
      values (v_curso, current_date, 'dictada', v_prof) returning id into v_ses;
  end if;
  if not exists (select 1 from public.asistencias where sesion_id = v_ses and alumno_id = v_al) then
    insert into public.asistencias (sesion_id, alumno_id, inscripcion_id, estado)
      values (v_ses, v_al, v_insc, 'presente');
  end if;

  raise notice 'DEMO liquidacion lista: profesor=% curso=% plan=% alumno=% membresia=% (devengado esperado: 100)',
    v_prof, v_curso, v_plan, v_al, v_insc;
end $$;

-- ---------------------------------------------------------------------
-- LIMPIEZA de la demo (correr manualmente si querés borrarla):
-- ---------------------------------------------------------------------
-- delete from public.pagos where inscripcion_id in (select id from public.inscripciones where curso_id in (select id from public.cursos where nombre='DEMO Salsa Liquidacion'));
-- delete from public.asistencias where sesion_id in (select id from public.sesiones where curso_id in (select id from public.cursos where nombre='DEMO Salsa Liquidacion'));
-- delete from public.sesiones where curso_id in (select id from public.cursos where nombre='DEMO Salsa Liquidacion');
-- delete from public.cuotas where inscripcion_id in (select id from public.inscripciones where curso_id in (select id from public.cursos where nombre='DEMO Salsa Liquidacion'));
-- delete from public.inscripcion_cursos where inscripcion_id in (select id from public.inscripciones where curso_id in (select id from public.cursos where nombre='DEMO Salsa Liquidacion'));
-- delete from public.inscripciones where curso_id in (select id from public.cursos where nombre='DEMO Salsa Liquidacion');
-- delete from public.plan_cursos where plan_id in (select id from public.planes where nombre='DEMO Plan 1 clase');
-- delete from public.planes where nombre='DEMO Plan 1 clase';
-- delete from public.asignaciones where curso_id in (select id from public.cursos where nombre='DEMO Salsa Liquidacion');
-- delete from public.cursos where nombre='DEMO Salsa Liquidacion';
-- delete from public.alumnos where nombre='Demo' and apellido='Alumno';
-- delete from public.profesores where nombre='Demo' and apellido='Profe';
-- =====================================================================
