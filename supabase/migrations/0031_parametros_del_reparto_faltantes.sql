-- =====================================================================
-- TROPICANA - 0031: los dos parametros del reparto, creados de verdad
-- ---------------------------------------------------------------------
-- ERROR QUE CORRIGE. `liquidacion_reparto_pantalla` y
-- `liquidacion_reparto_impreso` se crearon en dev con SQL suelto, fuera de
-- una migracion versionada. La 0028 los da por existentes: solo los
-- `update` para ponerles grupo y opciones. Resultado: en dev estaban y en
-- produccion no, y el pase del 2026-09-12 no los llevo. La pantalla de
-- Parametros mostraba 4 en el grupo "Liquidacion" y 2 en produccion.
--
-- No rompia nada visible —sin el parametro, el codigo cae a su default—
-- pero la configuracion no existia y por lo tanto no se podia cambiar: una
-- capacidad del producto que no estaba y no lo decia (regla de calidad 5).
--
-- LA LECCION, escrita en la regla de calidad 7: todo parametro o valor de
-- catalogo que el codigo lea tiene que nacer en una migracion. Cargarlo a
-- mano en dev lo deja fuera de produccion para siempre, y no hay control
-- que lo note porque cada base se mira sola.
--
-- Idempotente: `on conflict do nothing`. En dev no cambia nada.
-- =====================================================================

insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo, opciones)
values
  (
    'liquidacion_reparto_pantalla', 'compacto', 'texto',
    'Reparto a prorrata en pantalla',
    'Como se muestra el reparto de una comision multi-curso en la pantalla del '
    'comprobante: "completo" abre el peso de cada curso en una tabla; '
    '"compacto" lo resume en una linea.',
    'Liquidación',
    '[{"valor":"completo","etiqueta":"Completo (una fila por curso)"},
      {"valor":"compacto","etiqueta":"Compacto (una linea)"}]'::jsonb
  ),
  (
    'liquidacion_reparto_impreso', 'compacto', 'texto',
    'Reparto a prorrata impreso',
    'Lo mismo, para el comprobante impreso. Se usa "compacto" por defecto: una '
    'liquidacion real tiene muchas membresias y la version completa agrega '
    'varias filas por cada plan multi-curso.',
    'Liquidación',
    '[{"valor":"completo","etiqueta":"Completo (una fila por curso)"},
      {"valor":"compacto","etiqueta":"Compacto (una linea)"}]'::jsonb
  )
on conflict (clave) do nothing;

notify pgrst, 'reload schema';
