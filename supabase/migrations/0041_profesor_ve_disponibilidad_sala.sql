-- =====================================================================
-- TROPICANA - 0041: Profesor ve la disponibilidad de sala
-- ---------------------------------------------------------------------
-- PARA QUE. Javier (2026-09-17), al mover la disponibilidad de sala (C2)
-- fuera de Administracion a su propia pantalla operativa (/sala): "ver las
-- actividades y disponibilidad de las salas... es totalmente cotidiano" y
-- confirmo que el rol Profesor deberia poder VERLA (no bloquear/cancelar,
-- eso sigue en 'editar', que esta migracion no toca).
--
-- POR QUE ES UNA MIGRACION Y NO UN CLIC EN ROLES Y PERMISOS. Profesor es
-- un rol DE SISTEMA (es_sistema=true, nace en la 0001, igual que
-- Administrador): es parte del diseno base del producto, no una
-- configuracion libre de Javier. Cuando el producto le agrega una
-- capacidad de base a un rol de sistema, nace en migracion -- regla de
-- calidad 7, mismo criterio que uso la 0038 al separar el modulo "sala".
--
-- POR QUE ASISTENTE Y GERENTE *NO* SE TOCAN ACA (a proposito). Los dos
-- tienen es_sistema=false: son roles que Javier crea y configura el mismo
-- desde Roles y Permisos, no un dato que el producto deba decidir por el.
-- Javier (mismo dia, sobre si Asistente deberia poder bloquear sala):
-- "la respuesta es si. Pero nada debe ser hardcodeado, salvo que tomemos
-- a asistente como un usuario-sistema, similar al caso de administrador y
-- profesor" -- como Asistente no lo es, ese ajuste lo hace el desde la
-- pantalla, marcando el modulo "sala" (ya esta en la matriz, migracion
-- 0038), y no via una migracion que le fuerce el valor.
--
-- Idempotente y ADITIVA.
-- =====================================================================

insert into public.rol_permisos (rol_id, modulo, accion, permitido)
select r.id, 'sala', 'ver', true
from public.roles r
where r.clave = 'profesor'
on conflict (rol_id, modulo, accion) do update set permitido = true;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0041
-- =====================================================================
