-- =====================================================================
-- TROPICANA - 0039: intervalo estandar de tiempo (item 3, Javier 2026-09-16)
-- ---------------------------------------------------------------------
-- PEDIDO: "usar siempre y como estandar el intervalo en minutos en
-- parametro: Tiempos en Incrementos en minutos... default 30 min, opciones
-- 30min (default) y 1hr. Gobierna: a) duracion minima de un curso; b)
-- duracion de sesion; c) uso de paquetes; d) intervalos de calendario de
-- sala. Cualquier otro parametro de tiempos que se necesite mantiene el
-- mismo criterio."
--
-- DOS PARAMETROS NUEVOS, UN SOLO CRITERIO:
--   `tiempos_incremento_min`     -- el paso: 30 (default) o 60 minutos.
--   `duracion_minima_curso_min`  -- el piso: ninguna clase dura menos.
--
-- LA DURACION DE UN CURSO deja de escribirse a mano (regla de calidad 6: un
-- valor con alternativas se elige de una lista) y pasa a elegirse de una
-- lista de multiplos del incremento -- calculada en el codigo a partir de
-- estos dos parametros, no guardada como una tercera lista que se
-- desincroniza si el incremento cambia (ver `duracion_clase_min` abajo).
--
-- `duracion_clase_min` (0034) SE DA DE BAJA. Proponia un valor por defecto
-- para un curso nuevo con una lista fija {45,60,75,90,120} -- 45 y 75 NO son
-- multiplos de 30 ni de 60: es exactamente la inconsistencia que este item
-- viene a cerrar. Dos parametros separados para "el default" y "las
-- alternativas" se pueden desincronizar entre si; con el incremento y el
-- minimo alcanza, y el default para un curso nuevo pasa a ser el minimo.
--
-- "USO DE PAQUETES" (particulares/alquiler, C2/C3) todavia no tiene
-- pantalla -- no hay nada que migrar ni validar hoy. Queda anotado en
-- DECISIONES.md que cuando se construya, reusa `tiempos_incremento_min`.
--
-- Los cursos existentes no se tocan: ninguno cambia de duracion por esta
-- migracion (los 9 activos ya estan en 60 min, multiplo de las dos
-- opciones). Idempotente y ADITIVA.
-- =====================================================================

insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo, opciones)
select 'tiempos_incremento_min', '30', 'numero', 'Tiempos en incrementos (minutos)',
       'El paso con el que se cargan duraciones y horarios en toda la app: '
       'duración de curso, horario de sala, y en adelante uso de paquetes. '
       'Cambiar esto no reescribe lo ya cargado.',
       'Tiempos',
       '[{"valor":"30","etiqueta":"30 minutos"},
         {"valor":"60","etiqueta":"1 hora"}]'::jsonb
where not exists (select 1 from public.parametros where clave = 'tiempos_incremento_min');

insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo)
select 'duracion_minima_curso_min', '30', 'numero', 'Duración mínima de una clase (minutos)',
       'Ninguna clase puede durar menos que esto. Tiene que ser múltiplo del '
       'incremento de tiempos.',
       'Tiempos'
where not exists (select 1 from public.parametros where clave = 'duracion_minima_curso_min');

-- `duracion_clase_min` (0034) queda de baja: su lista de opciones ya no
-- gobierna nada (la duracion del curso ahora se deriva del incremento +
-- minimo, en el codigo). No se elimina la fila -- borrar un parametro que
-- pueda estar guardado en un lugar que no se revise en esta migracion es
-- mas riesgoso que dejarlo inerte -- se limpian sus opciones y se marca en
-- la descripcion, para que quien mire la pantalla de Parametros entienda
-- que no hace nada.
update public.parametros
   set opciones = null,
       descripcion = 'DADO DE BAJA (migración 0039): la duración de un curso nuevo ahora se '
                      'propone desde "duración mínima de una clase" + "tiempos en incrementos".'
 where clave = 'duracion_clase_min';

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0039
-- =====================================================================
