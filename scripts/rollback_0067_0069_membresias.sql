-- Rollback del pase de I-012 (migraciones 0067 membresias_nuevas, 0068 menu_plegable,
-- 0069 reagenda_de). Se corre DENTRO de una transacción (begin ... commit): el ensayo
-- en seco termina en rollback.
--
-- Orden del rollback completo: (1) revert del merge del PR #41 (código), (2) este script.
-- Respaldo: reservas_sala_previo_0069 (copia de reservas_sala justo antes de migrar) y
-- parametros_previo_0069 (copia de parametros). Se conservan hasta que Javier confirme el pase.
--
-- 1. Restaura las reservas que cambiaron después del pase (fecha, hora, sala, estado, etc.)
--    a como estaban en el respaldo. `rango` y `ocupa_sala` los recalcula la base.
--    Las reservas hechas después del pase (id mayor al del respaldo) NO se tocan: son
--    reservas válidas también para el código viejo (el historial es de solo agregar);
--    el paso 2 las lista para revisarlas a mano.
update public.reservas_sala r
   set sala_id = p.sala_id, tipo = p.tipo, motivo = p.motivo, fecha = p.fecha, hora = p.hora,
       duracion_min = p.duracion_min, estado = p.estado, glosa = p.glosa, notas = p.notas,
       membresia_id = p.membresia_id, profesor_id = p.profesor_id, plan_id = p.plan_id,
       solicitada_hasta = p.solicitada_hasta, cambio_motivo = p.cambio_motivo,
       cambio_glosa = p.cambio_glosa, cambio_fuera_de_plazo = p.cambio_fuera_de_plazo,
       suspendida_por_excepcion_id = p.suspendida_por_excepcion_id,
       suspendida_por_bloqueo_id = p.suspendida_por_bloqueo_id,
       revierte_reserva_id = p.revierte_reserva_id, es_cortesia = p.es_cortesia,
       cortesia_motivo = p.cortesia_motivo
  from public.reservas_sala_previo_0069 p
 where p.id = r.id
   and (r.sala_id, r.tipo, r.motivo, r.fecha, r.hora, r.duracion_min, r.estado, r.glosa, r.notas,
        r.membresia_id, r.profesor_id, r.plan_id, r.solicitada_hasta, r.cambio_motivo, r.cambio_glosa,
        r.cambio_fuera_de_plazo, r.suspendida_por_excepcion_id, r.suspendida_por_bloqueo_id,
        r.revierte_reserva_id, r.es_cortesia, r.cortesia_motivo)
       is distinct from
       (p.sala_id, p.tipo, p.motivo, p.fecha, p.hora, p.duracion_min, p.estado, p.glosa, p.notas,
        p.membresia_id, p.profesor_id, p.plan_id, p.solicitada_hasta, p.cambio_motivo, p.cambio_glosa,
        p.cambio_fuera_de_plazo, p.suspendida_por_excepcion_id, p.suspendida_por_bloqueo_id,
        p.revierte_reserva_id, p.es_cortesia, p.cortesia_motivo);

-- 2. Reservas posteriores al pase: se listan, no se tocan.
select r.id, r.estado, r.fecha, r.hora, r.membresia_id, r.reagenda_de
  from public.reservas_sala r
 where r.id > (select max(id) from public.reservas_sala_previo_0069)
 order by r.id;

-- 3. Estructura: 0069 (reagenda_de) y los interruptores 0067 y 0068.
drop index if exists public.reservas_sala_reagenda_de_uq;
alter table public.reservas_sala drop column if exists reagenda_de;
delete from public.parametros where clave in ('membresias_nuevas', 'menu_plegable');
notify pgrst, 'reload schema';

-- 4. Verificación (todas deben dar 0): reservas del respaldo distintas a su estado de antes.
select count(*) as filas_distintas_al_respaldo
  from public.reservas_sala r
  join public.reservas_sala_previo_0069 p on p.id = r.id
 where (r.sala_id, r.fecha, r.hora, r.duracion_min, r.estado, r.membresia_id)
       is distinct from (p.sala_id, p.fecha, p.hora, p.duracion_min, p.estado, p.membresia_id);
-- reservas_sala_previo_0069 y parametros_previo_0069 se conservan hasta confirmar el pase;
-- después se borran con `drop table`.
