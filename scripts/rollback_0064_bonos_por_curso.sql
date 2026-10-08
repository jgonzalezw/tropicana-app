-- Rollback de 0064 (bono por curso, I-003). Restaura el resumen de cada
-- membresia desde el respaldo y borra la tabla nueva. Si ya hubo ventas que
-- redimieron bonos por curso, esas filas se pierden: revisar antes
-- `select * from membresia_bonos where aplicado in ('clases','ilimitado')`.
update public.membresias m
   set bono_generado = p.bono_generado, bono_redimido = p.bono_redimido
  from public.bono_previo_0064 p
 where p.membresia_id = m.id;
drop table if exists public.membresia_bonos;
-- bono_previo_0064 se conserva hasta confirmar el pase.
notify pgrst, 'reload schema';
