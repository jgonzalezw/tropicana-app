-- =====================================================================
-- TROPICANA — 0002: módulo de permisos "usuarios" (independiente de
-- "administracion"), para que un rol pueda gestionar usuarios sin tener
-- acceso a roles, parámetros ni catálogos.
-- Ejecutar en Supabase → SQL Editor → New query.
-- =====================================================================

-- El Administrador tiene todas las acciones del nuevo módulo.
insert into public.rol_permisos (rol_id, modulo, accion, permitido)
select r.id, 'usuarios', a.accion, true
from public.roles r
cross join (values ('ver'),('crear'),('editar'),('eliminar')) as a(accion)
where r.clave = 'administrador'
on conflict (rol_id, modulo, accion) do nothing;

-- Nota: para que un rol Gerente ya existente tome el módulo Usuarios,
-- volvé a aplicarle la plantilla "Gerente (gestión)" desde la app
-- (Administración → Roles y permisos). Un solo clic.
