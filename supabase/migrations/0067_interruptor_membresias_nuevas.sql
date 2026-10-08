-- ---------------------------------------------------------------------
-- 0067 · Interruptor de la sección nueva «Membresías» (I-012, fase 1a, D37)
--
-- `membresias_nuevas`: apagado = la app se comporta exactamente igual que
-- antes. Es global por entorno (regla 14: nada se decide por persona):
-- se prende en dev y queda apagado en producción hasta que Javier lo pida.
--
-- Reversa: delete from public.parametros where clave = 'membresias_nuevas';
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo)
select 'membresias_nuevas', 'false', 'booleano',
       'Sección nueva «Membresías»',
       'Si se muestra la sección nueva Membresías (lista única y ficha de cada membresía). '
       'Apagado, la aplicación se comporta como antes. La ven los roles con permiso de ver '
       'alumnos, particulares o alquileres.',
       'Sistema'
where not exists (select 1 from public.parametros where clave = 'membresias_nuevas');

notify pgrst, 'reload schema';
