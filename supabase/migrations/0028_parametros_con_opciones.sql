-- =====================================================================
-- TROPICANA - 0028: un parametro con alternativas se elige de una lista
-- ---------------------------------------------------------------------
-- REGLA (Javier, 2026-09-11): "SIEMPRE que se tengan valores alternativos
-- a elegir, debes poner un control que permita hacerlo desde una lista de
-- opciones, nunca escribirlos a mano, esto permite errores."
--
-- Hasta ahora el unico parametro que se elegia era el booleano, porque el
-- control lo decidia el `tipo`. Todo lo demas caia en un input de texto
-- libre: `liquidacion_reparto_pantalla` aceptaba "completo", "compacto" y
-- tambien "compactoo" — y un valor invalido no falla, cae al default y la
-- pantalla se comporta distinto sin decir por que.
--
-- `opciones` es la lista cerrada de valores admitidos, con su etiqueta:
--   [{"valor":"completo","etiqueta":"Reparto completo"}, ...]
-- NULL = el parametro no tiene alternativas (un numero, un texto libre).
-- La pantalla dibuja un <select> cuando hay opciones, y el servidor
-- rechaza lo que no este en la lista: el control de la interfaz ayuda, el
-- que decide es el servidor.
--
-- Ademas corrige el subgrupo duplicado: los dos parametros del reparto
-- habian abierto un grupo "Liquidaciones" cuando ya existia "Liquidacion"
-- (donde vive el rezago). Un concepto, un nombre — tambien en la pantalla.
-- =====================================================================

alter table public.parametros
  add column if not exists opciones jsonb;

comment on column public.parametros.opciones is
  'Lista cerrada de valores admitidos, [{valor, etiqueta}]. Cuando esta '
  'cargada, la pantalla ofrece un select y el servidor rechaza cualquier '
  'otro valor. NULL = sin alternativas (numero, texto libre).';

-- Formato del reparto a prorrata: dos valores y nada mas.
update public.parametros
   set grupo = 'Liquidación',
       opciones = '[{"valor":"completo","etiqueta":"Completo (una fila por curso)"},
                    {"valor":"compacto","etiqueta":"Compacto (una linea)"}]'::jsonb
 where clave in ('liquidacion_reparto_pantalla', 'liquidacion_reparto_impreso');

-- Periodicidad: hoy el calculo es a mes vencido y no hay otro implementado.
-- Dejarlo como texto libre invita a escribir "quincena" y que no pase nada
-- visible (regla de calidad 1: un valor que no se soporta no puede verse
-- igual que uno que si).
-- Y de paso el tercero: `periodicidad_liquidacion` era el unico habitante
-- del grupo "Comisiones", hablando de lo mismo que "Liquidacion". Tres
-- grupos para un tema es lo que hace que un parametro no se encuentre.
update public.parametros
   set grupo = 'Liquidación',
       opciones = '[{"valor":"mes","etiqueta":"Mensual, a mes vencido"}]'::jsonb,
       descripcion = coalesce(descripcion, '') ||
         case when coalesce(descripcion, '') = '' then '' else ' ' end ||
         'Hoy solo esta implementada la liquidacion a mes vencido.'
 where clave = 'periodicidad_liquidacion'
   and coalesce(descripcion, '') not like '%mes vencido%';

notify pgrst, 'reload schema';
