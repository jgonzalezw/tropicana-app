-- =====================================================================
-- TROPICANA - 0030: quien dicto la clase deja de ser una suposicion
-- ---------------------------------------------------------------------
-- REGLA 20 (Javier, 2026-09-12): "Si una clase no se cancelo y se registro
-- la asistencia, alguien la dicto, no podes asumirlo."
--
-- `sesiones.profesor_id` YA EXISTIA, pero se llenaba por INFERENCIA: al
-- guardar la asistencia se estampaba el profesor de la asignacion vigente
-- —sin mirar la fecha de la clase— y nadie lo leia. O sea: el campo donde
-- debia estar el hecho se completaba con una conjetura, y encima con la
-- conjetura equivocada (la asignacion de HOY, no la de ese dia).
--
-- A partir de aca:
--   * `profesor_id`        = QUIEN DICTO la clase. Un hecho, elegido al
--                            registrar la asistencia.
--   * `titular_id`         = el titular vigente ESE DIA, guardado como
--                            snapshot. Se guarda y no se recalcula porque
--                            las asignaciones se corrigen, y de este campo
--                            depende a quien se le descuenta el reemplazo
--                            (regla 20a). Es la regla 12 aplicada.
--   * `reemplazo_motivo`   = catalogo `motivo_reemplazo`. NULL = la dicto
--                            el titular, no hubo reemplazo.
--   * `reemplazo_costo`    = lo que se le paga al reemplazante por esa
--                            clase. Se confirma al registrar la asistencia.
--
-- Las dos ramas de la regla 20, que es lo que decide la plata:
--   'titular'        -> la clase le cuenta al titular y la cobra normal;
--                       el costo del reemplazo se le DESCUENTA del total
--                       (regla 20a). El descuento es D17b, sin construir.
--   'administrativo' -> la parte de esa clase queda para TROPICANA, de
--                       donde sale el costo del reemplazo (regla 20b).
--                       No se le descuenta a nadie.
--
-- `profesores.tarifa_reemplazo` es la REFERENCIA por clase dictada como
-- reemplazante. Javier: el monto "puede obtenerse referencialmente de la
-- tabla de profesores" — el campo no existia. Es referencia, no sentencia:
-- el monto final se confirma al registrar la asistencia (regla 12, el
-- snapshot manda sobre la tabla).
--
-- Aditiva: no toca ninguna sesion existente. Las de antes quedan con
-- `reemplazo_motivo` NULL (= la dicto el titular), que es el caso normal.
-- =====================================================================

alter table public.profesores
  add column if not exists tarifa_reemplazo numeric(12,2);

comment on column public.profesores.tarifa_reemplazo is
  'Referencia de lo que se le paga por clase cuando dicta como reemplazante. '
  'El monto real se confirma al registrar la asistencia.';

alter table public.sesiones
  add column if not exists titular_id bigint references public.profesores(id),
  add column if not exists reemplazo_motivo text,
  add column if not exists reemplazo_costo numeric(12,2);

comment on column public.sesiones.profesor_id is
  'QUIEN DICTO la clase. Hecho registrado al tomar asistencia, no inferido.';
comment on column public.sesiones.titular_id is
  'El titular vigente ESE DIA, como snapshot. De el depende a quien se le '
  'descuenta un reemplazo atribuible (regla de negocio 20a).';
comment on column public.sesiones.reemplazo_motivo is
  'Catalogo motivo_reemplazo. NULL = la dicto el titular. "titular" = se le '
  'descuenta a el; "administrativo" = la parte queda para Tropicana.';
comment on column public.sesiones.reemplazo_costo is
  'Lo que se le paga al reemplazante por esta clase.';

-- Catalogo de motivos (regla de negocio 13: nada de motivos hardcodeados).
insert into public.catalogos (clave, nombre, descripcion, es_sistema)
select 'motivo_reemplazo', 'Motivos de reemplazo de profesor',
       'Por que la clase la dicto alguien distinto del titular. Decide quien '
       'se queda con la parte de esa clase (regla de negocio 20).', true
 where not exists (select 1 from public.catalogos where clave = 'motivo_reemplazo');

insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden, activo)
select c.id, v.valor, v.etiqueta, v.orden, true
  from public.catalogos c
  cross join (values
    ('titular', 'Ausencia del titular (se le descuenta el reemplazo)', 1),
    ('administrativo', 'Causa administrativa de la academia (Tropicana)', 2)
  ) as v(valor, etiqueta, orden)
 where c.clave = 'motivo_reemplazo'
   and not exists (select 1 from public.catalogo_valores cv
                    where cv.catalogo_id = c.id and cv.valor = v.valor);

notify pgrst, 'reload schema';
