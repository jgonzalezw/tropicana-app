-- =====================================================================
-- TROPICANA - 0032: el descuento al profesor es un concepto aparte
-- ---------------------------------------------------------------------
-- REGLA 20a (Javier, 2026-09-12): cuando la clase la dicto un reemplazante
-- porque el TITULAR falto, "la liquidacion se mantiene normal, pero al
-- total se le descuenta los reemplazos". Y lo dijo con todas las letras:
-- "El descuento es un concepto aparte en la liquidacion: no es una
-- comision."
--
-- POR QUE UNA TABLA NUEVA Y NO `comisiones_devengadas`. Esa tabla es de
-- DEVENGOS: lo que se le debe al profesor, con su membresia, su base y su
-- criterio. Un descuento no tiene nada de eso — cuelga de una SESION, no
-- de una venta— y su `tipo` esta restringido a 'comision' / 'referido'.
-- Meterlo ahi con monto negativo seria repetir la confusion que el
-- glosario existe para evitar: un concepto, un nombre.
--
-- FORMA. Un descuento por clase, idempotente por `sesion_id`: registrar la
-- misma clase dos veces no descuenta dos veces. `sesion_id` es NULLABLE a
-- proposito, para que una multa manual —que Javier menciono junto al
-- reemplazo— entre en la misma tabla el dia que se decida como se carga.
--
-- `liquidaciones.total_descuentos` separa las dos plata: lo devengado sigue
-- siendo lo devengado, y el neto es devengado - descuentos - pagado. Si se
-- restara del devengado, el comprobante ya no podria mostrar la comision
-- completa, que es lo que el profesor tiene derecho a discutir.
--
-- Aditiva: no toca ninguna liquidacion existente (`total_descuentos`
-- arranca en 0 y ninguna fila nace sola).
-- =====================================================================

create table if not exists public.descuentos_liquidacion (
  id              bigint generated always as identity primary key,
  profesor_id     bigint not null references public.profesores(id),
  -- La clase que lo origina. NULL = descuento cargado a mano (una multa).
  sesion_id       bigint references public.sesiones(id) on delete cascade,
  -- El mes al que corresponde, con el mismo criterio que una comision.
  periodo         date not null,
  motivo          text not null,
  monto           numeric(12,2) not null check (monto > 0),
  -- La glosa que permite auditarlo sin abrir el codigo.
  origen          text,
  liquidacion_id  bigint references public.liquidaciones(id) on delete set null,
  creado_en       timestamptz not null default now()
);

comment on table public.descuentos_liquidacion is
  'Lo que se le descuenta a un profesor de su liquidacion: el costo del '
  'reemplazante cuando falto sin justificar (regla de negocio 20a), y las '
  'multas. NO es una comision — por eso no vive en comisiones_devengadas.';
comment on column public.descuentos_liquidacion.sesion_id is
  'La clase que origina el descuento. NULL en un descuento cargado a mano.';
comment on column public.descuentos_liquidacion.monto is
  'Siempre POSITIVO: es lo que se resta. El signo lo pone la cuenta, no el dato.';

-- Un descuento por clase: volver a guardar la asistencia no descuenta dos veces.
create unique index if not exists descuentos_liquidacion_sesion_uniq
  on public.descuentos_liquidacion (sesion_id)
  where sesion_id is not null;

create index if not exists descuentos_liquidacion_profesor_idx
  on public.descuentos_liquidacion (profesor_id, periodo);

-- Lo devengado sigue siendo lo devengado; el descuento va aparte.
alter table public.liquidaciones
  add column if not exists total_descuentos numeric(12,2) not null default 0;

comment on column public.liquidaciones.total_descuentos is
  'Suma de descuentos_liquidacion de esta liquidacion. El neto es '
  'total_devengado - total_descuentos - total_pagado.';

-- Motivos, a catalogo (regla de negocio 13).
insert into public.catalogos (clave, nombre, descripcion, es_sistema)
select 'motivo_descuento', 'Motivos de descuento al profesor',
       'Por que se le descuenta algo de su liquidacion.', true
 where not exists (select 1 from public.catalogos where clave = 'motivo_descuento');

insert into public.catalogo_valores (catalogo_id, valor, etiqueta, orden, activo)
select c.id, v.valor, v.etiqueta, v.orden, true
  from public.catalogos c
  cross join (values
    ('reemplazo', 'Costo del reemplazante por su ausencia', 1),
    ('multa', 'Multa', 2)
  ) as v(valor, etiqueta, orden)
 where c.clave = 'motivo_descuento'
   and not exists (select 1 from public.catalogo_valores cv
                    where cv.catalogo_id = c.id and cv.valor = v.valor);

-- RLS con el mismo patron que `liquidacion_items`: todos leen, escribe admin.
alter table public.descuentos_liquidacion enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'descuentos_liquidacion'
                    and policyname = 'descuentos_liquidacion_select') then
    create policy descuentos_liquidacion_select on public.descuentos_liquidacion
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies
                  where tablename = 'descuentos_liquidacion'
                    and policyname = 'descuentos_liquidacion_admin_write') then
    create policy descuentos_liquidacion_admin_write on public.descuentos_liquidacion
      for all using (es_admin()) with check (es_admin());
  end if;
end $$;

notify pgrst, 'reload schema';
