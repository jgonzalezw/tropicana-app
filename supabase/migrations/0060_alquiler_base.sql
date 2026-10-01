-- =====================================================================
-- TROPICANA - 0060: base del alquiler de sala (C3, hito H7, tanda 1)
-- ---------------------------------------------------------------------
-- PARA QUE. Primera tanda de H7: lo que hace falta para que el alquiler
-- exista como tipo de plan y tenga su permiso, antes de la venta.
--   1. Modulo de permisos "alquileres" (Javier, 2026-10-01; regla de
--      proceso 11: toda pantalla nueva trae su opcion en Roles y Permisos,
--      no usa la de otro modulo). Nace copiando los permisos de
--      "particulares" a cada rol, para que nadie pierda ni gane acceso por
--      sorpresa -- salvo los roles con alcance 'propio' en particulares
--      (el Profesor): un alquiler no tiene profesor dueño, asi que ese
--      alcance no tiene sentido y el rol queda sin acceso hasta que
--      Javier se lo de a mano.
--   2. Matriz de minimos: el documento (NIT) es OBLIGATORIO para una
--      organizacion tercera (Javier, 2026-10-01, decision D23 para este
--      caso). Regla de calidad 7: lo que el codigo lee nace en una
--      migracion, no suelto en dev.
--   3. Dos parametros de politica: el modo de la categoria de cliente
--      (automatica / editable) y el tope del recargo de extension.
--
-- Idempotente y aditiva: no toca ningun dato de dominio.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Permisos del modulo "alquileres"
-- ---------------------------------------------------------------------
insert into public.rol_permisos (rol_id, modulo, accion, permitido)
select rp.rol_id, 'alquileres', rp.accion, rp.permitido
from public.rol_permisos rp
where rp.modulo = 'particulares'
  and not exists (
    select 1
    from public.rol_visibilidad v
    where v.rol_id = rp.rol_id
      and v.modulo = 'particulares'
      and v.alcance = 'propio'
  )
on conflict (rol_id, modulo, accion) do nothing;

-- ---------------------------------------------------------------------
-- 2. NIT obligatorio para una organizacion tercera
-- ---------------------------------------------------------------------
update public.matriz_minimos
set nivel = 'O'
where contexto = 'tercero_org'
  and campo = 'documento'
  and nivel <> 'O';

-- ---------------------------------------------------------------------
-- 3. Parametros de la politica de alquiler (Javier, 2026-10-01)
--    * alquiler_categoria_modo: si la categoria de cliente que propone el
--      sistema se puede cambiar a mano. La fija la gerente segun su
--      politica; arranca en 'automatica' (no se cambia). Regla 24.
--    * extension_recargo_max_pct: tope del recargo % de extension de un
--      plan (antes no tenia tope).
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo, opciones)
select 'alquiler_categoria_modo', 'automatica', 'texto',
       'Categoría de cliente en alquileres',
       'Cómo se trata la categoría que el sistema propone al vender un alquiler '
       '(alumno, profesor de Tropicana, profesor externo o tercero). "Automática": '
       'no se cambia. "Editable": se puede cambiar a mano, con una glosa obligatoria '
       'que queda guardada con la venta junto a la propuesta original.',
       'Clases Particulares',
       '[{"valor":"automatica","etiqueta":"Automática (no se cambia)"},
         {"valor":"editable","etiqueta":"Editable (con glosa obligatoria)"}]'::jsonb
where not exists (select 1 from public.parametros where clave = 'alquiler_categoria_modo');

insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo)
select 'extension_recargo_max_pct', '100', 'numero',
       'Recargo máximo de extensión (%)',
       'Tope del recargo porcentual que un plan puede cobrar al extender una '
       'membresía por encima del precio de lista. Un plan no puede fijar un '
       'recargo mayor.',
       'Clases Particulares'
where not exists (select 1 from public.parametros where clave = 'extension_recargo_max_pct');

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0060
-- =====================================================================
