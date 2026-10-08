-- Rollback de `corregir_bono_i010.sql`: devuelve las asistencias 121 y 143 y las
-- membresías 21 y 62 a su estado anterior y borra el bono creado.
-- El respaldo `resp_i010_previo` se conserva.
do $$
declare r record;
begin
  for r in select * from public.resp_i010_previo order by id desc loop
    if r.tipo = 'bono' then
      delete from public.membresia_bonos where id = r.fila_id;
    elsif r.tipo = 'asistencia' then
      update public.asistencias
         set estado = r.antes->>'estado', con_licencia = (r.antes->>'con_licencia')::boolean
       where id = r.fila_id;
    elsif r.tipo = 'membresia' then
      update public.membresias
         set clases_plan   = (r.antes->>'clases_plan')::int,
             fecha_inicio  = (r.antes->>'fecha_inicio')::date,
             fecha_fin     = (r.antes->>'fecha_fin')::date,
             clases_hechas = (r.antes->>'clases_hechas')::int,
             bono_generado = (r.antes->>'bono_generado')::int,
             bono_redimido = (r.antes->>'bono_redimido')::boolean
       where id = r.fila_id;
    end if;
  end loop;
end $$;
