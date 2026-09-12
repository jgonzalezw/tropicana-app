-- =====================================================================
-- TROPICANA - 0034: cuanto dura una clase (D6)
-- ---------------------------------------------------------------------
-- DECISION de Javier (2026-09-12): "Debes implementar la duracion de las
-- sesiones de cursos en el maestro de cursos, con eso se obtiene la hora
-- de fin."
--
-- POR QUE AHORA. Natalia necesita validar la disponibilidad de la sala, y
-- sin duracion no hay nada que validar: una clase "a las 19:00" no choca
-- con ninguna otra si no se sabe cuanto ocupa. `cursos.hora` existe desde
-- la 0005 y dice cuando EMPIEZA; faltaba la otra mitad.
--
-- LA HORA DE FIN NO SE GUARDA, SE CALCULA (hora + duracion). Guardar las
-- dos es tener el mismo hecho en dos campos que pueden contradecirse -la
-- confusion mas cara de este proyecto fue exactamente esa, dos campos
-- llamados "fin de ciclo"-. El glosario existe para no repetirla.
--
-- EL DEFAULT SALE DE UN PARAMETRO, NO DEL CODIGO (regla de negocio 13), y
-- nace aca y no a mano (regla de calidad 7). `duracion_clase_min` es lo
-- que la pantalla propone para un curso nuevo; cada curso puede tener la
-- suya.
--
-- Aditiva: los cursos existentes quedan con la duracion por defecto, que
-- es la unica que se puede suponer sin inventar un dato. Javier la
-- corrige curso por curso en la pantalla, igual que la vigencia (0033).
-- =====================================================================

alter table public.cursos
  add column if not exists duracion_min integer;

update public.cursos set duracion_min = 60 where duracion_min is null;

alter table public.cursos
  alter column duracion_min set default 60,
  alter column duracion_min set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cursos_duracion_valida') then
    alter table public.cursos
      add constraint cursos_duracion_valida
      check (duracion_min > 0 and duracion_min <= 600);
  end if;
end $$;

comment on column public.cursos.duracion_min is
  'Cuanto dura una clase de este curso, en minutos. La hora de fin se '
  'CALCULA (hora + duracion_min); no se guarda, para no tener el mismo '
  'hecho en dos campos que puedan contradecirse.';

-- El default que la pantalla propone para un curso nuevo. Lista cerrada
-- de opciones (regla de calidad 6): se elige, no se escribe.
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo, opciones)
select 'duracion_clase_min', '60', 'numero', 'Duracion de una clase (minutos)',
       'Lo que la pantalla de Cursos propone al crear un curso nuevo. Cada curso puede tener la suya.',
       'Cursos',
       '[{"valor":"45","etiqueta":"45 minutos"},
         {"valor":"60","etiqueta":"1 hora"},
         {"valor":"75","etiqueta":"1 hora 15"},
         {"valor":"90","etiqueta":"1 hora 30"},
         {"valor":"120","etiqueta":"2 horas"}]'::jsonb
 where not exists (select 1 from public.parametros where clave = 'duracion_clase_min');

update public.parametros
   set grupo = 'Cursos',
       tipo = 'numero',
       opciones = '[{"valor":"45","etiqueta":"45 minutos"},
                    {"valor":"60","etiqueta":"1 hora"},
                    {"valor":"75","etiqueta":"1 hora 15"},
                    {"valor":"90","etiqueta":"1 hora 30"},
                    {"valor":"120","etiqueta":"2 horas"}]'::jsonb,
       descripcion = 'Lo que la pantalla de Cursos propone al crear un curso nuevo. Cada curso puede tener la suya.'
 where clave = 'duracion_clase_min';

notify pgrst, 'reload schema';
