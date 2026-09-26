-- =====================================================================
-- TROPICANA - 0056: alcance propio de Particulares + permiso propio para
-- Disponibilidad de sala
-- ---------------------------------------------------------------------
-- PARA QUE. Javier probó H4 en su local con la cuenta de Oscar Núñez (rol
-- Profesor) y encontró dos problemas de permisos, previos a H4 pero recién
-- visibles al usar el flujo completo:
--
--   1. "particulares" no tenía alcance propio/todo (0043): con permiso de
--      Ver, un profesor veía TODAS las membresías de particulares, no solo
--      las suyas; con Editar, podía cambiar reservas de alumnos de OTRO
--      profesor. Se suma "particulares" a MODULOS_CON_ALCANCE y el Profesor
--      arranca en 'propio' (mismo default que asistencia/liquidaciones).
--
--   2. "Disponibilidad de sala" (/sala, pantalla operativa de C2) no tenía
--      permiso propio: usaba el módulo "sala", el mismo de Administración →
--      Sala y horarios (el horario base) — una sola casilla, rotulada "Sala
--      y horarios", gobernando dos pantallas totalmente distintas (regla de
--      proceso 11: una pantalla, su permiso). Javier: "no encontré forma de
--      dar permisos para /Salas" — y al buscarlo tocó esa casilla compartida
--      y sin querer le sacó /sala al Profesor.
--      Se crea el módulo "disponibilidad_sala"; el código pasa a leerlo en
--      /sala y sus acciones (código, no esta migración). Acá se COPIAN los
--      permisos actuales de "sala" a "disponibilidad_sala" para cada rol —
--      nadie pierde ni gana acceso por el split— y se corrige el Ver del
--      Profesor a `true`, que es lo que la 0041 ya había decidido y que el
--      clic accidental en la casilla compartida había apagado.
--
-- Idempotente y ADITIVO: ningún dato de dominio se toca.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Particulares: alcance 'propio' por defecto para el rol Profesor.
-- ---------------------------------------------------------------------
insert into public.rol_visibilidad (rol_id, modulo, alcance)
select r.id, 'particulares', 'propio'
from public.roles r
where r.clave = 'profesor'
on conflict (rol_id, modulo) do nothing;

-- ---------------------------------------------------------------------
-- 2. Disponibilidad de sala: copiar los permisos de "sala" a
--    "disponibilidad_sala" para cada rol que ya tenga alguno.
-- ---------------------------------------------------------------------
insert into public.rol_permisos (rol_id, modulo, accion, permitido)
select rol_id, 'disponibilidad_sala', accion, permitido
from public.rol_permisos
where modulo = 'sala'
on conflict (rol_id, modulo, accion) do nothing;

-- Corrige el Ver del Profesor a como quedó decidido en la 0041 (la sala
-- operativa la ve): por si en esta base ya estaba en `false` por el clic
-- accidental descrito arriba. Sin efecto donde ya estaba en `true`.
insert into public.rol_permisos (rol_id, modulo, accion, permitido)
select r.id, 'disponibilidad_sala', 'ver', true
from public.roles r
where r.clave = 'profesor'
on conflict (rol_id, modulo, accion) do update set permitido = true;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 0056
-- =====================================================================
