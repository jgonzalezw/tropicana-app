-- =====================================================================
-- TROPICANA - 0050: las funciones de la 0048 no se ejecutan sin sesion
-- ---------------------------------------------------------------------
-- PARA QUE. `get_advisors` (pase de la 0048 a produccion, 2026-09-24)
-- marco que las cinco funciones SECURITY DEFINER que crea la 0048 se
-- pueden llamar por RPC (`/rest/v1/rpc/...`) incluso sin iniciar sesion
-- (rol `anon`). Postgres le da EXECUTE a PUBLIC por defecto.
--
-- Cuatro de ellas sin sesion devuelven falso/vacio (miran auth.uid()),
-- pero no tienen por que estar abiertas. `buscar_por_documento` es la que
-- importa: devolveria el contacto_id de un documento, o sea, confirmaria
-- si un numero de documento existe. Se cierra antes de que se carguen
-- documentos (Javier empezo a cargarlos el 2026-09-24).
--
-- QUE HACE.
--   - tiene_permiso, alcance_de, profesor_actual_id,
--     contacto_visible_por_profesor: se les saca EXECUTE a public y anon.
--     `authenticated` lo conserva: las politicas RLS de la 0048 las
--     llaman, y una politica corre con los permisos de quien consulta.
--   - buscar_por_documento: se le saca tambien a `authenticated`. La app
--     no la usa (verificado por grep); las acciones del servidor leen
--     `contactos_privados` con la clave de servicio.
--
-- QUE NO HACE. `es_admin` y `handle_new_user` tienen el mismo aviso desde
-- antes de la 0048; quedan fuera de esta migracion a proposito.
-- =====================================================================

revoke execute on function public.tiene_permiso(text, text) from public, anon;
revoke execute on function public.alcance_de(text) from public, anon;
revoke execute on function public.profesor_actual_id() from public, anon;
revoke execute on function public.contacto_visible_por_profesor(bigint) from public, anon;
revoke execute on function public.buscar_por_documento(text, text, text) from public, anon, authenticated;

grant execute on function public.tiene_permiso(text, text) to authenticated;
grant execute on function public.alcance_de(text) to authenticated;
grant execute on function public.profesor_actual_id() to authenticated;
grant execute on function public.contacto_visible_por_profesor(bigint) to authenticated;

notify pgrst, 'reload schema';
