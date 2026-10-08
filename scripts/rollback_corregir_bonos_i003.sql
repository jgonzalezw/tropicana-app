-- Rollback de `corregir_bonos_i003.sql`: devuelve cada membresía destino a su
-- estado anterior, libera el bono y borra la asistencia que el script registró.
-- El respaldo `bono_correccion_i003_previo` se conserva.
do $$
declare r record;
begin
  for r in select * from public.bono_correccion_i003_previo order by id desc loop
    update public.membresias m
       set clases_plan   = (r.destino_antes->>'clases_plan')::int,
           fecha_inicio  = (r.destino_antes->>'fecha_inicio')::date,
           fecha_fin     = (r.destino_antes->>'fecha_fin')::date,
           clases_hechas = (r.destino_antes->>'clases_hechas')::int
     where m.id = r.destino;
    update public.membresia_bonos set aplicado = null, redimido_en_membresia_id = null where id = r.bono_id;
    update public.membresias set bono_redimido = false where id = r.origen;
    if r.asistencia_creada is not null then
      delete from public.asistencias where id = r.asistencia_creada;
    end if;
  end loop;
end $$;
