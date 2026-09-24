-- =====================================================================
-- TROPICANA - 0049: sexo como campo de la matriz de minimos (C3-0a.3)
-- ---------------------------------------------------------------------
-- PARA QUE. `contactos.sexo` existe desde la 0048, con su catalogo
-- 'sexo' (femenino/masculino/otro/prefiere_no_decirlo) ya sembrado y
-- editable en Catalogos -- pero nunca hubo forma de CARGARLO: no estaba
-- entre los 15 campos originales de `matriz_minimos`, asi que ningun
-- formulario lo mostraba. Javier lo encontro probando C3-0a.3 (alta de
-- alumno): "no hay como llenar el campo sexo del contacto, y no aparece
-- en la grilla de minimos".
--
-- QUE HACE. Agrega 'sexo' como campo #16, una fila por contexto (9),
-- igual patron que el resto de la matriz: nivel por defecto, editable
-- despues desde Administracion -> Catalogos -> Matriz de minimos. Se
-- deja visible-opcional solo para alumno adulto -- es el caso medido
-- hoy; el resto se puede activar despues sin migracion, cambiando la
-- celda. No es un campo bloqueado (no hay logica del sistema que
-- dependa de el).
-- =====================================================================

insert into public.matriz_minimos (contexto, campo, nivel)
select c.contexto, 'sexo', case when c.contexto = 'alumno_adulto' then 'V' else '-' end
from (select unnest(array[
  'prospecto', 'prueba', 'alumno_adulto', 'alumno_menor', 'profesor',
  'tercero_persona', 'tercero_org', 'proveedor', 'form_publico'
]) as contexto) c
on conflict (contexto, campo) do nothing;

notify pgrst, 'reload schema';
