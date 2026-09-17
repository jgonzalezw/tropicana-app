-- =====================================================================
-- TROPICANA - 0038: Planes, Liquidaciones, Precios y Sala como modulos
-- propios de Roles y Permisos
-- ---------------------------------------------------------------------
-- Javier (2026-09-16), reportado como bug urgente antes del pase a
-- produccion: "no se puede establecer roles y permisos para Planes,
-- liquidaciones, precios y paquetes... el usuario asistente ya esta
-- trabajando como usuario de la aplicacion y no se le puede permitir
-- acceso a modulos donde debe estar restringido".
--
-- LA CAUSA. Esas pantallas (mas Sala y horarios, mismo problema aunque no
-- se nombro) vivian gateadas con el permiso de OTRO modulo:
--   /planes                -> "cursos"
--   /liquidaciones         -> "comisiones"
--   /precios               -> "administracion"
--   /administracion/sala   -> "administracion"
-- Un rol con permiso de "cursos" veia Planes sin poder evitarlo, y
-- Precios y Sala ni siquiera se podian separar entre si.
--
-- QUE HACE. Agrega "planes", "liquidaciones", "precios" y "sala" a la
-- lista de modulos, y les da el mismo permiso que ya tenia el modulo
-- prestado, PARA CADA ROL, para no cambiarle el acceso a nadie el dia del
-- pase: el administrador sigue viendo todo, y Gerente/Asistente quedan
-- con exactamente lo que ya tenian a traves del modulo viejo. Javier
-- ajusta desde la pantalla de Roles y Permisos a partir de aca -esa es
-- la separacion que pidio, no un valor que este script tenga que adivinar-.
--
-- Regla de calidad 7: el modulo nuevo nace en una migracion, no se carga
-- a mano en dev. Idempotente y ADITIVA: no toca ninguna fila de dominio.
-- =====================================================================

insert into public.rol_permisos (rol_id, modulo, accion, permitido)
select p.rol_id, v.modulo_nuevo, p.accion, p.permitido
from public.rol_permisos p
cross join (values
  ('cursos',        'planes'),
  ('comisiones',    'liquidaciones'),
  ('administracion','precios'),
  ('administracion','sala')
) as v(modulo_viejo, modulo_nuevo)
where p.modulo = v.modulo_viejo
on conflict (rol_id, modulo, accion) do nothing;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0038
-- =====================================================================
